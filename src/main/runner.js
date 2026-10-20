// Compile/run engine. No Electron imports, so it can be driven from plain Node
// (see scripts/smoke.mjs).
import { spawn } from 'child_process'
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { LANGUAGES, DEFAULT_CPP_FLAGS } from './languages.js'

const MAX_OUTPUT = 1024 * 1024 // per stream; more than this is killed as "output limit"
const COMPILE_TIMEOUT_MS = 60000

// A Stop handle shared by everything in one run: kills every live child process.
export function createController() {
  return {
    stopped: false,
    children: new Set(),
    stop() {
      this.stopped = true
      for (const c of this.children) c.kill('SIGKILL')
    }
  }
}

// Run one process with piped stdin, a hard timeout and capped output. Never rejects.
export function runProcess({ cmd, args = [], cwd, input = '', timeoutMs, controller }) {
  return new Promise((resolve) => {
    const start = performance.now()
    const out = { stdout: '', stderr: '' }
    let timedOut = false
    let outputLimit = false
    let spawnError = null

    const child = spawn(cmd, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] })
    controller?.children.add(child)

    const collect = (stream) => (chunk) => {
      if (out[stream].length + chunk.length > MAX_OUTPUT) {
        outputLimit = true
        child.kill('SIGKILL')
        return
      }
      out[stream] += chunk
    }
    child.stdout.setEncoding('utf8').on('data', collect('stdout'))
    child.stderr.setEncoding('utf8').on('data', collect('stderr'))

    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, timeoutMs)

    child.on('error', (e) => (spawnError = e.message)) // e.g. ENOENT
    // Programs that exit without reading all of stdin cause EPIPE; that's fine.
    child.stdin.on('error', () => {})
    child.stdin.end(input)

    child.on('close', (code, signal) => {
      clearTimeout(timer)
      controller?.children.delete(child)
      resolve({
        ...out,
        code,
        signal,
        timedOut,
        outputLimit,
        error: spawnError,
        timeMs: Math.round(performance.now() - start)
      })
    })
  })
}

// Write `code` into <runDir>/<role>/ and compile it. Returns a runnable program or a CE.
export async function compileProgram({ role, lang, code, runDir, toolchains, includeDir, cppFlags, controller }) {
  const L = LANGUAGES[lang]
  const tc = toolchains[lang]
  if (!L) return { ok: false, stderr: `Unknown language "${lang}"` }
  if (!tc?.ok) return { ok: false, stderr: `${L.label} toolchain not available. ${tc?.hint ?? ''}` }

  const dir = join(runDir, role)
  mkdirSync(dir, { recursive: true })
  const file = join(dir, L.fileName(code))
  writeFileSync(file, code)

  const opts = { cppFlags: cppFlags ?? DEFAULT_CPP_FLAGS, includeDir }
  const { cmd, args } = L.compile(toolchains, dir, file, opts)
  const r = await runProcess({ cmd, args, cwd: dir, timeoutMs: COMPILE_TIMEOUT_MS, controller })
  if (r.code !== 0) {
    // Show "main.cpp:3:5: error…" instead of the long temp-dir path.
    const stderr = (r.error || r.stderr || (r.timedOut ? 'Compilation timed out' : 'Compilation failed')).replaceAll(dir + '/', '')
    return { ok: false, stderr }
  }
  return { ok: true, lang, timeScale: L.timeScale, run: { ...L.run(toolchains, dir, code), cwd: dir } }
}

function runCompiled(program, input, baseTimeoutMs, controller, extraArgs = []) {
  const { cmd, args, cwd } = program.run
  return runProcess({
    cmd,
    args: [...args, ...extraArgs],
    cwd,
    input,
    timeoutMs: baseTimeoutMs * program.timeScale,
    controller
  })
}

// ---- Output comparison ----

function tokenize(s) {
  return s.split('\n').flatMap((line, i) =>
    line
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((t) => ({ t, line: i + 1 }))
  )
}

const NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i

function tokensEqual(a, b, mode, eps) {
  if (a === b) return true
  if (mode !== 'float' || !NUMBER.test(a) || !NUMBER.test(b)) return false
  const x = Number(a)
  const y = Number(b)
  // Accept if within absolute OR relative tolerance (CF-style).
  return Math.abs(x - y) <= eps * Math.max(1, Math.abs(y))
}

const clip = (s) => (s.length > 40 ? s.slice(0, 40) + '…' : s)

// mode: 'exact' (whitespace-insensitive tokens) | 'float' (numeric tolerance `eps`)
export function compareOutputs(got, expected, mode = 'exact', eps = 1e-6) {
  const a = tokenize(got)
  const b = tokenize(expected)
  for (let k = 0; k < Math.max(a.length, b.length); k++) {
    if (k >= a.length) return { ok: false, message: `wrong answer, output too short: expected "${clip(b[k].t)}" at token ${k + 1}` }
    if (k >= b.length) return { ok: false, message: `wrong answer, extra output: found "${clip(a[k].t)}" at token ${k + 1}` }
    if (!tokensEqual(a[k].t, b[k].t, mode, eps)) {
      return {
        ok: false,
        message: `wrong answer, line ${b[k].line} token ${k + 1}: expected "${clip(b[k].t)}", found "${clip(a[k].t)}"`
      }
    }
  }
  return { ok: true, message: `ok, ${b.length} tokens` }
}

// ---- Stress loop ----

// Each test gets its own reproducible seed derived from the run seed.
export const testSeed = (seed, i) => (Math.imul(seed >>> 0, 1000003) + i) >>> 0

// Input source backed by a user generator program: argv[1] = seed, argv[2] = test #.
export function programInput(gen, baseTimeoutMs, controller) {
  return async (i, seed) => {
    const r = await runCompiled(gen, '', baseTimeoutMs, controller, [String(seed), String(i)])
    if (r.timedOut || r.code !== 0 || r.error) {
      throw new Error(r.error || r.stderr || (r.timedOut ? 'Generator timed out' : `Generator exited with ${r.code ?? r.signal}`))
    }
    return r.stdout
  }
}

const crashed = (r) => r.code !== 0 || r.error || r.outputLimit
const crashInfo = (r) => ({
  stderr: r.outputLimit ? 'Output limit exceeded (1 MB)\n' + r.stderr : r.error || r.stderr,
  exitCode: r.code,
  signal: r.signal
})

/**
 * Runs sol vs brute until a difference, crash, timeout, Stop, or `tests` passes.
 * makeInput(i, seed) -> Promise<string>; onProgress({test, tests, elapsedMs, testsPerSec}).
 * Returns a result object whose `verdict` is AC | WA | TLE | RE | BRUTE_FAIL | GEN_FAIL | STOPPED.
 */
export async function stressLoop({ sol, brute, makeInput, tests, baseTimeoutMs, compareMode, eps, seed, onProgress, controller }) {
  const start = performance.now()
  let lastEmit = 0
  const progress = (test) => {
    const now = performance.now()
    if (now - lastEmit < 100 && test !== tests) return // throttle UI updates
    lastEmit = now
    const elapsedMs = now - start
    onProgress?.({ test, tests, elapsedMs, testsPerSec: test / Math.max(elapsedMs / 1000, 1e-3) })
  }

  for (let i = 1; i <= tests; i++) {
    if (controller.stopped) return { verdict: 'STOPPED', test: i - 1 }
    const s = testSeed(seed, i)
    let input
    try {
      input = await makeInput(i, s)
    } catch (e) {
      if (controller.stopped) return { verdict: 'STOPPED', test: i - 1 }
      return { verdict: 'GEN_FAIL', test: i, seed: s, stderr: e.message }
    }

    const [rs, rb] = await Promise.all([
      runCompiled(sol, input, baseTimeoutMs, controller),
      runCompiled(brute, input, baseTimeoutMs, controller)
    ])
    if (controller.stopped) return { verdict: 'STOPPED', test: i - 1 }

    const base = { test: i, seed: s, input, solOut: rs.stdout, bruteOut: rb.stdout, solMs: rs.timeMs, bruteMs: rb.timeMs }
    if (rs.timedOut) return { verdict: 'TLE', which: 'solution', ...base, ...crashInfo(rs) }
    if (crashed(rs)) return { verdict: 'RE', which: 'solution', ...base, ...crashInfo(rs) }
    if (rb.timedOut || crashed(rb)) {
      return { verdict: 'BRUTE_FAIL', which: 'brute', timedOut: rb.timedOut, ...base, ...crashInfo(rb) }
    }
    const cmp = compareOutputs(rs.stdout, rb.stdout, compareMode, eps)
    if (!cmp.ok) return { verdict: 'WA', ...base, message: cmp.message }

    progress(i)
  }
  return { verdict: 'AC', test: tests, elapsedMs: Math.round(performance.now() - start) }
}

/**
 * Full run: compile everything in an isolated temp dir, stress, clean up.
 * sol/brute/gen: { lang, code } (gen optional; otherwise `makeInput` is used).
 */
export async function runStress({ runId, sol, brute, gen, makeInput, toolchains, includeDir, cppFlags, controller, ...loopOpts }) {
  const runDir = join(tmpdir(), 'stresslab', runId)
  try {
    const roles = { solution: sol, brute, ...(gen ? { generator: gen } : {}) }
    const entries = Object.entries(roles)
    const compiled = await Promise.all(
      entries.map(([role, p]) =>
        compileProgram({ role, lang: p.lang, code: p.code, runDir, toolchains, includeDir, cppFlags, controller })
      )
    )
    if (controller.stopped) return { verdict: 'STOPPED', test: 0 }
    const bad = compiled.findIndex((c) => !c.ok)
    if (bad !== -1) return { verdict: 'CE', which: entries[bad][0], stderr: compiled[bad].stderr }

    const [solP, bruteP, genP] = compiled
    const inputFn = genP ? programInput(genP, loopOpts.baseTimeoutMs, controller) : makeInput
    return await stressLoop({ sol: solP, brute: bruteP, makeInput: inputFn, controller, ...loopOpts })
  } finally {
    rmSync(runDir, { recursive: true, force: true })
  }
}
