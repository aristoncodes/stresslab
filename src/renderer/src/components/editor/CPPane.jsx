import { useEffect, useRef, useState } from 'react'
import Editor from '@monaco-editor/react'
import { baseName } from '../../lib/files'
import { cleanError } from '../../lib/errors'

const OPTIONS = {
  fontSize: 14,
  lineHeight: 22,
  fontFamily: "'SF Mono', Menlo, Consolas, 'Cascadia Mono', 'DejaVu Sans Mono', monospace",
  minimap: { enabled: false },
  automaticLayout: true,
  scrollBeyondLastLine: false,
  lineNumbersMinChars: 3,
  renderLineHighlight: 'line',
  wordWrap: 'on'
}

// One side pane of the CP layout (input or output file). Saves itself shortly
// after you type; reloads when the file changes on disk (e.g. after ⌘B).
export default function CPPane({ path, fallbackName }) {
  const [text, setText] = useState(null) // null = file missing
  const [error, setError] = useState('')
  const editorRef = useRef(null)
  const saveTimer = useRef(null)
  const lastSaved = useRef(null)

  useEffect(() => {
    let alive = true
    const load = () =>
      window.api
        .wsRead(path)
        .then((t) => {
          if (!alive) return
          setText(t)
          lastSaved.current = t
          const ed = editorRef.current
          if (ed && !ed.hasTextFocus() && ed.getValue() !== t) ed.setValue(t)
        })
        .catch(() => alive && setText(null))
    load()
    const off = window.api.onWsChanged((paths) => paths.includes(path) && load())
    return () => {
      alive = false
      off()
      clearTimeout(saveTimer.current)
    }
  }, [path])

  const save = (value) => {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      if (value === lastSaved.current) return
      try {
        await window.api.wsWrite({ path, text: value })
        lastSaved.current = value
        setError('')
      } catch (e) {
        setError(cleanError(e))
      }
    }, 400)
  }

  async function create() {
    try {
      await window.api.wsCreate({ path, dir: false })
      setText('')
    } catch (e) {
      setError(cleanError(e))
    }
  }

  return (
    <div className="cp-pane">
      <div className="tab-bar">
        <div className="tab active" title={path}>
          <span className="tab-name">{baseName(path)}</span>
        </div>
      </div>
      <div className="cp-pane-body">
        {text === null ? (
          <div className="cp-missing">
            <p>{baseName(path)} doesn’t exist in this folder.</p>
            <button onClick={create}>Create {fallbackName}</button>
          </div>
        ) : (
          <Editor
            key={path}
            path={`file:///pane/${path}`}
            defaultValue={text}
            language="plaintext"
            theme="stresslab-mariana"
            options={OPTIONS}
            onMount={(ed) => (editorRef.current = ed)}
            onChange={(v) => save(v ?? '')}
          />
        )}
        {error && <div className="tree-error">{error}</div>}
      </div>
    </div>
  )
}
