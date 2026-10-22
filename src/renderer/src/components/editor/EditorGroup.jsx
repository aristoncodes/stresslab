import Editor from '@monaco-editor/react'
import { baseName, modelPath } from '../../lib/files'

const TAB_MIME = 'application/x-stresslab-tab'

// One layout group: its tab bar and a Monaco editor showing the current tab.
// Models are created by the buffer manager, so the editor only switches between them.
export default function EditorGroup({
  index,
  group,
  focused,
  showTabs,
  theme,
  options,
  isDirty,
  onFocus,
  onSelect,
  onClose,
  onTabMenu,
  onMoveTab,
  onPin,
  onMount,
  empty
}) {
  const dropOn = (e, toIndex) => {
    const raw = e.dataTransfer.getData(TAB_MIME)
    if (!raw) return
    e.preventDefault()
    e.stopPropagation()
    const { path, from } = JSON.parse(raw)
    onMoveTab(path, from, index, toIndex)
  }
  const allowDrop = (e) => e.dataTransfer.types.includes(TAB_MIME) && e.preventDefault()

  return (
    <div className={`editor-group ${focused ? 'focused' : ''}`} onMouseDown={onFocus}>
      {showTabs && (
        <div className="tab-bar" onDragOver={allowDrop} onDrop={(e) => dropOn(e, group.tabs.length)}>
          {group.tabs.map((p, i) => (
            <div
              key={p}
              className={`tab ${p === group.current ? 'active' : ''} ${isDirty(p) ? 'dirty' : ''} ${p === group.preview ? 'preview' : ''}`}
              draggable
              onDragStart={(e) => e.dataTransfer.setData(TAB_MIME, JSON.stringify({ path: p, from: index }))}
              onDragOver={allowDrop}
              onDrop={(e) => dropOn(e, i)}
              onClick={() => onSelect(p)}
              onDoubleClick={() => onPin(p)}
              onAuxClick={(e) => e.button === 1 && onClose(p)}
              onContextMenu={(e) => {
                e.preventDefault()
                onTabMenu(p)
              }}
              title={p.replace(/^user:/, 'User/').replace(/^default:/, 'Default/')}
            >
              <span className="tab-name">{baseName(p.replace(/^(user|default):/, ''))}</span>
              <button
                className="tab-close"
                onClick={(e) => {
                  e.stopPropagation()
                  onClose(p)
                }}
                aria-label={`Close ${baseName(p)}`}
              />
            </div>
          ))}
        </div>
      )}
      <div className="editor-host">
        {group.current ? (
          <Editor path={modelPath(group.current)} theme={theme} options={options} onMount={(editor, monaco) => onMount(index, editor, monaco)} />
        ) : (
          empty
        )}
      </div>
    </div>
  )
}
