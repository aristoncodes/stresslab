// Turn a build result into Sublime-style panel text and editor markers.

// Compiler/interpreter messages → [{ line, col, message, severity }] for the built file.
export function parseDiagnostics(stderr = '', lang) {
  const out = []
  if (lang === 'python') {
    // File "main.py", line 3 … followed (a few lines later) by "SyntaxError: …"
    const m = /File "[^"]*main\.py", line (\d+)[\s\S]*?\n(\w*Error: .*)/.exec(stderr)
    if (m) out.push({ line: +m[1], col: 1, message: m[2], severity: 'error' })
    return out
  }
  // g++/clang: main.cpp:12:5: error: … ; javac: Main.java:12: error: …
  const re = /^[^\s:]+\.(?:cpp|java):(\d+):(?:(\d+):)?\s*(error|warning):\s*(.*)$/gm
  for (const m of stderr.matchAll(re)) out.push({ line: +m[1], col: +(m[2] ?? 1), message: m[4], severity: m[3] })
  return out
}

export function panelText(r) {
  const secs = `${r.seconds.toFixed(2)}s`
  if (r.compileError) return `${r.compileError.trimEnd()}\n[Finished in ${secs} with exit code 1]`
  const lines = []
  if (r.inputFile) lines.push(`(input: ${r.inputFile}${r.outputFile ? ` → output: ${r.outputFile}` : ''})`)
  if (!r.outputFile && r.stdout) lines.push(r.stdout.trimEnd())
  if (r.stderr) lines.push(r.stderr.trimEnd())
  lines.push(`Time: ${r.runMs} ms`)
  if (r.stopped) lines.push('[Cancelled]')
  else if (r.timedOut) lines.push(`[Killed: time limit exceeded after ${secs}]`)
  else if (r.exitCode !== 0) lines.push(`[Finished in ${secs} with exit code ${r.exitCode ?? r.signal}]`)
  else lines.push(`[Finished in ${secs}]`)
  return lines.join('\n')
}
