// Binds every shortcut from the Sublime command table (src/shared/editorCommands.js)
// inside a Monaco editor, including two-step chords like ⌘K ⌘B. Each binding
// calls run(commandId), the same entry point the menu bar uses.
import { flattenCommands } from '../../../shared/editorCommands.js'

const isMac = window.api.platform === 'darwin'

const NAMED = {
  Up: 'UpArrow',
  Down: 'DownArrow',
  Left: 'LeftArrow',
  Right: 'RightArrow',
  Enter: 'Enter',
  Space: 'Space',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Tab: 'Tab',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  Escape: 'Escape',
  '[': 'BracketLeft',
  ']': 'BracketRight',
  '/': 'Slash',
  '=': 'Equal',
  '-': 'Minus',
  '.': 'Period',
  ',': 'Comma',
  ';': 'Semicolon',
  '`': 'Backquote'
}

// "Cmd+Shift+D" → Monaco keybinding number (null if the key isn't known).
export function parseKey(spec, monaco) {
  const { KeyMod: M, KeyCode: K } = monaco
  let mods = 0
  let code = null
  for (const part of spec.split('+')) {
    if (part === 'Cmd') mods |= M.CtrlCmd
    else if (part === 'Ctrl') mods |= isMac ? M.WinCtrl : M.CtrlCmd
    else if (part === 'Alt') mods |= M.Alt
    else if (part === 'Shift') mods |= M.Shift
    else if (/^[A-Z]$/.test(part)) code = K[`Key${part}`]
    else if (/^[0-9]$/.test(part)) code = K[`Digit${part}`]
    else if (/^F\d{1,2}$/.test(part)) code = K[part]
    else if (NAMED[part]) code = K[NAMED[part]]
  }
  return code === null || code === undefined ? null : mods | code
}

export function parseChord(spec, monaco) {
  const [a, b] = spec.split(' ').map((s) => parseKey(s, monaco))
  return a && b ? monaco.KeyMod.chord(a, b) : null
}

// Sublime's own bindings for keys that Monaco already uses differently, plus
// every menu shortcut, so they work the same when the editor has focus.
export function bindSublimeKeys(editor, monaco, run) {
  for (const cmd of flattenCommands()) {
    const key = isMac ? cmd.mac : cmd.win
    const chord = cmd.chord && (isMac ? cmd.chord.mac : cmd.chord.win)
    const binding = chord ? parseChord(chord, monaco) : key ? parseKey(key, monaco) : null
    if (binding) editor.addCommand(binding, () => run(cmd.id))
  }
}

// Human-readable shortcut for a command ("⌘⇧D" / "Ctrl+Shift+D").
export function shortcutLabel(cmd) {
  const spec = cmd.chord ? (isMac ? cmd.chord.mac : cmd.chord.win) : isMac ? cmd.mac : cmd.win
  if (!spec) return ''
  if (!isMac) return spec
  return spec
    .replace(/Cmd\+/g, '⌘')
    .replace(/Ctrl\+/g, '⌃')
    .replace(/Alt\+/g, '⌥')
    .replace(/Shift\+/g, '⇧')
    .replace(/Enter/g, '↩')
    .replace(/Backspace/g, '⌫')
    .replace(/Up/g, '↑')
    .replace(/Down/g, '↓')
    .replace(/Left/g, '←')
    .replace(/Right/g, '→')
}
