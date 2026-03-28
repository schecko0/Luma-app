import type { IpcMain } from 'electron'
import { app } from 'electron'
import fs from 'fs'
import { logger } from '../logger'
import { getDb } from '../../database/database'

export function registerAppHandlers(ipcMain: IpcMain) {

  // Ping de salud — el renderer lo usa al arrancar para verificar IPC
  ipcMain.handle('app:ping', () => {
    return { ok: true, version: app.getVersion(), platform: process.platform }
  })

  // Obtener ruta del archivo de logs
  ipcMain.handle('app:getLogPath', () => {
    return logger.getLogPath()
  })

  // Leer últimas N líneas del log
  ipcMain.handle('app:readLogs', (_event, lines: number = 200) => {
    const logPath = logger.getLogPath()
    if (!fs.existsSync(logPath)) return ''
    const content = fs.readFileSync(logPath, 'utf-8')
    const all = content.split('\n').filter(Boolean)
    return all.slice(-lines).join('\n')
  })

  // Handler global de errores del renderer
  ipcMain.handle('app:logError', (_event, message: string, stack?: string) => {
    logger.error(`[Renderer] ${message}`, stack ? { stack } : undefined)
    return { ok: true }
  })

  // Verificar si la base de datos está lista
  ipcMain.handle('app:dbReady', () => {
    try {
      const db = getDb()
      const result = db.prepare('SELECT 1 as ok').get() as { ok: number }
      return { ready: result.ok === 1 }
    } catch (err) {
      logger.error('DB health check failed', err)
      return { ready: false }
    }
  })
}
