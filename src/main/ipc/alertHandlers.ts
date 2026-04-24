import { BrowserWindow, Notification } from 'electron'
import type { IpcMain } from 'electron'
import { getDb } from '../../database/database'
import { logger } from '../logger'

// ── Estado interno del worker ─────────────────────────────────────────────────
let alertTimer:   ReturnType<typeof setInterval> | null = null
let alertEnabled  = true
const alertedIds  = new Set<string>()  // clave: `${apt_id}_${diffMin}`

// ── Query de citas próximas ────────────────────────────────────────────────────
function getUpcomingAppointments() {
  try {
    const db  = getDb()
    const now = new Date()
    // Ventana amplia: de 4 a 16 minutos adelante
    // Cubre los umbrales de 5 y 15 min con margen para el intervalo de 30s
    const from = new Date(now.getTime() +  4 * 60 * 1000).toISOString()
    const to   = new Date(now.getTime() + 16 * 60 * 1000).toISOString()
    return db.prepare(`
      SELECT a.id, a.start_at, a.title,
        c.first_name || ' ' || c.last_name AS client_name
      FROM appointments a
      LEFT JOIN clients c ON c.id = a.client_id
      WHERE a.sync_status != 'cancelled'
        AND a.start_at >= ?
        AND a.start_at <= ?
      ORDER BY a.start_at ASC
    `).all(from, to) as { id: number; start_at: string; title: string; client_name: string | null }[]
  } catch (err) {
    logger.warn('[AlertWorker] Error al consultar citas próximas:', err)
    return []
  }
}

// ── Leer preferencia de la DB ─────────────────────────────────────────────────
function readEnabledFromDb(): boolean {
  try {
    const row = getDb()
      .prepare("SELECT value FROM settings WHERE key = 'alerts_enabled'")
      .get() as { value: string } | undefined
    return row ? row.value !== 'false' : true   // default: activo
  } catch { return true }
}

// ── Enviar evento al renderer para audio + voz ────────────────────────────────
function notifyRenderer(payload: { title: string; body: string; diffMin: number }) {
  BrowserWindow.getAllWindows().forEach(win => {
    if (!win.isDestroyed()) win.webContents.send('agenda:alert', payload)
  })
}

// ── Lógica principal de chequeo ───────────────────────────────────────────────
function checkAlerts() {
  if (!alertEnabled) return

  const now  = new Date()
  const apts = getUpcomingAppointments()

  for (const apt of apts) {
    const start   = new Date(apt.start_at)
    const diffMin = (start.getTime() - now.getTime()) / 60_000  // decimal, sin redondear

    // Umbral de 15 min: entre 14.5 y 15.5 minutos
    // Umbral de 5 min:  entre  4.5 y  5.5 minutos
    // El worker corre cada 30s — un rango de ±0.5 min garantiza que no se escape ningún evento
    const threshold = diffMin >= 14.5 && diffMin < 15.5 ? 15
                    : diffMin >=  4.5 && diffMin <  5.5 ?  5
                    : null
    if (threshold === null) continue

    const key = `${apt.id}_${threshold}`
    if (alertedIds.has(key)) continue
    alertedIds.add(key)

    const body = apt.client_name ? `${apt.title} para ${apt.client_name}` : apt.title

    if (Notification.isSupported()) {
      new Notification({ title: `Cita en ${threshold} min`, body, silent: true }).show()
    }

    notifyRenderer({ title: `Cita en ${threshold} min`, body, diffMin: threshold })
    logger.info(`[AlertWorker] Alerta disparada: ${key} — ${body}`)
  }
}

// ── Limpiar IDs viejos cada hora para que la memoria no crezca ────────────────
function scheduleCleanup() {
  setInterval(() => {
    alertedIds.clear()
    logger.info('[AlertWorker] Cache de alertas limpiado.')
  }, 60 * 60 * 1000)
}

// ── API pública ───────────────────────────────────────────────────────────────

/** Inicia el worker. Llamar una sola vez desde main.ts */
export function startAlertWorker() {
  alertEnabled = readEnabledFromDb()
  logger.info(`[AlertWorker] Iniciado. alertas=${alertEnabled}`)

  if (alertTimer) clearInterval(alertTimer)
  alertTimer = setInterval(checkAlerts, 30_000)
  checkAlerts()   // chequeo inmediato al arrancar
  scheduleCleanup()
}

/** Registra el handler IPC que el renderer usa para activar/desactivar */
export function registerAlertHandlers(ipcMain: IpcMain) {
  ipcMain.handle('alerts:setEnabled', (_e, enabled: boolean) => {
    try {
      alertEnabled = enabled
      const db = getDb()
      db.prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('alerts_enabled', ?, datetime('now'))")
        .run(enabled ? 'true' : 'false')
      //logger.info(`[AlertWorker] alerts_enabled → ${enabled}`)
      return { ok: true }
    } catch (err) {
      //logger.error('[AlertWorker] Error al guardar alerts_enabled:', err)
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle('alerts:getEnabled', () => {
    try {
      return { ok: true, data: readEnabledFromDb() }
    } catch (err) {
      return { ok: false, data: true }
    }
  })
}
