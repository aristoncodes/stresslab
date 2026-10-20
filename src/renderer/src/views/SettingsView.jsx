import { useEffect, useState } from 'react'
import { cleanError } from '../lib/errors'

const PROVIDERS = [
  { id: 'groq', label: 'Groq', keyHint: 'Free key: console.groq.com/keys' },
  { id: 'gemini', label: 'Gemini', keyHint: 'Free key: aistudio.google.com/apikey (falls back to flash-lite when busy)' },
  { id: 'ollama', label: 'Ollama (local)', keyHint: 'No key needed. Run: ollama serve' }
]

// Settings window. The API key is sent once to main, encrypted there, and never read back.
export default function SettingsView() {
  const [s, setS] = useState(null)
  const [key, setKey] = useState('')
  const [test, setTest] = useState(null) // { kind, text }
  const [error, setError] = useState('')

  useEffect(() => {
    window.api.getSettings().then(setS)
  }, [])
  if (!s) return <div className="pad muted">Loading…</div>

  const p = PROVIDERS.find((x) => x.id === s.provider)
  const set = (patch) => setS({ ...s, ...patch })
  const setModel = (model) => set({ models: { ...s.models, [s.provider]: model } })

  async function runTest() {
    setTest({ kind: 'muted', text: 'Testing…' })
    try {
      const reply = await window.api.testLlm({ provider: s.provider, model: s.models[s.provider], apiKey: key })
      setTest({ kind: 'v-ok', text: `OK — model replied "${reply}"` })
    } catch (e) {
      setTest({ kind: 'v-wa', text: cleanError(e) })
    }
  }

  async function save() {
    try {
      await window.api.setSettings({ ...s, ...(key ? { apiKey: { provider: s.provider, value: key } } : {}) })
      window.close()
    } catch (e) {
      setError(cleanError(e))
    }
  }

  async function forgetKey() {
    setS(await window.api.setSettings({ apiKey: { provider: s.provider, value: '' } }))
  }

  return (
    <div className="settings">
      <div className="box">
        <div className="box-title">Settings</div>
        <div className="box-body">
          <table className="form">
            <tbody>
              <tr>
                <td>AI provider</td>
                <td>
                  <select value={s.provider} onChange={(e) => (set({ provider: e.target.value }), setKey(''), setTest(null))}>
                    {PROVIDERS.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.label}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
              <tr>
                <td>Model</td>
                <td>
                  <input className="long" value={s.models[s.provider]} onChange={(e) => setModel(e.target.value)} />
                </td>
              </tr>
              <tr>
                <td>API key</td>
                <td>
                  <input
                    className="long"
                    type="password"
                    disabled={s.provider === 'ollama'}
                    value={key}
                    placeholder={s.hasKey[s.provider] ? 'saved (leave blank to keep)' : ''}
                    onChange={(e) => setKey(e.target.value)}
                  />{' '}
                  <button onClick={runTest}>Test</button>
                  <div className="small muted">
                    {p.keyHint}
                    {s.hasKey[s.provider] && (
                      <>
                        {' · '}
                        <button className="link" onClick={forgetKey}>
                          forget saved key
                        </button>
                      </>
                    )}
                  </div>
                  {test && <div className={`small ${test.kind}`}>{test.text}</div>}
                </td>
              </tr>
              <tr className="divider">
                <td colSpan={2} />
              </tr>
              <tr>
                <td>Default tests</td>
                <td>
                  <input type="number" min="1" value={s.defaultTests} onChange={(e) => set({ defaultTests: Number(e.target.value) })} />
                </td>
              </tr>
              <tr>
                <td>Base timeout</td>
                <td>
                  <input type="number" min="0.1" step="0.5" value={s.baseTimeoutSec} onChange={(e) => set({ baseTimeoutSec: Number(e.target.value) })} /> s
                </td>
              </tr>
              <tr>
                <td>C++ flags</td>
                <td>
                  <input className="long mono" value={s.cppFlags} onChange={(e) => set({ cppFlags: e.target.value })} />
                </td>
              </tr>
            </tbody>
          </table>
          {error && <div className="small v-wa">{error}</div>}
          <div className="row-end">
            <button onClick={() => window.close()}>Cancel</button>
            <button className="primary" onClick={save}>
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
