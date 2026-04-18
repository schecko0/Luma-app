/**
 * whatsappService.ts
 * Servicio central de WhatsApp para Luma App.
 * Maneja: sesión, cola anti-spam, envío de mensajes, scheduler de recordatorios.
 */
import path from 'path'
import { app, BrowserWindow } from 'electron'
import { Client, LocalAuth,MessageMedia  } from 'whatsapp-web.js'
import cron, { type ScheduledTask } from 'node-cron'
import { getDb } from '../database/database'
import { nowISO } from '../database/dbUtils'
import { logger } from './logger'

// ─────────────────────────────────────────────────────────────────────────────
// Estado del cliente WhatsApp
// ─────────────────────────────────────────────────────────────────────────────
let waClient: Client | null = null
let waStatus: 'disconnected' | 'connecting' | 'qr' | 'ready' | 'error' = 'disconnected'
let waPhone: string | null = null
let cronJob: ScheduledTask | null = null

// Cola anti-spam: mensajes pendientes de enviar con delay
const sendQueue: Array<{ phone: string; message: string; logId: number }> = []
let isSendingQueue = false

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de settings
// ─────────────────────────────────────────────────────────────────────────────
function getSetting(key: string, fallback = ''): string {
  try {
    const row = getDb()
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get(key) as { value: string } | undefined
    return row?.value ?? fallback
  } catch {
    return fallback
  }
}

function getSalonName(): string {
  return getSetting('salon_name', 'el salón')
}

// ─────────────────────────────────────────────────────────────────────────────
// Notificar a la UI (renderer) sobre cambios de estado
// ─────────────────────────────────────────────────────────────────────────────
function notifyRenderer(event: string, data?: unknown) {
  const windows = BrowserWindow.getAllWindows()
  logger.info(`[WA] notifyRenderer '${event}' → ${windows.length} ventana(s)`)
  windows.forEach(win => {
    if (!win.isDestroyed()) win.webContents.send(event, data)
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatear número de teléfono para WhatsApp
// Formato requerido: 521XXXXXXXXXX@c.us  (México)
// ─────────────────────────────────────────────────────────────────────────────
function formatPhoneForWA(phone: string, countryCode = '+52'): string | null {
  const digits = phone.replace(/\D/g, '')
  if (!digits || digits.length < 8) return null

  const cc = countryCode.replace('+', '')

  // México (52): los celulares requieren 521XXXXXXXXXX (13 dígitos con el 1)
  const isMexico = cc === '52'

  // Ya tiene formato completo con el 1 de celular MX: 521XXXXXXXXXX (13 dígitos)
  if (isMexico && digits.length === 13 && digits.startsWith('521')) {
    return `${digits}@c.us`
  }
  // Tiene código de país MX pero sin el 1: 52XXXXXXXXXX (12 dígitos) → agregar 1
  if (isMexico && digits.length === 12 && digits.startsWith('52')) {
    return `521${digits.slice(2)}@c.us`
  }
  // Número local MX de 10 dígitos → agregar 521
  if (isMexico && digits.length === 10) {
    return `521${digits}@c.us`
  }
  // Otros países: código de país + número tal cual
  if (!isMexico) {
    // Si ya incluye el código de país, usarlo directo
    if (digits.startsWith(cc) && digits.length > cc.length + 6) {
      return `${digits}@c.us`
    }
    return `${cc}${digits}@c.us`
  }

  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Renderizar plantilla con datos reales de la cita
// ─────────────────────────────────────────────────────────────────────────────
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Obtener variables de una cita desde la BD
// ─────────────────────────────────────────────────────────────────────────────
function getAppointmentVars(appointmentId: number): Record<string, string> | null {
  const row = getDb().prepare(`
    SELECT
      a.start_at,
      c.first_name || ' ' || c.last_name  AS client_name,
      c.phone                              AS client_phone,
      c.phone_country                      AS client_country,
      e.first_name || ' ' || e.last_name  AS employee_name,
      s.name                               AS service_name
    FROM appointments a
    LEFT JOIN clients   c ON c.id = a.client_id
    LEFT JOIN employees e ON e.id = a.employee_id
    LEFT JOIN services  s ON s.id = a.service_id
    WHERE a.id = ? AND a.sync_status != 'cancelled'
  `).get(appointmentId) as {
    start_at: string
    client_name: string
    client_phone: string
    client_country: string
    employee_name: string
    service_name: string
  } | undefined

  if (!row || !row.client_phone) return null

  const dt = new Date(row.start_at)
  const fecha = dt.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
  const hora  = dt.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })

  return {
    nombre:   row.client_name   ?? 'Cliente',
    empleado: row.employee_name ?? 'nuestro equipo',
    servicio: row.service_name  ?? 'el servicio',
    fecha,
    hora,
    salon:    getSalonName(),
    _phone:       row.client_phone,
    _countryCode: row.client_country ?? '+52',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Verificar si ya se envió este tipo de recordatorio para esta cita hoy
// ─────────────────────────────────────────────────────────────────────────────
function alreadySentToday(appointmentId: number, reminderType: string): boolean {
  const row = getDb().prepare(`
    SELECT id FROM whatsapp_reminder_log
    WHERE appointment_id = ?
      AND reminder_type  = ?
      AND status         = 'sent'
      AND DATE(sent_at)  = DATE('now')
    LIMIT 1
  `).get(appointmentId, reminderType)
  return !!row
}

// ─────────────────────────────────────────────────────────────────────────────
// Conteo de mensajes enviados hoy
// ─────────────────────────────────────────────────────────────────────────────
function sentTodayCount(): number {
  const row = getDb().prepare(`
    SELECT COUNT(*) AS n FROM whatsapp_reminder_log
    WHERE status = 'sent' AND DATE(sent_at) = DATE('now')
  `).get() as { n: number }
  return row.n
}

// ─────────────────────────────────────────────────────────────────────────────
// Insertar entrada en el log y retornar su id
// ─────────────────────────────────────────────────────────────────────────────
function insertLog(params: {
  appointmentId: number
  clientId: number | null
  phone: string
  reminderType: string
  messagePreview: string
  status: 'pending' | 'skipped'
  errorMessage?: string
}): number {
  const result = getDb().prepare(`
    INSERT INTO whatsapp_reminder_log
      (appointment_id, client_id, phone, reminder_type, message_preview, status, error_message, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    params.appointmentId,
    params.clientId ?? null,
    params.phone,
    params.reminderType,
    params.messagePreview,
    params.status,
    params.errorMessage ?? null,
    nowISO()
  )
  return result.lastInsertRowid as number
}

function markLogSent(logId: number) {
  getDb().prepare(`
    UPDATE whatsapp_reminder_log SET status='sent', sent_at=? WHERE id=?
  `).run(nowISO(), logId)
}

function markLogFailed(logId: number, error: string) {
  getDb().prepare(`
    UPDATE whatsapp_reminder_log SET status='failed', error_message=? WHERE id=?
  `).run(error, logId)
}

// ─────────────────────────────────────────────────────────────────────────────
// Cola anti-spam: enviar mensajes con delay aleatorio entre ellos
// ─────────────────────────────────────────────────────────────────────────────
async function processQueue() {
  if (isSendingQueue || sendQueue.length === 0) return
  if (!waClient || waStatus !== 'ready') return

  isSendingQueue = true

  while (sendQueue.length > 0) {
    const item = sendQueue.shift()!
    try {
      await waClient.sendMessage(item.phone, item.message)
      markLogSent(item.logId)
      notifyRenderer('whatsapp:messageSent', { logId: item.logId })
      logger.info(`[WA] Mensaje enviado a ${item.phone}`)
    } catch (err: any) {
      // Extraer mensaje real — whatsapp-web.js a veces lanza objetos sin .message
      const errMsg = err?.message
        ?? err?.data
        ?? (typeof err === 'string' ? err : JSON.stringify(err))
        ?? 'Error desconocido'
      markLogFailed(item.logId, errMsg)
      logger.error(`[WA] Error enviando a ${item.phone}: ${errMsg}`)
    }

    if (sendQueue.length > 0) {
      // Delay aleatorio entre delaySec y delaySec*2 para imitar comportamiento humano
      const delaySec = parseInt(getSetting('wa_delay_seconds', '12'))
      const jitter   = Math.floor(Math.random() * delaySec * 1000)
      await new Promise(r => setTimeout(r, delaySec * 1000 + jitter))
    }
  }

  isSendingQueue = false
  notifyRenderer('whatsapp:queueDone')
}

// ─────────────────────────────────────────────────────────────────────────────
// Encolar un mensaje para envío (valida límite diario)
// ─────────────────────────────────────────────────────────────────────────────
function enqueueMessage(phone: string, message: string, logId: number): boolean {
  // Validar que el cliente WA esté activo antes de encolar
  if (waStatus !== 'ready' || !waClient) {
    markLogFailed(logId, 'WhatsApp no está conectado. Vincula la sesión en Ajustes → WhatsApp.')
    return false
  }
  const maxPerDay = parseInt(getSetting('wa_max_per_day', '60'))

  if (sentTodayCount() >= maxPerDay) {
    markLogFailed(logId, `Límite diario de ${maxPerDay} mensajes alcanzado`)
    return false
  }
  sendQueue.push({ phone, message, logId })
  processQueue().catch(err => logger.error('[WA] Error en processQueue', err))
  return true
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE: construir y encolar recordatorio para una cita
// Retorna: 'queued' | 'skipped_already_sent' | 'skipped_no_template' |
//          'skipped_no_phone' | 'skipped_no_client' | 'skipped_daily_limit'
// ─────────────────────────────────────────────────────────────────────────────
export function queueReminderForAppointment(
  appointmentId: number,
  reminderType: '1d' | '3d' | '7d' | 'manual',
  clientId: number | null,
  force = false   // ← nuevo parámetro: si true, ignora el bloqueo de "ya enviado hoy"
): 'queued' | 'skipped_already_sent' | 'skipped_no_template' | 'skipped_no_phone' | 'skipped_no_client' | 'skipped_daily_limit' {

  // 1. Verificar si ya se envió hoy (solo para automáticos O si no se forzó)
  if (!force && reminderType !== 'manual' && alreadySentToday(appointmentId, reminderType)) {
    return 'skipped_already_sent'
  }

  // 2. Obtener template
  const templateKey = reminderType === 'manual' ? 'wa_template_1d' : `wa_template_${reminderType}`
  const template = getSetting(templateKey, '')
  if (!template.trim()) return 'skipped_no_template'

  // 3. Obtener datos de la cita
  const vars = getAppointmentVars(appointmentId)
  if (!vars) return 'skipped_no_client'
  if (!vars._phone) return 'skipped_no_phone'

  // 4. Formatear teléfono
  const waPhone = formatPhoneForWA(vars._phone, vars._countryCode)
  if (!waPhone) return 'skipped_no_phone'

  // 5. Renderizar mensaje
  const message = renderTemplate(template, vars)

  // 6. Insertar en log como pending
  const logId = insertLog({
    appointmentId,
    clientId,
    phone: waPhone,
    reminderType,
    messagePreview: message,
    status: 'pending',
  })

  // 7. Encolar con control de límite diario
  const queued = enqueueMessage(waPhone, message, logId)
  return queued ? 'queued' : 'skipped_daily_limit'
}

// ─────────────────────────────────────────────────────────────────────────────
// PREVISUALIZACIÓN: genera el desglose para el modal sin enviar nada
// ─────────────────────────────────────────────────────────────────────────────
export function previewReminders(appointmentIds: number[], reminderType: '1d' | '3d' | '7d' | 'manual') {
  const templateKey = reminderType === 'manual' ? 'wa_template_1d' : `wa_template_${reminderType}`
  const template    = getSetting(templateKey, '')
  const salon       = getSalonName()
  const maxPerDay   = parseInt(getSetting('wa_max_per_day', '60'))
  const sentToday   = sentTodayCount()
  const db          = getDb()

  const items = appointmentIds.map(id => {
    const row = db.prepare(`
      SELECT
        a.id, a.client_id, a.start_at,
        c.first_name || ' ' || c.last_name AS client_name,
        c.phone AS client_phone, c.phone_country AS client_country,
        e.first_name || ' ' || e.last_name AS employee_name,
        s.name AS service_name
      FROM appointments a
      LEFT JOIN clients   c ON c.id = a.client_id
      LEFT JOIN employees e ON e.id = a.employee_id
      LEFT JOIN services  s ON s.id = a.service_id
      WHERE a.id = ? AND a.sync_status != 'cancelled'
    `).get(id) as any

    if (!row) return {
      appointmentId: id, status: 'skipped_no_client',
      message: null, clientName: null, phone: null,
      meta: null, sentToday: false, lastSentAt: null,
    }

    // Verificar si ya se envió mensaje hoy a esta cita (cualquier tipo)
    const lastSentRow = db.prepare(`
      SELECT sent_at, reminder_type, created_at FROM whatsapp_reminder_log
      WHERE appointment_id = ?
        AND status IN ('sent', 'pending')
        AND DATE(COALESCE(sent_at, created_at)) = DATE('now')
      ORDER BY COALESCE(sent_at, created_at) DESC LIMIT 1
    `).get(id) as { sent_at: string | null; reminder_type: string; created_at: string } | undefined

    const alreadySent = !!lastSentRow

    // Determinar status base
    let status: string = 'ready'
    if (!template.trim())       status = 'skipped_no_template'
    else if (!row.client_phone) status = 'skipped_no_phone'
    else if (alreadySent)       status = 'sent_today'  // ← nuevo estado informativo

    // Renderizar mensaje si hay template y teléfono (incluso si ya se envió)
    let message: string | null = null
    if (template.trim() && row.client_phone) {
      const dt    = new Date(row.start_at)
      const fecha = dt.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
      const hora  = dt.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
      message = renderTemplate(template, {
        nombre:   row.client_name    ?? 'Cliente',
        empleado: row.employee_name  ?? 'nuestro equipo',
        servicio: row.service_name   ?? 'servicio',
        fecha, hora, salon,
      })
    }

    return {
      appointmentId: id,
      clientId:      row.client_id   ?? null,
      clientName:    row.client_name ?? null,
      phone:         row.client_phone ?? null,
      status,
      message,
      sentToday:     alreadySent,
      lastSentAt:    lastSentRow?.sent_at ?? lastSentRow?.created_at ?? null,
      meta: {
        startAt:      row.start_at,
        employeeName: row.employee_name,
        serviceName:  row.service_name,
      },
    }
  })

  const readyCount = items.filter(i => i.status === 'ready').length

  return {
    items,
    summary: {
      total:               appointmentIds.length,
      ready:               readyCount,
      sent_today:          items.filter(i => i.status === 'sent_today').length,
      skipped_no_phone:    items.filter(i => i.status === 'skipped_no_phone').length,
      skipped_no_template: items.filter(i => i.status === 'skipped_no_template').length,
      skipped_no_client:   items.filter(i => i.status === 'skipped_no_client').length,
    },
    template,
    sentToday,
    maxPerDay,
    willExceedLimit: sentToday + readyCount > maxPerDay,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULER: cron job diario que dispara recordatorios automáticos
// ─────────────────────────────────────────────────────────────────────────────
function runScheduledReminders() {
  const enabled = getSetting('wa_enabled', 'false') === 'true'
  if (!enabled || waStatus !== 'ready') return

  logger.info('[WA Scheduler] Ejecutando recordatorios automáticos...')
  const db = getDb()

  const types: Array<{ key: '1d' | '3d' | '7d'; settingKey: string; daysAhead: number }> = [
    { key: '1d', settingKey: 'wa_reminder_1d', daysAhead: 1 },
    { key: '3d', settingKey: 'wa_reminder_3d', daysAhead: 3 },
    { key: '7d', settingKey: 'wa_reminder_7d', daysAhead: 7 },
  ]

  for (const type of types) {
    if (getSetting(type.settingKey, 'false') !== 'true') continue

    // Obtener citas que caen exactamente en N días desde hoy
    const appointments = db.prepare(`
      SELECT a.id, a.client_id FROM appointments a
      WHERE a.sync_status != 'cancelled'
        AND a.client_id IS NOT NULL
        AND DATE(a.start_at) = DATE('now', '+${type.daysAhead} days')
    `).all() as { id: number; client_id: number }[]

    let queued = 0
    for (const apt of appointments) {
      const result = queueReminderForAppointment(apt.id, type.key, apt.client_id)
      if (result === 'queued') queued++
    }

    logger.info(`[WA Scheduler] Tipo ${type.key}: ${appointments.length} citas, ${queued} en cola`)
  }
}

export function startWhatsAppScheduler() {
  const sendHour = getSetting('wa_send_hour', '9')
  // Cron: cada día a la hora configurada (ej: "0 9 * * *" = 9:00 am)
  const cronExpr = `0 ${sendHour} * * *`

  if (cronJob) {
    logger.info('[WA Scheduler] Deteniendo tarea programada anterior...')
    cronJob.stop()
    cronJob = null
  }

  cronJob = cron.schedule(cronExpr, () => {
    runScheduledReminders()
  }, { timezone: 'America/Mexico_City' })

  logger.info(`[WA Scheduler] Nueva tarea programada configurada: "${cronExpr}" (Hora: ${sendHour}:00)`)
}

/**
 * Limpia el estado de WhatsApp tanto en memoria como en la base de datos.
 * Se usa cuando el usuario se desconecta manualmente o cuando la sesión expira.
 */
async function performFullWACleanup(reason?: string) {
  if (waClient) {
    try {
      // Intentamos cerrar formalmente, pero no bloqueamos si falla
      await waClient.logout().catch(() => {})
      await waClient.destroy().catch(() => {})
    } catch (e) {
      logger.error('[WA] Error al destruir cliente durante limpieza', e)
    }
    waClient = null
  }
  
  if (cronJob) { 
    cronJob.stop()
    cronJob = null 
  }

  waStatus = 'disconnected'
  waPhone  = null

  // Limpiar base de datos para que la UI refleje el estado real
  const db = getDb(); const now = nowISO()
  db.prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('wa_enabled', 'false', ?)")
    .run(now)
  db.prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('wa_phone', '', ?)")
    .run(now)

  logger.info(`[WA] Sesión cerrada y base de datos limpia. Razón: ${reason ?? 'No especificada'}`)
  notifyRenderer('whatsapp:status', { status: 'disconnected', reason })
}

// ─────────────────────────────────────────────────────────────────────────────
// CONEXIÓN: iniciar cliente WhatsApp y manejar eventos
// ─────────────────────────────────────────────────────────────────────────────
export function initWhatsAppClient(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (waClient) {
      waClient.destroy().catch(() => {})
      waClient = null
    }

    waStatus = 'connecting'
    notifyRenderer('whatsapp:status', { status: 'connecting' })

    const sessionPath = path.join(app.getPath('userData'), '.wwebjs_auth')

    waClient = new Client({
      authStrategy: new LocalAuth({ dataPath: sessionPath }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--disable-gpu',
        ],
      },
    })

    waClient.on('qr', (qr) => {
      waStatus = 'qr'
      notifyRenderer('whatsapp:qr', { qr })
      notifyRenderer('whatsapp:status', { status: 'qr' })
      logger.info('[WA] QR generado — esperando escaneo')
    })

    waClient.on('ready', async () => {
      logger.info('[WA] Evento ready disparado, actualizando estado...')
      waStatus = 'ready'
      try {
        const info  = waClient!.info
        waPhone     = info?.wid?.user ?? null
        const phone = waPhone ? `+${waPhone}` : null
        logger.info(`[WA] Info obtenida. Phone: ${phone}`)
        // Guardar en settings para mostrarlo en UI
        const db = getDb(); const now = nowISO()
        db.prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('wa_phone', ?, ?)")
          .run(phone ?? '', now)
        db.prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('wa_enabled', 'true', ?)")
          .run(now)
        logger.info('[WA] Settings guardados, notificando renderer...')
        notifyRenderer('whatsapp:status', { status: 'ready', phone })
        logger.info('[WA] Renderer notificado. Iniciando scheduler...')
        startWhatsAppScheduler()
        logger.info(`[WA] Listo. Número: ${phone}`)
      } catch (err) {
        logger.error('[WA] Error al obtener info del cliente', err)
      }
      resolve()
    })

    waClient.on('authenticated', () => {
      logger.info('[WA] Autenticado correctamente')
    })

    waClient.on('auth_failure', (msg) => {
      logger.error('[WA] Fallo de autenticación:', msg)
      performFullWACleanup(`Error de autenticación: ${msg}`)
      reject(new Error(msg))
    })

    waClient.on('disconnected', (reason) => {
      logger.warn('[WA] Desconectado por el servidor/usuario:', reason)
      performFullWACleanup(`Sesión cerrada: ${reason}`)
    })

    waClient.initialize().catch(err => {
      waStatus = 'error'
      notifyRenderer('whatsapp:status', { status: 'error', error: err.message })
      logger.error('[WA] Error al inicializar cliente:', err)
      reject(err)
    })
  })
}

export function getWhatsAppStatus() {
  const phone = getSetting('wa_phone', '')
  return { status: waStatus, phone: phone || null }
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIRMACIÓN DE CITA: texto + imagen del logo al crear una nueva cita
// ─────────────────────────────────────────────────────────────────────────────
export async function sendConfirmationMessage(
  appointmentId: number
): Promise<'sent' | 'skipped_not_enabled' | 'skipped_not_connected' | 'skipped_no_phone' | 'skipped_no_template' | 'error'> {

  if (getSetting('wa_confirm_on_create', 'false') !== 'true') return 'skipped_not_enabled'
  if (waStatus !== 'ready' || !waClient) return 'skipped_not_connected'

  const template = getSetting('wa_template_confirm', '')
  if (!template.trim()) return 'skipped_no_template'

  const vars = getAppointmentVars(appointmentId)
  if (!vars || !vars._phone) return 'skipped_no_phone'

  const formattedPhone = formatPhoneForWA(vars._phone, vars._countryCode)
  if (!formattedPhone) return 'skipped_no_phone'

  // Obtener client_id real de la cita para el log
  const aptRow = getDb()
    .prepare('SELECT client_id FROM appointments WHERE id = ?')
    .get(appointmentId) as { client_id: number | null } | undefined

  const message = renderTemplate(template, vars)

  // Insertar log ANTES del envío para tener el id
  const logId = insertLog({
    appointmentId,
    clientId: aptRow?.client_id ?? null,  // ← FIX: client_id real
    phone:    formattedPhone,
    reminderType:    'manual',
    messagePreview:  `[CONFIRMACIÓN] ${message.slice(0, 120)}`,
    status:          'pending',
  })

  try {
    const logoPath = getSetting('wa_logo_path', '')
    if (logoPath) {
      const media = MessageMedia.fromFilePath(logoPath)
      await waClient.sendMessage(formattedPhone, media, { caption: message })
    } else {
      await waClient.sendMessage(formattedPhone, message)
    }

    // ← FIX: marcar como enviado correctamente
    markLogSent(logId)
    logger.info(`[WA] Confirmación enviada a ${formattedPhone} para cita #${appointmentId}`)
    return 'sent'
  } catch (err: any) {
    const errMsg = err?.message ?? String(err)
    markLogFailed(logId, errMsg)  // ← también marcar el fallo correctamente
    logger.error(`[WA] Error enviando confirmación a ${formattedPhone}: ${errMsg}`)
    return 'error'
  }
}

export async function disconnectWhatsApp() {
  await performFullWACleanup('Desconexión manual solicitada')
}