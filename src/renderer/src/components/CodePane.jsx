import Editor from '@monaco-editor/react'
import Box from './Box'
import { LANGS, langInfo } from '../lib/defaults'

const OPTIONS = {
  minimap: { enabled: false },
  fontSize: 13,
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 4,
  renderLineHighlight: 'line'
}

// Monaco editor with a language dropdown, Open… and a "From editor" picker.
// `toolchains` marks missing languages; `editorFiles` are the files open in the
// editor; `program.link` is the editor file this pane follows (if any).
export default function CodePane({ title, program, onChange, onLangChange, onOpen, onFocus, toolchains, height = 340, tour, editorFiles = [], onLink, onUnlink }) {
  const missing = (id) => toolchains && toolchains[id] && !toolchains[id].ok
  return (
    <Box
      title={title}
      className="code-pane"
      tour={tour}
      bodyClassName="flush"
      actions={
        <>
          {program.link ? (
            <span className="linked" title="Follows this editor file; refreshed on every Run">
              ↔ {program.link.split('/').pop()}
              <button className="link" onClick={onUnlink} title="Stop following the editor file">
                ×
              </button>
            </span>
          ) : (
            editorFiles.length > 0 && (
              <select value="" onChange={(e) => e.target.value && onLink(e.target.value)} title="Use a file open in the editor">
                <option value="">From editor…</option>
                {editorFiles.map((f) => (
                  <option key={f.path} value={f.path}>
                    {f.path}
                  </option>
                ))}
              </select>
            )
          )}
          <select value={program.lang} onChange={(e) => onLangChange(e.target.value)}>
            {LANGS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
                {missing(l.id) ? ' (missing)' : ''}
              </option>
            ))}
          </select>
          <button onClick={onOpen}>Open…</button>
        </>
      }
    >
      <div style={{ height }}>
        <Editor
          language={langInfo(program.lang).monaco}
          value={program.code}
          theme="stresslab-mariana"
          options={OPTIONS}
          onChange={(v) => onChange(v ?? '')}
          onMount={(editor) => editor.onDidFocusEditorText(() => onFocus?.())}
        />
      </div>
    </Box>
  )
}
