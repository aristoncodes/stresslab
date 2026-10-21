import Box from './Box'
import { langInfo } from '../lib/defaults'
import { key } from '../lib/keys'
import { verdictText, verdictClass, hasDetails } from '../../../shared/verdict.js'

// CF "My submissions"-style table. Newest run on top; failures are clickable.
export default function StatusTable({ runs }) {
  const active = runs.find((r) => r.result.verdict === 'RUNNING')
  const progress = active?.result.tests ? active.result.test / active.result.tests : 0
  return (
    <Box title="Status" tour="status" bodyClassName="flush">
      <table className="status">
        <thead>
          <tr>
            <th>#</th>
            <th>When</th>
            <th>Sol</th>
            <th>Brute</th>
            <th>Tests</th>
            <th>Speed</th>
            <th className="wide-col">Verdict</th>
          </tr>
          {active && (
            <tr className="progress-row">
              <td colSpan={7}>
                <div className="progress" style={{ width: `${progress * 100}%` }} />
              </td>
            </tr>
          )}
        </thead>
        <tbody>
          {runs.length === 0 && (
            <tr>
              <td colSpan={7} className="muted center">
                No runs yet. Press Run ({key('R')}).
              </td>
            </tr>
          )}
          {runs.map((r) => {
            const v = r.result
            const clickable = v.runId && hasDetails(v.verdict)
            return (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.when}</td>
                <td>{langInfo(r.sol).label}</td>
                <td>{langInfo(r.brute).label}</td>
                <td>{v.test ? `${v.test} / ${r.tests}` : '—'}</td>
                <td>{v.testsPerSec ? `${v.testsPerSec.toFixed(1)}/s` : '—'}</td>
                <td className={verdictClass(v.verdict)}>
                  {clickable ? (
                    <button className="link verdict" onClick={() => window.api.openFailure(v.runId)}>
                      {verdictText(v)}
                    </button>
                  ) : (
                    verdictText(v)
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Box>
  )
}
