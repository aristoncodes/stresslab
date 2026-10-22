// Sublime Text editing commands that Monaco doesn't have built in.
// Each takes the Monaco editor (and the monaco namespace where needed).

const lines = (model, from, to) => Array.from({ length: to - from + 1 }, (_, i) => model.getLineContent(from + i))

// Lines a command works on: the selected lines, or the whole file when nothing is
// selected (Sublime's behaviour for sort/permute).
function targetLines(editor) {
  const model = editor.getModel()
  const sel = editor.getSelection()
  if (sel.isEmpty()) return { from: 1, to: model.getLineCount() }
  const to = sel.endColumn === 1 && sel.endLineNumber > sel.startLineNumber ? sel.endLineNumber - 1 : sel.endLineNumber
  return { from: sel.startLineNumber, to }
}

function replaceLines(editor, from, to, newLines) {
  const model = editor.getModel()
  editor.pushUndoStop()
  editor.executeEdits('sublime', [{ range: { startLineNumber: from, startColumn: 1, endLineNumber: to, endColumn: model.getLineMaxColumn(to) }, text: newLines.join(model.getEOL()) }])
  editor.pushUndoStop()
}

const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const PERMUTE = {
  sort: (a) => [...a].sort((x, y) => x.localeCompare(y, undefined, { sensitivity: 'base' })),
  sortCase: (a) => [...a].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0)),
  reverse: (a) => [...a].reverse(),
  unique: (a) => [...new Set(a)],
  shuffle: (a) => shuffle([...a])
}

export function permuteLines(editor, kind) {
  const { from, to } = targetLines(editor)
  replaceLines(editor, from, to, PERMUTE[kind](lines(editor.getModel(), from, to)))
}

// Permute the text of multiple selections among themselves.
export function permuteSelections(editor, kind) {
  const model = editor.getModel()
  const sels = [...editor.getSelections()].sort((a, b) => a.startLineNumber - b.startLineNumber || a.startColumn - b.startColumn)
  const texts = sels.map((s) => model.getValueInRange(s))
  let out = kind === 'unique' ? texts.map((t, i) => (texts.indexOf(t) === i ? t : '')) : PERMUTE[kind](texts)
  editor.pushUndoStop()
  editor.executeEdits('sublime', sels.map((range, i) => ({ range, text: out[i] })))
  editor.pushUndoStop()
}

const swap = (s) => [...s].map((c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase())).join('')

// Swap case of each selection (or of the word under an empty cursor).
export function swapCase(editor, monaco) {
  const model = editor.getModel()
  const edits = editor.getSelections().map((sel) => {
    let range = sel
    if (sel.isEmpty()) {
      const w = model.getWordAtPosition(sel.getPosition())
      if (!w) return null
      range = new monaco.Range(sel.startLineNumber, w.startColumn, sel.startLineNumber, w.endColumn)
    }
    return { range, text: swap(model.getValueInRange(range)) }
  })
  editor.executeEdits('sublime', edits.filter(Boolean))
}

const blank = (s) => s.trim() === ''

// Contiguous non-blank lines around `line`.
function paragraphAt(model, line) {
  let a = line
  let b = line
  while (a > 1 && !blank(model.getLineContent(a - 1))) a--
  while (b < model.getLineCount() && !blank(model.getLineContent(b + 1))) b++
  return { a, b }
}

export function selectParagraph(editor, monaco) {
  const model = editor.getModel()
  editor.setSelections(
    editor.getSelections().map((sel) => {
      const { a, b } = paragraphAt(model, sel.startLineNumber)
      return new monaco.Selection(a, 1, b, model.getLineMaxColumn(b))
    })
  )
}

const indentOf = (s) => s.match(/^\s*/)[0].length

// Expand to the surrounding lines indented at least as much as the current one.
export function selectIndentation(editor, monaco) {
  const model = editor.getModel()
  editor.setSelections(
    editor.getSelections().map((sel) => {
      const level = indentOf(model.getLineContent(sel.startLineNumber))
      const ok = (n) => blank(model.getLineContent(n)) || indentOf(model.getLineContent(n)) >= level
      let a = sel.startLineNumber
      let b = sel.endLineNumber
      while (a > 1 && ok(a - 1)) a--
      while (b < model.getLineCount() && ok(b + 1)) b++
      return new monaco.Selection(a, 1, b, model.getLineMaxColumn(b))
    })
  )
}

export function singleSelection(editor) {
  editor.setSelection(editor.getSelection())
}

// Everything that is not selected becomes the selection.
export function invertSelection(editor, monaco) {
  const model = editor.getModel()
  const sels = [...editor.getSelections()].sort((a, b) => a.startLineNumber - b.startLineNumber || a.startColumn - b.startColumn)
  const end = model.getFullModelRange().getEndPosition()
  const out = []
  let cur = { lineNumber: 1, column: 1 }
  for (const s of sels) {
    if (cur.lineNumber !== s.startLineNumber || cur.column !== s.startColumn) out.push(new monaco.Selection(cur.lineNumber, cur.column, s.startLineNumber, s.startColumn))
    cur = { lineNumber: s.endLineNumber, column: s.endColumn }
  }
  if (cur.lineNumber !== end.lineNumber || cur.column !== end.column) out.push(new monaco.Selection(cur.lineNumber, cur.column, end.lineNumber, end.column))
  if (out.length) editor.setSelections(out)
}

// Re-wrap the paragraph(s) under the cursors at `width`, keeping indentation and a
// leading comment marker (//, #, *, --).
export function wrapParagraph(editor, width = 80) {
  const model = editor.getModel()
  const done = new Set()
  const edits = []
  for (const sel of editor.getSelections()) {
    const { a, b } = sel.isEmpty() ? paragraphAt(model, sel.startLineNumber) : { a: sel.startLineNumber, b: sel.endLineNumber }
    if (done.has(a)) continue
    done.add(a)
    const first = model.getLineContent(a)
    const prefix = first.match(/^\s*(?:\/\/+|#+|\*|--)?\s*/)[0]
    const words = lines(model, a, b)
      .map((l) => (l.startsWith(prefix.trimEnd()) ? l.slice(prefix.length) : l.trimStart()))
      .join(' ')
      .split(/\s+/)
      .filter(Boolean)
    const out = []
    let line = ''
    for (const w of words) {
      if (line && prefix.length + line.length + 1 + w.length > width) {
        out.push(prefix + line)
        line = w
      } else line = line ? `${line} ${w}` : w
    }
    if (line) out.push(prefix + line)
    edits.push({ range: { startLineNumber: a, startColumn: 1, endLineNumber: b, endColumn: model.getLineMaxColumn(b) }, text: out.join(model.getEOL()) })
  }
  editor.pushUndoStop()
  editor.executeEdits('sublime', edits)
  editor.pushUndoStop()
}

// ---- Sublime's Mark (an Emacs-style mark and a one-slot kill buffer) ----
const marks = new WeakMap() // model → { position, decorations }
let yankBuffer = ''

function markOf(editor) {
  return marks.get(editor.getModel())
}

export function markSet(editor, monaco) {
  const model = editor.getModel()
  const pos = editor.getPosition()
  const old = markOf(editor)
  const decorations = model.deltaDecorations(old?.decorations ?? [], [
    { range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column), options: { className: 'sublime-mark', stickiness: 1 } }
  ])
  marks.set(model, { decorations })
}

const markPosition = (editor) => {
  const m = markOf(editor)
  const range = m && editor.getModel().getDecorationRange(m.decorations[0])
  return range ? range.getStartPosition() : null
}

export function markSelect(editor, monaco) {
  const mark = markPosition(editor)
  if (!mark) return
  const pos = editor.getPosition()
  editor.setSelection(new monaco.Selection(mark.lineNumber, mark.column, pos.lineNumber, pos.column))
}

export function markDelete(editor, monaco) {
  markSelect(editor, monaco)
  const sel = editor.getSelection()
  yankBuffer = editor.getModel().getValueInRange(sel)
  editor.executeEdits('sublime', [{ range: sel, text: '' }])
}

export function markSwap(editor, monaco) {
  const mark = markPosition(editor)
  if (!mark) return
  markSet(editor, monaco) // the mark moves to the cursor…
  editor.setPosition(mark) // …and the cursor to the old mark
}

export function markClear(editor) {
  const m = markOf(editor)
  if (m) editor.getModel().deltaDecorations(m.decorations, [])
  marks.delete(editor.getModel())
}

export function yank(editor) {
  if (!yankBuffer) return
  editor.executeEdits('sublime', editor.getSelections().map((range) => ({ range, text: yankBuffer })))
}
