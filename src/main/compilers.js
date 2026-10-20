// Detects C++, Python and Java toolchains using absolute paths, because an app
// launched from Finder does not inherit the shell's PATH.
import { existsSync, readdirSync, mkdtempSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { runProcess } from './runner.js'

const BREW_BINS = ['/opt/homebrew/bin', '/usr/local/bin']

async function firstLine(cmd, args) {
  const r = await runProcess({ cmd, args, timeoutMs: 10000 })
  if (r.error || r.code !== 0) return null
  // `java -version` prints to stderr.
  return (r.stdout || r.stderr).trim().split('\n')[0]
}

// Highest Homebrew g++-NN, else Apple's g++ (Clang).
function findCpp() {
  for (const bin of BREW_BINS) {
    if (!existsSync(bin)) continue
    const versions = readdirSync(bin)
      .map((f) => /^g\+\+-(\d+)$/.exec(f))
      .filter(Boolean)
      .map((m) => Number(m[1]))
      .sort((a, b) => b - a)
    if (versions.length) return { path: join(bin, `g++-${versions[0]}`), kind: 'gcc' }
  }
  return existsSync('/usr/bin/g++') ? { path: '/usr/bin/g++', kind: 'clang' } : null
}

// Compile + link a trivial program: catches broken installs (e.g. CLT/SDK mismatch).
async function cppLinks(path) {
  const dir = mkdtempSync(join(tmpdir(), 'stresslab-probe-'))
  try {
    writeFileSync(join(dir, 'p.cpp'), 'int main(){return 0;}\n')
    const r = await runProcess({ cmd: path, args: [join(dir, 'p.cpp'), '-o', join(dir, 'p')], timeoutMs: 30000 })
    return r.code === 0 ? null : r.stderr.trim().split('\n').slice(0, 3).join('\n')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

async function detectCpp() {
  const found = findCpp()
  if (!found) return { ok: false, hint: 'Install Xcode CLT: xcode-select --install (or brew install gcc)' }
  const version = await firstLine(found.path, ['--version'])
  const linkError = await cppLinks(found.path)
  if (linkError) {
    return {
      ok: false,
      ...found,
      version,
      hint: 'Compiler cannot link. Try: brew install gcc, or sudo xcode-select -s /Library/Developer/CommandLineTools',
      error: linkError
    }
  }
  return { ok: true, ...found, version }
}

async function detectPython() {
  for (const path of [...BREW_BINS.map((b) => join(b, 'python3')), '/usr/bin/python3']) {
    if (!existsSync(path)) continue
    const version = await firstLine(path, ['--version'])
    if (version) return { ok: true, path, version }
  }
  return { ok: false, hint: 'Install Python 3: brew install python' }
}

// /usr/bin/java exists even without a JDK, so ask java_home for a real one.
async function detectJava() {
  const r = await runProcess({ cmd: '/usr/libexec/java_home', args: [], timeoutMs: 10000 })
  const home = r.code === 0 ? r.stdout.trim() : ''
  const javac = join(home, 'bin', 'javac')
  const java = join(home, 'bin', 'java')
  if (!home || !existsSync(javac)) return { ok: false, hint: 'Install a JDK: brew install openjdk' }
  const version = await firstLine(java, ['-version'])
  return { ok: true, home, javac, java, version }
}

export async function detectToolchains() {
  const [cpp, python, java] = await Promise.all([detectCpp(), detectPython(), detectJava()])
  return { cpp, python, java }
}
