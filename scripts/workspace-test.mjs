// Editor file-access tests (path confinement, read/write, watcher): `npm run ws-test`
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, readFileSync, existsSync, rmSync, unlinkSync, rmdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { confine, list, read, write, create, rename, allFiles, watchFolder } from '../src/main/workspace.js'

let failures = 0
function check(name, cond, detail = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)
  if (!cond) failures++
}
const throws = async (fn) => {
  try {
    await fn()
    return false
  } catch {
    return true
  }
}

const base = mkdtempSync(join(tmpdir(), 'stresslab-ws-'))
const root = join(base, 'project')
mkdirSync(join(root, 'src'), { recursive: true })
mkdirSync(join(root, 'node_modules'))
writeFileSync(join(root, 'src', 'main.cpp'), 'int main(){}\n')
writeFileSync(join(root, 'b.py'), 'print(1)\n')
writeFileSync(join(base, 'secret.txt'), 'outside')

try {
  // --- Confinement ---
  check('relative path inside is allowed', confine(root, 'src/main.cpp').endsWith('main.cpp'))
  check('".." escape is rejected', await throws(() => confine(root, '../secret.txt')))
  check('nested ".." escape is rejected', await throws(() => confine(root, 'src/../../secret.txt')))
  check('absolute path is rejected', await throws(() => confine(root, join(base, 'secret.txt'))))
  check('NUL byte is rejected', await throws(() => confine(root, 'a\0b')))
  let symlinkMade = false
  try {
    symlinkSync(base, join(root, 'escape'), 'junction')
    symlinkMade = true
  } catch {
    /* symlinks may need privileges on Windows */
  }
  if (symlinkMade) {
    check('symlink pointing outside is rejected', await throws(() => read(root, 'escape/secret.txt')))
    // Remove only the link itself (a junction on Windows needs rmdir).
    try {
      unlinkSync(join(root, 'escape'))
    } catch {
      rmdirSync(join(root, 'escape'))
    }
  }

  // --- Listing ---
  const top = await list(root)
  check('folders first, ignored names hidden', top.map((e) => e.name).join(',') === 'src,b.py', top.map((e) => e.name).join(','))
  check('paths use forward slashes', (await list(root, 'src'))[0].path === 'src/main.cpp')
  check('allFiles walks the tree', (await allFiles(root)).sort().join(',') === 'b.py,src/main.cpp')

  // --- Read / write / create / rename ---
  check('read', (await read(root, 'b.py')) === 'print(1)\n')
  await write(root, 'b.py', 'print(2)\n')
  check('atomic write', readFileSync(join(root, 'b.py'), 'utf8') === 'print(2)\n' && !existsSync(join(root, '.b.py.stresslab-tmp')))
  await create(root, 'src/new.cpp', false)
  check('create file', existsSync(join(root, 'src', 'new.cpp')))
  check('create refuses to overwrite', await throws(() => create(root, 'src/new.cpp', false)))
  await create(root, 'tests', true)
  check('create folder', existsSync(join(root, 'tests')))
  await rename(root, 'src/new.cpp', 'src/renamed.cpp')
  check('rename', existsSync(join(root, 'src', 'renamed.cpp')) && !existsSync(join(root, 'src', 'new.cpp')))
  check('rename refuses to overwrite', await throws(() => rename(root, 'src/renamed.cpp', 'b.py')))
  check('write outside is rejected', await throws(() => write(root, '../secret.txt', 'x')))
  check('outside file untouched', readFileSync(join(base, 'secret.txt'), 'utf8') === 'outside')

  // --- Watcher ---
  // Batches can also contain the earlier setup operations: wait for main.cpp.
  const seen = await new Promise((done) => {
    const all = []
    const stop = watchFolder(root, (paths) => {
      all.push(...paths)
      if (all.includes('src/main.cpp')) {
        stop()
        done(all)
      }
    })
    setTimeout(() => writeFileSync(join(root, 'src', 'main.cpp'), 'int main(){return 0;}\n'), 200)
    setTimeout(() => {
      stop()
      done(all)
    }, 5000)
  })
  check('watcher reports external change', seen.includes('src/main.cpp'), JSON.stringify(seen))
} finally {
  rmSync(base, { recursive: true, force: true })
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll workspace checks passed')
process.exit(failures ? 1 : 0)
