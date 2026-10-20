import { app } from 'electron'
import { join } from 'path'

// Folder holding bits/stdc++.h. Packaged: copied via `extraResources`
// next to app.asar. Dev: the repo's resources/ folder.
export function includeDir() {
  return app.isPackaged
    ? join(process.resourcesPath, 'include')
    : join(app.getAppPath(), 'resources', 'include')
}
