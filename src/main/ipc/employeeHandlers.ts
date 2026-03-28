import type { IpcMain } from 'electron'
import { getDb } from '../../database/database'
import { nowISO } from '../../database/dbUtils'
import type { Employee, PaginationParams } from '../../renderer/src/types'

export function registerEmployeeHandlers(ipcMain: IpcMain) {

  // ── Listar con búsqueda y paginación ──────────────────────────────────
  ipcMain.handle('employees:list', (_e, params: PaginationParams & { includeInactive?: boolean }) => {
    try {
      const db = getDb()
      const { page = 1, pageSize = 20, search = '', includeInactive = false } = params
      const offset       = (page - 1) * pageSize
      const like         = `%${search}%`
      const activeFilter = includeInactive ? '' : 'AND e.is_active = 1'

      const rows = db.prepare(`
        SELECT e.*, (e.first_name || ' ' || e.last_name) AS full_name
        FROM employees e
        WHERE (e.first_name LIKE ? OR e.last_name LIKE ? OR e.email LIKE ?)
          ${activeFilter}
        ORDER BY e.first_name ASC
        LIMIT ? OFFSET ?
      `).all(like, like, like, pageSize, offset) as Employee[]

      const { total } = db.prepare(`
        SELECT COUNT(*) as total FROM employees e
        WHERE (e.first_name LIKE ? OR e.last_name LIKE ? OR e.email LIKE ?)
          ${activeFilter}
      `).get(like, like, like) as { total: number }

      return { ok: true, data: { items: rows, total, page, pageSize } }
    } catch (err: unknown) { return { ok: false, error: String(err) } }
  })

  // ── Obtener por ID ────────────────────────────────────────────────────
  ipcMain.handle('employees:getById', (_e, id: number) => {
    try {
      const db  = getDb()
      const row = db.prepare(`
        SELECT *, (first_name || ' ' || last_name) AS full_name FROM employees WHERE id = ?
      `).get(id) as Employee | undefined
      if (!row) return { ok: false, error: 'Empleado no encontrado' }
      return { ok: true, data: row }
    } catch (err: unknown) { return { ok: false, error: String(err) } }
  })

  // ── Crear empleado ────────────────────────────────────────────────────
  ipcMain.handle('employees:create', (_e, data: Omit<Employee, 'id' | 'created_at' | 'updated_at' | 'full_name'>) => {
    try {
      const db = getDb()

      const duplicate = db.prepare(`
        SELECT id FROM employees WHERE LOWER(first_name) = LOWER(?) AND LOWER(last_name) = LOWER(?)
      `).get(data.first_name.trim(), data.last_name.trim())
      if (duplicate) return { ok: false, error: `Ya existe un empleado con el nombre "${data.first_name} ${data.last_name}".` }

      const roleError = validateRoleRules(data.role, data.base_salary, data.commission_pct)
      if (roleError) return { ok: false, error: roleError }

      const now    = nowISO()
      const result = db.prepare(`
        INSERT INTO employees (
          first_name, last_name, email, phone, phone_country,
          role, calendar_color, base_salary, commission_pct,
          google_calendar_id, hire_date, notes, photo_path,
          is_active, created_at, updated_at
        ) VALUES (
          @first_name, @last_name, @email, @phone, @phone_country,
          @role, @calendar_color, @base_salary, @commission_pct,
          @google_calendar_id, @hire_date, @notes, @photo_path,
          @is_active, @created_at, @updated_at
        )
      `).run({
        ...data,
        first_name: data.first_name.trim(), last_name: data.last_name.trim(),
        is_active: data.is_active ? 1 : 0, created_at: now, updated_at: now,
      })

      return { ok: true, data: { id: result.lastInsertRowid } }
    } catch (err: unknown) { return { ok: false, error: String(err) } }
  })

  // ── Actualizar empleado + historial de tarifas ────────────────────────
  ipcMain.handle('employees:update', (_e, id: number, data: Partial<Omit<Employee, 'id' | 'created_at' | 'full_name'>>, reason?: string) => {
    try {
      const db      = getDb()
      const current = db.prepare('SELECT * FROM employees WHERE id = ?').get(id) as Employee | undefined
      if (!current) return { ok: false, error: 'Empleado no encontrado' }

      const firstName = (data.first_name ?? current.first_name).trim()
      const lastName  = (data.last_name  ?? current.last_name ).trim()

      const duplicate = db.prepare(`
        SELECT id FROM employees WHERE LOWER(first_name) = LOWER(?) AND LOWER(last_name) = LOWER(?) AND id != ?
      `).get(firstName, lastName, id)
      if (duplicate) return { ok: false, error: `Ya existe otro empleado con el nombre "${firstName} ${lastName}".` }

      const role         = data.role          ?? current.role
      const base_salary  = data.base_salary   ?? current.base_salary
      const commission_pct = data.commission_pct ?? current.commission_pct
      const roleError    = validateRoleRules(role, base_salary, commission_pct)
      if (roleError) return { ok: false, error: roleError }

      const now = nowISO()

      // ── Detectar si cambiaron las tarifas y registrar historial ──────
      const salaryChanged     = base_salary    !== current.base_salary
      const commissionChanged = commission_pct !== current.commission_pct

      if (salaryChanged || commissionChanged) {
        db.prepare(`
          INSERT INTO employee_rate_history
            (employee_id, changed_by, old_commission, new_commission, old_salary, new_salary, reason, changed_at)
          VALUES (?, 1, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          current.commission_pct, commission_pct,
          current.base_salary,    base_salary,
          reason ?? null,
          now
        )
      }

      db.prepare(`
        UPDATE employees SET
          first_name = @first_name, last_name = @last_name, email = @email,
          phone = @phone, phone_country = @phone_country, role = @role,
          calendar_color = @calendar_color, base_salary = @base_salary,
          commission_pct = @commission_pct, google_calendar_id = @google_calendar_id,
          hire_date = @hire_date, notes = @notes, photo_path = @photo_path,
          is_active = @is_active, updated_at = @updated_at
        WHERE id = @id
      `).run({
        first_name: firstName, last_name: lastName,
        email:              data.email              ?? current.email,
        phone:              data.phone              ?? current.phone,
        phone_country:      data.phone_country      ?? current.phone_country,
        role,
        calendar_color:     data.calendar_color     ?? current.calendar_color,
        base_salary,
        commission_pct,
        google_calendar_id: data.google_calendar_id ?? current.google_calendar_id,
        hire_date:          data.hire_date          ?? current.hire_date,
        notes:              data.notes              ?? current.notes,
        photo_path:         data.photo_path         ?? current.photo_path,
        is_active:          (data.is_active         ?? current.is_active) ? 1 : 0,
        updated_at:         now,
        id,
      })

      return { ok: true }
    } catch (err: unknown) { return { ok: false, error: String(err) } }
  })

  // ── Historial de tarifas de un empleado ───────────────────────────────
  ipcMain.handle('employees:getRateHistory', (_e, id: number) => {
    try {
      const db   = getDb()
      const rows = db.prepare(`
        SELECT h.*, u.username AS changed_by_username
        FROM employee_rate_history h
        JOIN users u ON u.id = h.changed_by
        WHERE h.employee_id = ?
        ORDER BY h.changed_at DESC
        LIMIT 50
      `).all(id)
      return { ok: true, data: rows }
    } catch (err: unknown) { return { ok: false, error: String(err) } }
  })

  // ── Activar / Desactivar ──────────────────────────────────────────────
  ipcMain.handle('employees:toggle', (_e, id: number) => {
    try {
      const db  = getDb()
      const row = db.prepare('SELECT is_active FROM employees WHERE id = ?').get(id) as { is_active: number } | undefined
      if (!row) return { ok: false, error: 'Empleado no encontrado' }
      const newState = row.is_active === 1 ? 0 : 1
      db.prepare('UPDATE employees SET is_active = ?, updated_at = ? WHERE id = ?').run(newState, nowISO(), id)
      return { ok: true, data: { is_active: newState === 1 } }
    } catch (err: unknown) { return { ok: false, error: String(err) } }
  })

  // ── Todos los activos (selects en POS / agenda) ───────────────────────
  ipcMain.handle('employees:all', () => {
    try {
      const db   = getDb()
      const rows = db.prepare(`
        SELECT id, first_name, last_name,
               (first_name || ' ' || last_name) AS full_name,
               role, calendar_color, commission_pct
        FROM employees WHERE is_active = 1
        ORDER BY first_name ASC
      `).all() as Pick<Employee, 'id' | 'first_name' | 'last_name' | 'full_name' | 'role' | 'calendar_color' | 'commission_pct'>[]
      return { ok: true, data: rows }
    } catch (err: unknown) { return { ok: false, error: String(err) } }
  })
}

// ── Reglas de negocio por rol ─────────────────────────────────────────────────
function validateRoleRules(role: string, base_salary: number, commission_pct: number): string | null {
  if (role === 'employee') {
    if (!base_salary || base_salary <= 0)
      return 'Un empleado debe tener un salario base mayor a $0.'
    if (!commission_pct || commission_pct <= 0)
      return 'Un empleado debe tener un porcentaje de comisión mayor a 0%.'
  }
  if (role === 'owner') {
    if (!commission_pct || commission_pct <= 0)
      return 'El dueño/jefe debe tener un porcentaje de comisión mayor a 0%.'
  }
  return null
}
