// Sublime-style fuzzy matching: every query character must appear in order.
// Returns { score, hits } (indices of matched characters) or null.
export function fuzzyMatch(query, text) {
  if (!query) return { score: 0, hits: [] }
  const q = query.toLowerCase()
  const t = text.toLowerCase()
  const hits = []
  let score = 0
  let ti = 0
  let prev = -2
  for (const ch of q) {
    const i = t.indexOf(ch, ti)
    if (i < 0) return null
    hits.push(i)
    // Reward consecutive characters and matches at word starts / after separators.
    if (i === prev + 1) score += 5
    if (i === 0 || /[\s/_.\-:]/.test(text[i - 1]) || (text[i] !== t[i] && text[i - 1] === t[i - 1])) score += 8
    score -= (i - ti) * 0.1
    prev = i
    ti = i + 1
  }
  score -= text.length * 0.01 // shorter candidates win ties
  return { score, hits }
}

// Filter and sort items by fuzzy score on key(item).
export function fuzzyFilter(items, query, key = (x) => x, limit = 200) {
  const out = []
  for (const item of items) {
    const m = fuzzyMatch(query, key(item))
    if (m) out.push({ item, ...m })
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit)
}
