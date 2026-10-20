// All BrowserWindows. One renderer bundle; the URL hash picks the view
// (#main, #failure/<runId>, #settings).
import { BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

const windows = { main: null, failure: null, settings: null }

function create(name, options) {
  const win = new BrowserWindow({
    show: false,
    ...options,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  win.on('ready-to-show', () => win.show())
  win.on('closed', () => (windows[name] = null))
  // Links open in the default browser, never in a new Electron window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  // Block navigation away from the app bundle.
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(process.env['ELECTRON_RENDERER_URL'] ?? 'file://')) e.preventDefault()
  })
  windows[name] = win
  return win
}

function loadRoute(win, hash) {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    return win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#${hash}`)
  }
  return win.loadFile(join(__dirname, '../renderer/index.html'), { hash })
}

export function getWindow(name) {
  const w = windows[name]
  return w && !w.isDestroyed() ? w : null
}

export function createMainWindow() {
  const win = create('main', { width: 1280, height: 860, minWidth: 1100, minHeight: 720, title: 'StressLab' })
  loadRoute(win, 'main')
  return win
}

// Reuses the failure window if it's open, otherwise creates it.
export function openFailureWindow(runId) {
  const win =
    getWindow('failure') ?? create('failure', { width: 900, height: 650, minWidth: 640, minHeight: 480, title: 'Failure' })
  loadRoute(win, `failure/${runId}`)
  win.show()
  win.focus()
  return win
}

export function openSettingsWindow() {
  const existing = getWindow('settings')
  if (existing) return existing.focus()
  const win = create('settings', {
    width: 520,
    height: 390,
    resizable: false,
    minimizable: false,
    title: 'Settings',
    parent: getWindow('main') ?? undefined
  })
  loadRoute(win, 'settings')
}
