// Electron prefixes errors thrown in ipcMain.handle; show only our message.
export const cleanError = (e) => String(e?.message ?? e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
