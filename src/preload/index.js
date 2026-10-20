// Preload runs sandboxed: only `electron` can be required here.
// The renderer gets exactly the functions below as `window.api` — nothing else.
import { contextBridge } from 'electron'

const api = {
  platform: process.platform
}

contextBridge.exposeInMainWorld('api', api)
