import { useEffect, useState } from 'react'

// Files open in the editor, offered by the stress tester's "From editor" pickers.
// The editor publishes the list and a way to read a buffer's current text
// (unsaved edits included).
let files = [] // [{ path, lang }]
let readText = () => null
const subscribers = new Set()

export function publishOpenFiles(list, reader) {
  files = list
  readText = reader
  subscribers.forEach((fn) => fn(files))
}

export const editorText = (path) => readText(path)

export function useOpenFiles() {
  const [list, setList] = useState(files)
  useEffect(() => {
    subscribers.add(setList)
    return () => subscribers.delete(setList)
  }, [])
  return list
}
