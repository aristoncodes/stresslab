import { useEffect, useRef, useState } from 'react'
import { key } from '../lib/keys'
import MainView from './MainView'
import EditorView from './EditorView'

const MODE_KEY = 'stresslab.mode'
const loadMode = () => {
  try {
    return localStorage.getItem(MODE_KEY) === 'editor' ? 'editor' : 'stress'
  } catch {
    return 'stress'
  }
}

// Main window: Editor or Stress Test, switched with ⌘⇧E / Ctrl+Shift+E (no header,
// like Sublime). Both views stay mounted (instant switch, state kept); native-menu
// commands go to whichever is active.
export default function Shell() {
  const [mode, setMode] = useState(loadMode)
  const [menuCommand, setMenuCommand] = useState(null) // { cmd, n } — n makes repeats distinct
  const [tourSignal, setTourSignal] = useState(0)
  const modeRef = useRef(mode)
  modeRef.current = mode

  useEffect(() => {
    try {
      localStorage.setItem(MODE_KEY, mode)
    } catch {
      /* ignore */
    }
  }, [mode])

  useEffect(
    () =>
      window.api.onMenuCommand((cmd) => {
        if (cmd === 'toggleMode') return setMode((m) => (m === 'editor' ? 'stress' : 'editor'))
        if (cmd === 'tour') return showTour()
        if (cmd === 'closeTab' && modeRef.current !== 'editor') return window.close()
        setMenuCommand((prev) => ({ cmd, n: (prev?.n ?? 0) + 1 }))
      }),
    []
  )

  const showTour = () => {
    setMode('stress')
    setTourSignal((n) => n + 1)
  }

  return (
    <div className="app" data-mode={mode}>
      <div className="mode-pane" hidden={mode !== 'stress'}>
        <MainView active={mode === 'stress'} menuCommand={menuCommand} tourSignal={tourSignal} />
      </div>
      {mode === 'stress' && (
        <footer className="app-status">
          <span>Stress Tester</span>
          <span className="app-status-right">
            <button className="link" onClick={() => setMode('editor')}>
              {key('⇧E')} Editor
            </button>
            <button className="link" onClick={showTour}>
              Walkthrough
            </button>
            <button className="link" onClick={() => window.api.openSettings()}>
              Settings
            </button>
          </span>
        </footer>
      )}
      <div className="mode-pane editor-pane" hidden={mode !== 'editor'}>
        <EditorView active={mode === 'editor'} menuCommand={menuCommand} onSwitchMode={() => setMode('stress')} />
      </div>
    </div>
  )
}
