// App settings in <userData>/settings.json. API keys are encrypted with
// safeStorage (Keychain on macOS, DPAPI on Windows, libsecret/KWallet on Linux)
// and never sent to the renderer.
import { app, safeStorage } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

export const PROVIDERS = ['gemini', 'groq', 'ollama']

const DEFAULTS = {
  provider: 'groq', // fastest in testing; Gemini's flash alias was often overloaded
  models: { gemini: 'gemini-flash-latest', groq: 'openai/gpt-oss-120b', ollama: 'qwen2.5-coder:7b' },
  defaultTests: 1000,
  baseTimeoutSec: 2,
  cppFlags: '-O2 -std=c++17',
  recentFolders: [], // editor: most recent first (set by the main process only)
  keys: {} // provider -> base64 of safeStorage-encrypted key
}

const file = () => join(app.getPath('userData'), 'settings.json')

// Linux without a keyring only offers the 'basic_text' backend (no real
// encryption). Then keys are kept in memory for this session and never written.
const sessionKeys = {}
export function keyStorage() {
  if (!safeStorage.isEncryptionAvailable()) return 'session'
  if (process.platform === 'linux' && safeStorage.getSelectedStorageBackend?.() === 'basic_text') return 'session'
  return 'encrypted'
}

function load() {
  try {
    const saved = JSON.parse(readFileSync(file(), 'utf8'))
    return { ...DEFAULTS, ...saved, models: { ...DEFAULTS.models, ...saved.models } }
  } catch {
    return structuredClone(DEFAULTS)
  }
}

// Settings safe to hand to the renderer: keys replaced by "is a key saved?" flags.
export function getPublicSettings() {
  const { keys, recentFolders: _paths, ...rest } = load() // folder paths stay in main
  return {
    ...rest,
    hasKey: Object.fromEntries(PROVIDERS.map((p) => [p, !!(keys[p] || sessionKeys[p])])),
    keyStorage: keyStorage()
  }
}

export function getSettings() {
  return load()
}

// patch: any public fields, plus optional apiKey: { provider, value } ('' deletes).
export function saveSettings(patch) {
  const s = load()
  const { apiKey, hasKey: _k, keyStorage: _s, ...fields } = patch
  Object.assign(s, fields)
  if (apiKey && PROVIDERS.includes(apiKey.provider)) {
    delete sessionKeys[apiKey.provider]
    if (!apiKey.value) delete s.keys[apiKey.provider]
    else if (keyStorage() === 'session') sessionKeys[apiKey.provider] = apiKey.value
    else s.keys[apiKey.provider] = safeStorage.encryptString(apiKey.value).toString('base64')
  }
  writeFileSync(file(), JSON.stringify(s, null, 2))
  return getPublicSettings()
}

export function getApiKey(provider) {
  if (sessionKeys[provider]) return sessionKeys[provider]
  const enc = load().keys[provider]
  if (!enc) return ''
  try {
    return safeStorage.decryptString(Buffer.from(enc, 'base64'))
  } catch {
    return '' // e.g. settings copied from another machine
  }
}
