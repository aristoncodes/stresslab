import Editor from '@monaco-editor/react'

// Phase 0 placeholder: proves the secure window and local Monaco bundle work.
export default function App() {
  return (
    <div className="app">
      <header className="header-bar">StressLab</header>
      <div style={{ height: 300, border: '1px solid var(--border)', margin: 8 }}>
        <Editor defaultLanguage="cpp" defaultValue={'#include <bits/stdc++.h>\nint main() {}\n'} />
      </div>
    </div>
  )
}
