// Every OS-specific fact lives here (see PRD-cross-platform.md §4.1).
// No Electron imports, so the engine stays testable with plain Node.
import { existsSync, readdirSync, realpathSync } from 'fs'
import { delimiter, dirname, join } from 'path'
import { homedir } from 'os'

export const isWin = process.platform === 'win32'
export const isMac = process.platform === 'darwin'
export const isLinux = process.platform === 'linux'

// Compiled programs need ".exe" on Windows or spawn can't find them.
export const exeName = (base) => (isWin ? `${base}.exe` : base)

const env = process.env
const PROGRAM_FILES = [env.ProgramFiles, env['ProgramFiles(x86)']].filter(Boolean)

// Directories searched in addition to PATH (apps launched from Finder/Explorer
// often get a minimal PATH).
export const STD_BIN_DIRS = isWin
  ? []
  : isMac
    ? ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin']
    : ['/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin']

// Where MinGW-w64 g++ is usually installed on Windows.
export const WIN_CPP_DIRS = [
  'C:\\msys64\\ucrt64\\bin',
  'C:\\msys64\\mingw64\\bin',
  'C:\\mingw64\\bin',
  'C:\\ProgramData\\mingw64\\mingw64\\bin', // Chocolatey "mingw"
  'C:\\ProgramData\\chocolatey\\bin',
  'C:\\MinGW\\bin',
  join(homedir(), 'scoop', 'apps', 'gcc', 'current', 'bin'),
  join(homedir(), 'scoop', 'shims'),
  ...PROGRAM_FILES.map((p) => join(p, 'CodeBlocks', 'MinGW', 'bin'))
]

// python.org installs: %LOCALAPPDATA%\Programs\Python\Python3XX\python.exe (newest first).
export function winPythonDirs() {
  const base = join(env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'), 'Programs', 'Python')
  return subdirs(base, /^Python3\d+/).sort(byVersionDesc)
}

// JDK homes that are commonly installed but not always on PATH.
export function jdkHomeCandidates() {
  if (isWin) {
    return PROGRAM_FILES.flatMap((pf) =>
      ['Java', 'Eclipse Adoptium', 'Microsoft', 'Zulu', 'Amazon Corretto'].flatMap((vendor) => subdirs(join(pf, vendor)))
    ).sort(byVersionDesc)
  }
  return subdirs('/usr/lib/jvm').sort(byVersionDesc)
}

function subdirs(dir, pattern = /./) {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && pattern.test(d.name))
      .map((d) => join(dir, d.name))
  } catch {
    return []
  }
}

// "…/jdk-21.0.2" sorts before "…/jdk-17"; "Python312" before "Python39".
function byVersionDesc(a, b) {
  const v = (s) => (s.match(/\d+/g) ?? []).map(Number)
  const [x, y] = [v(a), v(b)]
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (y[i] ?? 0) - (x[i] ?? 0)
  return 0
}

// First existing executable `name` on PATH or in `extraDirs` (adds .exe on Windows).
export function which(name, extraDirs = []) {
  const file = isWin && !name.endsWith('.exe') ? `${name}.exe` : name
  const dirs = [...(env.PATH ?? '').split(delimiter), ...extraDirs, ...STD_BIN_DIRS].filter(Boolean)
  for (const dir of dirs) {
    const p = join(dir, file)
    if (existsSync(p)) return p
  }
  return null
}

// Follow symlinks such as /usr/bin/javac → /etc/alternatives → /usr/lib/jvm/… .
export function realPath(p) {
  try {
    return realpathSync(p)
  } catch {
    return p
  }
}

// The Microsoft Store "python.exe" alias opens the Store instead of running Python.
export const isStoreAlias = (p) => isWin && /\\WindowsApps\\/i.test(p)

// Environment for child processes: full PATH plus UTF-8 I/O (Windows defaults
// to a legacy code page). `extraDirs` go first (e.g. MinGW's bin for its DLLs).
export function childEnv(extraDirs = []) {
  const parts = [...extraDirs, ...(env.PATH ?? '').split(delimiter), ...STD_BIN_DIRS].filter(Boolean)
  return { ...env, PATH: [...new Set(parts)].join(delimiter), PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' }
}

export const binDirOf = (exe) => dirname(exe)

// Install hints shown in the sidebar when a toolchain is missing.
export const INSTALL_HINTS = {
  cpp: isWin
    ? 'Install MinGW-w64 g++: install MSYS2 (msys2.org), then run: pacman -S mingw-w64-ucrt-x86_64-gcc'
    : isMac
      ? 'Install Xcode CLT: xcode-select --install (or brew install gcc)'
      : 'Install g++: sudo apt install build-essential (Fedora: sudo dnf install gcc-c++)',
  cppBroken: isWin
    ? 'g++ cannot build programs. Reinstall MinGW-w64 (MSYS2 ucrt64) and make sure its bin folder is complete.'
    : isMac
      ? 'Compiler cannot link. Try: brew install gcc, or sudo xcode-select -s /Library/Developer/CommandLineTools'
      : 'g++ cannot build programs. Try: sudo apt install --reinstall build-essential',
  python: isWin
    ? 'Install Python 3 from python.org (tick "Add to PATH") or: winget install Python.Python.3.12'
    : isMac
      ? 'Install Python 3: brew install python'
      : 'Install Python 3: sudo apt install python3',
  java: isWin
    ? 'Install a JDK: winget install EclipseAdoptium.Temurin.21.JDK'
    : isMac
      ? 'Install a JDK: brew install openjdk'
      : 'Install a JDK: sudo apt install openjdk-21-jdk'
}
