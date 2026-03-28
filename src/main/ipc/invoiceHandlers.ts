import type { IpcMain } from 'electron'
import { getDb } from '../../database/database'
import { getNextInvoiceFolio, nowISO, withTransaction } from '../../database/dbUtils'
import type {
  CreateInvoicePayload, Invoice, InvoiceServiceLine,
  InvoicePayment, PaginationParams,
} from '../../renderer/src/types'

export function registerInvoiceHandlers(ipcMain: IpcMain) {

  // ── Crear factura (transacción atómica completa) ───────────────────────
  ipcMain.handle('invoices:create', (_e, payload: CreateInvoicePayload) => {
    try {
      const db = getDb()

      // Leer tasa de IVA global (solo se aplica si apply_tax = true)
      const taxSetting = db.prepare("SELECT value FROM settings WHERE key = 'tax_rate'").get() as { value: string } | undefined
      const globalTax  = parseFloat(taxSetting?.value ?? '0')
      const taxRate    = payload.apply_tax ? globalTax : 0

      const result = withTransaction(() => {
        // 1. Calcular totales
        const subtotal  = payload.services.reduce((s, svc) => s + svc.unit_price * svc.quantity, 0)
        const taxAmount = subtotal * (taxRate / 100)
        const total     = subtotal + taxAmount

        // 2. Validar cuadre de pagos
        const paymentsTotal = payload.payments.reduce((s, p) => s + p.amount, 0)
        if (Math.abs(paymentsTotal - total) > 0.02) {
          throw new Error(
            `El total de pagos ($${paymentsTotal.toFixed(2)}) no coincide con el total de la factura ($${total.toFixed(2)}).`
          )
        }

        // 3. Crear la factura
        const folio = getNextInvoiceFolio()
        const now   = nowISO()

        const invoiceResult = db.prepare(`
          INSERT INTO invoices (
            folio, register_id, client_id, created_by,
            subtotal, tax_rate, tax_amount, total,
            status, requires_official_invoice, notes,
            created_at, updated_at
          ) VALUES (
            @folio, @register_id, @client_id, @created_by,
            @subtotal, @tax_rate, @tax_amount, @total,
            'paid', @requires_official_invoice, @notes,
            @created_at, @updated_at
          )
        `).run({
          folio,
          register_id:               payload.register_id,
          client_id:                 payload.client_id,
          created_by:                1,
          subtotal, tax_rate: taxRate, tax_amount: taxAmount, total,
          requires_official_invoice: payload.requires_official_invoice ? 1 : 0,
          notes: payload.notes,
          created_at: now, updated_at: now,
        })

        const invoiceId = invoiceResult.lastInsertRowid as number

        // 4. Procesar cada servicio
        for (const svc of payload.services) {
          const lineTotal = svc.unit_price * svc.quantity

          // Validar que tenga al menos 1 empleado asignado
          if (svc.employee_ids.length === 0) {
            // Recuperar owner para verificar si al menos hay owner
            const ownerCheck = db.prepare('SELECT owner_employee_id FROM services WHERE id = ?').get(svc.service_id) as { owner_employee_id: number | null } | undefined
            if (!ownerCheck?.owner_employee_id) {
              throw new Error(`El servicio "${svc.service_name}" no tiene empleado ni jefe asignado. Asigna al menos uno.`)
            }
          }

          const svcResult = db.prepare(`
            INSERT INTO invoice_services
              (invoice_id, service_id, service_name, unit_price, quantity, line_total, created_at)
            VALUES
              (@invoice_id, @service_id, @service_name, @unit_price, @quantity, @line_total, @created_at)
          `).run({
            invoice_id: invoiceId, service_id: svc.service_id,
            service_name: svc.service_name, unit_price: svc.unit_price,
            quantity: svc.quantity, line_total: lineTotal, created_at: now,
          })

          const invServiceId = svcResult.lastInsertRowid as number

          // 5. Calcular comisiones de empleados auxiliares
          let totalAuxCommission = 0

          for (const empId of svc.employee_ids) {
            const empRow = db.prepare('SELECT commission_pct, first_name, last_name FROM employees WHERE id = ?').get(empId) as { commission_pct: number; first_name: string; last_name: string } | undefined
            if (!empRow) continue
            // Comisión del auxiliar = line_total * commission_pct / 100
            const commissionAmount = lineTotal * (empRow.commission_pct / 100)
            totalAuxCommission    += commissionAmount

            db.prepare(`
              INSERT INTO invoice_service_employees
                (invoice_service_id, employee_id, commission_pct, work_split_pct, commission_amount, is_owner, created_at)
              VALUES
                (@invoice_service_id, @employee_id, @commission_pct, 100, @commission_amount, 0, @created_at)
            `).run({
              invoice_service_id: invServiceId,
              employee_id:        empId,
              commission_pct:     empRow.commission_pct,
              commission_amount:  commissionAmount,
              created_at:         now,
            })
          }

          // 6. Registrar al jefe del servicio (owner) — recibe el resto
          const serviceRow = db.prepare('SELECT owner_employee_id FROM services WHERE id = ?').get(svc.service_id) as { owner_employee_id: number | null } | undefined
          if (serviceRow?.owner_employee_id) {
            const ownerRow = db.prepare('SELECT commission_pct FROM employees WHERE id = ?').get(serviceRow.owner_employee_id) as { commission_pct: number } | undefined
            const ownerAmount = lineTotal - totalAuxCommission  // El jefe se lleva el resto

            db.prepare(`
              INSERT OR IGNORE INTO invoice_service_employees
                (invoice_service_id, employee_id, commission_pct, work_split_pct, commission_amount, is_owner, created_at)
              VALUES
                (@invoice_service_id, @employee_id, @commission_pct, 100, @commission_amount, 1, @created_at)
            `).run({
              invoice_service_id: invServiceId,
              employee_id:        serviceRow.owner_employee_id,
              commission_pct:     ownerRow?.commission_pct ?? 100,
              commission_amount:  Math.max(0, ownerAmount),
              created_at:         now,
            })
          }
        }

        // 7. Insertar pagos y movimientos de caja
        for (const pmt of payload.payments) {
          db.prepare(`
            INSERT INTO invoice_payments (invoice_id, payment_method, amount, reference, created_at)
            VALUES (@invoice_id, @payment_method, @amount, @reference, @created_at)
          `).run({
            invoice_id: invoiceId, payment_method: pmt.payment_method,
            amount: pmt.amount, reference: pmt.reference ?? null, created_at: now,
          })

          if (payload.register_id) {
            db.prepare(`
              INSERT INTO cash_movements
                (register_id, type, payment_method, amount, description, invoice_id, created_by, created_at)
              VALUES
                (@register_id, 'in', @payment_method, @amount, @description, @invoice_id, 1, @created_at)
            `).run({
              register_id: payload.register_id, payment_method: pmt.payment_method,
              amount: pmt.amount, description: `Venta ${folio}`,
              invoice_id: invoiceId, created_at: now,
            })
          }
        }

        // 8. Actualizar visitas del cliente
        if (payload.client_id) {
          db.prepare(`
            UPDATE clients SET visit_count = visit_count + 1, last_visit_at = @now, updated_at = @now WHERE id = @id
          `).run({ now, id: payload.client_id })
        }

        return { invoiceId, folio, total }
      })

      return { ok: true, data: result }
    } catch (err: unknown) {
      return { ok: false, error: String(err).replace('Error: ', '') }
    }
  })

  // ── Listar facturas ───────────────────────────────────────────────────
  ipcMain.handle('invoices:list', (_e, params: PaginationParams & {
    status?: string; dateFrom?: string; dateTo?: string
    requiresOfficial?: boolean; registerId?: number; clientSearch?: string
  }) => {
    try {
      const db = getDb()
      const { page = 1, pageSize = 20, search = '', status, dateFrom, dateTo,
              requiresOfficial, registerId, clientSearch } = params
      const offset = (page - 1) * pageSize
      const filters: string[] = []
      const args: unknown[]   = []

      if (search) {
        filters.push('(i.folio LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ?)')
        const like = `%${search}%`; args.push(like, like, like)
      }
      if (clientSearch) {
        filters.push('(c.first_name LIKE ? OR c.last_name LIKE ? OR c.phone LIKE ?)')
        const like = `%${clientSearch}%`; args.push(like, like, like)
      }
      if (status)           { filters.push('i.status = ?');                        args.push(status) }
      if (dateFrom)         { filters.push('DATE(i.created_at) >= DATE(?)');       args.push(dateFrom) }
      if (dateTo)           { filters.push('DATE(i.created_at) <= DATE(?)');       args.push(dateTo) }
      if (requiresOfficial) { filters.push('i.requires_official_invoice = 1') }
      if (registerId)       { filters.push('i.register_id = ?');                   args.push(registerId) }

      const where = filters.length ? `WHERE ${filters.join(' AND ')}` : ''

      const rows = db.prepare(`
        SELECT i.*,
          (c.first_name || ' ' || c.last_name) AS client_name,
          u.username AS created_by_username
        FROM invoices i
        LEFT JOIN clients c ON c.id = i.client_id
        LEFT JOIN users u   ON u.id = i.created_by
        ${where}
        ORDER BY i.created_at DESC
        LIMIT ? OFFSET ?
      `).all(...args, pageSize, offset) as Invoice[]

      const { total } = db.prepare(
        `SELECT COUNT(*) as total FROM invoices i LEFT JOIN clients c ON c.id = i.client_id ${where}`
      ).get(...args) as { total: number }

      return { ok: true, data: { items: rows, total, page, pageSize } }
    } catch (err: unknown) { return { ok: false, error: String(err) } }
  })

  // ── Obtener factura completa ──────────────────────────────────────────
  ipcMain.handle('invoices:getById', (_e, id: number) => {
    try {
      const db = getDb()
      const invoice = db.prepare(`
        SELECT i.*, (c.first_name || ' ' || c.last_name) AS client_name, u.username AS created_by_username
        FROM invoices i
        LEFT JOIN clients c ON c.id = i.client_id
        LEFT JOIN users u   ON u.id = i.created_by
        WHERE i.id = ?
      `).get(id) as Invoice | undefined
      if (!invoice) return { ok: false, error: 'Factura no encontrada.' }

      const services = db.prepare('SELECT * FROM invoice_services WHERE invoice_id = ?').all(id) as InvoiceServiceLine[]
      for (const svc of services) {
        ;(svc as InvoiceServiceLine & { employees: unknown[] }).employees = db.prepare(`
          SELECT ise.*, (e.first_name || ' ' || e.last_name) AS employee_name
          FROM invoice_service_employees ise
          JOIN employees e ON e.id = ise.employee_id
          WHERE ise.invoice_service_id = ?
        `).all(svc.id)
      }

      const payments = db.prepare('SELECT * FROM invoice_payments WHERE invoice_id = ?').all(id) as InvoicePayment[]
      return { ok: true, data: { ...invoice, services, payments } }
    } catch (err: unknown) { return { ok: false, error: String(err) } }
  })

  // ── Cancelar factura (NUNCA se elimina) ───────────────────────────────
  ipcMain.handle('invoices:cancel', (_e, id: number, reason: string) => {
    try {
      const db  = getDb()
      const inv = db.prepare('SELECT id, status, register_id FROM invoices WHERE id = ?').get(id) as { id: number; status: string; register_id: number | null } | undefined
      if (!inv)                       return { ok: false, error: 'Factura no encontrada.' }
      if (inv.status === 'cancelled') return { ok: false, error: 'La factura ya está cancelada.' }

      withTransaction(() => {
        const now = nowISO()
        db.prepare(`
          UPDATE invoices SET status = 'cancelled', cancellation_reason = ?,
            cancelled_by = 1, cancelled_at = ?, updated_at = ?
          WHERE id = ?
        `).run(reason || 'Sin motivo', now, now, id)

        if (inv.register_id) {
          const payments = db.prepare('SELECT * FROM invoice_payments WHERE invoice_id = ?').all(id) as InvoicePayment[]
          for (const pmt of payments) {
            db.prepare(`
              INSERT INTO cash_movements
                (register_id, type, payment_method, amount, description, invoice_id, created_by, created_at)
              VALUES (?, 'out', ?, ?, ?, ?, 1, ?)
            `).run(inv.register_id, pmt.payment_method, pmt.amount, `Cancelación #${id}`, id, now)
          }
        }
      })
      return { ok: true }
    } catch (err: unknown) { return { ok: false, error: String(err) } }
  })

  // ── Leer tasa de IVA global ───────────────────────────────────────────
  ipcMain.handle('invoices:getTaxRate', () => {
    try {
      const db  = getDb()
      const row = db.prepare("SELECT value FROM settings WHERE key = 'tax_rate'").get() as { value: string } | undefined
      return { ok: true, data: parseFloat(row?.value ?? '0') }
    } catch (err: unknown) { return { ok: false, error: String(err) } }
  })
}
