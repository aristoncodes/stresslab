// Starter code per language, and the max-subarray demo loaded on first launch.
import sampleSol from '../../../../samples/maxsub/sol_buggy.cpp?raw'
import sampleBrute from '../../../../samples/maxsub/brute.py?raw'
import sampleSpec from '../../../../samples/maxsub/spec.txt?raw'
import sampleInput from '../../../../samples/maxsub/input.txt?raw'
import sampleTestIn from '../../../../samples/maxsub/sample_in.txt?raw'
import sampleTestOut from '../../../../samples/maxsub/sample_out.txt?raw'

export const LANGS = [
  { id: 'cpp', label: 'C++', monaco: 'cpp' },
  { id: 'python', label: 'Python', monaco: 'python' },
  { id: 'java', label: 'Java', monaco: 'java' }
]
export const langInfo = (id) => LANGS.find((l) => l.id === id) ?? LANGS[0]

export const TEMPLATES = {
  cpp: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    \n}\n',
  python: 'import sys\ninput = sys.stdin.readline\n\n',
  java:
    'import java.io.*;\nimport java.util.*;\n\npublic class Main {\n    public static void main(String[] args) throws IOException {\n        \n    }\n}\n'
}

// Custom generators get the seed as argv[1] (and the test number as argv[2]).
export const GEN_TEMPLATES = {
  cpp:
    '#include <bits/stdc++.h>\nusing namespace std;\n\nint main(int argc, char** argv) {\n    mt19937 rng(atoi(argv[1]));\n    auto rnd = [&](int lo, int hi) { return (int)(rng() % (hi - lo + 1)) + lo; };\n    int n = rnd(1, 8);\n    cout << n << "\\n";\n    for (int i = 0; i < n; i++) cout << rnd(-10, 10) << " \\n"[i == n - 1];\n}\n',
  python:
    'import random, sys\nrandom.seed(int(sys.argv[1]))\n\nn = random.randint(1, 8)\nprint(n)\nprint(*[random.randint(-10, 10) for _ in range(n)])\n',
  java:
    'import java.util.*;\n\npublic class Gen {\n    public static void main(String[] args) {\n        Random r = new Random(Long.parseLong(args[0]));\n        int n = 1 + r.nextInt(8);\n        StringBuilder sb = new StringBuilder().append(n).append("\\n");\n        for (int i = 0; i < n; i++) sb.append(r.nextInt(21) - 10).append(i == n - 1 ? "\\n" : " ");\n        System.out.print(sb);\n    }\n}\n'
}

export const DEFAULT_STATE = {
  problem: sampleInput,
  spec: sampleSpec,
  sampleIn: sampleTestIn, // the problem statement's sample test (optional)
  sampleOut: sampleTestOut,
  mode: 'spec', // 'spec' | 'custom'
  profiles: ['random', 'edge', 'max', 'pattern'], // generators cycled in spec mode
  sol: { lang: 'cpp', code: sampleSol },
  brute: { lang: 'python', code: sampleBrute },
  gen: { lang: 'python', code: GEN_TEMPLATES.python },
  tests: 1000,
  timeoutSec: 2,
  compareMode: 'exact',
  eps: 1e-6,
  seed: ''
}
