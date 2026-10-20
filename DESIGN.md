# DESIGN — StressLab UI

Style target: **Codeforces / CSES**. Plain, dense, functional. White page, thin gray borders, small sans-serif text, blue links, colored verdicts. No gradients, no shadows beyond 1px, no rounded "app-y" cards.

---

## 1. Design tokens

```css
:root {
  --bg: #ffffff;
  --bg-alt: #f8f8f8;         /* table header, sidebar box header */
  --border: #b9b9b9;
  --border-light: #e1e1e1;
  --text: #222222;
  --text-muted: #666666;
  --link: #0000cc;            /* CF blue links */
  --accent: #3b5998;          /* header bar */
  --ok: #008000;              /* Accepted green */
  --wa: #cc0000;              /* Wrong answer red */
  --tle: #b45f06;             /* TLE / RE orange */
  --ce: #555555;              /* Compilation error gray */
  --running: #0000cc;
  --font: Verdana, Arial, sans-serif;
  --mono: "SF Mono", Menlo, Consolas, monospace;
  --fs: 13px;
  --fs-small: 11px;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #1e1e1e; --bg-alt: #262626; --border: #444; --border-light: #333;
    --text: #ddd; --text-muted: #999; --link: #6ea8ff; --accent: #2b3f66;
    --ok: #4caf50; --wa: #ff6b6b; --tle: #f0a050; --ce: #aaa;
  }
}
```

Rules: 1px solid borders, border-radius 0–2px, spacing on a 4px grid, body font 13px.

## 2. Main window layout (min 1100×720)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ StressLab                     Stress Test | History | Settings           │ ← header bar (--accent, white text)
├──────────────────────────────────────────────────────┬───────────────────┤
│ ┌ Problem input ───────────────────────────────────┐ │ ┌ Toolchains ───┐ │
│ │ [ textarea: paste the "Input" section ...      ] │ │ │ C++  ● g++-14 │ │
│ │                          [Generate spec with AI] │ │ │ Py   ● 3.12   │ │
│ └──────────────────────────────────────────────────┘ │ │ Java ○ none   │ │
│ ┌ Spec ────────────────────────────────────────────┐ │ │  install →    │ │
│ │ n: int 1..8                                      │ │ └───────────────┘ │
│ │ a: array[n] int -10..10        (monospace edit)  │ │ ┌ Run options ──┐ │
│ │ ✓ valid  · or ✗ line 2: unknown type "arr"       │ │ │ Tests  [1000] │ │
│ │ Mode: (•) Spec  ( ) Custom generator             │ │ │ Timeout [2]s  │ │
│ └──────────────────────────────────────────────────┘ │ │ Compare [exact▾]│
│ ┌ Solution ── [C++ ▾] [Open…] ┐┌ Brute ── [Py ▾] [Open…]┐│ Seed  [random]│ │
│ │                             ││                        ││               │ │
│ │   Monaco editor             ││   Monaco editor        ││ [ Run  ⌘R ]   │ │
│ │                             ││                        ││ [ Stop ⌘. ]   │ │
│ └─────────────────────────────┘└────────────────────────┘└───────────────┘ │
│ ┌ Status ──────────────────────────────────────────────────────────────┐ │
│ │ #  | When     | Sol   | Brute | Tests     | Verdict                  │ │
│ │ 3  | 22:41:05 | C++   | Py    | 37 / 1000 | Wrong answer on test 37  │ │ ← red, clickable → failure window
│ │ 2  | 22:39:50 | C++   | Py    | 1000/1000 | Accepted                 │ │ ← green
│ │ 1  | 22:38:12 | C++   | Py    | —         | Compilation error        │ │ ← gray, clickable → shows error
│ └──────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

- Sections are **CF-style boxes**: 1px border, title strip with `--bg-alt` background and bold 12px title, content padded 8px.
- Right sidebar 220px fixed, like the CF sidebar.
- While running, top status row shows `Running on test 412…` in `--running` blue with a thin progress bar under the table header.
- Custom generator mode replaces the Spec box with a third Monaco editor + language dropdown.

## 3. Verdict text (match CF wording)

| State | Text | Color |
|---|---|---|
| Running | `Running on test 412` | --running |
| All passed | `Accepted (1000 tests)` | --ok |
| Mismatch | `Wrong answer on test 37` | --wa |
| Sol TLE | `Time limit exceeded on test 12` | --tle |
| Sol crash | `Runtime error on test 5` | --tle |
| Brute TLE/RE | `Brute failed on test 9` | --tle |
| CE | `Compilation error (solution)` | --ce |
| Stopped | `Stopped at test 230` | --text-muted |

## 4. Failure window (separate BrowserWindow, ~900×650)

```
┌ Wrong answer on test 37 ─────────────────────────────────────────────┐
│ Seed: 9142  ·  n = 4  ·  Sol 3 ms  ·  Brute 41 ms                    │
├──────────────────────────────────────────────────────────────────────┤
│ Input                                    [Copy] [Save as .txt]       │
│ ┌──────────────────────────────────────────────────────────────────┐ │
│ │ 4 2                                                              │ │ ← monospace, --bg-alt
│ │ 3 -1 7 2                                                         │ │
│ └──────────────────────────────────────────────────────────────────┘ │
│ Output (yours)                 │ Expected (brute)                    │
│ ┌────────────────────────────┐ │ ┌─────────────────────────────────┐ │
│ │ 9                          │ │ │ 10                              │ │ ← Monaco diff editor, read-only
│ └────────────────────────────┘ │ └─────────────────────────────────┘ │
│ Checker: wrong answer, line 1 token 1: expected "10", found "9"      │
└──────────────────────────────────────────────────────────────────────┘
```

For RE/TLE: replace the diff with stderr of the failing program and the exit code/signal.

## 5. Settings window (~520×420)

Simple CF-style form table:

```
┌ Settings ──────────────────────────────┐
│ AI provider   [Gemini ▾]               │
│ Model         [gemini-flash-latest   ] │
│ API key       [••••••••••••]  [Test]   │
│ ──────────────────────────────────────  │
│ Default tests [1000]                   │
│ Base timeout  [2] s                    │
│ C++ flags     [-O2 -std=c++17]         │
│                      [Cancel] [Save]   │
└────────────────────────────────────────┘
```

## 6. Components (renderer)

`HeaderBar`, `Box` (title + content), `ProblemInput`, `SpecEditor`, `CodePane` (Monaco + language select + Open), `Sidebar` (`ToolchainBox`, `RunOptionsBox`), `StatusTable`, `FailureView`, `SettingsForm`.

## 7. Interaction details

- ⌘R runs, ⌘. stops, ⌘O opens into the focused editor, ⌘, opens Settings.
- Run is disabled while: a language in use is missing, spec invalid (spec mode), or a run is active.
- Spec box validates on every change (debounced 300 ms) through IPC `spec:validate`; shows `✓ valid` or the first error with line number.
- On failure: native notification ("Wrong answer on test 37"), dock badge `!`, failure window opens and focuses.
- Editors' contents and options persist across restarts (renderer `localStorage`, wrapped in try/catch).
