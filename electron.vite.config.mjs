import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

// Optional built-in API keys, taken from the environment at BUILD time only
// (STRESSLAB_GROQ_KEY / STRESSLAB_GEMINI_KEY), never stored in the repo.
// XOR-masked so they don't appear as plain text in the bundle; see src/main/builtinKeys.js.
const MASK = 'stresslab'
const mask = (s = '') =>
  Buffer.from([...Buffer.from(s.trim())].map((b, i) => b ^ MASK.charCodeAt(i % MASK.length))).toString('base64')
const builtinKeys = {
  groq: mask(process.env.STRESSLAB_GROQ_KEY),
  gemini: mask(process.env.STRESSLAB_GEMINI_KEY)
}

export default defineConfig({
  main: {
    define: { __BUILTIN_KEYS__: JSON.stringify(builtinKeys) }
  },
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()]
  }
})
