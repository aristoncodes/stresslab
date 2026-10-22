// File helpers for the editor: language from extension, Monaco model URIs.

const EXT = {
  cpp: ['cpp', 'cc', 'cxx', 'c++', 'h', 'hpp', 'hh', 'c'],
  python: ['py'],
  java: ['java'],
  javascript: ['js', 'mjs', 'cjs'],
  json: ['json', 'sublime-settings', 'sublime-keymap', 'sublime-project', 'sublime-build'],
  xml: ['xml', 'sublime-snippet', 'tmtheme'],
  markdown: ['md'],
  plaintext: ['txt', 'in', 'out', 'ans']
}
const ext = (path) => (path.includes('.') ? path.split('.').pop().toLowerCase() : '')

// Monaco language id for highlighting.
export function monacoLanguage(path) {
  if (path.startsWith('hex:')) return 'plaintext'
  const e = ext(path.replace(/^(user|default):/, ''))
  return Object.keys(EXT).find((lang) => EXT[lang].includes(e)) ?? 'plaintext'
}

// StressLab language (cpp | python | java) or null when the file can't be run.
export function runLanguage(path) {
  const lang = monacoLanguage(path)
  return ['cpp', 'python', 'java'].includes(lang) ? lang : null
}

export const LANGUAGE_LABEL = { xml: 'XML', cpp: 'C++', python: 'Python', java: 'Java', javascript: 'JavaScript', json: 'JSON', markdown: 'Markdown', plaintext: 'Plain Text' }

// One Monaco model per open file, keyed by a stable URI. "user:", "default:" and
// "hex:" buffers get their own roots so they never collide with workspace files.
export const modelPath = (rel) => {
  const m = /^(user|default|hex):(.*)$/.exec(rel)
  return m ? `file:///${m[1]}/${m[2]}` : `file:///workspace/${rel}`
}

export const baseName = (rel) => rel.split('/').pop()
export const parentOf = (rel) => (rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '')
export const joinRel = (dir, name) => (dir ? `${dir}/${name}` : name)
