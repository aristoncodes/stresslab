// Codeforces-style verdict wording (DESIGN.md §3), shared by main (notifications)
// and renderer (status table, failure window).

const ROLE = { solution: 'solution', brute: 'brute', generator: 'generator' }

export function verdictText(r) {
  switch (r.verdict) {
    case 'RUNNING':
      return r.test ? `Running on test ${r.test}` : 'Compiling…'
    case 'AC':
      return `Accepted (${r.test} tests)`
    case 'WA':
      return `Wrong answer on test ${r.test}`
    case 'TLE':
      return `Time limit exceeded on test ${r.test}`
    case 'RE':
      return `Runtime error on test ${r.test}`
    case 'BRUTE_FAIL':
      return `Brute failed on test ${r.test}`
    case 'GEN_FAIL':
      return `Generator failed on test ${r.test}`
    case 'CE':
      return `Compilation error (${ROLE[r.which] ?? r.which})`
    case 'STOPPED':
      return `Stopped at test ${r.test}`
    default:
      return r.message ? `Error: ${r.message}` : 'Error'
  }
}

// CSS class (colour) for a verdict.
export function verdictClass(verdict) {
  return (
    {
      RUNNING: 'v-running',
      AC: 'v-ok',
      WA: 'v-wa',
      TLE: 'v-tle',
      RE: 'v-tle',
      BRUTE_FAIL: 'v-tle',
      GEN_FAIL: 'v-tle',
      CE: 'v-ce',
      STOPPED: 'v-muted'
    }[verdict] ?? 'v-wa'
  )
}

// Verdicts that have something to show in the failure window.
export const hasDetails = (verdict) => !['AC', 'STOPPED', 'RUNNING'].includes(verdict)
