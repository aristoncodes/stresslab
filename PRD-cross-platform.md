# PRD — StressLab for Windows and Linux

**Status:** Draft for approval · **Date:** 2026-10-21 · **Owner:** aristoncodes
**Builds on:** [PRD.md](PRD.md) (v1.0, macOS) · **Goal release:** v1.1.0

---

## 1. Summary

StressLab 1.0 ships only as a macOS `.dmg`. Electron itself is cross-platform, and most of the app (UI, spec language, generators, comparison, AI calls) is plain JavaScript that already runs anywhere. What ties it to macOS is a small, well-defined set of places: **finding compilers**, **running the compiled program**, **the native menu and shortcut labels**, **dock integration**, **API-key storage on Linux**, and **packaging**.

This PRD lists every required change, how each OS will be built and tested, and the risks. The approach: put all OS-specific facts in one new module (`platform.js`), keep everything else shared, and build/test all three OSes automatically on GitHub Actions, since a Mac can't run the Windows and Linux apps natively.

## 2. Goals and non-goals

**Goals**
- G1. Installable StressLab for **Windows 10/11 (x64)** and **Linux (x64: Ubuntu/Debian and most other distros)**, with the same features as macOS.
- G2. C++, Python and Java work on all three OSes, with clear install hints when a toolchain is missing.
- G3. One codebase, no per-OS forks; macOS behaviour unchanged.
- G4. Automated builds and engine tests on all three OSes for every push and release.
- G5. All three downloads on the GitHub release and in the README.

**Non-goals (v1.1)**
- Code signing / notarization (Windows SmartScreen and macOS Gatekeeper warnings remain; documented).
- MSVC (`cl.exe`) as a C++ compiler: Windows uses MinGW-w64 `g++` (what competitive programmers use; same flags as GCC).
- Windows/Linux on ARM (can be added later; x64 builds run under emulation on Windows ARM).
- Snap / Flatpak / Microsoft Store, auto-update.

## 3. Target users and environments

| OS | Versions | Typical CP setup we must detect |
|---|---|---|
| Windows | 10 22H2, 11 (x64) | MinGW-w64 `g++` via MSYS2 (`C:\msys64\ucrt64\bin`), WinLibs, Chocolatey (`C:\ProgramData\chocolatey\bin`), Scoop, or Code::Blocks' bundled MinGW; Python from python.org or the `py` launcher; JDK from Adoptium/Oracle (`JAVA_HOME`) |
| Linux | Ubuntu 22.04/24.04, Debian 12, Fedora 40, Arch (x64) | `g++` from `build-essential` / `gcc-c++`; `python3`; `openjdk` (`/usr/lib/jvm/...`) |

## 4. What has to change (by area)

Each item has an ID used in the task list and tests. Files are the ones in the repo today.

### 4.1 Platform layer (new)
| ID | Change | Why |
|---|---|---|
| X1 | New `src/main/platform.js`: `isWin/isMac/isLinux`, `exeName(base)` (`main.exe` on Windows), PATH separator (`;` on Windows, `:` elsewhere), standard binary dirs per OS, `shortcutLabel()` helper. | Keeps OS facts in one place instead of scattered `if`s. |

### 4.2 Toolchain detection — `compilers.js`
| ID | Change | Why |
|---|---|---|
| X2 | **C++:** macOS unchanged. Windows: look for `g++.exe` on PATH (`where g++`) and in known dirs (MSYS2 `ucrt64`/`mingw64`, WinLibs, Chocolatey, Scoop, Code::Blocks). Linux: highest `g++-NN`, else `g++` in `/usr/bin`. Keep the link test (catches broken installs). | Today it only knows Homebrew and Apple Clang paths. |
| X3 | **Python:** Windows: `py -3` launcher first, then `python.exe` on PATH, but **reject the Microsoft Store alias** (`...\WindowsApps\python.exe`, which opens the Store instead of running). Linux: `python3` on PATH / `/usr/bin`. | `python3` usually doesn't exist on Windows; the Store alias is the Windows twin of macOS's fake `/usr/bin/java`. |
| X4 | **Java:** Windows: `JAVA_HOME`, then `where javac`, then `C:\Program Files\{Java,Eclipse Adoptium,Microsoft}\*\bin\javac.exe`. Linux: `JAVA_HOME`, then resolve `javac` on PATH (follows `/etc/alternatives`), then `/usr/lib/jvm/*`. | `/usr/libexec/java_home` exists only on macOS. |
| X5 | Per-OS install hints (e.g. Windows: "Install MSYS2 and run `pacman -S mingw-w64-ucrt-x86_64-gcc`" / `winget install Python.Python.3.12` / `winget install EclipseAdoptium.Temurin.21.JDK`; Linux: `sudo apt install build-essential python3 openjdk-21-jdk`). | Hints are Homebrew-only today. |

### 4.3 Compile & run engine — `languages.js`, `runner.js`
| ID | Change | Why |
|---|---|---|
| X6 | C++ output is `main.exe` on Windows; the run command uses `exeName()`. | `spawn` won't find `main` without the extension. |
| X7 | Child `PATH` built with the right separator; Windows adds the compiler's own `bin` dir (MinGW needs its DLLs, e.g. `libstdc++-6.dll`, next to the run). | Today PATH is joined with `:` and macOS dirs. |
| X8 | Windows C++ link flag `-Wl,--stack,268435456` (256 MB stack) and `-static` (no DLL dependency at run time). Linux/macOS unchanged. | Windows' default 1 MB stack crashes deep recursion that works on Codeforces. |
| X9 | Python uses `py -3 file.py` when the launcher was detected. | Matches X3. |
| X10 | UTF-8 everywhere: `PYTHONUTF8=1`, `PYTHONIOENCODING=utf-8`, Java `-Dfile.encoding=UTF-8 -Dstdout.encoding=UTF-8`. | Windows defaults to a legacy code page → crashes on non-ASCII output. |
| X11 | Output comparison already ignores whitespace, so `\r\n` (Windows `println`/`print`) is safe. Strip `\r` before showing outputs in the failure diff. | Avoids false "^M" differences in the diff view. |
| X12 | Process kill: keep `child.kill()` (TerminateProcess on Windows); timeouts measured the same way. Add a one-time **warm-up run** after compiling on Windows. | Windows Defender scans a freshly built `.exe` on first launch (can take ~1 s → false TLE on test 1). |

### 4.4 API-key storage — `settings.js`
| ID | Change | Why |
|---|---|---|
| X13 | Windows: `safeStorage` uses DPAPI — works as is. Linux: check `safeStorage.getSelectedStorageBackend()`. With `gnome-libsecret`/`kwallet*` it's encrypted as on macOS. If only `basic_text` (no keyring), tell the user in the key dialog and keep the key **for this session only** (never written in plain text). | On Linux without a keyring, today's code throws "Secure storage is not available" and the key can't be saved. |

### 4.5 Menu, shortcuts and UI text
| ID | Change | Why |
|---|---|---|
| X14 | Menu per OS: macOS keeps the app menu (About/Settings/Hide/Quit). Windows/Linux: **File** (Open, Settings `Ctrl+,`, Exit), **Edit**, **Run**, **View**, **Help** (Walkthrough, About). Accelerators already use `CmdOrCtrl`. | macOS-only roles (`hide`, `hideOthers`, app menu) look wrong elsewhere. |
| X15 | Shortcut labels in the UI come from `shortcutLabel()`: `⌘R` on macOS, `Ctrl+R` elsewhere (Run/Stop buttons, Status placeholder, walkthrough text, README). Exposed to the renderer as `window.api.platform`. | The UI hard-codes `⌘` in 5 places. |
| X16 | Fonts: add `Segoe UI`/`DejaVu Sans` and `Cascadia Mono`/`DejaVu Sans Mono` fallbacks in the design tokens. | Verdana/SF Mono may be missing on Linux. |

### 4.6 Desktop integration — `stress.js`, `windows.js`, `index.js`
| ID | Change | Why |
|---|---|---|
| X17 | Failure badge: macOS dock badge (unchanged); Windows taskbar **overlay icon** (red `!`, `win.setOverlayIcon`); Linux `app.setBadgeCount(1)` where supported. Progress bar (`setProgressBar`) already works on the Windows taskbar and Unity-style Linux launchers. | `app.dock` doesn't exist on Windows/Linux (today it is silently skipped). |
| X18 | Notifications: Windows needs the AppUserModelID to match the installer's Start-menu shortcut (`com.stresslab.app`, already set; NSIS creates the shortcut). Linux uses libnotify (no change). | Otherwise Windows toasts don't appear. |
| X19 | Failure popup: on Windows/Linux the modal child window gets a normal title bar (macOS keeps the sheet). Close button and Esc keep working. Quitting when the last window closes is already right for Windows/Linux. | Sheets are macOS-only. |

### 4.7 Packaging — `electron-builder.yml`, `build/`
| ID | Change | Why |
|---|---|---|
| X20 | **Windows:** NSIS installer `StressLab-Setup-1.1.0-x64.exe` (per-user install, Start-menu + desktop shortcut) and a portable `StressLab-1.1.0-x64-portable.zip`. | Installer = notifications + uninstall; zip = no admin rights. |
| X21 | **Linux:** `StressLab-1.1.0-x86_64.AppImage` (any distro) and `stresslab_1.1.0_amd64.deb` (Ubuntu/Debian, adds a menu entry). | AppImage is universal; `.deb` is the native Ubuntu install. |
| X22 | Icons: regenerate `build/icon.ico` (16–256 px; deleted in v1.0) and a 512 px `build/icon.png` for Linux; `.desktop` entry with category `Development`. | Windows/Linux need their own icon formats. |
| X23 | `extraResources` (the `bits/stdc++.h` shim) and `paths.js` already work on all OSes (`process.resourcesPath`); verify on each. | Resource path differs per OS layout. |
| X24 | New scripts: `build:win`, `build:linux`, `build:all`. | One command per target. |

### 4.8 Build, test and release automation (new)
| ID | Change | Why |
|---|---|---|
| X25 | GitHub Actions workflow `.github/workflows/build.yml`, matrix **macos-latest / windows-latest / ubuntu-latest**: `npm ci` → `npm test` (engine + generator tests with the runners' preinstalled g++, Python and Java) → `electron-builder` for that OS → upload artifacts. | A Mac can't build or run Windows/Linux apps reliably; native runners can, and they also run the tests on the real OS. |
| X26 | On a `v*` tag, the workflow attaches all installers to the GitHub Release. | One release with three downloads. |
| X27 | Smoke test made portable: replace `/bin/sh -c yes` (output-cap test) with a small Node script. | `/bin/sh` doesn't exist on Windows. |

### 4.9 Documentation
| ID | Change |
|---|---|
| X28 | README: download table (macOS / Windows / Linux), per-OS requirements and first-launch notes (SmartScreen "More info → Run anyway"; AppImage `chmod +x`, `libfuse2` on Ubuntu 22.04+), shortcut table with both ⌘ and Ctrl. |
| X29 | PROGRESS.md: new phase with these tasks; PRD.md non-goal "Windows/Linux builds" moved to done. |

## 5. Architecture after the change

```
                 ┌──────────── shared (unchanged) ────────────┐
 renderer (UI) · preload · ipc · stress loop · generator · llm · settings logic
                 └─────────────────────┬──────────────────────┘
                                       │ asks
                              src/main/platform.js   ← the only OS-aware module
          ┌────────────────────────────┼───────────────────────────────┐
        macOS                       Windows                          Linux
  Homebrew g++ / Clang       MinGW g++ (MSYS2, WinLibs…)       g++ / g++-NN
  python3 (Homebrew/usr)     py -3 / python.exe (no Store)     python3
  java_home                  JAVA_HOME / Program Files         JAVA_HOME / /usr/lib/jvm
  dock badge, sheet popup    taskbar overlay, modal window     badge count, modal window
  Keychain                   DPAPI                             libsecret / KWallet / session-only
  .dmg                       NSIS .exe + portable .zip         AppImage + .deb
```

## 6. Acceptance criteria

A build passes when, on each OS:
1. `npm test` passes on the CI runner (82 generator + 21 engine checks), including C++, Python and Java runs.
2. The installed app launches; the toolchain box shows the detected compilers, or the OS-specific install hint when one is missing.
3. The preloaded demo (buggy C++ vs Python) reports *Wrong answer* within the first tests; the fixed version reports *Accepted (1000 tests)*.
4. A Java solution runs and passes; a deep-recursion C++ program (depth 10⁶) runs without a stack crash.
5. Failure popup, notification, taskbar/launcher progress and failure badge work (or degrade silently).
6. The Groq key can be saved and survives a restart (Linux with a keyring), or is kept for the session with a clear message (Linux without a keyring).
7. Menu and button labels show `Ctrl+…` on Windows/Linux and `⌘…` on macOS.
8. The macOS build behaves exactly as v1.0.

## 7. Test plan

| Level | How | Covers |
|---|---|---|
| Unit / engine | `npm test` on all 3 CI runners | generator, comparison, compile/run/timeout/kill, sample check, generators, Java |
| Packaging | CI builds every installer; job fails if a target fails | X20–X24 |
| Smoke on real OS | Install the CI-built app in a VM (UTM on this Mac: Windows 11 ARM running the x64 build, Ubuntu 24.04) and run the acceptance list | X2–X19, UI |
| Manual edge cases | No toolchains installed; Store-alias Python only; Linux without a keyring; paths with spaces; non-ASCII output | X3, X5, X10, X13 |

## 8. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Windows Defender scans the new `.exe` on first run | False *TLE* on test 1 | Warm-up run after compile (X12); larger first-run timeout |
| Windows process start is slower (~10–30 ms) | Fewer tests/s | Acceptable; shown in the speed column |
| MinGW DLLs missing at run time | Program fails with no output | `-static` (X8) and compiler `bin` dir on PATH (X7) |
| Microsoft Store Python alias | Detection "finds" a fake Python | Reject `WindowsApps` paths (X3) |
| Unsigned installer | SmartScreen warning | Documented "More info → Run anyway"; signing is a non-goal |
| Ubuntu 22.04+ lacks FUSE 2 for AppImage | AppImage won't start | Document `sudo apt install libfuse2`; offer `.deb` |
| Ubuntu 24.04 AppArmor blocks Electron's sandbox for AppImages | App exits at launch | Prefer `.deb` (installs normally); document the AppArmor profile; never disable the renderer sandbox |
| No keyring on minimal Linux | Key can't be stored encrypted | Session-only key + message (X13) |
| Can't test Windows/Linux GUI on this Mac directly | UI bugs slip through | CI tests on real OSes + VM smoke test (§7) |
| GitHub Actions minutes on a private repo | Builds stop when the free quota (2,000 min/month) runs out | Free and unlimited once the repo is public; one full build ≈ 15 min |

## 9. Milestones

| # | Milestone | Contents | Done when |
|---|---|---|---|
| M1 | Platform layer + engine | X1–X12, X27 | `npm test` passes on all 3 CI runners |
| M2 | Desktop + UI | X13–X19 | Acceptance 5–7 in a VM |
| M3 | Packaging + CI release | X20–X26 | All installers built by CI and attached to a test release |
| M4 | Docs + release v1.1.0 | X28–X29 | README download table live; acceptance list passed on all 3 OSes |

## 10. Open questions (need a decision)

1. **Package formats:** Windows installer + portable zip, and Linux AppImage + `.deb` (recommended), or fewer?
2. **CI:** OK to add GitHub Actions to the repo? (Unlimited for public repos; limited minutes while private.)
3. **Architectures:** x64 only (recommended), or also arm64 for Windows/Linux?
4. **Version:** release as **v1.1.0** with all three OSes (recommended), keeping v1.0.0 as the macOS-only release?
5. **VM testing:** will you install a Windows 11 / Ubuntu VM for the final smoke test, or is CI testing enough for the submission?
