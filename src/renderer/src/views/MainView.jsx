import { useCallback, useEffect, useRef, useState } from 'react'
import ProblemInput from '../components/ProblemInput'
import SpecEditor, { ModeSwitch } from '../components/SpecEditor'
import CodePane from '../components/CodePane'
import Box from '../components/Box'
import Sidebar from '../components/Sidebar'
import StatusTable from '../components/StatusTable'
import SampleBox from '../components/SampleBox'
import KeyPrompt from '../components/KeyPrompt'
import ComplexityBox from '../components/ComplexityBox'
import Tour from '../components/Tour'
import { usePersistentState, hasSaved, flag, setFlag } from '../lib/persist'
import { DEFAULT_STATE, TEMPLATES, GEN_TEMPLATES, langInfo } from '../lib/defaults'
import { cleanError } from '../lib/errors'
import { useOpenFiles, editorText } from '../lib/openFiles'
import { runLanguage } from '../lib/files'

const STORE = 'stresslab.main'
const time = () => new Date().toLocaleTimeString([], { hour12: false })

// The stress tester. `active` = currently shown; `menuCommand` = latest native-menu
// command ({ cmd, n }); `tourSignal` bumps to replay the walkthrough.
export default function MainView({ active, menuCommand, tourSignal }) {
  const [state, setState] = usePersistentState(STORE, DEFAULT_STATE)
  const set = useCallback((patch) => setState((s) => ({ ...s, ...patch })), [setState])
  const [toolchains, setToolchains] = useState(null)
  const [specStatus, setSpecStatus] = useState(null)
  const [runs, setRuns] = useState([]) // newest first: { id, when, sol, brute, tests, result }
  const [focused, setFocused] = useState('sol')
  // First launch: key dialog first, then the walkthrough (replay via Help menu / header).
  const [keyDone, setKeyDone] = useState(false)
  const [tour, setTour] = useState(() => !flag('stresslab.tourDone'))
  const onKeyDone = useCallback(() => setKeyDone(true), [])
  const closeTour = useCallback(() => {
    setTour(false)
    setFlag('stresslab.tourDone')
  }, [])
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

  // Debounced live spec validation (and sample-format check) in the main process.
  useEffect(() => {
    setSpecStatus(null)
    const t = setTimeout(() => window.api.validateSpec({ spec: state.spec, sample: state.sampleIn }).then(setSpecStatus), 300)
    return () => clearTimeout(t)
  }, [state.spec, state.sampleIn])

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
          : state.mode === 'spec' && !state.profiles.length
            ? 'Tick at least one generator'
            : null
  const canRun = !blockReason

  // Programs linked to editor files take the editor's current text (unsaved edits too).
  const editorFiles = useOpenFiles()
  const withLinkedCode = (s) => {
    const next = { ...s }
    for (const role of ['sol', 'brute', 'gen']) {
      const text = s[role].link ? editorText(s[role].link) : null
      if (text !== null && text !== undefined) next[role] = { ...s[role], code: text }
    }
    return next
  }
  useEffect(() => {
    if (active) setState(withLinkedCode)
  }, [active, setState]) // eslint-disable-line react-hooks/exhaustive-deps
  const linkTo = (role, path) =>
    setState((s) => ({ ...s, [role]: { lang: runLanguage(path) ?? s[role].lang, code: editorText(path) ?? s[role].code, link: path } }))
  const unlink = (role) => setState((s) => ({ ...s, [role]: { ...s[role], link: undefined } }))

  const run = useCallback(async () => {
    if (!canRun) return
    const fresh = withLinkedCode(state)
    setState(fresh)
    const id = runs.length ? runs[0].id + 1 : 1
    const row = { id, when: time(), sol: state.sol.lang, brute: state.brute.lang, tests: state.tests, result: { verdict: 'RUNNING' } }
    setRuns((rs) => [row, ...rs])
    try {
      const { runId } = await window.api.startStress({
        sol: { lang: fresh.sol.lang, code: fresh.sol.code },
        brute: { lang: fresh.brute.lang, code: fresh.brute.code },
        mode: state.mode,
        spec: state.spec,
        gen: { lang: fresh.gen.lang, code: fresh.gen.code },
        sample: { input: state.sampleIn, output: state.sampleOut },
        profiles: state.profiles,
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

  // Native menu shortcuts (Run, Stop, Open, Walkthrough) — refs keep the latest handlers.
  const handlers = useRef({})
  handlers.current = { run, stop, open: () => openInto(focused) }
  useEffect(() => {
    if (active && menuCommand) handlers.current[menuCommand.cmd]?.()
  }, [menuCommand, active])
  useEffect(() => {
    if (tourSignal) setTour(true)
  }, [tourSignal])



  // Switching language swaps in that language's template if the editor is empty or untouched.
  const changeLang = (role, lang, templates) => {
    const p = state[role]
    const untouched = !p.code.trim() || Object.values(templates).includes(p.code)
    set({ [role]: { lang, code: untouched ? templates[lang] : p.code } })
  }

  const pane = (role, title, templates = TEMPLATES, height) => (
    <CodePane
      title={title}
      tour={role}
      program={state[role]}
      toolchains={toolchains}
      height={height}
      onChange={(code) => setState((s) => ({ ...s, [role]: { ...s[role], code, link: undefined } }))}
      editorFiles={editorFiles}
      onLink={(path) => linkTo(role, path)}
      onUnlink={() => unlink(role)}
      onLangChange={(lang) => changeLang(role, lang, templates)}
      onOpen={() => openInto(role)}
      onFocus={() => setFocused(role)}
    />
  )

  return (
    <div className="stress-view">
      <KeyPrompt onDone={onKeyDone} />
      {active && keyDone && tour && <Tour onClose={closeTour} />}
      <div className="layout">
        <main className="content">
          {state.mode === 'spec' ? (
            <>
              <ProblemInput
                value={state.problem}
                sample={state.sampleIn}
                onChange={(problem) => set({ problem })}
                onSpec={(spec) => set({ spec })}
              />
              <SpecEditor
                spec={state.spec}
                onChange={(spec) => set({ spec })}
                status={specStatus}
                mode={state.mode}
                onModeChange={(mode) => set({ mode })}
              />
            </>
          ) : (
            <Box title="Generator" tour="spec" actions={<ModeSwitch mode={state.mode} onChange={(mode) => set({ mode })} />}>
              <div className="small muted">The generator receives the seed as argv[1] and the test number as argv[2], and prints one test to stdout.</div>
              {pane('gen', 'Generator code', GEN_TEMPLATES, 240)}
            </Box>
          )}
          <SampleBox input={state.sampleIn} output={state.sampleOut} onChange={set} />
          <div className="editors">
            {pane('sol', 'Solution')}
            {pane('brute', 'Brute')}
          </div>
          <StatusTable runs={runs} />
          <ComplexityBox sol={state.sol} problem={state.problem} spec={state.spec} disabled={running} />
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
