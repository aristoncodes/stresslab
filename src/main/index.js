import { app, BrowserWindow } from 'electron'
import { electronApp } from '@electron-toolkit/utils'
import { createMainWindow } from './windows.js'
import { registerIpc } from './ipc.js'
import { buildMenu } from './menu.js'
import { getToolchains } from './toolchains.js'
import { stopRun } from './stress.js'

app.setName('StressLab')

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.stresslab.app')
  getToolchains() // start detection early; the sidebar awaits the same promise
  registerIpc()
  buildMenu()
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

// Kill any running child processes before quitting.
app.on('before-quit', stopRun)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
