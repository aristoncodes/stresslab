// Bundle Monaco locally so the app works offline (no CDN loader).
import * as monaco from 'monaco-editor'
import { loader } from '@monaco-editor/react'
import EditorWorker from 'monaco-editor/editor/editor.worker?worker'

// C++/Python/Java have no dedicated language workers; the base editor worker is enough.
self.MonacoEnvironment = {
  getWorker: () => new EditorWorker()
}

loader.config({ monaco })

// The editor creates and manages its own models, so it needs Monaco directly.
export { monaco }

// Sublime Text 4's default "Mariana" colour scheme, used by the editor and the
// stress tester's code panes.
monaco.editor.defineTheme('stresslab-mariana', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: '', foreground: 'D8DEE9', background: '303841' },
    { token: 'comment', foreground: 'A6ACB9' },
    { token: 'keyword', foreground: 'C695C6' },
    { token: 'keyword.directive', foreground: 'C695C6' },
    { token: 'keyword.flow', foreground: 'C695C6' },
    { token: 'type', foreground: 'C695C6', fontStyle: 'italic' },
    { token: 'type.identifier', foreground: '5FB4B4' },
    { token: 'string', foreground: '99C794' },
    { token: 'string.escape', foreground: '5FB4B4' },
    { token: 'number', foreground: 'F9AE58' },
    { token: 'constant', foreground: 'F9AE58', fontStyle: 'italic' },
    { token: 'operator', foreground: 'F97B58' },
    { token: 'delimiter', foreground: 'D8DEE9' },
    { token: 'identifier', foreground: 'D8DEE9' },
    { token: 'predefined', foreground: '5FB4B4' },
    { token: 'annotation', foreground: '6699CC' },
    { token: 'tag', foreground: 'EC5F66' }
  ],
  colors: {
    'editor.background': '#303841',
    'editor.foreground': '#D8DEE9',
    'editor.lineHighlightBackground': '#3B444E',
    'editor.selectionBackground': '#4F5B66',
    'editor.inactiveSelectionBackground': '#46515C',
    'editorCursor.foreground': '#F9AE58',
    'editorWhitespace.foreground': '#4F5B66',
    'editorLineNumber.foreground': '#7A8590',
    'editorLineNumber.activeForeground': '#D8DEE9',
    'editorIndentGuide.background1': '#4A545F',
    'editorIndentGuide.activeBackground1': '#6E7A85',
    'editorBracketMatch.background': '#4F5B6680',
    'editorBracketMatch.border': '#6E7A85',
    'editorGutter.background': '#303841',
    'minimap.background': '#303841',
    'editorOverviewRuler.border': '#303841',
    'scrollbarSlider.background': '#4F5B6680',
    'editorWidget.background': '#262D34',
    'editorSuggestWidget.background': '#262D34',
    'editorSuggestWidget.selectedBackground': '#3B444E',
    'editorError.foreground': '#EC5F66'
  }
})
