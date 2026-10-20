// Owns the single active stress run and its desktop side effects
// (progress events, dock badge/progress bar, notification, failure window).
import { app, Notification } from 'electron'
import { randomInt } from 'crypto'
import { runStress, createController } from './runner.js'
import { parseSpec, generateInput, SpecError } from './generator.js'
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

function setDockProgress(fraction) {
  getWindow('main')?.setProgressBar(fraction) // -1 removes the bar
}

/**
 * cfg: { sol, brute, mode: 'spec'|'custom', spec, gen, tests, timeoutSec, compareMode, eps, seed }
 * Returns { runId, seed } immediately; progress/result arrive as events on `sender`.
 */
export async function startRun(cfg, sender) {
  if (active) throw new Error('A run is already in progress')

  let makeInput
  if (cfg.mode === 'spec') {
    let ast
    try {
      ast = parseSpec(cfg.spec)
    } catch (e) {
      if (e instanceof SpecError) throw new Error(`Spec ${e.message}`)
      throw e
    }
    makeInput = async (test, seed) => generateInput(ast, { seed, test, tests: cfg.tests })
  }

  const runId = `${++counter}-${Date.now()}`
  const seed = Number.isInteger(cfg.seed) ? cfg.seed >>> 0 : randomInt(0, 2 ** 31)
  const controller = createController()
  active = { runId, controller }
  app.dock?.setBadge('')
  setDockProgress(0)

  const send = (channel, payload) => !sender.isDestroyed() && sender.send(channel, payload)
  const settings = getSettings()

  runStress({
    runId,
    sol: cfg.sol,
    brute: cfg.brute,
    gen: cfg.mode === 'custom' ? cfg.gen : undefined,
    makeInput,
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
      results.set(runId, full)
      if (results.size > MAX_RESULTS) results.delete(results.keys().next().value)
      send('stress:result', full)
      if (hasDetails(full.verdict)) onFailure(full)
    })

  return { runId, seed }
}

function onFailure(result) {
  app.dock?.setBadge('!')
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
