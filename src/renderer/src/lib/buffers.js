// Open files ("buffers"): one Monaco model per path, shared by every group that
// shows it (that is how Clone File works). Tracks the saved version for the
// unsaved dot. Paths:
//   "src/main.cpp"            file in the opened folder
//   "user:snippets/x.sublime-snippet"   file in StressLab's User folder
//   "default:Preferences.json" read-only text provided by the app
import { monaco } from '../monaco'
import { modelPath, monacoLanguage } from './files'

const uri = (path) => monaco.Uri.parse(modelPath(path))

export function createBuffers({ onChange, readDefault }) {
  const saved = new Map() // path → alternativeVersionId at last load/save
  const savedText = new Map() // path → text at last load/save (Next Modification)
  const listeners = new Map() // path → disposable

  const model = (path) => monaco.editor.getModel(uri(path))

  async function readFile(path) {
    if (path.startsWith('user:')) return window.api.userRead(path.slice(5))
    if (path.startsWith('default:')) return readDefault(path.slice(8))
    return window.api.wsRead(path)
  }

  function adopt(path, m, text) {
    saved.set(path, m.getAlternativeVersionId())
    savedText.set(path, text)
    listeners.get(path)?.dispose()
    listeners.set(path, m.onDidChangeContent(() => onChange(path)))
  }

  // Load the file into a model (no-op if already open). `text` overrides the
  // content (hot exit restores unsaved buffers this way).
  async function ensure(path, { text, dirty } = {}) {
    let m = model(path)
    if (m) return m
    // A read error propagates: showing an empty buffer could overwrite the file on save.
    // (A restored unsaved buffer whose file is gone keeps its text, as new.)
    const disk = text === undefined ? await readFile(path) : dirty ? await readFile(path).catch(() => '') : text
    m = monaco.editor.createModel(text ?? disk, monacoLanguage(path.replace(/^(user|default):/, '')), uri(path))
    if (path.startsWith('default:')) m.updateOptions({ readOnly: true })
    adopt(path, m, disk)
    if (dirty && text !== disk) saved.set(path, -1) // restored unsaved changes stay dirty
    return m
  }

  const isDirty = (path) => {
    const m = model(path)
    return !!m && !path.startsWith('default:') && saved.get(path) !== m.getAlternativeVersionId()
  }

  async function write(path, text) {
    if (path.startsWith('default:')) throw new Error('This file is read-only')
    if (path.startsWith('user:')) return window.api.userWrite({ path: path.slice(5), text })
    return window.api.wsWrite({ path, text })
  }

  async function save(path) {
    const m = model(path)
    if (!m) return
    const text = m.getValue()
    await write(path, text)
    saved.set(path, m.getAlternativeVersionId())
    savedText.set(path, text)
    onChange(path)
  }

  // Replace the content with what's on disk (Revert File / external change).
  async function reload(path, text) {
    const m = model(path)
    if (!m) return
    text ??= await readFile(path)
    if (text !== m.getValue()) m.pushEditOperations([], [{ range: m.getFullModelRange(), text }], () => null)
    saved.set(path, m.getAlternativeVersionId())
    savedText.set(path, text)
    onChange(path)
  }

  function dispose(path) {
    listeners.get(path)?.dispose()
    listeners.delete(path)
    saved.delete(path)
    savedText.delete(path)
    model(path)?.dispose()
  }

  // Move a buffer to a new path (after a rename), keeping its text and dirtiness.
  function rename(from, to) {
    const m = model(from)
    if (!m) return
    const wasDirty = isDirty(from)
    const text = m.getValue()
    const disk = savedText.get(from)
    dispose(from)
    const n = monaco.editor.createModel(text, monacoLanguage(to), uri(to))
    adopt(to, n, disk ?? text)
    if (wasDirty) saved.set(to, -1)
  }

  return { model, ensure, isDirty, save, write, reload, dispose, rename, savedText: (p) => savedText.get(p) ?? '' }
}
