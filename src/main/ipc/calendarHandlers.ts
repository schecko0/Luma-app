import type { IpcMain, BrowserWindow } from 'electron'
import { shell } from 'electron'
import { createServer } from 'http'
import { URL } from 'url'
import { google } from 'googleapis'
import { getDb } from '../../database/database'
import { nowISO } from '../../database/dbUtils'
import type { Appointment } from '../../renderer/src/types'

// ── Puerto local para el callback OAuth2 ─────────────────────────────────────
const OAUTH_PORT = 3737
const REDIRECT_URI = `http://localhost:${OAUTH_PORT}/callback`
const SCOPES = ['https://www.googleapis.com/auth/calendar']

// ── Construir cliente OAuth2 con las credenciales del salón ──────────────────
function buildOAuthClient() {
  const db = getDb()
  const cid = (db.prepare("SELECT value FROM settings WHERE key='google_client_id'").get() as { value: string } | undefined)?.value ?? ''
  const sec = (db.prepare("SELECT value FROM settings WHERE key='google_secret'").get() as { value: string } | undefined)?.value ?? ''
  if (!cid || !sec) throw new Error('Credenciales de Google no configuradas. Ve a Ajustes → Google Calendar.')
  return new google.auth.OAuth2(cid, sec, REDIRECT_URI)
}

// ── Cargar tokens guardados en la BD ─────────────────────────────────────────
function loadTokens(oauth2: ReturnType<typeof buildOAuthClient>) {
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
    scope:         row.scope ?? undefined,
  })

  // Listener para auto-guardar tokens cuando se refrescan
  oauth2.on('tokens', (tokens) => {
    const db2  = getDb()
    const now2 = nowISO()
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

// ── Obtener calendario del salón ──────────────────────────────────────────────
function getSalonCalendarId(): string {
  const db  = getDb()
  const row = db.prepare("SELECT value FROM settings WHERE key='google_calendar_id'").get() as { value: string } | undefined
  return row?.value ?? 'primary'
}

// ── Registrar handlers ────────────────────────────────────────────────────────
export function registerCalendarHandlers(ipcMain: IpcMain) {

  // ── Estado de conexión ──────────────────────────────────────────────────
  ipcMain.handle('calendar:getStatus', () => {
    try {
      const db  = getDb()
      const row = db.prepare('SELECT connected_at, updated_at FROM google_oauth_tokens WHERE id = 1').get() as { connected_at: string; updated_at: string } | undefined
      const cid = (db.prepare("SELECT value FROM settings WHERE key='google_client_id'").get() as { value: string } | undefined)?.value ?? ''
      const calId = getSalonCalendarId()
      return { ok: true, data: { connected: !!row, connected_at: row?.connected_at ?? null, has_credentials: !!cid, calendar_id: calId } }
    } catch (err: unknown) { return { ok: false, error: String(err) } }
  })

  // ── Iniciar flujo OAuth2 (abre el navegador del sistema) ───────────────
  ipcMain.handle('calendar:connect', async () => {
    try {
      const oauth2 = buildOAuthClient()
      const url    = oauth2.generateAuthUrl({
        access_type: 'offline',
        prompt:      'consent',  // fuerza retornar refresh_token siempre
        scope:       SCOPES,
      })

      // Levantar servidor HTTP local para capturar el callback de Google
      const code = await new Promise<string>((resolve, reject) => {
        const server = createServer((req, res) => {
          try {
            const reqUrl = new URL(req.url ?? '/', `http://localhost:${OAUTH_PORT}`)
            const code   = reqUrl.searchParams.get('code')
            const error  = reqUrl.searchParams.get('error')

            // Página de respuesta que cierra el tab automáticamente
            const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
              <title>Luma App — Autorización</title>
              <style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0f0d0b;color:#f5f0e8;}
              .box{text-align:center;padding:2rem;border-radius:12px;background:#1a1714;border:1px solid #2e2920;}
              h2{color:${error ? '#dc4a3d' : '#4caf7d'};margin-bottom:1rem;}p{color:#8a8070;}</style></head>
              <body><div class="box"><h2>${error ? '❌ Error de autorización' : '✅ ¡Conectado!'}</h2>
              <p>${error ? `Error: ${error}` : 'Luma App ha sido autorizada. Puedes cerrar esta ventana.'}</p>
              </div><script>setTimeout(()=>window.close(),2000)</script></body></html>`

            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
            res.end(html)
            server.close()

            if (error) reject(new Error(`Google rechazó el acceso: ${error}`))
            else if (code) resolve(code)
            else reject(new Error('No se recibió código de autorización.'))
          } catch (e) { reject(e) }
        })

        server.listen(OAUTH_PORT, 'localhost', () => {
          // Abrir la URL de Google en el navegador del sistema
          shell.openExternal(url)
        })

        // Timeout de 3 minutos si el usuario no autoriza
        setTimeout(() => {
          server.close()
          reject(new Error('Tiempo de espera agotado. Intenta de nuevo.'))
        }, 180_000)
      })

      // Intercambiar code por tokens
      const { tokens } = await oauth2.getToken(code)
      oauth2.setCredentials(tokens)

      // Guardar en BD
      const db  = getDb()
      const now = nowISO()
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

      return { ok: true }
    } catch (err: unknown) {
      return { ok: false, error: String(err).replace('Error: ', '') }
    }
  })

  // ── Desconectar (borrar tokens) ─────────────────────────────────────────
  ipcMain.handle('calendar:disconnect', () => {
    try {
      getDb().prepare('DELETE FROM google_oauth_tokens WHERE id = 1').run()
      return { ok: true }
    } catch (err: unknown) { return { ok: false, error: String(err) } }
  })

  // ── Listar calendarios disponibles en la cuenta conectada ──────────────
  ipcMain.handle('calendar:listCalendars', async () => {
    try {
      const oauth2 = buildOAuthClient()
      if (!loadTokens(oauth2)) return { ok: false, error: 'No conectado a Google Calendar.' }

      const cal    = google.calendar({ version: 'v3', auth: oauth2 })
      const resp   = await cal.calendarList.list({ minAccessRole: 'writer' })
      const items  = (resp.data.items ?? []).map(c => ({
        id:      c.id,
        summary: c.summary,
        primary: c.primary ?? false,
        color:   c.backgroundColor,
      }))
      return { ok: true, data: items }
    } catch (err: unknown) { return { ok: false, error: String(err).replace('Error: ', '') } }
  })

  // ── Listar citas locales (con joins de nombres) ─────────────────────────
  ipcMain.handle('calendar:listAppointments', (_e, dateFrom: string, dateTo: string) => {
    try {
      const db   = getDb()
      const rows = db.prepare(`
        SELECT
          a.*,
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
    } catch (err: unknown) { return { ok: false, error: String(err) } }
  })

  // ── Crear cita (local + push a Google si está conectado) ────────────────
  ipcMain.handle('calendar:createAppointment', async (_e, data: {
    employee_id: number | null; client_id: number | null; service_id: number | null
    title: string; description?: string
    start_at: string; end_at: string; all_day?: boolean; color?: string
  }) => {
    try {
      const db  = getDb()
      const now = nowISO()

      // 1. Insertar en BD local
      const result = db.prepare(`
        INSERT INTO appointments
          (employee_id, client_id, service_id, title, description,
           start_at, end_at, all_day, color, sync_status, created_at, updated_at)
        VALUES
          (@employee_id, @client_id, @service_id, @title, @description,
           @start_at, @end_at, @all_day, @color, 'local', @now, @now)
      `).run({
        employee_id:  data.employee_id  ?? null,
        client_id:    data.client_id    ?? null,
        service_id:   data.service_id   ?? null,
        title:        data.title,
        description:  data.description  ?? null,
        start_at:     data.start_at,
        end_at:       data.end_at,
        all_day:      data.all_day ? 1 : 0,
        color:        data.color        ?? null,
        now,
      })

      const appointmentId = result.lastInsertRowid as number

      // 2. Si está conectado, sincronizar ahora
      const tokenRow = db.prepare('SELECT id FROM google_oauth_tokens WHERE id = 1').get()
      if (tokenRow) {
        await pushToGoogle(appointmentId)
      }

      return { ok: true, data: { id: appointmentId } }
    } catch (err: unknown) { return { ok: false, error: String(err).replace('Error: ', '') } }
  })

  // ── Actualizar cita ─────────────────────────────────────────────────────
  ipcMain.handle('calendar:updateAppointment', async (_e, id: number, data: Partial<{
    employee_id: number | null; client_id: number | null; service_id: number | null
    title: string; description: string; start_at: string; end_at: string
    all_day: boolean; color: string
  }>) => {
    try {
      const db  = getDb()
      const cur = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id) as Appointment | undefined
      if (!cur) return { ok: false, error: 'Cita no encontrada.' }

      const now = nowISO()
      db.prepare(`
        UPDATE appointments SET
          employee_id = @employee_id, client_id = @client_id, service_id = @service_id,
          title = @title, description = @description,
          start_at = @start_at, end_at = @end_at,
          all_day = @all_day, color = @color,
          sync_status = 'pending_sync', updated_at = @now
        WHERE id = @id
      `).run({
        employee_id:  data.employee_id  ?? cur.employee_id,
        client_id:    data.client_id    ?? cur.client_id,
        service_id:   data.service_id   ?? cur.service_id,
        title:        data.title        ?? cur.title,
        description:  data.description  ?? cur.description,
        start_at:     data.start_at     ?? cur.start_at,
        end_at:       data.end_at       ?? cur.end_at,
        all_day:      (data.all_day     ?? cur.all_day) ? 1 : 0,
        color:        data.color        ?? cur.color,
        now, id,
      })

      const tokenRow = db.prepare('SELECT id FROM google_oauth_tokens WHERE id = 1').get()
      if (tokenRow) await pushToGoogle(id)

      return { ok: true }
    } catch (err: unknown) { return { ok: false, error: String(err).replace('Error: ', '') } }
  })

  // ── Cancelar/eliminar cita ──────────────────────────────────────────────
  ipcMain.handle('calendar:cancelAppointment', async (_e, id: number) => {
    try {
      const db  = getDb()
      const cur = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id) as Appointment | undefined
      if (!cur) return { ok: false, error: 'Cita no encontrada.' }

      const now = nowISO()
      db.prepare(`
        UPDATE appointments SET sync_status = 'cancelled', updated_at = ? WHERE id = ?
      `).run(now, id)

      // Si tiene ID de evento en Google, eliminarlo
      if (cur.google_event_id) {
        const tokenRow = db.prepare('SELECT id FROM google_oauth_tokens WHERE id = 1').get()
        if (tokenRow) {
          try {
            const oauth2 = buildOAuthClient()
            loadTokens(oauth2)
            const cal      = google.calendar({ version: 'v3', auth: oauth2 })
            const calId    = getSalonCalendarId()
            await cal.events.delete({ calendarId: calId, eventId: cur.google_event_id })
          } catch (_) { /* Silencioso — la cita local ya está cancelada */ }
        }
      }

      return { ok: true }
    } catch (err: unknown) { return { ok: false, error: String(err).replace('Error: ', '') } }
  })

  // ── Sincronización manual ───────────────────────────────────────────────
  ipcMain.handle('calendar:sync', async () => {
    try {
      const db       = getDb()
      const tokenRow = db.prepare('SELECT id FROM google_oauth_tokens WHERE id = 1').get()
      if (!tokenRow) return { ok: false, error: 'No conectado a Google Calendar.' }

      // Citas pendientes de sincronizar
      const pending = db.prepare(`
        SELECT id FROM appointments
        WHERE sync_status = 'pending_sync'
        ORDER BY updated_at ASC
        LIMIT 50
      `).all() as { id: number }[]

      let synced = 0; let errors = 0
      for (const row of pending) {
        try {
          await pushToGoogle(row.id)
          synced++
        } catch (_) { errors++ }
      }

      return { ok: true, data: { synced, errors, total: pending.length } }
    } catch (err: unknown) { return { ok: false, error: String(err).replace('Error: ', '') } }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// pushToGoogle — crea o actualiza un evento en Google Calendar
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

  // Construir el body del evento
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
    colorId: googleColorId(apt.color),
  }

  const now = nowISO()

  if (apt.google_event_id) {
    // Actualizar evento existente
    await cal.events.patch({
      calendarId: calId,
      eventId:    apt.google_event_id,
      requestBody: eventBody,
    })
    db.prepare(`
      UPDATE appointments SET sync_status = 'synced', last_synced_at = ?, updated_at = ? WHERE id = ?
    `).run(now, now, appointmentId)
  } else {
    // Crear evento nuevo
    const resp = await cal.events.insert({
      calendarId:  calId,
      requestBody: eventBody,
    })
    const eventId = resp.data.id ?? null
    db.prepare(`
      UPDATE appointments SET
        google_event_id = ?, sync_status = 'synced', last_synced_at = ?, updated_at = ?
      WHERE id = ?
    `).run(eventId, now, now, appointmentId)
  }
}

// Mapear color hex/nombre al colorId de Google Calendar (1-11)
function googleColorId(color: string | null | undefined): string | undefined {
  const map: Record<string, string> = {
    tomato: '11', flamingo: '4', tangerine: '6', banana: '5',
    sage: '2', basil: '10', peacock: '7', blueberry: '9',
    lavender: '1', grape: '3', graphite: '8',
  }
  if (!color) return undefined
  return map[color.toLowerCase()] ?? undefined
}
