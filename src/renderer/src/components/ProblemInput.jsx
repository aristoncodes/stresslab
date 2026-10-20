import { useState } from 'react'
import Box from './Box'
import { cleanError } from '../lib/errors'

// Paste the problem's Input section → AI writes the spec (validated + retried in main).
export default function ProblemInput({ value, sample, onChange, onSpec }) {
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState(null) // { kind: 'ok'|'err', text }

  async function generate() {
    setBusy(true)
    setNote(null)
    try {
      const r = await window.api.specFromText({ text: value, sample })
      onSpec(r.spec)
      const via = (r.sampleChecked ? ', matches the sample input' : '') + (r.fellBack ? ` (main model busy, used ${r.model})` : '')
      setNote(
        r.ok
          ? { kind: 'ok', text: `Spec generated${r.attempts > 1 ? ` after ${r.attempts} attempts` : ''}. Review it below${via}.` }
          : { kind: 'err', text: `AI spec still invalid after ${r.attempts} attempts (${r.error}). Fix it by hand.` }
      )
    } catch (e) {
      setNote({ kind: 'err', text: cleanError(e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box title="Problem input">
      <textarea
        className="problem"
        rows={4}
        value={value}
        placeholder='Paste the "Input" section of the problem (with constraints)…'
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="row-end">
        {note && <span className={`small ${note.kind === 'ok' ? 'v-ok' : 'v-wa'}`}>{note.text}</span>}
        <button className="primary" disabled={busy || !value.trim()} onClick={generate}>
          {busy ? 'Generating…' : 'Generate spec with AI'}
        </button>
      </div>
    </Box>
  )
}

