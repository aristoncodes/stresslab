// Sublime Text key bindings on top of Monaco's defaults (PRD-editor.md R12).
// ⌘ on macOS, Ctrl on Windows/Linux — Monaco's CtrlCmd handles that.
const isMac = window.api.platform === 'darwin'

export function addSublimeKeys(editor, monaco, { toggleSidebar }) {
  const { KeyMod: M, KeyCode: K } = monaco
  const run = (id) => () => editor.trigger('sublime', id, null)
  const bind = (keys, fn) => editor.addCommand(keys, fn)

  bind(M.CtrlCmd | M.Shift | K.KeyD, run('editor.action.copyLinesDownAction')) // duplicate line
  bind(M.CtrlCmd | K.KeyJ, run('editor.action.joinLines'))
  bind(M.CtrlCmd | M.Shift | K.KeyL, run('editor.action.insertCursorAtEndOfEachLineSelected')) // split into lines
  // Move line up/down: ⌃⌘↑/↓ on macOS, Ctrl+Shift+↑/↓ elsewhere.
  const moveMod = isMac ? M.WinCtrl | M.CtrlCmd : M.CtrlCmd | M.Shift
  bind(moveMod | K.UpArrow, run('editor.action.moveLinesUpAction'))
  bind(moveMod | K.DownArrow, run('editor.action.moveLinesDownAction'))
  // Select all occurrences: ⌃⌘G on macOS, Alt+F3 elsewhere.
  bind(isMac ? M.WinCtrl | M.CtrlCmd | K.KeyG : M.Alt | K.F3, run('editor.action.selectHighlights'))
  // ⌘K ⌘B toggles the sidebar; ⌘K ⌘U / ⌘K ⌘L change case.
  bind(M.chord(M.CtrlCmd | K.KeyK, M.CtrlCmd | K.KeyB), toggleSidebar)
  bind(M.chord(M.CtrlCmd | K.KeyK, M.CtrlCmd | K.KeyU), run('editor.action.transformToUppercase'))
  bind(M.chord(M.CtrlCmd | K.KeyK, M.CtrlCmd | K.KeyL), run('editor.action.transformToLowercase'))
}
