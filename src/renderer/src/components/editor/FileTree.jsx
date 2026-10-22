import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { baseName, joinRel, parentOf } from '../../lib/files'
import { cleanError } from '../../lib/errors'

const isMac = window.api.platform === 'darwin'
const GIT_BADGE = { modified: 'M', added: 'A', untracked: 'U', deleted: 'D' }
// Sublime-ish file icons: a small coloured label per file type.
const ICONS = {
  cpp: ['C++', '#6699cc'],
  c: ['C', '#6699cc'],
  h: ['H', '#6699cc'],
  hpp: ['H', '#6699cc'],
  py: ['Py', '#fac863'],
  java: ['J', '#f97b58'],
  js: ['JS', '#fac863'],
  json: ['{}', '#99c794'],
  md: ['M↓', '#5fb4b4'],
  in: ['in', '#a6acb9'],
  out: ['out', '#a6acb9'],
  txt: ['txt', '#a6acb9']
}
const fileIcon = (name) =>
  ICONS[name.includes('.') ? name.split('.').pop().toLowerCase() : ''] ?? null

// file_exclude_patterns: globs on the file name ("*.o", ".DS_Store").
const globRe = (g) =>
  new RegExp(
    '^' +
      g
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.') +
      '$'
  )

const REVEAL = isMac
  ? 'Reveal in Finder'
  : window.api.platform === 'win32'
    ? 'Show in Explorer'
    : 'Show in File Manager'

// Sidebar folder tree. Folders load lazily; right-click opens a native menu.
// `version` changes when files change on disk → loaded folders are re-read.
export default function FileTree({
  rootName,
  version,
  activePath,
  git,
  exclude,
  onOpen,
  onOpenPinned,
  onRenamed,
  onDeleted,
  onRevealNew,
  onFindInFolder,
  newFileSignal
}) {
  const excluded = useMemo(() => (exclude ?? []).map(globRe), [exclude])
  // A folder shows the "strongest" status of anything inside it.
  const gitOf = useMemo(() => {
    const map = new Map()
    for (const [path, st] of Object.entries(git ?? {})) {
      map.set(path, st)
      for (let d = parentOf(path); d; d = parentOf(d)) if (!map.has(d)) map.set(d, 'modified')
    }
    return map
  }, [git])
  const [children, setChildren] = useState({}) // dir → entries
  const [open, setOpen] = useState(() => new Set(['']))
  const [editing, setEditing] = useState(null) // { kind: 'new'|'rename', dir, isDir, path }
  const [error, setError] = useState('')

  const load = useCallback(async (dir) => {
    try {
      const list = await window.api.wsList(dir)
      setChildren((c) => ({ ...c, [dir]: list }))
    } catch (e) {
      setChildren((c) => {
        const { [dir]: _gone, ...rest } = c // folder vanished
        return rest
      })
      if (dir === '') setError(cleanError(e))
    }
  }, [])

  // (Re)load every expanded folder when the tree or the disk changes.
  const openRef = useRef(open)
  openRef.current = open
  useEffect(() => {
    for (const dir of openRef.current) load(dir)
  }, [version, rootName, load])

  const toggle = (dir) => {
    setOpen((o) => {
      const n = new Set(o)
      if (n.has(dir)) n.delete(dir)
      else {
        n.add(dir)
        load(dir)
      }
      return n
    })
  }

  const startNew = (dir, isDir) => {
    setOpen((o) => new Set(o).add(dir))
    load(dir)
    setEditing({ kind: 'new', dir, isDir })
  }

  // File → New File (⌘N) asks for a name at the top of the tree.
  useEffect(() => {
    if (newFileSignal) startNew('', false)
  }, [newFileSignal]) // eslint-disable-line react-hooks/exhaustive-deps

  async function commit(name) {
    const e = editing
    setEditing(null)
    name = name.trim()
    if (!name || /[\\/]/.test(name)) return
    try {
      if (e.kind === 'new') {
        const path = joinRel(e.dir, name)
        await window.api.wsCreate({ path, dir: e.isDir })
        await load(e.dir)
        if (!e.isDir) onRevealNew(path)
      } else if (e.kind === 'duplicate') {
        const path = joinRel(e.dir, name)
        await window.api.wsCreate({ path, dir: false })
        await window.api.wsWrite({ path, text: await window.api.wsRead(e.path) })
        await load(e.dir)
        onRevealNew(path)
      } else if (name !== baseName(e.path)) {
        const to = joinRel(parentOf(e.path), name)
        await window.api.wsRename({ from: e.path, to })
        await load(parentOf(e.path))
        onRenamed(e.path, to)
      }
      setError('')
    } catch (err) {
      setError(cleanError(err))
    }
  }

  async function contextMenu(ev, entry) {
    ev.preventDefault()
    ev.stopPropagation()
    const dir = entry ? (entry.dir ? entry.path : parentOf(entry.path)) : ''
    const items = [
      { id: 'newFile', label: 'New File' },
      { id: 'newFolder', label: 'New Folder' },
      ...(entry
        ? [
            { type: 'separator' },
            { id: 'rename', label: 'Rename…' },
            ...(entry.dir ? [] : [{ id: 'duplicate', label: 'Duplicate…' }]),
            { id: 'delete', label: entry.dir ? 'Delete Folder' : 'Delete File' },
            { type: 'separator' },
            { id: 'copyPath', label: 'Copy Path' },
            { id: 'copyName', label: 'Copy Name' },
            { id: 'reveal', label: REVEAL }
          ]
        : []),
      { type: 'separator' },
      { id: 'find', label: 'Find in Folder…' }
    ]
    const id = await window.api.contextMenu(items)
    if (id === 'newFile') startNew(dir, false)
    if (id === 'newFolder') startNew(dir, true)
    if (id === 'rename') setEditing({ kind: 'rename', path: entry.path })
    if (id === 'reveal') window.api.wsReveal(entry.path)
    if (id === 'copyPath') window.api.copyText(entry.path)
    if (id === 'copyName') window.api.copyText(entry.name)
    if (id === 'find') onFindInFolder?.(dir)
    if (id === 'duplicate')
      setEditing({ kind: 'duplicate', path: entry.path, dir: parentOf(entry.path) })
    if (id === 'delete') {
      const choice = await window.api.confirm({
        message: `Move “${entry.name}” to the Trash?`,
        buttons: ['Move to Trash', 'Cancel']
      })
      if (choice !== 0) return
      try {
        await window.api.wsTrash(entry.path)
        await load(parentOf(entry.path))
        onDeleted(entry.path)
      } catch (err) {
        setError(cleanError(err))
      }
    }
  }

  const nameInput = (initial) => (
    <input
      className="tree-input"
      autoFocus
      defaultValue={initial}
      onFocus={(e) => e.target.select()}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.target.blur()
        if (e.key === 'Escape') setEditing(null)
      }}
    />
  )

  function renderDir(dir, depth) {
    const entries = children[dir]
    if (!entries) return null
    return (
      <>
        {editing?.kind === 'new' && editing.dir === dir && (
          <div className="tree-row" style={{ paddingLeft: 8 + depth * 14 }}>
            <span className="tree-icon">{editing.isDir ? '▸' : ''}</span>
            {nameInput('')}
          </div>
        )}
        {entries
          .filter((e) => !excluded.some((re) => re.test(e.name)))
          .map((e) => (
            <div key={e.path}>
              <div
                className={`tree-row ${e.path === activePath ? 'active' : ''}`}
                style={{ paddingLeft: 8 + depth * 14 }}
                onClick={() => (e.dir ? toggle(e.path) : onOpen(e.path))}
                onDoubleClick={() => !e.dir && onOpenPinned?.(e.path)}
                onContextMenu={(ev) => contextMenu(ev, e)}
                title={e.path}
              >
                <span className="tree-icon">{e.dir ? (open.has(e.path) ? '▾' : '▸') : ''}</span>
                {!e.dir && <FileIcon name={e.name} />}
                {editing?.kind === 'rename' && editing.path === e.path ? (
                  nameInput(e.name)
                ) : (
                  <span
                    className={`tree-name ${gitOf.has(e.path) ? `git-${gitOf.get(e.path)}` : ''}`}
                  >
                    {e.name}
                  </span>
                )}
                {gitOf.has(e.path) && !e.dir && (
                  <span className={`tree-badge git-${gitOf.get(e.path)}`}>
                    {GIT_BADGE[gitOf.get(e.path)]}
                  </span>
                )}
              </div>
              {editing?.kind === 'duplicate' && editing.path === e.path && (
                <div className="tree-row" style={{ paddingLeft: 8 + depth * 14 }}>
                  <span className="tree-icon" />
                  {nameInput(copyName(e.name))}
                </div>
              )}
              {e.dir && open.has(e.path) && renderDir(e.path, depth + 1)}
            </div>
          ))}
      </>
    )
  }

  return (
    <div className="tree" onContextMenu={(ev) => contextMenu(ev, null)}>
      <div className="tree-header">
        <span className="tree-title" title={rootName}>
          {rootName}
        </span>
        <span className="tree-actions">
          <button title="New File" onClick={() => startNew('', false)}>
            +
          </button>
          <button title="New Folder" onClick={() => startNew('', true)}>
            ⊞
          </button>
          <button title="Refresh" onClick={() => [...open].forEach(load)}>
            ↻
          </button>
        </span>
      </div>
      <div className="tree-body">{renderDir('', 0)}</div>
      {error && (
        <div className="tree-error" onClick={() => setError('')}>
          {error}
        </div>
      )}
    </div>
  )
}

function FileIcon({ name }) {
  const icon = fileIcon(name)
  return (
    <span className="file-icon" style={icon ? { color: icon[1] } : undefined}>
      {icon ? icon[0] : '·'}
    </span>
  )
}

// "a.cpp" → "a copy.cpp"
const copyName = (name) =>
  name.includes('.') ? name.replace(/(\.[^.]*)$/, ' copy$1') : `${name} copy`
