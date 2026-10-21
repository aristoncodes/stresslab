// Detects C++, Python and Java toolchains on macOS, Windows and Linux. Uses known
// install locations as well as PATH, because apps launched from Finder/Explorer
// don't inherit the shell's PATH.
import { existsSync, readdirSync, mkdtempSync, writeFileSync, rmSync } from 'fs'
import { dirname, join } from 'path'
import { tmpdir } from 'os'
import { runProcess } from './runner.js'
import {
  isWin,
  isMac,
  exeName,
  which,
  realPath,
  isStoreAlias,
  binDirOf,
  winPythonDirs,
  jdkHomeCandidates,
  WIN_CPP_DIRS,
  INSTALL_HINTS
} from './platform.js'

async function firstLine(cmd, args) {
  const r = await runProcess({ cmd, args, timeoutMs: 10000 })
  if (r.error || r.code !== 0) return null
  // `java -version` prints to stderr.
  return (r.stdout || r.stderr).trim().split('\n')[0].trim()
}

// Highest versioned g++-NN in `dirs` (Homebrew on macOS, distro packages on Linux).
function versionedGpp(dirs) {
  for (const dir of dirs) {
    if (!existsSync(dir)) continue
    const versions = readdirSync(dir)
      .map((f) => /^g\+\+-(\d+)$/.exec(f))
      .filter(Boolean)
      .map((m) => Number(m[1]))
      .sort((a, b) => b - a)
    if (versions.length) return join(dir, `g++-${versions[0]}`)
  }
  return null
}

function findCpp() {
  if (isWin) {
    const path = which('g++', WIN_CPP_DIRS)
    return path && { path, kind: 'gcc', binDir: binDirOf(path) }
  }
  if (isMac) {
    // Prefer Homebrew GCC; /usr/bin/g++ is Apple Clang.
    const brew = versionedGpp(['/opt/homebrew/bin', '/usr/local/bin'])
    if (brew) return { path: brew, kind: 'gcc' }
    return existsSync('/usr/bin/g++') ? { path: '/usr/bin/g++', kind: 'clang' } : null
  }
  const path = versionedGpp(['/usr/bin', '/usr/local/bin']) ?? which('g++')
  return path && { path, kind: 'gcc' }
}

// Compile + link a trivial program: catches broken installs (e.g. CLT/SDK mismatch,
// MinGW missing its DLLs).
async function cppLinks({ path, binDir }) {
  const dir = mkdtempSync(join(tmpdir(), 'stresslab-probe-'))
  try {
    writeFileSync(join(dir, 'p.cpp'), 'int main(){return 0;}\n')
    const r = await runProcess({
      cmd: path,
      args: [join(dir, 'p.cpp'), '-o', join(dir, exeName('p'))],
      timeoutMs: 60000,
      extraPath: binDir ? [binDir] : []
    })
    return r.code === 0 ? null : (r.error || r.stderr || `exit code ${r.code}`).trim().split('\n').slice(0, 3).join('\n')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

async function detectCpp() {
  const found = findCpp()
  if (!found) return { ok: false, hint: INSTALL_HINTS.cpp }
  const version = await firstLine(found.path, ['--version'])
  const linkError = await cppLinks(found)
  if (linkError) return { ok: false, ...found, version, hint: INSTALL_HINTS.cppBroken, error: linkError }
  return { ok: true, ...found, version }
}

// Python: `py -3` launcher on Windows (python3 rarely exists there), else python3/python.
async function detectPython() {
  const candidates = []
  if (isWin) {
    const py = which('py')
    if (py) candidates.push({ path: py, args: ['-3'] })
    for (const p of [which('python'), ...winPythonDirs().map((d) => join(d, 'python.exe'))]) {
      if (p && !isStoreAlias(p)) candidates.push({ path: p, args: [] })
    }
  } else if (isMac) {
    for (const p of ['/opt/homebrew/bin/python3', '/usr/local/bin/python3', '/usr/bin/python3']) candidates.push({ path: p, args: [] })
  } else {
    const p = which('python3')
    if (p) candidates.push({ path: p, args: [] })
  }
  for (const c of candidates) {
    if (!existsSync(c.path)) continue
    const version = await firstLine(c.path, [...c.args, '--version'])
    if (version?.startsWith('Python 3')) return { ok: true, ...c, version }
  }
  return { ok: false, hint: INSTALL_HINTS.python }
}

// A JDK home is valid when bin/javac and bin/java exist.
function jdk(home) {
  if (!home) return null
  const javac = join(home, 'bin', exeName('javac'))
  const java = join(home, 'bin', exeName('java'))
  return existsSync(javac) && existsSync(java) ? { home, javac, java } : null
}

async function findJdk() {
  if (isMac) {
    // /usr/bin/java exists even without a JDK, so ask java_home for a real one.
    const r = await runProcess({ cmd: '/usr/libexec/java_home', args: [], timeoutMs: 10000 })
    return r.code === 0 ? jdk(r.stdout.trim()) : null
  }
  const onPath = which('javac')
  // javac on PATH may be a symlink (Linux alternatives): its JDK home is two levels up.
  const fromPath = onPath && dirname(dirname(realPath(onPath)))
  for (const home of [process.env.JAVA_HOME, fromPath, ...jdkHomeCandidates()]) {
    const found = jdk(home)
    if (found) return found
  }
  return null
}

async function detectJava() {
  const found = await findJdk()
  if (!found) return { ok: false, hint: INSTALL_HINTS.java }
  const version = await firstLine(found.java, ['-version'])
  return { ok: true, ...found, version }
}

export async function detectToolchains() {
  const [cpp, python, java] = await Promise.all([detectCpp(), detectPython(), detectJava()])
  return { cpp, python, java }
}
