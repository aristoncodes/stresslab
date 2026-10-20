// App settings in <userData>/settings.json. API keys are encrypted with
// safeStorage (macOS Keychain-backed) and never sent to the renderer.
import { app, safeStorage } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

export const PROVIDERS = ['gemini', 'groq', 'ollama']

const DEFAULTS = {
  provider: 'gemini',
  models: { gemini: 'gemini-flash-latest', groq: 'llama-3.3-70b-versatile', ollama: 'qwen2.5-coder:7b' },
  defaultTests: 1000,
  baseTimeoutSec: 2,
  cppFlags: '-O2 -std=c++17',
  keys: {} // provider -> base64 of safeStorage-encrypted key
}

const file = () => join(app.getPath('userData'), 'settings.json')

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
  const { keys, ...rest } = load()
  return { ...rest, hasKey: Object.fromEntries(PROVIDERS.map((p) => [p, !!keys[p]])) }
}

export function getSettings() {
  return load()
}

// patch: any public fields, plus optional apiKey: { provider, value } ('' deletes).
export function saveSettings(patch) {
  const s = load()
  const { apiKey, hasKey: _ignored, ...fields } = patch
  Object.assign(s, fields)
  if (apiKey && PROVIDERS.includes(apiKey.provider)) {
    if (!apiKey.value) delete s.keys[apiKey.provider]
    else {
      if (!safeStorage.isEncryptionAvailable()) throw new Error('Secure storage is not available on this system')
      s.keys[apiKey.provider] = safeStorage.encryptString(apiKey.value).toString('base64')
    }
  }
  writeFileSync(file(), JSON.stringify(s, null, 2))
  return getPublicSettings()
}

export function getApiKey(provider) {
  const enc = load().keys[provider]
  if (!enc) return ''
  try {
    return safeStorage.decryptString(Buffer.from(enc, 'base64'))
  } catch {
    return '' // e.g. settings copied from another machine
  }
}
