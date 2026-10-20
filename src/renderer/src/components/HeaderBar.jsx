export default function HeaderBar() {
  return (
    <header className="header-bar">
      <span className="brand">StressLab</span>
      <nav>
        <span className="nav-current">Stress Test</span>
        <span className="sep">|</span>
        <button className="link light" onClick={() => window.api.openSettings()}>
          Settings
        </button>
      </nav>
    </header>
  )
}
