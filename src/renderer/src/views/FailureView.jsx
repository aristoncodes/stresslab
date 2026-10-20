import { useEffect, useState } from 'react'
import { DiffEditor } from '@monaco-editor/react'
import { verdictText, verdictClass } from '../../../shared/verdict.js'
import { langInfo } from '../lib/defaults'
import { useDarkMode, monacoTheme } from '../lib/useDarkMode'
import { cleanError } from '../lib/errors'

const DIFF_OPTIONS = { readOnly: true, minimap: { enabled: false }, renderSideBySide: true, useInlineViewWhenSpaceIsLimited: false, scrollBeyondLastLine: false, automaticLayout: true, fontSize: 13 }

// Separate window: details of one failed run (runId comes from the URL hash).
export default function FailureView({ runId }) {
  const [r, setR] = useState(undefined)
  useEffect(() => {
    window.api.getFailure(runId).then(setR)
  }, [runId])
  useEffect(() => {
    if (r) document.title = verdictText(r)
  }, [r])

  if (r === undefined) return <div className="pad muted">Loading…</div>
  if (r === null) return <div className="pad">This run is no longer available.</div>

  return (
    <div className="failure">
      <h1 className={verdictClass(r.verdict)}>{verdictText(r)}</h1>
      <div className="meta">{meta(r)}</div>
      {r.verdict === 'CE' ? (
        <section>
          <h2>Compiler output ({r.which})</h2>
          <pre className="io">{r.stderr || '(no output)'}</pre>
        </section>
      ) : (
        <>
          {r.input !== undefined && <InputSection r={r} />}
          {r.verdict === 'WA' ? <DiffSection r={r} /> : <CrashSection r={r} />}
        </>
      )}
    </div>
  )
}

function meta(r) {
  const parts = []
  if (r.seed !== undefined) parts.push(`Seed: ${r.seed}`)
  if (r.input) parts.push(`First line: ${r.input.split('\n')[0].slice(0, 40)}`)
  parts.push(`${langInfo(r.sol).label} vs ${langInfo(r.brute).label}`)
  if (r.solMs !== undefined) parts.push(`Sol ${r.solMs} ms`, `Brute ${r.bruteMs} ms`)
  return parts.join('  ·  ')
}

function InputSection({ r }) {
  const [saved, setSaved] = useState(null)
  const [note, setNote] = useState('')

  async function copy() {
    await window.api.copyText(r.input)
    setNote('Copied')
    setTimeout(() => setNote(''), 1500)
  }
  async function save() {
    try {
      const path = await window.api.saveText({ text: r.input, defaultName: `failing-test-${r.test}.txt` })
      if (path) setSaved(path)
    } catch (e) {
      setNote(cleanError(e))
    }
  }

  return (
    <section>
      <h2>
        Input
        <span className="actions">
          {note && <span className="small v-ok">{note}</span>}
          <button onClick={copy}>Copy</button>
          <button onClick={save}>Save as .txt</button>
        </span>
      </h2>
      <pre className="io">{r.input}</pre>
      {saved && (
        <div className="small">
          Saved to {saved} ·{' '}
          <button className="link" onClick={() => window.api.openPath(saved)}>
            Open
          </button>{' '}
          ·{' '}
          <button className="link" onClick={() => window.api.showInFolder(saved)}>
            Show in Finder
          </button>
        </div>
      )}
    </section>
  )
}

function DiffSection({ r }) {
  const dark = useDarkMode()
  return (
    <section className="grow">
      <div className="diff-labels">
        <h2>Output (yours)</h2>
        <h2>Expected (brute)</h2>
      </div>
      <div className="diff">
        <DiffEditor original={r.solOut} modified={r.bruteOut} theme={monacoTheme(dark)} options={DIFF_OPTIONS} />
      </div>
      <div className="checker">Checker: {r.message}</div>
    </section>
  )
}

function CrashSection({ r }) {
  const who = r.verdict === 'GEN_FAIL' ? 'Generator' : r.which === 'brute' ? 'Brute' : 'Solution'
  const status = r.verdict === 'TLE' || r.timedOut ? 'killed after the time limit' : r.signal ? `killed by signal ${r.signal}` : `exit code ${r.exitCode}`
  return (
    <section className="grow">
      <h2>
        {who} — {r.verdict === 'GEN_FAIL' ? 'error' : status}
      </h2>
      <pre className="io">{r.stderr || '(no stderr)'}</pre>
      {r.verdict !== 'GEN_FAIL' && (
        <>
          <h2>{who} output before failing</h2>
          <pre className="io">{(r.which === 'brute' ? r.bruteOut : r.solOut) || '(empty)'}</pre>
        </>
      )}
    </section>
  )
}
