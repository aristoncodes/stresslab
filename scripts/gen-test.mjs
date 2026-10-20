// Spec generator tests: `npm run gen-test`
import { parseSpec, validateSpec, generateInput, generateTest, matchSample, PROFILES, profileFor } from '../src/main/generator.js'
import { EXAMPLES } from '../src/main/llm.js'
import { readFileSync } from 'fs'

let failures = 0
function check(name, cond, detail = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)
  if (!cond) failures++
}
const gen = (spec, seed = 1, test = 1000, tests = 1000) => generateInput(parseSpec(spec), { seed, test, tests })
const errorOf = (spec) => validateSpec(spec).message

// --- Parsing / errors ---
check('valid array spec', validateSpec('n: int 1..8\na: array[n] int -10..10\nprint n\nprint a').ok)
check('unknown type has line number', errorOf('n: int 1..8\na: arr[n] int 1..5\nprint a').startsWith('line 2: unknown type "arr"'))
check('unknown variable', errorOf('a: array[n] int 1..5\nprint a') === 'line 1: unknown variable "n"')
check('missing range', errorOf('n: int 5\nprint n').startsWith('line 1: expected "L..R"'))
check('unclosed repeat', errorOf('t: int 1..2\nrepeat t {\nprint t').includes('missing "}"'))
check('stray brace', errorOf('}').includes('without matching'))
check('no print', errorOf('n: int 1..3').includes('never prints'))
check('array var in expression', errorOf('n: int 1..3\na: array[n] int 1..2\nb: array[a] int 1..2\nprint b').includes('not an int'))
check('range inside [ ] explains the fix', errorOf('s: string[1..8] "a-z"\nprint s').includes('declare it first'))
check('comments ignored', validateSpec('# hello\nn: int 1..3  # size\nprint n').ok)

// --- Generation ---
const arr = gen('n: int 1..8\na: array[n] int -10..10\nprint n\nprint a')
const [nLine, aLine] = arr.trim().split('\n')
check('array length matches n', aLine.split(' ').length === Number(nLine), JSON.stringify(arr))
check('deterministic for a seed', gen('n: int 1..100\nprint n', 7) === gen('n: int 1..100\nprint n', 7))
check('different seeds differ', new Set([1, 2, 3, 4, 5].map((s) => gen('n: int 1..1000000\nprint n', s))).size > 1)

// Small-first: test 1 uses the minimum size, later tests reach larger sizes.
const firstN = [1, 2, 3].map((seed) => Number(gen('n: int 1..8\nprint n', seed, 1, 1000)))
check('test 1 is minimal', firstN.every((n) => n === 1), String(firstN))
const lateMax = Math.max(...Array.from({ length: 50 }, (_, s) => Number(gen('n: int 1..8\nprint n', s, 900, 1000))))
check('late tests reach max', lateMax === 8)
check('negative ranges not scaled', new Set(Array.from({ length: 30 }, (_, s) => gen('x: int -5..5\nprint x', s, 1))).size > 3)

const d = gen('a: distinct[6] int 1..6\nprint a').trim().split(' ').map(Number)
check('distinct is a set', new Set(d).size === 6)
const so = gen('a: sorted[8] int -9..9\nprint a').trim().split(' ').map(Number)
check('sorted is non-decreasing', so.every((x, i) => i === 0 || so[i - 1] <= x))
const p = gen('p: perm[7]\nprint p').trim().split(' ').map(Number).sort()
check('perm is 1..n', p.join() === '1,2,3,4,5,6,7')
check('string charset', /^[ab]{5}$/.test(gen('s: string[5] "ab"\nprint s').trim()))
check('char range a-c', /^[a-c]{20}$/.test(gen('s: string[20] "a-c"\nprint s').trim()))
check('grid shape', gen('g: grid[3][4] ".#"\nprint g').trim().split('\n').every((r) => /^[.#]{4}$/.test(r)))

function connected(n, edges) {
  const adj = Array.from({ length: n + 1 }, () => [])
  for (const [u, v] of edges) adj[u].push(v), adj[v].push(u)
  const seen = new Set([1])
  const st = [1]
  while (st.length) for (const w of adj[st.pop()]) if (!seen.has(w)) seen.add(w), st.push(w)
  return seen.size === n
}
const tree = gen('n: int 8..8\ne: tree n weighted 1..9\nprint n\nprint e').trim().split('\n')
const tEdges = tree.slice(1).map((l) => l.split(' ').map(Number))
check('tree has n-1 weighted edges', tEdges.length === 7 && tEdges.every((e) => e.length === 3 && e[2] >= 1 && e[2] <= 9))
check('tree is connected', connected(8, tEdges))
const g = gen('g: graph 6 3 connected\nprint g').trim().split('\n').map((l) => l.split(' ').map(Number))
check('connected graph clamps m to n-1', g.length === 5 && connected(6, g))
const simple = gen('g: graph 4 100\nprint g').trim().split('\n')
check('graph clamps m to n(n-1)/2', simple.length === 6 && new Set(simple.map((l) => l.split(' ').sort().join())).size === 6)
const pairs = gen('q: pairs[5] 1..4\nprint q').trim().split('\n').map((l) => l.split(' ').map(Number))
check('pairs l <= r', pairs.length === 5 && pairs.every(([l, r]) => 1 <= l && l <= r && r <= 4))

const multi = gen('t: int 3..3\nprint t\nrepeat t {\n  n: int 2..2\n  s: string[n] "xy"\n  print n\n  print s\n}')
check('repeat block', multi.trim().split('\n').length === 7, JSON.stringify(multi))
check('expressions', gen('n: int 4..4\nprint n*2+1 (n-1)^2 n/3 2e5 "YES"').trim() === '9 9 1 200000 YES')
check('min/max in expressions', gen('n: int 3..3\nm: int 5..5\nk: int min(n,m)..min(n,m)\nprint k max(n,m,7)').trim() === '3 7')
check('range uses variable', gen('n: int 5..5\nk: int n..n\nprint k').trim() === '5')

let thrown = ''
try {
  gen('a: distinct[5] int 1..3\nprint a')
} catch (e) {
  thrown = e.message
}
check('impossible distinct is a line error', thrown.startsWith('line 1:'), thrown)

// --- Sample matcher ---
const match = (spec, sample) => matchSample(parseSpec(spec), sample)
const ARR = 'n: int 1..8\na: array[n] int -10..10\nprint n\nprint a'
check('sample matches (values outside spec range are fine)', match(ARR, '8\n-1 3 -2 5 3 -5 2 1000000000\n').ok)
check('sample too short', match(ARR, '3\n1 2\n').message.includes('ended'), match(ARR, '3\n1 2\n').message)
check('sample has extra data', match(ARR, '2\n1 2 3\n').message.startsWith('sample line 2 has extra data'))
check('sample non-integer', match(ARR, '2\n1 x\n').message.includes('expected an integer'))
const MT = 't: int 1..3\nprint t\nrepeat t {\n  n: int 1..8\n  s: string[n] "01"\n  print n\n  print s\n}'
check('multi-test sample matches', match(MT, '2\n3\n010\n1\n1\n').ok)
check('string charset mismatch', match(MT, '1\n3\nabc\n').message.includes('not in the spec\'s character set'))
check('string length mismatch', match(MT, '1\n3\n01\n').message.includes('length 3'))
check('tree sample matches', match('n: int 2..8\ne: tree n\nprint n\nprint e', '3\n1 2\n2 3\n').ok)
check('sorted violated', !match('n: int 1..5\na: sorted[n] int 1..9\nprint n\nprint a', '3\n3 1 2').ok)
check('size printed after the array is inferred', match('n: int 1..5\na: array[n] int 1..9\nprint a\nprint n', '1 2\n2').ok)
check('inferred size must agree later', match('n: int 1..5\na: array[n] int 1..9\nprint a\nprint n', '1 2\n3').message.includes('n is 3 here but 2 earlier'))
check('grid rows not printed is reported', match('n: int 1..5\ng: grid[n][2] "ab"\nprint g', 'ab\nba').message.includes("isn't printed before"))
check('unprinted string length inferred', match('len: int 1..8\ns: string[len] "a-z"\nprint s', 'abacaba\n').ok)
check('unprinted array length inferred', match('n: int 1..8\na: array[n] int 1..9\nprint a', '3 1 4 1 5\n').ok)
check('size minimum is checked', match('n: int 2..8\nprint n', '1\n').message.includes('below the spec\'s minimum 2'))
check('size maximum may shrink', match('n: int 1..8\nprint n', '500\n').ok)
check('dependent minimum is checked', match('n: int 1..8\nm: int n..8\nprint n m', '3 2\n').message.includes('m = 2'))
check('full range is checked', match('x: int -10..10 full -100..100\nprint x', '101\n').message.includes('outside its full range'))
check('grid sample matches', match('n: int 1..3\nm: int 1..3\ng: grid[n][m] ".#"\nprint n m\nprint g', '2 3\n.#.\n##.\n').ok)

// --- Test-case line ranges for multi-test inputs ---
const mt = generateTest(parseSpec('t: int 3..3\nprint t\nrepeat t {\n  n: int 2..2\n  a: array[n] int 1..9\n  print n\n  print a\n}'), { seed: 3 })
check('cases recorded per repeat iteration', JSON.stringify(mt.cases) === JSON.stringify([{ start: 2, end: 3 }, { start: 4, end: 5 }, { start: 6, end: 7 }]), JSON.stringify(mt.cases))
check('no cases without repeat', generateTest(parseSpec(ARR), { seed: 1 }).cases.length === 0)

// --- Generator profiles (random / edge / max / pattern) ---
const prof = (spec, profile, seed = 1) => generateTest(parseSpec(spec), { seed, test: 500, tests: 1000, profile }).input
const FULL = 'n: int 1..8\na: array[n] int -10..10 full -10^9..10^9\nprint n\nprint a'
check('`full` range parses', validateSpec(FULL).ok)
check('random ignores full range', prof(FULL, 'random').trim().split('\n')[1].split(' ').every((x) => Math.abs(+x) <= 10))
const maxOut = prof(FULL, 'max').trim().split('\n')
check('max: largest size', maxOut[0] === '8', maxOut[0])
check('max: values at the real limits', maxOut[1].split(' ').every((x) => x === '1000000000' || x === '-1000000000'), maxOut[1])
const edgeOut = prof(FULL, 'edge').trim().split('\n')
check('edge: smallest size', edgeOut[0] === '1')
const edgeVals = new Set(Array.from({ length: 40 }, (_, sd) => prof(FULL, 'edge', sd).trim().split('\n')[1]))
check('edge: values are extremes or 0', [...edgeVals].every((v) => ['-1000000000', '1000000000', '-999999999', '999999999', '0'].includes(v)), [...edgeVals].join(','))
const pat = Array.from({ length: 30 }, (_, sd) => prof('n: int 8..8\na: array[n] int 1..9\nprint a', 'pattern', sd).trim().split(' ').map(Number))
check('pattern: equal / sorted / reversed / alternating', pat.every((a) => a.every((x) => x === a[0]) || a.every((x, i) => !i || a[i - 1] <= x) || a.every((x, i) => !i || a[i - 1] >= x) || a.every((x, i) => x === (i % 2 ? 1 : 9))))
const pathTree = prof('n: int 6..6\ne: tree n\nprint e', 'max').trim().split('\n').map((l) => l.split(' ').map(Number))
const deg = {}
pathTree.flat().forEach((v) => (deg[v] = (deg[v] || 0) + 1))
check('max: tree is a path (all degrees <= 2)', Object.values(deg).every((d) => d <= 2) && connected(6, pathTree))
check('edge: k = 1 when k is a size', prof('n: int 1..8\nk: int 1..n\nprint n k', 'edge').trim() === '1 1')
check('max: k = n when k is a size', prof('n: int 1..8\nk: int 1..n\nprint n k', 'max').trim() === '8 8')
check('edge: pairs have l == r', prof('q: pairs[4] 1..9\nprint q', 'edge').trim().split('\n').every((l) => l.split(' ')[0] === l.split(' ')[1]))
check('max: string uses the last character', prof('s: string[5] "a-c"\nprint s', 'max').trim() === 'ccccc')
check('weighted full range used by max', prof('n: int 3..3\ne: tree n weighted 1..10 full 1..10^9\nprint e', 'max').includes('1000000000'))
check('profiles cycle by test number', [1, 2, 3, 4, 5].map((t) => profileFor(t)).join() === 'random,edge,max,pattern,random')
check('profile subset cycles', [1, 2, 3].map((t) => profileFor(t, ['random', 'max'])).join() === 'random,max,random')
check('all profiles generate valid multi-test input', PROFILES.every((pr) => matchSample(parseSpec(MT), prof(MT, pr)).ok))

// The LLM few-shot examples and the demo spec must themselves be valid.
EXAMPLES.forEach((ex, i) => check(`LLM example ${i + 1} is valid`, validateSpec(ex.spec).ok, validateSpec(ex.spec).message))
check('samples/maxsub/spec.txt is valid', validateSpec(readFileSync(new URL('../samples/maxsub/spec.txt', import.meta.url), 'utf8')).ok)

console.log(failures ? `\n${failures} check(s) failed` : '\nAll generator checks passed')
process.exit(failures ? 1 : 0)
