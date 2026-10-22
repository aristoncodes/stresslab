// Preload runs sandboxed: only `electron` can be required here.
// The renderer gets exactly the functions below as `window.api` — no raw
// ipcRenderer, no Node. Each maps to one named channel in src/main/ipc.js.
import { contextBridge, ipcRenderer, webUtils } from 'electron'

const invoke = (channel) => (arg) => ipcRenderer.invoke(channel, arg)

// Subscribe to a main → renderer event; returns an unsubscribe function.
function on(channel) {
  return (callback) => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  }
}

const api = {
  // 'darwin' | 'win32' | 'linux': used for shortcut labels (⌘R vs Ctrl+R).
  platform: process.platform,

  // Toolchains / spec
  getToolchains: invoke('toolchains:get'), // (refresh?: boolean)
  validateSpec: invoke('spec:validate'), // ({ spec, sample? }) -> { ok, line?, message?, sample }
  specFromText: invoke('spec:fromText'), // ({ text, sample? }) -> { ok, spec, attempts, model, error? }

  // Stress runs
  startStress: invoke('stress:start'), // (config) -> { runId, seed }
  stopStress: invoke('stress:stop'),
  onProgress: on('stress:progress'), // ({ runId, test, tests, testsPerSec })
  onResult: on('stress:result'), // (full result)

  // Time complexity
  estimateComplexity: invoke('complexity:estimate'), // ({ sol, problem, spec }) -> AI estimate

  // Failure window
  getFailure: invoke('failure:data'), // (runId) -> result | null
  openFailure: invoke('failure:open'), // (runId)

  // Files / OS
  openFile: invoke('file:open'), // () -> { name, content, lang } | null
  saveText: invoke('file:saveText'), // ({ text, defaultName }) -> path | null
  openPath: invoke('shell:openPath'), // (path saved by saveText)
  showInFolder: invoke('shell:showInFolder'),
  copyText: invoke('clipboard:writeText'),

  // Settings
  getSettings: invoke('settings:get'),
  setSettings: invoke('settings:set'), // (patch) -> public settings
  testLlm: invoke('settings:test'), // ({ provider, model, apiKey? }) -> reply text
  openSettings: invoke('window:settings'),

  // Editor: files inside the opened folder (paths are relative to it)
  wsOpenFolder: invoke('ws:openFolder'), // () -> { name, recent } | null
  wsOpenFile: invoke('ws:openFile'), // () -> { name, recent, file } | null
  wsReopen: invoke('ws:reopen'), // () -> last folder | null
  wsList: invoke('ws:list'), // (relDir) -> [{ name, path, dir }]
  wsAllFiles: invoke('ws:allFiles'), // () -> [relPath]
  wsRead: invoke('ws:read'), // (relPath) -> text
  wsWrite: invoke('ws:write'), // ({ path, text })
  wsCreate: invoke('ws:create'), // ({ path, dir })
  wsRename: invoke('ws:rename'), // ({ from, to })
  wsTrash: invoke('ws:trash'), // (relPath)
  wsReveal: invoke('ws:reveal'), // (relPath)
  wsSetDirty: invoke('ws:dirty'), // (unsaved buffer count, for the quit prompt)
  onWsChanged: on('ws:changed'), // ([relPath]) changed by other programs
  buildRun: invoke('build:run'), // ({ path }) -> { stdout, stderr, exitCode, runMs, seconds, inputFile, outputFile, compileError? }
  buildStop: invoke('build:stop'),
  wsHexdump: invoke('ws:hexdump'), // (relPath) -> hex dump text
  wsReadEncoding: invoke('ws:readEncoding'), // ({ path, encoding }) -> text
  wsWriteEncoding: invoke('ws:writeEncoding'), // ({ path, text, encoding })
  gitStatus: invoke('git:status'), // () -> { branch, files: { relPath: status } } | null
  gitDiff: invoke('git:diff'), // ({ path, text }) -> [{ kind, from, to }]
  // Drag & drop from Finder/Explorer: the File's real path, then open it.
  wsOpenDropped: (file) => ipcRenderer.invoke('ws:openDropped', webUtils.getPathForFile(file)),
  wsOpenRecent: invoke('ws:openRecent'), // (index) -> folder
  wsSaveAs: invoke('ws:saveAs'), // ({ text, suggested }) -> { path } | { outside } | null
  wsSearch: invoke('ws:search'), // ({ query, regex, caseSensitive, wholeWord, where }) -> { results, files, truncated }
  wsReplace: invoke('ws:replace'), // (same + replacement) -> { files, replacements }
  userList: invoke('user:list'), // User folder (snippets, macros, settings, session)
  userRead: invoke('user:read'),
  userWrite: invoke('user:write'),
  userReveal: invoke('user:reveal'),
  readClipboard: invoke('clipboard:readText'),
  setFullScreen: invoke('win:fullscreen'), // (on?) -> isFullScreen
  setMode: invoke('ui:mode'), // ({ mode, macros? }) -> rebuilds the menu bar
  contextMenu: invoke('ui:contextMenu'), // ([{ id, label } | { type: 'separator' }]) -> id | null
  confirm: invoke('ui:confirm'), // ({ message, detail, buttons }) -> button index

  // Native menu → renderer ('open' | 'run' | 'stop' | 'tour' | 'newFile' | 'openFolder' |
  // 'save' | 'saveAll' | 'closeTab' | 'toggleMode')
  onMenuCommand: on('menu:command')
}

contextBridge.exposeInMainWorld('api', api)
