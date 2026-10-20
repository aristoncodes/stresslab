# PROGRESS — StressLab

> Claude Code: update this file at the end of every phase. Tick boxes, update the percentage, and add a line to the log.

**Overall: 10% (5 / 52 tasks)**

```
[██░░░░░░░░░░░░░░░░░░] 10%
```

| Phase | Name | Tasks | Done | Status |
|---|---|---|---|---|
| 0 | Setup | 5 | 5 | ✅ Done |
| 1 | Run engine | 8 | 0 | ⬜ Not started |
| 2 | IPC + main UI | 8 | 0 | ⬜ Not started |
| 3 | Spec generator | 8 | 0 | ⬜ Not started |
| 4 | Failure window | 4 | 0 | ⬜ Not started |
| 5 | Desktop APIs | 6 | 0 | ⬜ Not started |
| 6 | AI spec + Settings | 6 | 0 | ⬜ Not started |
| 7 | Package & submit | 5 | 0 | ⬜ Not started |
| 8 | Extras (P2) | 2 | 0 | ⬜ Not started |

Status legend: ⬜ Not started · 🟨 In progress · ✅ Done · ⏭ Skipped

---

## Phase 0 — Setup
- [x] Scaffold electron-vite (React, JavaScript)
- [x] `git init`, `.gitignore`, first commit, push to GitHub
- [x] Secure window defaults (`contextIsolation: true`, `nodeIntegration: false`)
- [x] Add `@monaco-editor/react` + `monaco-editor`, bundled (no CDN)
- [x] Add `resources/include/bits/stdc++.h` shim

## Phase 1 — Run engine (main process)
- [ ] `compilers.js`: detect g++ (Homebrew first), python3, javac/java (`/usr/libexec/java_home`)
- [ ] `languages.js`: config table for cpp / python / java with `timeScale`
- [ ] Java public-class-name detection
- [ ] Isolated temp dirs per program (`work/sol`, `work/brute`, `work/gen`)
- [ ] Compile with captured stderr → CE result
- [ ] Run with stdin, timeout + kill (TLE), exit code (RE)
- [ ] Compare: exact (token-normalized) and float tolerance
- [ ] Stress loop with stop flag; verified from a Node script

## Phase 2 — IPC + main UI
- [ ] `preload` contextBridge API (narrow, documented)
- [ ] IPC handlers: `toolchains:get`, `stress:start`, `stress:stop`, events `stress:progress`, `stress:result`
- [ ] Header bar + CF-style `Box` component + design tokens
- [ ] Two `CodePane`s with language dropdowns
- [ ] Sidebar: Toolchains box, Run options box, Run/Stop
- [ ] Status table with colored verdicts
- [ ] Live "Running on test N" + progress bar
- [ ] Persist editors/options in localStorage (try/catch)

## Phase 3 — Spec generator
- [ ] Seeded RNG (mulberry32)
- [ ] Tokenizer + parser with line-numbered errors
- [ ] `int`, `array`, `distinct`, `sorted`, `perm`
- [ ] `string`, `grid`
- [ ] `tree`, `graph [connected]`, `weighted`
- [ ] `pairs[q]`, `repeat t { }`, `print`
- [ ] Small-first size scaling by test index
- [ ] Spec box with live validation via `spec:validate`; custom generator mode

## Phase 4 — Failure window
- [ ] Second `BrowserWindow` + `failure:data` IPC
- [ ] Input view, Monaco diff of outputs
- [ ] RE/TLE view with stderr + exit code
- [ ] Copy input / Save as .txt

## Phase 5 — Desktop APIs
- [ ] Native menu + shortcuts (⌘O, ⌘R, ⌘., ⌘,)
- [ ] `dialog.showOpenDialog` into focused editor
- [ ] `dialog.showSaveDialog` for failing input
- [ ] `Notification` on failure / finish
- [ ] Dock badge + `setProgressBar`
- [ ] `clipboard` + `shell.openPath`

## Phase 6 — AI spec + Settings
- [ ] Settings window (provider, model, key, defaults)
- [ ] `safeStorage` encrypted key in `userData`
- [ ] `llm.js`: Gemini, Groq (OpenAI-compatible), Ollama
- [ ] Prompt with spec rules + few-shot examples
- [ ] Validate → retry with parser error (max 2)
- [ ] "Generate spec with AI" button wired, loading + error states

## Phase 7 — Package & submit
- [ ] electron-builder config (dmg, arm64 or universal, icon)
- [ ] Build .dmg and test it on a clean launch
- [ ] README: features, screenshots, setup, Gatekeeper bypass, architecture, IPC list
- [ ] Final demo run (C++ bug found, Java run, AI spec)
- [ ] Submit repo, AI chat link, .dmg on portal

## Phase 8 — Extras (P2, only if time remains)
- [ ] Complexity: AI Big-O estimate of the solution (`complexity:estimate`)
- [ ] Complexity: measured timing over growing n + curve fit (`complexity:measure`)

---

## Log
| Time | Phase | Note |
|---|---|---|
| 2026-10-20 22:10 | 0 | electron-vite React/JS scaffold, sandboxed secure window, local Monaco (0.57 worker path), bits/stdc++.h shim + extraResources, private GitHub repo |
