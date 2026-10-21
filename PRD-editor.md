# PRD — StressLab Editor (Sublime-style code editor)

**Status:** Approved · **Date:** 2026-10-21 · **Owner:** aristoncodes
**Builds on:** [PRD.md](PRD.md), [PRD-cross-platform.md](PRD-cross-platform.md) · **Target release:** v1.2.0

---

## 1. Summary

Add a second mode to StressLab: a **fast, minimal, keyboard-driven code editor in the style of Sublime Text**, made for competitive programming. You write and run your solution in the **Editor**, and one switch (**Editor | Stress Test**) takes the same code into the stress tester, where a failing test can be sent back to the editor as a test case.

The editing engine is **Monaco**, the same editor core as VS Code, already bundled in StressLab. This PRD adds the Sublime-style shell around it: a folder sidebar, tabs, Goto Anything, a Command Palette, split layouts, a Monokai-style theme, a **Build (⌘B)** that compiles and runs with input, and a CP test-case panel.

## 2. Goals and non-goals

**Goals**
- E1. Feel like Sublime Text: instant, minimal chrome, dark Monokai-style theme, everything reachable from the keyboard.
- E2. Write → build → run on inputs → compare with expected output, without leaving the app (like Sublime's build system plus a CP test panel).
- E3. One click between **Editor** and **Stress Test**, with code flowing both ways.
- E4. Works the same on macOS, Windows and Linux; **no native modules** (keeps the v1.1 builds and CI unchanged).
- E5. Safe: the page never touches the disk directly; all file access goes through validated IPC and stays inside the opened folder.

**Non-goals (v1.2)**
- Integrated terminal (Sublime has none; it would need the native `node-pty` module on every OS).
- Language servers / full IntelliSense (clangd, pyright, jdtls): later, optional.
- Git integration, extensions/plugins, remote files, collaborative editing.

## 3. What makes it "Sublime-like"

| Sublime feature | StressLab Editor | Shortcut (macOS / Windows·Linux) |
|---|---|---|
| Goto Anything | Fuzzy file search; `@` jumps to a function, `:` to a line | ⌘P / Ctrl+P |
| Command Palette | Every app command (Build, Switch mode, New file, Theme, Layout, Use as Solution…) | ⌘⇧P / Ctrl+Shift+P |
| Multiple selections | Add next match, select all matches, column selection, split selection into lines | ⌘D, ⌃⌘G, ⌥-drag / Ctrl+D, Alt+F3, Shift+Alt-drag |
| Minimap | Code overview on the right (Monaco built-in) | — |
| Split layouts | 1 / 2 columns / 2 rows; move a tab to the other group | ⌥⌘1/2 / Alt+Shift+1/2 |
| Build system | **Build & Run** the current file with the test panel's inputs | ⌘B / Ctrl+B |
| Distraction-free mode | Full screen, only the code | ⌃⌘⇧F / Shift+F11 |
| Monokai theme | Default dark theme ("StressLab Monokai"), plus light | — |
| Folder sidebar | Open a folder, file tree, new / rename / delete | ⌘K ⌘B / Ctrl+K Ctrl+B to toggle |
| Hot exit | Unsaved buffers and open tabs come back after restart | — |
| Snippets | CP templates: `cp` (C++ fast-I/O main), `py`, `java`, `dfs`, `bfs`, `dsu`, `segtree`… | Tab |

## 4. Layout

```
┌ StressLab ─────────────────────────────────── [ Editor | Stress Test ] ⚙ ┐
│ FOLDERS          │ main.cpp ● │ brute.py │        ┊ gen.py │             │
│ ▾ cf-1982        │  1 #include <bits/stdc++.h>    ┊  1 import random    │
│   main.cpp       │  2 using namespace std;        ┊  2 …                │  ← split layout (2 columns)
│   brute.py       │  3 int main() {          ▓▓    ┊                     │  ← minimap
│   gen.py         │                                ┊                     │
│ ▸ old            ├────────────────────────────────────────────────────────┤
│                  │ TESTS  [1 ✓] [2 ✗] [3 …] [+]           ▶ Build ⌘B     │  ← test panel (toggle ⌘J)
│                  │ Input        │ Output            │ Expected          │
│                  │ 3            │ 0                 │ -1                │
│                  │ 1 -2 -3      │ 12 ms             │ ✗ line 1          │
├──────────────────┴────────────────────────────────────────────────────────┤
│ C++ · g++-16 · Ln 12, Col 5 · Spaces: 4 · UTF-8   Use as: [Solution][Brute]│  ← status bar
└───────────────────────────────────────────────────────────────────────────┘
```

## 5. Requirements

IDs are used in the task list and tests. *P* = priority (A = core, B = Sublime/CP extras, C = later).

### 5.1 Mode switch and integration
| ID | P | Requirement |
|---|---|---|
| R1 | A | Header switch **Editor / Stress Test** (also ⌘⇧E / ⌘⇧T and the Command Palette). Both views stay mounted, so switching is instant and keeps state. |
| R2 | A | Opens in the **last used mode** (stored per user). |
| R3 | A | **Use as Solution / Use as Brute** (status bar + Command Palette): copies the current file and its language into the stress tester and switches to it. |
| R4 | B | **Use as Generator** (custom generator mode) and **Import samples**: the stress tester's sample input/output become editor test cases. |
| R5 | B | From the failure popup: **Add as test case** sends the failing input + expected output to the editor's test panel for that file. |

### 5.2 Files and workspace
| ID | P | Requirement |
|---|---|---|
| R6 | A | **Open Folder** (dialog) shows a file tree; **Open File** opens single files; recent folders in the File menu. |
| R7 | A | New file / new folder / rename / delete (to Trash via `shell.trashItem`). |
| R8 | A | Tabs: open, close, reorder; unsaved dot (●); ⌘S save, ⌘⇧S save as, ⌘⌥S save all; ⌘W close with an unsaved-changes prompt. |
| R9 | A | External changes (file edited elsewhere) are reloaded if the buffer is clean, otherwise the user is asked. |
| R10 | A | Quitting with unsaved changes asks Save / Don't save / Cancel (or keeps them via hot exit, R22). |
| R11 | B | Language from the extension (`.cpp .cc .h .py .java .txt .in .out`), changeable in the status bar. |

### 5.3 Editing (Sublime feel)
| ID | P | Requirement |
|---|---|---|
| R12 | A | Monaco with Sublime-style key bindings: ⌘D add next match, ⌘L select line, ⌘⇧K delete line, ⌘⇧D duplicate line, ⌃⌘↑/↓ move lines, ⌘/ comment, ⌘] indent, multi-cursor, column selection. |
| R13 | A | Minimap, line numbers, bracket matching and colouring, code folding, find/replace with regex (⌘F, ⌥⌘F). |
| R14 | B | **Goto Anything** (⌘P): fuzzy file search across the folder; `@symbol` and `:line` modifiers. |
| R15 | B | **Command Palette** (⌘⇧P): all app commands with their shortcuts, fuzzy search. |
| R16 | B | Split layouts (single, 2 columns, 2 rows); move or clone a tab into the other group. |
| R17 | B | Snippets / templates for C++, Python and Java (fast-I/O main, common algorithms); new-file templates per language. |
| R18 | B | Word-based and keyword completion (Monaco built-in); no language servers. |

### 5.4 Build & run (the "build system")
| ID | P | Requirement |
|---|---|---|
| R19 | A | **Build & Run (⌘B)** compiles the current file with the existing engine (same compilers, flags, 256 MB stack, time limit) and runs it on the test panel's inputs. Compile errors show inline (red squiggles at the reported line) and in the panel. |
| R20 | A | Test panel: one input box (A); **multiple test cases** with input, expected output, ✓/✗ per case, time per case, and a diff on mismatch (B). Saved next to the file's state, not inside the source file. |
| R21 | A | Stop running program (⌘. / Ctrl+.), same kill logic as the stress tester. |

### 5.5 Look, settings and persistence
| ID | P | Requirement |
|---|---|---|
| R22 | B | **Hot exit:** open folder, tabs, unsaved buffers, cursor positions, layout and test cases are restored on launch. |
| R23 | A | Default dark **StressLab Monokai** theme for the editor UI (sidebar, tabs, status bar, panel) and Monaco; light theme option; the Stress Test view keeps its Codeforces look. |
| R24 | B | Settings: font family/size, tab size, spaces/tabs, word wrap, minimap on/off, theme, auto-save (off / after delay / on focus change). |
| R25 | B | Distraction-free mode (full screen, sidebar/panel/status bar hidden). |

## 6. Architecture

```
Renderer (sandboxed)                                       Main process
┌───────────────────────────────────────────────┐  IPC   ┌───────────────────────────────┐
│ App: mode switch (Editor | Stress Test)       │◀──────▶│ workspace.js (NEW)            │
│ ├ EditorView (NEW)                            │        │  open folder, list tree, read,│
│ │  Sidebar(FileTree) · TabGroups(Monaco) ·    │        │  write, rename, trash, watch  │
│ │  TestPanel · StatusBar · CommandPalette ·   │        │  — only inside the opened root│
│ │  GotoAnything                               │        │ build.js (NEW, thin)          │
│ └ MainView (existing stress tester)           │        │  compileProgram + runProcess  │
│ shared store: code handed between modes       │        │  (existing engine, reused)    │
└───────────────────────────────────────────────┘        └───────────────────────────────┘
```

- **New IPC channels:** `ws:openFolder`, `ws:tree`, `ws:read`, `ws:write`, `ws:create`, `ws:rename`, `ws:trash`, `ws:changed` (event), `build:run`, `build:stop`, `build:progress` (event).
- **Security:** every path is resolved and checked to be inside the opened root (no `..` escapes, no symlinks pointing outside); file size caps; the renderer still has no Node access. `fs.watch` (built in, no native module) for external changes.
- **Reuse:** compile/run, toolchains, timeouts, verdicts and diff come from the stress tester's engine and failure view.
- **State:** editor session (tabs, buffers, test cases) in `userData/editor-session.json` through IPC (hot exit), not in localStorage, so large buffers are safe.

## 7. Acceptance criteria

1. Open a folder, create `a.cpp` from the C++ template, type a solution, **⌘B** runs it on two test cases: one ✓ and one ✗ with a diff.
2. A compile error shows a red squiggle on the right line.
3. **Use as Solution** switches to Stress Test with the code and language filled in; a found failure can be **added as a test case** back in the editor.
4. ⌘P finds a file by fuzzy name; ⌘⇧P runs "Build", "Split: 2 columns", "Use as Brute".
5. ⌘D multi-cursor, ⌘⇧K delete line, ⌃⌘↑ move line all work.
6. Edit a file in another app: the clean buffer reloads; a dirty buffer asks.
7. Quit with unsaved work and reopen: tabs, unsaved text, test cases and layout come back.
8. Paths outside the opened folder are rejected by the main process (tested).
9. All of the above on macOS, Windows and Linux (CI tests for workspace + build; manual UI check).

## 8. Test plan

| Level | What |
|---|---|
| Node unit tests (CI, 3 OSes) | `workspace.js` path confinement (`..`, absolute paths, symlinks), read/write/rename/trash, watcher events; `build:run` with C++/Python/Java on test cases |
| App-driven tests (like today's screenshot harness) | open folder, tabs, ⌘B, test panel, mode switch, hot exit restore |
| Manual | keyboard feel, themes, split layouts, large files (5,000+ lines) |

## 9. Risks

| Risk | Mitigation |
|---|---|
| Scope creep ("make it VS Code") | Strict phases; terminal/LSP/git are non-goals for v1.2 |
| Data loss (unsaved work) | Unsaved prompts, hot exit, atomic writes (write temp file then rename) |
| File watching differs per OS | Built-in `fs.watch` with debounce + manual refresh; CI tests on all 3 OSes |
| Big folders (e.g. `node_modules`) | Lazy tree loading, ignore list (`.git`, `node_modules`, build output), Goto Anything index capped |
| Monaco memory with many tabs | Dispose models of closed tabs; keep only open buffers |
| Security of file IPC | Root confinement + validation in main, tests for escapes |

## 10. Milestones

| # | Milestone | Contents |
|---|---|---|
| E-M1 | Shell + files | R1–R3, R6–R10, R12–R13, R23 (mode switch, folder tree, tabs, save, Sublime keys, Monokai) |
| E-M2 | Build system | R19–R21 (⌘B, test panel with multiple cases, inline errors) |
| E-M3 | Sublime power features | R14–R18, R22, R24–R25 (Goto Anything, Command Palette, split, snippets, hot exit, settings, distraction-free) |
| E-M4 | Integration + release | R4–R5, README/screenshots, CI tests, v1.2.0 installers for all 3 OSes |

## 11. Decisions (2026-10-21)

- Style: **Sublime Text-like** (fast, minimal, keyboard-first), not a full VS Code clone.
- Scope: **all four milestones** (E-M1 to E-M4) for v1.2.0.
- Theme: **dark StressLab Monokai** by default; light theme in settings.
- Key bindings: **Sublime-style on every OS** (⌘ on macOS, Ctrl on Windows/Linux).
- Start mode: **last used**.
- v1.1.0 (Windows/Linux) is released first; the editor ships in v1.2.0.
