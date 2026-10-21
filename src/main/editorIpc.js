// IPC for the editor mode (PRD-editor.md §6). The renderer only ever sends
// paths relative to the folder the user opened; workspace.js confines them.
import { ipcMain, dialog, shell, Menu, BrowserWindow } from 'electron'
import { existsSync, statSync, rmSync } from 'fs'
import { basename, dirname, join, extname } from 'path'
import { tmpdir } from 'os'
import * as ws from './workspace.js'
import { getSettings, saveSettings } from './settings.js'
import { compileProgram, runProcess, createController } from './runner.js'
import { getToolchains } from './toolchains.js'
import { includeDir } from './paths.js'

// Competitive-programming build convention (like a Sublime CP build system): read
// stdin from the first input file in the source's folder, and write stdout to the
// first output file that already exists there.
export const INPUT_FILES = ['inputf.in', 'input.txt', 'in.txt', 'input.in']
export const OUTPUT_FILES = ['outputf.in', 'output.txt', 'out.txt', 'output.out']
const EXT_LANG = { '.cpp': 'cpp', '.cc': 'cpp', '.cxx': 'cpp', '.c': 'cpp', '.py': 'python', '.java': 'java' }
const BUILD_TIMEOUT_MS = 10000
let building = null // controller of the running build

let root = null // absolute path of the opened folder
let stopWatching = null
let dirtyCount = 0 // unsaved editor buffers, reported by the renderer (quit guard)

export const unsavedCount = () => dirtyCount

const MAX_RECENT = 8
const needRoot = () => {
  if (!root) throw new Error('No folder is open')
  return root
}
const isStr = (s, max = 4096) => typeof s === 'string' && s.length <= max

function openRoot(dir, sender) {
  root = dir
  stopWatching?.()
  stopWatching = ws.watchFolder(dir, (paths) => !sender.isDestroyed() && sender.send('ws:changed', paths))
  const recent = [dir, ...(getSettings().recentFolders ?? []).filter((d) => d !== dir)].slice(0, MAX_RECENT)
  saveSettings({ recentFolders: recent })
  return { name: basename(dir), recent: recent.map((d) => basename(d)) }
}

export function registerEditorIpc() {
  // Pick a folder with the native dialog (the only way a new root is chosen).
  ipcMain.handle('ws:openFolder', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const { canceled, filePaths } = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] })
    return canceled || !filePaths[0] ? null : openRoot(filePaths[0], e.sender)
  })

  // Open a single file: its folder becomes the workspace. Returns { name, file }.
  ipcMain.handle('ws:openFile', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const { canceled, filePaths } = await dialog.showOpenDialog(win, { properties: ['openFile'] })
    if (canceled || !filePaths[0]) return null
    return { ...openRoot(dirname(filePaths[0]), e.sender), file: basename(filePaths[0]) }
  })

  // Reopen the most recent folder (stored in main, so the renderer can't name an arbitrary path).
  ipcMain.handle('ws:reopen', (e) => {
    const last = (getSettings().recentFolders ?? []).find((d) => existsSync(d) && statSync(d).isDirectory())
    return last ? openRoot(last, e.sender) : null
  })

  ipcMain.handle('ws:list', (_e, rel = '') => ws.list(needRoot(), String(rel)))
  ipcMain.handle('ws:allFiles', () => ws.allFiles(needRoot()))
  ipcMain.handle('ws:read', (_e, rel) => ws.read(needRoot(), String(rel)))
  ipcMain.handle('ws:write', (_e, { path, text } = {}) => ws.write(needRoot(), String(path), text))
  ipcMain.handle('ws:create', (_e, { path, dir } = {}) => ws.create(needRoot(), String(path), !!dir))
  ipcMain.handle('ws:rename', (_e, { from, to } = {}) => ws.rename(needRoot(), String(from), String(to)))
  ipcMain.handle('ws:trash', (_e, rel) => shell.trashItem(ws.confine(needRoot(), String(rel))))
  ipcMain.handle('ws:reveal', (_e, rel) => shell.showItemInFolder(ws.confine(needRoot(), String(rel ?? ''))))
  ipcMain.handle('ws:dirty', (_e, n) => {
    dirtyCount = Number.isInteger(n) && n >= 0 ? n : 0
  })

  // Build & run the file `path` (⌘B). Returns what the output panel shows.
  ipcMain.handle('build:run', async (_e, { path } = {}) => {
    const dir = needRoot()
    const rel = String(path)
    const lang = EXT_LANG[extname(rel).toLowerCase()]
    if (!lang) throw new Error(`No build system for “${basename(rel)}” (C++, Python or Java)`)
    if (building) throw new Error('A build is already running')
    const code = await ws.read(dir, rel)
    const folder = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/') + 1) : ''
    const findIn = (names) => names.map((n) => folder + n).find((p) => existsSync(ws.confine(dir, p)))
    const inputFile = findIn(INPUT_FILES)
    const outputFile = findIn(OUTPUT_FILES)
    const input = inputFile ? await ws.read(dir, inputFile) : ''

    building = createController()
    const runDir = join(tmpdir(), 'stresslab', `build-${Date.now()}`)
    const started = performance.now()
    try {
      const prog = await compileProgram({
        role: 'build',
        lang,
        code,
        runDir,
        toolchains: await getToolchains(),
        includeDir: includeDir(),
        cppFlags: getSettings().cppFlags.split(/\s+/).filter(Boolean),
        controller: building
      })
      if (!prog.ok) return { compileError: prog.stderr, lang, seconds: (performance.now() - started) / 1000 }
      const r = await runProcess({ ...prog.run, input, timeoutMs: BUILD_TIMEOUT_MS * prog.timeScale, controller: building })
      if (outputFile && !r.timedOut && !building.stopped) await ws.write(dir, outputFile, r.stdout)
      return {
        lang,
        stdout: r.stdout,
        stderr: r.error || r.stderr,
        exitCode: r.code,
        signal: r.signal,
        timedOut: r.timedOut,
        stopped: building.stopped,
        runMs: r.timeMs,
        seconds: (performance.now() - started) / 1000,
        inputFile,
        outputFile
      }
    } finally {
      building = null
      rmSync(runDir, { recursive: true, force: true })
    }
  })
  ipcMain.handle('build:stop', () => building?.stop())

  // Native context menu: items [{ id, label } | { type: 'separator' }] → clicked id or null.
  ipcMain.handle('ui:contextMenu', (e, items = []) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    return new Promise((resolve) => {
      let chosen = null
      const menu = Menu.buildFromTemplate(
        items.slice(0, 30).map((it) =>
          it.type === 'separator' ? { type: 'separator' } : { label: isStr(it.label, 100) ? it.label : '?', click: () => (chosen = it.id) }
        )
      )
      menu.popup({ window: win, callback: () => setTimeout(() => resolve(chosen), 0) })
    })
  })

  // Native question dialog: { message, detail, buttons } → index of the clicked button.
  ipcMain.handle('ui:confirm', async (e, { message, detail, buttons } = {}) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const labels = (Array.isArray(buttons) ? buttons : ['OK', 'Cancel']).filter((b) => isStr(b, 40)).slice(0, 4)
    const { response } = await dialog.showMessageBox(win, {
      type: 'question',
      message: isStr(message, 500) ? message : '',
      detail: isStr(detail, 2000) ? detail : undefined,
      buttons: labels,
      defaultId: 0,
      cancelId: labels.length - 1
    })
    return response
  })
}
