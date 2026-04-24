import type { IpcMain } from 'electron'
import { app, dialog } from 'electron'
import fs from 'fs'
import path from 'path'
import Database from 'better-sqlite3'
import { logger } from '../logger'
import { getDb, closeDatabase, initDatabase } from '../../database/database'
import { nowISO } from '../../database/dbUtils'

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

  // Vaciar archivo de logs
  ipcMain.handle('app:clearLogs', () => {
    const ok = logger.clearLogs()
    if (ok) {
      try {
        getDb().prepare(`
          INSERT INTO error_log (level, message, context, occurred_at) 
          VALUES ('info', 'Archivo luma.log vaciado por el administrador', 'AUDIT', ?)
        `).run(nowISO())
      } catch (_) {}
    }
    return ok
  })

  // Descargar archivo de log (copia a ruta elegida por el usuario)
  ipcMain.handle('app:downloadLogs', async () => {
    try {
      const logPath = logger.getLogPath()
      if (!fs.existsSync(logPath)) return { ok: false, error: 'El archivo de log no existe aún.' }

      const date = new Date().toISOString().split('T')[0]
      const { filePath, canceled } = await dialog.showSaveDialog({
        title: 'Guardar archivo de log',
        defaultPath: `luma_log_${date}.txt`,
        filters: [{ name: 'Archivo de texto', extensions: ['txt', 'log'] }],
      })

      if (canceled || !filePath) return { ok: false, error: 'Cancelado' }

      fs.copyFileSync(logPath, filePath)
      //logger.info(`[App] Log descargado por el administrador en: ${filePath}`)
      return { ok: true, data: filePath }
    } catch (err) {
      logger.error('Error al descargar log', err)
      return { ok: false, error: String(err) }
    }
  })

  // Obtener errores guardados en la base de datos
  ipcMain.handle('app:getErrorLogs', (_event, page: number = 1, pageSize: number = 20) => {
    try {
      const db = getDb()
      const offset = (page - 1) * pageSize
      
      const items = db.prepare(`
        SELECT * FROM error_log 
        ORDER BY occurred_at DESC 
        LIMIT ? OFFSET ?
      `).all(pageSize, offset)

      const total = (db.prepare('SELECT COUNT(*) as count FROM error_log').get() as any).count

      return { ok: true, data: { items, total, page, pageSize } }
    } catch (err) {
      logger.error('Error al obtener logs de la BD', err)
      return { ok: false, error: 'No se pudieron obtener los logs de la base de datos.' }
    }
  })

  // Exportar base de datos
  ipcMain.handle('app:exportDb', async () => {
    try {
      const { filePath, canceled } = await dialog.showSaveDialog({
        title: 'Exportar Base de Datos',
        defaultPath: `luma_backup_${new Date().toISOString().split('T')[0]}.db`,
        filters: [{ name: 'SQLite Database', extensions: ['db'] }]
      })

      if (canceled || !filePath) return { ok: false, error: 'Cancelado por el usuario' }

      const dbPath = path.join(app.getPath('userData'), 'luma.db')
      
      // 1. FORZAR CHECKPOINT (Pasar datos de luma.db-wal a luma.db)
      try {
        const db = getDb()
        db.pragma('wal_checkpoint(FULL)')
      } catch (checkpointErr) {
        logger.error('Error al hacer checkpoint antes de exportar', checkpointErr)
      }

      // 2. LOG ANTES DE COPIAR (para que el respaldo tenga el evento)
      const now = nowISO()
      try {
        getDb().prepare(`
          INSERT INTO error_log (level, message, context, occurred_at) 
          VALUES ('info', ?, 'AUDIT', ?)
        `).run(`Base de datos exportada a: ${filePath}`, now)
        
        // Otro checkpoint rápido para incluir este último log
        getDb().pragma('wal_checkpoint(FULL)')
      } catch (_) {}

      fs.copyFileSync(dbPath, filePath)
      
      logger.audit(`Base de datos exportada a: ${filePath}`)
      return { ok: true, data: filePath }
    } catch (err) {
      logger.error('Error exportando BD', err)
      return { ok: false, error: 'Error al exportar la base de datos.' }
    }
  })

  // Importar base de datos
  ipcMain.handle('app:importDb', async () => {
    const dbPath = path.join(app.getPath('userData'), 'luma.db')
    const bakPath = dbPath + '.bak'

    try {
      const { filePaths, canceled } = await dialog.showOpenDialog({
        title: 'Importar Base de Datos',
        filters: [{ name: 'SQLite Database', extensions: ['db'] }],
        properties: ['openFile']
      })

      if (canceled || filePaths.length === 0) return { ok: false, error: 'Cancelado' }
      const newPath = filePaths[0]

      // 0. VALIDACIÓN ESTRUCTURAL (Check de Luma App)
      try {
        const tempDb = new Database(newPath, { readonly: true })
        // Verificar si existe la tabla schema_version y tiene un valor válido
        const check = tempDb.prepare("SELECT version FROM schema_version ORDER BY version DESC LIMIT 1").get() as { version: number } | undefined
        tempDb.close()
        
        if (!check || typeof check.version !== 'number') {
          return { ok: false, error: 'El archivo no contiene una base de datos válida de Luma App (Firma faltante).' }
        }
      } catch (err) {
        return { ok: false, error: 'El archivo no es una base de datos SQLite válida o está protegido.' }
      }

      // 1. Log en la DB actual (Auditoría de "Inicio de Importación")
      const now = nowISO()
      try {
        getDb().prepare(`
          INSERT INTO error_log (level, message, context, occurred_at) 
          VALUES ('info', ?, 'AUDIT', ?)
        `).run(`Inicio de importación desde: ${newPath}`, now)
      } catch (_) {}

      // 2. Cerrar conexión actual
      closeDatabase()

      // 3. Hacer respaldo de la actual
      if (fs.existsSync(dbPath)) {
        fs.copyFileSync(dbPath, bakPath)
      }

      // 4. Sobrescribir con la nueva
      fs.copyFileSync(newPath, dbPath)

      // 5. Intentar inicializar de nuevo
      try {
        await initDatabase()
        if (fs.existsSync(bakPath)) fs.unlinkSync(bakPath) // Limpiar respaldo si todo ok
        
        // Log en la NUEVA DB importada
        getDb().prepare(`
          INSERT INTO error_log (level, message, context, occurred_at) 
          VALUES ('info', ?, 'AUDIT', ?)
        `).run(`Importación exitosa desde: ${newPath}`, nowISO())

        logger.audit(`Base de datos importada exitosamente desde: ${newPath}`)
        return { ok: true }
      } catch (initErr) {
        // 5. Fallback: restaurar respaldo si falla el init
        logger.error('Error inicializando la base de datos importada, restaurando respaldo...', initErr)
        if (fs.existsSync(bakPath)) {
          fs.copyFileSync(bakPath, dbPath)
          await initDatabase()
        }
        return { ok: false, error: 'El archivo no es una base de datos válida de Luma App.' }
      }
    } catch (err) {
      logger.error('Error general importando BD', err)
      return { ok: false, error: 'Error crítico durante la importación.' }
    }
  })

  // Handler global de errores del renderer
  ipcMain.handle('app:logError', (_event, message: string, stack?: string) => {
    logger.error(`[Renderer] ${message}`, stack ? { stack } : undefined)
    
    try {
      const db = getDb()
      db.prepare(`
        INSERT INTO error_log (level, message, stack, context, occurred_at)
        VALUES (?, ?, ?, ?, ?)
      `).run('error', `[Renderer] ${message}`, stack || null, 'IPC', nowISO())
    } catch (err) {
      // Si falla la BD, al menos ya se logueó en el archivo
      console.error('Fallo al guardar error en DB:', err)
    }

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

  ipcMain.handle('app:selectImageFile', async () => {
    try {
      const { dialog, app } = await import('electron')
      const path = await import('path')
      const fs   = await import('fs')

      const result = await dialog.showOpenDialog({
        title: 'Seleccionar imagen',
        filters: [{ name: 'Imágenes', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
        properties: ['openFile'],
      })
      if (result.canceled || result.filePaths.length === 0) return { ok: false }

      const sourcePath = result.filePaths[0]
      const ext        = path.extname(sourcePath)
      const fileName   = `img_${Date.now()}${ext}`
      const targetDir  = path.join(app.getPath('userData'), 'uploads')
      
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true })
      
      const targetPath = path.join(targetDir, fileName)
      fs.copyFileSync(sourcePath, targetPath)

      return { ok: true, path: targetPath }
    } catch (err: any) {
      return { ok: false, error: String(err) }
    }
  })
  ipcMain.handle('app:readImageAsBase64', async (_e, filePath: string) => {
    try {
      const fs   = await import('fs')
      const path = await import('path')
      const ext  = path.extname(filePath).toLowerCase().replace('.', '')
      const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
                : ext === 'png'  ? 'image/png'
                : ext === 'webp' ? 'image/webp'
                : 'image/jpeg'
      const buffer = fs.readFileSync(filePath)
      const base64 = buffer.toString('base64')
      return { ok: true, data: `data:${mime};base64,${base64}` }
    } catch (err: any) {
      return { ok: false, error: String(err) }
    }
  })
}
