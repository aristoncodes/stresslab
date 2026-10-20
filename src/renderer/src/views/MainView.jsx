import { useCallback, useEffect, useRef, useState } from 'react'
import HeaderBar from '../components/HeaderBar'
import ProblemInput from '../components/ProblemInput'
import SpecEditor, { ModeSwitch } from '../components/SpecEditor'
import CodePane from '../components/CodePane'
import Box from '../components/Box'
import Sidebar from '../components/Sidebar'
import StatusTable from '../components/StatusTable'
import { usePersistentState, hasSaved } from '../lib/persist'
import { DEFAULT_STATE, TEMPLATES, GEN_TEMPLATES, langInfo } from '../lib/defaults'
import { cleanError } from '../lib/errors'

const STORE = 'stresslab.main'
const time = () => new Date().toLocaleTimeString([], { hour12: false })

export default function MainView() {
  const [state, setState] = usePersistentState(STORE, DEFAULT_STATE)
  const set = useCallback((patch) => setState((s) => ({ ...s, ...patch })), [setState])
  const [toolchains, setToolchains] = useState(null)
  const [specStatus, setSpecStatus] = useState(null)
  const [runs, setRuns] = useState([]) // newest first: { id, when, sol, brute, tests, result }
  const [focused, setFocused] = useState('sol')
  const running = runs.some((r) => r.result.verdict === 'RUNNING')

  // Toolchains + first-launch defaults from Settings.
  const refreshToolchains = useCallback((refresh) => {
    setToolchains(null)
    window.api.getToolchains(refresh).then(setToolchains)
  }, [])
  useEffect(() => {
    refreshToolchains(false)
    if (!hasSaved(STORE)) {
      window.api.getSettings().then((s) => set({ tests: s.defaultTests, timeoutSec: s.baseTimeoutSec }))
    }
  }, [refreshToolchains, set])

  // Debounced live spec validation in the main process.
  useEffect(() => {
    setSpecStatus(null)
    const t = setTimeout(() => window.api.validateSpec(state.spec).then(setSpecStatus), 300)
    return () => clearTimeout(t)
  }, [state.spec])

  // Progress / result events for the active run.
  useEffect(() => {
    const update = (payload) =>
      setRuns((rs) => rs.map((r) => (r.runId === payload.runId || (!r.runId && r.result.verdict === 'RUNNING') ? { ...r, runId: payload.runId, result: { ...r.result, ...payload } } : r)))
    const offProgress = window.api.onProgress((p) => update({ ...p, verdict: 'RUNNING' }))
    const offResult = window.api.onResult(update)
    return () => {
      offProgress()
      offResult()
    }
  }, [])

  // Why Run is disabled (null = can run).
  const usedLangs = [state.sol.lang, state.brute.lang, ...(state.mode === 'custom' ? [state.gen.lang] : [])]
  const missingLang = toolchains && usedLangs.find((l) => !toolchains[l]?.ok)
  const blockReason = running
    ? 'A run is in progress'
    : !toolchains
      ? 'Detecting toolchains…'
      : missingLang
        ? `${langInfo(missingLang).label} toolchain is missing`
        : state.mode === 'spec' && !specStatus?.ok
          ? 'Spec is invalid'
          : null
  const canRun = !blockReason

  const run = useCallback(async () => {
    if (!canRun) return
    const id = runs.length ? runs[0].id + 1 : 1
    const row = { id, when: time(), sol: state.sol.lang, brute: state.brute.lang, tests: state.tests, result: { verdict: 'RUNNING' } }
    setRuns((rs) => [row, ...rs])
    try {
      const { runId } = await window.api.startStress({
        sol: state.sol,
        brute: state.brute,
        mode: state.mode,
        spec: state.spec,
        gen: state.gen,
        tests: state.tests,
        timeoutSec: state.timeoutSec,
        compareMode: state.compareMode,
        eps: state.eps,
        seed: state.seed === '' ? null : Number(state.seed)
      })
      setRuns((rs) => rs.map((r) => (r.id === id ? { ...r, runId } : r)))
    } catch (e) {
      setRuns((rs) => rs.map((r) => (r.id === id ? { ...r, result: { verdict: 'ERROR', message: cleanError(e) } } : r)))
    }
  }, [canRun, runs, state])

  const stop = useCallback(() => window.api.stopStress(), [])

  const openInto = useCallback(
    async (role) => {
      const f = await window.api.openFile().catch((e) => alert(cleanError(e)))
      if (f) set({ [role]: { lang: f.lang ?? state[role].lang, code: f.content } })
    },
    [set, state]
  )

  // Native menu shortcuts (⌘R, ⌘., ⌘O) — refs keep the latest handlers.
  const handlers = useRef({})
  handlers.current = { run, stop, open: () => openInto(focused) }
  useEffect(() => window.api.onMenuCommand((cmd) => handlers.current[cmd]?.()), [])

  // Switching language swaps in that language's template if the editor is empty or untouched.
  const changeLang = (role, lang, templates) => {
    const p = state[role]
    const untouched = !p.code.trim() || Object.values(templates).includes(p.code)
    set({ [role]: { lang, code: untouched ? templates[lang] : p.code } })
  }

  const pane = (role, title, templates = TEMPLATES, height) => (
    <CodePane
      title={title}
      program={state[role]}
      toolchains={toolchains}
      height={height}
      onChange={(code) => setState((s) => ({ ...s, [role]: { ...s[role], code } }))}
      onLangChange={(lang) => changeLang(role, lang, templates)}
      onOpen={() => openInto(role)}
      onFocus={() => setFocused(role)}
    />
  )

  return (
    <div className="app">
      <HeaderBar />
      <div className="layout">
        <main className="content">
          {state.mode === 'spec' ? (
            <>
              <ProblemInput value={state.problem} onChange={(problem) => set({ problem })} onSpec={(spec) => set({ spec })} />
              <SpecEditor
                spec={state.spec}
                onChange={(spec) => set({ spec })}
                status={specStatus}
                mode={state.mode}
                onModeChange={(mode) => set({ mode })}
              />
            </>
          ) : (
            <Box title="Generator" actions={<ModeSwitch mode={state.mode} onChange={(mode) => set({ mode })} />}>
              <div className="small muted">The generator receives the seed as argv[1] and the test number as argv[2], and prints one test to stdout.</div>
              {pane('gen', 'Generator code', GEN_TEMPLATES, 240)}
            </Box>
          )}
          <div className="editors">
            {pane('sol', 'Solution')}
            {pane('brute', 'Brute')}
          </div>
          <StatusTable runs={runs} />
        </main>
        <Sidebar
          toolchains={toolchains}
          onRefreshToolchains={() => refreshToolchains(true)}
          state={state}
          set={set}
          running={running}
          canRun={canRun}
          blockReason={blockReason}
          onRun={run}
          onStop={stop}
        />
      </div>
    </div>
  )
}
