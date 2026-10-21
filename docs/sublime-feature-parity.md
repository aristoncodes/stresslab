# Sublime Text 4 vs StressLab Editor — feature parity

Checked on 2026-10-21 against StressLab `main` (commit 0c910c9). The editor is built on **Monaco**, VS Code's editor engine; its 130 built-in commands were listed from the running app (F1 palette) and compared with Sublime Text 4's feature list.

**Legend**
- ✅ **Have:** works today.
- 🔑 **Have, different key:** the command exists in Monaco but isn't on Sublime's shortcut. A one-line key binding fixes it.
- ➕ **Missing, worth adding:** useful for competitive programming; can be built.
- ⛔ **Not planned:** not possible in this architecture, or not worth it for a CP editor (reason given).

## Summary

| Area | Verdict |
|---|---|
| 1. Core / platform | Cross-platform, auto-reload, portable ✅ · hot exit, auto-save ➕ · native speed, multi-window ⛔ |
| 2. Editing | **Strongest area**: multi-cursor, line ops, folding, case/sort/trim ✅ · ~14 commands only need Sublime's keys 🔑 · bookmarks, clipboard history, shuffle/swap case ➕ · macros, spell check, HTML tags ⛔ |
| 3. Navigation | Goto Line, editor command palette ✅ · Goto Anything, symbols, app Command Palette, jump back ➕ · definitions/hover (need language servers) ⛔ |
| 4. Search & replace | In-file find/replace complete ✅ · Find/Replace in Files ➕ |
| 5. Auto-complete & snippets | Word completion, fuzzy, snippet engine ✅ · actual snippets ➕ · API completions ⛔ |
| 6. Projects, sidebar, files | Sidebar file ops, Save All ✅ · reopen closed tab, revert, recent menu, find in folder, drag-in ➕ · projects, Git, encodings, hex ⛔ |
| 7. Interface & layout | Minimap, guides, full screen, modified tabs ✅ · free splits, tab menu, distraction-free, rulers, wrap ➕ |
| 8. Syntax & themes | Many languages, Mariana, Adaptive-style UI ✅ · more schemes/light ➕ · Sublime resource formats ⛔ |
| 9. Build systems | ⌘B, panel, error marks, cancel, save-before-build ✅ · clickable errors, variants ➕ · custom `.sublime-build` ⛔ |
| 10–13. Customization, CLI, plugins | Settings subset, CLI ➕ · keymaps, plugin API, packages ⛔ |

Most of Sublime's **editing** core is already there (multi-cursor, line operations, folding, find/replace, case transforms, sort). The biggest gaps are **navigation** (Goto Anything, Command Palette for app commands, symbol jump), **layout** (free split layouts, tab menus) and **file management** (reopen closed tab, revert, find in files, hot exit). Sublime's **plugin/package ecosystem** has no equivalent and isn't planned.

---

## 1. Core / platform

| Sublime feature | Status | StressLab |
|---|---|---|
| Native C++ app, custom UI toolkit | ⛔ | Electron (web technologies); can't be changed without a rewrite |
| Very fast startup, low memory, huge files | ⛔ | Electron start-up ~1 s; files capped at 5 MB |
| Windows, macOS, Linux | ✅ | v1.1.0: macOS arm64, Windows x64, Linux x64 |
| Linux ARM64, macOS Intel | ➕ | CI can add arm64/x64 targets |
| GPU-accelerated rendering | ✅ | Chromium/Monaco render on the GPU |
| HiDPI / dark mode | ✅ | |
| Portable mode (Windows) | ✅ | portable .zip |
| Installers, package managers | ✅ | installers + .deb/AppImage (no Homebrew/apt repo) |
| Stable/Dev channels, licence nag | ⛔ | not applicable |
| Multi-window, drag files between windows | ⛔ | one main window by design |
| Hot exit (unsaved work restored) | ➕ | planned (PRD R22) |
| Auto-reload on external change | ✅ | clean buffers reload; dirty ones ask |
| Auto-save on focus loss | ➕ | planned (PRD R24) |

## 2. Editing

| Sublime feature | Status | StressLab |
|---|---|---|
| Multiple cursors / selections | ✅ | |
| Ctrl+D next occurrence | ✅ | "Add Selection to Next Find Match" |
| Ctrl+K, Ctrl+D skip occurrence | ✅ | "Move Last Selection to Next Find Match" |
| Alt+F3 / ⌃⌘G select all occurrences | ✅ | bound by StressLab |
| Ctrl+Alt+Up/Down add cursor above/below | 🔑 | "Add Cursor Above/Below" (Monaco: ⌥⌘↑/↓) |
| Ctrl+Click adds a cursor | 🔑 | Monaco uses Alt+Click; one setting (`multiCursorModifier`) |
| Column selection (Shift+right-drag / middle drag) | 🔑 | Monaco: Shift+Alt+drag |
| Ctrl+Shift+L split selection into lines | ✅ | bound by StressLab |
| Paste lines into multiple cursors | ✅ | spreads one line per cursor |
| Undo/redo selection (Ctrl+U / Ctrl+Shift+U) | ✅ | "Cursor Undo/Redo" |
| Ctrl+L select line | ✅ | "Expand Line Selection" |
| Ctrl+Shift+M select inside brackets | 🔑 | "Select to Bracket" |
| Ctrl+Shift+Space expand selection to scope | 🔑 | "Expand Selection" (Monaco: ⌃⇧⌘→) |
| Ctrl+Shift+J expand to indentation | ➕ | small custom command |
| Select to tag / Ctrl+Shift+A | ⛔ | HTML-only; not relevant to CP |
| Ctrl+Shift+D duplicate line | ✅ | bound by StressLab |
| Ctrl+Shift+K delete line | ✅ | |
| Move line up/down | ✅ | bound by StressLab |
| Ctrl+J join lines | ✅ | bound by StressLab |
| Ctrl+Enter / Ctrl+Shift+Enter insert line after/before | ✅ | |
| Copy/cut whole line with no selection | ✅ | |
| Ctrl+K, Ctrl+K delete to end of line | 🔑 | "Delete All Right" |
| Ctrl+K, Ctrl+Backspace delete to start | 🔑 | "Delete All Left" |
| Ctrl+T transpose | 🔑 | "Transpose Letters" |
| Sort lines (F9), case-sensitive sort | 🔑 | "Sort Lines Ascending/Descending" |
| Permute lines: reverse / unique / shuffle | ✅ / ✅ / ➕ | "Reverse lines", "Delete Duplicate Lines"; shuffle missing |
| Upper/lower/title case | ✅ | + camel/snake/kebab/Pascal |
| Swap case | ➕ | small custom command |
| Wrap paragraph at ruler (Alt+Q) | ➕ | small custom command |
| Convert indentation tabs ↔ spaces | ✅ | |
| Trim trailing whitespace | ✅ | |
| Ensure newline at end of file | ✅ | "Insert Final New Line" (not automatic on save yet) |
| Line-ending conversion | ➕ | model EOL switch + status-bar picker |
| Mark / kill ring (Emacs) | ⛔ | niche |
| Clipboard history (Ctrl+K, Ctrl+V) | ➕ | small history list |
| Paste and indent (Ctrl+Shift+V) | 🔑 | "Reindent Selected Lines" after paste |
| Drag and drop text | ✅ | |
| Auto-indent, smart indent, detect indentation | ✅ | |
| Tab size / translate tabs to spaces | ✅ | |
| Indent / unindent (Ctrl+] / Ctrl+[) | ✅ | |
| Auto-pair brackets and quotes | ✅ | |
| Close tag (Alt+.) | ⛔ | HTML-only |
| Bracket matching highlight | ✅ | + bracket-pair colours |
| Ctrl+M jump to matching bracket | 🔑 | "Go to Bracket" |
| Line comment Ctrl+/ | ✅ | |
| Block comment Ctrl+Shift+/ | 🔑 | "Toggle Block Comment" |
| Fold / unfold (Ctrl+Shift+[ / ]) | 🔑 | "Fold / Unfold" (Monaco: ⌥⌘[ / ]) |
| Fold level 1–9 (Ctrl+K, Ctrl+1…9) | ✅ | levels 1–7 |
| Unfold all (Ctrl+K, Ctrl+0) | 🔑 | "Unfold All" (Monaco: ⌘K ⌘J) |
| Fold selection | ✅ | "Create Folding Range from Selection" |
| Gutter fold arrows | ✅ | |
| Bookmarks (Ctrl+F2, F2, Shift+F2, clear, select all) | ➕ | gutter decorations + commands |
| Full undo/redo | ✅ | |
| Soft undo | ✅ | "Cursor Undo" covers selection steps |
| Persistent per-file undo history | ➕ | with hot exit |
| Spell checking (F6) | ⛔ | not useful for code |
| Macros (record / play / save) | ⛔ | niche; multi-cursor covers most uses |

## 3. Navigation

| Sublime feature | Status | StressLab |
|---|---|---|
| Goto Anything (Ctrl+P) fuzzy file search | ➕ | planned (PRD R14) |
| `@symbol`, `:line`, `#text` modifiers, live preview | ➕ | with Goto Anything |
| Goto Symbol (Ctrl+R) | ➕ | needs a symbol list: regex-based for C++/Python/Java functions |
| Goto Symbol in Project (Ctrl+Shift+R) | ➕ | same index across files |
| Goto Line (Ctrl+G) | ✅ | |
| Goto Definition / References (F12) | ⛔ | needs language servers (clangd/pyright/jdtls) — PRD non-goal |
| Hover popups for definitions | ⛔ | same |
| Jump back / forward | ➕ | cursor-history stack |
| Next / previous modification | ➕ | needs diff against saved text |
| Ctrl+Tab cycle tabs | 🔑 | small key binding |
| Command Palette (Ctrl+Shift+P) | ✅ (editor) / ➕ (app) | F1 lists editor commands; app commands (Build, Layout, Stress Test…) planned (PRD R15) |

## 4. Search and replace

| Sublime feature | Status | StressLab |
|---|---|---|
| Find (Ctrl+F), Replace (Ctrl+H) | ✅ | |
| Incremental find | ✅ | Monaco's find is incremental |
| Regex, capture groups, lookahead | ✅ | |
| Case / whole word / wrap / in selection | ✅ | |
| Highlight all matches incl. minimap | ✅ | |
| Preserve-case replace | ✅ | |
| Quick Find (Ctrl+F3), Find Under Expand | 🔑 | "Find Next Selection" |
| Find history | ✅ | |
| Find in Files (Ctrl+Shift+F) with Where filter, wildcards, scopes | ➕ | main-process search confined to the folder |
| Results buffer with context lines | ➕ | with Find in Files |
| Replace across files | ➕ | |
| Multi-selection from search results | ✅ | "Select All Occurrences of Find Match" |

## 5. Auto-complete and snippets

| Sublime feature | Status | StressLab |
|---|---|---|
| Completions from words in open files | ✅ | |
| Fuzzy matching | ✅ | |
| Completion kinds with icons | ✅ | |
| API / language completions | ⛔ | needs language servers |
| Snippets with tab triggers | ➕ | planned (PRD R17): `cp`, `dfs`, `dsu`, `segtree`… |
| Placeholders, mirrors, nesting, variables | ✅ (engine) | Monaco's snippet engine supports them; no snippets defined yet |
| Regex transforms in placeholders | ✅ (engine) | |
| `.sublime-completions` / plugin API | ⛔ | no plugin system |
| User-defined snippets | ➕ | snippets folder in settings |

## 6. Projects, sidebar and files

| Sublime feature | Status | StressLab |
|---|---|---|
| Folder sidebar | ✅ | one root folder |
| Multiple root folders | ➕ | |
| `.sublime-project` / workspace files, per-project settings | ⛔ | one folder = one workspace |
| Exclude patterns | 🟨 ✅ | fixed list (`.git`, `node_modules`, …); not configurable |
| Quick-switch projects | ➕ | recent folders are stored but not shown in a menu yet |
| New / rename / delete / reveal | ✅ | native right-click menu |
| Duplicate / move / copy path / find in folder | ➕ | |
| Preview tabs (single-click opens a temporary tab) | ➕ | |
| File-type icons | ➕ | |
| Git status in sidebar / gutter / status bar, diff popups | ⛔ | PRD non-goal |
| Sublime Merge integration | ⛔ | |
| Encodings: reopen / save with encoding | ⛔ | UTF-8 only (fine for CP) |
| Hex view | ⛔ | |
| Reopen closed tab (Ctrl+Shift+T) | ➕ | |
| Recent files and folders | 🟨 ✅ | last folder reopens; no menu list yet ➕ |
| Revert file | ➕ | |
| Save All | ✅ | |
| Read-only toggle | ➕ | |
| Save to protected locations (elevation) | ⛔ | |
| Drag files/folders from the OS into the window | ➕ | |

## 7. Interface and layout

| Sublime feature | Status | StressLab |
|---|---|---|
| Split layouts: columns, rows, grid (Alt+Shift+1…5) | 🟨 | fixed "CP" layout only; free splits ➕ (PRD R16) |
| Clone a file into two views | ➕ | |
| Focus / move to groups (Ctrl+1…4) | ➕ | with free splits |
| Tab drag-reorder / between groups | ➕ | |
| Tab context menu (close others / to the right) | ➕ | |
| Distraction Free (Shift+F11) | ➕ | planned (PRD R25) |
| Full Screen (F11) | ✅ | View → Toggle Full Screen |
| Minimap with selection/find highlights | ✅ | |
| Rulers | ➕ | Monaco option + setting |
| Indent guides | ✅ | |
| Show whitespace | ✅ | on selection; setting ➕ |
| Line numbers, gutter icons | ✅ | |
| Word wrap with column | ➕ | Monaco option + setting/toggle |
| Status bar: syntax ✅, indentation 🟨, encoding ➕, line endings ➕ | 🟨 | indentation is shown as fixed "Spaces: 4"; should reflect the file |
| Customizable / hideable menu bar | ⛔ | native menu |
| Zoom (Ctrl+Scroll) | 🔑 | font size commands exist; `mouseWheelZoom` setting |
| Font ligatures | ➕ | Monaco option + setting |
| Caret styles (smooth, phase, blink, solid; block/wide) | ✅ | smooth caret; style setting ➕ |
| Highlight current line | ✅ | |
| Highlight modified tabs | ✅ | ● dot |
| Double-click word, triple-click line | ✅ | |
| Click/drag line numbers to select lines | ✅ | |
| Mouse back/forward buttons | ➕ | with jump back/forward |

## 8. Syntax, themes and colour schemes

| Sublime feature | Status | StressLab |
|---|---|---|
| Built-in syntaxes (C, C++, Java, Python, JS, JSON, Markdown, Go, Rust…) | ✅ | Monaco ships ~80 languages; StressLab maps the common CP extensions |
| Syntax auto-detection by extension | ✅ | |
| Detection by first line / per-syntax settings | ➕ | |
| Show scope name | ✅ | "Developer: Inspect Tokens" |
| `.sublime-syntax` / `.tmLanguage` files, syntax tests | ⛔ | Monaco uses its own grammar format |
| Mariana colour scheme | ✅ | |
| Other schemes (Monokai, Breakers, Sixteen), light variants | ➕ | define as Monaco themes + setting |
| `.sublime-color-scheme` / `.tmTheme` files | ⛔ | |
| Adaptive UI theme (UI follows the scheme) | ✅ | sidebar/tabs/status bar match Mariana |
| `.sublime-theme` custom UI themes | ⛔ | |

## 9. Build systems

| Sublime feature | Status | StressLab |
|---|---|---|
| Ctrl+B build | ✅ | C++ / Python / Java, `inputf.in` → `outputf.in` |
| Output panel | ✅ | `[Finished in …s]`, Esc hides |
| Errors marked in the code | ✅ | underlined at the reported line |
| Clickable error lines in the panel | ➕ | |
| F4 / Shift+F4 next/previous error | 🔑 | "Go to Next/Previous Problem" (Monaco: F8) |
| Cancel build | ✅ | ⌘. / Ctrl+. |
| Save all before build | ✅ | |
| Ctrl+Shift+B build variants | ➕ | e.g. "Run with input file" / "Run in stress tester" / debug flags |
| Custom `.sublime-build` files, variables, selectors | ⛔ | fixed toolchains + C++ flags in Settings |

## 10–13. Customization, command line, plugins, packages

| Sublime feature | Status | StressLab |
|---|---|---|
| Layered JSON settings, hundreds of options | ➕ (subset) | planned editor settings: font, size, tab size, wrap, rulers, minimap, theme, auto-save |
| `.sublime-keymap` / mousemap / menu files | ⛔ | fixed Sublime-style bindings |
| `subl` command-line tool | ➕ | could open a folder/file from the terminal; low priority |
| Python plugin API, Package Control, community packages (LSP, linters, Terminus…) | ⛔ | no plugin system; LSP and terminal are PRD non-goals |

---

## Recommended next steps

**1. Quick wins (about an hour): put the 🔑 commands on Sublime's keys.** Ctrl+Click cursors, Ctrl+Alt+↑/↓, Ctrl+Shift+M, Ctrl+Shift+Space, Ctrl+K Ctrl+K / Ctrl+K Ctrl+Backspace, Ctrl+T, F9, Ctrl+M, Ctrl+Shift+/, fold keys, Ctrl+K Ctrl+0, Ctrl+F3, F4/Shift+F4, Ctrl+Tab, Ctrl+Scroll zoom; status bar showing the file's real indentation.

**2. The planned power features (PRD E-M3):** Goto Anything (with `@`/`:`), Command Palette for app commands, free split layouts, CP snippets, hot exit, auto-save, editor settings, Distraction Free.

**3. Worth adding after that:** reopen closed tab, revert file, tab context menu, Find in Files, bookmarks, recent-folders menu, drag files from the OS, clickable build errors, build variants, swap case / shuffle / expand to indentation, rulers, word wrap, line-ending picker.

**Not planned (⛔):** anything that depends on Sublime's native engine or plugin ecosystem: native C++ speed, plugins/packages, `.sublime-*` resource files, LSP-based definitions/hovers, Git, encodings/hex view, macros, spell check, multi-window.
