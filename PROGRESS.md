# PROGRESS — StressLab

> Claude Code: update this file at the end of every phase. Tick boxes, update the percentage, and add a line to the log.

**Overall: 95% (56 / 59 tasks)**

```
[███████████████████░] 95%
```

| Phase | Name | Tasks | Done | Status |
|---|---|---|---|---|
| 0 | Setup | 5 | 5 | ✅ Done |
| 1 | Run engine | 8 | 8 | ✅ Done |
| 2 | IPC + main UI | 8 | 8 | ✅ Done |
| 3 | Spec generator | 8 | 8 | ✅ Done |
| 4 | Failure window | 4 | 4 | ✅ Done |
| 5 | Desktop APIs | 6 | 6 | ✅ Done |
| 6 | AI spec + Settings | 6 | 6 | ✅ Done |
| 7 | Package & submit | 5 | 4 | 🟨 In progress |
| 8 | Extras (P2) | 2 | 0 | ⬜ Not started |
| 9 | Feedback round | 7 | 7 | ✅ Done |

Status legend: ⬜ Not started · 🟨 In progress · ✅ Done · ⏭ Skipped

---

## Phase 0 — Setup
- [x] Scaffold electron-vite (React, JavaScript)
- [x] `git init`, `.gitignore`, first commit, push to GitHub
- [x] Secure window defaults (`contextIsolation: true`, `nodeIntegration: false`)
- [x] Add `@monaco-editor/react` + `monaco-editor`, bundled (no CDN)
- [x] Add `resources/include/bits/stdc++.h` shim

## Phase 1 — Run engine (main process)
- [x] `compilers.js`: detect g++ (Homebrew first), python3, javac/java (`/usr/libexec/java_home`)
- [x] `languages.js`: config table for cpp / python / java with `timeScale`
- [x] Java public-class-name detection
- [x] Isolated temp dirs per program (`work/sol`, `work/brute`, `work/gen`)
- [x] Compile with captured stderr → CE result
- [x] Run with stdin, timeout + kill (TLE), exit code (RE)
- [x] Compare: exact (token-normalized) and float tolerance
- [x] Stress loop with stop flag; verified from a Node script

## Phase 2 — IPC + main UI
- [x] `preload` contextBridge API (narrow, documented)
- [x] IPC handlers: `toolchains:get`, `stress:start`, `stress:stop`, events `stress:progress`, `stress:result`
- [x] Header bar + CF-style `Box` component + design tokens
- [x] Two `CodePane`s with language dropdowns
- [x] Sidebar: Toolchains box, Run options box, Run/Stop
- [x] Status table with colored verdicts
- [x] Live "Running on test N" + progress bar
- [x] Persist editors/options in localStorage (try/catch)

## Phase 3 — Spec generator
- [x] Seeded RNG (mulberry32)
- [x] Tokenizer + parser with line-numbered errors
- [x] `int`, `array`, `distinct`, `sorted`, `perm`
- [x] `string`, `grid`
- [x] `tree`, `graph [connected]`, `weighted`
- [x] `pairs[q]`, `repeat t { }`, `print`
- [x] Small-first size scaling by test index
- [x] Spec box with live validation via `spec:validate`; custom generator mode

## Phase 4 — Failure window
- [x] Second `BrowserWindow` + `failure:data` IPC
- [x] Input view, Monaco diff of outputs
- [x] RE/TLE view with stderr + exit code
- [x] Copy input / Save as .txt

## Phase 5 — Desktop APIs
- [x] Native menu + shortcuts (⌘O, ⌘R, ⌘., ⌘,)
- [x] `dialog.showOpenDialog` into focused editor
- [x] `dialog.showSaveDialog` for failing input
- [x] `Notification` on failure / finish
- [x] Dock badge + `setProgressBar`
- [x] `clipboard` + `shell.openPath`

## Phase 6 — AI spec + Settings
- [x] Settings window (provider, model, key, defaults)
- [x] `safeStorage` encrypted key in `userData`
- [x] `llm.js`: Gemini, Groq (OpenAI-compatible), Ollama
- [x] Prompt with spec rules + few-shot examples
- [x] Validate → retry with parser error (max 2)
- [x] "Generate spec with AI" button wired, loading + error states

## Phase 7 — Package & submit
- [x] electron-builder config (dmg, arm64 or universal, icon)
- [x] Build .dmg and test it on a clean launch
- [x] README: features, screenshots, setup, Gatekeeper bypass, architecture, IPC list
- [x] Final demo run (C++ bug found, Java run, AI spec) — C++ + Java in packaged app; AI spec 4/4 problems on Groq and Gemini
- [ ] Submit repo, AI chat link, .dmg on portal — your step (repo is private until you make it public)

## Phase 9 — Feedback round (user requests)
- [x] Groq as default provider (Gemini flash alias overloaded; Gemini kept with auto-fallback to flash-lite)
- [x] Sample input/output box; sample checked before random tests (brute vs expected, then solution)
- [x] AI spec checked against the sample input's structure, retried on mismatch; rejects copied sample values
- [x] Failure window names the exact test (#, seed) and, for multi-test inputs, the failing test case as a standalone input
- [x] Four generators cycled per test: Random, Edge cases, Max values, Patterns (toggle in Run options)
- [x] `full A..B` real bounds for values + `min()`/`max()` in expressions; AI adds them
- [x] Sample check also verifies size minimums and full ranges (AI retried on violation)

## Phase 8 — Extras (P2, only if time remains)
- [ ] Complexity: AI Big-O estimate of the solution (`complexity:estimate`)
- [ ] Complexity: measured timing over growing n + curve fit (`complexity:measure`)

---

## Log
| Time | Phase | Note |
|---|---|---|
| 2026-10-20 22:10 | 0 | electron-vite React/JS scaffold, sandboxed secure window, local Monaco (0.57 worker path), bits/stdc++.h shim + extraResources, private GitHub repo |
| 2026-10-20 22:40 | 1 | languages/compilers/runner; C++ link probe flags broken Clang; `npm run smoke` 16/16 pass (buggy C++ WA on test 1 n=1, Java+py gen AC, CE/TLE/RE/BRUTE_FAIL/Stop/output cap) |
| 2026-10-20 22:34 | 2 | contextBridge API (19 fns), 17 IPC channels with input checks, CF-style main UI; verified by driving the built app (click Run → WA on test 3, failure window opens) |
| 2026-10-20 22:34 | 3 | generator.js: all F5 types, line-numbered errors, small-first scaling; `npm run gen-test` 34/34 (fixed `#` inside quoted char sets being treated as a comment) |
| 2026-10-20 22:34 | 4 | failure window reused via hash routing; side-by-side Monaco diff (forced, no inline fallback); CE/RE/TLE views; copy/save/open/reveal |
| 2026-10-20 22:34 | 5 | native menu ⌘O/⌘R/⌘./⌘, + Edit menu; open/save dialogs; Notification; dock badge + progress bar; clipboard; shell (openPath restricted to saved files) |
| 2026-10-20 22:34 | 6 | settings window, safeStorage keys, llm.js (Gemini/Groq/Ollama) with validate + 2 retries; few-shot examples checked by gen-test; no-key error path verified, live AI call not tested (no key) |
| 2026-10-20 22:34 | 7 | custom icon; dmg 133 MB arm64 (monaco moved to devDeps, was 152 MB); packaged app tested with empty env via CDP: toolchains ok, buggy C++ WA test 1, fixed C++ AC 200, Java AC (fixed: g++ needed PATH for `ld`); README |
| 2026-10-20 22:34 | 2–6 | note: phases 2–6 were written together, so only the phase 6 commit builds on its own |
| 2026-10-20 22:59 | 6–7 | live AI test: Groq gpt-oss-120b 4/4 valid specs in 0.6–2.2 s; Gemini 4/4 but gemini-flash-latest overloaded (503/timeouts) → added auto-fallback to gemini-flash-lite-latest after 30 s or 429/5xx; Groq default changed from retired llama-3.3-70b-versatile; dmg rebuilt |
| 2026-10-20 23:17 | 9 | sample box + pre-run sample check; matchSample (infers unprinted sizes, checks re-printed values agree); AI retries on sample mismatch and copied values; Groq default; test-case locator for `repeat t` inputs. Groq: 7/7 problems valid (graph fixed by one sample-driven retry); e2e: case 3 of 4 located |
| 2026-10-21 00:08 | 9 | generators: random/edge/max/pattern + `full` ranges + min()/max(); overflow demo passes 200 random tests but fails on test 3 with Max values; mountains spec: 0 violations over ~16k cases in all 4 generators; AI now writes k: int 1..min(n,m) with full 0..1e9 (first attempt rejected by new size-minimum check) |
