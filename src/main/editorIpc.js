// IPC for the editor mode (PRD-editor.md §6). The renderer only ever sends
// paths relative to the folder the user opened; workspace.js confines them.
import { app, ipcMain, dialog, shell, Menu, BrowserWindow, clipboard } from 'electron'
import { existsSync, statSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'fs'
import { execFile } from 'child_process'
import { basename, dirname, join, extname } from 'path'
import { tmpdir } from 'os'
import * as ws from './workspace.js'
import { getSettings, saveSettings } from './settings.js'
import { buildMenu } from './menu.js'
import { compileProgram, runProcess, createController } from './runner.js'
import { getToolchains } from './toolchains.js'
import { includeDir } from './paths.js'

// Competitive-programming build convention (like a Sublime CP build system): read
// stdin from the first input file in the source's folder, and write stdout to the
// first output file that already exists there.
export const INPUT_FILES = ['inputf.in', 'input.txt', 'in.txt', 'input.in']
export const OUTPUT_FILES = ['outputf.in', 'output.txt', 'out.txt', 'output.out']
const EXT_LANG = {
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.c': 'cpp',
  '.py': 'python',
  '.java': 'java'
}
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
  stopWatching = ws.watchFolder(
    dir,
    (paths) => !sender.isDestroyed() && sender.send('ws:changed', paths)
  )
  const recent = [dir, ...(getSettings().recentFolders ?? []).filter((d) => d !== dir)].slice(
    0,
    MAX_RECENT
  )
  saveSettings({ recentFolders: recent })
  buildMenu() // refresh File → Open Recent
  return { name: basename(dir), recent: recent.map((d) => basename(d)) }
}

// Sublime's "Packages/User" equivalent: snippets, macros, editor settings, session.
export function userRoot() {
  const dir = join(app.getPath('userData'), 'User')
  for (const sub of ['snippets', 'macros']) mkdirSync(join(dir, sub), { recursive: true })
  return dir
}

// Find/Replace options from the renderer, validated.
function searchOptions(o = {}) {
  return {
    query: isStr(o.query, 2000) ? o.query : '',
    regex: !!o.regex,
    caseSensitive: !!o.caseSensitive,
    wholeWord: !!o.wholeWord,
    where: isStr(o.where, 1000) ? o.where : '',
    replacement: isStr(o.replacement, 2000) ? o.replacement : ''
  }
}

// Line diff (old → new) for the Git gutter: strip the common prefix/suffix, then
// an LCS on the changed middle. Returns ranges in `new`:
// [{ kind: 'added' | 'modified' | 'deleted', from, to }] (deleted: from = to = line above).
export function lineDiff(oldText, newText) {
  const a = oldText.split('\n')
  const b = newText.split('\n')
  let p = 0
  while (p < a.length && p < b.length && a[p] === b[p]) p++
  let s = 0
  while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++
  const x = a.slice(p, a.length - s)
  const y = b.slice(p, b.length - s)
  if (!x.length && !y.length) return []
  if (x.length * y.length > 4_000_000)
    return [{ kind: 'modified', from: p + 1, to: p + Math.max(y.length, 1) }]
  const n = x.length
  const m = y.length
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1))
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = x[i] === y[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
  const out = []
  let dels = 0
  let adds = []
  const flush = (j) => {
    if (adds.length)
      out.push({
        kind: dels ? 'modified' : 'added',
        from: p + adds[0] + 1,
        to: p + adds[adds.length - 1] + 1
      })
    else if (dels) out.push({ kind: 'deleted', from: p + j, to: p + j })
    dels = 0
    adds = []
  }
  let i = 0
  let j = 0
  while (i < n || j < m) {
    if (i < n && j < m && x[i] === y[j]) {
      flush(j)
      i++
      j++
    } else if (j >= m || (i < n && dp[i + 1][j] >= dp[i][j + 1])) {
      dels++
      i++
    } else adds.push(j++)
  }
  flush(j)
  return out
}

export function registerEditorIpc() {
  // Pick a folder with the native dialog (the only way a new root is chosen).
  ipcMain.handle('ws:openFolder', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      properties: ['openDirectory', 'createDirectory']
    })
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
    const last = (getSettings().recentFolders ?? []).find(
      (d) => existsSync(d) && statSync(d).isDirectory()
    )
    return last ? openRoot(last, e.sender) : null
  })

  // A file or folder dropped on the window (the user chose it in the OS).
  // Folder → becomes the workspace. File → opened; its folder becomes the
  // workspace when it's outside the current one. Returns { name, recent, file? }.
  ipcMain.handle('ws:openDropped', (e, abs) => {
    if (!isStr(abs) || !existsSync(abs)) throw new Error('Can’t open that item')
    if (statSync(abs).isDirectory()) return openRoot(abs, e.sender)
    if (root) {
      const rel = ws.toRel(root, abs)
      if (!rel.startsWith('..')) return { name: basename(root), file: rel }
    }
    return { ...openRoot(dirname(abs), e.sender), file: basename(abs) }
  })

  ipcMain.handle('ws:openRecent', (e, index) => {
    const dir = (getSettings().recentFolders ?? [])[Number(index)]
    if (!dir || !existsSync(dir)) throw new Error('That folder no longer exists')
    return openRoot(dir, e.sender)
  })

  // Save As: native dialog starting in the folder. Returns the new path relative
  // to the folder, or { outside: true } if saved elsewhere.
  ipcMain.handle('ws:saveAs', async (e, { text, suggested } = {}) => {
    if (!isStr(text, ws.MAX_FILE_BYTES)) throw new Error('Content too large')
    const dir = needRoot()
    const win = BrowserWindow.fromWebContents(e.sender)
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      defaultPath: join(dir, isStr(suggested, 500) ? suggested : 'untitled')
    })
    if (canceled || !filePath) return null
    writeFileSync(filePath, text)
    const rel = ws.toRel(dir, filePath)
    return rel.startsWith('..') ? { outside: true, name: basename(filePath) } : { path: rel }
  })

  ipcMain.handle('ws:search', (_e, o) => ws.search(needRoot(), searchOptions(o)))
  ipcMain.handle('ws:replace', (_e, o) => ws.replaceInFiles(needRoot(), searchOptions(o)))

  // User folder (snippets, macros, settings, session): paths relative to it.
  ipcMain.handle('user:list', (_e, rel = '') => ws.list(userRoot(), String(rel)))
  ipcMain.handle('user:read', (_e, rel) => ws.read(userRoot(), String(rel)))
  ipcMain.handle('user:write', (_e, { path, text } = {}) =>
    ws.write(userRoot(), String(path), text)
  )
  ipcMain.handle('user:reveal', (_e, rel = '') =>
    shell.openPath(ws.confine(userRoot(), String(rel)))
  )

  ipcMain.handle('clipboard:readText', () => clipboard.readText())
  ipcMain.handle('win:fullscreen', (e, on) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    win.setFullScreen(typeof on === 'boolean' ? on : !win.isFullScreen())
    return win.isFullScreen()
  })
  ipcMain.handle('ui:mode', (_e, { mode, macros } = {}) =>
    buildMenu(
      mode === 'editor' ? 'editor' : 'stress',
      Array.isArray(macros) ? { macros: macros.filter((m) => isStr(m, 100)).slice(0, 50) } : {}
    )
  )

  ipcMain.handle('ws:list', (_e, rel = '') => ws.list(needRoot(), String(rel)))
  ipcMain.handle('ws:allFiles', () => ws.allFiles(needRoot()))
  ipcMain.handle('ws:read', (_e, rel) => ws.read(needRoot(), String(rel)))
  ipcMain.handle('ws:write', (_e, { path, text } = {}) => ws.write(needRoot(), String(path), text))
  ipcMain.handle('ws:create', (_e, { path, dir } = {}) =>
    ws.create(needRoot(), String(path), !!dir)
  )
  ipcMain.handle('ws:rename', (_e, { from, to } = {}) =>
    ws.rename(needRoot(), String(from), String(to))
  )
  ipcMain.handle('ws:trash', (_e, rel) => shell.trashItem(ws.confine(needRoot(), String(rel))))
  ipcMain.handle('ws:reveal', (_e, rel) =>
    shell.showItemInFolder(ws.confine(needRoot(), String(rel ?? '')))
  )
  ipcMain.handle('ws:dirty', (_e, n) => {
    dirtyCount = Number.isInteger(n) && n >= 0 ? n : 0
  })

  // Build & run the file `path` (⌘B). `lang` overrides the build system (Tools →
  // Build System); `compileOnly` is the "Compile" variant. Returns what the panel shows.
  ipcMain.handle('build:run', async (_e, { path, lang: forced, compileOnly } = {}) => {
    const dir = needRoot()
    const rel = String(path)
    const lang = ['cpp', 'python', 'java'].includes(forced)
      ? forced
      : EXT_LANG[extname(rel).toLowerCase()]
    if (!lang) throw new Error(`No build system for “${basename(rel)}” (C++, Python or Java)`)
    if (building) throw new Error('A build is already running')
    const code = await ws.read(dir, rel)
    const folder = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/') + 1) : ''
    const findIn = (names) =>
      names.map((n) => folder + n).find((p) => existsSync(ws.confine(dir, p)))
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
      if (!prog.ok)
        return { compileError: prog.stderr, lang, seconds: (performance.now() - started) / 1000 }
      if (compileOnly)
        return { compiledOnly: true, lang, seconds: (performance.now() - started) / 1000 }
      const r = await runProcess({
        ...prog.run,
        input,
        timeoutMs: BUILD_TIMEOUT_MS * prog.timeScale,
        controller: building
      })
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

  // ---- Open as Hex / encodings ----
  ipcMain.handle('ws:hexdump', (_e, rel) => {
    const abs = ws.confine(needRoot(), String(rel))
    const bytes = readFileSync(abs).subarray(0, 1024 * 1024) // first 1 MB
    const rows = []
    for (let i = 0; i < bytes.length; i += 16) {
      const chunk = bytes.subarray(i, i + 16)
      const hex = [...chunk].map((b) => b.toString(16).padStart(2, '0')).join(' ')
      const ascii = [...chunk]
        .map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.'))
        .join('')
      rows.push(`${i.toString(16).padStart(8, '0')}  ${hex.padEnd(47)}  ${ascii}`)
    }
    return rows.join('\n') + '\n'
  })
  ipcMain.handle('ws:readEncoding', (_e, { path, encoding } = {}) => {
    const bytes = readFileSync(ws.confine(needRoot(), String(path)))
    return new TextDecoder(String(encoding), { fatal: false }).decode(bytes)
  })
  ipcMain.handle('ws:writeEncoding', (_e, { path, text, encoding } = {}) => {
    if (!isStr(text, ws.MAX_FILE_BYTES)) throw new Error('Content too large')
    const abs = ws.confine(needRoot(), String(path))
    let buf
    if (encoding === 'utf-8-bom')
      buf = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(text, 'utf8')])
    else if (encoding === 'utf-16le')
      buf = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')])
    else if (encoding === 'utf-16be')
      buf = Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from(text, 'utf16le').swap16()])
    else if (encoding === 'latin1') buf = Buffer.from(text, 'latin1')
    else buf = Buffer.from(text, 'utf8')
    writeFileSync(abs, buf)
  })

  // ---- Git (via the git CLI, when the folder is a repository) ----
  const git = (args) =>
    new Promise((resolve) =>
      execFile(
        'git',
        args,
        { cwd: needRoot(), timeout: 5000, maxBuffer: 4 * 1024 * 1024 },
        (err, stdout) => resolve(err ? null : stdout)
      )
    )
  ipcMain.handle('git:status', async () => {
    const branch = (await git(['rev-parse', '--abbrev-ref', 'HEAD']))?.trim()
    if (!branch) return null // not a repository (or git missing)
    // Porcelain paths are relative to the repository; the open folder may be a subfolder.
    const prefix = (await git(['rev-parse', '--show-prefix']))?.trim() ?? ''
    const out =
      (await git(['status', '--porcelain', '-z', '--untracked-files=all', '--', '.'])) ?? ''
    const files = {}
    const fields = out.split('\0')
    for (let i = 0; i < fields.length; i++) {
      const entry = fields[i]
      if (!entry) continue
      const code = entry.slice(0, 2)
      if (code[0] === 'R' || code[0] === 'C') i++ // renames/copies: the next field is the old name
      const path = entry.slice(3)
      if (!path.startsWith(prefix)) continue
      files[path.slice(prefix.length)] =
        code === '??'
          ? 'untracked'
          : code.includes('A')
            ? 'added'
            : code.includes('D')
              ? 'deleted'
              : 'modified'
    }
    return { branch, files }
  })
  // Changed line ranges of one file vs HEAD: [{ kind: 'added'|'modified'|'deleted', from, to }].
  ipcMain.handle('git:diff', async (_e, { path, text } = {}) => {
    const rel = String(path)
    ws.confine(needRoot(), rel)
    const head = await git(['show', `HEAD:./${rel}`])
    if (head === null)
      return (await git(['ls-files', '--error-unmatch', rel])) === null
        ? [{ kind: 'added', from: 1, to: Infinity }]
        : []
    return lineDiff(head, isStr(text, ws.MAX_FILE_BYTES) ? text : '')
  })

  // Native context menu: items [{ id, label } | { type: 'separator' }] → clicked id or null.
  ipcMain.handle('ui:contextMenu', (e, items = []) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    return new Promise((resolve) => {
      let chosen = null
      const menu = Menu.buildFromTemplate(
        items
          .slice(0, 30)
          .map((it) =>
            it.type === 'separator'
              ? { type: 'separator' }
              : { label: isStr(it.label, 100) ? it.label : '?', click: () => (chosen = it.id) }
          )
      )
      menu.popup({ window: win, callback: () => setTimeout(() => resolve(chosen), 0) })
    })
  })

  // Native question dialog: { message, detail, buttons } → index of the clicked button.
  ipcMain.handle('ui:confirm', async (e, { message, detail, buttons } = {}) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const labels = (Array.isArray(buttons) ? buttons : ['OK', 'Cancel'])
      .filter((b) => isStr(b, 40))
      .slice(0, 4)
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
