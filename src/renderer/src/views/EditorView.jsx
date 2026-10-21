import { useCallback, useEffect, useRef, useState } from 'react'
import Editor from '@monaco-editor/react'
import FileTree from '../components/editor/FileTree'
import CPPane from '../components/editor/CPPane'
import { parseDiagnostics, panelText } from '../lib/buildOutput'
import { monacoLanguage, runLanguage, modelPath, baseName, parentOf, joinRel, LANGUAGE_LABEL } from '../lib/files'
import { addSublimeKeys } from '../lib/sublimeKeys'
import { cleanError } from '../lib/errors'
import { key } from '../lib/keys'
import { publishOpenFiles } from '../lib/openFiles'

const OPTIONS = {
  fontSize: 14,
  lineHeight: 22,
  fontFamily: "'SF Mono', Menlo, Consolas, 'Cascadia Mono', 'DejaVu Sans Mono', monospace",
  minimap: { enabled: true, renderCharacters: false },
  automaticLayout: true,
  tabSize: 4,
  renderWhitespace: 'selection',
  bracketPairColorization: { enabled: true },
  smoothScrolling: true,
  cursorSmoothCaretAnimation: 'on',
  scrollBeyondLastLine: true,
  padding: { top: 6 }
}

// Sublime-style editor: folder sidebar, tabs, Monaco with the Monokai theme.
export default function EditorView({ active, menuCommand, onSwitchMode }) {
  const [workspace, setWorkspace] = useState(null) // { name }
  const [tabs, setTabs] = useState([]) // [path]
  const [current, setCurrent] = useState(null)
  const [dirty, setDirty] = useState({}) // path → unsaved?
  const [version, setVersion] = useState(0) // bumps when files change on disk
  const [sidebar, setSidebar] = useState(true)
  const [cursor, setCursor] = useState({ line: 1, col: 1 })
  const [newFileSignal, setNewFileSignal] = useState(0)
  const [error, setError] = useState('')
  const [panel, setPanel] = useState(null) // build output: { text, running } | null
  const [layout, setLayout] = useState(() => {
    try {
      return localStorage.getItem('stresslab.editorLayout') === 'cp' ? 'cp' : 'single'
    } catch {
      return 'single'
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem('stresslab.editorLayout', layout)
    } catch {
      /* ignore */
    }
  }, [layout])

  const monacoRef = useRef(null)
  const editorRef = useRef(null)
  const initial = useRef({}) // path → text for the model about to be created
  const saved = useRef({}) // path → alternativeVersionId at the last save/load
  const watched = useRef(new Set()) // models with a change listener

  const model = (path) => monacoRef.current?.editor.getModel(monacoRef.current.Uri.parse(modelPath(path)))
  const isDirty = (path) => {
    const m = model(path)
    return !!m && saved.current[path] !== m.getAlternativeVersionId()
  }
  const refreshDirty = useCallback(() => setDirty(Object.fromEntries(tabs.map((p) => [p, isDirty(p)]))), [tabs]) // eslint-disable-line react-hooks/exhaustive-deps
  // Model listeners outlive renders: always call the latest refreshDirty / current.
  const refreshRef = useRef(refreshDirty)
  refreshRef.current = refreshDirty
  const currentRef = useRef(current)
  currentRef.current = current

  // Start tracking a model: remember its saved version and listen for edits.
  function track(path) {
    const m = path && model(path)
    if (!m) return
    if (saved.current[path] === undefined) saved.current[path] = m.getAlternativeVersionId()
    if (!watched.current.has(path)) {
      watched.current.add(path)
      m.onDidChangeContent(() => refreshRef.current())
    }
    refreshRef.current()
  }

  // Reopen the last folder; tell main how many files are unsaved (quit prompt).
  useEffect(() => {
    window.api.wsReopen().then((ws) => ws && setWorkspace(ws))
  }, [])
  useEffect(() => {
    window.api.wsSetDirty(Object.values(dirty).filter(Boolean).length)
  }, [dirty])

  // Offer runnable open files to the stress tester ("From editor").
  useEffect(() => {
    publishOpenFiles(
      tabs.filter(runLanguage).map((path) => ({ path, lang: runLanguage(path) })),
      (path) => model(path)?.getValue() ?? null
    )
  }, [tabs]) // eslint-disable-line react-hooks/exhaustive-deps

  // The Editor creates the model for a newly opened tab before this effect runs.
  useEffect(() => track(current), [current]) // eslint-disable-line react-hooks/exhaustive-deps

  async function openFile(path) {
    setError('')
    if (!tabs.includes(path)) {
      try {
        if (!model(path)) initial.current[path] = await window.api.wsRead(path)
      } catch (e) {
        return setError(cleanError(e))
      }
      setTabs((t) => [...t, path])
    }
    setCurrent(path)
  }

  async function save(path = current) {
    const m = path && model(path)
    if (!m) return true
    try {
      await window.api.wsWrite({ path, text: m.getValue() })
      saved.current[path] = m.getAlternativeVersionId()
      refreshDirty()
      return true
    } catch (e) {
      setError(cleanError(e))
      return false
    }
  }

  function dropTab(path) {
    model(path)?.dispose()
    delete saved.current[path]
    watched.current.delete(path)
    setTabs((t) => {
      const rest = t.filter((p) => p !== path)
      if (path === current) setCurrent(rest[Math.max(0, t.indexOf(path) - 1)] ?? null)
      return rest
    })
  }

  async function closeTab(path = current) {
    if (!path) return
    if (isDirty(path)) {
      const choice = await window.api.confirm({
        message: `Save changes to “${baseName(path)}”?`,
        detail: 'Your changes will be lost if you don’t save them.',
        buttons: ['Save', 'Don’t Save', 'Cancel']
      })
      if (choice === 2) return
      if (choice === 0 && !(await save(path))) return
    }
    dropTab(path)
  }

  // Files changed by other programs: reload clean buffers, ask for dirty ones.
  useEffect(
    () =>
      window.api.onWsChanged(async (paths) => {
        setVersion((v) => v + 1)
        for (const path of paths) {
          const m = model(path)
          if (!m) continue
          let text
          try {
            text = await window.api.wsRead(path)
          } catch {
            continue // deleted or unreadable: keep the buffer
          }
          if (text === m.getValue()) continue
          if (isDirty(path)) {
            const choice = await window.api.confirm({
              message: `“${baseName(path)}” changed on disk.`,
              detail: 'Reload it and lose your unsaved changes?',
              buttons: ['Reload', 'Keep My Changes']
            })
            if (choice !== 0) continue
          }
          m.pushEditOperations([], [{ range: m.getFullModelRange(), text }], () => null)
          saved.current[path] = m.getAlternativeVersionId()
        }
        refreshDirty()
      }),
    [refreshDirty] // eslint-disable-line react-hooks/exhaustive-deps
  )

  function renamed(from, to) {
    for (const path of tabs) {
      if (path !== from && !path.startsWith(from + '/')) continue
      const newPath = to + path.slice(from.length)
      const m = model(path)
      const wasDirty = isDirty(path)
      initial.current[newPath] = m?.getValue() ?? ''
      dropTab(path)
      setTabs((t) => [...t, newPath])
      if (wasDirty) saved.current[newPath] = -1 // keep the dirty dot after the rename
      if (path === current) setCurrent(newPath)
    }
  }
  const deleted = (path) => tabs.filter((p) => p === path || p.startsWith(path + '/')).forEach(dropTab)

  async function openFolder() {
    const ws = await window.api.wsOpenFolder()
    if (ws) {
      tabs.forEach(dropTab)
      setWorkspace(ws)
    }
  }
  async function openSingleFile() {
    const ws = await window.api.wsOpenFile()
    if (!ws) return
    tabs.forEach(dropTab)
    setWorkspace(ws)
    openFile(ws.file)
  }

  // ⌘B: save, then compile + run the current file (input/output files from its folder).
  async function build() {
    if (!current) return
    for (const p of tabs.filter(isDirty)) await save(p)
    const m = model(current)
    setPanel({ text: `Building ${baseName(current)}…`, running: true })
    try {
      const r = await window.api.buildRun({ path: current })
      setPanel({ text: panelText(r), running: false })
      if (m && monacoRef.current) {
        const marks = parseDiagnostics(r.compileError ?? (r.exitCode ? r.stderr : ''), r.lang).map((d) => ({
          startLineNumber: d.line,
          endLineNumber: d.line,
          startColumn: d.col,
          endColumn: m.getLineMaxColumn(Math.min(d.line, m.getLineCount())),
          message: d.message,
          severity: d.severity === 'warning' ? monacoRef.current.MarkerSeverity.Warning : monacoRef.current.MarkerSeverity.Error
        }))
        monacoRef.current.editor.setModelMarkers(m, 'build', marks)
      }
    } catch (e) {
      setPanel({ text: cleanError(e), running: false })
    }
  }

  // Esc hides the build panel (like Sublime).
  useEffect(() => {
    if (!active || !panel) return
    const onKey = (e) => e.key === 'Escape' && !panel.running && setPanel(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, panel])

  // CP layout: input/output files next to the current file.
  const cpFolder = current ? parentOf(current) : ''

  // Native menu commands while the editor is the active mode.
  const handlers = useRef({})
  handlers.current = {
    save: () => save(),
    saveAll: () => tabs.filter(isDirty).forEach((p) => save(p)),
    closeTab: () => closeTab(),
    openFolder,
    open: openSingleFile,
    newFile: () => (workspace ? setNewFileSignal((n) => n + 1) : openFolder()),
    build,
    stop: () => window.api.buildStop(),
    togglePanel: () => setPanel((p) => (p ? null : { text: '', running: false })),
    layoutSingle: () => setLayout('single'),
    layoutCP: () => setLayout('cp')
  }
  useEffect(() => {
    if (active && menuCommand) handlers.current[menuCommand.cmd]?.()
  }, [menuCommand, active])

  const lang = current ? monacoLanguage(current) : null

  return (
    <div className="editor-view">
      <div className="editor-main">
        {sidebar && (
          <aside className="editor-sidebar">
            {workspace ? (
              <FileTree
                key={workspace.name}
                rootName={workspace.name}
                version={version}
                activePath={current}
                onOpen={openFile}
                onRenamed={renamed}
                onDeleted={deleted}
                onRevealNew={openFile}
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
          <div className="tab-bar">
            {tabs.map((p) => (
              <div
                key={p}
                className={`tab ${p === current ? 'active' : ''} ${dirty[p] ? 'dirty' : ''}`}
                onClick={() => setCurrent(p)}
                onAuxClick={(e) => e.button === 1 && closeTab(p)}
                title={p}
              >
                <span className="tab-name">{baseName(p)}</span>
                <button
                  className="tab-close"
                  onClick={(e) => {
                    e.stopPropagation()
                    closeTab(p)
                  }}
                  aria-label={`Close ${baseName(p)}`}
                />
              </div>
            ))}
          </div>
          <div className="editor-host">
            {current ? (
              <Editor
                path={modelPath(current)}
                defaultValue={initial.current[current] ?? ''}
                language={lang}
                theme="stresslab-mariana"
                options={OPTIONS}
                onMount={(editor, monaco) => {
                  editorRef.current = editor
                  monacoRef.current = monaco
                  addSublimeKeys(editor, monaco, { toggleSidebar: () => setSidebar((s) => !s) })
                  editor.onDidChangeCursorPosition((e) => setCursor({ line: e.position.lineNumber, col: e.position.column }))
                  track(currentRef.current) // first model: created only after Monaco loaded
                }}
              />
            ) : (
              <Welcome workspace={workspace} onOpenFolder={openFolder} onOpenFile={openSingleFile} />
            )}
          </div>
          {panel && (
            <pre className={`build-panel ${panel.running ? 'running' : ''}`} title="Esc to hide">
              {panel.text}
            </pre>
          )}
          </div>
          {layout === 'cp' && workspace && (
            <div className="cp-column">
              <CPPane key={`in:${cpFolder}`} path={joinRel(cpFolder, 'inputf.in')} fallbackName="inputf.in" />
              <CPPane key={`out:${cpFolder}`} path={joinRel(cpFolder, 'outputf.in')} fallbackName="outputf.in" />
            </div>
          )}
        </section>
      </div>
      <footer className="status-bar">
        <span>
          {error ? (
            <span className="status-error" onClick={() => setError('')}>
              {error}
            </span>
          ) : current ? (
            `Line ${cursor.line}, Column ${cursor.col}`
          ) : workspace ? (
            workspace.name
          ) : (
            ''
          )}
        </span>
        <span className="status-right">
          {current && (
            <>
              <span>Spaces: 4</span>
              <span>{LANGUAGE_LABEL[lang] ?? lang}</span>
            </>
          )}
          <button className="status-mode" onClick={onSwitchMode} title="Switch to the stress tester">
            {key('⇧E')} Stress Tester
          </button>
        </span>
      </footer>
    </div>
  )
}

function Welcome({ workspace, onOpenFolder, onOpenFile }) {
  const rows = [
    ['Open folder', key('⇧O')],
    ['Open file', key('O')],
    ['New file', key('N')],
    ['Save', key('S')],
    ['Close tab', key('W')],
    ['Multi-cursor: add next match', key('D')],
    ['Toggle sidebar', `${key('K')} ${key('B')}`],
    ['Switch to Stress Test', key('⇧E')]
  ]
  return (
    <div className="welcome">
      <h2>StressLab Editor</h2>
      <p>{workspace ? 'Pick a file in the sidebar to start editing.' : 'Open a folder to start.'}</p>
      {!workspace && (
        <p>
          <button onClick={onOpenFolder}>Open Folder…</button> <button onClick={onOpenFile}>Open File…</button>
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
