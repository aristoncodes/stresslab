// Update check: asks GitHub for the latest release and, when it's newer than this
// build, offers to open the download page. No auto-install: the macOS build isn't
// code-signed, which Squirrel/electron-updater requires.
import { app, dialog, shell } from 'electron'
import { getSettings, saveSettings } from './settings.js'
import { getWindow } from './windows.js'

const REPO = 'aristoncodes/stresslab'
const LATEST_API = `https://api.github.com/repos/${REPO}/releases/latest`
const RELEASES_PAGE = `https://github.com/${REPO}/releases/latest`
const STARTUP_DELAY_MS = 8000

// "v1.10.0" > "1.9.2"; non-numeric parts count as 0.
export function isNewer(latest, current) {
  const parse = (v) => String(v).replace(/^v/, '').split(/[.-]/).slice(0, 3).map((n) => parseInt(n, 10) || 0)
  const a = parse(latest)
  const b = parse(current)
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i]
  return false
}

async function fetchLatest() {
  const res = await fetch(LATEST_API, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': `StressLab/${app.getVersion()}` },
    signal: AbortSignal.timeout(10000)
  })
  if (!res.ok) throw new Error(`GitHub answered HTTP ${res.status}`)
  const r = await res.json()
  return { version: String(r.tag_name ?? '').replace(/^v/, ''), notes: String(r.body ?? '').slice(0, 600) }
}

// manual: from Help → Check for Updates… (also reports "up to date" and errors,
// and ignores a version the user chose to skip).
export async function checkForUpdates({ manual = false } = {}) {
  const parent = getWindow('main') ?? undefined
  let latest
  try {
    latest = await fetchLatest()
  } catch (e) {
    if (manual) dialog.showMessageBox(parent, { type: 'warning', message: 'Couldn’t check for updates', detail: e.message })
    return
  }
  const current = app.getVersion()
  if (!latest.version || !isNewer(latest.version, current)) {
    if (manual) dialog.showMessageBox(parent, { type: 'info', message: 'StressLab is up to date', detail: `You have version ${current}.` })
    return
  }
  if (!manual && getSettings().skippedVersion === latest.version) return

  const { response } = await dialog.showMessageBox(parent, {
    type: 'info',
    message: `StressLab ${latest.version} is available`,
    detail: `You have version ${current}.${latest.notes ? `\n\n${latest.notes}` : ''}\n\nDownload the new installer and replace this app (your settings and API key are kept).`,
    buttons: ['Download', 'Later', 'Skip This Version'],
    defaultId: 0,
    cancelId: 1
  })
  if (response === 0) shell.openExternal(RELEASES_PAGE)
  if (response === 2) saveSettings({ skippedVersion: latest.version })
}

export function scheduleUpdateCheck() {
  if (!app.isPackaged) return // dev builds
  setTimeout(() => checkForUpdates(), STARTUP_DELAY_MS)
}
