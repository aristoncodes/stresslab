// Sublime Text 4's menus, commands and default key bindings for the editor mode.
// One table drives the native menu bar (main process), the Command Palette and
// the Monaco key bindings (renderer), so a shortcut means the same thing everywhere.
//
// Item fields:
//   id     command id. "monaco:<action>" runs a built-in Monaco action; anything
//          else is handled by the editor (views/EditorView.jsx → commands).
//   label  as in Sublime's menu.
//   mac / win  shortcut on macOS / Windows+Linux, Electron accelerator syntax.
//          Two-step chords ("Cmd+K Cmd+B") can't be menu accelerators; they are
//          bound inside the editor and shown in the menu label instead.
//   role   a native Electron menu role (Undo, Copy, …).
// Sublime's ⌘⇧E ("Use Selection for Replace") is left unbound: StressLab uses
// ⌘⇧E to switch between the editor and the stress tester.

const sep = { type: 'separator' }
const m = (id, label, mac, win = mac?.replace(/Cmd/g, 'Ctrl')) => ({ id, label, mac, win })
const monaco = (action, label, mac, win) => m(`monaco:${action}`, label, mac, win)

export const EDITOR_MENUS = [
  {
    label: 'File',
    items: [
      m('newFile', 'New File', 'Cmd+N'),
      m('openFile', 'Open…', 'Cmd+O'),
      m('openFolder', 'Open Folder…', 'Cmd+Shift+O'),
      { id: 'openRecent', label: 'Open Recent', submenu: 'recent' },
      m('reopenClosed', 'Reopen Closed File', 'Cmd+Shift+T'),
      sep,
      m('save', 'Save', 'Cmd+S'),
      m('saveAs', 'Save As…', 'Cmd+Shift+S'),
      m('saveAll', 'Save All', 'Cmd+Alt+S'),
      m('reopenEncoding', 'Reopen with Encoding…'),
      m('saveEncoding', 'Save with Encoding…'),
      sep,
      m('revert', 'Revert File'),
      m('hexView', 'Open as Hex'),
      sep,
      m('closeFile', 'Close File', 'Cmd+W'),
      m('closeAll', 'Close All Files', 'Cmd+Alt+W'),
      m('closeWindow', 'Close Window', 'Cmd+Shift+W')
    ]
  },
  {
    label: 'Edit',
    items: [
      { role: 'undo' },
      { role: 'redo' },
      {
        label: 'Undo Selection',
        items: [monaco('cursorUndo', 'Soft Undo', 'Cmd+U'), monaco('cursorRedo', 'Soft Redo', 'Cmd+Shift+U')]
      },
      sep,
      { role: 'copy' },
      { role: 'cut' },
      { role: 'paste' },
      m('pasteIndent', 'Paste and Indent', 'Cmd+Shift+V'),
      { ...m('pasteHistory', 'Paste from History'), chord: { mac: 'Cmd+K Cmd+V', win: 'Ctrl+K Ctrl+V' } },
      sep,
      {
        label: 'Line',
        items: [
          monaco('editor.action.indentLines', 'Indent', 'Cmd+]'),
          monaco('editor.action.outdentLines', 'Unindent', 'Cmd+['),
          monaco('editor.action.reindentlines', 'Reindent'),
          monaco('editor.action.moveLinesUpAction', 'Swap Line Up', 'Ctrl+Cmd+Up', 'Ctrl+Shift+Up'),
          monaco('editor.action.moveLinesDownAction', 'Swap Line Down', 'Ctrl+Cmd+Down', 'Ctrl+Shift+Down'),
          monaco('editor.action.copyLinesDownAction', 'Duplicate Line', 'Cmd+Shift+D'),
          monaco('editor.action.deleteLines', 'Delete Line', 'Ctrl+Shift+K', 'Ctrl+Shift+K'),
          monaco('editor.action.joinLines', 'Join Lines', 'Cmd+J')
        ]
      },
      {
        label: 'Comment',
        items: [
          monaco('editor.action.commentLine', 'Toggle Comment', 'Cmd+/'),
          monaco('editor.action.blockComment', 'Toggle Block Comment', 'Cmd+Alt+/', 'Ctrl+Shift+/')
        ]
      },
      {
        label: 'Text',
        items: [
          monaco('editor.action.insertLineBefore', 'Insert Line Before', 'Cmd+Shift+Enter'),
          monaco('editor.action.insertLineAfter', 'Insert Line After', 'Cmd+Enter'),
          sep,
          monaco('deleteWordRight', 'Delete Word Forward', 'Alt+Delete', 'Ctrl+Delete'),
          monaco('deleteWordLeft', 'Delete Word Backward', 'Alt+Backspace', 'Ctrl+Backspace'),
          { ...monaco('deleteAllRight', 'Delete to End'), chord: { mac: 'Cmd+K Cmd+K', win: 'Ctrl+K Ctrl+K' } },
          { ...monaco('deleteAllLeft', 'Delete to Beginning'), chord: { mac: 'Cmd+K Cmd+Backspace', win: 'Ctrl+K Ctrl+Backspace' } },
          sep,
          monaco('editor.action.transposeLetters', 'Transpose', 'Ctrl+T', 'Ctrl+T')
        ]
      },
      {
        label: 'Mark',
        items: [
          { ...m('markSet', 'Set Mark'), chord: { mac: 'Cmd+K Cmd+Space', win: 'Ctrl+K Ctrl+Space' } },
          { ...m('markSelect', 'Select to Mark'), chord: { mac: 'Cmd+K Cmd+A', win: 'Ctrl+K Ctrl+A' } },
          { ...m('markDelete', 'Delete to Mark'), chord: { mac: 'Cmd+K Cmd+W', win: 'Ctrl+K Ctrl+W' } },
          { ...m('markSwap', 'Swap with Mark'), chord: { mac: 'Cmd+K Cmd+X', win: 'Ctrl+K Ctrl+X' } },
          { ...m('markClear', 'Clear Mark'), chord: { mac: 'Cmd+K Cmd+G', win: 'Ctrl+K Ctrl+G' } },
          sep,
          { ...m('yank', 'Yank'), chord: { mac: 'Cmd+K Cmd+Y', win: 'Ctrl+K Ctrl+Y' } }
        ]
      },
      {
        label: 'Code Folding',
        items: [
          monaco('editor.fold', 'Fold', 'Cmd+Alt+[', 'Ctrl+Shift+['),
          monaco('editor.unfold', 'Unfold', 'Cmd+Alt+]', 'Ctrl+Shift+]'),
          { ...monaco('editor.unfoldAll', 'Unfold All'), chord: { mac: 'Cmd+K Cmd+0', win: 'Ctrl+K Ctrl+0' } },
          { ...monaco('editor.foldAll', 'Fold All'), chord: { mac: 'Cmd+K Cmd+1', win: 'Ctrl+K Ctrl+1' } },
          ...[2, 3, 4, 5, 6, 7].map((n) => ({
            ...monaco(`editor.foldLevel${n}`, `Fold Level ${n}`),
            chord: { mac: `Cmd+K Cmd+${n}`, win: `Ctrl+K Ctrl+${n}` }
          })),
          monaco('editor.createFoldingRangeFromSelection', 'Fold Selection')
        ]
      },
      {
        label: 'Convert Case',
        items: [
          monaco('editor.action.transformToTitlecase', 'Title Case'),
          { ...monaco('editor.action.transformToUppercase', 'Upper Case'), chord: { mac: 'Cmd+K Cmd+U', win: 'Ctrl+K Ctrl+U' } },
          { ...monaco('editor.action.transformToLowercase', 'Lower Case'), chord: { mac: 'Cmd+K Cmd+L', win: 'Ctrl+K Ctrl+L' } },
          m('swapCase', 'Swap Case')
        ]
      },
      m('wrapParagraph', 'Wrap Paragraph at Ruler', 'Cmd+Alt+Q', 'Alt+Q'),
      monaco('editor.action.triggerSuggest', 'Show Completions', 'Ctrl+Space', 'Ctrl+Space'),
      sep,
      m('sortLines', 'Sort Lines', 'F5', 'F9'),
      m('sortLinesCase', 'Sort Lines (Case Sensitive)', 'Ctrl+F5', 'Ctrl+F9'),
      {
        label: 'Permute Lines',
        items: [m('linesReverse', 'Reverse'), m('linesUnique', 'Unique'), m('linesShuffle', 'Shuffle')]
      },
      {
        label: 'Permute Selections',
        items: [m('selSort', 'Sort'), m('selSortCase', 'Sort (Case Sensitive)'), m('selReverse', 'Reverse'), m('selUnique', 'Unique'), m('selShuffle', 'Shuffle')]
      }
    ]
  },
  {
    label: 'Selection',
    items: [
      monaco('editor.action.insertCursorAtEndOfEachLineSelected', 'Split into Lines', 'Cmd+Shift+L'),
      monaco('editor.action.insertCursorAbove', 'Add Previous Line', 'Ctrl+Shift+Up', 'Ctrl+Alt+Up'),
      monaco('editor.action.insertCursorBelow', 'Add Next Line', 'Ctrl+Shift+Down', 'Ctrl+Alt+Down'),
      m('singleSelection', 'Single Selection'),
      m('invertSelection', 'Invert Selection'),
      sep,
      { role: 'selectAll' },
      monaco('expandLineSelection', 'Expand Selection to Line', 'Cmd+L'),
      monaco('editor.action.addSelectionToNextFindMatch', 'Expand Selection to Word', 'Cmd+D'),
      m('selectParagraph', 'Expand Selection to Paragraph'),
      monaco('editor.action.smartSelect.expand', 'Expand Selection to Scope', 'Cmd+Shift+Space'),
      monaco('editor.action.selectToBracket', 'Expand Selection to Brackets', 'Ctrl+Shift+M', 'Ctrl+Shift+M'),
      m('selectIndentation', 'Expand Selection to Indentation', 'Cmd+Shift+J')
    ]
  },
  {
    label: 'Find',
    items: [
      monaco('actions.find', 'Find…', 'Cmd+F'),
      monaco('editor.action.nextMatchFindAction', 'Find Next', 'Cmd+G', 'F3'),
      monaco('editor.action.previousMatchFindAction', 'Find Previous', 'Cmd+Shift+G', 'Shift+F3'),
      monaco('actions.find', 'Incremental Find', 'Cmd+I'),
      sep,
      monaco('editor.action.startFindReplaceAction', 'Replace…', 'Cmd+Alt+F', 'Ctrl+H'),
      sep,
      monaco('editor.action.nextSelectionMatchFindAction', 'Quick Find', 'Cmd+Alt+G', 'Ctrl+F3'),
      monaco('editor.action.selectHighlights', 'Quick Find All', 'Ctrl+Cmd+G', 'Alt+F3'),
      monaco('editor.action.addSelectionToNextFindMatch', 'Quick Add Next', 'Cmd+D'),
      { ...monaco('editor.action.moveSelectionToNextFindMatch', 'Quick Skip Next'), chord: { mac: 'Cmd+K Cmd+D', win: 'Ctrl+K Ctrl+D' } },
      sep,
      monaco('actions.findWithSelection', 'Use Selection for Find', 'Cmd+E', 'Ctrl+E'),
      sep,
      m('findInFiles', 'Find in Files…', 'Cmd+Shift+F'),
      {
        label: 'Find Results',
        items: [m('showFindResults', 'Show Results Panel'), m('nextResult', 'Next Result', 'F4'), m('prevResult', 'Previous Result', 'Shift+F4')]
      }
    ]
  },
  {
    label: 'View',
    items: [
      {
        label: 'Side Bar',
        items: [{ ...m('toggleSidebar', 'Show/Hide Side Bar'), chord: { mac: 'Cmd+K Cmd+B', win: 'Ctrl+K Ctrl+B' } }]
      },
      m('toggleMinimap', 'Show/Hide Minimap'),
      m('toggleTabs', 'Show/Hide Tabs'),
      m('toggleStatusBar', 'Show/Hide Status Bar'),
      sep,
      { role: 'togglefullscreen', label: 'Enter/Exit Full Screen' },
      m('distractionFree', 'Enter/Exit Distraction Free Mode', 'Ctrl+Cmd+Shift+F', 'Shift+F11'),
      sep,
      {
        label: 'Layout',
        items: [
          m('layout:single', 'Single', 'Cmd+Alt+1', 'Alt+Shift+1'),
          m('layout:cols2', 'Columns: 2', 'Cmd+Alt+2', 'Alt+Shift+2'),
          m('layout:cols3', 'Columns: 3', 'Cmd+Alt+3', 'Alt+Shift+3'),
          m('layout:cols4', 'Columns: 4', 'Cmd+Alt+4', 'Alt+Shift+4'),
          m('layout:rows2', 'Rows: 2', 'Cmd+Alt+Shift+2', 'Alt+Shift+8'),
          m('layout:rows3', 'Rows: 3', 'Cmd+Alt+Shift+3', 'Alt+Shift+9'),
          m('layout:grid4', 'Grid: 4', 'Cmd+Alt+5', 'Alt+Shift+5'),
          sep,
          m('layout:cp', 'Competitive Programming: Code | Input / Output', 'Cmd+Alt+6', 'Alt+Shift+6')
        ]
      },
      {
        label: 'Groups',
        items: [
          m('cloneFile', 'Clone File'),
          sep,
          ...[1, 2, 3, 4].map((n) => m(`focusGroup:${n}`, `Focus Group ${n}`, `Ctrl+${n}`, `Ctrl+${n}`)),
          sep,
          ...[1, 2, 3, 4].map((n) => m(`moveToGroup:${n}`, `Move File to Group ${n}`, `Ctrl+Shift+${n}`, `Ctrl+Shift+${n}`))
        ]
      },
      sep,
      {
        label: 'Font',
        items: [
          monaco('editor.action.fontZoomIn', 'Larger', 'Cmd+=', 'Ctrl+='),
          monaco('editor.action.fontZoomOut', 'Smaller', 'Cmd+-', 'Ctrl+-'),
          monaco('editor.action.fontZoomReset', 'Reset')
        ]
      },
      { id: 'syntax', label: 'Syntax', submenu: 'syntax' },
      {
        label: 'Indentation',
        items: [
          m('indentSpaces', 'Indent Using Spaces'),
          ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => m(`tabWidth:${n}`, `Tab Width: ${n}`)),
          sep,
          monaco('editor.action.detectIndentation', 'Guess Settings From Buffer'),
          sep,
          monaco('editor.action.indentationToSpaces', 'Convert Indentation to Spaces'),
          monaco('editor.action.indentationToTabs', 'Convert Indentation to Tabs')
        ]
      },
      {
        label: 'Line Endings',
        items: [m('eol:lf', 'Unix'), m('eol:crlf', 'Windows')]
      },
      m('toggleWrap', 'Word Wrap', 'Cmd+Alt+Shift+W', 'Alt+Shift+W'),
      {
        label: 'Ruler',
        items: [m('ruler:0', 'None'), ...[70, 78, 80, 100, 120].map((n) => m(`ruler:${n}`, `${n}`))]
      },
      sep,
      m('toggleWhitespace', 'Show/Hide White Space')
    ]
  },
  {
    label: 'Goto',
    items: [
      m('gotoAnything', 'Goto Anything…', 'Cmd+P'),
      sep,
      m('gotoSymbol', 'Goto Symbol…', 'Cmd+R'),
      m('gotoSymbolProject', 'Goto Symbol in Project…', 'Cmd+Shift+R'),
      m('gotoDefinition', 'Goto Definition', 'Cmd+Alt+Down', 'F12'),
      m('gotoReference', 'Goto Reference', 'Cmd+Alt+Shift+Down', 'Shift+F12'),
      monaco('editor.action.gotoLine', 'Goto Line…', 'Ctrl+G', 'Ctrl+G'),
      sep,
      m('jumpBack', 'Jump Back', 'Ctrl+-', 'Alt+-'),
      m('jumpForward', 'Jump Forward', 'Ctrl+Shift+-', 'Alt+Shift+-'),
      m('nextModification', 'Next Modification'),
      m('prevModification', 'Previous Modification'),
      sep,
      {
        label: 'Switch File',
        items: [
          m('nextTab', 'Next File', 'Cmd+Alt+Right', 'Ctrl+PageDown'),
          m('prevTab', 'Previous File', 'Cmd+Alt+Left', 'Ctrl+PageUp'),
          m('nextTabStack', 'Next File in Stack', 'Ctrl+Tab', 'Ctrl+Tab'),
          m('prevTabStack', 'Previous File in Stack', 'Ctrl+Shift+Tab', 'Ctrl+Shift+Tab'),
          sep,
          ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => m(`tab:${n}`, `Tab ${n}`, `Cmd+${n}`, `Alt+${n}`))
        ]
      },
      {
        label: 'Bookmarks',
        items: [
          m('bookmarkToggle', 'Toggle Bookmark', 'Cmd+F2', 'Ctrl+F2'),
          m('bookmarkNext', 'Next Bookmark', 'F2'),
          m('bookmarkPrev', 'Previous Bookmark', 'Shift+F2'),
          m('bookmarkClear', 'Clear Bookmarks', 'Cmd+Shift+F2', 'Ctrl+Shift+F2'),
          m('bookmarkSelectAll', 'Select All Bookmarks', 'Alt+F2')
        ]
      },
      sep,
      monaco('editor.action.jumpToBracket', 'Jump to Matching Bracket', 'Ctrl+M', 'Ctrl+M'),
      monaco('editor.action.marker.next', 'Next Error', 'F8'),
      monaco('editor.action.marker.prev', 'Previous Error', 'Shift+F8')
    ]
  },
  {
    label: 'Tools',
    items: [
      m('commandPalette', 'Command Palette…', 'Cmd+Shift+P'),
      m('snippets', 'Snippets…'),
      sep,
      {
        label: 'Build System',
        items: [m('buildSystem:auto', 'Automatic'), sep, m('buildSystem:cpp', 'C++'), m('buildSystem:python', 'Python'), m('buildSystem:java', 'Java')]
      },
      m('build', 'Build', 'Cmd+B'),
      m('buildWith', 'Build With…', 'Cmd+Shift+B'),
      m('cancelBuild', 'Cancel Build', 'Cmd+.', 'Ctrl+.'),
      {
        label: 'Build Results',
        items: [m('togglePanel', 'Show/Hide Build Results'), m('nextResult', 'Next Result', 'F4'), m('prevResult', 'Previous Result', 'Shift+F4')]
      },
      sep,
      m('macroRecord', 'Record Macro', 'Ctrl+Q', 'Ctrl+Q'),
      m('macroPlay', 'Playback Macro', 'Ctrl+Shift+Q', 'Ctrl+Shift+Q'),
      m('macroSave', 'Save Macro…'),
      { id: 'macros', label: 'Macros', submenu: 'macros' },
      sep,
      {
        label: 'Developer',
        items: [m('newSnippet', 'New Snippet…'), m('openSnippetsFolder', 'Open Snippets Folder'), monaco('editor.action.inspectTokens', 'Show Scope Name', 'Ctrl+Alt+Shift+P', 'Ctrl+Alt+Shift+P')]
      }
    ]
  },
  {
    label: 'Project',
    items: [
      m('addFolder', 'Change Project Folder…'),
      m('removeFolders', 'Remove all Folders from Project'),
      m('refreshFolders', 'Refresh Folders'),
      sep,
      m('gitRefresh', 'Refresh Git Status')
    ]
  }
]

// Flat list of every command (for the Command Palette and key bindings).
export function flattenCommands(menus = EDITOR_MENUS, path = []) {
  const out = []
  for (const menu of menus) {
    const items = menu.items ?? []
    for (const it of items) {
      if (it.items) out.push(...flattenCommands([it], [...path, menu.label]))
      else if (it.id && !it.submenu) out.push({ ...it, path: [...path, menu.label] })
    }
  }
  return out
}
