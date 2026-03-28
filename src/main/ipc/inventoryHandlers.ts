import type { IpcMain } from 'electron'
import { getDb } from '../../database/database'
import { nowISO } from '../../database/dbUtils'
import type { InventoryProduct, PaginationParams } from '../../renderer/src/types'

export function registerInventoryHandlers(ipcMain: IpcMain) {

  // ── Listar con paginación, búsqueda y filtro de stock bajo ────────────
  ipcMain.handle('inventory:list', (_e, params: PaginationParams & {
    includeInactive?: boolean
    lowStockOnly?: boolean
  }) => {
    try {
      const db = getDb()
      const { page = 1, pageSize = 20, search = '', includeInactive = false, lowStockOnly = false } = params
      const offset = (page - 1) * pageSize
      const like   = `%${search}%`

      const filters: string[] = ['(name LIKE ? OR supplier LIKE ? OR sku LIKE ?)']
      const args: unknown[]   = [like, like, like]

      if (!includeInactive) filters.push('is_active = 1')
      if (lowStockOnly)     filters.push('quantity <= min_stock')

      const where = `WHERE ${filters.join(' AND ')}`

      const rows = db.prepare(`
        SELECT *, (quantity <= min_stock) AS low_stock
        FROM inventory_products ${where}
        ORDER BY name ASC
        LIMIT ? OFFSET ?
      `).all(...args, pageSize, offset) as InventoryProduct[]

      const { total } = db.prepare(`
        SELECT COUNT(*) as total FROM inventory_products ${where}
      `).get(...args) as { total: number }

      return { ok: true, data: { items: rows, total, page, pageSize } }
    } catch (err: unknown) { return { ok: false, error: String(err) } }
  })

  // ── Resumen de stock bajo (para badge en sidebar) ──────────────────────
  ipcMain.handle('inventory:lowStockCount', () => {
    try {
      const db = getDb()
      const { count } = db.prepare(`
        SELECT COUNT(*) as count FROM inventory_products
        WHERE is_active = 1 AND quantity <= min_stock AND min_stock > 0
      `).get() as { count: number }
      return { ok: true, data: count }
    } catch (err: unknown) { return { ok: false, error: String(err) } }
  })

  // ── Crear producto ────────────────────────────────────────────────────
  ipcMain.handle('inventory:create', (_e, data: Omit<InventoryProduct, 'id' | 'created_at' | 'updated_at' | 'low_stock'>) => {
    try {
      const db  = getDb()
      const dup = db.prepare('SELECT id FROM inventory_products WHERE LOWER(name) = LOWER(?)').get(data.name.trim())
      if (dup) return { ok: false, error: `Ya existe un producto con el nombre "${data.name}".` }

      const now    = nowISO()
      const result = db.prepare(`
        INSERT INTO inventory_products (
          name, supplier, sku, container_type, volume_ml, pieces,
          cost_price, sale_price, quantity, min_stock,
          notes, photo_path, is_active, created_at, updated_at
        ) VALUES (
          @name, @supplier, @sku, @container_type, @volume_ml, @pieces,
          @cost_price, @sale_price, @quantity, @min_stock,
          @notes, @photo_path, @is_active, @created_at, @updated_at
        )
      `).run({ ...data, name: data.name.trim(), is_active: data.is_active ? 1 : 0, created_at: now, updated_at: now })
      return { ok: true, data: { id: result.lastInsertRowid } }
    } catch (err: unknown) { return { ok: false, error: String(err) } }
  })

  // ── Actualizar producto ───────────────────────────────────────────────
  ipcMain.handle('inventory:update', (_e, id: number, data: Partial<Omit<InventoryProduct, 'id' | 'created_at' | 'low_stock'>>) => {
    try {
      const db  = getDb()
      const cur = db.prepare('SELECT * FROM inventory_products WHERE id = ?').get(id) as InventoryProduct | undefined
      if (!cur) return { ok: false, error: 'Producto no encontrado.' }

      const name = (data.name ?? cur.name).trim()
      const dup  = db.prepare('SELECT id FROM inventory_products WHERE LOWER(name) = LOWER(?) AND id != ?').get(name, id)
      if (dup) return { ok: false, error: `Ya existe otro producto con el nombre "${name}".` }

      db.prepare(`
        UPDATE inventory_products SET
          name = @name, supplier = @supplier, sku = @sku,
          container_type = @container_type, volume_ml = @volume_ml, pieces = @pieces,
          cost_price = @cost_price, sale_price = @sale_price,
          quantity = @quantity, min_stock = @min_stock,
          notes = @notes, photo_path = @photo_path,
          is_active = @is_active, updated_at = @updated_at
        WHERE id = @id
      `).run({
        name,
        supplier:       data.supplier       ?? cur.supplier,
        sku:            data.sku            ?? cur.sku,
        container_type: data.container_type ?? cur.container_type,
        volume_ml:      data.volume_ml      ?? cur.volume_ml,
        pieces:         data.pieces         ?? cur.pieces,
        cost_price:     data.cost_price     ?? cur.cost_price,
        sale_price:     data.sale_price     ?? cur.sale_price,
        quantity:       data.quantity       ?? cur.quantity,
        min_stock:      data.min_stock      ?? cur.min_stock,
        notes:          data.notes          ?? cur.notes,
        photo_path:     data.photo_path     ?? cur.photo_path,
        is_active:      (data.is_active     ?? cur.is_active) ? 1 : 0,
        updated_at:     nowISO(),
        id,
      })
      return { ok: true }
    } catch (err: unknown) { return { ok: false, error: String(err) } }
  })

  // ── Ajuste rápido de cantidad (entrada/salida de stock) ───────────────
  ipcMain.handle('inventory:adjustStock', (_e, id: number, delta: number, notes?: string) => {
    try {
      const db  = getDb()
      const cur = db.prepare('SELECT quantity FROM inventory_products WHERE id = ?').get(id) as { quantity: number } | undefined
      if (!cur) return { ok: false, error: 'Producto no encontrado.' }

      const newQty = cur.quantity + delta
      if (newQty < 0) return { ok: false, error: 'El stock no puede quedar negativo.' }

      db.prepare('UPDATE inventory_products SET quantity = ?, notes = COALESCE(?, notes), updated_at = ? WHERE id = ?')
        .run(newQty, notes ?? null, nowISO(), id)
      return { ok: true, data: { quantity: newQty } }
    } catch (err: unknown) { return { ok: false, error: String(err) } }
  })

  // ── Activar / Desactivar ──────────────────────────────────────────────
  ipcMain.handle('inventory:toggle', (_e, id: number) => {
    try {
      const db  = getDb()
      const row = db.prepare('SELECT is_active FROM inventory_products WHERE id = ?').get(id) as { is_active: number } | undefined
      if (!row) return { ok: false, error: 'Producto no encontrado.' }
      const next = row.is_active === 1 ? 0 : 1
      db.prepare('UPDATE inventory_products SET is_active = ?, updated_at = ? WHERE id = ?').run(next, nowISO(), id)
      return { ok: true, data: { is_active: next === 1 } }
    } catch (err: unknown) { return { ok: false, error: String(err) } }
  })
}
