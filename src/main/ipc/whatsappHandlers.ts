import type { IpcMain } from 'electron'
import { getDb } from '../../database/database'
import { nowISO } from '../../database/dbUtils'
import {
  initWhatsAppClient,
  disconnectWhatsApp,
  getWhatsAppStatus,
  queueReminderForAppointment,
  previewReminders,
  startWhatsAppScheduler,
  sendConfirmationMessage
} from '../whatsappService'
import { logger } from '../logger'

export function registerWhatsAppHandlers(ipcMain: IpcMain) {

  // ── Estado actual ─────────────────────────────────────────────────────
  ipcMain.handle('whatsapp:getStatus', () => {
    try {
      return { ok: true, data: getWhatsAppStatus() }
    } catch (err: any) { return { ok: false, error: String(err) } }
  })

  // ── Iniciar conexión (muestra QR vía push event) ──────────────────────
  ipcMain.handle('whatsapp:connect', () => {
    // NO hacer await — iniciar en background y responder inmediato
    // La UI se entera del progreso vía push events (whatsapp:status, whatsapp:qr)
    logger.info('[IPC] whatsapp:connect — iniciando en background')
    initWhatsAppClient().catch(err => {
      logger.error('[IPC] whatsapp:connect error en background:', err.message ?? String(err))
    })
    return { ok: true }
  })

  // ── Desconectar y borrar sesión ───────────────────────────────────────
  ipcMain.handle('whatsapp:disconnect', async () => {
    try {
      await disconnectWhatsApp()
      return { ok: true }
    } catch (err: any) { return { ok: false, error: String(err) } }
  })

  // ── Previsualización de envío manual (sin enviar nada) ────────────────
  ipcMain.handle('whatsapp:preview', (_e, appointmentIds: number[], reminderType: '1d' | '3d' | '7d' | 'manual') => {
    try {
      const data = previewReminders(appointmentIds, reminderType)
      return { ok: true, data }
    } catch (err: any) {
      logger.error('[IPC] whatsapp:preview error', err)
      return { ok: false, error: String(err) }
    }
  })

  // ── Envío manual confirmado (después del preview) ─────────────────────
  ipcMain.handle('whatsapp:sendBulk', (_e,
    appointmentIds: number[],
    reminderType: '1d' | '3d' | '7d' | 'manual',
    forcedIds: number[] = []   // ← IDs que el admin marcó para reenviar aunque ya se envió hoy
  ) => {
    try {
      const forcedSet = new Set(forcedIds)
      const results = appointmentIds.map(id => {
        const row    = getDb().prepare('SELECT client_id FROM appointments WHERE id=?').get(id) as { client_id: number | null } | undefined
        const force  = forcedSet.has(id)
        const result = queueReminderForAppointment(id, reminderType, row?.client_id ?? null, force)
        return { appointmentId: id, result }
      })
      const queued = results.filter(r => r.result === 'queued').length
      return { ok: true, data: { queued, results } }
    } catch (err: any) {
      logger.error('[IPC] whatsapp:sendBulk error', err)
      return { ok: false, error: String(err) }
    }
  })

  // ── Envío individual desde la vista de agenda ─────────────────────────
  ipcMain.handle('whatsapp:sendOne', (_e, appointmentId: number, reminderType: '1d' | '3d' | '7d' | 'manual') => {
    try {
      const row    = getDb().prepare('SELECT client_id FROM appointments WHERE id=?').get(appointmentId) as { client_id: number | null } | undefined
      const result = queueReminderForAppointment(appointmentId, reminderType, row?.client_id ?? null)
      return { ok: true, data: { result } }
    } catch (err: any) {
      logger.error('[IPC] whatsapp:sendOne error', err)
      return { ok: false, error: String(err) }
    }
  })

  // ── Historial de mensajes enviados (paginado) ─────────────────────────
  ipcMain.handle('whatsapp:getLog', (_e, page = 1, pageSize = 30) => {
    try {
      const db     = getDb()
      const offset = (page - 1) * pageSize
      const total  = (db.prepare('SELECT COUNT(*) AS n FROM whatsapp_reminder_log').get() as { n: number }).n
      const rows   = db.prepare(`
        SELECT
          l.*,
          c.first_name || ' ' || c.last_name AS client_name,
          a.title AS appointment_title,
          a.start_at
        FROM whatsapp_reminder_log l
        LEFT JOIN clients      c ON c.id = l.client_id
        LEFT JOIN appointments a ON a.id = l.appointment_id
        ORDER BY l.created_at DESC
        LIMIT ? OFFSET ?
      `).all(pageSize, offset)
      return { ok: true, data: { rows, total, page, pageSize } }
    } catch (err: any) { return { ok: false, error: String(err) } }
  })

  // ── Stats del día ─────────────────────────────────────────────────────
  ipcMain.handle('whatsapp:getStats', () => {
    try {
      const db = getDb()
      const sentToday  = (db.prepare("SELECT COUNT(*) AS n FROM whatsapp_reminder_log WHERE status='sent' AND DATE(sent_at)=DATE('now')").get() as { n: number }).n
      const sentTotal  = (db.prepare("SELECT COUNT(*) AS n FROM whatsapp_reminder_log WHERE status='sent'").get() as { n: number }).n
      const failedTotal = (db.prepare("SELECT COUNT(*) AS n FROM whatsapp_reminder_log WHERE status='failed'").get() as { n: number }).n
      const rate = sentTotal + failedTotal > 0 ? Math.round((sentTotal / (sentTotal + failedTotal)) * 100) : 100
      return { ok: true, data: { sentToday, sentTotal, failedTotal, deliveryRate: rate } }
    } catch (err: any) { return { ok: false, error: String(err) } }
  })

  // ── Reiniciar cron (si el admin cambia la hora de envío en settings) ──
  ipcMain.handle('whatsapp:restartScheduler', () => {
    try {
      startWhatsAppScheduler()
      return { ok: true }
    } catch (err: any) { return { ok: false, error: String(err) } }
  })

  // ── Confirmación automática al crear cita ─────────────────────────────────
  ipcMain.handle('whatsapp:sendConfirmation', async (_e, appointmentId: number) => {
    try {
      
      const result = await sendConfirmationMessage(appointmentId)
      return { ok: true, data: { result } }
    } catch (err: any) {
      logger.error('[IPC] whatsapp:sendConfirmation error', err)
      return { ok: false, error: String(err) }
    }
  })
}