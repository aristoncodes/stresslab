// LLM calls (main process only, built-in fetch, no SDKs).
// Providers: Gemini (default), Groq (OpenAI-compatible), Ollama (local).
import { validateSpec } from './generator.js'

const TIMEOUT_MS = 60000
const MAX_RETRIES = 2

const SYSTEM_PROMPT = `You convert the "Input" section of a competitive programming problem into a small test-generator spec.

SPEC LANGUAGE (one statement per line, # starts a comment):
  x: int L..R                        random integer in [L, R]
  a: array[n] int L..R               n random integers
  a: distinct[n] int L..R            n distinct integers
  a: sorted[n] int L..R              n integers in non-decreasing order
  p: perm[n]                         random permutation of 1..n
  s: string[n] "a-z"                 n characters from the set (ranges like a-z allowed)
  g: grid[n][m] ".#"                 n rows of m characters
  e: tree n [weighted L..R]          n-1 edges "u v [w]" of a random tree on 1..n
  e: graph n m [connected] [weighted L..R]   m edges of a simple undirected graph on 1..n
  q: pairs[k] L..R                   k lines "l r" with L <= l <= r <= R
  repeat t { ... }                   repeat the block t times; the closing } goes on its own line
  print item item ...                print items on one line separated by spaces
Ranges and sizes may use integers, earlier int variables and + - * / ^ ( ), e.g. 1..n-1.
Declarations print nothing; only print lines produce output. Print everything in the exact order and line layout of the Input section.

RULES FOR STRESS TESTING:
- Shrink ALL sizes: every count, length, n, m, q, t must be at most 8.
- Keep values small: within -10..10 (or 1..10 if values must be positive), unless the problem needs otherwise (e.g. values bounded by n, or characters limited to a set).
- Keep every constraint that makes the input valid (distinctness, sortedness, connectivity, 1 <= l <= r <= n, etc.).
- Output ONLY the spec. No explanation, no markdown fences.`

export const EXAMPLES = [
  {
    input: `The first line contains two integers n and k (1 <= n <= 2*10^5, 1 <= k <= n).
The second line contains n integers a_1..a_n (-10^9 <= a_i <= 10^9).`,
    spec: `n: int 1..8
k: int 1..n
a: array[n] int -10..10
print n k
print a`
  },
  {
    input: `The first line contains t (1 <= t <= 10^4), the number of test cases.
Each test case consists of a line with n (1 <= n <= 10^5) and a line with a binary string s of length n.`,
    spec: `t: int 1..3
print t
repeat t {
  n: int 1..8
  s: string[n] "01"
  print n
  print s
}`
  },
  {
    input: `The first line contains n (2 <= n <= 2*10^5), the number of vertices. Each of the next n-1 lines contains u, v and w (1 <= w <= 10^9): an edge of the tree with weight w. The last line contains q queries... Then q lines follow, each with two vertices x y.`,
    spec: `n: int 2..8
e: tree n weighted 1..10
q: int 1..8
x: pairs[q] 1..n
print n
print e
print q
print x`
  }
]

function buildMessages(problemText) {
  const msgs = []
  for (const ex of EXAMPLES) {
    msgs.push({ role: 'user', content: ex.input }, { role: 'assistant', content: ex.spec })
  }
  msgs.push({ role: 'user', content: problemText })
  return msgs
}

async function postJson(url, body, headers = {}) {
  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    })
  } catch (e) {
    throw new Error(e.name === 'TimeoutError' ? 'Request timed out' : `Network error: ${e.message}`)
  }
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = null
  }
  if (!res.ok) {
    const msg = json?.error?.message ?? json?.error ?? text.slice(0, 200)
    throw new Error(`HTTP ${res.status}: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`)
  }
  return json
}

// messages: [{ role: 'user'|'assistant', content }]; returns the reply text.
async function chat({ provider, model, apiKey }, system, messages) {
  if (provider === 'gemini') {
    if (!apiKey) throw new Error('No Gemini API key. Add one in Settings (free at aistudio.google.com).')
    const json = await postJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        systemInstruction: { parts: [{ text: system }] },
        contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        generationConfig: { temperature: 0.2 }
      },
      { 'x-goog-api-key': apiKey }
    )
    return json?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
  }
  if (provider === 'groq') {
    if (!apiKey) throw new Error('No Groq API key. Add one in Settings.')
    const json = await postJson(
      'https://api.groq.com/openai/v1/chat/completions',
      { model, temperature: 0.2, messages: [{ role: 'system', content: system }, ...messages] },
      { Authorization: `Bearer ${apiKey}` }
    )
    return json?.choices?.[0]?.message?.content ?? ''
  }
  if (provider === 'ollama') {
    const json = await postJson('http://localhost:11434/api/chat', {
      model,
      stream: false,
      options: { temperature: 0.2 },
      messages: [{ role: 'system', content: system }, ...messages]
    }).catch((e) => {
      throw new Error(e.message.startsWith('Network') ? 'Ollama is not running on localhost:11434 (run: ollama serve)' : e.message)
    })
    return json?.message?.content ?? ''
  }
  throw new Error(`Unknown provider "${provider}"`)
}

// Models sometimes wrap output in ``` fences despite instructions.
function cleanSpec(text) {
  const fenced = /```[a-z]*\n([\s\S]*?)```/i.exec(text)
  return (fenced ? fenced[1] : text).trim()
}

/**
 * Problem text → validated spec. On a parser error, retries with the error
 * message (max 2 retries). Returns { ok, spec, attempts, error? }.
 */
export async function specFromText(llm, problemText) {
  const messages = buildMessages(problemText)
  let spec = ''
  let error = ''
  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    spec = cleanSpec(await chat(llm, SYSTEM_PROMPT, messages))
    const v = validateSpec(spec)
    if (v.ok) return { ok: true, spec, attempts: attempt }
    error = v.message
    messages.push(
      { role: 'assistant', content: spec },
      { role: 'user', content: `The spec parser reported: ${error}\nFix it and output only the corrected spec.` }
    )
  }
  return { ok: false, spec, attempts: MAX_RETRIES + 1, error }
}

// Settings "Test" button: a tiny round-trip to check provider/model/key.
export async function testConnection(llm) {
  const reply = await chat(llm, 'Reply with the single word OK.', [{ role: 'user', content: 'ping' }])
  return reply.trim().slice(0, 40) || '(empty reply)'
}
