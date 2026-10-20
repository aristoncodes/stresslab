// Spec language → random test input. Pure functions (no Electron/Node APIs) so
// it can be unit-tested with plain Node (scripts/gen-test.mjs).
//
// Grammar (one statement per line, `#` starts a comment):
//   x: int L..R                       integer (L, R may use earlier ints: 1..n-1)
//   a: array[n] int L..R              n integers
//   a: distinct[n] int L..R           n distinct integers
//   a: sorted[n] int L..R             n integers, non-decreasing
//   p: perm[n]                        permutation of 1..n
//   s: string[n] "a-z"                n chars from the set (ranges like a-z allowed)
//   g: grid[n][m] ".#"                n lines of m chars
//   e: tree n [weighted L..R]         n-1 edges "u v [w]"
//   e: graph n m [connected] [weighted L..R]   m edges of a simple graph
//   q: pairs[k] L..R                  k lines "l r" with L <= l <= r <= R
//   Any value range may add the problem's real bounds: `int -10..10 full -10^9..10^9`.
//   Random tests use L..R; the Edge and Max generators use the full range.
//   repeat t { ... }                  repeat the block t times (fresh variables each time)
//   print item item ...               items on one line, space separated (multi-line items keep their lines)
// Expressions: integers (also 2e5, 10^9), int variables, + - * / ^, parentheses, min(a, b), max(a, b).

export class SpecError extends Error {
  constructor(line, message) {
    super(`line ${line}: ${message}`)
    this.line = line
  }
}

// ---------- RNG ----------

export function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------- Tokenizer ----------

const TOKEN = /\s*(?:(\d+(?:e\d+)?)|([A-Za-z_]\w*)|("(?:[^"\\]|\\.)*")|(\.\.|[:[\]{}()+\-*/^,]))/y

function tokenize(text, line) {
  const tokens = []
  TOKEN.lastIndex = 0
  while (TOKEN.lastIndex < text.length) {
    if (/^\s*$/.test(text.slice(TOKEN.lastIndex))) break
    const start = TOKEN.lastIndex
    const m = TOKEN.exec(text)
    if (!m) throw new SpecError(line, `unexpected character "${text.slice(start).trim()[0]}"`)
    if (m[1]) tokens.push({ type: 'num', value: Number(m[1]) })
    else if (m[2]) tokens.push({ type: 'id', value: m[2] })
    else if (m[3]) tokens.push({ type: 'str', value: m[3].slice(1, -1).replace(/\\(.)/g, '$1') })
    else tokens.push({ type: 'op', value: m[4] })
  }
  return tokens
}

// ---------- Parser ----------

const TYPES = ['int', 'array', 'distinct', 'sorted', 'perm', 'string', 'grid', 'tree', 'graph', 'pairs']

// Recursive-descent over one line's tokens. `scope` maps declared names → kind.
class LineParser {
  constructor(tokens, line, scope) {
    this.t = tokens
    this.i = 0
    this.line = line
    this.scope = scope
  }
  peek(v) {
    const tok = this.t[this.i]
    return tok && (v === undefined || tok.value === v) ? tok : null
  }
  next() {
    return this.t[this.i++]
  }
  expect(v, what = `"${v}"`) {
    const tok = this.next()
    if (!tok || tok.value !== v) this.fail(`expected ${what}${tok ? `, found "${tok.value}"` : ''}`)
    return tok
  }
  fail(msg) {
    throw new SpecError(this.line, msg)
  }
  done() {
    if (this.i < this.t.length) this.fail(`unexpected "${this.t[this.i].value}"`)
  }

  // expr := term (('+'|'-') term)*
  expr() {
    let node = this.term()
    while (this.peek('+') || this.peek('-')) node = { op: this.next().value, a: node, b: this.term() }
    return node
  }
  term() {
    let node = this.power()
    while (this.peek('*') || this.peek('/')) node = { op: this.next().value, a: node, b: this.power() }
    return node
  }
  power() {
    const base = this.unary()
    return this.peek('^') ? (this.next(), { op: '^', a: base, b: this.power() }) : base
  }
  unary() {
    if (this.peek('-')) return this.next(), { op: 'neg', a: this.unary() }
    const tok = this.next()
    if (!tok) this.fail('expected a number or variable')
    if (tok.type === 'num') return { num: tok.value }
    if (tok.value === '(') {
      const e = this.expr()
      this.expect(')')
      return e
    }
    if (tok.type === 'id' && (tok.value === 'min' || tok.value === 'max') && this.peek('(')) {
      this.next()
      const args = [this.expr()]
      while (this.peek(',')) this.next(), args.push(this.expr())
      this.expect(')')
      return { fn: tok.value, args }
    }
    if (tok.type === 'id') {
      const kind = this.scope.get(tok.value)
      if (!kind) this.fail(`unknown variable "${tok.value}"`)
      if (kind !== 'int') this.fail(`"${tok.value}" is not an int and can't be used in an expression`)
      return { ref: tok.value }
    }
    this.fail(`unexpected "${tok.value}"`)
  }
  range() {
    const lo = this.expr()
    this.expect('..', '"L..R" range')
    return { lo, hi: this.expr() }
  }
  // L..R with optional `full A..B` (the problem's real bounds, used by Edge/Max tests).
  valueRange() {
    const r = this.range()
    if (this.peek('full')) {
      this.next()
      r.full = this.range()
    }
    return r
  }
  bracket() {
    this.expect('[')
    const e = this.expr()
    if (this.peek('..')) this.fail('sizes in [ ] must be one value; for a random size declare it first, e.g. "n: int 1..8" then use [n]')
    this.expect(']')
    return e
  }
  string() {
    const tok = this.next()
    if (!tok || tok.type !== 'str') this.fail('expected a quoted character set like "a-z"')
    const chars = expandChars(tok.value)
    if (!chars.length) this.fail('character set is empty')
    return chars
  }
  weighted() {
    if (!this.peek('weighted')) return null
    this.next()
    return this.valueRange()
  }

  declaration(name) {
    const type = this.next()
    if (!type || !TYPES.includes(type.value)) {
      this.fail(type ? `unknown type "${type.value}" (expected one of: ${TYPES.join(', ')})` : 'expected a type')
    }
    const d = { kind: type.value, name }
    switch (type.value) {
      case 'int':
        d.range = this.valueRange()
        break
      case 'array':
      case 'distinct':
      case 'sorted':
        d.len = this.bracket()
        if (this.peek('int')) this.next()
        d.range = this.valueRange()
        break
      case 'perm':
        d.len = this.bracket()
        break
      case 'string':
        d.len = this.bracket()
        d.chars = this.string()
        break
      case 'grid':
        d.rows = this.bracket()
        d.cols = this.bracket()
        d.chars = this.string()
        break
      case 'tree':
        d.n = this.expr()
        d.weight = this.weighted()
        break
      case 'graph':
        d.n = this.expr()
        d.m = this.expr()
        if (this.peek('connected')) d.connected = !!this.next()
        d.weight = this.weighted()
        break
      case 'pairs':
        d.len = this.bracket()
        d.range = this.valueRange()
        break
    }
    this.done()
    return d
  }

  print() {
    const items = []
    while (this.i < this.t.length) {
      const tok = this.peek()
      if (tok.type === 'str') items.push({ str: this.next().value })
      else if (tok.type === 'id' && this.scope.get(tok.value) && this.scope.get(tok.value) !== 'int') {
        items.push({ var: this.next().value })
      } else items.push({ expr: this.expr() })
    }
    if (!items.length) this.fail('print needs at least one item')
    return { kind: 'print', items }
  }
}

function expandChars(s) {
  let out = ''
  for (let i = 0; i < s.length; i++) {
    if (s[i + 1] === '-' && i + 2 < s.length) {
      for (let c = s.charCodeAt(i); c <= s.charCodeAt(i + 2); c++) out += String.fromCharCode(c)
      i += 2
    } else out += s[i]
  }
  return [...new Set(out)]
}

// Parse the whole spec into a list of statements. Throws SpecError.
export function parseSpec(text) {
  const root = []
  const stack = [{ body: root, scope: new Map(), line: 0 }]
  text.split('\n').forEach((raw, idx) => {
    const line = idx + 1
    // Strip `# comments`, but not a # inside a quoted char set like ".#".
    const src = raw.replace(/("(?:[^"\\]|\\.)*")|#.*/g, (m, quoted) => quoted ?? '')
    const tokens = tokenize(src, line)
    if (!tokens.length) return
    const top = stack[stack.length - 1]
    const p = new LineParser(tokens, line, top.scope)
    const first = tokens[0]

    if (first.value === '}') {
      if (stack.length === 1) p.fail('"}" without matching "repeat"')
      p.next()
      p.done()
      stack.pop()
    } else if (first.value === 'repeat') {
      p.next()
      const count = p.expr()
      p.expect('{', '"{" at the end of the repeat line')
      p.done()
      const block = { kind: 'repeat', count, body: [], line }
      top.body.push(block)
      stack.push({ body: block.body, scope: new Map(top.scope), line })
    } else if (first.value === 'print') {
      p.next()
      top.body.push({ ...p.print(), line })
    } else if (first.type === 'id' && tokens[1]?.value === ':') {
      p.i = 2
      if (TYPES.includes(first.value) || ['print', 'repeat'].includes(first.value)) {
        p.fail(`"${first.value}" is a keyword and can't be a variable name`)
      }
      const d = p.declaration(first.value)
      top.body.push({ ...d, line })
      top.scope.set(first.value, d.kind)
    } else {
      p.fail(`expected "name: type ...", "print ..." or "repeat ... {", found "${first.value}"`)
    }
  })
  if (stack.length > 1) throw new SpecError(stack[stack.length - 1].line, 'repeat block is missing "}"')
  if (!root.some(function hasPrint(s) { return s.kind === 'print' || (s.kind === 'repeat' && s.body.some(hasPrint)) })) {
    throw new SpecError(1, 'spec never prints anything (add a "print" line)')
  }
  return root
}

// Value of a constant expression like "2*10^5" or "1e9"; null if it isn't one.
export function constValue(text) {
  try {
    const p = new LineParser(tokenize(String(text), 1), 1, new Map())
    const e = p.expr()
    p.done()
    return evalExpr(e, {}, 1)
  } catch {
    return null
  }
}

// Value of a parsed constant expression (no variables); null otherwise.
export function constOf(e) {
  try {
    return e ? evalExpr(e, {}, 1) : null
  } catch {
    return null
  }
}

// All declarations in a parsed spec (including inside repeat blocks), by name.
export function declarations(ast, out = {}) {
  for (const s of ast) {
    if (s.kind === 'repeat') declarations(s.body, out)
    else if (s.kind !== 'print') out[s.name] = s
  }
  return out
}

export function validateSpec(text) {
  try {
    parseSpec(text)
    return { ok: true }
  } catch (e) {
    if (e instanceof SpecError) return { ok: false, line: e.line, message: e.message }
    throw e
  }
}

// ---------- Generator ----------

const MAX_OUTPUT = 1_000_000 // characters; protects the app from runaway specs
const MAX_ITEMS = 200_000

// Small-first growth: sizes start at their minimum and reach the spec maximum after
// `ramp` tests (≈ first quarter of the run, between 10 and 100 tests).
export function sizeScale(test, tests) {
  const ramp = Math.min(100, Math.max(10, Math.floor(tests / 4)))
  return Math.min(1, (test - 1) / ramp)
}

// Test generators ("profiles"). A run cycles through the enabled ones by test number.
//   random  — small random tests that grow (small-first)
//   edge    — minimum sizes, values at the extremes of the full range (min, max, min+1, max-1, 0)
//   max     — maximum independent sizes, values mostly at the full range's limits: catches overflow
//             (sizes that depend on others, e.g. k: 1..min(n,m), and string contents stay random,
//             so results don't collapse to one uniform case)
//   pattern — all-equal / sorted / reversed / alternating arrays, path/star trees, uniform strings
export const PROFILES = ['random', 'edge', 'max', 'pattern']
export const profileFor = (test, profiles = PROFILES) => profiles[(test - 1) % profiles.length]

// `env` maps int variable names to values. Throws SpecError for unknown values.
function evalExpr(e, env, line) {
  if (e.num !== undefined) return e.num
  if (e.fn) return Math[e.fn](...e.args.map((a) => evalExpr(a, env, line)))
  if (e.ref) {
    if (env[e.ref] === undefined) throw new SpecError(line, `"${e.ref}" has no value yet`)
    return env[e.ref]
  }
  const a = evalExpr(e.a, env, line)
  if (e.op === 'neg') return -a
  const b = evalExpr(e.b, env, line)
  switch (e.op) {
    case '+': return a + b
    case '-': return a - b
    case '*': return a * b
    case '/':
      if (b === 0) throw new SpecError(line, 'division by zero')
      return Math.trunc(a / b)
    case '^': return a ** b
  }
}

// Does an expression (or range) reference any variable?
function usesVars(e) {
  if (!e || typeof e !== 'object') return false
  if (e.ref) return true
  return [e.a, e.b, e.lo, e.hi, ...(e.args ?? [])].some(usesVars)
}

class Gen {
  constructor(seed, scale, profile = 'random') {
    this.rnd = mulberry32(seed)
    this.scale = scale
    this.profile = profile
    this.out = []
    this.size = 0
    this.lines = 0 // output lines so far
    this.cases = [] // line ranges of each top-level repeat iteration (multi-test inputs)
  }
  int(lo, hi) {
    return lo + Math.floor(this.rnd() * (hi - lo + 1))
  }
  shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.int(0, i)
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }
  eval(e, env, line) {
    return evalExpr(e, env, line)
  }
  range(r, env, line) {
    const lo = this.eval(r.lo, env, line)
    const hi = this.eval(r.hi, env, line)
    if (lo > hi) throw new SpecError(line, `empty range ${lo}..${hi}`)
    return [lo, hi]
  }
  // Value range for this profile: Edge/Max use the problem's full bounds when given.
  vrange(r, env, line) {
    const useFull = r.full && (this.profile === 'edge' || this.profile === 'max')
    return this.range(useFull ? r.full : r, env, line)
  }
  // One value from [lo, hi], biased by profile.
  pick(lo, hi) {
    if (this.profile === 'max') {
      const r = this.rnd()
      return r < 0.6 ? hi : r < 0.75 ? lo : this.int(lo, hi) // mostly the limit, some spread
    }
    if (this.profile === 'edge') {
      const c = [lo, hi, lo + 1, hi - 1, 0].filter((x) => x >= lo && x <= hi)
      return c[this.int(0, c.length - 1)]
    }
    return this.int(lo, hi)
  }
  // Size-like int (no `full`, non-negative): depends on the profile.
  // `dependent`: its bounds use other variables (e.g. k: 1..min(n,m)) → random in Max.
  sizeValue(lo, hi, dependent) {
    if (this.profile === 'edge') return lo
    if (this.profile === 'max') return dependent ? this.int(lo, hi) : hi
    if (this.profile === 'pattern') return this.int(lo, hi)
    return this.int(lo, lo + Math.round((hi - lo) * this.scale)) // random: grows over the run
  }
  // Rearrange an array for the Pattern profile.
  shape(a, lo, hi) {
    switch (this.int(0, 3)) {
      case 0: return a.fill(a.length ? a[0] : 0) // all equal
      case 1: return a.sort((x, y) => x - y)
      case 2: return a.sort((x, y) => y - x)
      default: return a.map((_, i) => (i % 2 ? lo : hi)) // alternating extremes
    }
  }
  count(e, env, line, what) {
    const n = this.eval(e, env, line)
    if (n < 0) throw new SpecError(line, `${what} is negative (${n})`)
    if (n > MAX_ITEMS) throw new SpecError(line, `${what} ${n} is too large for stress testing`)
    return n
  }
  edges(n, pairs, weight, env, line) {
    const label = this.shuffle(Array.from({ length: n }, (_, i) => i + 1))
    const w = weight ? this.vrange(weight, env, line) : null
    return this.shuffle(pairs).map(([u, v]) => {
      if (this.rnd() < 0.5) [u, v] = [v, u]
      return [label[u], label[v], ...(w ? [this.pick(w[0], w[1])] : [])].join(' ')
    })
  }
  // Tree parent for node v (nodes 0..n-1): path for Edge/Max, path or star for Pattern.
  treeShape() {
    if (this.profile === 'edge' || this.profile === 'max') return 'path'
    if (this.profile === 'pattern') return this.rnd() < 0.5 ? 'path' : 'star'
    return 'random'
  }
  parent(v, shape) {
    return shape === 'path' ? v - 1 : shape === 'star' ? 0 : this.int(0, v - 1)
  }

  value(d, env) {
    const { line } = d
    const p = this.profile
    switch (d.kind) {
      case 'int': {
        const [lo, hi] = this.vrange(d.range, env, line)
        // Without `full`, a non-negative int is treated as a size/count.
        return !d.range.full && lo >= 0 ? this.sizeValue(lo, hi, usesVars(d.range)) : this.pick(lo, hi)
      }
      case 'array':
      case 'sorted': {
        const n = this.count(d.len, env, line, 'array length')
        const [lo, hi] = this.vrange(d.range, env, line)
        let a = Array.from({ length: n }, () => this.pick(lo, hi))
        if (p === 'pattern') a = this.shape(a, lo, hi)
        return d.kind === 'sorted' ? a.sort((x, y) => x - y) : a
      }
      case 'distinct': {
        const n = this.count(d.len, env, line, 'array length')
        const [lo, hi] = this.vrange(d.range, env, line)
        if (hi - lo + 1 < n) throw new SpecError(line, `can't pick ${n} distinct values from ${lo}..${hi}`)
        if (p === 'max') return Array.from({ length: n }, (_, i) => hi - i) // largest values
        if (p === 'edge') return Array.from({ length: n }, (_, i) => (i % 2 ? hi - (i >> 1) : lo + (i >> 1))) // both ends
        const seen = new Set()
        while (seen.size < n) seen.add(this.int(lo, hi))
        const a = [...seen]
        return p === 'pattern' ? a.sort((x, y) => (this.rnd() < 0.5 ? x - y : y - x)) : this.shuffle(a)
      }
      case 'perm': {
        const a = Array.from({ length: this.count(d.len, env, line, 'perm length') }, (_, i) => i + 1)
        if (p === 'edge') return a // identity
        if (p === 'max') return a.reverse()
        if (p === 'pattern') return this.rnd() < 0.5 ? a : a.reverse()
        return this.shuffle(a)
      }
      case 'string': {
        const n = this.count(d.len, env, line, 'string length')
        const { chars } = d
        const last = chars.length - 1
        if (p === 'edge') return chars[this.int(0, last)].repeat(n)
        if (p === 'pattern') return Array.from({ length: n }, (_, i) => chars[i % 2 ? last : 0]).join('')
        return Array.from({ length: n }, () => chars[this.int(0, last)]).join('')
      }
      case 'grid': {
        const r = this.count(d.rows, env, line, 'grid rows')
        const c = this.count(d.cols, env, line, 'grid columns')
        const { chars } = d
        const last = chars.length - 1
        const cell = (i, j) => (p === 'edge' ? chars[0] : p === 'pattern' ? chars[(i + j) % 2 ? last : 0] : chars[this.int(0, last)])
        return Array.from({ length: r }, (_, i) => Array.from({ length: c }, (_, j) => cell(i, j)).join(''))
      }
      case 'tree': {
        const n = this.count(d.n, env, line, 'tree size')
        if (n < 1) throw new SpecError(line, 'tree needs at least 1 node')
        const shape = this.treeShape()
        const pairs = []
        for (let v = 1; v < n; v++) pairs.push([this.parent(v, shape), v])
        return this.edges(n, pairs, d.weight, env, line)
      }
      case 'graph': {
        const n = this.count(d.n, env, line, 'graph size')
        const maxM = (n * (n - 1)) / 2
        let m = this.count(d.m, env, line, 'edge count')
        // Clamp to what's possible rather than failing mid-run.
        m = Math.min(m, maxM)
        if (d.connected) m = Math.max(m, n - 1)
        const key = (u, v) => (u < v ? u * n + v : v * n + u)
        const used = new Set()
        const pairs = []
        const add = (u, v) => {
          if (u === v || used.has(key(u, v))) return false
          used.add(key(u, v))
          pairs.push([u, v])
          return true
        }
        const shape = this.treeShape()
        if (d.connected) for (let v = 1; v < n; v++) add(this.parent(v, shape), v)
        while (pairs.length < m) add(this.int(0, n - 1), this.int(0, n - 1))
        return this.edges(n, pairs, d.weight, env, line)
      }
      case 'pairs': {
        const k = this.count(d.len, env, line, 'pair count')
        const [lo, hi] = this.vrange(d.range, env, line)
        return Array.from({ length: k }, () => {
          if (p === 'max') return `${lo} ${hi}` // widest range
          const a = this.pick(lo, hi)
          const b = p === 'edge' ? a : this.pick(lo, hi) // edge: l == r
          return `${Math.min(a, b)} ${Math.max(a, b)}`
        })
      }
    }
  }

  run(stmts, env, depth = 0) {
    for (const s of stmts) {
      if (s.kind === 'print') {
        const parts = s.items.map((it) => {
          if (it.str !== undefined) return it.str
          if (it.expr) return String(this.eval(it.expr, env, s.line))
          const v = env[it.var]
          if (!Array.isArray(v)) return String(v) // string
          // Edge/pair/grid lists are one entry per line; number arrays are space separated.
          return v.join(typeof v[0] === 'string' ? '\n' : ' ')
        })
        const text = parts.join(' ') + '\n'
        this.size += text.length
        if (this.size > MAX_OUTPUT) throw new SpecError(s.line, 'generated input is larger than 1 MB')
        this.out.push(text)
        this.lines += text.split('\n').length - 1
      } else if (s.kind === 'repeat') {
        const t = this.count(s.count, env, s.line, 'repeat count')
        for (let k = 0; k < t; k++) {
          const start = this.lines + 1
          this.run(s.body, Object.create(env), depth + 1)
          if (depth === 0) this.cases.push({ start, end: this.lines })
        }
      } else {
        env[s.name] = this.value(s, env)
      }
    }
  }
}

// Generate one test. `test` is 1-based; `tests` the planned total; `profile` one of PROFILES.
// Returns { input, cases }: cases are the 1-based input line ranges of each
// top-level `repeat` iteration, used to point at the failing test case.
export function generateTest(ast, { seed, test = 1, tests = 1, profile = 'random' }) {
  const g = new Gen(seed, sizeScale(test, tests), profile)
  g.run(ast, {})
  return { input: g.out.join(''), cases: g.cases }
}

export const generateInput = (ast, opts) => generateTest(ast, opts).input


// ---------- Sample matcher ----------
// Checks that a sample input from the problem statement has the structure the
// spec describes (counts, lengths, character sets, sortedness…), reading values
// in `print` order. Value ranges are NOT checked: specs shrink them on purpose.

class MatchError extends Error {}

function sampleTokens(text) {
  return text.split('\n').flatMap((line, i) =>
    line.trim().split(/\s+/).filter(Boolean).map((t) => ({ t, line: i + 1 }))
  )
}

class Matcher {
  constructor(text) {
    this.toks = sampleTokens(text)
    this.pos = 0
  }
  fail(msg) {
    throw new MatchError(msg)
  }
  take(what) {
    if (this.pos >= this.toks.length) this.fail(`the sample ended, but the spec expects ${what}`)
    return this.toks[this.pos++]
  }
  int(what) {
    const tok = this.take(what)
    if (!/^[+-]?\d+$/.test(tok.t)) this.fail(`sample line ${tok.line}: expected an integer for ${what}, found "${tok.t}"`)
    return Number(tok.t)
  }
  ints(count, what) {
    return Array.from({ length: count }, (_, i) => this.int(`${what} (item ${i + 1} of ${count})`))
  }
  word(what, len, chars) {
    const tok = this.take(what)
    if (len !== undefined && tok.t.length !== len) {
      this.fail(`sample line ${tok.line}: ${what} should have length ${len}, found "${tok.t}" (length ${tok.t.length})`)
    }
    const bad = [...tok.t].find((c) => !chars.includes(c))
    if (bad) this.fail(`sample line ${tok.line}: ${what} uses "${bad}", which is not in the spec's character set "${chars.join('')}"`)
  }
  size(e, env, line, what) {
    try {
      return evalExpr(e, env, line)
    } catch {
      this.fail(`spec line ${line}: the size of ${what} depends on a variable that isn't printed before it`)
    }
  }

  // A size that is a plain variable never printed before (e.g. |s| in "the only
  // line contains s"). Returns its name so the caller can infer it from the sample.
  unprinted(e, env) {
    return e.ref && env[e.ref] === undefined ? e.ref : null
  }
  // Tokens left on the line of the next token (for arrays whose length isn't printed).
  restOfLine() {
    const line = this.toks[this.pos]?.line
    let k = this.pos
    while (k < this.toks.length && this.toks[k].line === line) k++
    return k - this.pos
  }

  // Read one printed variable according to its declaration.
  readVar(d, env) {
    const { line, name } = d
    const n = (e, what) => this.size(e, env, line, what)
    const lenVar = d.len && this.unprinted(d.len, env)
    if (lenVar && d.kind === 'string') {
      const tok = this.toks[this.pos]
      env[lenVar] = tok ? tok.t.length : 0
    } else if (lenVar && ['array', 'sorted', 'distinct', 'perm'].includes(d.kind)) {
      env[lenVar] = this.restOfLine()
    }
    switch (d.kind) {
      case 'array':
      case 'sorted':
      case 'distinct':
      case 'perm': {
        const len = n(d.len, name)
        const a = this.ints(len, name)
        if (d.kind === 'sorted' && a.some((x, i) => i && a[i - 1] > x)) this.fail(`${name} is declared sorted, but the sample's values are not sorted`)
        if (d.kind === 'distinct' && new Set(a).size !== a.length) this.fail(`${name} is declared distinct, but the sample has repeated values`)
        if (d.kind === 'perm' && [...a].sort((x, y) => x - y).some((x, i) => x !== i + 1)) this.fail(`${name} is declared perm[${len}], but the sample's values are not a permutation of 1..${len}`)
        return
      }
      case 'string':
        return this.word(name, n(d.len, name), d.chars)
      case 'grid': {
        const rows = n(d.rows, name)
        const cols = n(d.cols, name)
        for (let r = 0; r < rows; r++) this.word(`row ${r + 1} of ${name}`, cols, d.chars)
        return
      }
      case 'tree':
      case 'graph': {
        const nodes = n(d.n, name)
        const edges = d.kind === 'tree' ? nodes - 1 : n(d.m, name)
        const per = d.weight ? 3 : 2
        for (let k = 0; k < edges; k++) this.ints(per, `edge ${k + 1} of ${name}`)
        return
      }
      case 'pairs': {
        const k = n(d.len, name)
        for (let i = 0; i < k; i++) this.ints(2, `pair ${i + 1} of ${name}`)
        return
      }
    }
  }

  // Specs may shrink a size's maximum but not its minimum, and values must fit
  // their `full` (real) range. Bounds that can't be evaluated yet are skipped.
  checkBounds(d, env) {
    if (d?.kind !== 'int') return
    const v = env[d.name]
    const where = `sample line ${this.toks[this.pos - 1].line}`
    const bound = (e) => {
      try {
        return evalExpr(e, env, d.line)
      } catch {
        return undefined
      }
    }
    if (d.range.full) {
      const [lo, hi] = [bound(d.range.full.lo), bound(d.range.full.hi)]
      if ((lo !== undefined && v < lo) || (hi !== undefined && v > hi)) this.fail(`${where}: ${d.name} = ${v} is outside its full range ${lo}..${hi}`)
      return
    }
    const lo = bound(d.range.lo)
    if (lo !== undefined && lo >= 0 && v < lo) {
      this.fail(`${where}: ${d.name} = ${v} is below the spec's minimum ${lo} (shrink the maximum of a size, never its minimum)`)
    }
  }

  run(stmts, env, decls) {
    for (const s of stmts) {
      if (s.kind === 'repeat') {
        const t = this.size(s.count, env, s.line, 'the repeat count')
        for (let k = 0; k < t; k++) this.run(s.body, Object.create(env), Object.create(decls))
      } else if (s.kind === 'print') {
        for (const it of s.items) {
          if (it.str !== undefined) it.str.split(/\s+/).filter(Boolean).forEach(() => this.take(`"${it.str}"`))
          else if (it.var) this.readVar(decls[it.var], env)
          else if (it.expr.ref && env[it.expr.ref] === undefined) {
            env[it.expr.ref] = this.int(it.expr.ref) // first print binds an int
            this.checkBounds(decls[it.expr.ref], env)
          }
          else if (it.expr.ref) {
            // Printed again (or inferred earlier from a length): values must agree.
            const v = this.int(it.expr.ref)
            if (v !== env[it.expr.ref]) this.fail(`sample line ${this.toks[this.pos - 1].line}: ${it.expr.ref} is ${v} here but ${env[it.expr.ref]} earlier`)
          } else this.int(`the value on spec line ${s.line}`)
        }
      } else {
        decls[s.name] = s
      }
    }
  }
}

// Returns { ok: true } or { ok: false, message }.
export function matchSample(ast, sampleInput) {
  const m = new Matcher(sampleInput)
  try {
    m.run(ast, {}, {})
    if (m.pos < m.toks.length) {
      const tok = m.toks[m.pos]
      return { ok: false, message: `sample line ${tok.line} has extra data ("${tok.t}") that the spec never prints` }
    }
    return { ok: true }
  } catch (e) {
    if (e instanceof MatchError) return { ok: false, message: e.message }
    throw e
  }
}
