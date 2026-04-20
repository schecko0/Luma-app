import { app, BrowserWindow, shell } from 'electron'
import { createServer } from 'http'
import { URL } from 'url'
import { google } from 'googleapis'
import { logger } from '../logger'
import { getDb } from '../../database/database'
import { nowISO } from '../../database/dbUtils'
import type { Appointment } from '../../renderer/src/types'

const OAUTH_PORT   = 3737
const REDIRECT_URI = `http://localhost:${OAUTH_PORT}/callback`
const SCOPES       = ['https://www.googleapis.com/auth/calendar']

// ─────────────────────────────────────────────────────────────────────────────
// OAuth helpers
// ─────────────────────────────────────────────────────────────────────────────
function buildOAuthClient() {
  const db  = getDb()
  const cid = (db.prepare("SELECT value FROM settings WHERE key='google_client_id'").get() as { value: string } | undefined)?.value ?? ''
  const sec = (db.prepare("SELECT value FROM settings WHERE key='google_secret'").get()    as { value: string } | undefined)?.value ?? ''
  if (!cid || !sec) throw new Error('Credenciales de Google no configuradas. Ve a Ajustes → Google Calendar.')
  return new google.auth.OAuth2(cid, sec, REDIRECT_URI)
}

function loadTokens(oauth2: ReturnType<typeof buildOAuthClient>): boolean {
  const db  = getDb()
  const row = db.prepare('SELECT * FROM google_oauth_tokens WHERE id = 1').get() as {
    access_token: string; refresh_token: string; token_type: string
    expiry_date: number | null; scope: string | null
  } | undefined
  if (!row) return false

  oauth2.setCredentials({
    access_token:  row.access_token,
    refresh_token: row.refresh_token,
    token_type:    row.token_type,
    expiry_date:   row.expiry_date ?? undefined,
    scope:         row.scope       ?? undefined,
  })

  oauth2.on('tokens', tokens => {
    const db2 = getDb(); const now2 = nowISO()
    db2.prepare(`
      INSERT OR REPLACE INTO google_oauth_tokens
        (id, access_token, refresh_token, token_type, expiry_date, scope, updated_at)
      VALUES (1, @access_token, @refresh_token, @token_type, @expiry_date, @scope, @now)
    `).run({
      access_token:  tokens.access_token  ?? row.access_token,
      refresh_token: tokens.refresh_token ?? row.refresh_token,
      token_type:    tokens.token_type    ?? 'Bearer',
      expiry_date:   tokens.expiry_date   ?? null,
      scope:         tokens.scope         ?? row.scope,
      now:           now2,
    })
  })
  return true
}

function getSalonCalendarId(): string {
  const row = getDb().prepare("SELECT value FROM settings WHERE key='google_calendar_id'").get() as { value: string } | undefined
  return row?.value ?? 'primary'
}

// ─────────────────────────────────────────────────────────────────────────────
// pullFromGoogle — importa eventos de Google Calendar → BD local
//
// PAGINACIÓN COMPLETA: sigue nextPageToken hasta traer TODOS los eventos del
// rango. La API de Google entrega máximo 2500 por página; nosotros pedimos
// 500 por página para un balance entre velocidad y tamaño de respuesta.
//
// Si dateFrom/dateTo no se pasan, usa: hoy-7d hasta hoy+365d (un año).
// ─────────────────────────────────────────────────────────────────────────────
// Semáforo para evitar múltiples pulls simultáneos
let isPullingFromGoogle = false

async function pullFromGoogle(
  oauth2:   ReturnType<typeof buildOAuthClient>,
  dateFrom?: string,   // 'YYYY-MM-DD' — límite inferior del rango
  dateTo?:   string,   // 'YYYY-MM-DD' — límite superior del rango
): Promise<{ imported: number; updated: number }> {

  if (isPullingFromGoogle) {    
    return { imported: 0, updated: 0 }
  }

  isPullingFromGoogle = true
  const db    = getDb()
  const cal   = google.calendar({ version: 'v3', auth: oauth2 })
  const calId = getSalonCalendarId()
  const now   = nowISO()

  try {
    // ... (resto del código del pull que ya actualizamos)

  // Rango por defecto: últimos 7 días + próximos 365 días
  const from = dateFrom
    ? new Date(dateFrom + 'T00:00:00')
    : (() => { const d = new Date(); d.setDate(d.getDate() - 7); return d })()
  const to   = dateTo
    ? new Date(dateTo + 'T23:59:59')
    : (() => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d })()

  let imported    = 0
  let updated     = 0
  let pageToken: string | undefined = undefined

  // Preparar sentencias fuera del loop para velocidad
  const selectStmt = db.prepare('SELECT id FROM appointments WHERE google_event_id = ?')
  const updateStmt = db.prepare(`
    UPDATE appointments SET
      title = ?, start_at = ?, end_at = ?, description = ?,
      sync_status = 'synced', last_synced_at = ?, updated_at = ?
    WHERE google_event_id = ?
  `)
  const insertStmt = db.prepare(`
    INSERT INTO appointments
      (google_event_id, title, description, start_at, end_at,
       all_day, color, sync_status, last_synced_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?, ?)
  `)

  // ── Paginación: seguir nextPageToken hasta agotar resultados ─────────
  do {
  
    const resp = await cal.events.list({
      calendarId:    calId,
      timeMin:       from.toISOString(),
      timeMax:       to.toISOString(),
      singleEvents:  true,
      orderBy:       'startTime',
      maxResults:    250,           // Reducimos un poco el lote para mayor fluidez
      pageToken,
    })

    pageToken = resp.data.nextPageToken ?? undefined
    const events = resp.data.items ?? []

    if (events.length > 0) {
      // USAR TRANSACCIÓN PARA TODA LA PÁGINA (Ultra rápido)
      const processBatch = db.transaction((evs) => {
        for (const ev of evs) {
          if (!ev.id || !ev.summary) continue
          if (ev.status === 'cancelled') continue

          const startAt = ev.start?.dateTime ?? (ev.start?.date ? ev.start.date + 'T00:00:00' : null)
          const endAt   = ev.end?.dateTime   ?? (ev.end?.date   ? ev.end.date   + 'T00:00:00' : null)
          if (!startAt || !endAt) continue

          const existing = selectStmt.get(ev.id)

          if (existing) {
            updateStmt.run(ev.summary, startAt, endAt, ev.description ?? null, now, now, ev.id)
            updated++
          } else {
            insertStmt.run(
              ev.id, ev.summary, ev.description ?? null,
              startAt, endAt,
              ev.start?.date ? 1 : 0,
              googleColorIdToName(ev.colorId ?? ''),
              now, now, now,
            )
            imported++
          }
        }
      })
      processBatch(events)
    }
  } while (pageToken)

  return { imported, updated }
  } finally {
  isPullingFromGoogle = false
  }
  }
// ─────────────────────────────────────────────────────────────────────────────
// pushToGoogle — crea o actualiza un evento en Google
// ─────────────────────────────────────────────────────────────────────────────
async function pushToGoogle(appointmentId: number): Promise<void> {
  const db  = getDb()
  const apt = db.prepare(`
    SELECT a.*,
      (e.first_name || ' ' || e.last_name) AS employee_name,
      (c.first_name || ' ' || c.last_name) AS client_name,
      s.name AS service_name
    FROM appointments a
    LEFT JOIN employees e ON e.id = a.employee_id
    LEFT JOIN clients   c ON c.id = a.client_id
    LEFT JOIN services  s ON s.id = a.service_id
    WHERE a.id = ?
  `).get(appointmentId) as (Appointment & { employee_name?: string; client_name?: string; service_name?: string }) | undefined
  if (!apt || apt.sync_status === 'cancelled') return

  const oauth2 = buildOAuthClient()
  if (!loadTokens(oauth2)) return

  const cal   = google.calendar({ version: 'v3', auth: oauth2 })
  const calId = getSalonCalendarId()
  const now   = nowISO()

  const description = [
    apt.client_name   ? `Cliente: ${apt.client_name}`    : null,
    apt.service_name  ? `Servicio: ${apt.service_name}`  : null,
    apt.employee_name ? `Empleado: ${apt.employee_name}` : null,
    apt.description   ?? null,
  ].filter(Boolean).join('\n')

  const eventBody = {
    summary:     apt.title,
    description: description || undefined,
    start: apt.all_day
      ? { date: apt.start_at.split('T')[0] }
      : { dateTime: apt.start_at, timeZone: 'America/Mexico_City' },
    end: apt.all_day
      ? { date: apt.end_at.split('T')[0] }
      : { dateTime: apt.end_at, timeZone: 'America/Mexico_City' },
    colorId: colorNameToGoogleId(apt.color),
  }

  if (apt.google_event_id) {
    await cal.events.patch({ calendarId: calId, eventId: apt.google_event_id, requestBody: eventBody })
    db.prepare('UPDATE appointments SET sync_status=?,last_synced_at=?,updated_at=? WHERE id=?').run('synced', now, now, appointmentId)
  } else {
    const resp    = await cal.events.insert({ calendarId: calId, requestBody: eventBody })
    const eventId = resp.data.id ?? null
    db.prepare('UPDATE appointments SET google_event_id=?,sync_status=?,last_synced_at=?,updated_at=? WHERE id=?').run(eventId, 'synced', now, now, appointmentId)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Detectar empalmes para un empleado en un rango horario
// ─────────────────────────────────────────────────────────────────────────────
function detectOverlaps(employeeId: number, startAt: string, endAt: string, excludeId?: number): Appointment[] {
  return getDb().prepare(`
    SELECT a.*,
      (e.first_name || ' ' || e.last_name) AS employee_name,
      (c.first_name || ' ' || c.last_name) AS client_name,
      s.name AS service_name
    FROM appointments a
    LEFT JOIN employees e ON e.id = a.employee_id
    LEFT JOIN clients   c ON c.id = a.client_id
    LEFT JOIN services  s ON s.id = a.service_id
    WHERE a.employee_id = ?
      AND a.sync_status != 'cancelled'
      AND a.id != COALESCE(?, -1)
      AND a.start_at < ?
      AND a.end_at   > ?
    ORDER BY a.start_at ASC
  `).all(employeeId, excludeId ?? null, endAt, startAt) as Appointment[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapeo de colores Google Calendar ↔ nombres internos
// ─────────────────────────────────────────────────────────────────────────────
function googleColorIdToName(id: string): string {
  const m: Record<string, string> = { '1':'lavender','2':'sage','3':'grape','4':'flamingo','5':'banana','6':'tangerine','7':'peacock','8':'graphite','9':'blueberry','10':'basil','11':'tomato' }
  return m[id] ?? 'peacock'
}
function colorNameToGoogleId(name: string | null | undefined): string | undefined {
  const m: Record<string, string> = { lavender:'1',sage:'2',grape:'3',flamingo:'4',banana:'5',tangerine:'6',peacock:'7',graphite:'8',blueberry:'9',basil:'10',tomato:'11' }
  return name ? m[name] : undefined
}

// ... (mantener funciones anteriores)

function isInvalidGrantError(err: any): boolean {
  const msg = err.message || ''
  const data = err.response?.data?.error || ''
  return (
    msg.includes('invalid_grant') || 
    msg.includes('No access, refresh token or API key') ||
    data === 'invalid_grant' ||
    (typeof data === 'string' && data.includes('invalid_grant'))
  )
}

/**
 * Maneja errores de autenticación de Google de forma centralizada.
 * Si es un error fatal (token expirado/revocado), limpia la DB y avisa al Renderer.
 */
function handleAuthError(err: any): boolean {
  if (isInvalidGrantError(err)) {
    logger.error('Sesión de Google Calendar caducada o revocada. Desconectando...', err)
    getDb().prepare('DELETE FROM google_oauth_tokens WHERE id=1').run()
    
    // Notificar a todas las ventanas para que actualicen su UI y muestren alerta
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('calendar:auth-error', 'La sesión de Google ha caducado. Por favor, vuelve a conectar tu cuenta.')
      win.webContents.send('calendar:updated') // Forzar refresco de estados
    })
    return true
  }
  return false
}

// ─────────────────────────────────────────────────────────────────────────────
// Sync Queue Motor — Procesa tareas pendientes en segundo plano
// ─────────────────────────────────────────────────────────────────────────────
let isProcessingQueue = false

export async function startSyncWorker() {
  // Ejecutar cada 1 minuto (o al detectar cambio de red)
  setInterval(() => {
    processSyncQueue().catch(err => logger.error('Sync Worker Error', err))
  }, 60_000)
  
  // Primera ejecución inmediata tras 5 segundos del arranque
  setTimeout(() => processSyncQueue(), 5000)
}

async function processSyncQueue(): Promise<void> {
  if (isProcessingQueue) return
  
  const db = getDb()
  const tokenRow = db.prepare('SELECT id FROM google_oauth_tokens WHERE id=1').get()
  if (!tokenRow) return // Sin conexión a Google, no procesar

  const pending = db.prepare(`
    SELECT * FROM google_sync_queue 
    WHERE next_retry_at <= ? AND attempts < 5
    ORDER BY created_at ASC LIMIT 10
  `).all(nowISO()) as any[]

  if (pending.length === 0) return

  isProcessingQueue = true


  const oauth2 = buildOAuthClient()
  if (!loadTokens(oauth2)) { isProcessingQueue = false; return }
  const cal = google.calendar({ version: 'v3', auth: oauth2 })
  const calId = getSalonCalendarId()

  for (const task of pending) {
    try {
      const apt = db.prepare('SELECT * FROM appointments WHERE id = ?').get(task.appointment_id) as Appointment | undefined
      
      if (task.operation === 'delete') {
        const payload = JSON.parse(task.payload || '{}')
        if (payload.google_event_id) {
          try {
            await cal.events.delete({ calendarId: calId, eventId: payload.google_event_id })
          } catch (deleteErr: any) {
            // Si el evento ya no existe en Google (404), ignoramos el error
            if (deleteErr.code !== 404) throw deleteErr
          }
        }
      } else {
        // Create o Update
        if (!apt || apt.sync_status === 'cancelled') {
          db.prepare('DELETE FROM google_sync_queue WHERE id = ?').run(task.id)
          continue
        }
        await pushToGoogle(apt.id)
      }

      // Éxito: eliminar de la cola
      db.prepare('DELETE FROM google_sync_queue WHERE id = ?').run(task.id)
      
      // Notificar a las ventanas para refrescar UI (Badges de Sync)
      BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('calendar:updated')
      })
    } catch (err: any) {
      // Si el token es inválido o caducó (invalid_grant), desconectar para forzar re-login
      if (handleAuthError(err)) {
        isProcessingQueue = false
        return // Detener procesamiento, requiere intervención del usuario
      }

      const attempts = task.attempts + 1
      // Reintento exponencial: 2min, 4min, 8min, 16min...
      const nextRetry = new Date()
      nextRetry.setMinutes(nextRetry.getMinutes() + Math.pow(2, attempts))
      
      db.prepare(`
        UPDATE google_sync_queue 
        SET attempts = ?, last_error = ?, next_retry_at = ? 
        WHERE id = ?
      `).run(attempts, err.message || 'Error desconocido', nowISO(), task.id)
      
      logger.warn(`Tarea de sync ${task.id} falló (intento ${attempts}): ${err.message}`)
    }
  }

  isProcessingQueue = false
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDLERS IPC
// ─────────────────────────────────────────────────────────────────────────────
export function registerCalendarHandlers(ipcMain: IpcMain) {

  // ── Estado de conexión ────────────────────────────────────────────────
  ipcMain.handle('calendar:getStatus', () => {
    try {
      const db    = getDb()
      const row   = db.prepare('SELECT connected_at, updated_at FROM google_oauth_tokens WHERE id=1').get() as { connected_at: string } | undefined
      const cid   = (db.prepare("SELECT value FROM settings WHERE key='google_client_id'").get() as { value: string } | undefined)?.value ?? ''
      return { ok: true, data: { connected: !!row, connected_at: row?.connected_at ?? null, has_credentials: !!cid, calendar_id: getSalonCalendarId() } }
    } catch (e: unknown) { return { ok: false, error: String(e) } }
  })

  // ── Conectar OAuth2 + pull inicial con paginación ─────────────────────
  ipcMain.handle('calendar:connect', async () => {
    try {
      const oauth2 = buildOAuthClient()
      const url    = oauth2.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: SCOPES })

      const code = await new Promise<string>((resolve, reject) => {
        const server = createServer((req, res) => {
          try {
            const u     = new URL(req.url ?? '/', `http://localhost:${OAUTH_PORT}`)
            const code  = u.searchParams.get('code')
            const error = u.searchParams.get('error')
            const html  = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Luma</title>
              <style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0f0d0b;color:#f5f0e8;}
              .box{text-align:center;padding:2rem;border-radius:12px;background:#1a1714;border:1px solid #2e2920;}
              h2{color:${error ? '#dc4a3d' : '#4caf7d'};margin-bottom:1rem;}p{color:#8a8070;}</style></head>
              <body><div class="box"><h2>${error ? '❌ Error' : '✅ ¡Conectado!'}</h2>
              <p>${error ? `Error: ${error}` : 'Luma App autorizada. Puedes cerrar esta ventana.'}</p>
              </div><script>setTimeout(()=>window.close(),2000)</script></body></html>`
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
            res.end(html); server.close()
            if (error) reject(new Error(`Google rechazó: ${error}`))
            else if (code) resolve(code)
            else reject(new Error('Sin código de autorización.'))
          } catch (e) { reject(e) }
        })
        server.listen(OAUTH_PORT, 'localhost', () => shell.openExternal(url))
        setTimeout(() => { server.close(); reject(new Error('Tiempo de espera agotado.')) }, 180_000)
      })

      const { tokens } = await oauth2.getToken(code)
      oauth2.setCredentials(tokens)

      const db = getDb(); const now = nowISO()
      db.prepare(`
        INSERT OR REPLACE INTO google_oauth_tokens
          (id, access_token, refresh_token, token_type, expiry_date, scope, connected_at, updated_at)
        VALUES (1, @access_token, @refresh_token, @token_type, @expiry_date, @scope, @now, @now)
      `).run({
        access_token:  tokens.access_token  ?? '',
        refresh_token: tokens.refresh_token ?? '',
        token_type:    tokens.token_type    ?? 'Bearer',
        expiry_date:   tokens.expiry_date   ?? null,
        scope:         tokens.scope         ?? SCOPES.join(' '),
        now,
      })

      // Pull inicial con paginación: últimos 7 días + próximos 365 días
      let pullResult = { imported: 0, updated: 0 }
      try { pullResult = await pullFromGoogle(oauth2) } catch (_) { /* No crítico */ }

      return { ok: true, data: pullResult }
    } catch (e: unknown) { return { ok: false, error: String(e).replace('Error: ', '') } }
  })

  // ── Desconectar ───────────────────────────────────────────────────────
  ipcMain.handle('calendar:disconnect', () => {
    try { getDb().prepare('DELETE FROM google_oauth_tokens WHERE id=1').run(); return { ok: true } }
    catch (e: unknown) { return { ok: false, error: String(e) } }
  })

  // ── Listar calendarios de la cuenta ──────────────────────────────────
  ipcMain.handle('calendar:listCalendars', async () => {
    try {
      const oauth2 = buildOAuthClient()
      if (!loadTokens(oauth2)) return { ok: false, error: 'No conectado.' }
      const cal  = google.calendar({ version: 'v3', auth: oauth2 })
      const resp = await cal.calendarList.list({ minAccessRole: 'writer' })
      return { ok: true, data: (resp.data.items ?? []).map(c => ({ id: c.id, summary: c.summary, primary: c.primary ?? false, color: c.backgroundColor })) }
    } catch (e: unknown) { return { ok: false, error: String(e).replace('Error: ', '') } }
  })

  // ── Listar citas (BD local) + lazy pull si no hay datos en ese rango ──
  // SOLUCIÓN al problema de "navegar al futuro":
  // Si el rango pedido no tiene citas locales Y la app está conectada,
  // se hace un pull automático de Google SOLO para ese rango específico.
  // Así una cita agendada a 1 año aparece al navegar hasta esa semana.
  ipcMain.handle('calendar:listAppointments', async (_e, dateFrom: string, dateTo: string) => {
  
    try {
      const db = getDb()
      const localCount = (db.prepare(`
        SELECT COUNT(*) as n FROM appointments
        WHERE sync_status != 'cancelled'
          AND DATE(start_at) >= DATE(?) AND DATE(start_at) <= DATE(?)
      `).get(dateFrom, dateTo) as { n: number }).n
      

      if (localCount === 0) {
        const tokenRow = db.prepare('SELECT id FROM google_oauth_tokens WHERE id=1').get()
        if (tokenRow) {
          
          const oauth2 = buildOAuthClient()
          if (loadTokens(oauth2)) {
            pullFromGoogle(oauth2, dateFrom, dateTo).then((res) => {
              
              // SOLO avisar si hubo cambios reales en la DB
              if (res.imported > 0 || res.updated > 0) {
                BrowserWindow.getAllWindows().forEach(win => win.webContents.send('calendar:updated'))
              }
            }).catch(err => {
              // Si falla el pull por autenticación, desconectamos
              if (handleAuthError(err)) return
              logger.error('[Pull] Error en Lazy Pull', err)
            })
          }
        }
      }

      
      const rows = db.prepare(`
        SELECT a.*,
          (e.first_name || ' ' || e.last_name) AS employee_name,
          e.calendar_color                      AS employee_color,
          (c.first_name || ' ' || c.last_name) AS client_name,
          s.name                                AS service_name
        FROM appointments a
        LEFT JOIN employees e ON e.id = a.employee_id
        LEFT JOIN clients   c ON c.id = a.client_id
        LEFT JOIN services  s ON s.id = a.service_id
        WHERE a.sync_status != 'cancelled'
          AND DATE(a.start_at) >= DATE(?)
          AND DATE(a.start_at) <= DATE(?)
        ORDER BY a.start_at ASC
      `).all(dateFrom, dateTo) as Appointment[]
      
      
      return { ok: true, data: rows }
    } catch (e: unknown) { 
      logger.error('[IPC] ERROR en listAppointments', e)
      return { ok: false, error: String(e) } 
    }
  })

  // ── Verificar empalmes ────────────────────────────────────────────────
  ipcMain.handle('calendar:checkOverlaps', (_e, employeeId: number, startAt: string, endAt: string, excludeId?: number) => {
    try {
      if (!employeeId) return { ok: true, data: [] }
      return { ok: true, data: detectOverlaps(employeeId, startAt, endAt, excludeId) }
    } catch (e: unknown) { return { ok: false, error: String(e) } }
  })

  // ── Crear cita ────────────────────────────────────────────────────────
  ipcMain.handle('calendar:createAppointment', async (_e, data: any) => {
    try {
      const db = getDb(); const now = nowISO()

      let overlaps: Appointment[] = []
      if (data.employee_id) overlaps = detectOverlaps(data.employee_id, data.start_at, data.end_at)
      if (overlaps.length > 0 && !data.force) {
        return { ok: false, code: 'OVERLAP', error: `El empleado ya tiene ${overlaps.length} cita(s) en ese horario.`, data: overlaps }
      }

      const result = db.prepare(`
        INSERT INTO appointments
          (employee_id, client_id, service_id, title, description,
           start_at, end_at, all_day, color, sync_status, created_at, updated_at)
        VALUES (@employee_id,@client_id,@service_id,@title,@description,
                @start_at,@end_at,@all_day,@color,'local',@now,@now)
      `).run({
        employee_id: data.employee_id ?? null, client_id: data.client_id ?? null,
        service_id:  data.service_id  ?? null, title: data.title,
        description: data.description ?? null, start_at: data.start_at, end_at: data.end_at,
        all_day: data.all_day ? 1 : 0, color: data.color ?? null, now: now,
      })
      const id = result.lastInsertRowid as number

      db.prepare(`
        INSERT INTO google_sync_queue (appointment_id, operation, created_at, next_retry_at)
        VALUES (?, 'create', ?, ?)
      `).run(id, now, now)

      // NOTIFICAR REFRESCO INMEDIATO A LA UI
      BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('calendar:updated')
      })

      // DISPARAR EL TRABAJO DE FONDO DESPUÉS DE UN TIEMPO PRUDENCIAL
      setTimeout(() => {
        processSyncQueue().catch(() => {})
      }, 1500)

      return { ok: true, data: { id, overlaps } }
    } catch (e: any) { 
      logger.error('Error al crear cita', e)
      return { ok: false, error: String(e).replace('Error: ', '') } 
    }
  })

  // ── Actualizar cita ───────────────────────────────────────────────────
  ipcMain.handle('calendar:updateAppointment', async (_e, id: number, data: Partial<{
    employee_id: number | null; client_id: number | null; service_id: number | null
    title: string; description: string; start_at: string; end_at: string
    all_day: boolean; color: string; force: boolean
  }>) => {
    try {
      const db  = getDb()
      const cur = db.prepare('SELECT * FROM appointments WHERE id=?').get(id) as Appointment | undefined
      if (!cur) return { ok: false, error: 'Cita no encontrada.' }

      const newEmpId   = data.employee_id !== undefined ? data.employee_id : cur.employee_id
      const newStartAt = data.start_at    ?? cur.start_at
      const newEndAt   = data.end_at      ?? cur.end_at

      let overlaps: Appointment[] = []
      if (newEmpId) overlaps = detectOverlaps(newEmpId, newStartAt, newEndAt, id)
      if (overlaps.length > 0 && !data.force)
        return { ok: false, code: 'OVERLAP', error: `El empleado ya tiene ${overlaps.length} cita(s) en ese horario.`, data: overlaps }

      const now = nowISO()
      db.prepare(`
        UPDATE appointments SET
          employee_id=@employee_id, client_id=@client_id, service_id=@service_id,
          title=@title, description=@description, start_at=@start_at, end_at=@end_at,
          all_day=@all_day, color=@color, sync_status='pending_sync', updated_at=@now
        WHERE id=@id
      `).run({
        employee_id:  newEmpId,
        client_id:    data.client_id  !== undefined ? data.client_id  : cur.client_id,
        service_id:   data.service_id !== undefined ? data.service_id : cur.service_id,
        title:        data.title       ?? cur.title,
        description:  data.description ?? cur.description,
        start_at:     newStartAt, end_at: newEndAt,
        all_day:      (data.all_day ?? cur.all_day) ? 1 : 0,
        color:        data.color ?? cur.color,
        now:          now, // <-- Corregido
        id,
      })

      // ENCOLAR SINCRONIZACIÓN
      db.prepare(`
        INSERT INTO google_sync_queue (appointment_id, operation, created_at, next_retry_at)
        VALUES (?, 'update', ?, ?)
      `).run(id, now, now)

      setTimeout(() => processSyncQueue().catch(() => {}), 200)

      // NOTIFICAR REFRESCO DE UI
      BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('calendar:updated')
      })

      return { ok: true, data: { overlaps } }
    } catch (e: unknown) { 
      logger.error('Error al actualizar cita', e)
      return { ok: false, error: String(e).replace('Error: ', '') } 
    }
  })

  // ── Cancelar cita ─────────────────────────────────────────────────────
  ipcMain.handle('calendar:cancelAppointment', async (_e, id: number, reason?: string) => {
    try {
      const db  = getDb()
      const cur = db.prepare(`
        SELECT a.*,
          (e.first_name || ' ' || e.last_name) AS employee_name,
          (c.first_name || ' ' || c.last_name) AS client_name,
          c.phone AS client_phone,
          s.name  AS service_name
        FROM appointments a
        LEFT JOIN employees e ON e.id = a.employee_id
        LEFT JOIN clients   c ON c.id = a.client_id
        LEFT JOIN services  s ON s.id = a.service_id
        WHERE a.id = ?
      `).get(id) as (Appointment & {
        employee_name?: string; client_name?: string
        client_phone?: string;  service_name?: string
      }) | undefined
      if (!cur) return { ok: false, error: 'Cita no encontrada.' }

      const now = nowISO()

      // 1️⃣ Snapshot en papelera ANTES de cancelar
      db.prepare(`
        INSERT INTO cancelled_appointments (
          appointment_id,
          snapshot_title, snapshot_start_at, snapshot_end_at,
          snapshot_description, snapshot_color, snapshot_all_day,
          snapshot_google_event_id,
          employee_id, employee_name,
          client_id,   client_name, client_phone,
          service_id,  service_name,
          cancelled_from, cancel_reason, cancelled_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'agenda',?,?)
      `).run(
        id,
        cur.title, cur.start_at, cur.end_at,
        cur.description ?? null, cur.color ?? null, cur.all_day ? 1 : 0,
        cur.google_event_id ?? null,
        cur.employee_id ?? null, (cur as any).employee_name ?? null,
        cur.client_id   ?? null, (cur as any).client_name  ?? null, (cur as any).client_phone ?? null,
        cur.service_id  ?? null, (cur as any).service_name ?? null,
        reason ?? null, now
      )

      // 2️⃣ Marcar cancelada
      db.prepare('UPDATE appointments SET sync_status=?,updated_at=? WHERE id=?').run('cancelled', now, id)

      // 3️⃣ Encolar eliminación en Google si aplica
      if (cur.google_event_id) {
        db.prepare(`
          INSERT INTO google_sync_queue (appointment_id, operation, payload, created_at, next_retry_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(id, 'delete', JSON.stringify({ google_event_id: cur.google_event_id }), now, now)
        setTimeout(() => processSyncQueue().catch(() => {}), 1500)
      }

      BrowserWindow.getAllWindows().forEach(win => win.webContents.send('calendar:updated'))
      return { ok: true }
    } catch (e: any) { 
      logger.error('Error en cancelAppointment', e)
      return { ok: false, error: String(e).replace('Error: ', '') } 
    }
  })

  // ── Papelera: listar citas canceladas ────────────────────────────────
  ipcMain.handle('calendar:listCancelled', (_e, page = 1, pageSize = 20) => {
    try {
      const db     = getDb()
      const offset = (page - 1) * pageSize
      const rows   = db.prepare(`
        SELECT * FROM cancelled_appointments
        WHERE is_restored = 0
        ORDER BY cancelled_at DESC
        LIMIT ? OFFSET ?
      `).all(pageSize, offset)
      const total  = (db.prepare('SELECT COUNT(*) as n FROM cancelled_appointments WHERE is_restored = 0').get() as { n: number }).n
      return { ok: true, data: { rows, total } }
    } catch (e: any) { return { ok: false, error: String(e) } }
  })

  // ── Papelera: restaurar una cita cancelada ────────────────────────────
  ipcMain.handle('calendar:restoreAppointment', async (_e, cancelledId: number) => {
    try {
      const db  = getDb()
      const rec = db.prepare('SELECT * FROM cancelled_appointments WHERE id = ?').get(cancelledId) as any
      if (!rec) return { ok: false, error: 'Registro no encontrado en la papelera.' }
      if (rec.is_restored) return { ok: false, error: 'Esta cita ya fue restaurada.' }

      const now = nowISO()
      const result = db.prepare(`
        INSERT INTO appointments
          (employee_id, client_id, service_id, title, description,
           start_at, end_at, all_day, color, sync_status, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,'local',?,?)
      `).run(
        rec.employee_id ?? null, rec.client_id ?? null, rec.service_id ?? null,
        rec.snapshot_title, rec.snapshot_description ?? null,
        rec.snapshot_start_at, rec.snapshot_end_at,
        rec.snapshot_all_day ?? 0, rec.snapshot_color ?? null,
        now, now
      )
      const newId = result.lastInsertRowid as number

      db.prepare(`
        UPDATE cancelled_appointments
        SET is_restored = 1, restored_at = ?, restored_appointment_id = ?
        WHERE id = ?
      `).run(now, newId, cancelledId)

      db.prepare(`
        INSERT INTO google_sync_queue (appointment_id, operation, created_at, next_retry_at)
        VALUES (?, 'create', ?, ?)
      `).run(newId, now, now)
      setTimeout(() => processSyncQueue().catch(() => {}), 1500)

      BrowserWindow.getAllWindows().forEach(win => win.webContents.send('calendar:updated'))
      return { ok: true, data: { newAppointmentId: newId } }
    } catch (e: any) {
      logger.error('Error en restoreAppointment', e)
      return { ok: false, error: String(e).replace('Error: ', '') }
    }
  })

  // ── Sincronización push (pending_sync → Google) ───────────────────────
  ipcMain.handle('calendar:sync', async () => {
    try {
      const db = getDb()
      if (!db.prepare('SELECT id FROM google_oauth_tokens WHERE id=1').get()) return { ok: false, error: 'No conectado.' }
      const pending = db.prepare("SELECT id FROM appointments WHERE sync_status='pending_sync' ORDER BY updated_at ASC LIMIT 50").all() as { id: number }[]
      let synced = 0; let errors = 0
      for (const row of pending) { 
        try { 
          await pushToGoogle(row.id)
          synced++ 
        } catch (e: any) { 
          errors++ 
          logger.error(`Fallo al sincronizar cita #${row.id} manualmente`, e)
          
          if (handleAuthError(e)) {
            return { ok: false, error: 'La sesión de Google ha caducado. Por favor, vuelve a conectar la cuenta.' }
          }
        } 
      }
      return { ok: true, data: { synced, errors, total: pending.length } }
    } catch (e: unknown) { 
      logger.error('Error general en el proceso de sincronización manual', e)
      return { ok: false, error: String(e).replace('Error: ', '') } 
    }
  })

  // ── Pull manual desde Google (con paginación y rango opcional) ────────
  // Se puede llamar con rango específico para importar citas de cualquier
  // período, por ejemplo los próximos 2 años o el año pasado completo.
  ipcMain.handle('calendar:pull', async (_e, dateFrom?: string, dateTo?: string) => {
    try {
      const oauth2 = buildOAuthClient()
      if (!loadTokens(oauth2)) return { ok: false, error: 'No conectado a Google Calendar.' }
      const result = await pullFromGoogle(oauth2, dateFrom, dateTo)
      return { ok: true, data: result }
    } catch (e: unknown) { return { ok: false, error: String(e).replace('Error: ', '') } }
  })
}
