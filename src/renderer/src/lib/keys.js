// Shortcut labels for the current OS: "⌘R" on macOS, "Ctrl+R" on Windows/Linux.
const isMac = window.api.platform === 'darwin'
export const key = (k) => (isMac ? `⌘${k}` : `Ctrl+${k}`)
