import { useState } from 'react'
import Box from './Box'
import { cleanError } from '../lib/errors'

const VERDICT_CLASS = { fits: 'v-ok', risky: 'v-tle', 'too slow': 'v-wa' }

// "Time complexity": the AI reads the solution and the "# limit" lines and
// estimates time/space complexity and whether it fits the limits.
export default function ComplexityBox({ sol, problem, spec, disabled }) {
  const [ai, setAi] = useState(null) // null | { busy } | { error } | estimate

  async function estimate() {
    setAi({ busy: true })
    try {
      setAi(await window.api.estimateComplexity({ sol, problem, spec }))
    } catch (e) {
      setAi({ error: cleanError(e) })
    }
  }

  return (
    <Box
      title="Time complexity (solution)"
      tour="complexity"
      actions={
        <button disabled={ai?.busy || disabled} onClick={estimate}>
          {ai?.busy ? 'Asking AI…' : 'Estimate with AI'}
        </button>
      }
    >
      <div className="complexity">
        {!ai && <div className="small muted">The AI reads your solution and the limits, and estimates its time and space complexity and whether it fits.</div>}
        {ai?.busy && <div className="muted">Asking the AI…</div>}
        {ai?.error && <div className="v-wa">{ai.error}</div>}
        {ai?.time && (
          <>
            <div>
              Time <b className="mono">{ai.time}</b> · Space <b className="mono">{ai.space}</b> · {ai.maxOperations} at the limits →{' '}
              <b className={VERDICT_CLASS[ai.verdict] ?? ''}>{ai.verdict}</b>
            </div>
            {ai.bottleneck && (
              <div className="small">
                Bottleneck: <code>{ai.bottleneck}</code>
              </div>
            )}
            <div className="small muted">{ai.explanation}</div>
          </>
        )}
      </div>
    </Box>
  )
}
