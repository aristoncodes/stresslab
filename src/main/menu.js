// Native application menu. Run/Stop/Open are forwarded to the main window's
// renderer as `menu:command`, so the menu and the buttons share one code path.
import { app, Menu } from 'electron'
import { is } from '@electron-toolkit/utils'
import { getWindow, openSettingsWindow } from './windows.js'

const command = (cmd) => () => getWindow('main')?.webContents.send('menu:command', cmd)

export function buildMenu() {
  const template = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: openSettingsWindow },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'File',
      submenu: [
        { label: 'Open into Editor…', accelerator: 'CmdOrCtrl+O', click: command('open') },
        { type: 'separator' },
        { role: 'close' }
      ]
    },
    // Needed for ⌘C/⌘V/⌘Z to work in text fields and editors.
    { role: 'editMenu' },
    {
      label: 'Run',
      submenu: [
        { label: 'Run Stress Test', accelerator: 'CmdOrCtrl+R', click: command('run') },
        { label: 'Stop', accelerator: 'CmdOrCtrl+.', click: command('stop') }
      ]
    },
    {
      label: 'View',
      submenu: [
        ...(is.dev ? [{ role: 'reload', accelerator: 'CmdOrCtrl+Shift+R' }, { role: 'toggleDevTools' }] : []),
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    { role: 'windowMenu' }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
