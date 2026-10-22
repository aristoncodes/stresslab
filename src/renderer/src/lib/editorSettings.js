// Editor settings with Sublime Text's names and meanings. The user file is
// User/Preferences.json (JSON with // comments, like Sublime's .sublime-settings);
// Preferences → Editor Settings opens the defaults next to it.

export const DEFAULT_SETTINGS = {
  color_scheme: 'Mariana',
  font_face: '',
  font_size: 14,
  font_options: [],
  line_padding: 4,
  tab_size: 4,
  translate_tabs_to_spaces: true,
  detect_indentation: true,
  word_wrap: false,
  wrap_width: 0,
  rulers: [],
  draw_white_space: 'selection',
  line_numbers: true,
  highlight_line: true,
  caret_style: 'smooth',
  block_caret: false,
  show_minimap: true,
  draw_indent_guides: true,
  match_brackets: true,
  auto_match_enabled: true,
  auto_complete: true,
  tab_completion: true,
  scroll_past_end: true,
  save_on_focus_lost: false,
  trim_trailing_white_space_on_save: 'none',
  ensure_newline_at_eof_on_save: false,
  default_line_ending: 'system',
  hot_exit: 'always',
  preview_on_click: true,
  show_encoding: true,
  show_line_endings: true,
  file_exclude_patterns: ['*.o', '*.obj', '*.a', '*.lib', '*.so', '*.dylib', '*.dll', '*.exe', '*.class', '*.pyc', '*.pyo', '.DS_Store', '*.dSYM']
}

const HELP = {
  color_scheme: 'Mariana, Monokai, Breakers, Celeste or Sixteen',
  font_face: 'Font family; empty = the platform monospace font',
  font_options: '"no_liga" turns off ligatures',
  line_padding: 'Extra pixels between lines',
  translate_tabs_to_spaces: 'Insert spaces when Tab is pressed',
  detect_indentation: 'Guess tab_size / spaces from each file',
  wrap_width: '0 = wrap at the window edge',
  rulers: 'Columns to draw vertical rulers at, e.g. [80, 100]',
  draw_white_space: '"none", "selection" or "all"',
  caret_style: '"smooth", "phase", "blink" or "solid"',
  save_on_focus_lost: 'Save a file when you switch away from it',
  trim_trailing_white_space_on_save: '"none" or "all"',
  default_line_ending: '"system", "unix" or "windows" for new files',
  hot_exit: '"always" keeps unsaved files across restarts; "disabled" asks to save',
  preview_on_click: 'Single-click in the sidebar opens a preview tab',
  file_exclude_patterns: 'Hide files in the sidebar, e.g. ["*.o", "*.exe"]'
}

// The read-only "Default" settings file shown next to the user file.
export function defaultSettingsText() {
  const lines = Object.entries(DEFAULT_SETTINGS).map(([k, v], i, all) => {
    const help = HELP[k] ? `\t// ${HELP[k]}\n` : ''
    return `${help}\t"${k}": ${JSON.stringify(v)}${i < all.length - 1 ? ',' : ''}`
  })
  return `// StressLab default editor settings (read-only).\n// Copy a setting to the User file on the right to change it.\n{\n${lines.join('\n\n')}\n}\n`
}

export const USER_SETTINGS_TEMPLATE = `// Settings in here override those in the Default file.\n{\n\t"font_size": 14\n}\n`

// JSON with // and /* */ comments and trailing commas.
export function parseSettings(text) {
  const clean = text
    .replace(/("(?:[^"\\]|\\.)*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (m, str) => str ?? '')
    .replace(/,(\s*[}\]])/g, '$1')
  const user = JSON.parse(clean || '{}')
  return { ...DEFAULT_SETTINGS, ...user }
}

const MONO = "'SF Mono', Menlo, Consolas, 'Cascadia Mono', 'DejaVu Sans Mono', monospace"

// Settings → Monaco editor options.
export function editorOptions(s, view = {}) {
  return {
    fontFamily: s.font_face ? `'${s.font_face}', ${MONO}` : MONO,
    fontSize: s.font_size,
    lineHeight: Math.round(s.font_size * 1.3 + s.line_padding * 2),
    fontLigatures: !s.font_options.includes('no_liga'),
    wordWrap: view.wrap ?? s.word_wrap ? (s.wrap_width > 0 ? 'wordWrapColumn' : 'on') : 'off',
    wordWrapColumn: s.wrap_width || 80,
    rulers: view.rulers ?? s.rulers,
    renderWhitespace: view.whitespace ?? s.draw_white_space,
    lineNumbers: s.line_numbers ? 'on' : 'off',
    renderLineHighlight: s.highlight_line ? 'line' : 'none',
    cursorBlinking: s.caret_style,
    cursorSmoothCaretAnimation: s.caret_style === 'smooth' ? 'on' : 'off',
    cursorStyle: s.block_caret ? 'block' : 'line',
    minimap: { enabled: view.minimap ?? s.show_minimap, renderCharacters: false },
    guides: { indentation: s.draw_indent_guides, bracketPairs: false },
    matchBrackets: s.match_brackets ? 'always' : 'never',
    autoClosingBrackets: s.auto_match_enabled ? 'languageDefined' : 'never',
    autoClosingQuotes: s.auto_match_enabled ? 'languageDefined' : 'never',
    quickSuggestions: s.auto_complete,
    tabCompletion: s.tab_completion ? 'on' : 'off',
    scrollBeyondLastLine: s.scroll_past_end,
    // Sublime-like interaction
    multiCursorModifier: 'ctrlCmd', // ⌘/Ctrl+Click adds a cursor
    mouseWheelZoom: true, // ⌘/Ctrl+scroll zooms
    glyphMargin: true, // bookmarks
    automaticLayout: true,
    bracketPairColorization: { enabled: true },
    smoothScrolling: true,
    renderFinalNewline: 'dimmed',
    padding: { top: 6 },
    snippetSuggestions: 'top',
    suggest: { showSnippets: true }
  }
}

// Indentation for a model from settings (or guessed from the file, like Sublime).
export function applyIndentation(model, s) {
  if (s.detect_indentation) model.detectIndentation(s.translate_tabs_to_spaces, s.tab_size)
  else model.updateOptions({ tabSize: s.tab_size, insertSpaces: s.translate_tabs_to_spaces })
}

// Applied on save, per settings.
export function beforeSave(model, s) {
  const edits = []
  if (s.trim_trailing_white_space_on_save === 'all') {
    for (let i = 1; i <= model.getLineCount(); i++) {
      const line = model.getLineContent(i)
      const trimmed = line.replace(/\s+$/, '')
      if (trimmed !== line) edits.push({ range: { startLineNumber: i, startColumn: trimmed.length + 1, endLineNumber: i, endColumn: line.length + 1 }, text: '' })
    }
  }
  if (s.ensure_newline_at_eof_on_save) {
    const last = model.getLineCount()
    if (model.getLineContent(last) !== '') edits.push({ range: { startLineNumber: last, startColumn: model.getLineMaxColumn(last), endLineNumber: last, endColumn: model.getLineMaxColumn(last) }, text: model.getEOL() })
  }
  if (edits.length) model.pushEditOperations([], edits, () => null)
}
