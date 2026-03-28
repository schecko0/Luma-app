import type { IpcMain } from 'electron'
import { getDb } from '../../database/database'
import { nowISO, withTransaction } from '../../database/dbUtils'
import type { CommissionPreview, CommissionPreviewEmployee, CommissionPreviewDetail, PaginationParams } from '../../renderer/src/types'

export function registerCommissionHandlers(ipcMain: IpcMain) {

  // ── Preview de comisiones (NO guarda nada) ────────────────────────────
  ipcMain.handle('commissions:preview', (_e, dateFrom: string, dateTo: string) => {
    try {
      const db = getDb()

      // Obtener todas las líneas facturadas (no canceladas) en el rango,
      // con sus splits de empleados
      const lines = db.prepare(`
        SELECT
          i.id          AS invoice_id,
          i.folio       AS invoice_folio,
          i.created_at  AS invoice_date,
          is2.id        AS invoice_service_id,
          is2.service_name,
          is2.line_total,
          ise.employee_id,
          (e.first_name || ' ' || e.last_name) AS employee_name,
          e.commission_pct,
          e.base_salary,
          ise.work_split_pct,
          ise.commission_amount
        FROM invoices i
        JOIN invoice_services is2          ON is2.invoice_id = i.id
        JOIN invoice_service_employees ise ON ise.invoice_service_id = is2.id
        JOIN employees e                   ON e.id = ise.employee_id
        WHERE i.status != 'cancelled'
          AND DATE(i.created_at) >= DATE(?)
          AND DATE(i.created_at) <= DATE(?)
        ORDER BY ise.employee_id, i.created_at ASC
      `).all(dateFrom, dateTo) as {
        invoice_id: number; invoice_folio: string; invoice_date: string
        invoice_service_id: number; service_name: string; line_total: number
        employee_id: number; employee_name: string; commission_pct: number
        base_salary: number; work_split_pct: number; commission_amount: number
      }[]

      // Agrupar por empleado
      const empMap = new Map<number, CommissionPreviewEmployee>()

      for (const line of lines) {
        if (!empMap.has(line.employee_id)) {
          empMap.set(line.employee_id, {
            employee_id:           line.employee_id,
            employee_name:         line.employee_name,
            base_salary:           line.base_salary,
            commission_pct:        line.commission_pct,
            total_services_amount: 0,
            commission_amount:     0,
            details:               [],
          })
        }
        const emp = empMap.get(line.employee_id)!

        const detail: CommissionPreviewDetail = {
          invoice_folio:     line.invoice_folio,
          invoice_date:      line.invoice_date,
          service_name:      line.service_name,
          line_total:        line.line_total,
          work_split_pct:    line.work_split_pct,
          commission_pct:    line.commission_pct,
          commission_amount: line.commission_amount,
        }

        emp.details.push(detail)
        emp.total_services_amount += line.line_total * line.work_split_pct / 100
        emp.commission_amount     += line.commission_amount
      }

      const employees = Array.from(empMap.values())

      // Total facturado en el rango (no canceladas)
      const { total_invoiced } = db.prepare(`
        SELECT COALESCE(SUM(total), 0) AS total_invoiced
        FROM invoices
        WHERE status != 'cancelled'
          AND DATE(created_at) >= DATE(?)
          AND DATE(created_at) <= DATE(?)
      `).get(dateFrom, dateTo) as { total_invoiced: number }

      const total_commissions = employees.reduce((s, e) => s + e.commission_amount, 0)
      const total_business    = total_invoiced - total_commissions

      const preview: CommissionPreview = {
        date_from: dateFrom, date_to: dateTo,
        employees, total_invoiced, total_commissions, total_business,
      }

      return { ok: true, data: preview }
    } catch (err: unknown) { return { ok: false, error: String(err) } }
  })

  // ── Confirmar y guardar cuadre de comisiones ──────────────────────────
  ipcMain.handle('commissions:confirm', (_e, dateFrom: string, dateTo: string, notes?: string) => {
    try {
      const db = getDb()

      // Verificar que no exista un run confirmed para el mismo rango
      const existing = db.prepare(`
        SELECT id FROM commission_runs
        WHERE status = 'confirmed'
          AND date_from = ? AND date_to = ?
      `).get(dateFrom, dateTo)
      if (existing) return { ok: false, error: 'Ya existe un cuadre confirmado para este rango de fechas.' }

      const result = withTransaction(() => {
        const now = nowISO()

        // Re-calcular preview dentro de la transacción para consistencia
        const lines = db.prepare(`
          SELECT
            i.id AS invoice_id, i.folio AS invoice_folio, i.created_at AS invoice_date,
            is2.id AS invoice_service_id, is2.service_name, is2.line_total,
            ise.employee_id, (e.first_name || ' ' || e.last_name) AS employee_name,
            e.commission_pct, e.base_salary, ise.work_split_pct, ise.commission_amount
          FROM invoices i
          JOIN invoice_services is2          ON is2.invoice_id = i.id
          JOIN invoice_service_employees ise ON ise.invoice_service_id = is2.id
          JOIN employees e                   ON e.id = ise.employee_id
          WHERE i.status != 'cancelled'
            AND DATE(i.created_at) >= DATE(?)
            AND DATE(i.created_at) <= DATE(?)
        `).all(dateFrom, dateTo) as {
          invoice_id: number; invoice_folio: string; invoice_date: string
          invoice_service_id: number; service_name: string; line_total: number
          employee_id: number; employee_name: string; commission_pct: number
          base_salary: number; work_split_pct: number; commission_amount: number
        }[]

        const { total_invoiced } = db.prepare(`
          SELECT COALESCE(SUM(total), 0) AS total_invoiced FROM invoices
          WHERE status != 'cancelled' AND DATE(created_at) >= DATE(?) AND DATE(created_at) <= DATE(?)
        `).get(dateFrom, dateTo) as { total_invoiced: number }

        const total_commissions = lines.reduce((s, l) => s + l.commission_amount, 0)
        const total_business    = total_invoiced - total_commissions

        // Crear el run
        const runResult = db.prepare(`
          INSERT INTO commission_runs
            (executed_by, date_from, date_to, status, total_commissions, total_business, notes, confirmed_at, created_at)
          VALUES (1, @date_from, @date_to, 'confirmed', @total_commissions, @total_business, @notes, @now, @now)
        `).run({ date_from: dateFrom, date_to: dateTo, total_commissions, total_business, notes: notes ?? null, now })

        const runId = runResult.lastInsertRowid as number

        // Insertar detalles de auditoría
        const insertDetail = db.prepare(`
          INSERT INTO commission_details (
            run_id, employee_id, invoice_id, invoice_service_id,
            employee_name, service_name, invoice_folio, invoice_date,
            line_total, work_split_pct, commission_pct, commission_amount,
            base_salary_snapshot, created_at
          ) VALUES (
            @run_id, @employee_id, @invoice_id, @invoice_service_id,
            @employee_name, @service_name, @invoice_folio, @invoice_date,
            @line_total, @work_split_pct, @commission_pct, @commission_amount,
            @base_salary_snapshot, @created_at
          )
        `)

        for (const line of lines) {
          insertDetail.run({
            run_id:               runId,
            employee_id:          line.employee_id,
            invoice_id:           line.invoice_id,
            invoice_service_id:   line.invoice_service_id,
            employee_name:        line.employee_name,
            service_name:         line.service_name,
            invoice_folio:        line.invoice_folio,
            invoice_date:         line.invoice_date,
            line_total:           line.line_total,
            work_split_pct:       line.work_split_pct,
            commission_pct:       line.commission_pct,
            commission_amount:    line.commission_amount,
            base_salary_snapshot: line.base_salary,
            created_at:           now,
          })
        }

        return { runId, total_commissions, total_business }
      })

      return { ok: true, data: result }
    } catch (err: unknown) { return { ok: false, error: String(err).replace('Error: ', '') } }
  })

  // ── Historial de runs ─────────────────────────────────────────────────
  ipcMain.handle('commissions:listRuns', (_e, params: PaginationParams) => {
    try {
      const db = getDb()
      const { page = 1, pageSize = 20 } = params
      const offset = (page - 1) * pageSize

      const rows = db.prepare(`
        SELECT r.*, u.username AS executed_by_username
        FROM commission_runs r
        JOIN users u ON u.id = r.executed_by
        WHERE r.status = 'confirmed'
        ORDER BY r.created_at DESC
        LIMIT ? OFFSET ?
      `).all(pageSize, offset)

      const { total } = db.prepare(
        "SELECT COUNT(*) as total FROM commission_runs WHERE status = 'confirmed'"
      ).get() as { total: number }

      return { ok: true, data: { items: rows, total, page, pageSize } }
    } catch (err: unknown) { return { ok: false, error: String(err) } }
  })

  // ── Detalle de un run ─────────────────────────────────────────────────
  ipcMain.handle('commissions:getRunDetail', (_e, runId: number) => {
    try {
      const db   = getDb()
      const run  = db.prepare('SELECT * FROM commission_runs WHERE id = ?').get(runId)
      if (!run) return { ok: false, error: 'Cuadre no encontrado.' }

      const details = db.prepare(`
        SELECT * FROM commission_details WHERE run_id = ? ORDER BY employee_name, invoice_date ASC
      `).all(runId)

      return { ok: true, data: { run, details } }
    } catch (err: unknown) { return { ok: false, error: String(err) } }
  })
}
