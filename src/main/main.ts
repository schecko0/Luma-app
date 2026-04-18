import { app, BrowserWindow, ipcMain, shell } from 'electron'
import path from 'path'
import { autoUpdater } from 'electron-updater'
import { getDb, initDatabase } from '../database/database'
import { registerAllHandlers } from './ipc/handlers'
import { logger, setupLogger } from './logger'
import { startSyncWorker } from './ipc/calendarHandlers'
import { initWhatsAppClient } from './whatsappService'

// Configuración de logs para el updater
autoUpdater.logger = logger
autoUpdater.autoDownload = true

// Forzar uso de GitHub API REST en lugar del feed HTML (evita error 406)
autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'schecko0',
  repo: 'Luma-app',
  releaseType: 'release',
})

autoUpdater.on('update-available', (info) => {
  logger.info('[AutoUpdater] ¡Update disponible! v' + info.version)
  mainWindow?.webContents.send('update-available', info)
})

autoUpdater.on('update-not-available', () => {
  logger.info('[AutoUpdater] La app está al día.')
})

autoUpdater.on('update-downloaded', (info) => {
  logger.info('[AutoUpdater] Descarga completa, lista para instalar v' + info.version)
  mainWindow?.webContents.send('update-downloaded', info)
})

autoUpdater.on('error', (err) => {
  logger.error('[AutoUpdater] Error:', err?.message ?? String(err))
})






const isDev = !app.isPackaged

// ── Single instance lock ──────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

let mainWindow: BrowserWindow | null = null

async function createWindow() {
  // dist/main/main.js  →  ../preload/preload.js  →  dist/preload/preload.js  ✓
  const preloadPath = path.join(__dirname, '../preload/preload.js')

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    frame: process.platform === 'darwin',        // Mac usa frame nativo, Windows no
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
  mainWindow.setMenuBarVisibility(false)

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    if (isDev) {
      mainWindow?.webContents.openDevTools({ mode: 'detach' })
    }
    // ✅ Aquí sí existe mainWindow para buscar actualizaciones, porque esperamos a 'ready-to-show'
    if (!isDev) {
      logger.info('[AutoUpdater] Iniciando chequeo de actualizaciones (v' + app.getVersion() + ')')
      autoUpdater.checkForUpdatesAndNotify()
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
  // Si se intenta abrir una segunda instancia, enfocar la ventana existente
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
  setupLogger()

  try {
    await initDatabase()
  } catch (err) {
    console.error('[Main] Error al inicializar base de datos:', err)
  }

  registerAllHandlers(ipcMain)
  // Exponer versión al renderer
  ipcMain.handle('get-app-version', () => app.getVersion())

  // Controles de ventana (Windows)
  ipcMain.on('window:minimize', () => mainWindow?.minimize())
  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize()
    else mainWindow?.maximize()
  })
  ipcMain.on('window:close', () => mainWindow?.close())

  // Instalar update cuando el usuario lo confirme
  ipcMain.on('install-update', () => {
    autoUpdater.quitAndInstall()
  })

  startSyncWorker()
  try {
    const row = getDb().prepare("SELECT value FROM settings WHERE key='wa_enabled'").get() as { value: string } | undefined
    if (row?.value === 'true') {
      initWhatsAppClient().catch(err => logger.warn('[Main] WhatsApp reconexión fallida:', err))
    }
  } catch (err) {
    logger.warn('[Main] No se pudo reconectar WhatsApp:', err)
  }
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
