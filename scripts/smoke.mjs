// Engine smoke test, no Electron/UI: `node scripts/smoke.mjs`
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { detectToolchains } from '../src/main/compilers.js'
import { runStress, createController, compareOutputs, runProcess } from '../src/main/runner.js'
import { javaClassName } from '../src/main/languages.js'
import { parseSpec, generateInput, profileFor } from '../src/main/generator.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sample = (f) => readFileSync(join(root, 'samples/maxsub', f), 'utf8')
const includeDir = join(root, 'resources/include')

let failures = 0
let last = null // last stress result, printed when a check fails
function check(name, cond, detail = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)
  if (!cond) {
    failures++
    if (last) console.log('      result:', JSON.stringify(last).slice(0, 600))
  }
}

// Tiny inline generator (the real one arrives with the spec language):
// n grows from 1 toward 8 as the test number increases.
function mulberry32(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const makeInput = async (i, seed) => {
  const rnd = mulberry32(seed)
  const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1))
  const n = int(1, Math.min(8, 1 + Math.floor(i / 10)))
  return `${n}\n${Array.from({ length: n }, () => int(-10, 10)).join(' ')}\n`
}

const toolchains = await detectToolchains()
for (const [k, v] of Object.entries(toolchains)) {
  console.log(`  ${k.padEnd(6)} ${v.ok ? '●' : '○'} ${v.version ?? ''} ${v.path ?? v.home ?? ''} ${v.ok ? '' : v.hint}`)
}

const run = (opts) =>
  runStress({
    runId: `smoke-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    toolchains,
    includeDir,
    makeInput,
    tests: 200,
    baseTimeoutMs: 2000,
    compareMode: 'exact',
    eps: 1e-6,
    seed: 42,
    controller: createController(),
    ...opts
  }).then((res) => (last = res))

// Comparator unit checks
check('compare: whitespace-insensitive', compareOutputs('1  2\n3\n', '1 2 3').ok)
check('compare: mismatch message', compareOutputs('9', '10').message.includes('expected "10", found "9"'))
check('compare: float tolerance', compareOutputs('0.3333334', '0.333333', 'float', 1e-6).ok)
check('compare: float strict in exact mode', !compareOutputs('0.3333334', '0.333333').ok)
check('java class detection', javaClassName('public final class Solution {') === 'Solution')

// 1. Buggy C++ vs Python brute must find a small mismatch
let t = performance.now()
let r = await run({ sol: { lang: 'cpp', code: sample('sol_buggy.cpp') }, brute: { lang: 'python', code: sample('brute.py') } })
check('buggy C++ vs Python → WA', r.verdict === 'WA', `${r.verdict} test ${r.test}, ${Math.round(performance.now() - t)} ms, ${r.message ?? r.stderr}`)
check('failing input is small', r.input && Number(r.input.split('\n')[0]) <= 5, JSON.stringify(r.input))

// 2. Fixed C++ passes everything
t = performance.now()
r = await run({ sol: { lang: 'cpp', code: sample('sol_fixed.cpp') }, brute: { lang: 'python', code: sample('brute.py') } })
check('fixed C++ vs Python → AC', r.verdict === 'AC', `${r.verdict} ${r.test} tests in ${Math.round(performance.now() - t)} ms ${r.verdict === 'AC' ? '' : r.message ?? r.stderr}`)

// 3. Java solution vs Python brute, inputs from a Python generator program
t = performance.now()
r = await run({
  sol: { lang: 'java', code: sample('Solution.java') },
  brute: { lang: 'python', code: sample('brute.py') },
  gen: { lang: 'python', code: sample('gen.py') },
  tests: 30
})
check('Java vs Python with Python generator → AC', r.verdict === 'AC', `${r.test} tests in ${Math.round(performance.now() - t)} ms`)

// 4. Error verdicts
const brute = { lang: 'python', code: sample('brute.py') }
r = await run({ sol: { lang: 'cpp', code: 'int main( {' }, brute })
check('C++ syntax error → CE (solution)', r.verdict === 'CE' && r.which === 'solution')
r = await run({ sol: { lang: 'python', code: 'print(1' }, brute })
check('Python syntax error → CE', r.verdict === 'CE')
r = await run({ sol: { lang: 'cpp', code: 'int main(){ while(true){} }' }, brute, tests: 2, baseTimeoutMs: 500 })
check('infinite loop → TLE', r.verdict === 'TLE')
r = await run({ sol: { lang: 'python', code: 'raise SystemExit(3)' }, brute, tests: 2 })
check('non-zero exit → RE', r.verdict === 'RE' && r.exitCode === 3)
r = await run({ sol: { lang: 'cpp', code: sample('sol_fixed.cpp') }, brute: { lang: 'python', code: 'import sys; sys.exit(1)' }, tests: 2 })
check('brute crash → BRUTE_FAIL', r.verdict === 'BRUTE_FAIL')

// 5. Sample test from the problem statement is checked before random tests
const sampleIn = sample('sample_in.txt')
r = await run({ sol: { lang: 'cpp', code: sample('sol_buggy.cpp') }, brute, sample: { input: sampleIn, output: '9' } })
check('sample passes, stress still finds bug', r.verdict === 'WA' && !r.onSample && r.test >= 1, JSON.stringify({ v: r.verdict, onSample: r.onSample, test: r.test, m: r.message, sol: r.solOut, brute: r.bruteOut }))
r = await run({ sol: { lang: 'cpp', code: sample('sol_fixed.cpp') }, brute, sample: { input: sampleIn, output: '10' } })
check('wrong expected sample output → brute fails sample', r.verdict === 'BRUTE_FAIL' && r.onSample, r.message)
r = await run({ sol: { lang: 'python', code: 'print(0)' }, brute, sample: { input: sampleIn, output: '9' } })
check('solution wrong on sample → WA on sample', r.verdict === 'WA' && r.onSample && r.test === 0)
r = await run({ sol: { lang: 'python', code: 'print(0)' }, brute, sample: { input: sampleIn, output: '' } })
check('sample without output compares sol vs brute', r.verdict === 'WA' && r.onSample)

// 6. Generators: an int-overflow bug is invisible to random small tests, caught by Max values
const ov = (f) => readFileSync(join(root, 'samples/overflow', f), 'utf8')
const ovAst = parseSpec(ov('spec.txt'))
const specInput = (profiles) => async (i, seed) => generateInput(ovAst, { seed, test: i, tests: 200, profile: profileFor(i, profiles) })
const ovProgs = { sol: { lang: 'cpp', code: ov('sol_buggy.cpp') }, brute: { lang: 'python', code: ov('brute.py') } }
r = await run({ ...ovProgs, makeInput: specInput(['random']) })
check('overflow bug passes random-only tests', r.verdict === 'AC', `${r.verdict} ${r.test}`)
r = await run({ ...ovProgs, makeInput: specInput(['random', 'edge', 'max', 'pattern']) })
check('overflow bug caught by Max values generator', r.verdict === 'WA' && profileFor(r.test) === 'max', `${r.verdict} on test ${r.test} (${profileFor(r.test)}): ${r.message}`)

// 7. Stop kills the running process quickly
const controller = createController()
setTimeout(() => controller.stop(), 300)
t = performance.now()
r = await run({ sol: { lang: 'python', code: 'while True: pass' }, brute, controller, baseTimeoutMs: 10000 })
check('Stop → STOPPED promptly', r.verdict === 'STOPPED' && performance.now() - t < 3000, `${Math.round(performance.now() - t)} ms`)

// 8. Output cap
const big = await runProcess({ cmd: '/bin/sh', args: ['-c', 'yes'], timeoutMs: 5000 })
check('output over 1 MB is killed', big.outputLimit && big.stdout.length <= 1024 * 1024)

console.log(failures ? `\n${failures} check(s) failed` : '\nAll smoke checks passed')
process.exit(failures ? 1 : 0)
