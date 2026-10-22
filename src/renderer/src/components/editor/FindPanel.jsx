import { useState } from 'react'

// Sublime's Find in Files panel (⌘⇧F): Find / Where / Replace, toggles for
// regex (.*), case (Aa) and whole word (“”), then a results list grouped by file.
export default function FindPanel({ initial, state, onSearch, onReplace, onOpen, onClose, activeIndex }) {
  const [opts, setOpts] = useState(() => ({ query: initial ?? '', where: '', replacement: '', regex: false, caseSensitive: false, wholeWord: false, ...state?.opts, ...(initial ? { query: initial } : {}) }))
  const set = (patch) => setOpts((o) => ({ ...o, ...patch }))
  const toggle = (k, label, title) => (
    <button className={`find-toggle ${opts[k] ? 'on' : ''}`} title={title} onClick={() => set({ [k]: !opts[k] })}>
      {label}
    </button>
  )
  const onKey = (e) => {
    if (e.key === 'Enter') onSearch(opts)
    if (e.key === 'Escape') onClose()
  }

  // Group results by file, keeping the global index for F4 navigation.
  const groups = []
  state?.results?.forEach((r, i) => {
    const last = groups[groups.length - 1]
    if (last?.path === r.path) last.items.push({ r, i })
    else groups.push({ path: r.path, items: [{ r, i }] })
  })

  return (
    <div className="find-panel">
      <div className="find-form" onKeyDown={onKey}>
        <div className="find-toggles">
          {toggle('regex', '.*', 'Regular expression')}
          {toggle('caseSensitive', 'Aa', 'Case sensitive')}
          {toggle('wholeWord', '“”', 'Whole word')}
        </div>
        <label>
          <span>Find:</span>
          <input autoFocus value={opts.query} onChange={(e) => set({ query: e.target.value })} spellCheck={false} />
        </label>
        <label>
          <span>Where:</span>
          <input value={opts.where} placeholder="e.g. *.cpp, -tests/" onChange={(e) => set({ where: e.target.value })} spellCheck={false} />
        </label>
        <label>
          <span>Replace:</span>
          <input value={opts.replacement} onChange={(e) => set({ replacement: e.target.value })} spellCheck={false} />
        </label>
        <div className="find-buttons">
          <button onClick={() => onSearch(opts)}>Find</button>
          <button onClick={() => onReplace(opts)}>Replace</button>
          <button className="find-close" onClick={onClose} title="Close (Esc)">
            ×
          </button>
        </div>
      </div>
      <div className="find-results">
        {state?.busy && <div className="find-summary">Searching…</div>}
        {state?.error && <div className="find-summary error">{state.error}</div>}
        {state?.summary && <div className="find-summary">{state.summary}</div>}
        {groups.map((g) => (
          <div key={g.path} className="find-file">
            <div className="find-file-name">{g.path}:</div>
            {g.items.map(({ r, i }) => (
              <div key={i} className={`find-line ${i === activeIndex ? 'active' : ''}`} onClick={() => onOpen(r, i)}>
                <span className="find-ln">{String(r.line).padStart(5)}:</span>
                <span className="find-text">
                  {r.text.slice(0, r.col - 1)}
                  <mark>{r.text.slice(r.col - 1, r.col - 1 + r.length)}</mark>
                  {r.text.slice(r.col - 1 + r.length)}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
