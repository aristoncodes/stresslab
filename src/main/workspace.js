// File access for the editor (PRD-editor.md §6). Every path comes from the
// renderer as a path *relative to the opened folder* and is confined to it:
// no "..", no absolute paths, no symlinks that point outside. No Electron
// imports, so it is tested with plain Node (scripts/workspace-test.mjs).
import { promises as fs, realpathSync, watch } from 'fs'
import { join, relative, resolve, isAbsolute, sep, dirname, basename } from 'path'

export const MAX_FILE_BYTES = 5 * 1024 * 1024
// Hidden from the tree and from Goto Anything.
export const IGNORED = new Set(['.git', 'node_modules', '.DS_Store', 'Thumbs.db', '__pycache__', '.idea', '.vscode'])

export class WorkspaceError extends Error {}

const realpath = (p) => {
  try {
    return realpathSync(p)
  } catch {
    return null
  }
}

/**
 * Resolve `rel` inside `root` or throw. Checks the lexical path and, for paths
 * that exist (or their nearest existing parent), the real path after symlinks.
 */
export function confine(root, rel = '') {
  if (typeof rel !== 'string' || rel.includes('\0')) throw new WorkspaceError('Invalid path')
  if (isAbsolute(rel)) throw new WorkspaceError('Absolute paths are not allowed')
  const abs = resolve(root, rel)
  const inside = (base, p) => {
    const r = relative(base, p)
    return r === '' || (!r.startsWith('..') && !isAbsolute(r))
  }
  if (!inside(root, abs)) throw new WorkspaceError('Path is outside the opened folder')
  // Symlinks: compare real paths of the root and the nearest existing ancestor.
  const realRoot = realpath(root) ?? root
  let probe = abs
  while (realpath(probe) === null && probe !== dirname(probe)) probe = dirname(probe)
  const realProbe = realpath(probe)
  if (realProbe && !inside(realRoot, realProbe)) throw new WorkspaceError('Path is outside the opened folder')
  return abs
}

// Children of a folder: folders first, then files, alphabetically; ignored names hidden.
export async function list(root, rel = '') {
  const dir = confine(root, rel)
  const entries = await fs.readdir(dir, { withFileTypes: true })
  return entries
    .filter((e) => !IGNORED.has(e.name))
    .map((e) => ({ name: e.name, path: toRel(root, join(dir, e.name)), dir: e.isDirectory() }))
    .sort((a, b) => (a.dir !== b.dir ? (a.dir ? -1 : 1) : a.name.localeCompare(b.name, undefined, { numeric: true })))
}

// Every file under the folder (for Goto Anything); capped so huge trees stay fast.
export async function allFiles(root, limit = 20000) {
  const out = []
  async function walk(rel) {
    if (out.length >= limit) return
    let entries
    try {
      entries = await list(root, rel)
    } catch {
      return
    }
    for (const e of entries) {
      if (out.length >= limit) return
      if (e.dir) await walk(e.path)
      else out.push(e.path)
    }
  }
  await walk('')
  return out
}

export async function read(root, rel) {
  const abs = confine(root, rel)
  const stat = await fs.stat(abs)
  if (stat.isDirectory()) throw new WorkspaceError('Is a folder')
  if (stat.size > MAX_FILE_BYTES) throw new WorkspaceError('File is larger than 5 MB')
  return fs.readFile(abs, 'utf8')
}

// Atomic save: write a temp file next to the target, then rename over it.
export async function write(root, rel, text) {
  if (typeof text !== 'string' || Buffer.byteLength(text) > MAX_FILE_BYTES) throw new WorkspaceError('Content too large')
  const abs = confine(root, rel)
  const tmp = join(dirname(abs), `.${basename(abs)}.stresslab-tmp`)
  await fs.writeFile(tmp, text, 'utf8')
  await fs.rename(tmp, abs)
}

export async function create(root, rel, isDir) {
  const abs = confine(root, rel)
  if (isDir) await fs.mkdir(abs)
  else await fs.writeFile(abs, '', { flag: 'wx' }) // fails if it already exists
}

export async function rename(root, fromRel, toRel_) {
  const from = confine(root, fromRel)
  const to = confine(root, toRel_)
  try {
    await fs.access(to)
    throw new WorkspaceError(`"${basename(to)}" already exists`)
  } catch (e) {
    if (e instanceof WorkspaceError) throw e
  }
  await fs.rename(from, to)
}

// Workspace-relative path with forward slashes (stable across OSes).
export const toRel = (root, abs) => relative(root, abs).split(sep).join('/')

/**
 * Watch the folder for changes made by other programs; calls onChange(relPaths)
 * debounced. Returns a stop function. Recursive watching is built into Node on
 * macOS, Windows and Linux (Node ≥ 20).
 */
export function watchFolder(root, onChange, delayMs = 150) {
  let pending = new Set()
  let timer = null
  const w = watch(root, { recursive: true }, (_event, file) => {
    if (!file) return
    const rel = String(file).split(sep).join('/')
    if (rel.split('/').some((part) => IGNORED.has(part)) || rel.includes('.stresslab-tmp')) return
    pending.add(rel)
    clearTimeout(timer)
    timer = setTimeout(() => {
      const paths = [...pending]
      pending = new Set()
      onChange(paths)
    }, delayMs)
  })
  w.on('error', () => {}) // e.g. folder deleted; the tree's refresh handles it
  return () => {
    clearTimeout(timer)
    w.close()
  }
}

// ---------- Find / Replace in Files ----------

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Sublime's "Where" field: comma-separated globs; a leading "-" excludes.
// "*.cpp", "src/", "-*/tests/*". Empty = everything.
function whereFilter(where = '') {
  const toRe = (glob) =>
    new RegExp(
      '^' +
        glob
          .replace(/[.+^${}()|[\]\\]/g, '\\$&')
          .replace(/\*\*/g, '\0')
          .replace(/\*/g, '[^/]*')
          .replace(/\?/g, '[^/]')
          .replace(/\0/g, '.*') +
        (glob.endsWith('/') ? '.*' : '') +
        '$'
    )
  const parts = where.split(',').map((s) => s.trim()).filter(Boolean)
  const include = parts.filter((p) => !p.startsWith('-')).map(toRe)
  const exclude = parts.filter((p) => p.startsWith('-')).map((p) => toRe(p.slice(1)))
  const test = (re, path) => re.test(path) || re.test(path.split('/').pop())
  return (path) => (!include.length || include.some((re) => test(re, path))) && !exclude.some((re) => test(re, path))
}

export function searchRegex({ query, regex, caseSensitive, wholeWord }) {
  if (!query) throw new WorkspaceError('Nothing to find')
  let src = regex ? query : escapeRe(query)
  if (wholeWord) src = `\\b(?:${src})\\b`
  try {
    return new RegExp(src, caseSensitive ? 'g' : 'gi')
  } catch (e) {
    throw new WorkspaceError(`Invalid regular expression: ${e.message}`)
  }
}

const isBinary = (text) => text.slice(0, 8000).includes('\0')

/**
 * Find in Files. opts: { query, regex, caseSensitive, wholeWord, where }.
 * Returns { results: [{ path, line, col, length, text }], files, truncated }.
 */
export async function search(root, opts, limit = 5000) {
  const re = searchRegex(opts)
  const keep = whereFilter(opts.where)
  const results = []
  let files = 0
  for (const path of await allFiles(root)) {
    if (!keep(path)) continue
    let text
    try {
      text = await read(root, path)
    } catch {
      continue // too large or unreadable
    }
    if (isBinary(text)) continue
    let found = false
    text.split('\n').forEach((line, i) => {
      if (results.length >= limit) return
      re.lastIndex = 0
      for (const m of line.matchAll(re)) {
        if (!m[0].length) break
        found = true
        results.push({ path, line: i + 1, col: m.index + 1, length: m[0].length, text: line.replace(/\r$/, '').slice(0, 300) })
        if (results.length >= limit) break
      }
    })
    if (found) files++
    if (results.length >= limit) return { results, files, truncated: true }
  }
  return { results, files, truncated: false }
}

// Replace in Files: same options plus `replacement` ($1… for regex groups).
export async function replaceInFiles(root, opts) {
  const re = searchRegex(opts)
  const keep = whereFilter(opts.where)
  let files = 0
  let replacements = 0
  for (const path of await allFiles(root)) {
    if (!keep(path)) continue
    let text
    try {
      text = await read(root, path)
    } catch {
      continue
    }
    if (isBinary(text)) continue
    let n = 0
    const out = text.replace(re, (...args) => {
      n++
      return opts.regex ? args[0].replace(new RegExp(re.source, re.flags.replace('g', '')), opts.replacement) : opts.replacement
    })
    if (n) {
      await write(root, path, out)
      files++
      replacements += n
    }
  }
  return { files, replacements }
}
