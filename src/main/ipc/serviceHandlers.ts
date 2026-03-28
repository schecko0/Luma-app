import type { IpcMain } from 'electron'
import { getDb } from '../../database/database'
import { nowISO } from '../../database/dbUtils'
import type { Service, ServiceCategory, PaginationParams } from '../../renderer/src/types'

export function registerServiceHandlers(ipcMain: IpcMain) {

  // ════════════════════════════════════════════════════════
  // CATEGORÍAS
  // ════════════════════════════════════════════════════════

  ipcMain.handle('categories:list', (_e, includeInactive = false) => {
    try {
      const db = getDb()
      const rows = db.prepare(`
        SELECT * FROM service_categories
        ${includeInactive ? '' : 'WHERE is_active = 1'}
        ORDER BY sort_order ASC, name ASC
      `).all() as ServiceCategory[]
      return { ok: true, data: rows }
    } catch (err: unknown) { return { ok: false, error: String(err) } }
  })

  ipcMain.handle('categories:create', (_e, data: Omit<ServiceCategory, 'id' | 'created_at'>) => {
    try {
      const db = getDb()
      const dup = db.prepare('SELECT id FROM service_categories WHERE LOWER(name) = LOWER(?)').get(data.name.trim())
      if (dup) return { ok: false, error: `Ya existe la categoría "${data.name}".` }
      const result = db.prepare(`
        INSERT INTO service_categories (name, description, color, icon, sort_order, is_active, created_at)
        VALUES (@name, @description, @color, @icon, @sort_order, @is_active, @created_at)
      `).run({ ...data, name: data.name.trim(), is_active: data.is_active ? 1 : 0, created_at: nowISO() })
      return { ok: true, data: { id: result.lastInsertRowid } }
    } catch (err: unknown) { return { ok: false, error: String(err) } }
  })

  ipcMain.handle('categories:update', (_e, id: number, data: Partial<Omit<ServiceCategory, 'id' | 'created_at'>>) => {
    try {
      const db  = getDb()
      const cur = db.prepare('SELECT * FROM service_categories WHERE id = ?').get(id) as ServiceCategory | undefined
      if (!cur) return { ok: false, error: 'Categoría no encontrada.' }
      const name = (data.name ?? cur.name).trim()
      const dup  = db.prepare('SELECT id FROM service_categories WHERE LOWER(name) = LOWER(?) AND id != ?').get(name, id)
      if (dup) return { ok: false, error: `Ya existe otra categoría con el nombre "${name}".` }
      db.prepare(`
        UPDATE service_categories SET
          name = @name, description = @description, color = @color,
          icon = @icon, sort_order = @sort_order, is_active = @is_active
        WHERE id = @id
      `).run({
        name, description: data.description ?? cur.description, color: data.color ?? cur.color,
        icon: data.icon ?? cur.icon, sort_order: data.sort_order ?? cur.sort_order,
        is_active: (data.is_active ?? cur.is_active) ? 1 : 0, id,
      })
      return { ok: true }
    } catch (err: unknown) { return { ok: false, error: String(err) } }
  })

  ipcMain.handle('categories:toggle', (_e, id: number) => {
    try {
      const db  = getDb()
      const row = db.prepare('SELECT is_active FROM service_categories WHERE id = ?').get(id) as { is_active: number } | undefined
      if (!row) return { ok: false, error: 'Categoría no encontrada.' }
      const next = row.is_active === 1 ? 0 : 1
      db.prepare('UPDATE service_categories SET is_active = ? WHERE id = ?').run(next, id)
      return { ok: true, data: { is_active: next === 1 } }
    } catch (err: unknown) { return { ok: false, error: String(err) } }
  })

  // ════════════════════════════════════════════════════════
  // SERVICIOS
  // ════════════════════════════════════════════════════════

  ipcMain.handle('services:list', (_e, params: PaginationParams & { categoryId?: number; includeInactive?: boolean }) => {
    try {
      const db = getDb()
      const { page = 1, pageSize = 20, search = '', categoryId, includeInactive = false } = params
      const offset = (page - 1) * pageSize
      const like   = `%${search}%`
      const filters: string[] = []
      const args: unknown[]   = [like, like]
      if (!includeInactive) filters.push('s.is_active = 1')
      if (categoryId) { filters.push('s.category_id = ?'); args.push(categoryId) }
      const where = `WHERE (s.name LIKE ? OR s.description LIKE ?)${filters.length ? ' AND ' + filters.join(' AND ') : ''}`

      const rows = db.prepare(`
        SELECT s.*,
          c.name AS category_name,
          (e.first_name || ' ' || e.last_name) AS owner_name
        FROM services s
        JOIN service_categories c ON c.id = s.category_id
        LEFT JOIN employees e ON e.id = s.owner_employee_id
        ${where}
        ORDER BY c.sort_order ASC, s.name ASC
        LIMIT ? OFFSET ?
      `).all(...args, pageSize, offset) as Service[]

      const { total } = db.prepare(`
        SELECT COUNT(*) as total FROM services s ${where}
      `).get(...args) as { total: number }

      return { ok: true, data: { items: rows, total, page, pageSize } }
    } catch (err: unknown) { return { ok: false, error: String(err) } }
  })

  ipcMain.handle('services:all', () => {
    try {
      const db   = getDb()
      const rows = db.prepare(`
        SELECT s.id, s.name, s.price, s.duration_min, s.category_id,
               s.owner_employee_id, c.name AS category_name,
               (e.first_name || ' ' || e.last_name) AS owner_name
        FROM services s
        JOIN service_categories c ON c.id = s.category_id
        LEFT JOIN employees e ON e.id = s.owner_employee_id
        WHERE s.is_active = 1
        ORDER BY c.sort_order ASC, s.name ASC
      `).all() as Service[]
      return { ok: true, data: rows }
    } catch (err: unknown) { return { ok: false, error: String(err) } }
  })

  ipcMain.handle('services:create', (_e, data: Omit<Service, 'id' | 'created_at' | 'updated_at' | 'category_name' | 'owner_name'>) => {
    try {
      const db  = getDb()
      const dup = db.prepare('SELECT id FROM services WHERE LOWER(name) = LOWER(?) AND category_id = ?').get(data.name.trim(), data.category_id)
      if (dup) return { ok: false, error: `Ya existe el servicio "${data.name}" en esa categoría.` }
      const now    = nowISO()
      const result = db.prepare(`
        INSERT INTO services
          (category_id, name, description, price, duration_min, owner_employee_id, is_active, created_at, updated_at)
        VALUES
          (@category_id, @name, @description, @price, @duration_min, @owner_employee_id, @is_active, @created_at, @updated_at)
      `).run({
        ...data, name: data.name.trim(),
        owner_employee_id: data.owner_employee_id ?? null,
        is_active: data.is_active ? 1 : 0, created_at: now, updated_at: now,
      })
      return { ok: true, data: { id: result.lastInsertRowid } }
    } catch (err: unknown) { return { ok: false, error: String(err) } }
  })

  ipcMain.handle('services:update', (_e, id: number, data: Partial<Omit<Service, 'id' | 'created_at' | 'category_name' | 'owner_name'>>) => {
    try {
      const db  = getDb()
      const cur = db.prepare('SELECT * FROM services WHERE id = ?').get(id) as Service | undefined
      if (!cur) return { ok: false, error: 'Servicio no encontrado.' }
      const name       = (data.name ?? cur.name).trim()
      const categoryId = data.category_id ?? cur.category_id
      const dup = db.prepare('SELECT id FROM services WHERE LOWER(name) = LOWER(?) AND category_id = ? AND id != ?').get(name, categoryId, id)
      if (dup) return { ok: false, error: `Ya existe el servicio "${name}" en esa categoría.` }
      db.prepare(`
        UPDATE services SET
          category_id = @category_id, name = @name, description = @description,
          price = @price, duration_min = @duration_min,
          owner_employee_id = @owner_employee_id,
          is_active = @is_active, updated_at = @updated_at
        WHERE id = @id
      `).run({
        category_id:      categoryId,
        name,
        description:      data.description      ?? cur.description,
        price:            data.price            ?? cur.price,
        duration_min:     data.duration_min     ?? cur.duration_min,
        owner_employee_id: data.owner_employee_id !== undefined ? (data.owner_employee_id ?? null) : (cur.owner_employee_id ?? null),
        is_active:        (data.is_active        ?? cur.is_active) ? 1 : 0,
        updated_at:       nowISO(),
        id,
      })
      return { ok: true }
    } catch (err: unknown) { return { ok: false, error: String(err) } }
  })

  ipcMain.handle('services:toggle', (_e, id: number) => {
    try {
      const db  = getDb()
      const row = db.prepare('SELECT is_active FROM services WHERE id = ?').get(id) as { is_active: number } | undefined
      if (!row) return { ok: false, error: 'Servicio no encontrado.' }
      const next = row.is_active === 1 ? 0 : 1
      db.prepare('UPDATE services SET is_active = ?, updated_at = ? WHERE id = ?').run(next, nowISO(), id)
      return { ok: true, data: { is_active: next === 1 } }
    } catch (err: unknown) { return { ok: false, error: String(err) } }
  })
}
