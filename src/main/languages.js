// One table describing how to build and run each supported language.
// `tc` is the toolchains object from compilers.js, `dir` the program's temp dir.
import { join } from 'path'

// Java requires the file to be named after its public class.
export function javaClassName(code) {
  const m = /public\s+(?:(?:final|abstract)\s+)*class\s+([A-Za-z_$][\w$]*)/.exec(code)
  return m ? m[1] : 'Main'
}

export const LANGUAGES = {
  cpp: {
    label: 'C++',
    monaco: 'cpp',
    timeScale: 1,
    fileName: () => 'main.cpp',
    compile: (tc, dir, file, opts) => ({
      cmd: tc.cpp.path,
      args: [...opts.cppFlags, '-I', opts.includeDir, file, '-o', join(dir, 'main')]
    }),
    run: (tc, dir) => ({ cmd: join(dir, 'main'), args: [] })
  },
  python: {
    label: 'Python',
    monaco: 'python',
    timeScale: 3,
    fileName: () => 'main.py',
    // Not a real compile: catches syntax errors up front so they show as CE.
    compile: (tc, dir, file) => ({ cmd: tc.python.path, args: ['-m', 'py_compile', file] }),
    run: (tc, dir) => ({ cmd: tc.python.path, args: [join(dir, 'main.py')] })
  },
  java: {
    label: 'Java',
    monaco: 'java',
    timeScale: 4,
    fileName: (code) => javaClassName(code) + '.java',
    compile: (tc, dir, file) => ({ cmd: tc.java.javac, args: ['-encoding', 'UTF-8', '-d', dir, file] }),
    // Big stack for deep recursion; serial GC + C1 only = faster JVM startup on tiny tests.
    run: (tc, dir, code) => ({
      cmd: tc.java.java,
      args: ['-Xss256m', '-XX:+UseSerialGC', '-XX:TieredStopAtLevel=1', '-cp', dir, javaClassName(code)]
    })
  }
}

export const DEFAULT_CPP_FLAGS = ['-O2', '-std=c++17']
