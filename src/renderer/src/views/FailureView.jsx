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
          {r.caseInfo && <CaseSection c={r.caseInfo} />}
          {r.verdict === 'WA' ? (
            <DiffSection left={r.solOut} right={r.expectedOut ?? r.bruteOut} leftLabel="Output (yours)" rightLabel={r.expectedOut ? 'Expected (sample output)' : 'Expected (brute)'} message={r.message} />
          ) : r.verdict === 'BRUTE_FAIL' && r.expectedOut ? (
            <DiffSection left={r.bruteOut} right={r.expectedOut} leftLabel="Brute output" rightLabel="Expected (sample output)" message={r.message} />
          ) : (
            <CrashSection r={r} />
          )}
        </>
      )}
    </div>
  )
}

function meta(r) {
  const parts = []
  if (r.onSample) parts.push('Sample test from the problem statement (checked before random tests)')
  else if (r.test) parts.push(`Random test #${r.test}`)
  if (r.seed !== undefined) parts.push(`Seed: ${r.seed}`)
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
      const path = await window.api.saveText({ text: r.input, defaultName: r.onSample ? 'sample-input.txt' : `failing-test-${r.test}.txt` })
      if (path) setSaved(path)
    } catch (e) {
      setNote(cleanError(e))
    }
  }

  return (
    <section>
      <h2>
        {r.onSample ? 'Input (sample test)' : `Input of test #${r.test}`}
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

function DiffSection({ left, right, leftLabel, rightLabel, message }) {
  const dark = useDarkMode()
  return (
    <section className="grow">
      <div className="diff-labels">
        <h2>{leftLabel}</h2>
        <h2>{rightLabel}</h2>
      </div>
      <div className="diff">
        <DiffEditor original={left} modified={right} theme={monacoTheme(dark)} options={DIFF_OPTIONS} />
      </div>
      <div className="checker">Checker: {message}</div>
    </section>
  )
}

// Multi-test input: which test case inside the input differs, shown on its own.
function CaseSection({ c }) {
  const [copied, setCopied] = useState(false)
  const text = c.standalone ?? c.input
  async function copy() {
    await window.api.copyText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <section className="case-info">
      <h2>
        <span className="v-wa">
          Fails on test case {c.index} of {c.count} (input lines {c.start}–{c.end}): expected &quot;{c.expected}&quot;, found &quot;{c.got}&quot;
        </span>
        <span className="actions">
          {copied && <span className="small v-ok">Copied</span>}
          <button onClick={copy}>Copy this case</button>
        </span>
      </h2>
      <div className="small muted">{c.standalone ? 'As a standalone input (t = 1):' : 'Lines of this test case:'}</div>
      <pre className="io">{text}</pre>
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
