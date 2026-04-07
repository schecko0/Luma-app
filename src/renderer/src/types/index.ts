// ─────────────────────────────────────────────────────────────────────────────
// TIPOS DE DOMINIO — Luma App  (actualizado Fase 8 rev.2)
// ─────────────────────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'employee'
export interface AppUser {
  id: number; username: string; role: UserRole
  employee_id: number | null; is_active: boolean
}

export type Theme = 'dark' | 'light' | 'custom'
export interface AppSettings {
  salon_name: string; salon_currency: string
  tax_rate: number; tax_label: string; theme: Theme
  first_run: boolean; google_client_id: string; google_secret: string
}

// ── Empleados ─────────────────────────────────────────────────────────────────
export type GoogleCalendarColor =
  | 'sage' | 'flamingo' | 'tangerine' | 'banana'
  | 'peacock' | 'blueberry' | 'lavender' | 'grape'
  | 'graphite' | 'basil' | 'tomato'

export type EmployeeRole = 'employee' | 'owner'

export interface Employee {
  id: number
  first_name: string; last_name: string
  email: string | null; phone: string | null; phone_country: string
  role: EmployeeRole
  calendar_color: GoogleCalendarColor
  base_salary: number; commission_pct: number
  google_calendar_id: string | null
  hire_date: string | null; notes: string | null; photo_path: string | null
  is_active: boolean
  created_at: string; updated_at: string
  full_name?: string
}

// Historial de cambios de tarifa
export interface EmployeeRateHistory {
  id: number; employee_id: number; changed_by: number
  old_commission: number; new_commission: number
  old_salary: number; new_salary: number
  reason: string | null; changed_at: string
  changed_by_username?: string
}

// ── Servicios ─────────────────────────────────────────────────────────────────
export interface ServiceCategory {
  id: number; name: string; description: string | null
  color: string; icon: string; sort_order: number
  is_active: boolean; created_at: string
}

export interface Service {
  id: number; category_id: number
  name: string; description: string | null
  price: number; duration_min: number
  // Jefe responsable del servicio (Opción A — asignado en catálogo)
  owner_employee_id: number | null
  is_active: boolean; created_at: string; updated_at: string
  // Virtuales (JOIN)
  category_name?: string
  owner_name?: string
}

// ── Clientes ──────────────────────────────────────────────────────────────────
export interface Client {
  id: number; first_name: string; last_name: string
  email: string | null; phone: string | null; phone_country: string
  birthdate: string | null
  tax_id: string | null; tax_legal_name: string | null
  tax_zip_code: string | null; tax_regime: string | null; tax_use: string | null
  notes: string | null
  visit_count: number; last_visit_at: string | null
  photo_path: string | null; is_active: boolean
  created_at: string; updated_at: string
  full_name?: string
}

// ── Inventario ────────────────────────────────────────────────────────────────
export type ContainerType = 'bottle' | 'tube' | 'jar' | 'box' | 'sachet' | 'unit'

export interface InventoryProduct {
  id: number; name: string; supplier: string | null; sku: string | null
  container_type: ContainerType; volume_ml: number | null; pieces: number | null
  cost_price: number; sale_price: number; quantity: number; min_stock: number
  notes: string | null; photo_path: string | null; is_active: boolean
  created_at: string; updated_at: string; low_stock?: boolean
}

// ── Caja Registradora ─────────────────────────────────────────────────────────
export type CashRegisterStatus = 'open' | 'closed'
export interface CashRegister {
  id: number; opened_by: number; closed_by: number | null
  opened_at: string; closed_at: string | null; initial_cash: number
  final_cash_declared: number | null; final_card_declared: number | null
  final_transfer_declared: number | null
  system_cash: number | null; system_card: number | null; system_transfer: number | null
  diff_cash: number | null; diff_card: number | null; diff_transfer: number | null
  notes: string | null; status: CashRegisterStatus; created_at: string
  opened_by_username?: string; closed_by_username?: string
}

export type PaymentMethod = 'cash' | 'card' | 'transfer'
export type MovementType  = 'in' | 'out'

export interface CashMovementCategory {
  id: number; name: string; type: MovementType | 'both'; is_active: boolean
}

export interface CashMovement {
  id: number; register_id: number; category_id: number | null
  type: MovementType; payment_method: PaymentMethod
  amount: number; description: string | null; reference: string | null
  invoice_id: number | null; created_by: number | null; created_at: string
  category_name?: string; created_by_username?: string
}

// ── Facturas / POS ────────────────────────────────────────────────────────────
export type InvoiceStatus = 'pending' | 'paid' | 'cancelled'

export interface Invoice {
  id: number; folio: string; register_id: number | null; client_id: number | null
  created_by: number; subtotal: number; tax_rate: number; tax_amount: number; total: number
  status: InvoiceStatus; requires_official_invoice: boolean
  cancellation_reason: string | null; cancelled_by: number | null; cancelled_at: string | null
  notes: string | null; created_at: string; updated_at: string
  client_name?: string; created_by_username?: string
  payments?: InvoicePayment[]; services?: InvoiceServiceLine[]
}

export interface InvoiceServiceLine {
  id: number; invoice_id: number; service_id: number
  service_name: string; unit_price: number; quantity: number
  line_total: number; notes: string | null; created_at: string
  employees?: InvoiceServiceEmployee[]
}

export interface InvoiceServiceEmployee {
  id: number; invoice_service_id: number; employee_id: number
  commission_pct: number
  work_split_pct: number   // siempre 100 para el nuevo modelo
  commission_amount: number
  is_owner: boolean        // true = este es el jefe que recibe el resto
  created_at: string
  employee_name?: string
}

export interface InvoicePayment {
  id: number; invoice_id: number
  payment_method: PaymentMethod; amount: number
  reference: string | null; created_at: string
}

// Payload para crear una factura desde el POS
export interface CreateInvoicePayload {
  register_id: number | null
  client_id: number | null
  requires_official_invoice: boolean
  apply_tax: boolean           // true = aplicar IVA; false = sin IVA (sin factura oficial)
  notes: string | null
  services: {
    service_id: number; service_name: string
    unit_price: number; quantity: number
    // Solo empleados auxiliares — el jefe se resuelve automáticamente desde service.owner_employee_id
    employee_ids: number[]
  }[]
  payments: {
    payment_method: PaymentMethod; amount: number; reference?: string
  }[]
}

// ── Comisiones ────────────────────────────────────────────────────────────────
export type CommissionRunStatus = 'preview' | 'confirmed'

export interface CommissionRun {
  id: number; executed_by: number
  date_from: string; date_to: string; status: CommissionRunStatus
  total_commissions: number; total_business: number
  notes: string | null; confirmed_at: string | null; created_at: string
  executed_by_username?: string
}

export interface CommissionDetail {
  id: number; run_id: number; employee_id: number
  invoice_id: number; invoice_service_id: number
  employee_name: string; service_name: string
  invoice_folio: string; invoice_date: string
  line_total: number; commission_pct: number
  commission_amount: number; is_owner: boolean
  base_salary_snapshot: number; created_at: string
}

export interface CommissionPreviewEmployee {
  employee_id: number; employee_name: string
  base_salary: number; commission_pct: number
  is_owner: boolean
  total_services_amount: number; commission_amount: number
  details: CommissionPreviewDetail[]
}

export interface CommissionPreviewDetail {
  invoice_folio: string; invoice_date: string; service_name: string
  line_total: number; commission_pct: number
  commission_amount: number; is_owner: boolean
}

export interface CommissionPreview {
  date_from: string; date_to: string
  employees: CommissionPreviewEmployee[]
  total_invoiced: number; total_commissions: number; total_business: number
}

// ── Agenda / Citas ────────────────────────────────────────────────────────────
export type AppointmentSyncStatus = 'local' | 'synced' | 'pending_sync' | 'cancelled'

export interface Appointment {
  id: number; google_event_id: string | null
  employee_id: number | null; client_id: number | null; service_id: number | null
  title: string; description: string | null
  start_at: string; end_at: string; all_day: boolean; color: string | null
  sync_status: AppointmentSyncStatus; last_synced_at: string | null
  created_at: string; updated_at: string
  employee_name?: string; employee_color?: string
  client_name?: string; service_name?: string
}

export interface GoogleSyncQueueItem {
  id: number; appointment_id: number
  operation: 'create' | 'update' | 'delete'
  payload: string | null; attempts: number
  last_error: string | null; created_at: string; next_retry_at: string
}

// ── Genéricos IPC ─────────────────────────────────────────────────────────────
export interface IpcResponse<T = unknown> { ok: boolean; data?: T; error?: string }

export interface PaginatedResult<T> {
  items: T[]; total: number; page: number; pageSize: number
}

export interface PaginationParams {
  page: number; pageSize: number; search?: string
  sortBy?: string; sortDir?: 'asc' | 'desc'
}

// ── Sistema ───────────────────────────────────────────────────────────────────
export interface ErrorLog {
  id: number
  level: string
  message: string
  stack: string | null
  context: string | null
  occurred_at: string
}
