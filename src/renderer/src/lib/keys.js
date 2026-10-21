// Shortcut labels for the current OS: "⌘R" / "⌘⇧O" on macOS, "Ctrl+R" /
// "Ctrl+Shift+O" on Windows/Linux.
const isMac = window.api.platform === 'darwin'
export const key = (k) => (isMac ? `⌘${k}` : `Ctrl+${k.replace('⇧', 'Shift+')}`)
