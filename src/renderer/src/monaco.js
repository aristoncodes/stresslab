// Bundle Monaco locally so the app works offline (no CDN loader).
import * as monaco from 'monaco-editor'
import { loader } from '@monaco-editor/react'
import EditorWorker from 'monaco-editor/editor/editor.worker?worker'

// C++/Python/Java have no dedicated language workers; the base editor worker is enough.
self.MonacoEnvironment = {
  getWorker: () => new EditorWorker()
}

loader.config({ monaco })
