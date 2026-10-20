// Every IPC channel the renderer can use. Inputs are checked here because the
// renderer is treated as untrusted.
import { ipcMain, dialog, clipboard, shell, BrowserWindow } from 'electron'
import { readFileSync, writeFileSync, statSync } from 'fs'
import { basename, extname } from 'path'
import { getToolchains } from './toolchains.js'
import { validateSpec } from './generator.js'
import { startRun, stopRun, getResult } from './stress.js'
import { getPublicSettings, saveSettings, getSettings, getApiKey, PROVIDERS } from './settings.js'
import { specFromText, testConnection } from './llm.js'
import { openFailureWindow, openSettingsWindow } from './windows.js'
import { LANGUAGES } from './languages.js'

const MAX_CODE = 1024 * 1024
const EXT_LANG = { '.cpp': 'cpp', '.cc': 'cpp', '.cxx': 'cpp', '.h': 'cpp', '.py': 'python', '.java': 'java' }
const savedPaths = new Set() // shell:openPath only opens files this app saved

const isStr = (s, max = MAX_CODE) => typeof s === 'string' && s.length <= max
const clamp = (x, lo, hi, dflt) => (Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : dflt)

function checkProgram(p, role) {
  if (!p || !LANGUAGES[p.lang] || !isStr(p.code)) throw new Error(`Invalid ${role} program`)
  return { lang: p.lang, code: p.code }
}

function llmConfig(override = {}) {
  const s = getSettings()
  const provider = PROVIDERS.includes(override.provider) ? override.provider : s.provider
  return {
    provider,
    model: override.model || s.models[provider],
    apiKey: override.apiKey || getApiKey(provider)
  }
}

export function registerIpc() {
  ipcMain.handle('toolchains:get', (_e, refresh) => getToolchains(!!refresh))

  ipcMain.handle('spec:validate', (_e, text) => (isStr(text) ? validateSpec(text) : { ok: false, message: 'Invalid spec' }))

  ipcMain.handle('spec:fromText', async (_e, text) => {
    if (!isStr(text, 50000) || !text.trim()) throw new Error('Paste the problem\'s Input section first')
    return specFromText(llmConfig(), text)
  })

  ipcMain.handle('stress:start', (e, cfg) => {
    const custom = cfg?.mode === 'custom'
    return startRun(
      {
        sol: checkProgram(cfg?.sol, 'solution'),
        brute: checkProgram(cfg?.brute, 'brute'),
        mode: custom ? 'custom' : 'spec',
        spec: custom ? '' : isStr(cfg.spec) ? cfg.spec : '',
        gen: custom ? checkProgram(cfg.gen, 'generator') : undefined,
        tests: Math.round(clamp(cfg.tests, 1, 100000, 1000)),
        timeoutSec: clamp(cfg.timeoutSec, 0.1, 60, 2),
        compareMode: cfg.compareMode === 'float' ? 'float' : 'exact',
        eps: clamp(cfg.eps, 0, 1, 1e-6),
        seed: Number.isInteger(cfg.seed) ? cfg.seed : null
      },
      e.sender
    )
  })

  ipcMain.handle('stress:stop', () => stopRun())

  ipcMain.handle('failure:data', (_e, runId) => getResult(String(runId)))
  ipcMain.handle('failure:open', (_e, runId) => void openFailureWindow(String(runId)))

  ipcMain.handle('file:open', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [
        { name: 'Source code', extensions: ['cpp', 'cc', 'cxx', 'h', 'py', 'java'] },
        { name: 'All files', extensions: ['*'] }
      ]
    })
    if (canceled || !filePaths[0]) return null
    const path = filePaths[0]
    if (statSync(path).size > MAX_CODE) throw new Error('File is larger than 1 MB')
    return { name: basename(path), content: readFileSync(path, 'utf8'), lang: EXT_LANG[extname(path).toLowerCase()] ?? null }
  })

  ipcMain.handle('file:saveText', async (e, { text, defaultName } = {}) => {
    if (!isStr(text, 16 * MAX_CODE)) throw new Error('Invalid text')
    const win = BrowserWindow.fromWebContents(e.sender)
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      defaultPath: isStr(defaultName, 200) ? basename(defaultName) : 'input.txt',
      filters: [{ name: 'Text', extensions: ['txt'] }]
    })
    if (canceled || !filePath) return null
    writeFileSync(filePath, text)
    savedPaths.add(filePath)
    return filePath
  })

  ipcMain.handle('shell:openPath', (_e, path) => (savedPaths.has(path) ? shell.openPath(path) : 'Not allowed'))
  ipcMain.handle('shell:showInFolder', (_e, path) => savedPaths.has(path) && shell.showItemInFolder(path))

  ipcMain.handle('clipboard:writeText', (_e, text) => isStr(text, 16 * MAX_CODE) && clipboard.writeText(text))

  ipcMain.handle('settings:get', () => getPublicSettings())
  ipcMain.handle('settings:set', (_e, patch) => saveSettings(sanitizeSettings(patch ?? {})))
  ipcMain.handle('settings:test', (_e, o = {}) =>
    testConnection(llmConfig({ provider: o.provider, model: isStr(o.model, 200) ? o.model : '', apiKey: isStr(o.apiKey, 500) ? o.apiKey : '' }))
  )
  ipcMain.handle('window:settings', () => openSettingsWindow())
}

function sanitizeSettings(p) {
  const out = {}
  if (PROVIDERS.includes(p.provider)) out.provider = p.provider
  if (p.models && typeof p.models === 'object') {
    out.models = Object.fromEntries(PROVIDERS.filter((k) => isStr(p.models[k], 200)).map((k) => [k, p.models[k].trim()]))
  }
  if (Number.isFinite(p.defaultTests)) out.defaultTests = Math.round(clamp(p.defaultTests, 1, 100000, 1000))
  if (Number.isFinite(p.baseTimeoutSec)) out.baseTimeoutSec = clamp(p.baseTimeoutSec, 0.1, 60, 2)
  if (isStr(p.cppFlags, 500)) out.cppFlags = p.cppFlags
  if (p.apiKey && PROVIDERS.includes(p.apiKey.provider) && isStr(p.apiKey.value, 500)) {
    out.apiKey = { provider: p.apiKey.provider, value: p.apiKey.value.trim() }
  }
  return out
}
