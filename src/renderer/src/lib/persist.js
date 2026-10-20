import { useEffect, useState } from 'react'

// localStorage can throw (private mode, quota) — never let that break the app.
export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback
  } catch {
    return fallback
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}

export const hasSaved = (key) => {
  try {
    return localStorage.getItem(key) !== null
  } catch {
    return false
  }
}

// useState that is restored from / saved (debounced) to localStorage.
export function usePersistentState(key, fallback) {
  const [value, setValue] = useState(() => load(key, fallback))
  useEffect(() => {
    const t = setTimeout(() => save(key, value), 300)
    return () => clearTimeout(t)
  }, [key, value])
  return [value, setValue]
}
