import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { key } from '../lib/keys'

// First-launch walkthrough: highlights each section (marked with data-tour="…")
// and explains what to paste there. Replay from Help → Show Walkthrough.
const STEPS = [
  {
    title: 'Welcome to StressLab',
    text: 'StressLab finds the smallest test where your solution and a slow-but-correct brute force disagree. This tour shows where to paste what, in the order you use it.'
  },
  {
    target: 'problem',
    title: '1. Paste the problem’s Input section',
    text: 'Copy the “Input” part of the statement, including the constraints (e.g. 1 ≤ n ≤ 2·10⁵). Then click “Generate spec with AI”.'
  },
  {
    target: 'spec',
    title: '2. The spec: how to build test inputs',
    text: 'The AI first lists every limit (# limit n: 1..2*10^5), then writes a small spec that generates tests. You can edit it. “✓ valid · ✓ matches sample input” means it’s ready. Prefer your own generator? Switch to “Custom generator”.'
  },
  {
    target: 'sample',
    title: '3. Paste the sample test',
    text: 'Paste the sample input and output from the statement. Every run checks them first: the brute must reproduce the sample output, then your solution must match it.'
  },
  {
    target: 'sol',
    title: '4. Your solution',
    text: `Paste the code you want to test, or use Open… (${key('O')}). Pick C++, Python or Java from the dropdown.`
  },
  {
    target: 'brute',
    title: '5. A brute force',
    text: 'A slow but obviously correct solution (try every possibility). It can be in a different language from your solution.'
  },
  {
    target: 'options',
    title: '6. Run options and generators',
    text: 'Number of tests, time limit and output comparison (exact or float). The four generators are cycled per test: Random (small, growing), Edge cases (minimum sizes, extreme values), Max values (real limits: catches int overflow) and Patterns (sorted, equal, path/star trees…).'
  },
  {
    target: 'run',
    title: '7. Run',
    text: `Press Run (${key('R')}). Both programs are compiled, the sample is checked, then tests run until they disagree, crash, time out, or all pass. Stop with ${key('.')}`
  },
  {
    target: 'status',
    title: '8. Results',
    text: 'Each run gets a row with a Codeforces-style verdict. A failure opens a window with the exact input, the failing test case, and a diff of the two outputs. Click a red verdict to reopen it.'
  },
  {
    target: 'complexity',
    title: '9. Time complexity',
    text: '“Estimate with AI” reads your solution and the limits, and tells you its time/space complexity and whether it fits the time limit.'
  },
  {
    title: 'You’re ready',
    text: 'Tip: the demo already loaded on first launch is a buggy solution. Press Run to watch StressLab catch it. Replay this tour anytime from Help → Show Walkthrough.'
  }
]

const PAD = 6 // highlight padding around the target
const CARD_W = 360

export default function Tour({ onClose }) {
  const [i, setI] = useState(0)
  const [rect, setRect] = useState(null)
  const step = STEPS[i]
  const last = i === STEPS.length - 1

  // Locate (and scroll to) the highlighted section; null target = centered card.
  const measure = useCallback(() => {
    const el = step.target && document.querySelector(`[data-tour="${step.target}"]`)
    setRect(el ? el.getBoundingClientRect() : null)
  }, [step])

  useLayoutEffect(() => {
    const el = step.target && document.querySelector(`[data-tour="${step.target}"]`)
    el?.scrollIntoView({ block: 'center' })
    measure()
  }, [step, measure])

  useEffect(() => {
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' || e.key === 'Enter') last ? onClose() : setI((x) => x + 1)
      if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [measure, onClose, last])

  // Card below the target if it fits, otherwise above; clamped to the window.
  let cardStyle = { width: CARD_W }
  if (rect) {
    const below = rect.bottom + PAD + 12
    const top = below + 200 < window.innerHeight ? below : Math.max(12, rect.top - PAD - 12 - 210)
    const left = Math.min(Math.max(12, rect.left), window.innerWidth - CARD_W - 12)
    cardStyle = { ...cardStyle, top, left }
  }

  return (
    <div className="tour" role="dialog" aria-label="Walkthrough">
      {rect ? (
        <div
          className="tour-spot"
          style={{ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + 2 * PAD, height: rect.height + 2 * PAD }}
        />
      ) : (
        <div className="tour-dim" />
      )}
      <div className={`tour-card box ${rect ? '' : 'centered'}`} style={cardStyle}>
        <div className="box-title">
          <span>{step.title}</span>
          <span className="small muted">
            {i + 1} / {STEPS.length}
          </span>
        </div>
        <div className="box-body">
          <p>{step.text}</p>
          <div className="row-end">
            <button className="link" onClick={onClose}>
              Skip tour
            </button>
            <button disabled={i === 0} onClick={() => setI(i - 1)}>
              Back
            </button>
            <button className="primary" autoFocus onClick={() => (last ? onClose() : setI(i + 1))}>
              {last ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
