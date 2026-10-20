// Fallback API keys baked in at build time (see electron.vite.config.mjs).
// Only used when the user hasn't saved their own key in Settings. Masking only
// stops casual text search; a shipped key can always be extracted.
/* global __BUILTIN_KEYS__ */
const MASK = 'stresslab'
const KEYS = typeof __BUILTIN_KEYS__ === 'undefined' ? {} : __BUILTIN_KEYS__

export function builtinKey(provider) {
  const enc = KEYS[provider]
  if (!enc) return ''
  const bytes = Buffer.from(enc, 'base64')
  return Buffer.from(bytes.map((b, i) => b ^ MASK.charCodeAt(i % MASK.length))).toString()
}
