# Sublime Text 4 vs StressLab Editor — feature parity

Updated 2026-10-22 after the "everything Sublime" rebuild (v1.2.0 work). First checked on 2026-10-21 against commit 0c910c9. The editor is built on **Monaco** (VS Code's editor engine). Every Sublime menu command lives in one table, [src/shared/editorCommands.js](../src/shared/editorCommands.js). That table drives the native menu bar, the key bindings and the Command Palette.

**Legend**
- ✅ **Have:** works, on Sublime's menu location and key.
- 🟨 **Approximation:** works, but behaves a little differently from Sublime (the difference is described).
- ⛔ **Not possible / not planned:** reason given.

## Summary

| Area | Verdict |
|---|---|
| 1. Core / platform | Cross-platform, auto-reload, hot exit, save on focus lost ✅ · native speed, multi-window ⛔ |
| 2. Editing | Multi-cursor, line ops, folding, case/sort/permute, swap case, wrap paragraph, bookmarks, mark/yank, paste history, paste and indent, macros ✅ · spell check, HTML tags ⛔ |
| 3. Navigation | Goto Anything (`@` `:` `#`, live preview), Goto Symbol / in Project, Goto Definition / Reference 🟨, jump back/forward, next modification, Command Palette ✅ |
| 4. Search & replace | In-file find ✅ · Find / Replace in Files with Where filter, results panel, F4 ✅ |
| 5. Snippets | Sublime's built-in C/C++, Python and Java snippets + CP snippets, user `.sublime-snippet` files, New Snippet ✅ |
| 6. Files & sidebar | Preview tabs, reopen closed, revert, Save As, recent folders, drag in, duplicate/copy path/find in folder, file icons, exclude patterns, Git badges/gutter/branch, encodings, hex view ✅ · multiple root folders, `.sublime-project` ⛔ |
| 7. Layout | Columns/rows/grid layouts, focus/move group, clone file, tab drag between groups, tab menu, distraction free, rulers, wrap ✅ |
| 8. Themes | Mariana ✅ · Monokai, Breakers, Celeste, Sixteen 🟨 · `.sublime-color-scheme` files ⛔ |
| 9. Build | ⌘B, Build With variants, build system menu, clickable errors, F4, cancel ✅ · custom `.sublime-build` files ⛔ |
| 10–13. Customization | Sublime-named JSON settings (Default \| User side by side) ✅ · command line `subl`, keymap files, plugins/packages ⛔ |

---

## 1. Core / platform

| Sublime feature | Status | StressLab |
|---|---|---|
| Native C++ app, custom UI toolkit | ⛔ | Electron; would need a full rewrite |
| Very fast startup, huge files | ⛔ | ~1 s start; files capped at 5 MB |
| Windows, macOS, Linux | ✅ | macOS arm64, Windows x64, Linux x64 |
| Hot exit (unsaved work restored) | ✅ | `hot_exit` setting; tabs, layout and unsaved text come back on restart |
| Auto-reload on external change | ✅ | clean buffers reload; dirty ones ask |
| Save on focus lost | ✅ | `save_on_focus_lost` |
| Multi-window (File → New Window) | ⛔ | one main window; the menu item is removed |
| `subl` command-line tool | ⛔ | not built yet |

## 2. Editing

| Sublime feature | Status | StressLab |
|---|---|---|
| Multiple cursors, ⌘D, ⌘K ⌘D, ⌃⌘G, ⌘⇧L | ✅ | Sublime keys |
| ⌘-click adds a cursor, ⌃⇧↑/↓ add line | ✅ | |
| Column selection | 🟨 | Shift+Alt+drag (Monaco), not middle-drag |
| ⌘L, ⌘⇧M, ⌘⇧J, ⌘⇧Space expand selection | ✅ | to line / brackets / indentation / scope |
| Expand to paragraph, single selection, invert selection | ✅ | |
| Duplicate, delete, move, join lines, insert line before/after | ✅ | |
| ⌘K ⌘K / ⌘K ⌘⌫ delete to end/start, ⌃T transpose | ✅ | |
| Sort (F5 / ⌃F5), permute lines: reverse, unique, shuffle | ✅ | whole file when nothing is selected |
| Permute selections | ✅ | |
| Upper / lower / title / swap case | ✅ | |
| Wrap paragraph at ruler (⌘⌥Q) | ✅ | keeps indentation and comment prefix |
| Mark: set / select / delete / swap / clear, yank (⌘K ⌘Space …) | 🟨 | Swap with Mark moves the caret to the mark and sets a new mark at the old caret |
| Paste and indent (⌘⇧V), paste from history (⌘K ⌘V) | ✅ | history keeps the last 15 copies |
| Bookmarks (⌘F2, F2, ⇧F2, clear, select all) | ✅ | gutter markers |
| Line comment, block comment, fold / unfold, fold levels | ✅ | |
| Indentation: spaces/tabs, tab width, convert, guess from buffer | ✅ | also clickable in the status bar |
| Line endings Unix / Windows | ✅ | View menu + status bar |
| Macros: record (⌃Q), play (⌃⇧Q), save, Tools → Macros | 🟨 | records keystrokes and commands; IME/composed input isn't recorded |
| Spell check, HTML tag commands | ⛔ | not useful for CP |

## 3. Navigation

| Sublime feature | Status | StressLab |
|---|---|---|
| Goto Anything (⌘P) with live preview | ✅ | `file`, `file@symbol`, `file:line`, `file#text`; Esc returns to where you were |
| Goto Symbol (⌘R), Goto Symbol in Project (⌘⇧R) | 🟨 | symbols found by regex (functions, classes, structs) for C/C++, Java, Python, JS, not a full parser |
| Goto Definition (⌘⌥↓ / F12) / Goto Reference (⌘⌥⇧↓ / ⇧F12) | 🟨 | definition = symbol index lookup; references = whole-word search in the project (no language server) |
| Goto Line (⌃G) | ✅ | |
| Jump back / forward (⌃- / ⌃⇧-) | ✅ | |
| Next / previous modification | ✅ | compared with the saved text |
| ⌃Tab (recent order), ⌘⌥←/→, ⌘1…9 | ✅ | |
| Command Palette (⌘⇧P) | ✅ | every menu command, syntaxes, colour schemes, snippets, Monaco actions |

## 4. Search and replace

| Sublime feature | Status | StressLab |
|---|---|---|
| Find, Replace, incremental, regex, case, whole word, in selection | ✅ | |
| Quick Find / Find Under Expand | ✅ | |
| Find in Files (⌘⇧F), Where filter (`*.cpp, -tests/`) | ✅ | searched in the main process, confined to the folder |
| Results panel, F4 / ⇧F4 | ✅ | results grouped by file; click to open |
| Replace in Files | ✅ | regex `$1` supported; asks before writing |

## 5. Auto-complete and snippets

| Sublime feature | Status | StressLab |
|---|---|---|
| Word completions, fuzzy matching | ✅ | |
| Sublime's built-in snippets | ✅ | C/C++ (`main`, `for`, `fori`, `class`, `struct`, `printf`…), Python (`def`, `class`, `ifmain`, `try`…), Java (`main`, `pl`, `fe`…) |
| CP snippets | ✅ | `cp`, `fastio`, `dsu`, `segtree`, `bfs`, `dfs`, `binpow`, `sieve`, `pyfast`, `jfast` |
| Tab trigger, placeholders, mirrors | ✅ | Monaco's snippet engine |
| Sublime's conditional formats `(?1:…)` | 🟨 | not supported by Monaco; affected built-ins were simplified |
| User `.sublime-snippet` files, Tools → Developer → New Snippet | ✅ | saved under the app's `User/snippets` folder; reload on save |
| API completions, `.sublime-completions` | ⛔ | needs language servers / plugin API |

## 6. Projects, sidebar and files

| Sublime feature | Status | StressLab |
|---|---|---|
| Folder sidebar, new / rename / delete / reveal | ✅ | |
| Duplicate, copy path / name, find in folder | ✅ | right-click menu |
| File-type icons | 🟨 | small coloured labels instead of Sublime's icon set |
| `file_exclude_patterns` | ✅ | Sublime's defaults (`*.o`, `*.exe`, `*.class`, …) |
| Preview tabs (single click), double click pins | ✅ | `preview_on_click` |
| Reopen closed file (⌘⇧T), revert, Save As, Save All | ✅ | |
| Open Recent | ✅ | File → Open Recent |
| Drag files / folders from the OS | ✅ | |
| Git: branch in status bar, sidebar badges, gutter changes | ✅ | needs `git` installed; works when the folder is inside a repo |
| Reopen / Save with Encoding | ✅ | read: 14 encodings; write: UTF-8 (± BOM), UTF-16 LE/BE, Latin-1 |
| Hex view | ✅ | read-only dump of the first 1 MB |
| Multiple root folders | ⛔ | one folder per window; "Change Project Folder…" replaces it |
| `.sublime-project` files, per-project settings | ⛔ | |

## 7. Interface and layout

| Sublime feature | Status | StressLab |
|---|---|---|
| Layouts: single, 2/3/4 columns, 2/3 rows, grid (⌘⌥1…5, ⌘⌥⇧2/3) | ✅ | + StressLab's CP layout (code \| input / output) |
| Focus group (⌃1…4), move file to group (⌃⇧1…4) | ✅ | |
| Clone file, tab drag reorder and between groups | ✅ | |
| Tab menu: close, close others, close to the right, copy path, reveal | ✅ | |
| Distraction Free (⌃⌘⇧F) | ✅ | full screen, no chrome, centred text |
| Rulers, word wrap, show whitespace, minimap, tabs, status bar, sidebar toggles | ✅ | View menu and settings |
| Status bar: line/column, selections, indentation, line endings, encoding, syntax | ✅ | clickable menus like Sublime |
| Zoom (⌘-scroll), ligatures, caret style, line padding | ✅ | settings |
| Customizable menu bar | ⛔ | native menu |

## 8. Syntax, themes and colour schemes

| Sublime feature | Status | StressLab |
|---|---|---|
| Syntax per file, View → Syntax, status bar picker | ✅ | |
| Mariana | ✅ | |
| Monokai, Breakers, Celeste, Sixteen | 🟨 | recreated as Monaco themes; close to Sublime's colours, not token-for-token identical |
| Adaptive UI (sidebar, tabs, stress tester follow the scheme) | ✅ | |
| Select Color Scheme with live preview | ✅ | saved to the user Preferences |
| `.sublime-syntax`, `.sublime-color-scheme`, `.sublime-theme` files | ⛔ | Monaco uses its own formats |

## 9. Build systems

| Sublime feature | Status | StressLab |
|---|---|---|
| ⌘B build, output panel, `[Finished in …]` | ✅ | `inputf.in` → `outputf.in` |
| Tools → Build System (Automatic / C++ / Python / Java) | ✅ | |
| ⌘⇧B Build With: Run, Compile, Stress Test as Solution / Brute | ✅ | |
| Clickable error lines, F4 / ⇧F4, errors underlined | ✅ | |
| Cancel build (⌘. / Ctrl+.) | ✅ | Sublime uses ⌃C on macOS |
| Custom `.sublime-build` files | ⛔ | fixed toolchains + C++ flags in Settings |

## 10–13. Customization, command line, plugins, packages

| Sublime feature | Status | StressLab |
|---|---|---|
| Layered JSON settings | ✅ | Preferences → Editor Settings opens Default \| User side by side, Sublime setting names |
| Key Bindings list | 🟨 | searchable list of every binding; bindings can't be remapped yet |
| `.sublime-keymap` / mousemap files | ⛔ | |
| Python plugin API, Package Control, packages | ⛔ | no plugin system |

---

## Known differences

- **⌘⇧E** switches between the editor and the stress tester. In Sublime it is "Use Selection for Replace", which is left unbound.
- **Multi-window** and **multiple root folders** would need the main process to track a folder per window. This is the largest remaining gap.
- **Command line** (`subl`-style open): not built yet.
