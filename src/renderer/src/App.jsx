import { useEffect, useState } from 'react'
import Shell from './views/Shell'
import FailureView from './views/FailureView'
import SettingsView from './views/SettingsView'

// Every window loads the same bundle; main picks the view with the URL hash.
// The failure window is reused, so re-render when main changes the hash.
export default function App() {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const onChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const [view, arg] = hash.slice(1).split('/')
  if (view === 'failure') return <FailureView key={arg} runId={arg} />
  if (view === 'settings') return <SettingsView />
  return <Shell />
}
