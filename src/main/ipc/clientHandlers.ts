import type { IpcMain } from 'electron'
import { getDb } from '../../database/database'
import { nowISO } from '../../database/dbUtils'
import type { Client, PaginationParams } from '../../renderer/src/types'

export function registerClientHandlers(ipcMain: IpcMain) {

  // ── Listar con paginación y búsqueda ─────────────────────────────────
  ipcMain.handle('clients:list', (_e, params: PaginationParams & { includeInactive?: boolean }) => {
    try {
      const db = getDb()
      const { page = 1, pageSize = 20, search = '', includeInactive = false } = params
      const offset       = (page - 1) * pageSize
      const like         = `%${search}%`
      const activeFilter = includeInactive ? '' : 'AND is_active = 1'

      const rows = db.prepare(`
        SELECT *, (first_name || ' ' || last_name) AS full_name
        FROM clients
        WHERE (first_name LIKE ? OR last_name LIKE ? OR phone LIKE ? OR email LIKE ?)
          ${activeFilter}
        ORDER BY last_name ASC, first_name ASC
        LIMIT ? OFFSET ?
      `).all(like, like, like, like, pageSize, offset) as Client[]

      const { total } = db.prepare(`
        SELECT COUNT(*) as total FROM clients
        WHERE (first_name LIKE ? OR last_name LIKE ? OR phone LIKE ? OR email LIKE ?)
          ${activeFilter}
      `).get(like, like, like, like) as { total: number }

      return { ok: true, data: { items: rows, total, page, pageSize } }
    } catch (err: unknown) { return { ok: false, error: String(err) } }
  })

  // ── Obtener por ID ────────────────────────────────────────────────────
  ipcMain.handle('clients:getById', (_e, id: number) => {
    try {
      const db  = getDb()
      const row = db.prepare(`
        SELECT *, (first_name || ' ' || last_name) AS full_name FROM clients WHERE id = ?
      `).get(id) as Client | undefined
      if (!row) return { ok: false, error: 'Cliente no encontrado.' }
      return { ok: true, data: row }
    } catch (err: unknown) { return { ok: false, error: String(err) } }
  })

  // ── Buscar para autocomplete (POS) ─────────────────────────────────────
  ipcMain.handle('clients:search', (_e, query: string) => {
    try {
      const db   = getDb()
      const like = `%${query}%`
      const rows = db.prepare(`
        SELECT id, first_name, last_name,
               (first_name || ' ' || last_name) AS full_name,
               phone, phone_country, email
        FROM clients
        WHERE is_active = 1
          AND (first_name LIKE ? OR last_name LIKE ? OR phone LIKE ?)
        ORDER BY last_name ASC, first_name ASC
        LIMIT 10
      `).all(like, like, like) as Partial<Client>[]
      return { ok: true, data: rows }
    } catch (err: unknown) { return { ok: false, error: String(err) } }
  })

  // ── Crear cliente ─────────────────────────────────────────────────────
  ipcMain.handle('clients:create', (_e, data: Omit<Client, 'id' | 'created_at' | 'updated_at' | 'full_name' | 'visit_count' | 'last_visit_at'>) => {
    try {
      const db = getDb()

      // Validar duplicado por nombre completo
      const dup = db.prepare(`
        SELECT id FROM clients WHERE LOWER(first_name) = LOWER(?) AND LOWER(last_name) = LOWER(?)
      `).get(data.first_name.trim(), data.last_name.trim())
      if (dup) return { ok: false, error: `Ya existe un cliente con el nombre "${data.first_name} ${data.last_name}".` }

      const now    = nowISO()
      const result = db.prepare(`
        INSERT INTO clients (
          first_name, last_name, email, phone, phone_country, birthdate,
          tax_id, tax_legal_name, tax_zip_code, tax_regime, tax_use,
          notes, photo_path, is_active, created_at, updated_at
        ) VALUES (
          @first_name, @last_name, @email, @phone, @phone_country, @birthdate,
          @tax_id, @tax_legal_name, @tax_zip_code, @tax_regime, @tax_use,
          @notes, @photo_path, @is_active, @created_at, @updated_at
        )
      `).run({
        ...data,
        first_name: data.first_name.trim(),
        last_name:  data.last_name.trim(),
        is_active:  data.is_active ? 1 : 0,
        created_at: now,
        updated_at: now,
      })
      return { ok: true, data: { id: result.lastInsertRowid } }
    } catch (err: unknown) { return { ok: false, error: String(err) } }
  })

  // ── Actualizar cliente ────────────────────────────────────────────────
  ipcMain.handle('clients:update', (_e, id: number, data: Partial<Omit<Client, 'id' | 'created_at' | 'full_name'>>) => {
    try {
      const db  = getDb()
      const cur = db.prepare('SELECT * FROM clients WHERE id = ?').get(id) as Client | undefined
      if (!cur) return { ok: false, error: 'Cliente no encontrado.' }

      const first = (data.first_name ?? cur.first_name).trim()
      const last  = (data.last_name  ?? cur.last_name ).trim()
      const dup   = db.prepare(`
        SELECT id FROM clients WHERE LOWER(first_name) = LOWER(?) AND LOWER(last_name) = LOWER(?) AND id != ?
      `).get(first, last, id)
      if (dup) return { ok: false, error: `Ya existe otro cliente con el nombre "${first} ${last}".` }

      db.prepare(`
        UPDATE clients SET
          first_name = @first_name, last_name = @last_name, email = @email,
          phone = @phone, phone_country = @phone_country, birthdate = @birthdate,
          tax_id = @tax_id, tax_legal_name = @tax_legal_name, tax_zip_code = @tax_zip_code,
          tax_regime = @tax_regime, tax_use = @tax_use, notes = @notes,
          photo_path = @photo_path, is_active = @is_active, updated_at = @updated_at
        WHERE id = @id
      `).run({
        first_name:    first,
        last_name:     last,
        email:         data.email         ?? cur.email,
        phone:         data.phone         ?? cur.phone,
        phone_country: data.phone_country ?? cur.phone_country,
        birthdate:     data.birthdate     ?? cur.birthdate,
        tax_id:        data.tax_id        ?? cur.tax_id,
        tax_legal_name: data.tax_legal_name ?? cur.tax_legal_name,
        tax_zip_code:  data.tax_zip_code  ?? cur.tax_zip_code,
        tax_regime:    data.tax_regime    ?? cur.tax_regime,
        tax_use:       data.tax_use       ?? cur.tax_use,
        notes:         data.notes         ?? cur.notes,
        photo_path:    data.photo_path    ?? cur.photo_path,
        is_active:     (data.is_active    ?? cur.is_active) ? 1 : 0,
        updated_at:    nowISO(),
        id,
      })
      return { ok: true }
    } catch (err: unknown) { return { ok: false, error: String(err) } }
  })

  // ── Activar / Desactivar ──────────────────────────────────────────────
  ipcMain.handle('clients:toggle', (_e, id: number) => {
    try {
      const db  = getDb()
      const row = db.prepare('SELECT is_active FROM clients WHERE id = ?').get(id) as { is_active: number } | undefined
      if (!row) return { ok: false, error: 'Cliente no encontrado.' }
      const next = row.is_active === 1 ? 0 : 1
      db.prepare('UPDATE clients SET is_active = ?, updated_at = ? WHERE id = ?').run(next, nowISO(), id)
      return { ok: true, data: { is_active: next === 1 } }
    } catch (err: unknown) { return { ok: false, error: String(err) } }
  })
}
