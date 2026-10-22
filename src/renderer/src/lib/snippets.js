// Snippets: Sublime Text's built-in C/C++, Python and Java snippets (same tab
// triggers), StressLab's competitive-programming snippets, and the user's own
// .sublime-snippet files from User/snippets (Sublime's XML format, so snippets
// can be copied between Sublime and StressLab). Bodies use the TextMate snippet
// syntax both editors share: $1, ${2:default}, $0, $TM_FILENAME, $SELECTION.
import { monaco } from '../monaco'

const C = ['cpp', 'c']
const s = (trigger, description, langs, body, source) => ({ trigger, description, langs, body: body.replace(/^\n/, ''), source })

// --- Sublime Text: C / C++ package ---
const SUBLIME_C = [
  s('main', 'main()', C, 'int main(int argc, char const *argv[])\n{\n\t$0\n\treturn 0;\n}'),
  s('for', 'for … (for)', C, 'for (int ${1:i} = 0; $1 < ${2:count}; ${3:++$1})\n{\n\t${0:/* code */}\n}'),
  s('fori', 'for int loop (fori)', C, 'for (${4:size_t} ${2:i} = 0; $2 < ${1:count}; ${3:++$2})\n{\n\t${0:/* code */}\n}'),
  s('if', 'if …', C, 'if (${1:/* condition */})\n{\n\t${0:/* code */}\n}'),
  s('ife', 'if … else', C, 'if (${1:/* condition */})\n{\n\t${2:/* code */}\n}\nelse\n{\n\t${0:/* code */}\n}'),
  s('while', 'while …', C, 'while (${1:/* condition */})\n{\n\t${0:/* code */}\n}'),
  s('do', 'do … while loop (do)', C, 'do\n{\n\t${0:/* code */}\n} while (${1:/* condition */});'),
  s('class', 'class …', ['cpp'], 'class ${1:${TM_FILENAME_BASE:Name}}\n{\npublic:\n\t${1/(\\w+).*/$1/}(${2:/* args */});\n\t~${1/(\\w+).*/$1/}();\n\nprivate:\n\t${0:/* data */}\n};'),
  s('struct', 'struct …', C, 'struct ${1:name_t}\n{\n\t${0:/* data */}\n};'),
  s('enum', 'Enumeration', C, 'enum ${1:name} { $0 };'),
  s('ns', 'namespace …', ['cpp'], 'namespace ${1:name}\n{\n\t${0:/* code */}\n} // namespace $1'),
  s('tp', 'template <typename …>', ['cpp'], 'template <typename ${1:_InputIter}>'),
  s('beginend', '$1.begin(), $1.end() (beginend)', ['cpp'], '${1:v}.begin(), ${1:v}.end()'),
  s('vector', 'std::vector (v)', ['cpp'], 'std::vector<${1:char}> v${0:};'),
  s('map', 'std::map (map)', ['cpp'], 'std::map<${1:key}, ${2:value}> map${0:};'),
  s('inc', '#include "…"', C, '#include "${1:${TM_FILENAME/\\..+$/.h/}}"'),
  s('Inc', '#include <…>', C, '#include <${1:.h}>'),
  s('def', '#ifndef … #define … #endif', C, '#ifndef ${1/([A-Za-z0-9_]+).*/$1/}\n#define ${1:SYMBOL} ${2:value}\n#endif'),
  s('#ifndef', '#ifndef … #define … #endif (header guard)', C, '#ifndef ${1:${TM_FILENAME/\\W/_/g}}\n#define $1\n\n$0\n\n#endif /* $1 */'),
  s('#if', '#if 0 … #endif', C, '#if 0\n${1:$TM_SELECTED_TEXT}\n#endif'),
  s('printf', 'printf …', C, 'printf("${1:%s}\\\\n", $2);'),
  s('fprintf', 'fprintf …', C, 'fprintf(${1:stderr}, "${2:%s}\\\\n", $3);'),
  s('readF', 'Read File Into Vector', ['cpp'], 'std::vector<char> v;\nif (FILE *fp = fopen(${1:"filename"}, "r"))\n{\n\tchar buf[1024];\n\twhile (size_t len = fread(buf, 1, sizeof(buf), fp))\n\t\tv.insert(v.end(), buf, buf + len);\n\tfclose(fp);\n}')
].map((x) => ({ ...x, source: 'Sublime: C++' }))

// --- Sublime Text: Python package ---
const SUBLIME_PY = [
  s('class', 'New Class', ['python'], 'class ${1:ClassName}(${2:object}):\n\t"""${3:docstring for $1}"""\n\tdef __init__(self, ${4:arg}):\n\t\t${5:super($1, self).__init__()}\n\t\tself.$4 = $4\n\t\t$0'),
  s('def', 'Function', ['python'], 'def ${1:function}(${2}):\n\t${0:pass}'),
  s('defs', 'Method', ['python'], 'def ${1:method}(self${2:, ${3:arg}}):\n\t${0:pass}'),
  s('for', 'for loop', ['python'], 'for ${1:x} in ${2:xrange(1,10)}:\n\t${0:pass}'),
  s('if', 'If Condition', ['python'], 'if ${1:condition}:\n\t${0:pass}'),
  s('while', 'While Loop', ['python'], 'while ${1:condition}:\n\t${0:pass}'),
  s('ifmain', 'if __name__ == \'__main__\'', ['python'], "if __name__ == '__main__':\n\t${1:main()}$0"),
  s('property', 'New Property', ['python'], 'def ${1:foo}():\n\tdoc = "${2:The $1 property.}"\n\tdef fget(self):\n\t\t${3:return self._$1}\n\tdef fset(self, value):\n\t\t${4:self._$1 = value}\n\tdef fdel(self):\n\t\t${5:del self._$1}\n\treturn locals()\n$1 = property(**$1())$0'),
  s('try', 'Try/Except', ['python'], 'try:\n\t${1:pass}\nexcept ${2:Exception} as ${3:e}:\n\t${0:raise $3}'),
  s('trye', 'Try/Except/Else', ['python'], 'try:\n\t${1:pass}\nexcept ${2:Exception} as ${3:e}:\n\t${4:raise $3}\nelse:\n\t${0:pass}'),
  s('tryf', 'Try/Except/Finally', ['python'], 'try:\n\t${1:pass}\nexcept ${2:Exception} as ${3:e}:\n\t${4:raise $3}\nfinally:\n\t${0:pass}'),
  s('tryef', 'Try/Except/Else/Finally', ['python'], 'try:\n\t${1:pass}\nexcept${2: ${3:Exception} as ${4:e}}:\n\t${5:raise}\nelse:\n\t${6:pass}\nfinally:\n\t${0:pass}')
].map((x) => ({ ...x, source: 'Sublime: Python' }))

// --- Sublime Text: Java package ---
const J = ['java']
const SUBLIME_JAVA = [
  s('ab', 'abstract', J, 'abstract '),
  s('as', 'assert', J, 'assert ${1:test} : "${2:Failure message}";$0'),
  s('br', 'break', J, 'break;\n'),
  s('ca', 'catch', J, 'catch (${1:Exception} ${2:e}) {\n\t$0\n}'),
  s('cl', 'class', J, 'class ${1:${TM_FILENAME_BASE}} ${2:extends ${3:Parent} }${4:implements ${5:Interface} }{\n\t$0\n}'),
  s('cos', 'constant string', J, 'public static final String ${1:var} = "$2";$0'),
  s('co', 'constant', J, 'static public final ${1:String} ${2:var} = $3;$0'),
  s('d.', 'default:', J, 'default:\n\t$0'),
  s('el', 'else', J, 'else {\n\t$0\n}'),
  s('elif', 'else if', J, 'else if ($1) {\n\t$0\n}'),
  s('f', 'final', J, 'final '),
  s('fe', 'for (each)', J, 'for (${1:Object} ${2:e} : ${3:collection}) {\n\t$0\n}'),
  s('for', 'for', J, 'for (int ${1:i} = 0; $1 < ${2:count}; $1++) {\n\t$0\n}'),
  s('if', 'if', J, 'if ($1) {\n\t$0\n}'),
  s('imp', 'import', J, 'import $0;'),
  s('in', 'interface', J, 'interface ${1:${TM_FILENAME_BASE}} ${2:extends ${3:Parent} }{\n\t$0\n}'),
  s('j.u', 'java.util', J, 'java.util.$0'),
  s('m', 'method', J, '${1:void} ${2:method}($3) ${4:throws $5 }{\n\t$0\n}'),
  s('main', 'main', J, 'public static void main(String[] args) {\n\t$0\n}'),
  s('pa', 'package', J, 'package $0;'),
  s('p', 'print', J, 'System.out.print($1);$0'),
  s('pl', 'println', J, 'System.out.println($1);$0'),
  s('pr', 'private', J, 'private '),
  s('po', 'protected', J, 'protected '),
  s('pu', 'public', J, 'public '),
  s('re', 'return', J, 'return '),
  s('st', 'static', J, 'static '),
  s('sw', 'switch', J, 'switch ($1) {\n\tcase $2:\n\t\t$0\n\t\tbreak;\n\tdefault:\n\t\tbreak;\n}'),
  s('sy', 'synchronized', J, 'synchronized '),
  s('th', 'throw', J, 'throw $0'),
  s('try', 'try/catch', J, 'try {\n\t$1\n} catch (${2:Exception} ${3:e}) {\n\t$0\n}'),
  s('v', 'variable', J, '${1:String} ${2:var}${3: = ${0:null}};'),
  s('wh', 'while', J, 'while ($1) {\n\t$0\n}')
].map((x) => ({ ...x, source: 'Sublime: Java' }))

// --- StressLab: competitive programming ---
const CP = [
  s('cp', 'Competitive programming template', ['cpp'], '#include <bits/stdc++.h>\nusing namespace std;\nusing ll = long long;\n\nvoid solve() {\n\t$0\n}\n\nint main() {\n\tios::sync_with_stdio(false);\n\tcin.tie(nullptr);\n\tint t = 1;\n\t${1:cin >> t;}\n\twhile (t--) solve();\n}'),
  s('fastio', 'Fast I/O', ['cpp'], 'ios::sync_with_stdio(false);\ncin.tie(nullptr);'),
  s('dsu', 'Disjoint set union', ['cpp'], 'struct DSU {\n\tvector<int> p, sz;\n\tDSU(int n) : p(n), sz(n, 1) { iota(p.begin(), p.end(), 0); }\n\tint find(int x) { return p[x] == x ? x : p[x] = find(p[x]); }\n\tbool unite(int a, int b) {\n\t\ta = find(a), b = find(b);\n\t\tif (a == b) return false;\n\t\tif (sz[a] < sz[b]) swap(a, b);\n\t\tp[b] = a, sz[a] += sz[b];\n\t\treturn true;\n\t}\n};'),
  s('segtree', 'Segment tree (sum, point update)', ['cpp'], 'struct SegTree {\n\tint n;\n\tvector<${1:long long}> t;\n\tSegTree(int n) : n(n), t(2 * n) {}\n\tvoid update(int i, $1 v) {\n\t\tfor (t[i += n] = v; i > 1; i >>= 1) t[i >> 1] = t[i] + t[i ^ 1];\n\t}\n\t$1 query(int l, int r) { // [l, r)\n\t\t$1 res = 0;\n\t\tfor (l += n, r += n; l < r; l >>= 1, r >>= 1) {\n\t\t\tif (l & 1) res += t[l++];\n\t\t\tif (r & 1) res += t[--r];\n\t\t}\n\t\treturn res;\n\t}\n};'),
  s('bfs', 'Breadth-first search', ['cpp'], 'vector<int> dist(${1:n}, -1);\nqueue<int> q;\ndist[${2:src}] = 0;\nq.push($2);\nwhile (!q.empty()) {\n\tint u = q.front();\n\tq.pop();\n\tfor (int v : ${3:adj}[u]) {\n\t\tif (dist[v] == -1) {\n\t\t\tdist[v] = dist[u] + 1;\n\t\t\tq.push(v);\n\t\t}\n\t}\n}'),
  s('dfs', 'Depth-first search (recursive lambda)', ['cpp'], 'vector<bool> vis(${1:n});\nauto dfs = [&](auto&& self, int u) -> void {\n\tvis[u] = true;\n\tfor (int v : ${2:adj}[u])\n\t\tif (!vis[v]) self(self, v);\n};\ndfs(dfs, ${3:0});'),
  s('binpow', 'Modular exponentiation', ['cpp'], 'long long binpow(long long a, long long b, long long m = ${1:1000000007}) {\n\tlong long r = 1;\n\tfor (a %= m; b; b >>= 1, a = a * a % m)\n\t\tif (b & 1) r = r * a % m;\n\treturn r;\n}'),
  s('sieve', 'Sieve of Eratosthenes', ['cpp'], 'vector<bool> is_prime(${1:N} + 1, true);\nis_prime[0] = is_prime[1] = false;\nfor (int i = 2; 1LL * i * i <= $1; i++)\n\tif (is_prime[i])\n\t\tfor (int j = i * i; j <= $1; j += i) is_prime[j] = false;'),
  s('pyfast', 'Fast input (Python)', ['python'], 'import sys\ninput = sys.stdin.readline\n\n$0'),
  s('jfast', 'Fast reader (Java)', J, 'static class FastReader {\n\tprivate final java.io.DataInputStream in = new java.io.DataInputStream(System.in);\n\tprivate final byte[] buf = new byte[1 << 16];\n\tprivate int len = 0, ptr = 0;\n\tprivate int read() throws java.io.IOException {\n\t\tif (ptr == len) { len = in.read(buf, 0, buf.length); ptr = 0; if (len <= 0) return -1; }\n\t\treturn buf[ptr++];\n\t}\n\tlong nextLong() throws java.io.IOException {\n\t\tint c = read();\n\t\twhile (c <= \' \') c = read();\n\t\tboolean neg = c == \'-\';\n\t\tif (neg) c = read();\n\t\tlong r = 0;\n\t\tfor (; c >= \'0\' && c <= \'9\'; c = read()) r = r * 10 + c - \'0\';\n\t\treturn neg ? -r : r;\n\t}\n\tint nextInt() throws java.io.IOException { return (int) nextLong(); }\n}')
].map((x) => ({ ...x, source: 'StressLab: CP' }))

export const BUILTIN_SNIPPETS = [...SUBLIME_C, ...SUBLIME_PY, ...SUBLIME_JAVA, ...CP]

// Sublime scope selector → Monaco languages.
function scopeLangs(scope = '') {
  if (!scope.trim()) return null // every language
  const out = new Set()
  if (/source\.c\+\+|source\.cpp/.test(scope)) out.add('cpp')
  if (/source\.c(?![+\w])/.test(scope)) out.add('c').add('cpp')
  if (/source\.python/.test(scope)) out.add('python')
  if (/source\.java\b/.test(scope)) out.add('java')
  if (/source\.js/.test(scope)) out.add('javascript')
  return out.size ? [...out] : null
}

// Parse a .sublime-snippet file. Returns a snippet or null.
export function parseSublimeSnippet(xml, fileName) {
  const tag = (name) => {
    const m = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(xml.replace(/<!--[\s\S]*?-->/g, ''))
    return m ? m[1].replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, '$1').trim() : ''
  }
  const content = tag('content').replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '')
  if (!content) return null
  return {
    trigger: tag('tabTrigger'),
    description: tag('description') || fileName.replace(/\.sublime-snippet$/, ''),
    langs: scopeLangs(tag('scope')),
    body: content.replace(/^\n/, '').replace(/\n$/, ''),
    source: `User: ${fileName}`
  }
}

// Sublime's "New Snippet" template.
export const NEW_SNIPPET_TEMPLATE = `<snippet>
	<content><![CDATA[
Hello, \${1:this} is a \${2:snippet}.
]]></content>
	<!-- Optional: Set a tabTrigger to define how to trigger the snippet -->
	<!-- <tabTrigger>hello</tabTrigger> -->
	<!-- Optional: Set a scope to limit where the snippet will trigger -->
	<!-- <scope>source.python</scope> -->
</snippet>
`

let all = [...BUILTIN_SNIPPETS]
export const allSnippets = () => all
export const snippetsFor = (lang) => all.filter((sn) => !sn.langs || sn.langs.includes(lang))

// Load User/snippets/*.sublime-snippet (called at start and after saving one).
export async function loadUserSnippets() {
  const user = []
  try {
    for (const f of await window.api.userList('snippets')) {
      if (f.dir || !f.name.endsWith('.sublime-snippet')) continue
      const sn = parseSublimeSnippet(await window.api.userRead(f.path), f.name)
      if (sn) user.push(sn)
    }
  } catch {
    /* no user snippets */
  }
  all = [...BUILTIN_SNIPPETS, ...user]
  return all
}

// Offer snippets in completions (Tab after a trigger expands it, like Sublime).
let registered = false
export function registerSnippetCompletions() {
  if (registered) return
  registered = true
  for (const lang of ['cpp', 'c', 'python', 'java', 'javascript', 'plaintext', 'markdown']) {
    monaco.languages.registerCompletionItemProvider(lang, {
      provideCompletionItems(model, position) {
        const word = model.getWordUntilPosition(position)
        // Triggers like "#ifndef" or "d." include non-word characters: extend the range back over them.
        const line = model.getLineContent(position.lineNumber).slice(0, position.column - 1)
        const prefix = /[#\w.]*$/.exec(line)[0]
        const start = position.column - (prefix.length || word.word.length)
        const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: start, endColumn: position.column }
        return {
          suggestions: snippetsFor(lang)
            .filter((sn) => sn.trigger)
            .map((sn) => ({
              label: { label: sn.trigger, description: sn.description },
              kind: monaco.languages.CompletionItemKind.Snippet,
              detail: sn.source,
              documentation: sn.body,
              insertText: sn.body,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              range,
              sortText: `0${sn.trigger}`
            }))
        }
      }
    })
  }
}

// Insert a snippet at the cursor(s) of an editor.
export function insertSnippet(editor, body) {
  editor.focus()
  editor.getContribution('snippetController2')?.insert(body)
}
