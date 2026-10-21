// Owns the single active stress run and its desktop side effects
// (progress events, dock badge/progress bar, notification, failure window).
import { app, Notification, nativeImage } from 'electron'
import { randomInt } from 'crypto'
import { runStress, createController, compareOutputs } from './runner.js'
import { parseSpec, generateInput, generateTest, profileFor, SpecError } from './generator.js'
import { getToolchains } from './toolchains.js'
import { includeDir } from './paths.js'
import { getSettings } from './settings.js'
import { getWindow, openFailureWindow } from './windows.js'
import { verdictText, hasDetails } from '../shared/verdict.js'

let active = null // { runId, controller }
let counter = 0
const results = new Map() // runId -> full result (kept for the failure window)
const MAX_RESULTS = 30

export const getResult = (runId) => results.get(runId) ?? null

// Failure marker: dock badge (macOS), red "!" overlay on the taskbar icon
// (Windows), launcher badge count where supported (Linux).
function setFailureBadge(on) {
  if (process.platform === 'darwin') app.dock?.setBadge(on ? '!' : '')
  else if (process.platform === 'win32') getWindow('main')?.setOverlayIcon(on ? overlayIcon() : null, on ? 'Test failed' : '')
  else app.setBadgeCount(on ? 1 : 0)
}

// 32×32 red circle with a white "!", drawn as raw BGRA pixels (no image file needed).
let overlay = null
function overlayIcon() {
  if (overlay) return overlay
  const S = 32
  const px = Buffer.alloc(S * S * 4)
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4
      if ((x - 15.5) ** 2 + (y - 15.5) ** 2 > 15.5 ** 2) continue // transparent outside
      const bang = x >= 14 && x <= 17 && ((y >= 6 && y <= 19) || (y >= 23 && y <= 26))
      px.set(bang ? [255, 255, 255, 255] : [0x2b, 0x2b, 0xd6, 255], i) // B, G, R, A
    }
  }
  overlay = nativeImage.createFromBitmap(px, { width: S, height: S })
  return overlay
}

function setDockProgress(fraction) {
  getWindow('main')?.setProgressBar(fraction) // -1 removes the bar
}

/**
 * cfg: { sol, brute, mode: 'spec'|'custom', spec, gen, sample, profiles, tests, timeoutSec, compareMode, eps, seed }
 * profiles: generators to cycle through in spec mode (see PROFILES in generator.js).
 * Returns { runId, seed } immediately; progress/result arrive as events on `sender`.
 */
export async function startRun(cfg, sender) {
  if (active) throw new Error('A run is already in progress')

  let makeInput
  let ast
  if (cfg.mode === 'spec') {
    try {
      ast = parseSpec(cfg.spec)
    } catch (e) {
      if (e instanceof SpecError) throw new Error(`Spec ${e.message}`)
      throw e
    }
    makeInput = async (test, seed) => generateInput(ast, { seed, test, tests: cfg.tests, profile: profileFor(test, cfg.profiles) })
  }

  const runId = `${++counter}-${Date.now()}`
  const seed = Number.isInteger(cfg.seed) ? cfg.seed >>> 0 : randomInt(0, 2 ** 31)
  const controller = createController()
  active = { runId, controller }
  setFailureBadge(false)
  setDockProgress(0)

  const send = (channel, payload) => !sender.isDestroyed() && sender.send(channel, payload)
  const settings = getSettings()

  runStress({
    runId,
    sol: cfg.sol,
    brute: cfg.brute,
    gen: cfg.mode === 'custom' ? cfg.gen : undefined,
    makeInput,
    sample: cfg.sample,
    toolchains: await getToolchains(),
    includeDir: includeDir(),
    cppFlags: settings.cppFlags.split(/\s+/).filter(Boolean),
    tests: cfg.tests,
    baseTimeoutMs: Math.round(cfg.timeoutSec * 1000),
    compareMode: cfg.compareMode,
    eps: cfg.eps,
    seed,
    controller,
    onProgress: (p) => {
      setDockProgress(p.test / p.tests)
      send('stress:progress', { runId, ...p })
    }
  })
    .catch((e) => ({ verdict: 'ERROR', message: e.message }))
    .then((result) => {
      active = null
      setDockProgress(-1)
      const full = { runId, runSeed: seed, sol: cfg.sol.lang, brute: cfg.brute.lang, ...result }
      if (ast && full.test && !full.onSample && full.input !== undefined) full.profile = profileFor(full.test, cfg.profiles)
      if (full.verdict === 'WA' && ast && !full.onSample) full.caseInfo = locateCase(ast, full, cfg)
      results.set(runId, full)
      if (results.size > MAX_RESULTS) results.delete(results.keys().next().value)
      send('stress:result', full)
      if (hasDetails(full.verdict)) onFailure(full)
    })

  return { runId, seed }
}

/**
 * For multi-test inputs (top-level `repeat t`) with one output line per test
 * case, find which case differs. The input is regenerated from the same seed
 * (generation is deterministic) to get each case's line range.
 */
function locateCase(ast, r, cfg) {
  const { cases } = generateTest(ast, { seed: r.seed, test: r.test, tests: cfg.tests, profile: r.profile })
  const expected = r.bruteOut.trimEnd().split('\n')
  const got = r.solOut.trimEnd().split('\n')
  if (cases.length < 2 || expected.length !== cases.length) return null
  const i = expected.findIndex((line, k) => !compareOutputs(got[k] ?? '', line, cfg.compareMode, cfg.eps).ok)
  if (i < 0) return null
  const lines = r.input.split('\n')
  const { start, end } = cases[i]
  const caseLines = lines.slice(start - 1, end)
  // If the only line before the cases is the count t, the case can be run on its own as "1 + case".
  const prefix = lines.slice(0, cases[0].start - 1)
  const standalone = prefix.length === 1 && prefix[0].trim() === String(cases.length) ? ['1', ...caseLines].join('\n') + '\n' : null
  return { index: i + 1, count: cases.length, start, end, input: caseLines.join('\n') + '\n', standalone, got: got[i] ?? '', expected: expected[i] }
}

function onFailure(result) {
  setFailureBadge(true)
  if (result.verdict !== 'CE' && Notification.isSupported()) {
    const n = new Notification({ title: 'StressLab', body: verdictText(result) })
    n.on('click', () => openFailureWindow(result.runId))
    n.show()
  }
  openFailureWindow(result.runId)
}

export function stopRun() {
  active?.controller.stop()
}

export const isRunning = () => !!active
