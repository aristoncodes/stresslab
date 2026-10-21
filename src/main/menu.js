// Native application menu. Run/Stop/Open/Walkthrough are forwarded to the main window's
// renderer as `menu:command`, so the menu and the buttons share one code path.
import { app, Menu } from 'electron'
import { is } from '@electron-toolkit/utils'
import { getWindow, openSettingsWindow } from './windows.js'

const command = (cmd) => () => getWindow('main')?.webContents.send('menu:command', cmd)

export function buildMenu() {
  const isMac = process.platform === 'darwin'
  const settings = { label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: openSettingsWindow }
  const template = [
    // macOS: app menu with About/Settings/Hide/Quit. Windows/Linux: those live in File/Help.
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              settings,
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { type: 'separator' },
              { role: 'quit' }
            ]
          }
        ]
      : []),
    {
      label: 'File',
      submenu: [
        { label: 'New File', accelerator: 'CmdOrCtrl+N', click: command('newFile') },
        { label: 'Open Folder…', accelerator: 'CmdOrCtrl+Shift+O', click: command('openFolder') },
        { label: 'Open File…', accelerator: 'CmdOrCtrl+O', click: command('open') },
        { type: 'separator' },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: command('save') },
        { label: 'Save All', accelerator: 'CmdOrCtrl+Alt+S', click: command('saveAll') },
        { type: 'separator' },
        ...(isMac ? [] : [settings, { type: 'separator' }]),
        { label: 'Close Tab', accelerator: 'CmdOrCtrl+W', click: command('closeTab') },
        ...(isMac ? [] : [{ role: 'quit', label: 'Exit' }])
      ]
    },
    // Needed for Copy/Paste/Undo shortcuts to work in text fields and editors.
    { role: 'editMenu' },
    {
      label: 'Run',
      submenu: [
        { label: 'Build && Run File', accelerator: 'CmdOrCtrl+B', click: command('build') },
        { label: 'Show Build Output', accelerator: 'CmdOrCtrl+Shift+B', click: command('togglePanel') },
        { type: 'separator' },
        { label: 'Run Stress Test', accelerator: 'CmdOrCtrl+R', click: command('run') },
        { label: 'Stop', accelerator: 'CmdOrCtrl+.', click: command('stop') }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Switch Editor / Stress Test', accelerator: 'CmdOrCtrl+Shift+E', click: command('toggleMode') },
        {
          label: 'Layout',
          submenu: [
            { label: 'Single', accelerator: 'Alt+CmdOrCtrl+1', click: command('layoutSingle') },
            { label: 'CP: Code | Input / Output', accelerator: 'Alt+CmdOrCtrl+2', click: command('layoutCP') }
          ]
        },
        { type: 'separator' },
        ...(is.dev ? [{ role: 'reload', accelerator: 'CmdOrCtrl+Shift+R' }, { role: 'toggleDevTools' }] : []),
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [{ label: 'Show Walkthrough', click: command('tour') }, ...(isMac ? [] : [{ role: 'about' }])]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
