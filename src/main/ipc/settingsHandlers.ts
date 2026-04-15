import type { IpcMain } from 'electron'
import { dialog, app } from 'electron'
import path from 'path'
import fs from 'fs'
import { getDb } from '../../database/database'
import { nowISO } from '../../database/dbUtils'

export function registerSettingsHandlers(ipcMain: IpcMain) {

  // ── Leer todas las settings como objeto key→value ─────────────────────
  ipcMain.handle('settings:getAll', () => {
    try {
      const db   = getDb()
      const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
      const obj: Record<string, string> = {}
      rows.forEach(r => { obj[r.key] = r.value })
      return { ok: true, data: obj }
    } catch (err: unknown) { return { ok: false, error: String(err) } }
  })

  // ── Guardar una o varias claves ───────────────────────────────────────
  ipcMain.handle('settings:set', (_e, updates: Record<string, string>) => {
    try {
      const db  = getDb()
      const now = nowISO()
      const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)')
      const run  = db.transaction(() => {
        for (const [key, value] of Object.entries(updates)) {
          stmt.run(key, String(value), now)
        }
      })
      run()
      return { ok: true }
    } catch (err: unknown) { return { ok: false, error: String(err) } }
  })

  // ── Cargar Logo del Salón ──────────────────────────────────────────────
  ipcMain.handle('settings:uploadLogo', async () => {
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Seleccionar Logo del Salón',
        filters: [{ name: 'Imágenes', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
        properties: ['openFile']
      })

      if (canceled || filePaths.length === 0) return { ok: false, error: 'Cancelado' }

      const sourcePath = filePaths[0]
      const ext        = path.extname(sourcePath)
      const fileName   = `salon_logo_${Date.now()}${ext}`
      const targetDir  = path.join(app.getPath('userData'), 'uploads')
      
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true })
      
      const targetPath = path.join(targetDir, fileName)
      fs.copyFileSync(sourcePath, targetPath)

      // Guardar en DB la RUTA ABSOLUTA (sin protocolos para leerla luego como base64)
      const db = getDb()
      db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)')
        .run('salon_logo', targetPath, nowISO())

      return { ok: true, data: targetPath }
    } catch (err: unknown) { return { ok: false, error: String(err) } }
  })
}

export function registerDashboardHandlers(ipcMain: IpcMain) {

  ipcMain.handle('dashboard:getStats', (_e, dateFrom?: string, dateTo?: string) => {
    try {
      const db = getDb()

      // Rango por defecto: mes en curso
      const now   = new Date()
      const from  = dateFrom ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
      const to    = dateTo   ?? now.toISOString().split('T')[0]

      // ── 1. Ventas del período (no canceladas) ─────────────────────────
      const sales = db.prepare(`
        SELECT
          COUNT(*)                          AS invoice_count,
          COALESCE(SUM(subtotal),  0)       AS total_subtotal,
          COALESCE(SUM(tax_amount),0)       AS total_tax,
          COALESCE(SUM(total),     0)       AS total_revenue
        FROM invoices
        WHERE status != 'cancelled'
          AND DATE(created_at) >= DATE(?)
          AND DATE(created_at) <= DATE(?)
      `).get(from, to) as { invoice_count: number; total_subtotal: number; total_tax: number; total_revenue: number }

      // ── 2. Ventas por método de pago ──────────────────────────────────
      const salesByMethod = db.prepare(`
        SELECT ip.payment_method, COALESCE(SUM(ip.amount), 0) AS total
        FROM invoice_payments ip
        JOIN invoices i ON i.id = ip.invoice_id
        WHERE i.status != 'cancelled'
          AND DATE(i.created_at) >= DATE(?)
          AND DATE(i.created_at) <= DATE(?)
        GROUP BY ip.payment_method
      `).all(from, to) as { payment_method: string; total: number }[]

      // ── 3. Comisiones del período ─────────────────────────────────────
      const commissions = db.prepare(`
        SELECT COALESCE(SUM(commission_amount), 0) AS total_commissions
        FROM invoice_service_employees ise
        JOIN invoice_services is2 ON is2.id = ise.invoice_service_id
        JOIN invoices i           ON i.id   = is2.invoice_id
        WHERE i.status != 'cancelled'
          AND DATE(i.created_at) >= DATE(?)
          AND DATE(i.created_at) <= DATE(?)
      `).get(from, to) as { total_commissions: number }

      // ── 4. Comisiones por empleado (top 10) ───────────────────────────
      const commissionsByEmployee = db.prepare(`
        SELECT
          e.id,
          (e.first_name || ' ' || e.last_name) AS name,
          e.role,
          e.calendar_color,
          COALESCE(SUM(ise.commission_amount), 0) AS commission_amount,
          COALESCE(SUM(is2.line_total), 0)        AS services_total
        FROM invoice_service_employees ise
        JOIN employees e              ON e.id   = ise.employee_id
        JOIN invoice_services is2     ON is2.id = ise.invoice_service_id
        JOIN invoices i               ON i.id   = is2.invoice_id
        WHERE i.status != 'cancelled'
          AND DATE(i.created_at) >= DATE(?)
          AND DATE(i.created_at) <= DATE(?)
        GROUP BY e.id
        ORDER BY commission_amount DESC
        LIMIT 10
      `).all(from, to) as { id: number; name: string; role: string; calendar_color: string; commission_amount: number; services_total: number }[]

      // ── 5. Servicios más vendidos (top 5) ────────────────────────────
      const topServices = db.prepare(`
        SELECT
          is2.service_name,
          COUNT(*)                          AS count,
          COALESCE(SUM(is2.line_total), 0)  AS revenue
        FROM invoice_services is2
        JOIN invoices i ON i.id = is2.invoice_id
        WHERE i.status != 'cancelled'
          AND DATE(i.created_at) >= DATE(?)
          AND DATE(i.created_at) <= DATE(?)
        GROUP BY is2.service_name
        ORDER BY count DESC
        LIMIT 5
      `).all(from, to) as { service_name: string; count: number; revenue: number }[]

      // ── 6. Facturas canceladas del período ────────────────────────────
      const cancelled = db.prepare(`
        SELECT COUNT(*) AS count FROM invoices
        WHERE status = 'cancelled'
          AND DATE(created_at) >= DATE(?) AND DATE(created_at) <= DATE(?)
      `).get(from, to) as { count: number }

      // ── 7. Facturas con factura oficial pendiente ─────────────────────
      const pendingOfficial = db.prepare(`
        SELECT COUNT(*) AS count FROM invoices
        WHERE requires_official_invoice = 1 AND status = 'paid'
      `).get() as { count: number }

      // ── 8. Clientes únicos atendidos en el período ────────────────────
      const uniqueClients = db.prepare(`
        SELECT COUNT(DISTINCT client_id) AS count FROM invoices
        WHERE status != 'cancelled' AND client_id IS NOT NULL
          AND DATE(created_at) >= DATE(?) AND DATE(created_at) <= DATE(?)
      `).get(from, to) as { count: number }

      // ── 9. Ventas por día (sparkline — últimos 30 días o el rango) ────
      const dailySales = db.prepare(`
        SELECT DATE(created_at) AS day, COALESCE(SUM(total), 0) AS total
        FROM invoices
        WHERE status != 'cancelled'
          AND DATE(created_at) >= DATE(?) AND DATE(created_at) <= DATE(?)
        GROUP BY DATE(created_at)
        ORDER BY day ASC
      `).all(from, to) as { day: string; total: number }[]

      // ── 10. Stock bajo ─────────────────────────────────────────────────
      const lowStockCount = (db.prepare(`
        SELECT COUNT(*) AS count FROM inventory_products
        WHERE is_active = 1 AND quantity <= min_stock AND min_stock > 0
      `).get() as { count: number }).count

      return {
        ok: true,
        data: {
          period: { from, to },
          sales,
          salesByMethod,
          commissions,
          commissionsByEmployee,
          topServices,
          cancelled: cancelled.count,
          pendingOfficial: pendingOfficial.count,
          uniqueClients: uniqueClients.count,
          dailySales,
          lowStockCount,
        },
      }
    } catch (err: unknown) { return { ok: false, error: String(err) } }
  })
}
