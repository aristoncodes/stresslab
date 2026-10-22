// Symbols for Goto Symbol / Goto Definition, found with per-language patterns
// (Sublime's symbol list is also pattern-based, not a compiler).

const CONTROL = /^(if|for|while|switch|return|else|catch|do|sizeof|case|new|delete)$/

const C_LIKE_FUNC = /^\s*(?:template\s*<[^>]*>\s*)?(?:[\w:<>,*&~\s]+?\s+[*&]*)?((?:\w+::)*~?[A-Za-z_]\w*)\s*\([^;{}]*\)\s*(?:const\s*)?(?:noexcept\s*)?(?:->\s*[\w:<>]+\s*)?\{?\s*(?:\/\/.*)?$/
const PATTERNS = {
  cpp: [
    { re: /^\s*(?:struct|class|union|enum(?:\s+class)?)\s+([A-Za-z_]\w*)/, kind: 'type' },
    { re: /^\s*#\s*define\s+([A-Za-z_]\w*)/, kind: 'macro' },
    { re: /^\s*(?:using|typedef)\s+.*?\b([A-Za-z_]\w*)\s*(?:=|;)/, kind: 'type' },
    { re: C_LIKE_FUNC, kind: 'function' }
  ],
  java: [
    { re: /^\s*(?:public\s+|private\s+|protected\s+|static\s+|final\s+|abstract\s+)*(?:class|interface|enum|record)\s+([A-Za-z_]\w*)/, kind: 'type' },
    { re: /^\s*(?:public\s+|private\s+|protected\s+|static\s+|final\s+|synchronized\s+|abstract\s+)*[\w<>[\],\s]+?\s+([A-Za-z_]\w*)\s*\([^;]*\)\s*(?:throws\s+[\w.,\s]+)?\{?\s*$/, kind: 'function' }
  ],
  python: [
    { re: /^\s*class\s+([A-Za-z_]\w*)/, kind: 'type' },
    { re: /^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)/, kind: 'function' }
  ]
}
PATTERNS.c = PATTERNS.cpp
PATTERNS.javascript = [
  { re: /^\s*(?:export\s+)?(?:default\s+)?class\s+([A-Za-z_$][\w$]*)/, kind: 'type' },
  { re: /^\s*(?:export\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/, kind: 'function' },
  { re: /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/, kind: 'function' }
]

// [{ name, line, kind, text }] for source text in `lang` (Monaco language id).
export function findSymbols(text, lang) {
  const pats = PATTERNS[lang]
  if (!pats) return []
  const out = []
  text.split('\n').forEach((raw, i) => {
    const line = raw.replace(/\r$/, '')
    if (/^\s*(\/\/|#(?!\s*define)|\*|\/\*)/.test(line) && !/^\s*#\s*define/.test(line)) return // comments
    for (const p of pats) {
      const m = p.re.exec(line)
      if (!m) continue
      const name = m[1]
      if (CONTROL.test(name.split('::').pop())) continue
      out.push({ name, line: i + 1, kind: p.kind, text: line.trim() })
      break
    }
  })
  return out
}
