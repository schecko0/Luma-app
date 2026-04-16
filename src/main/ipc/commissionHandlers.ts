import type { IpcMain } from 'electron'
import { getDb } from '../../database/database'
import { nowISO, withTransaction } from '../../database/dbUtils'
import type { CommissionPreview, CommissionPreviewEmployee, CommissionPreviewDetail, PaginationParams } from '../../renderer/src/types'

export function registerCommissionHandlers(ipcMain: IpcMain) {

  // ── Preview de comisiones (NO guarda nada) ────────────────────────────
  ipcMain.handle('commissions:preview', (_e, dateFrom: string, dateTo: string, includeSalaries: boolean = false) => {
    try {
      const db = getDb()

      // ── Líneas pendientes (nunca comisionadas) ──────────────────────
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
          ise.commission_amount,
          ise.is_owner
        FROM invoices i
        JOIN invoice_services is2          ON is2.invoice_id = i.id
        JOIN invoice_service_employees ise ON ise.invoice_service_id = is2.id
        JOIN employees e                   ON e.id = ise.employee_id
        WHERE i.status != 'cancelled'
          AND ise.commission_run_id IS NULL
          AND DATE(i.created_at) >= DATE(?)
          AND DATE(i.created_at) <= DATE(?)
        ORDER BY ise.employee_id, i.created_at ASC
      `).all(dateFrom, dateTo) as {
        invoice_id: number; invoice_folio: string; invoice_date: string
        invoice_service_id: number; service_name: string; line_total: number
        employee_id: number; employee_name: string; commission_pct: number
        base_salary: number; work_split_pct: number; commission_amount: number
        is_owner: number
      }[]

      // ── Contar líneas ya comisionadas en el mismo rango (informativo) ─
      const { already_commissioned } = db.prepare(`
        SELECT COUNT(*) AS already_commissioned
        FROM invoices i
        JOIN invoice_services is2          ON is2.invoice_id = i.id
        JOIN invoice_service_employees ise ON ise.invoice_service_id = is2.id
        WHERE i.status != 'cancelled'
          AND ise.commission_run_id IS NOT NULL
          AND DATE(i.created_at) >= DATE(?)
          AND DATE(i.created_at) <= DATE(?)
      `).get(dateFrom, dateTo) as { already_commissioned: number }

      // ── Agrupar por empleado ────────────────────────────────────────
      const empMap = new Map<number, CommissionPreviewEmployee>()

      for (const line of lines) {
        if (!empMap.has(line.employee_id)) {
          empMap.set(line.employee_id, {
            employee_id:           line.employee_id,
            employee_name:         line.employee_name,
            base_salary:           line.base_salary,
            commission_pct:        line.commission_pct,
            is_owner:              line.is_owner === 1,
            total_services_amount: 0,
            commission_amount:     0,
            salary_amount:         includeSalaries ? line.base_salary : 0,
            total_to_pay:          0, // se calcula al final
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
          is_owner:          line.is_owner === 1,
        }

        emp.details.push(detail)
        emp.total_services_amount += line.line_total * line.work_split_pct / 100
        emp.commission_amount     += line.commission_amount
      }

      // ── Calcular totales por empleado ──────────────────────────────
      const employees = Array.from(empMap.values())
      for (const emp of employees) {
        emp.total_to_pay = emp.commission_amount + emp.salary_amount
      }

      // ── Total facturado en el rango — solo líneas pendientes ────────
      const { total_invoiced } = db.prepare(`
        SELECT COALESCE(SUM(total), 0) AS total_invoiced
        FROM invoices
        WHERE id IN (
          SELECT DISTINCT i.id
          FROM invoices i
          JOIN invoice_services is2          ON is2.invoice_id = i.id
          JOIN invoice_service_employees ise ON ise.invoice_service_id = is2.id
          WHERE i.status != 'cancelled'
            AND ise.commission_run_id IS NULL
            AND DATE(i.created_at) >= DATE(?)
            AND DATE(i.created_at) <= DATE(?)
        )
      `).get(dateFrom, dateTo) as { total_invoiced: number }

      const total_commissions = employees.reduce((s, e) => s + e.commission_amount, 0)
      const total_salaries    = employees.reduce((s, e) => s + e.salary_amount, 0)
      const total_to_pay      = total_commissions + total_salaries
      const total_business    = total_invoiced - total_to_pay

      const preview: CommissionPreview = {
        date_from: dateFrom, date_to: dateTo,
        employees, total_invoiced, total_commissions, total_business,
        total_salaries, total_to_pay, include_salaries: includeSalaries,
        already_commissioned,
      }

      return { ok: true, data: preview }
    } catch (err: unknown) { return { ok: false, error: String(err) } }
  })

  // ── Confirmar y guardar cuadre de comisiones ──────────────────────────
  ipcMain.handle('commissions:confirm', (_e, dateFrom: string, dateTo: string, notes?: string, includeSalaries: boolean = false) => {
    try {
      const db = getDb()

      const result = withTransaction(() => {
        const now = nowISO()

        const lines = db.prepare(`
          SELECT
            i.id AS invoice_id, i.folio AS invoice_folio, i.created_at AS invoice_date,
            is2.id AS invoice_service_id, is2.service_name, is2.line_total,
            ise.id AS ise_id,
            ise.employee_id, (e.first_name || ' ' || e.last_name) AS employee_name,
            e.commission_pct, e.base_salary, ise.work_split_pct, ise.commission_amount,
            ise.is_owner
          FROM invoices i
          JOIN invoice_services is2          ON is2.invoice_id = i.id
          JOIN invoice_service_employees ise ON ise.invoice_service_id = is2.id
          JOIN employees e                   ON e.id = ise.employee_id
          WHERE i.status != 'cancelled'
            AND ise.commission_run_id IS NULL
            AND DATE(i.created_at) >= DATE(?)
            AND DATE(i.created_at) <= DATE(?)
        `).all(dateFrom, dateTo) as {
          invoice_id: number; invoice_folio: string; invoice_date: string
          invoice_service_id: number; service_name: string; line_total: number
          ise_id: number
          employee_id: number; employee_name: string; commission_pct: number
          base_salary: number; work_split_pct: number; commission_amount: number
          is_owner: number
        }[]

        if (lines.length === 0) {
          throw new Error('No hay líneas pendientes de comisionar en este rango de fechas.')
        }

        const { total_invoiced } = db.prepare(`
          SELECT COALESCE(SUM(total), 0) AS total_invoiced
          FROM invoices
          WHERE id IN (
            SELECT DISTINCT i.id
            FROM invoices i
            JOIN invoice_services is2          ON is2.invoice_id = i.id
            JOIN invoice_service_employees ise ON ise.invoice_service_id = is2.id
            WHERE i.status != 'cancelled'
              AND ise.commission_run_id IS NULL
              AND DATE(i.created_at) >= DATE(?)
              AND DATE(i.created_at) <= DATE(?)
          )
        `).get(dateFrom, dateTo) as { total_invoiced: number }

        // Identificar empleados únicos para los sueldos
        const empIds = Array.from(new Set(lines.map(l => l.employee_id)))
        let total_salaries = 0
        if (includeSalaries) {
          for (const id of empIds) {
            const row = db.prepare('SELECT base_salary FROM employees WHERE id = ?').get(id) as { base_salary: number }
            total_salaries += row.base_salary
          }
        }

        const total_commissions = lines.reduce((s, l) => s + l.commission_amount, 0)
        const total_to_pay      = total_commissions + total_salaries
        const total_business    = total_invoiced - total_to_pay

        // 1. Crear el commission_run
        const runResult = db.prepare(`
          INSERT INTO commission_runs
            (executed_by, date_from, date_to, status, total_commissions, total_business, notes, confirmed_at, created_at)
          VALUES (1, @date_from, @date_to, 'confirmed', @total_to_pay, @total_business, @notes, @now, @now)
        `).run({ date_from: dateFrom, date_to: dateTo, total_to_pay, total_business, notes: notes ?? null, now })

        const runId = runResult.lastInsertRowid as number

        // 2. Insertar snapshot de auditoría en commission_details
        const insertDetail = db.prepare(`
          INSERT INTO commission_details (
            run_id, employee_id, invoice_id, invoice_service_id,
            employee_name, service_name, invoice_folio, invoice_date,
            line_total, work_split_pct, commission_pct, commission_amount,
            is_owner, base_salary_snapshot, created_at
          ) VALUES (
            @run_id, @employee_id, @invoice_id, @invoice_service_id,
            @employee_name, @service_name, @invoice_folio, @invoice_date,
            @line_total, @work_split_pct, @commission_pct, @commission_amount,
            @is_owner, @base_salary_snapshot, @created_at
          )
        `)

        // 3. Marcar cada línea con el run_id
        const markLine = db.prepare(`
          UPDATE invoice_service_employees
          SET commission_run_id = ?
          WHERE id = ?
        `)

        const processedEmps = new Set<number>()

        for (const line of lines) {
          // El snapshot del sueldo base solo lo guardamos con el monto REAL pagado en este corte
          // Si includeSalaries es false para este corte, el snapshot será 0.
          // Solo guardamos el sueldo base en la primera línea del empleado para no duplicar en el historial
          const salaryToSave = (includeSalaries && !processedEmps.has(line.employee_id)) ? line.base_salary : 0
          processedEmps.add(line.employee_id)

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
            is_owner:             line.is_owner,
            base_salary_snapshot: salaryToSave,
            created_at:           now,
          })

          markLine.run(runId, line.ise_id)
        }

        return { runId, total_to_pay, total_business, lines_processed: lines.length }
      })

      return { ok: true, data: result }
    } catch (err: unknown) { return { ok: false, error: String(err).replace('Error: ', '') } }
  })

  // ── Historial de runs ─────────────────────────────────────────────────
  ipcMain.handle('commissions:listRuns', (_e, params: PaginationParams & { employeeId?: number; dateFrom?: string; dateTo?: string }) => {
    try {
      const db = getDb()
      const { page = 1, pageSize = 20, employeeId, dateFrom, dateTo } = params
      const offset = (page - 1) * pageSize

      const filters: string[] = ["r.status = 'confirmed'"]
      const args: any[] = []

      if (employeeId) {
        filters.push(`EXISTS (SELECT 1 FROM commission_details cd WHERE cd.run_id = r.id AND cd.employee_id = ?)`)
        args.push(employeeId)
      }
      if (dateFrom) {
        filters.push("DATE(r.date_from) >= DATE(?)")
        args.push(dateFrom)
      }
      if (dateTo) {
        filters.push("DATE(r.date_to) <= DATE(?)")
        args.push(dateTo)
      }

      const where = filters.length ? `WHERE ${filters.join(' AND ')}` : ''

      const rows = db.prepare(`
        SELECT r.*, u.username AS executed_by_username
        FROM commission_runs r
        JOIN users u ON u.id = r.executed_by
        ${where}
        ORDER BY r.created_at DESC
        LIMIT ? OFFSET ?
      `).all(...args, pageSize, offset)

      const { total } = db.prepare(
        `SELECT COUNT(*) as total FROM commission_runs r ${where}`
      ).get(...args) as { total: number }

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
