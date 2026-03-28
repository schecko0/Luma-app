import type { IpcMain } from 'electron'
import { getDb } from '../../database/database'
import { nowISO } from '../../database/dbUtils'
import type {
  CashRegister, CashMovement, CashMovementCategory, PaginationParams,
} from '../../renderer/src/types'

export function registerCashRegisterHandlers(ipcMain: IpcMain) {

  // ══════════════════════════════════════════════════════════
  // ESTADO DE LA CAJA
  // ══════════════════════════════════════════════════════════

  // Retorna la caja actualmente abierta (si existe)
  ipcMain.handle('cash:getOpen', () => {
    try {
      const db  = getDb()
      const row = db.prepare(`
        SELECT r.*, u.username AS opened_by_username
        FROM cash_registers r
        JOIN users u ON u.id = r.opened_by
        WHERE r.status = 'open'
        ORDER BY r.opened_at DESC LIMIT 1
      `).get() as CashRegister | undefined
      return { ok: true, data: row ?? null }
    } catch (err: unknown) { return { ok: false, error: String(err) } }
  })

  // ── Abrir caja ────────────────────────────────────────────
  ipcMain.handle('cash:open', (_e, payload: { initial_cash: number; opened_by: number; notes?: string }) => {
    try {
      const db = getDb()

      // Solo puede haber una caja abierta a la vez
      const open = db.prepare("SELECT id FROM cash_registers WHERE status = 'open'").get()
      if (open) return { ok: false, error: 'Ya existe una caja abierta. Ciérrala antes de abrir una nueva.' }

      const result = db.prepare(`
        INSERT INTO cash_registers (opened_by, initial_cash, notes, status, opened_at, created_at)
        VALUES (@opened_by, @initial_cash, @notes, 'open', @opened_at, @created_at)
      `).run({
        opened_by:    payload.opened_by,
        initial_cash: payload.initial_cash,
        notes:        payload.notes ?? null,
        opened_at:    nowISO(),
        created_at:   nowISO(),
      })
      return { ok: true, data: { id: result.lastInsertRowid } }
    } catch (err: unknown) { return { ok: false, error: String(err) } }
  })

  // ── Cerrar caja con cuadre ────────────────────────────────
  ipcMain.handle('cash:close', (_e, payload: {
    register_id: number
    closed_by: number
    final_cash_declared: number
    final_card_declared: number
    final_transfer_declared: number
    notes?: string
  }) => {
    try {
      const db  = getDb()
      const reg = db.prepare("SELECT * FROM cash_registers WHERE id = ? AND status = 'open'").get(payload.register_id) as CashRegister | undefined
      if (!reg) return { ok: false, error: 'Caja no encontrada o ya está cerrada.' }

      // Calcular totales del sistema por tipo de pago
      // (efectivo inicial + movimientos in/out + pagos de facturas)
      const calcTotals = (method: string) => {
        const invoiceTotal = db.prepare(`
          SELECT COALESCE(SUM(ip.amount), 0) as total
          FROM invoice_payments ip
          JOIN invoices i ON i.id = ip.invoice_id
          WHERE ip.payment_method = ?
            AND i.register_id = ?
            AND i.status != 'cancelled'
        `).get(method, payload.register_id) as { total: number }

        const movIn = db.prepare(`
          SELECT COALESCE(SUM(amount), 0) as total FROM cash_movements
          WHERE register_id = ? AND payment_method = ? AND type = 'in'
            AND invoice_id IS NULL
        `).get(payload.register_id, method) as { total: number }

        const movOut = db.prepare(`
          SELECT COALESCE(SUM(amount), 0) as total FROM cash_movements
          WHERE register_id = ? AND payment_method = ? AND type = 'out'
        `).get(payload.register_id, method) as { total: number }

        return invoiceTotal.total + movIn.total - movOut.total
      }

      const systemCash     = reg.initial_cash + calcTotals('cash')
      const systemCard     = calcTotals('card')
      const systemTransfer = calcTotals('transfer')

      const diffCash     = payload.final_cash_declared     - systemCash
      const diffCard     = payload.final_card_declared     - systemCard
      const diffTransfer = payload.final_transfer_declared - systemTransfer

      db.prepare(`
        UPDATE cash_registers SET
          status = 'closed',
          closed_by = @closed_by,
          closed_at = @closed_at,
          final_cash_declared     = @final_cash_declared,
          final_card_declared     = @final_card_declared,
          final_transfer_declared = @final_transfer_declared,
          system_cash     = @system_cash,
          system_card     = @system_card,
          system_transfer = @system_transfer,
          diff_cash     = @diff_cash,
          diff_card     = @diff_card,
          diff_transfer = @diff_transfer,
          notes = @notes
        WHERE id = @id
      `).run({
        closed_by:               payload.closed_by,
        closed_at:               nowISO(),
        final_cash_declared:     payload.final_cash_declared,
        final_card_declared:     payload.final_card_declared,
        final_transfer_declared: payload.final_transfer_declared,
        system_cash:             systemCash,
        system_card:             systemCard,
        system_transfer:         systemTransfer,
        diff_cash:               diffCash,
        diff_card:               diffCard,
        diff_transfer:           diffTransfer,
        notes:                   payload.notes ?? null,
        id:                      payload.register_id,
      })

      return {
        ok: true,
        data: { systemCash, systemCard, systemTransfer, diffCash, diffCard, diffTransfer },
      }
    } catch (err: unknown) { return { ok: false, error: String(err) } }
  })

  // ══════════════════════════════════════════════════════════
  // MOVIMIENTOS
  // ══════════════════════════════════════════════════════════

  // Listar movimientos de una caja
  ipcMain.handle('cash:listMovements', (_e, register_id: number, params: PaginationParams) => {
    try {
      const db = getDb()
      const { page = 1, pageSize = 30 } = params
      const offset = (page - 1) * pageSize

      const rows = db.prepare(`
        SELECT m.*, cat.name AS category_name, u.username AS created_by_username
        FROM cash_movements m
        LEFT JOIN cash_movement_categories cat ON cat.id = m.category_id
        LEFT JOIN users u ON u.id = m.created_by
        WHERE m.register_id = ?
        ORDER BY m.created_at DESC
        LIMIT ? OFFSET ?
      `).all(register_id, pageSize, offset) as CashMovement[]

      const { total } = db.prepare(
        'SELECT COUNT(*) as total FROM cash_movements WHERE register_id = ?'
      ).get(register_id) as { total: number }

      return { ok: true, data: { items: rows, total, page, pageSize } }
    } catch (err: unknown) { return { ok: false, error: String(err) } }
  })

  // Registrar un movimiento manual (entrada o salida)
  ipcMain.handle('cash:addMovement', (_e, data: {
    register_id: number
    category_id: number | null
    type: 'in' | 'out'
    payment_method: 'cash' | 'card' | 'transfer'
    amount: number
    description: string | null
    reference: string | null
    created_by: number
  }) => {
    try {
      const db  = getDb()
      const reg = db.prepare("SELECT id FROM cash_registers WHERE id = ? AND status = 'open'").get(data.register_id)
      if (!reg) return { ok: false, error: 'La caja no está abierta.' }
      if (data.amount <= 0) return { ok: false, error: 'El monto debe ser mayor a cero.' }

      const result = db.prepare(`
        INSERT INTO cash_movements
          (register_id, category_id, type, payment_method, amount, description, reference, created_by, created_at)
        VALUES
          (@register_id, @category_id, @type, @payment_method, @amount, @description, @reference, @created_by, @created_at)
      `).run({ ...data, created_at: nowISO() })

      return { ok: true, data: { id: result.lastInsertRowid } }
    } catch (err: unknown) { return { ok: false, error: String(err) } }
  })

  // Categorías de movimientos
  ipcMain.handle('cash:getCategories', () => {
    try {
      const db   = getDb()
      const rows = db.prepare("SELECT * FROM cash_movement_categories WHERE is_active = 1 ORDER BY name ASC").all() as CashMovementCategory[]
      return { ok: true, data: rows }
    } catch (err: unknown) { return { ok: false, error: String(err) } }
  })

  // ══════════════════════════════════════════════════════════
  // HISTÓRICO DE CAJAS (admin)
  // ══════════════════════════════════════════════════════════
  ipcMain.handle('cash:listRegisters', (_e, params: PaginationParams & { dateFrom?: string; dateTo?: string }) => {
    try {
      const db = getDb()
      const { page = 1, pageSize = 20, dateFrom, dateTo } = params
      const offset  = (page - 1) * pageSize
      const filters: string[] = []
      const args: unknown[]   = []

      if (dateFrom) { filters.push("DATE(r.opened_at) >= DATE(?)"); args.push(dateFrom) }
      if (dateTo)   { filters.push("DATE(r.opened_at) <= DATE(?)"); args.push(dateTo)   }

      const where = filters.length ? `WHERE ${filters.join(' AND ')}` : ''

      const rows = db.prepare(`
        SELECT r.*,
          u1.username AS opened_by_username,
          u2.username AS closed_by_username,
          (SELECT COALESCE(SUM(ip.amount),0)
           FROM invoice_payments ip JOIN invoices i ON i.id = ip.invoice_id
           WHERE i.register_id = r.id AND i.status != 'cancelled') AS total_sales
        FROM cash_registers r
        JOIN users u1 ON u1.id = r.opened_by
        LEFT JOIN users u2 ON u2.id = r.closed_by
        ${where}
        ORDER BY r.opened_at DESC
        LIMIT ? OFFSET ?
      `).all(...args, pageSize, offset) as (CashRegister & { total_sales: number })[]

      const { total } = db.prepare(
        `SELECT COUNT(*) as total FROM cash_registers r ${where}`
      ).get(...args) as { total: number }

      return { ok: true, data: { items: rows, total, page, pageSize } }
    } catch (err: unknown) { return { ok: false, error: String(err) } }
  })

  // Resumen financiero de una caja (para el cuadre visual)
  ipcMain.handle('cash:getSummary', (_e, register_id: number) => {
    try {
      const db = getDb()

      const reg = db.prepare('SELECT * FROM cash_registers WHERE id = ?').get(register_id) as CashRegister | undefined
      if (!reg) return { ok: false, error: 'Caja no encontrada.' }

      // Ventas por método de pago (solo facturas pagadas, no canceladas)
      const salesByMethod = db.prepare(`
        SELECT ip.payment_method, COALESCE(SUM(ip.amount),0) as total
        FROM invoice_payments ip
        JOIN invoices i ON i.id = ip.invoice_id
        WHERE i.register_id = ? AND i.status != 'cancelled'
        GROUP BY ip.payment_method
      `).all(register_id) as { payment_method: string; total: number }[]

      // Movimientos manuales
      const movements = db.prepare(`
        SELECT type, payment_method, COALESCE(SUM(amount),0) as total
        FROM cash_movements
        WHERE register_id = ? AND invoice_id IS NULL
        GROUP BY type, payment_method
      `).all(register_id) as { type: string; payment_method: string; total: number }[]

      // Contadores de facturas
      const invoiceCounts = db.prepare(`
        SELECT status, COUNT(*) as count, COALESCE(SUM(total),0) as total
        FROM invoices WHERE register_id = ?
        GROUP BY status
      `).all(register_id) as { status: string; count: number; total: number }[]

      return { ok: true, data: { register: reg, salesByMethod, movements, invoiceCounts } }
    } catch (err: unknown) { return { ok: false, error: String(err) } }
  })
}
