import { useCallback, useEffect, useRef, useState } from 'react'
import { baseName, joinRel, parentOf } from '../../lib/files'
import { cleanError } from '../../lib/errors'

const isMac = window.api.platform === 'darwin'
const REVEAL = isMac ? 'Reveal in Finder' : window.api.platform === 'win32' ? 'Show in Explorer' : 'Show in File Manager'

// Sidebar folder tree. Folders load lazily; right-click opens a native menu.
// `version` changes when files change on disk → loaded folders are re-read.
export default function FileTree({ rootName, version, activePath, onOpen, onRenamed, onDeleted, onRevealNew, newFileSignal }) {
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
        ? [{ type: 'separator' }, { id: 'rename', label: 'Rename…' }, { id: 'delete', label: 'Move to Trash' }, { type: 'separator' }, { id: 'reveal', label: REVEAL }]
        : [])
    ]
    const id = await window.api.contextMenu(items)
    if (id === 'newFile') startNew(dir, false)
    if (id === 'newFolder') startNew(dir, true)
    if (id === 'rename') setEditing({ kind: 'rename', path: entry.path })
    if (id === 'reveal') window.api.wsReveal(entry.path)
    if (id === 'delete') {
      const choice = await window.api.confirm({ message: `Move “${entry.name}” to the Trash?`, buttons: ['Move to Trash', 'Cancel'] })
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
        {entries.map((e) => (
          <div key={e.path}>
            <div
              className={`tree-row ${e.path === activePath ? 'active' : ''}`}
              style={{ paddingLeft: 8 + depth * 14 }}
              onClick={() => (e.dir ? toggle(e.path) : onOpen(e.path))}
              onContextMenu={(ev) => contextMenu(ev, e)}
              title={e.path}
            >
              <span className="tree-icon">{e.dir ? (open.has(e.path) ? '▾' : '▸') : ''}</span>
              {editing?.kind === 'rename' && editing.path === e.path ? nameInput(e.name) : <span className="tree-name">{e.name}</span>}
            </div>
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
