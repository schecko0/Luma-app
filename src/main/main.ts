import { app, BrowserWindow, ipcMain, shell } from 'electron'
import path from 'path'
import { initDatabase } from '../database/database'
import { registerAllHandlers } from './ipc/handlers'
import { setupLogger } from './logger'

const isDev = !app.isPackaged

let mainWindow: BrowserWindow | null = null

async function createWindow() {
  // dist/main/main.js  →  ../preload/preload.js  →  dist/preload/preload.js  ✓
  const preloadPath = path.join(__dirname, '../preload/preload.js')

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#0f0d0b',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    if (isDev) {
      mainWindow?.webContents.openDevTools({ mode: 'detach' })
    }
  })

  if (isDev) {
    // vite-plugin-electron arranca el servidor Vite antes que Electron,
    // así que localhost:5173 ya está disponible cuando llegamos aquí.
    await mainWindow.loadURL('http://localhost:5173')
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(async () => {
  setupLogger()

  try {
    await initDatabase()
  } catch (err) {
    console.error('[Main] Error al inicializar base de datos:', err)
  }

  registerAllHandlers(ipcMain)
  await createWindow()

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
