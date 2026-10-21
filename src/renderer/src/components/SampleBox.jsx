import Box from './Box'

// The sample test from the problem statement. Used to check the spec's input
// format and run both programs before stress testing (output is optional).
export default function SampleBox({ input, output, onChange }) {
  return (
    <Box title="Sample test (from the problem statement)" tour="sample">
      <div className="sample-grid">
        <label>
          <span className="small muted">Sample input</span>
          <textarea className="mono" rows={4} spellCheck={false} value={input} onChange={(e) => onChange({ sampleIn: e.target.value })} />
        </label>
        <label>
          <span className="small muted">Sample output (optional)</span>
          <textarea className="mono" rows={4} spellCheck={false} value={output} onChange={(e) => onChange({ sampleOut: e.target.value })} />
        </label>
      </div>
      <div className="small muted">
        Checked first on every run: the brute must print the sample output, then your solution must match it. The spec is also checked against the sample input&apos;s format.
      </div>
    </Box>
  )
}
