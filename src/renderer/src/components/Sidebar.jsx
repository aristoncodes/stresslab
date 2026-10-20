import Box from './Box'
import { LANGS } from '../lib/defaults'
import { PROFILE_LABELS } from '../../../shared/verdict.js'

const PROFILE_HINTS = {
  random: 'small random tests that grow',
  edge: 'min sizes, extreme values (min, max, ±1, 0)',
  max: 'max sizes, values at the real limits (overflow)',
  pattern: 'equal / sorted / reversed arrays, path & star trees'
}

function ToolchainBox({ toolchains, onRefresh }) {
  return (
    <Box
      title="Toolchains"
      actions={
        <button className="link" onClick={onRefresh} title="Detect again">
          refresh
        </button>
      }
    >
      {!toolchains && <div className="muted">Detecting…</div>}
      {toolchains &&
        LANGS.map(({ id, label }) => {
          const t = toolchains[id]
          return (
            <div key={id} className="tc-row" title={t.error || t.path || t.home || ''}>
              <span className="tc-lang">{label}</span>
              <span className={t.ok ? 'v-ok' : 'v-wa'}>{t.ok ? '●' : '○'}</span>
              <span className="tc-version">{t.ok ? shortVersion(id, t) : t.version ? 'broken' : 'none'}</span>
              {!t.ok && <div className="tc-hint">{t.hint}</div>}
            </div>
          )
        })}
    </Box>
  )
}

// "g++-16 (Homebrew GCC 16.1.0) 16.1.0" → "g++-16"; "Python 3.14.2" → "3.14.2"
function shortVersion(id, t) {
  if (id === 'cpp') return t.kind === 'gcc' ? t.path.split('/').pop() : 'clang'
  return (t.version ?? '').match(/\d+(\.\d+)*/)?.[0] ?? '?'
}

function RunOptionsBox({ state, set, running, canRun, blockReason, onRun, onStop }) {
  return (
    <Box title="Run options">
      <table className="form">
        <tbody>
          <tr>
            <td>Tests</td>
            <td>
              <input type="number" min="1" max="100000" value={state.tests} onChange={(e) => set({ tests: Number(e.target.value) })} />
            </td>
          </tr>
          <tr>
            <td>Timeout</td>
            <td>
              <input type="number" min="0.1" step="0.5" value={state.timeoutSec} onChange={(e) => set({ timeoutSec: Number(e.target.value) })} />{' '}
              s
            </td>
          </tr>
          <tr>
            <td>Compare</td>
            <td>
              <select value={state.compareMode} onChange={(e) => set({ compareMode: e.target.value })}>
                <option value="exact">exact</option>
                <option value="float">float</option>
              </select>
            </td>
          </tr>
          {state.compareMode === 'float' && (
            <tr>
              <td>Epsilon</td>
              <td>
                <input type="number" step="any" value={state.eps} onChange={(e) => set({ eps: Number(e.target.value) })} />
              </td>
            </tr>
          )}
          <tr>
            <td>Seed</td>
            <td>
              <input placeholder="random" value={state.seed} onChange={(e) => set({ seed: e.target.value.replace(/\D/g, '') })} />
            </td>
          </tr>
        </tbody>
      </table>
      {state.mode === 'spec' && (
        <div className="generators">
          <div className="small">Generators (cycled per test)</div>
          {Object.entries(PROFILE_LABELS).map(([id, label]) => (
            <label key={id} className="small" title={PROFILE_HINTS[id]}>
              <input
                type="checkbox"
                checked={state.profiles.includes(id)}
                onChange={(e) => set({ profiles: e.target.checked ? [...state.profiles, id] : state.profiles.filter((p) => p !== id) })}
              />{' '}
              {label}
            </label>
          ))}
        </div>
      )}
      <div className="small muted">Timeout is scaled ×3 for Python, ×4 for Java.</div>
      <button className="primary wide" disabled={!canRun} onClick={onRun} title={blockReason}>
        Run ⌘R
      </button>
      <button className="wide" disabled={!running} onClick={onStop}>
        Stop ⌘.
      </button>
      {blockReason && !running && <div className="small v-wa">{blockReason}</div>}
    </Box>
  )
}

export default function Sidebar(props) {
  return (
    <aside className="sidebar">
      <ToolchainBox toolchains={props.toolchains} onRefresh={props.onRefreshToolchains} />
      <RunOptionsBox {...props} />
    </aside>
  )
}
