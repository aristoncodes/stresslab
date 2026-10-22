// Sublime's macros: Tools → Record Macro (Ctrl+Q), Playback (Ctrl+Shift+Q),
// Save Macro…. Records typing, editing keys, cursor movement and every
// StressLab/Sublime command run while recording, then replays them.

// Keys → Monaco commands (with/without Shift; Alt = word, Cmd/Ctrl = line/document edges).
const isMac = window.api.platform === 'darwin'
function keyCommand(e) {
  const k = e.browserEvent.key
  const sel = e.shiftKey ? 'Select' : ''
  const word = isMac ? e.altKey : e.ctrlKey
  const edge = isMac && e.metaKey
  if (k === 'ArrowLeft') return edge ? `cursorHome${sel}` : word ? `cursorWordLeft${sel}` : `cursorLeft${sel}`
  if (k === 'ArrowRight') return edge ? `cursorEnd${sel}` : word ? `cursorWordRight${sel}` : `cursorRight${sel}`
  if (k === 'ArrowUp') return edge ? `cursorTop${sel}` : `cursorUp${sel}`
  if (k === 'ArrowDown') return edge ? `cursorBottom${sel}` : `cursorDown${sel}`
  if (k === 'Home') return `cursorHome${sel}`
  if (k === 'End') return `cursorEnd${sel}`
  if (k === 'PageUp') return `cursorPageUp${sel}`
  if (k === 'PageDown') return `cursorPageDown${sel}`
  if (k === 'Backspace') return word ? 'deleteWordLeft' : 'deleteLeft'
  if (k === 'Delete') return word ? 'deleteWordRight' : 'deleteRight'
  if (k === 'Tab') return e.shiftKey ? 'outdent' : 'tab'
  return null
}

export function createMacroRecorder() {
  let recording = null // steps while recording
  let last = [] // the most recent macro (played by Playback Macro)
  let keyListener = null

  return {
    get recording() {
      return !!recording
    },
    get last() {
      return last
    },
    start(editor) {
      recording = []
      keyListener?.dispose()
      keyListener = editor.onKeyDown((e) => {
        if (!recording) return
        const cmd = keyCommand(e)
        if (cmd) return recording.push({ monaco: cmd })
        const k = e.browserEvent.key
        if (k === 'Enter' && !e.metaKey && !e.ctrlKey) return recording.push({ type: '\n' })
        // Printable characters typed without ⌘/Ctrl
        if (k.length === 1 && !e.metaKey && !e.ctrlKey) recording.push({ type: k })
      })
    },
    // Commands run through StressLab's dispatcher are recorded by id.
    command(id) {
      if (recording && !id.startsWith('macro')) recording.push({ command: id })
    },
    stop() {
      keyListener?.dispose()
      keyListener = null
      if (recording?.length) last = recording
      recording = null
      return last
    },
    // Replay: typing is merged into runs so undo groups like Sublime's.
    play(editor, run, steps = last) {
      editor.pushUndoStop()
      for (const st of steps) {
        if (st.type !== undefined) editor.trigger('macro', 'type', { text: st.type })
        else if (st.monaco) editor.trigger('macro', st.monaco, null)
        else if (st.command) run(st.command)
      }
      editor.pushUndoStop()
    }
  }
}
