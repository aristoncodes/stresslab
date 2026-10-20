import { useEffect, useState } from 'react'

const query = () => window.matchMedia('(prefers-color-scheme: dark)')

// Follows the macOS appearance; used to pick the Monaco theme.
export function useDarkMode() {
  const [dark, setDark] = useState(() => query().matches)
  useEffect(() => {
    const mq = query()
    const onChange = (e) => setDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return dark
}

export const monacoTheme = (dark) => (dark ? 'vs-dark' : 'vs')
