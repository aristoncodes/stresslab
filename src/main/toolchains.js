// Cached toolchain detection (it spawns a few processes, so do it once).
import { detectToolchains } from './compilers.js'

let cached = null

export function getToolchains(refresh = false) {
  if (!cached || refresh) cached = detectToolchains()
  return cached
}
