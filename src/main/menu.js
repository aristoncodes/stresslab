// Native application menu. In editor mode it is Sublime Text's menu bar, built
// from src/shared/editorCommands.js; in stress-test mode it has the stress
// tester's commands. Clicks are forwarded to the focused window's renderer as
// `menu:command`, so menu, buttons and key bindings share one code path.
import { app, Menu, BrowserWindow } from 'electron'
import { basename } from 'path'
import { is } from '@electron-toolkit/utils'
import { getWindow, openSettingsWindow } from './windows.js'
import { EDITOR_MENUS } from '../shared/editorCommands.js'
import { getSettings } from './settings.js'

const isMac = process.platform === 'darwin'
const target = () => BrowserWindow.getFocusedWindow() ?? getWindow('main')
const command = (cmd) => () => target()?.webContents.send('menu:command', cmd)

let currentMode = 'stress'
let dynamic = { macros: [] } // names for dynamic submenus (set by the renderer)

// Languages offered in View → Syntax (Monaco language ids).
const SYNTAXES = [
  ['cpp', 'C++'],
  ['c', 'C'],
  ['python', 'Python'],
  ['java', 'Java'],
  ['javascript', 'JavaScript'],
  ['typescript', 'TypeScript'],
  ['go', 'Go'],
  ['rust', 'Rust'],
  ['kotlin', 'Kotlin'],
  ['csharp', 'C#'],
  ['shell', 'Shell Script'],
  ['json', 'JSON'],
  ['yaml', 'YAML'],
  ['markdown', 'Markdown'],
  ['html', 'HTML'],
  ['css', 'CSS'],
  ['plaintext', 'Plain Text']
]

// Chords can't be menu accelerators: show them in the label (Sublime shows them the same way).
const chordText = (chord) =>
  (isMac ? chord.mac : chord.win)
    .replace(/Cmd\+/g, '⌘')
    .replace(/Ctrl\+/g, isMac ? '⌃' : 'Ctrl+')
    .replace(/Shift\+/g, isMac ? '⇧' : 'Shift+')
    .replace(/Alt\+/g, isMac ? '⌥' : 'Alt+')

function dynamicSubmenu(kind) {
  if (kind === 'recent') {
    const recent = getSettings().recentFolders ?? []
    if (!recent.length) return [{ label: 'No Recent Folders', enabled: false }]
    return recent.map((dir, i) => ({ label: basename(dir), sublabel: dir, toolTip: dir, click: command(`ed:openRecent:${i}`) }))
  }
  if (kind === 'syntax') return SYNTAXES.map(([id, label]) => ({ label, click: command(`ed:syntax:${id}`) }))
  if (kind === 'macros') {
    if (!dynamic.macros.length) return [{ label: 'No Saved Macros', enabled: false }]
    return dynamic.macros.map((name) => ({ label: name, click: command(`ed:macroRun:${name}`) }))
  }
  return []
}

function toElectron(items) {
  return items.map((it) => {
    if (it.type === 'separator') return { type: 'separator' }
    if (it.role) return { role: it.role, ...(it.label ? { label: it.label } : {}) }
    if (it.items) return { label: it.label, submenu: toElectron(it.items) }
    if (it.submenu) return { label: it.label, submenu: dynamicSubmenu(it.submenu) }
    const accelerator = isMac ? it.mac : it.win
    const label = it.chord ? `${it.label}\t${chordText(it.chord)}` : it.label
    return { label, ...(accelerator ? { accelerator } : {}), click: command(`ed:${it.id}`) }
  })
}

function appMenu() {
  return {
    label: app.name,
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      { label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: openSettingsWindow },
      { label: 'Editor Settings (JSON)', click: command('ed:openSettingsFile') },
      { label: 'Key Bindings', click: command('ed:showKeyBindings') },
      { label: 'Color Scheme…', click: command('ed:colorScheme') },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideOthers' },
      { type: 'separator' },
      { role: 'quit' }
    ]
  }
}

const switchItem = { label: 'Switch Editor / Stress Test', accelerator: 'CmdOrCtrl+Shift+E', click: command('toggleMode') }
const helpMenu = {
  role: 'help',
  submenu: [{ label: 'Show Walkthrough', click: command('tour') }, ...(isMac ? [] : [{ role: 'about' }])]
}
const devItems = is.dev ? [{ type: 'separator' }, { role: 'reload', accelerator: 'CmdOrCtrl+Alt+Shift+R' }, { role: 'toggleDevTools' }] : []

function editorTemplate() {
  const menus = EDITOR_MENUS.map((menu) => ({ label: menu.label, submenu: toElectron(menu.items) }))
  const view = menus.find((m) => m.label === 'View')
  view.submenu.unshift(switchItem, { type: 'separator' })
  view.submenu.push(...devItems)
  if (!isMac) {
    const file = menus.find((m) => m.label === 'File')
    file.submenu.push(
      { type: 'separator' },
      { label: 'Settings…', accelerator: 'Ctrl+,', click: openSettingsWindow },
      { label: 'Editor Settings (JSON)', click: command('ed:openSettingsFile') },
      { label: 'Color Scheme…', click: command('ed:colorScheme') },
      { role: 'quit', label: 'Exit' }
    )
  }
  return [...(isMac ? [appMenu()] : []), ...menus, { role: 'windowMenu' }, helpMenu]
}

function stressTemplate() {
  return [
    ...(isMac ? [appMenu()] : []),
    {
      label: 'File',
      submenu: [
        { label: 'Open into Editor…', accelerator: 'CmdOrCtrl+O', click: command('open') },
        { type: 'separator' },
        ...(isMac ? [{ role: 'close' }] : [{ label: 'Settings…', accelerator: 'Ctrl+,', click: openSettingsWindow }, { role: 'quit', label: 'Exit' }])
      ]
    },
    // Needed for Copy/Paste/Undo shortcuts to work in text fields and editors.
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
        switchItem,
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...devItems
      ]
    },
    { role: 'windowMenu' },
    helpMenu
  ]
}

// mode: 'editor' | 'stress'; extra: { macros } for dynamic submenus.
export function buildMenu(mode = currentMode, extra = {}) {
  currentMode = mode
  dynamic = { ...dynamic, ...extra }
  Menu.setApplicationMenu(Menu.buildFromTemplate(mode === 'editor' ? editorTemplate() : stressTemplate()))
}
