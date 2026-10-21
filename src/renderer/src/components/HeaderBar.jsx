export default function HeaderBar({ onTour }) {
  return (
    <header className="header-bar">
      <span className="brand">StressLab</span>
      <nav>
        <span className="nav-current">Stress Test</span>
        <span className="sep">|</span>
        <button className="link light" onClick={onTour}>
          Walkthrough
        </button>
        <span className="sep">|</span>
        <button className="link light" onClick={() => window.api.openSettings()}>
          Settings
        </button>
      </nav>
    </header>
  )
}
