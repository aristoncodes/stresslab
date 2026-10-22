import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import FileTree from '../components/editor/FileTree'
import CPPane from '../components/editor/CPPane'
import EditorGroup from '../components/editor/EditorGroup'
import QuickPanel from '../components/editor/QuickPanel'
import FindPanel from '../components/editor/FindPanel'
import { monaco } from '../monaco'
import { parseDiagnostics, panelText } from '../lib/buildOutput'
import {
  monacoLanguage,
  runLanguage,
  baseName,
  parentOf,
  joinRel,
  LANGUAGE_LABEL
} from '../lib/files'
import { bindSublimeKeys, shortcutLabel } from '../lib/keybindings'
import { flattenCommands } from '../../../shared/editorCommands.js'
import { createBuffers } from '../lib/buffers'
import {
  DEFAULT_SETTINGS,
  defaultSettingsText,
  USER_SETTINGS_TEMPLATE,
  parseSettings,
  editorOptions,
  applyIndentation,
  beforeSave
} from '../lib/editorSettings'
import { applyScheme, SCHEME_NAMES } from '../lib/schemes'
import {
  snippetsFor,
  loadUserSnippets,
  registerSnippetCompletions,
  insertSnippet,
  NEW_SNIPPET_TEMPLATE
} from '../lib/snippets'
import { createMacroRecorder } from '../lib/macros'
import { findSymbols } from '../lib/symbols'
import { fuzzyFilter } from '../lib/fuzzy'
import * as ops from '../lib/editorOps'
import { cleanError } from '../lib/errors'
import { key } from '../lib/keys'
import { publishOpenFiles } from '../lib/openFiles'

// Sublime layouts → number of groups and CSS grid.
const LAYOUTS = {
  single: { n: 1, grid: '1fr / 1fr' },
  cols2: { n: 2, grid: '1fr / 1fr 1fr' },
  cols3: { n: 3, grid: '1fr / 1fr 1fr 1fr' },
  cols4: { n: 4, grid: '1fr / repeat(4, 1fr)' },
  rows2: { n: 2, grid: '1fr 1fr / 1fr' },
  rows3: { n: 3, grid: '1fr 1fr 1fr / 1fr' },
  grid4: { n: 4, grid: '1fr 1fr / 1fr 1fr' },
  cp: { n: 1, grid: '1fr / 1fr' }
}
const SYNTAXES = {
  cpp: 'C++',
  c: 'C',
  python: 'Python',
  java: 'Java',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  go: 'Go',
  rust: 'Rust',
  kotlin: 'Kotlin',
  csharp: 'C#',
  shell: 'Shell Script',
  json: 'JSON',
  yaml: 'YAML',
  markdown: 'Markdown',
  html: 'HTML',
  css: 'CSS',
  plaintext: 'Plain Text'
}
const ENCODINGS = [
  ['utf-8', 'UTF-8'],
  ['utf-8-bom', 'UTF-8 with BOM'],
  ['utf-16le', 'UTF-16 LE'],
  ['utf-16be', 'UTF-16 BE'],
  ['latin1', 'Western (ISO 8859-1)'],
  ['windows-1252', 'Western (Windows 1252)'],
  ['iso-8859-2', 'Central European (ISO 8859-2)'],
  ['koi8-r', 'Cyrillic (KOI8-R)'],
  ['windows-1251', 'Cyrillic (Windows 1251)'],
  ['shift_jis', 'Japanese (Shift JIS)'],
  ['euc-jp', 'Japanese (EUC-JP)'],
  ['gbk', 'Chinese Simplified (GBK)'],
  ['big5', 'Chinese Traditional (Big5)'],
  ['euc-kr', 'Korean (EUC-KR)']
]
const WRITABLE_ENCODINGS = new Set(['utf-8', 'utf-8-bom', 'utf-16le', 'utf-16be', 'latin1'])
const SESSION = 'Session.json'
const PREFS = 'Preferences.json'
const emptyGroup = () => ({ tabs: [], current: null, preview: null, mru: [] })
const isMac = window.api.platform === 'darwin'

// Sublime-style editor: folder sidebar, layouts of tab groups, Monaco, and every
// Sublime menu command (src/shared/editorCommands.js) wired to `commands` below.
export default function EditorView({ active, menuCommand, onSwitchMode }) {
  const [workspace, setWorkspace] = useState(null) // { name }
  const [groups, setGroups] = useState([emptyGroup()])
  const [focusGroup, setFocusGroup] = useState(0)
  const [layout, setLayoutState] = useState('single')
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [view, setView] = useState({ sidebar: true, tabs: true, status: true, distraction: false })
  const [panel, setPanel] = useState(null) // { kind: 'build', text, running } | { kind: 'find' }
  const [find, setFind] = useState(null) // { opts, results, summary, busy, error }
  const [resultIndex, setResultIndex] = useState(-1)
  const [quick, setQuick] = useState(null) // QuickPanel props
  const [status, setStatus] = useState({ line: 1, col: 1, sels: 1, chars: 0, lines: 0 })
  const [message, setMessage] = useState('')
  const [version, setVersion] = useState(0) // bumps when files change on disk
  const [newFileSignal, setNewFileSignal] = useState(0)
  const [buildSystem, setBuildSystem] = useState('auto')
  const [recording, setRecording] = useState(false)
  const [git, setGit] = useState(null) // { branch, files }
  const [, setTick] = useState(0) // re-render on buffer edits (dirty dots)

  const editors = useRef(new Map()) // group index → Monaco editor
  const groupsRef = useRef(groups)
  groupsRef.current = groups
  const focusRef = useRef(focusGroup)
  focusRef.current = focusGroup
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const workspaceRef = useRef(workspace)
  workspaceRef.current = workspace
  const gitRef = useRef(git)
  gitRef.current = git
  const closed = useRef([]) // reopen closed file stack
  const nav = useRef({ list: [], index: 0 }) // jump back / forward
  const clips = useRef([]) // paste history
  const bookmarks = useRef(new Map()) // path → decoration ids
  const gitDecos = useRef(new Map()) // path → decoration ids
  const macros = useMemo(() => createMacroRecorder(), [])
  const debug = useRef({}) // localStorage "stresslab.debug" exposes internals to test scripts
  const sessionTimer = useRef(null)
  const restoring = useRef(false)

  const buffers = useMemo(
    () =>
      createBuffers({
        onChange: () => {
          setTick((t) => t + 1)
          scheduleSession()
        },
        readDefault: (name) => (name === PREFS ? defaultSettingsText() : '')
      }),
    [] // eslint-disable-line react-hooks/exhaustive-deps
  )
  useEffect(() => {
    try {
      if (localStorage.getItem('stresslab.debug')) window.__editor = Object.assign(debug.current, { buffers, editors: editors.current, monaco })
    } catch {
      /* ignore */
    }
  }, [buffers])

  const flashTimer = useRef(null)
  const flash = (text) => {
    setMessage(text)
    clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setMessage(''), 4000)
  }
  const editor = () =>
    editors.current.get(focusRef.current) ?? [...editors.current.values()][0] ?? null
  const currentPath = () => groupsRef.current[focusRef.current]?.current ?? null
  const shownAnywhere = (path, gs = groupsRef.current) => gs.some((g) => g.tabs.includes(path))
  const allTabs = () => [...new Set(groupsRef.current.flatMap((g) => g.tabs))]
  const isWorkspacePath = (p) => p && !/^(user|default|hex):/.test(p)

  // ---------- settings & colour scheme ----------
  const loadSettings = useCallback(async () => {
    let text
    try {
      text = await window.api.userRead(PREFS)
    } catch {
      text = USER_SETTINGS_TEMPLATE
      await window.api.userWrite({ path: PREFS, text }).catch(() => {})
    }
    try {
      const s = parseSettings(text)
      setSettings(s)
      return s
    } catch (e) {
      flash(`Error in Preferences.json: ${e.message}`)
      return settingsRef.current
    }
  }, [])

  useEffect(() => {
    registerSnippetCompletions()
    loadUserSnippets()
    loadSettings()
  }, [loadSettings])
  useEffect(() => {
    applyScheme(settings.color_scheme)
    for (const p of allTabs()) {
      const m = buffers.model(p)
      if (m && !p.startsWith('default:')) applyIndentation(m, settings)
    }
  }, [settings]) // eslint-disable-line react-hooks/exhaustive-deps

  // Write one setting into the user Preferences.json (keeps comments and other keys).
  async function setUserSetting(name, value) {
    let text = await window.api.userRead(PREFS).catch(() => USER_SETTINGS_TEMPLATE)
    const json = JSON.stringify(value)
    const re = new RegExp(`("${name}"\\s*:\\s*)(\\[[^\\]]*\\]|"(?:[^"\\\\]|\\\\.)*"|[^,\\n}]+)`)
    if (re.test(text)) text = text.replace(re, (_m, k) => k + json)
    else {
      // Append before the closing brace, adding a comma after the previous entry.
      const head = text.slice(0, text.lastIndexOf('}')).replace(/\s*$/, '')
      text = `${head}${/[{,]$/.test(head) ? '' : ','}\n\t"${name}": ${json}\n}\n`
    }
    await window.api.userWrite({ path: PREFS, text })
    const m = buffers.model(`user:${PREFS}`)
    if (m) await buffers.reload(`user:${PREFS}`, text)
    return loadSettings()
  }

  // ---------- opening, tabs, groups ----------
  async function openFile(
    path,
    { group = focusRef.current, preview = false, line, col, pin = true, focus = pin } = {}
  ) {
    if (!path) return
    try {
      const fresh = !buffers.model(path)
      const m = await buffers.ensure(path)
      if (fresh && !path.startsWith('default:') && !path.startsWith('hex:'))
        applyIndentation(m, settingsRef.current)
    } catch (e) {
      return flash(cleanError(e))
    }
    setGroups((gs) =>
      gs.map((g, i) => {
        if (i !== group) return g
        let tabs = [...g.tabs]
        let previewPath = g.preview
        if (!tabs.includes(path)) {
          // A new preview replaces the previous (unmodified) preview tab, like Sublime.
          if (preview && previewPath && !buffers.isDirty(previewPath)) {
            const replaced = previewPath
            tabs[tabs.indexOf(replaced)] = path
            if (!shownAnywhere(replaced, gs.map((x, k) => (k === i ? { ...x, tabs } : x)))) setTimeout(() => buffers.dispose(replaced))
          } else tabs.push(path)
          previewPath = preview ? path : previewPath
        } else if (pin && previewPath === path) previewPath = null
        return {
          ...g,
          tabs,
          current: path,
          preview: previewPath,
          mru: [path, ...g.mru.filter((p) => p !== path)]
        }
      })
    )
    setFocusGroup(group)
    // Quick-panel previews must not take the keyboard away from the panel.
    if (line) setTimeout(() => reveal(group, line, col, focus), 60)
  }

  function reveal(group, line, col = 1, focus = true) {
    const ed = editors.current.get(group)
    if (!ed) return
    ed.setPosition({ lineNumber: line, column: col })
    ed.revealLineInCenter(line)
    if (focus) ed.focus()
  }

  // Close a tab; asks to save only when this is the last view of a dirty buffer.
  async function closeTab(path, group = focusRef.current) {
    if (!path) return true
    const elsewhere = groupsRef.current.some((g, i) => i !== group && g.tabs.includes(path))
    if (!elsewhere && buffers.isDirty(path)) {
      const choice = await window.api.confirm({
        message: `Save changes to “${baseName(path)}”?`,
        detail: 'Your changes will be lost if you don’t save them.',
        buttons: ['Save', 'Don’t Save', 'Cancel']
      })
      if (choice === 2) return false
      if (choice === 0 && !(await save(path))) return false
    }
    closed.current.push({ path, group })
    const next = groupsRef.current.map((g, i) => {
      if (i !== group) return g
      const tabs = g.tabs.filter((p) => p !== path)
      const mru = g.mru.filter((p) => p !== path)
      const current =
        g.current === path
          ? (mru[0] ?? tabs[Math.max(0, g.tabs.indexOf(path) - 1)] ?? null)
          : g.current
      return { ...g, tabs, mru, current, preview: g.preview === path ? null : g.preview }
    })
    setGroups(next)
    if (!shownAnywhere(path, next)) {
      bookmarks.current.delete(path)
      gitDecos.current.delete(path)
      buffers.dispose(path)
    }
    return true
  }

  async function closeMany(paths, group = focusRef.current) {
    for (const p of paths) if (!(await closeTab(p, group))) return false
    return true
  }

  function setLayout(kind) {
    const { n } = LAYOUTS[kind] ?? LAYOUTS.single
    setGroups((gs) => {
      if (gs.length === n) return gs
      if (gs.length < n) return [...gs, ...Array.from({ length: n - gs.length }, emptyGroup)]
      // Fewer groups: move the extra groups' tabs into the last remaining one (Sublime does the same).
      const keep = gs.slice(0, n).map((g) => ({ ...g, tabs: [...g.tabs] }))
      const last = keep[n - 1]
      for (const g of gs.slice(n))
        for (const t of g.tabs) if (!last.tabs.includes(t)) last.tabs.push(t)
      last.current ??= last.tabs[0] ?? null
      return keep
    })
    setFocusGroup((f) => Math.min(f, n - 1))
    for (const k of [...editors.current.keys()]) if (k >= n) editors.current.delete(k)
    setLayoutState(kind)
  }

  function moveTab(path, from, to, index = Infinity) {
    setGroups((gs) => {
      const next = gs.map((g) => ({ ...g, tabs: [...g.tabs], mru: [...g.mru] }))
      const src = next[from]
      const dst = next[to]
      if (!src || !dst) return gs
      src.tabs = src.tabs.filter((p) => p !== path)
      src.mru = src.mru.filter((p) => p !== path)
      if (src.current === path) src.current = src.mru[0] ?? src.tabs[0] ?? null
      if (src.preview === path) src.preview = null
      const at = Math.min(index, dst.tabs.filter((p) => p !== path).length)
      dst.tabs = dst.tabs.filter((p) => p !== path)
      dst.tabs.splice(at, 0, path)
      dst.current = path
      dst.mru = [path, ...dst.mru.filter((p) => p !== path)]
      return next
    })
    setFocusGroup(to)
  }

  function selectTab(path, group = focusRef.current) {
    setGroups((gs) =>
      gs.map((g, i) =>
        i === group ? { ...g, current: path, mru: [path, ...g.mru.filter((p) => p !== path)] } : g
      )
    )
    setFocusGroup(group)
  }

  const pinTab = (path, group = focusRef.current) =>
    setGroups((gs) =>
      gs.map((g, i) => (i === group && g.preview === path ? { ...g, preview: null } : g))
    )

  // ---------- saving ----------
  async function save(path = currentPath()) {
    if (!path || path.startsWith('default:') || path.startsWith('hex:')) return true
    const m = buffers.model(path)
    if (!m) return true
    try {
      beforeSave(m, settingsRef.current)
      await buffers.save(path)
      pinTab(path)
      if (path.startsWith('user:snippets/'))
        loadUserSnippets().then(() => flash('Snippets reloaded'))
      if (path === `user:${PREFS}`) await loadSettings()
      if (path.startsWith('user:macros/')) refreshMacroMenu()
      flash(`Saved ${baseName(path)}`)
      refreshGit()
      return true
    } catch (e) {
      flash(cleanError(e))
      return false
    }
  }
  async function saveAll() {
    for (const p of allTabs()) if (buffers.isDirty(p)) await save(p)
  }

  // ---------- workspace ----------
  function adoptWorkspace(ws) {
    for (const p of allTabs()) if (isWorkspacePath(p)) buffers.dispose(p)
    setGroups((gs) =>
      gs.map((g) => ({
        ...g,
        tabs: g.tabs.filter((p) => !isWorkspacePath(p)),
        current: isWorkspacePath(g.current) ? null : g.current,
        preview: null,
        mru: g.mru.filter((p) => !isWorkspacePath(p))
      }))
    )
    setWorkspace(ws)
    setVersion((v) => v + 1)
  }
  async function openFolder() {
    const ws = await window.api.wsOpenFolder()
    if (ws) adoptWorkspace(ws)
  }
  async function openSingleFile() {
    const ws = await window.api.wsOpenFile()
    if (!ws) return
    adoptWorkspace(ws)
    setTimeout(() => openFile(ws.file))
  }

  // Reopen the last folder, then restore the session (hot exit).
  useEffect(() => {
    window.api.wsReopen().then(async (ws) => {
      if (!ws) return
      setWorkspace(ws)
      await restoreSession(ws.name)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- hot exit / session ----------
  function scheduleSession() {
    if (restoring.current) return
    clearTimeout(sessionTimer.current)
    sessionTimer.current = setTimeout(() => writeSessionRef.current(), 800)
  }
  async function writeSession() {
    const hot = settingsRef.current.hot_exit !== 'disabled'
    const unsaved = {}
    if (hot)
      for (const p of allTabs()) if (buffers.isDirty(p)) unsaved[p] = buffers.model(p).getValue()
    const session = {
      workspace: workspace?.name ?? null,
      layout,
      focusGroup: focusRef.current,
      groups: groupsRef.current.map((g) => ({
        tabs: g.tabs.filter((p) => !p.startsWith('hex:')),
        current: g.current?.startsWith('hex:') ? null : g.current
      })),
      unsaved,
      view
    }
    await window.api.userWrite({ path: SESSION, text: JSON.stringify(session) }).catch(() => {})
  }
  const writeSessionRef = useRef(writeSession)
  writeSessionRef.current = writeSession
  useEffect(scheduleSession, [groups, layout, view]) // eslint-disable-line react-hooks/exhaustive-deps

  async function restoreSession(wsName) {
    let s
    try {
      s = JSON.parse(await window.api.userRead(SESSION))
    } catch {
      return
    }
    if (s.workspace !== wsName) return
    restoring.current = true
    try {
      setLayout(s.layout in LAYOUTS ? s.layout : 'single')
      if (s.view) setView((v) => ({ ...v, ...s.view, distraction: false }))
      const restored = []
      for (const g of s.groups ?? []) {
        const tabs = []
        for (const p of g.tabs) {
          try {
            const text = s.unsaved?.[p]
            const m = await buffers.ensure(p, text !== undefined ? { text, dirty: true } : {})
            if (!p.startsWith('default:')) applyIndentation(m, settingsRef.current)
            tabs.push(p)
          } catch {
            /* file gone */
          }
        }
        restored.push({
          ...emptyGroup(),
          tabs,
          current: tabs.includes(g.current) ? g.current : (tabs[0] ?? null),
          mru: tabs
        })
      }
      if (restored.length) setGroups(restored)
      setFocusGroup(Math.min(s.focusGroup ?? 0, Math.max(0, restored.length - 1)))
    } finally {
      restoring.current = false
    }
  }

  // Quit prompt counts unsaved files only when hot exit is off (hot exit keeps them).
  useEffect(() => {
    const n =
      settings.hot_exit === 'disabled' ? allTabs().filter((p) => buffers.isDirty(p)).length : 0
    window.api.wsSetDirty(n)
  })

  // ---------- files changed on disk ----------
  useEffect(
    () =>
      window.api.onWsChanged(async (paths) => {
        setVersion((v) => v + 1)
        refreshGit()
        for (const path of paths) {
          if (!buffers.model(path)) continue
          let text
          try {
            text = await window.api.wsRead(path)
          } catch {
            continue
          }
          if (text === buffers.model(path).getValue()) continue
          if (buffers.isDirty(path)) {
            const choice = await window.api.confirm({
              message: `“${baseName(path)}” changed on disk.`,
              detail: 'Reload it and lose your unsaved changes?',
              buttons: ['Reload', 'Keep My Changes']
            })
            if (choice !== 0) continue
          }
          await buffers.reload(path, text)
        }
      }),
    [] // eslint-disable-line react-hooks/exhaustive-deps
  )

  function renamed(from, to) {
    for (const path of allTabs()) {
      if (path !== from && !path.startsWith(from + '/')) continue
      const newPath = to + path.slice(from.length)
      buffers.rename(path, newPath)
      setGroups((gs) =>
        gs.map((g) => ({
          ...g,
          tabs: g.tabs.map((p) => (p === path ? newPath : p)),
          current: g.current === path ? newPath : g.current,
          mru: g.mru.map((p) => (p === path ? newPath : p)),
          preview: g.preview === path ? newPath : g.preview
        }))
      )
    }
  }
  const deleted = (path) => {
    for (const p of allTabs())
      if (p === path || p.startsWith(path + '/'))
        groupsRef.current.forEach((g, i) => g.tabs.includes(p) && closeTab(p, i))
  }

  // Offer runnable open files to the stress tester ("From editor").
  useEffect(() => {
    publishOpenFiles(
      allTabs()
        .filter((p) => isWorkspacePath(p) && runLanguage(p))
        .map((path) => ({ path, lang: runLanguage(path) })),
      (path) => buffers.model(path)?.getValue() ?? null
    )
  }, [groups]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- git ----------
  async function refreshGit() {
    if (!workspaceRef.current) return
    const g = await window.api.gitStatus().catch(() => null)
    setGit(g)
    if (g) for (const p of allTabs()) if (isWorkspacePath(p)) updateGitGutter(p)
  }
  async function updateGitGutter(path) {
    const m = buffers.model(path)
    if (!m) return
    const ranges = await window.api.gitDiff({ path, text: m.getValue() }).catch(() => [])
    const decos = ranges.map((r) => ({
      range: new monaco.Range(
        Math.max(1, r.from),
        1,
        Math.min(m.getLineCount(), r.to === Infinity ? m.getLineCount() : Math.max(1, r.to)),
        1
      ),
      options: { isWholeLine: true, linesDecorationsClassName: `git-gutter-${r.kind}` }
    }))
    gitDecos.current.set(path, m.deltaDecorations(gitDecos.current.get(path) ?? [], decos))
  }
  useEffect(() => {
    refreshGit()
  }, [workspace]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- build ----------
  async function build(variant = 'run') {
    const path = currentPath()
    if (!path || !isWorkspacePath(path)) return flash('Open a C++, Python or Java file to build')
    await saveAll()
    const m = buffers.model(path)
    setPanel({
      kind: 'build',
      text: `${variant === 'compile' ? 'Compiling' : 'Building'} ${baseName(path)}…`,
      running: true,
      path
    })
    try {
      const r = await window.api.buildRun({
        path,
        lang: buildSystem === 'auto' ? undefined : buildSystem,
        compileOnly: variant === 'compile'
      })
      const text = r.compiledOnly
        ? `Compiled ${baseName(path)} successfully.\n[Finished in ${r.seconds.toFixed(2)}s]`
        : panelText(r)
      setPanel({ kind: 'build', text, running: false, path, lang: r.lang })
      const marks = parseDiagnostics(r.compileError ?? (r.exitCode ? r.stderr : ''), r.lang).map(
        (d) => ({
          startLineNumber: d.line,
          endLineNumber: d.line,
          startColumn: d.col,
          endColumn: m.getLineMaxColumn(Math.min(d.line, m.getLineCount())),
          message: d.message,
          severity:
            d.severity === 'warning' ? monaco.MarkerSeverity.Warning : monaco.MarkerSeverity.Error
        })
      )
      monaco.editor.setModelMarkers(m, 'build', marks)
      setResultIndex(-1)
    } catch (e) {
      setPanel({ kind: 'build', text: cleanError(e), running: false, path })
    }
  }
  const buildErrors = () =>
    panel?.kind === 'build' ? parseDiagnostics(panel.text, panel.lang) : []

  // ---------- find in files ----------
  async function runFind(opts) {
    setFind({ opts, busy: true })
    try {
      const r = await window.api.wsSearch(opts)
      setFind({
        opts,
        results: r.results,
        summary: `${r.results.length} match${r.results.length === 1 ? '' : 'es'} in ${r.files} file${r.files === 1 ? '' : 's'}${r.truncated ? ' (stopped at 5000)' : ''}`
      })
      setResultIndex(-1)
    } catch (e) {
      setFind({ opts, error: cleanError(e) })
    }
  }
  async function runReplace(opts) {
    const choice = await window.api.confirm({
      message: `Replace “${opts.query}” with “${opts.replacement}” in all matching files?`,
      detail: 'Unsaved changes in open files are saved first.',
      buttons: ['Replace', 'Cancel']
    })
    if (choice !== 0) return
    await saveAll()
    try {
      const r = await window.api.wsReplace(opts)
      flash(
        `Replaced ${r.replacements} occurrence${r.replacements === 1 ? '' : 's'} in ${r.files} file${r.files === 1 ? '' : 's'}`
      )
      runFind(opts)
    } catch (e) {
      setFind({ opts, error: cleanError(e) })
    }
  }
  function openResult(r, i) {
    setResultIndex(i)
    pushJump()
    openFile(r.path, { line: r.line, col: r.col })
  }
  function stepResult(dir) {
    if (panel?.kind === 'find' && find?.results?.length) {
      const i = (resultIndex + dir + find.results.length) % find.results.length
      openResult(find.results[i], i)
    } else {
      const errs = buildErrors()
      if (!errs.length)
        return editor()?.trigger(
          'sublime',
          dir > 0 ? 'editor.action.marker.next' : 'editor.action.marker.prev',
          null
        )
      const i = (resultIndex + dir + errs.length) % errs.length
      setResultIndex(i)
      if (panel?.path) openFile(panel.path, { line: errs[i].line, col: errs[i].col })
    }
  }

  // ---------- navigation ----------
  function here() {
    const ed = editor()
    const p = currentPath()
    if (!ed || !p) return null
    const pos = ed.getPosition()
    return { path: p, line: pos.lineNumber, col: pos.column }
  }
  function pushJump() {
    const h = here()
    if (!h) return
    const n = nav.current
    n.list = n.list.slice(0, n.index)
    n.list.push(h)
    n.index = n.list.length
  }
  function jump(dir) {
    const n = nav.current
    if (dir < 0) {
      if (n.index === 0) return
      if (n.index === n.list.length) {
        const h = here()
        if (h) n.list.push(h)
      }
      n.index--
    } else {
      if (n.index >= n.list.length - 1) return
      n.index++
    }
    const t = n.list[n.index]
    if (t) openFile(t.path, { line: t.line, col: t.col })
  }

  // Changed lines vs the saved text (for Next/Previous Modification).
  function modifiedLines(path) {
    const m = buffers.model(path)
    if (!m) return []
    const old = buffers.savedText(path).split(/\r?\n/)
    const cur = m.getLinesContent()
    const out = []
    let j = 0
    for (let i = 0; i < cur.length; i++) {
      if (old[j] === cur[i]) {
        j++
        continue
      }
      const ahead = old.indexOf(cur[i], j)
      if (ahead !== -1 && ahead - j < 50) {
        if (ahead > j) out.push(i + 1) // lines deleted before this one
        j = ahead + 1
      } else out.push(i + 1)
    }
    return out
  }
  function stepModification(dir) {
    const ed = editor()
    const p = currentPath()
    if (!ed || !p) return
    const lines = modifiedLines(p)
    if (!lines.length) return flash('No modifications')
    const at = ed.getPosition().lineNumber
    const target =
      dir > 0
        ? (lines.find((l) => l > at) ?? lines[0])
        : ([...lines].reverse().find((l) => l < at) ?? lines[lines.length - 1])
    reveal(focusRef.current, target)
  }

  // Bookmarks: gutter glyphs per buffer.
  function bookmarkLines(path) {
    const m = buffers.model(path)
    return (bookmarks.current.get(path) ?? [])
      .map((id) => m.getDecorationRange(id)?.startLineNumber)
      .filter(Boolean)
      .sort((a, b) => a - b)
  }
  function setBookmarks(path, lines) {
    const m = buffers.model(path)
    const decos = [...new Set(lines)].map((l) => ({
      range: new monaco.Range(l, 1, l, 1),
      options: { glyphMarginClassName: 'bookmark-glyph', stickiness: 1 }
    }))
    bookmarks.current.set(path, m.deltaDecorations(bookmarks.current.get(path) ?? [], decos))
  }

  // ---------- quick panels ----------
  const projectFiles = useRef(null)
  async function files() {
    projectFiles.current ??= await window.api.wsAllFiles().catch(() => [])
    return projectFiles.current
  }
  useEffect(() => {
    projectFiles.current = null
  }, [version, workspace])

  const symbolsOf = async (path) => {
    const m = buffers.model(path)
    const text = m ? m.getValue() : await window.api.wsRead(path).catch(() => '')
    return findSymbols(text, monacoLanguage(path))
  }

  async function gotoAnything(initial = '') {
    if (!workspace) return flash('Open a folder first')
    const list = await files()
    const before = here()
    const fileItems = list.map((p) => ({ label: baseName(p), detail: p, path: p, key: p }))
    // "file@symbol", "file:line", "file#text", or just "@", ":", "#" for the current file.
    const parse = (q) => {
      const m = /^([^@:#]*)([@:#])?(.*)$/.exec(q)
      return { file: m[1].trim(), mod: m[2], rest: m[3] }
    }
    const symbolCache = new Map()
    setQuick({
      placeholder: 'Goto Anything — file, @symbol, :line, #text',
      initial,
      filter: (q) => {
        const { file, mod, rest } = parse(q)
        const target = file
          ? fuzzyFilter(fileItems, file, (it) => it.detail)[0]?.item.path
          : currentPath()
        if (!mod)
          return fuzzyFilter(fileItems, file, (it) => it.detail).map((r) => ({
            ...r,
            hits: undefined
          }))
        if (!target) return []
        if (mod === ':')
          return [
            {
              item: {
                label: `Go to line ${rest || '…'}`,
                detail: target,
                path: target,
                line: Number(rest) || 1,
                key: 'line'
              }
            }
          ]
        if (mod === '@') {
          if (!symbolCache.has(target)) {
            symbolCache.set(target, [])
            symbolsOf(target).then((s) => {
              symbolCache.set(target, s)
              setQuick((qp) => (qp ? { ...qp, nonce: Math.random() } : qp))
            })
          }
          return fuzzyFilter(
            symbolCache
              .get(target)
              .map((s) => ({
                label: s.name,
                detail: `${baseName(target)}:${s.line}  ${s.text}`,
                path: target,
                line: s.line,
                key: `${s.name}:${s.line}`
              })),
            rest,
            (it) => it.label
          )
        }
        // "#text": lines containing the text
        const m = buffers.model(target)
        if (!m || !rest) return []
        return m
          .getLinesContent()
          .map((t, i) => ({ t, i }))
          .filter(({ t }) => t.toLowerCase().includes(rest.toLowerCase()))
          .slice(0, 200)
          .map(({ t, i }) => ({
            item: {
              label: t.trim() || '(blank)',
              detail: `${baseName(target)}:${i + 1}`,
              path: target,
              line: i + 1,
              key: String(i)
            }
          }))
      },
      onPreview: (it) => it.path && openFile(it.path, { preview: true, pin: false, line: it.line }),
      onPick: (it) => {
        if (before) (nav.current.list.push(before), (nav.current.index = nav.current.list.length))
        setQuick(null)
        openFile(it.path, { line: it.line })
      },
      onClose: () => {
        setQuick(null)
        if (before) openFile(before.path, { line: before.line, col: before.col })
      }
    })
  }

  async function gotoSymbolInProject() {
    if (!workspace) return flash('Open a folder first')
    flash('Indexing symbols…')
    const items = []
    for (const p of (await files())
      .filter((f) => ['cpp', 'c', 'java', 'python', 'javascript'].includes(monacoLanguage(f)))
      .slice(0, 2000)) {
      for (const s of await symbolsOf(p))
        items.push({
          label: s.name,
          detail: `${p}:${s.line}  ${s.text}`,
          path: p,
          line: s.line,
          key: `${p}:${s.line}`
        })
    }
    setMessage('')
    setQuick({
      placeholder: 'Goto Symbol in Project',
      items,
      onPick: (it) => {
        setQuick(null)
        pushJump()
        openFile(it.path, { line: it.line })
      },
      onClose: () => setQuick(null)
    })
  }

  // Goto Definition: the word under the cursor, looked up in the current file, open files, then the project.
  async function gotoDefinition() {
    const ed = editor()
    const word = ed?.getModel().getWordAtPosition(ed.getPosition())?.word
    if (!word) return
    const candidates = []
    const look = async (p) =>
      (await symbolsOf(p))
        .filter((s) => s.name === word || s.name.endsWith(`::${word}`))
        .forEach((s) =>
          candidates.push({
            label: `${p}:${s.line}`,
            detail: s.text,
            path: p,
            line: s.line,
            key: `${p}:${s.line}`
          })
        )
    await look(currentPath())
    for (const p of allTabs()) if (p !== currentPath() && isWorkspacePath(p)) await look(p)
    if (!candidates.length && workspace)
      for (const p of (await files()).filter(
        (f) => monacoLanguage(f) === monacoLanguage(currentPath())
      ))
        await look(p)
    if (!candidates.length) return flash(`No definition found for “${word}”`)
    pushJump()
    if (candidates.length === 1) return openFile(candidates[0].path, { line: candidates[0].line })
    setQuick({
      placeholder: `Definitions of ${word}`,
      items: candidates,
      onPick: (it) => (setQuick(null), openFile(it.path, { line: it.line })),
      onClose: () => setQuick(null)
    })
  }

  async function gotoReference() {
    const ed = editor()
    const word = ed?.getModel().getWordAtPosition(ed.getPosition())?.word
    if (!word || !workspace) return
    const r = await window.api.wsSearch({ query: word, wholeWord: true, caseSensitive: true })
    const items = r.results.map((x, i) => ({
      label: `${x.path}:${x.line}`,
      detail: x.text.trim(),
      path: x.path,
      line: x.line,
      col: x.col,
      key: String(i)
    }))
    setQuick({
      placeholder: `References to ${word} (${items.length})`,
      items,
      onPick: (it) => (
        setQuick(null),
        pushJump(),
        openFile(it.path, { line: it.line, col: it.col })
      ),
      onClose: () => setQuick(null)
    })
  }

  function commandPalette() {
    const items = [
      ...flattenCommands()
        .filter((c) => c.id !== 'commandPalette')
        .map((c) => ({
          label: `${c.path[c.path.length - 1]}: ${c.label.replace(/…$/, '')}`,
          hint: shortcutLabel(c),
          id: c.id,
          key: c.id + c.label
        })),
      ...Object.entries(SYNTAXES).map(([id, label]) => ({
        label: `Set Syntax: ${label}`,
        id: `syntax:${id}`,
        key: `syntax:${id}`
      })),
      ...SCHEME_NAMES.map((n) => ({
        label: `UI: Select Color Scheme: ${n}`,
        id: `scheme:${n}`,
        key: `scheme:${n}`
      })),
      ...snippetsFor(monacoLanguage(currentPath() ?? '')).map((sn, i) => ({
        label: `Snippet: ${sn.description}`,
        hint: sn.trigger,
        snippet: sn,
        key: `snip${i}`
      })),
      ...(editor()?.getSupportedActions() ?? [])
        .filter((a) => a.label)
        .map((a) => ({ label: `Editor: ${a.label}`, id: `monaco:${a.id}`, key: `ed:${a.id}` }))
    ]
    setQuick({
      placeholder: 'Command Palette',
      items,
      onPick: (it) => {
        setQuick(null)
        setTimeout(() => (it.snippet ? insertSnippet(editor(), it.snippet.body) : run(it.id)))
      },
      onClose: () => setQuick(null)
    })
  }

  function pick(placeholder, items, onPick, extra = {}) {
    setQuick({
      placeholder,
      items,
      onPick: (it, q) => (setQuick(null), onPick(it, q)),
      onClose: () => setQuick(null),
      ...extra
    })
  }

  // ---------- the command table ----------
  const cmd = useRef({})
  cmd.current = {
    // File
    newFile: () => (workspace ? setNewFileSignal((n) => n + 1) : openFolder()),
    openFile: openSingleFile,
    open: openSingleFile,
    openFolder,
    openRecent: async (i) => {
      const ws = await window.api.wsOpenRecent(Number(i)).catch((e) => flash(cleanError(e)))
      if (ws) adoptWorkspace(ws)
    },
    reopenClosed: () => {
      const last = closed.current.pop()
      if (last) openFile(last.path, { group: Math.min(last.group, groupsRef.current.length - 1) })
    },
    save: () => save(),
    saveAs: async () => {
      const p = currentPath()
      const m = p && buffers.model(p)
      if (!m || !workspace) return
      const r = await window.api.wsSaveAs({
        text: m.getValue(),
        suggested: isWorkspacePath(p) ? p : baseName(p)
      })
      if (!r) return
      if (r.outside) return flash(`Saved a copy as ${r.name} (outside the open folder)`)
      await openFile(r.path)
      flash(`Saved ${r.path}`)
    },
    saveAll,
    reopenEncoding: () => {
      const p = currentPath()
      if (!isWorkspacePath(p)) return
      pick(
        'Reopen with Encoding',
        ENCODINGS.map(([id, label]) => ({ label, id, key: id })),
        async (it) => {
          const text = await window.api.wsReadEncoding({
            path: p,
            encoding: it.id === 'utf-8-bom' ? 'utf-8' : it.id
          })
          await buffers.reload(p, text)
          flash(`Reopened ${baseName(p)} as ${it.label}`)
        }
      )
    },
    saveEncoding: () => {
      const p = currentPath()
      if (!isWorkspacePath(p)) return
      pick(
        'Save with Encoding',
        ENCODINGS.filter(([id]) => WRITABLE_ENCODINGS.has(id)).map(([id, label]) => ({
          label,
          id,
          key: id
        })),
        async (it) => {
          await window.api.wsWriteEncoding({
            path: p,
            text: buffers.model(p).getValue(),
            encoding: it.id
          })
          flash(`Saved ${baseName(p)} as ${it.label}`)
        }
      )
    },
    revert: async () => {
      const p = currentPath()
      if (p && !p.startsWith('default:')) await buffers.reload(p)
    },
    hexView: async () => {
      const p = currentPath()
      if (!isWorkspacePath(p)) return
      const hexPath = `hex:${p}`
      if (!buffers.model(hexPath))
        await buffers.ensure(hexPath, { text: await window.api.wsHexdump(p) })
      buffers.model(hexPath).updateOptions({ readOnly: true })
      openFile(hexPath)
    },
    closeFile: () => closeTab(currentPath()),
    closeAll: async () => {
      for (let i = 0; i < groupsRef.current.length; i++)
        if (!(await closeMany([...groupsRef.current[i].tabs], i))) return
    },
    closeWindow: () => window.close(),

    // Edit
    pasteIndent: async () => {
      const ed = editor()
      const text = await window.api.readClipboard()
      if (!ed || !text) return
      const start = ed.getSelection().getStartPosition()
      ed.executeEdits(
        'sublime',
        ed.getSelections().map((range) => ({ range, text }))
      )
      const end = ed.getPosition()
      ed.setSelection(new monaco.Selection(start.lineNumber, 1, end.lineNumber, end.column))
      ed.trigger('sublime', 'editor.action.reindentselectedlines', null)
      ed.setPosition(end)
    },
    pasteHistory: () => {
      const ed = editor()
      if (!clips.current.length) return flash('Paste history is empty (copy something first)')
      pick(
        'Paste from History',
        clips.current.map((t, i) => ({
          label: t.split('\n')[0].slice(0, 80) || '(blank)',
          detail: t.includes('\n') ? `${t.split('\n').length} lines` : '',
          text: t,
          key: String(i)
        })),
        (it) => {
          ed.focus()
          ed.executeEdits(
            'sublime',
            ed.getSelections().map((range) => ({ range, text: it.text }))
          )
        }
      )
    },
    markSet: () => ops.markSet(editor(), monaco),
    markSelect: () => ops.markSelect(editor(), monaco),
    markDelete: () => ops.markDelete(editor(), monaco),
    markSwap: () => ops.markSwap(editor(), monaco),
    markClear: () => ops.markClear(editor()),
    yank: () => ops.yank(editor()),
    swapCase: () => ops.swapCase(editor(), monaco),
    wrapParagraph: () =>
      ops.wrapParagraph(
        editor(),
        settingsRef.current.rulers[0] || settingsRef.current.wrap_width || 80
      ),
    sortLines: () => ops.permuteLines(editor(), 'sort'),
    sortLinesCase: () => ops.permuteLines(editor(), 'sortCase'),
    linesReverse: () => ops.permuteLines(editor(), 'reverse'),
    linesUnique: () => ops.permuteLines(editor(), 'unique'),
    linesShuffle: () => ops.permuteLines(editor(), 'shuffle'),
    selSort: () => ops.permuteSelections(editor(), 'sort'),
    selSortCase: () => ops.permuteSelections(editor(), 'sortCase'),
    selReverse: () => ops.permuteSelections(editor(), 'reverse'),
    selUnique: () => ops.permuteSelections(editor(), 'unique'),
    selShuffle: () => ops.permuteSelections(editor(), 'shuffle'),

    // Selection
    singleSelection: () => ops.singleSelection(editor()),
    invertSelection: () => ops.invertSelection(editor(), monaco),
    selectParagraph: () => ops.selectParagraph(editor(), monaco),
    selectIndentation: () => ops.selectIndentation(editor(), monaco),

    // Find
    findInFiles: (where) => {
      const ed = editor()
      const sel = ed?.getModel()?.getValueInRange(ed.getSelection())
      setFind((f) => ({
        ...f,
        opts: {
          ...(f?.opts ?? {}),
          ...(sel && !sel.includes('\n') ? { query: sel } : {}),
          ...(where ? { where } : {})
        }
      }))
      setPanel({ kind: 'find' })
    },
    showFindResults: () => setPanel({ kind: 'find' }),
    nextResult: () => stepResult(1),
    prevResult: () => stepResult(-1),

    // View
    toggleSidebar: () => setView((v) => ({ ...v, sidebar: !v.sidebar })),
    toggleMinimap: () =>
      setView((v) => ({ ...v, minimap: !(v.minimap ?? settingsRef.current.show_minimap) })),
    toggleTabs: () => setView((v) => ({ ...v, tabs: !v.tabs })),
    toggleStatusBar: () => setView((v) => ({ ...v, status: !v.status })),
    toggleWrap: () => setView((v) => ({ ...v, wrap: !(v.wrap ?? settingsRef.current.word_wrap) })),
    toggleWhitespace: () =>
      setView((v) => ({
        ...v,
        whitespace:
          (v.whitespace ?? settingsRef.current.draw_white_space) === 'all' ? 'selection' : 'all'
      })),
    ruler: (n) => setView((v) => ({ ...v, rulers: Number(n) ? [Number(n)] : [] })),
    distractionFree: async () => {
      const on = !view.distraction
      setView((v) => ({ ...v, distraction: on }))
      await window.api.setFullScreen(on)
    },
    layout: (kind) => setLayout(kind),
    cloneFile: () => {
      const p = currentPath()
      if (!p) return
      if (groupsRef.current.length === 1) setLayout('cols2')
      setTimeout(() =>
        openFile(p, { group: (focusRef.current + 1) % Math.max(2, groupsRef.current.length) })
      )
    },
    focusGroup: (n) => {
      const i = Number(n) - 1
      if (i < groupsRef.current.length) {
        setFocusGroup(i)
        editors.current.get(i)?.focus()
      }
    },
    moveToGroup: (n) => {
      const i = Number(n) - 1
      const p = currentPath()
      if (p && i < groupsRef.current.length && i !== focusRef.current)
        moveTab(p, focusRef.current, i)
    },
    syntax: (lang) => {
      const m = buffers.model(currentPath())
      if (m) monaco.editor.setModelLanguage(m, lang)
      setTick((t) => t + 1)
    },
    indentSpaces: () => {
      const m = buffers.model(currentPath())
      if (m) m.updateOptions({ insertSpaces: !m.getOptions().insertSpaces })
      setTick((t) => t + 1)
    },
    tabWidth: (n) => {
      buffers.model(currentPath())?.updateOptions({ tabSize: Number(n) })
      setTick((t) => t + 1)
    },
    eol: (kind) => {
      buffers
        .model(currentPath())
        ?.setEOL(
          kind === 'crlf'
            ? monaco.editor.EndOfLineSequence.CRLF
            : monaco.editor.EndOfLineSequence.LF
        )
      setTick((t) => t + 1)
    },

    // Goto
    gotoAnything: () => gotoAnything(),
    gotoSymbol: () => gotoAnything('@'),
    gotoSymbolProject: gotoSymbolInProject,
    gotoDefinition,
    gotoReference,
    jumpBack: () => jump(-1),
    jumpForward: () => jump(1),
    nextModification: () => stepModification(1),
    prevModification: () => stepModification(-1),
    nextTab: () => cycleTab(1, false),
    prevTab: () => cycleTab(-1, false),
    nextTabStack: () => cycleTab(1, true),
    prevTabStack: () => cycleTab(-1, true),
    tab: (n) => {
      const g = groupsRef.current[focusRef.current]
      const p = Number(n) === 9 ? g.tabs[g.tabs.length - 1] : g.tabs[Number(n) - 1]
      if (p) selectTab(p)
    },
    bookmarkToggle: () => {
      const p = currentPath()
      const ed = editor()
      if (!p || !ed) return
      const line = ed.getPosition().lineNumber
      const lines = bookmarkLines(p)
      setBookmarks(p, lines.includes(line) ? lines.filter((l) => l !== line) : [...lines, line])
    },
    bookmarkNext: () => {
      const lines = bookmarkLines(currentPath())
      const at = editor()?.getPosition().lineNumber ?? 0
      if (lines.length) reveal(focusRef.current, lines.find((l) => l > at) ?? lines[0])
    },
    bookmarkPrev: () => {
      const lines = bookmarkLines(currentPath())
      const at = editor()?.getPosition().lineNumber ?? 0
      if (lines.length)
        reveal(
          focusRef.current,
          [...lines].reverse().find((l) => l < at) ?? lines[lines.length - 1]
        )
    },
    bookmarkClear: () => currentPath() && setBookmarks(currentPath(), []),
    bookmarkSelectAll: () => {
      const lines = bookmarkLines(currentPath())
      const m = buffers.model(currentPath())
      if (lines.length)
        editor().setSelections(
          lines.map((l) => new monaco.Selection(l, 1, l, m.getLineMaxColumn(l)))
        )
    },

    // Tools
    commandPalette,
    snippets: () => {
      const lang = monacoLanguage(currentPath() ?? '')
      pick(
        'Snippets',
        snippetsFor(lang).map((sn, i) => ({
          label: sn.description,
          hint: sn.trigger,
          detail: sn.source,
          body: sn.body,
          key: String(i)
        })),
        (it) => insertSnippet(editor(), it.body)
      )
    },
    buildSystem: (kind) => {
      setBuildSystem(kind)
      flash(`Build system: ${kind === 'auto' ? 'Automatic' : LANGUAGE_LABEL[kind]}`)
    },
    build: () => build('run'),
    buildWith: () =>
      pick(
        'Build With',
        [
          {
            label: 'Run',
            detail: 'Compile and run with the input file (inputf.in / input.txt)',
            v: 'run',
            key: 'run'
          },
          {
            label: 'Compile',
            detail: 'Compile only, to check for errors',
            v: 'compile',
            key: 'compile'
          },
          {
            label: 'Stress Test as Solution',
            detail: 'Link this file as the stress tester’s Solution and switch',
            v: 'sol',
            key: 'sol'
          },
          {
            label: 'Stress Test as Brute',
            detail: 'Link this file as the stress tester’s Brute and switch',
            v: 'brute',
            key: 'brute'
          }
        ],
        (it) => {
          if (it.v === 'run' || it.v === 'compile') return build(it.v)
          window.dispatchEvent(
            new CustomEvent('stresslab:link', { detail: { role: it.v, path: currentPath() } })
          )
          onSwitchMode()
        }
      ),
    cancelBuild: () => window.api.buildStop(),
    stop: () => window.api.buildStop(),
    togglePanel: () => setPanel((p) => (p ? null : { kind: 'build', text: '', running: false })),
    macroRecord: () => {
      if (macros.recording) {
        const steps = macros.stop()
        setRecording(false)
        flash(`Recorded macro (${steps.length} steps)`)
      } else {
        const ed = editor()
        if (!ed) return
        macros.start(ed)
        setRecording(true)
        flash('Recording macro… (Ctrl+Q to stop)')
      }
    },
    macroPlay: () => {
      if (!macros.last.length) return flash('No macro recorded')
      macros.play(editor(), run)
    },
    macroSave: () => {
      if (!macros.last.length) return flash('No macro recorded')
      pick(
        'Macro name',
        [],
        async (_it, name) => {
          name = (name || '').trim().replace(/[^\w -]/g, '')
          if (!name) return
          await window.api.userWrite({
            path: `macros/${name}.json`,
            text: JSON.stringify(macros.last, null, 1)
          })
          refreshMacroMenu()
          flash(`Saved macro “${name}”`)
        },
        { freeText: true }
      )
    },
    macroRun: async (name) => {
      try {
        macros.play(editor(), run, JSON.parse(await window.api.userRead(`macros/${name}.json`)))
      } catch (e) {
        flash(cleanError(e))
      }
    },
    newSnippet: async () => {
      let n = 1
      const existing = new Set(
        (await window.api.userList('snippets').catch(() => [])).map((f) => f.name)
      )
      while (existing.has(`untitled-${n}.sublime-snippet`)) n++
      const path = `user:snippets/untitled-${n}.sublime-snippet`
      await window.api.userWrite({ path: path.slice(5), text: NEW_SNIPPET_TEMPLATE })
      openFile(path)
    },
    openSnippetsFolder: () => window.api.userReveal('snippets'),

    // Project
    addFolder: openFolder,
    removeFolders: () => {
      adoptWorkspace(null)
      setWorkspace(null)
    },
    refreshFolders: () => setVersion((v) => v + 1),
    gitRefresh: refreshGit,

    // Preferences (app menu)
    openSettingsFile: async () => {
      await loadSettings()
      setLayout('cols2')
      setTimeout(async () => {
        await openFile(`default:${PREFS}`, { group: 0 })
        await openFile(`user:${PREFS}`, { group: 1 })
      })
    },
    showKeyBindings: () =>
      pick(
        'Key Bindings',
        flattenCommands()
          .filter((c) => shortcutLabel(c))
          .map((c) => ({
            label: `${c.path[c.path.length - 1]}: ${c.label.replace(/…$/, '')}`,
            hint: shortcutLabel(c),
            id: c.id,
            key: c.id + c.label
          })),
        (it) => run(it.id)
      ),
    colorScheme: () => {
      const before = settingsRef.current.color_scheme
      setQuick({
        placeholder: 'Select Color Scheme',
        items: SCHEME_NAMES.map((n) => ({ label: n, hint: n === before ? 'current' : '', key: n })),
        onPreview: (it) => applyScheme(it.label),
        onPick: (it) => {
          setQuick(null)
          setUserSetting('color_scheme', it.label)
        },
        onClose: () => {
          setQuick(null)
          applyScheme(before)
        }
      })
    },
    scheme: (name) => setUserSetting('color_scheme', name)
  }

  function cycleTab(dir, stack) {
    const g = groupsRef.current[focusRef.current]
    if (!g?.tabs.length) return
    const order = stack ? g.mru : g.tabs
    const i = order.indexOf(g.current)
    const p = order[(i + dir + order.length) % order.length]
    if (stack)
      setGroups((gs) => gs.map((x, k) => (k === focusRef.current ? { ...x, current: p } : x)))
    else selectTab(p)
  }

  async function refreshMacroMenu() {
    const names = (await window.api.userList('macros').catch(() => []))
      .filter((f) => f.name.endsWith('.json'))
      .map((f) => f.name.replace(/\.json$/, ''))
    window.api.setMode({ mode: 'editor', macros: names })
  }

  // One entry point for menu clicks, key bindings, the Command Palette and macros.
  function run(id) {
    if (!id) return
    macros.command(id)
    if (id.startsWith('monaco:')) {
      const ed = editor()
      if (!ed) return
      ed.focus()
      return ed.trigger('sublime', id.slice(7), null)
    }
    const i = id.indexOf(':')
    const [name, arg] = i === -1 ? [id, undefined] : [id.slice(0, i), id.slice(i + 1)]
    const fn = cmd.current[name]
    if (fn) return fn(arg)
    flash(`Unknown command: ${id}`)
  }
  const runRef = useRef(run)
  runRef.current = run

  useEffect(() => {
    if (!active || !menuCommand) return
    const c = menuCommand.cmd
    runRef.current(c.startsWith('ed:') ? c.slice(3) : c)
  }, [menuCommand, active])

  // The menu bar is Sublime's while the editor is shown.
  useEffect(() => {
    if (active) refreshMacroMenu()
  }, [active]) // eslint-disable-line react-hooks/exhaustive-deps

  // Esc hides the bottom panel (like Sublime).
  useEffect(() => {
    if (!active || !panel || quick) return
    const onKey = (e) =>
      e.key === 'Escape' && !(panel.kind === 'build' && panel.running) && setPanel(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, panel, quick])

  // Paste history: remember what's copied or cut in an editor.
  useEffect(() => {
    const onCopy = () => {
      const ed = editor()
      if (!ed?.hasTextFocus()) return
      const m = ed.getModel()
      const sels = ed.getSelections()
      const text = sels.every((s) => s.isEmpty())
        ? sels.map((s) => m.getLineContent(s.startLineNumber) + '\n').join('')
        : sels.map((s) => m.getValueInRange(s)).join('\n')
      if (text) clips.current = [text, ...clips.current.filter((t) => t !== text)].slice(0, 15)
    }
    document.addEventListener('copy', onCopy, true)
    document.addEventListener('cut', onCopy, true)
    return () => {
      document.removeEventListener('copy', onCopy, true)
      document.removeEventListener('cut', onCopy, true)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Drag files/folders from the OS onto the window.
  async function onDrop(e) {
    if (!e.dataTransfer.files.length) return
    e.preventDefault()
    for (const f of e.dataTransfer.files) {
      try {
        const r = await window.api.wsOpenDropped(f)
        if (r.name !== workspace?.name || !workspace) adoptWorkspace({ name: r.name })
        if (r.file) setTimeout(() => openFile(r.file))
      } catch (err) {
        flash(cleanError(err))
      }
    }
  }

  // ---------- editor instances ----------
  function onEditorMount(index, ed) {
    editors.current.set(index, ed)
    bindSublimeKeys(ed, monaco, (id) => runRef.current(id))
    ed.onDidFocusEditorText(() => setFocusGroup(index))
    ed.onDidChangeCursorSelection(() => {
      if (focusRef.current !== index) return
      const sels = ed.getSelections()
      const m = ed.getModel()
      const pos = ed.getPosition()
      const chars = sels.reduce((n, s) => n + m.getValueLengthInRange(s), 0)
      const lines = sels.reduce(
        (n, s) => n + (s.isEmpty() ? 0 : s.endLineNumber - s.startLineNumber + 1),
        0
      )
      setStatus({ line: pos.lineNumber, col: pos.column, sels: sels.length, chars, lines })
    })
    // Editing a preview tab makes it a normal tab; Git gutter follows edits.
    ed.onDidChangeModelContent(() => {
      const p = groupsRef.current[index]?.current
      if (p) pinTab(p, index)
      clearTimeout(ed.__git)
      ed.__git = setTimeout(() => gitRef.current && p && isWorkspacePath(p) && updateGitGutter(p), 600)
    })
    ed.onDidBlurEditorText(() => {
      const p = groupsRef.current[index]?.current
      if (settingsRef.current.save_on_focus_lost && p && buffers.isDirty(p)) save(p)
    })
  }

  const options = useMemo(
    () => ({
      ...editorOptions(settings, view),
      ...(view.distraction
        ? { minimap: { enabled: false }, lineNumbers: 'off', glyphMargin: false }
        : {})
    }),
    [settings, view]
  )
  const theme = useMemo(() => applyScheme(settings.color_scheme), [settings.color_scheme])
  const cur = groups[focusGroup]?.current
  const curModel = cur ? buffers.model(cur) : null
  const lang = curModel?.getLanguageId()
  const opts = curModel?.getOptions()
  const cpFolder = cur && isWorkspacePath(cur) ? parentOf(cur) : ''
  const chrome = !view.distraction

  // Status bar menus (Sublime makes indentation, line endings and syntax clickable).
  async function statusMenu(kind) {
    if (kind === 'indent') {
      const id = await window.api.contextMenu([
        {
          id: 'indentSpaces',
          label: opts.insertSpaces ? '✓ Indent Using Spaces' : 'Indent Using Spaces'
        },
        { type: 'separator' },
        ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
          id: `tabWidth:${n}`,
          label: `${opts.tabSize === n ? '✓ ' : ''}Tab Width: ${n}`
        })),
        { type: 'separator' },
        { id: 'monaco:editor.action.detectIndentation', label: 'Guess Settings From Buffer' },
        { id: 'monaco:editor.action.indentationToSpaces', label: 'Convert Indentation to Spaces' },
        { id: 'monaco:editor.action.indentationToTabs', label: 'Convert Indentation to Tabs' }
      ])
      run(id)
    }
    if (kind === 'eol')
      run(
        await window.api.contextMenu([
          { id: 'eol:lf', label: 'Unix' },
          { id: 'eol:crlf', label: 'Windows' }
        ])
      )
    if (kind === 'syntax')
      run(
        await window.api.contextMenu(
          Object.entries(SYNTAXES).map(([id, label]) => ({ id: `syntax:${id}`, label }))
        )
      )
    if (kind === 'encoding')
      run(
        await window.api.contextMenu([
          { id: 'reopenEncoding', label: 'Reopen with Encoding…' },
          { id: 'saveEncoding', label: 'Save with Encoding…' }
        ])
      )
  }

  async function tabMenu(path, group) {
    const id = await window.api.contextMenu([
      { id: 'close', label: 'Close' },
      { id: 'others', label: 'Close Other Tabs' },
      { id: 'right', label: 'Close Tabs to the Right' },
      { id: 'all', label: 'Close All' },
      { type: 'separator' },
      { id: 'clone', label: 'Clone File' },
      { id: 'copyPath', label: 'Copy File Path' },
      ...(isWorkspacePath(path)
        ? [{ id: 'reveal', label: isMac ? 'Reveal in Finder' : 'Show in Folder' }]
        : [])
    ])
    const tabs = groupsRef.current[group].tabs
    if (id === 'close') closeTab(path, group)
    if (id === 'others')
      closeMany(
        tabs.filter((p) => p !== path),
        group
      )
    if (id === 'right') closeMany(tabs.slice(tabs.indexOf(path) + 1), group)
    if (id === 'all') closeMany([...tabs], group)
    if (id === 'clone') (selectTab(path, group), cmd.current.cloneFile())
    if (id === 'copyPath') window.api.copyText(path)
    if (id === 'reveal') window.api.wsReveal(path)
  }

  const statusLeft = message
    ? message
    : !cur
      ? (workspace?.name ?? '')
      : status.sels > 1
        ? `${status.sels} selection regions`
        : status.chars
          ? `${status.lines > 1 ? `${status.lines} lines, ` : ''}${status.chars} characters selected`
          : `Line ${status.line}, Column ${status.col}`

  return (
    <div
      className={`editor-view ${view.distraction ? 'distraction' : ''}`}
      onDragOver={(e) => e.dataTransfer.types.includes('Files') && e.preventDefault()}
      onDrop={onDrop}
    >
      <div className="editor-main">
        {chrome && view.sidebar && (
          <aside className="editor-sidebar">
            {workspace ? (
              <FileTree
                key={workspace.name}
                rootName={workspace.name}
                version={version}
                activePath={cur}
                git={git?.files}
                exclude={settings.file_exclude_patterns}
                onOpen={(p) =>
                  openFile(p, {
                    preview: settings.preview_on_click,
                    pin: !settings.preview_on_click
                  })
                }
                onOpenPinned={(p) => openFile(p)}
                onRenamed={renamed}
                onDeleted={deleted}
                onRevealNew={(p) => openFile(p)}
                onFindInFolder={(dir) => run(`findInFiles:${dir ? `${dir}/` : ''}`)}
                newFileSignal={newFileSignal}
              />
            ) : (
              <div className="tree-empty">
                <p>No folder open</p>
                <button onClick={openFolder}>Open Folder…</button>
                <button onClick={openSingleFile}>Open File…</button>
              </div>
            )}
          </aside>
        )}
        <section className={`editor-area ${layout === 'cp' && workspace ? 'cp' : ''}`}>
          <div className="editor-column">
            <div
              className="editor-groups"
              style={{ grid: (LAYOUTS[layout] ?? LAYOUTS.single).grid }}
            >
              {groups.map((g, i) => (
                <EditorGroup
                  key={i}
                  index={i}
                  group={g}
                  focused={i === focusGroup && groups.length > 1}
                  showTabs={chrome && view.tabs}
                  theme={theme}
                  options={options}
                  isDirty={buffers.isDirty}
                  onFocus={() => setFocusGroup(i)}
                  onSelect={(p) => selectTab(p, i)}
                  onClose={(p) => closeTab(p, i)}
                  onTabMenu={(p) => tabMenu(p, i)}
                  onMoveTab={moveTab}
                  onPin={(p) => pinTab(p, i)}
                  onMount={onEditorMount}
                  empty={
                    i === 0 ? (
                      <Welcome
                        workspace={workspace}
                        onOpenFolder={openFolder}
                        onOpenFile={openSingleFile}
                      />
                    ) : (
                      <div className="group-empty" />
                    )
                  }
                />
              ))}
            </div>
            {panel?.kind === 'build' && (
              <pre className={`build-panel ${panel.running ? 'running' : ''}`} title="Esc to hide">
                {panel.text.split('\n').map((line, i) => {
                  const err = parseDiagnostics(line, panel.lang)[0]
                  return err ? (
                    <span
                      key={i}
                      className="build-error-line"
                      onClick={() =>
                        panel.path && openFile(panel.path, { line: err.line, col: err.col })
                      }
                    >
                      {line + '\n'}
                    </span>
                  ) : (
                    line + '\n'
                  )
                })}
              </pre>
            )}
            {panel?.kind === 'find' && (
              <FindPanel
                key={find?.opts?.query ?? ''}
                initial={find?.opts?.query}
                state={find}
                activeIndex={resultIndex}
                onSearch={runFind}
                onReplace={runReplace}
                onOpen={openResult}
                onClose={() => setPanel(null)}
              />
            )}
          </div>
          {layout === 'cp' && workspace && (
            <div className="cp-column">
              <CPPane
                key={`in:${cpFolder}`}
                path={joinRel(cpFolder, 'inputf.in')}
                fallbackName="inputf.in"
              />
              <CPPane
                key={`out:${cpFolder}`}
                path={joinRel(cpFolder, 'outputf.in')}
                fallbackName="outputf.in"
              />
            </div>
          )}
        </section>
      </div>
      {chrome && view.status && (
        <footer className="status-bar">
          <span className="status-left">
            {recording && <span className="status-rec">● Recording macro</span>}
            {git?.branch && <span className="status-git"> {git.branch}</span>}
            <span>{statusLeft}</span>
          </span>
          <span className="status-right">
            {curModel && (
              <>
                <button className="status-item" onClick={() => statusMenu('indent')}>
                  {opts.insertSpaces ? `Spaces: ${opts.tabSize}` : `Tab Size: ${opts.tabSize}`}
                </button>
                {settings.show_line_endings && (
                  <button className="status-item" onClick={() => statusMenu('eol')}>
                    {curModel.getEOL() === '\r\n' ? 'Windows' : 'Unix'}
                  </button>
                )}
                {settings.show_encoding && (
                  <button className="status-item" onClick={() => statusMenu('encoding')}>
                    UTF-8
                  </button>
                )}
                <button className="status-item" onClick={() => statusMenu('syntax')}>
                  {SYNTAXES[lang] ?? LANGUAGE_LABEL[lang] ?? lang}
                </button>
              </>
            )}
            <button
              className="status-mode"
              onClick={onSwitchMode}
              title="Switch to the stress tester"
            >
              {key('⇧E')} Stress Tester
            </button>
          </span>
        </footer>
      )}
      {quick && <QuickPanel {...quick} />}
    </div>
  )
}

function Welcome({ workspace, onOpenFolder, onOpenFile }) {
  const rows = [
    ['Goto Anything', key('P')],
    ['Command Palette', key('⇧P')],
    ['Open folder', key('⇧O')],
    ['Build & run', key('B')],
    ['Multi-cursor: add next match', key('D')],
    ['Layouts', isMac ? '⌥⌘1 … ⌥⌘6' : 'Alt+Shift+1 … 6'],
    ['Toggle sidebar', `${key('K')} ${key('B')}`],
    ['Switch to Stress Test', key('⇧E')]
  ]
  return (
    <div className="welcome">
      <h2>StressLab Editor</h2>
      <p>
        {workspace
          ? 'Pick a file in the sidebar, or press Goto Anything.'
          : 'Open a folder to start (or drop one on the window).'}
      </p>
      {!workspace && (
        <p>
          <button onClick={onOpenFolder}>Open Folder…</button>{' '}
          <button onClick={onOpenFile}>Open File…</button>
        </p>
      )}
      <table>
        <tbody>
          {rows.map(([label, k]) => (
            <tr key={label}>
              <td>{label}</td>
              <td className="kbd">{k}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

