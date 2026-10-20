# PRD — StressLab: Desktop Stress Tester for Competitive Programming

**Course:** Application Development — Desktop Application (In-Class Project)
**Problem statement:** Build a desktop application using Electron, focusing on desktop APIs, windows, IPC, and system-level interactions.
**Deliverables:** GitHub repo · AI chat history link · macOS executable (.dmg)

---

## 1. Problem

When a competitive programming solution gets "Wrong Answer" and the sample tests pass, finding the failing case is slow and manual. The standard technique is **stress testing**: write a slow but obviously-correct brute force, generate many small random inputs, and compare outputs until they differ. Doing this by hand means writing a generator, a bash/batch loop, a diff script, and dealing with compilers, for every problem.

## 2. Solution

A desktop app where the user:

1. Pastes the **Input section** of the problem (or writes a spec by hand).
2. An LLM converts it to a small **spec language**, which the app turns into a random test generator.
3. Pastes their **solution** and a **brute force** (C++, Python or Java, can be mixed).
4. Clicks **Run**. The app compiles both, generates tests starting tiny and growing, runs both, compares outputs, and stops at the **first failing test**, showing input, both outputs and a diff.

## 3. Target user

Students practicing on Codeforces / CSES / LeetCode / AtCoder, on macOS.

## 4. Goals and non-goals

**Goals**
- Find a small failing test in under a minute for typical bugs.
- Support C++, Python, Java for solution, brute and custom generator.
- Show real use of Electron: multiple windows, secure IPC, native desktop APIs, child processes.

**Non-goals (v1)**
- Interactive problems.
- Online judge integration / scraping.
- Accounts, cloud sync, auto-update.
- Windows/Linux builds (code should not block them, but only the .dmg is shipped).

## 5. Features

### P0 — must ship
| ID | Feature | Details |
|---|---|---|
| F1 | Code editors | Two Monaco editors (Solution, Brute) with per-editor language dropdown: C++ / Python / Java. Open file from disk. |
| F2 | Toolchain detection | On startup detect `g++` (prefer Homebrew `g++-NN`, fall back to clang `g++`), `python3`, `javac`/`java` (verify via `/usr/libexec/java_home`). Show status in sidebar; disable missing languages with install hint. |
| F3 | Compile & run engine | Compile once per run in isolated temp dirs (`work/sol`, `work/brute`, `work/gen`). Run each test with stdin piped, stdout captured, per-language timeout (`timeScale`: C++ 1, Python 3, Java 4). Detect CE, RE (non-zero exit), TLE (kill). |
| F4 | `bits/stdc++.h` shim | Ship `resources/include/bits/stdc++.h`; always pass `-I` to it so CP code compiles with Apple Clang. |
| F5 | Spec-language generator | Parser + random generator supporting: `int`, `array[n] int`, `distinct[n]`, `sorted[n]`, `perm[n]`, `string[n] "chars"`, `grid[n][m] "chars"`, `tree n`, `graph n m [connected]`, `pairs[q] ...`, `weighted L..R`, `repeat t { }`, `print ...`. Ranges may reference earlier variables (`1..n`). Seeded RNG for reproducibility. |
| F6 | Small-first growth | Sizes start at the minimum and grow toward the spec maximum as test number increases, so the first failure is small. |
| F7 | Comparison | Modes: exact (whitespace-normalized tokens), float tolerance (abs/rel, default 1e-6). |
| F8 | Stress loop | Run up to N tests (default 1000) or until first failure; Stop button kills running processes. Live counter + tests/sec. |
| F9 | Failure window | Separate `BrowserWindow`: verdict, test #, seed, input, your output, brute output, Monaco diff view. Buttons: Copy input, Save input as .txt. |
| F10 | Secure IPC | `contextIsolation: true`, `nodeIntegration: false`, all system work in main process, narrow `contextBridge` API. |
| F11 | .dmg build | electron-builder, arm64 (or universal), unsigned; README explains Gatekeeper bypass. |

### P1 — should ship
| ID | Feature | Details |
|---|---|---|
| F12 | AI spec from problem text | Paste the problem's Input section → main process calls LLM → returns spec → parser validates → on error, retry with error message (max 2) → show in editable spec box. |
| F13 | Settings window | Provider (Gemini / Groq / Ollama), model, API key, default test count, timeouts. Key encrypted with `safeStorage`, stored in `userData`. |
| F14 | Custom generator mode | User supplies generator code (any of the 3 languages); app runs it with the seed as argv[1]. |
| F15 | Desktop extras | Native menu with shortcuts (⌘O open, ⌘R run, ⌘. stop, ⌘, settings); `Notification` on failure; dock badge / progress bar; `dialog` open/save; `clipboard`; `shell.openPath` for saved cases. |
| F20 | Sample test | User pastes the statement's sample input/output. Checked before random tests (brute must reproduce the sample output; solution must match). AI specs are validated against the sample input's structure and retried on mismatch. |
| F21 | Failing test case | Failure window names the random test (#, seed); for multi-test inputs it identifies the failing case inside the input and shows it as a standalone t = 1 input. |

### P2 — nice to have
| ID | Feature |
|---|---|
| F16 | Custom checker program for "print any valid answer" problems |
| F17 | History window: past runs and failing cases saved to `userData/history.json` |
| F18 | Persistent JVM / batching to speed up Java |
| F19 | Time complexity: (a) AI estimate of the solution's Big-O via `llm.js` (`complexity:estimate`), (b) measured: run the solution on inputs of growing size from the spec, fit time vs n against O(1), O(log n), O(n), O(n log n), O(n²), O(n³), O(2ⁿ) (`complexity:measure`) |

## 6. User flow

```
Launch → sidebar shows toolchains
  → Paste Input section → [Generate spec] → spec appears (editable)
  → Paste solution + brute, pick languages
  → [Run] → compile → stress loop (live counter)
      ├─ all N passed → "OK: 1000 tests passed" (green)
      ├─ CE → show compiler error for the failing program
      └─ mismatch/RE/TLE → notification + Failure window opens
```

## 7. Technical architecture

- **Electron** via **electron-vite** template (main / preload / renderer).
- **Renderer:** React + JavaScript, plain CSS, `@monaco-editor/react` with bundled Monaco (offline).
- **Main process modules:** `index.js` (windows, menu, IPC), `runner.js`, `languages.js`, `compilers.js`, `generator.js`, `llm.js`, `settings.js`.
- **IPC channels:** `toolchains:get`, `spec:fromText`, `spec:validate`, `stress:start`, `stress:stop`, `stress:progress` (event), `stress:result` (event), `file:open`, `file:saveText`, `settings:get`, `settings:set`, `failure:data`.
- **LLM:** HTTP `fetch` from main. Default Groq (`openai/gpt-oss-120b`, fastest in testing); Gemini (`gemini-flash-latest`, auto-fallback to `gemini-flash-lite-latest` when overloaded); offline Ollama.

## 8. Success criteria (demo script)

1. Paste a known-buggy C++ solution (e.g. overflow or off-by-one) and a Python brute for a simple array problem.
2. Generate spec from the Input section with AI.
3. Run → failure found within seconds on a test with n ≤ 5, failure window shows the diff.
4. Fix bug → 1000 tests pass.
5. Repeat with a Java solution.

## 9. Risks

| Risk | Mitigation |
|---|---|
| Apple Clang lacks `bits/stdc++.h` | Ship shim header; prefer Homebrew GCC |
| No JDK / fake `/usr/bin/java` stub | Detect via `java_home`; disable Java with hint |
| JVM startup slow | Larger timeout scale; show tests/sec |
| LLM misreads constraints | Editable spec, validation + retry, custom generator fallback |
| Free LLM rate limits / model deprecation | Use `latest` alias, multi-provider setting, Ollama offline |
| Unsigned .dmg blocked | README instructions (right-click → Open or `xattr -cr`) |
