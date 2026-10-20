import Box from './Box'

// Monospace spec editor with live validation status, plus the Spec/Custom mode switch.
export default function SpecEditor({ spec, onChange, status, mode, onModeChange }) {
  const lines = spec.split('\n').length
  return (
    <Box title="Spec" actions={<ModeSwitch mode={mode} onChange={onModeChange} />}>
      <textarea
        className="spec mono"
        spellCheck={false}
        rows={Math.min(14, Math.max(5, lines + 1))}
        value={spec}
        placeholder={'n: int 1..8\na: array[n] int -10..10\nprint n\nprint a'}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="small">
        {!status && <span className="muted">checking…</span>}
        {status?.ok && <span className="v-ok">✓ valid</span>}
        {status && !status.ok && <span className="v-wa">✗ {status.message}</span>}
        <span className="muted">
          {' '}
          · types: int, array, distinct, sorted, perm, string, grid, tree, graph, pairs · repeat t {'{ }'} · print
        </span>
      </div>
    </Box>
  )
}

export function ModeSwitch({ mode, onChange }) {
  return (
    <span className="mode-switch">
      Mode:
      <label>
        <input type="radio" checked={mode === 'spec'} onChange={() => onChange('spec')} /> Spec
      </label>
      <label>
        <input type="radio" checked={mode === 'custom'} onChange={() => onChange('custom')} /> Custom generator
      </label>
    </span>
  )
}
