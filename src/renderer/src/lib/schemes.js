// Sublime Text's built-in colour schemes as Monaco themes, plus the UI colours
// the "Adaptive" theme derives from each (sidebar, tabs, status bar, panels).
// Mariana is defined in monaco.js; the others are close approximations of
// Sublime's palettes.
import { monaco } from '../monaco'

const rules = (p) => [
  { token: '', foreground: p.fg, background: p.bg },
  { token: 'comment', foreground: p.comment, fontStyle: 'italic' },
  { token: 'keyword', foreground: p.keyword },
  { token: 'keyword.directive', foreground: p.keyword },
  { token: 'type', foreground: p.type, fontStyle: 'italic' },
  { token: 'type.identifier', foreground: p.func },
  { token: 'string', foreground: p.string },
  { token: 'string.escape', foreground: p.constant },
  { token: 'number', foreground: p.constant },
  { token: 'constant', foreground: p.constant },
  { token: 'operator', foreground: p.operator },
  { token: 'delimiter', foreground: p.fg },
  { token: 'identifier', foreground: p.fg },
  { token: 'predefined', foreground: p.func },
  { token: 'annotation', foreground: p.func }
]

const SCHEMES = {
  Mariana: {
    theme: 'stresslab-mariana',
    ui: { bg: '#303841', side: '#262d34', tab: '#2b323a', text: '#d8dee9', muted: '#a6acb9', border: '#1e242a', accent: '#f9ae58', hover: '#343d46', active: '#3b444e', control: '#3b444e', controlBorder: '#4f5b66', ok: '#99c794', wa: '#ec5f66', tle: '#f9ae58', link: '#6699cc' }
  },
  Monokai: {
    base: 'vs-dark',
    p: { bg: '272822', fg: 'F8F8F2', comment: '75715E', keyword: 'F92672', type: '66D9EF', func: 'A6E22E', string: 'E6DB74', constant: 'AE81FF', operator: 'F92672' },
    colors: { 'editor.background': '#272822', 'editor.lineHighlightBackground': '#3E3D32', 'editor.selectionBackground': '#49483E', 'editorCursor.foreground': '#F8F8F0', 'editorLineNumber.foreground': '#90908A', 'editorIndentGuide.background1': '#464741' },
    ui: { bg: '#272822', side: '#1e1f1c', tab: '#34352f', text: '#f8f8f2', muted: '#90908a', border: '#141411', accent: '#a6e22e', hover: '#3e3d32', active: '#49483e', control: '#3e3d32', controlBorder: '#555', ok: '#a6e22e', wa: '#f92672', tle: '#fd971f', link: '#66d9ef' }
  },
  Breakers: {
    base: 'vs',
    p: { bg: 'FBFFFF', fg: '343D46', comment: '999999', keyword: 'C594C5', type: '5FB3B3', func: '6699CC', string: '5D9F5D', constant: 'D08770', operator: 'EC5F67' },
    colors: { 'editor.background': '#FBFFFF', 'editor.lineHighlightBackground': '#EDF1F4', 'editor.selectionBackground': '#D6DDE3', 'editorCursor.foreground': '#5FB3B3', 'editorLineNumber.foreground': '#A7ADBA', 'editorIndentGuide.background1': '#E0E5EA' },
    ui: { bg: '#fbffff', side: '#eef2f5', tab: '#e3e8ec', text: '#343d46', muted: '#65737e', border: '#cdd3d8', accent: '#5fb3b3', hover: '#e3e8ec', active: '#d6dde3', control: '#e3e8ec', controlBorder: '#c0c7cd', ok: '#5d9f5d', wa: '#ec5f67', tle: '#d08770', link: '#6699cc' }
  },
  Celeste: {
    base: 'vs',
    p: { bg: 'FFFFFF', fg: '353535', comment: '8C8C8C', keyword: '8C5AFF', type: '0F8FB0', func: '2E7DE9', string: '3D8B2F', constant: 'D7600B', operator: 'C23B6E' },
    colors: { 'editor.background': '#FFFFFF', 'editor.lineHighlightBackground': '#F2F5FA', 'editor.selectionBackground': '#D4E2F7', 'editorCursor.foreground': '#2E7DE9', 'editorLineNumber.foreground': '#ADADAD', 'editorIndentGuide.background1': '#E8E8E8' },
    ui: { bg: '#ffffff', side: '#f3f4f7', tab: '#e8eaef', text: '#353535', muted: '#6e6e6e', border: '#d7d9df', accent: '#2e7de9', hover: '#e8eaef', active: '#dbe4f5', control: '#eceef2', controlBorder: '#c9ccd3', ok: '#3d8b2f', wa: '#c23b3b', tle: '#d7600b', link: '#2e7de9' }
  },
  Sixteen: {
    base: 'vs',
    p: { bg: 'FDFDFD', fg: '3B3B3B', comment: '9A9A9A', keyword: 'B2148B', type: '2E8DB7', func: '307E9C', string: '5B8C3E', constant: 'C0632F', operator: 'B2148B' },
    colors: { 'editor.background': '#FDFDFD', 'editor.lineHighlightBackground': '#F1F1EF', 'editor.selectionBackground': '#DCE2E8', 'editorCursor.foreground': '#3B3B3B', 'editorLineNumber.foreground': '#B0B0B0', 'editorIndentGuide.background1': '#E6E6E6' },
    ui: { bg: '#fdfdfd', side: '#f0f0ee', tab: '#e6e6e3', text: '#3b3b3b', muted: '#777', border: '#d3d3cf', accent: '#307e9c', hover: '#e6e6e3', active: '#dce2e8', control: '#ececea', controlBorder: '#c8c8c4', ok: '#5b8c3e', wa: '#c03b3b', tle: '#c0632f', link: '#307e9c' }
  }
}

export const SCHEME_NAMES = Object.keys(SCHEMES)

let defined = false
function defineThemes() {
  if (defined) return
  defined = true
  for (const [name, s] of Object.entries(SCHEMES)) {
    if (!s.p) continue
    s.theme = `stresslab-${name.toLowerCase()}`
    monaco.editor.defineTheme(s.theme, { base: s.base, inherit: true, rules: rules(s.p), colors: s.colors })
  }
}

// Switch every editor (and the app's UI colours) to a scheme.
export function applyScheme(name) {
  defineThemes()
  const s = SCHEMES[name] ?? SCHEMES.Mariana
  monaco.editor.setTheme(s.theme)
  const u = s.ui
  const root = document.documentElement.style
  const vars = {
    // shared design tokens (stress tester, popups)
    '--bg': u.bg,
    '--bg-alt': u.side,
    '--bg-input': u.side,
    '--border': u.border,
    '--border-light': u.active,
    '--text': u.text,
    '--text-muted': u.muted,
    '--link': u.link,
    '--ok': u.ok,
    '--wa': u.wa,
    '--tle': u.tle,
    '--running': u.link,
    '--control': u.control,
    '--control-border': u.controlBorder,
    // editor chrome
    '--ed-bg': u.bg,
    '--ed-side': u.side,
    '--ed-tab': u.tab,
    '--ed-tab-active': u.bg,
    '--ed-border': u.border,
    '--ed-text': u.text,
    '--ed-muted': u.muted,
    '--ed-accent': u.accent,
    '--ed-pink': u.wa,
    '--ed-hover': u.hover,
    '--ed-active': u.active
  }
  for (const [k, v] of Object.entries(vars)) root.setProperty(k, v)
  root.setProperty('color-scheme', s.base === 'vs' ? 'light' : 'dark')
  return s.theme
}
