import Editor from '@monaco-editor/react'
import Box from './Box'
import { LANGS, langInfo } from '../lib/defaults'
import { useDarkMode, monacoTheme } from '../lib/useDarkMode'

const OPTIONS = {
  minimap: { enabled: false },
  fontSize: 13,
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 4,
  renderLineHighlight: 'line'
}

// Monaco editor with a language dropdown and Open… button.
// `toolchains` marks missing languages in the dropdown.
export default function CodePane({ title, program, onChange, onLangChange, onOpen, onFocus, toolchains, height = 340, tour }) {
  const dark = useDarkMode()
  const missing = (id) => toolchains && toolchains[id] && !toolchains[id].ok
  return (
    <Box
      title={title}
      className="code-pane"
      tour={tour}
      bodyClassName="flush"
      actions={
        <>
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
          theme={monacoTheme(dark)}
          options={OPTIONS}
          onChange={(v) => onChange(v ?? '')}
          onMount={(editor) => editor.onDidFocusEditorText(() => onFocus?.())}
        />
      </div>
    </Box>
  )
}
