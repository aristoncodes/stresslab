import { useEffect, useState } from 'react'
import { cleanError } from '../lib/errors'

const KEY_URL = 'https://console.groq.com/keys'

// Shown at startup while no Groq key is saved: asks for the user's own free key.
// The key goes to the main process (encrypted with safeStorage); "Later" asks again next launch.
// onDone() fires once the dialog is closed (or wasn't needed).
export default function KeyPrompt({ onDone }) {
  const [open, setOpen] = useState(false)
  const [key, setKey] = useState('')
  const [status, setStatus] = useState(null) // { kind, text }

  useEffect(() => {
    window.api.getSettings().then((s) => {
      setOpen(!s.hasKey.groq)
      if (s.hasKey.groq) onDone?.()
    })
  }, [onDone])
  const close = () => {
    setOpen(false)
    onDone?.()
  }
  if (!open) return null

  async function save() {
    setStatus({ kind: 'muted', text: 'Checking the key…' })
    try {
      const reply = await window.api.testLlm({ provider: 'groq', model: 'openai/gpt-oss-120b', apiKey: key.trim() })
      await window.api.setSettings({ provider: 'groq', apiKey: { provider: 'groq', value: key.trim() } })
      setStatus({ kind: 'v-ok', text: `Saved. Groq replied "${reply}".` })
      setTimeout(close, 1200)
    } catch (e) {
      setStatus({ kind: 'v-wa', text: cleanError(e) })
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal box" role="dialog" aria-labelledby="key-title">
        <div className="box-title" id="key-title">
          Add your free Groq API key
        </div>
        <div className="box-body">
          <p>
            StressLab uses Groq to turn a problem statement into a test generator (&quot;Generate spec with AI&quot;). Each user needs their own key. It&apos;s free and takes a minute:
          </p>
          <ol>
            <li>
              Open{' '}
              <a href={KEY_URL} target="_blank" rel="noreferrer">
                console.groq.com/keys
              </a>{' '}
              and sign in.
            </li>
            <li>Click &quot;Create API Key&quot; and copy it (it starts with gsk_).</li>
            <li>Paste it below.</li>
          </ol>
          <input
            className="key-input mono"
            type="password"
            placeholder="gsk_…"
            value={key}
            autoFocus
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && key.trim() && save()}
          />
          {status && <div className={`small ${status.kind}`}>{status.text}</div>}
          <div className="small muted">The key is stored encrypted on this Mac only. Everything except AI spec generation works without it.</div>
          <div className="row-end">
            <button onClick={close}>Later</button>
            <button className="primary" disabled={!key.trim()} onClick={save}>
              Save key
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
