import { useEffect, useMemo, useRef, useState } from 'react'
import { fuzzyFilter } from '../../lib/fuzzy'

// Sublime's quick panel: filter box + fuzzy list at the top of the window.
// items: [{ label, detail?, hint? }]; onPick(item); onPreview(item) while
// arrowing (Goto Anything previews files); filter(query) lets the caller
// interpret prefixes like "@" or ":" and return its own items (bump `nonce` when
// its data arrives later). freeText: Enter submits the typed text (onPick(null, text)).
export default function QuickPanel({ placeholder, items, onPick, onPreview, onClose, initial = '', filter, nonce, freeText }) {
  const [query, setQuery] = useState(initial)
  const [index, setIndex] = useState(0)
  const listRef = useRef(null)

  const results = useMemo(() => {
    if (filter) return filter(query)
    return fuzzyFilter(items ?? [], query, (it) => it.label)
  }, [items, query, filter, nonce]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => setIndex(0), [query])
  useEffect(() => {
    const it = results[index]?.item
    if (it) onPreview?.(it, query)
    listRef.current?.children[index]?.scrollIntoView({ block: 'nearest' })
  }, [index, results]) // eslint-disable-line react-hooks/exhaustive-deps

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') setIndex((i) => Math.min(i + 1, results.length - 1))
    else if (e.key === 'ArrowUp') setIndex((i) => Math.max(i - 1, 0))
    else if (e.key === 'PageDown') setIndex((i) => Math.min(i + 10, results.length - 1))
    else if (e.key === 'PageUp') setIndex((i) => Math.max(i - 10, 0))
    else if (e.key === 'Enter') {
      const it = results[index]?.item
      if (it || freeText) onPick(it ?? null, query)
    } else if (e.key === 'Escape') onClose()
    else return
    e.preventDefault()
  }

  const highlight = (text, hits) => {
    if (!hits?.length) return text
    const set = new Set(hits)
    return [...text].map((c, i) => (set.has(i) ? <b key={i}>{c}</b> : c))
  }

  return (
    <div className="quick-backdrop" onMouseDown={onClose}>
      <div className="quick-panel" onMouseDown={(e) => e.stopPropagation()}>
        <input autoFocus className="quick-input" placeholder={placeholder} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onKeyDown} spellCheck={false} />
        <div className="quick-list" ref={listRef}>
          {results.map((r, i) => (
            <div key={r.item.key ?? r.item.label + i} className={`quick-item ${i === index ? 'active' : ''}`} onMouseEnter={() => setIndex(i)} onClick={() => onPick(r.item, query)}>
              <div className="quick-main">
                <span className="quick-label">{highlight(r.item.label, r.hits)}</span>
                {r.item.hint && <span className="quick-hint">{r.item.hint}</span>}
              </div>
              {r.item.detail && <div className="quick-detail">{r.item.detail}</div>}
            </div>
          ))}
          {!results.length && <div className="quick-empty">{freeText ? 'Press Enter to confirm' : 'No matches'}</div>}
        </div>
      </div>
    </div>
  )
}
