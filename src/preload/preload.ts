import { contextBridge, ipcRenderer } from 'electron'
import type {
  Employee, Service, ServiceCategory, Client,
  InventoryProduct, CashMovement, CreateInvoicePayload, PaginationParams,
} from '../renderer/src/types'

export type ElectronAPI = typeof api

const api = {
  // ── APP ───────────────────────────────────────────────────────────────
  ping:         () => ipcRenderer.invoke('app:ping'),
  dbReady:      () => ipcRenderer.invoke('app:dbReady'),
  getLogPath:   () => ipcRenderer.invoke('app:getLogPath'),
  readLogs:     (lines?: number) => ipcRenderer.invoke('app:readLogs', lines),
  clearLogs:    () => ipcRenderer.invoke('app:clearLogs'),
  logError:     (message: string, stack?: string) => ipcRenderer.invoke('app:logError', message, stack),
  getErrorLogs: (page?: number, pageSize?: number) => ipcRenderer.invoke('app:getErrorLogs', page, pageSize),
  exportDb:     () => ipcRenderer.invoke('app:exportDb'),
  importDb:     () => ipcRenderer.invoke('app:importDb'),
  selectImageFile: () => ipcRenderer.invoke('app:selectImageFile'),
  readImageAsBase64: (filePath: string) => ipcRenderer.invoke('app:readImageAsBase64', filePath),

  // ── EMPLEADOS ─────────────────────────────────────────────────────────
  employees: {
    list:           (p: PaginationParams & { includeInactive?: boolean }) => ipcRenderer.invoke('employees:list', p),
    getById:        (id: number) => ipcRenderer.invoke('employees:getById', id),
    create:         (data: Omit<Employee, 'id' | 'created_at' | 'updated_at' | 'full_name'>) => ipcRenderer.invoke('employees:create', data),
    update:         (id: number, data: Partial<Omit<Employee, 'id' | 'created_at' | 'full_name'>>, reason?: string) => ipcRenderer.invoke('employees:update', id, data, reason),
    toggle:         (id: number) => ipcRenderer.invoke('employees:toggle', id),
    all:            () => ipcRenderer.invoke('employees:all'),
    getRateHistory: (id: number) => ipcRenderer.invoke('employees:getRateHistory', id),
  },

  // ── CATEGORÍAS ────────────────────────────────────────────────────────
  categories: {
    list:   (includeInactive?: boolean) => ipcRenderer.invoke('categories:list', includeInactive),
    create: (data: Omit<ServiceCategory, 'id' | 'created_at'>) => ipcRenderer.invoke('categories:create', data),
    update: (id: number, data: Partial<Omit<ServiceCategory, 'id' | 'created_at'>>) => ipcRenderer.invoke('categories:update', id, data),
    toggle: (id: number) => ipcRenderer.invoke('categories:toggle', id),
  },

  // ── SERVICIOS ─────────────────────────────────────────────────────────
  services: {
    list:   (p: PaginationParams & { categoryId?: number; includeInactive?: boolean }) => ipcRenderer.invoke('services:list', p),
    all:    () => ipcRenderer.invoke('services:all'),
    create: (data: Omit<Service, 'id' | 'created_at' | 'updated_at' | 'category_name' | 'owner_name'>) => ipcRenderer.invoke('services:create', data),
    update: (id: number, data: Partial<Omit<Service, 'id' | 'created_at' | 'category_name' | 'owner_name'>>) => ipcRenderer.invoke('services:update', id, data),
    toggle: (id: number) => ipcRenderer.invoke('services:toggle', id),
  },

  // ── CLIENTES ──────────────────────────────────────────────────────────
  clients: {
    list:    (p: PaginationParams & { includeInactive?: boolean }) => ipcRenderer.invoke('clients:list', p),
    getById: (id: number) => ipcRenderer.invoke('clients:getById', id),
    search:  (query: string) => ipcRenderer.invoke('clients:search', query),
    create:  (data: Omit<Client, 'id' | 'created_at' | 'updated_at' | 'full_name' | 'visit_count' | 'last_visit_at'>) => ipcRenderer.invoke('clients:create', data),
    update:  (id: number, data: Partial<Omit<Client, 'id' | 'created_at' | 'full_name'>>) => ipcRenderer.invoke('clients:update', id, data),
    toggle:  (id: number) => ipcRenderer.invoke('clients:toggle', id),
  },

  // ── INVENTARIO ────────────────────────────────────────────────────────
  inventory: {
    list:          (p: PaginationParams & { includeInactive?: boolean; lowStockOnly?: boolean }) => ipcRenderer.invoke('inventory:list', p),
    lowStockCount: () => ipcRenderer.invoke('inventory:lowStockCount'),
    create:        (data: Omit<InventoryProduct, 'id' | 'created_at' | 'updated_at' | 'low_stock'>) => ipcRenderer.invoke('inventory:create', data),
    update:        (id: number, data: Partial<Omit<InventoryProduct, 'id' | 'created_at' | 'low_stock'>>) => ipcRenderer.invoke('inventory:update', id, data),
    adjustStock:   (id: number, delta: number, notes?: string) => ipcRenderer.invoke('inventory:adjustStock', id, delta, notes),
    toggle:        (id: number) => ipcRenderer.invoke('inventory:toggle', id),
  },

  // ── CAJA ──────────────────────────────────────────────────────────────
  cash: {
    getOpen:       () => ipcRenderer.invoke('cash:getOpen'),
    open:          (p: { initial_cash: number; opened_by: number; notes?: string }) => ipcRenderer.invoke('cash:open', p),
    close:         (p: { register_id: number; closed_by: number; final_cash_declared: number; final_card_declared: number; final_transfer_declared: number; notes?: string }) => ipcRenderer.invoke('cash:close', p),
    getSummary:    (register_id: number) => ipcRenderer.invoke('cash:getSummary', register_id),
    listMovements: (register_id: number, p: PaginationParams) => ipcRenderer.invoke('cash:listMovements', register_id, p),
    addMovement:   (data: Omit<CashMovement, 'id' | 'created_at' | 'category_name' | 'created_by_username'>) => ipcRenderer.invoke('cash:addMovement', data),
    getCategories: () => ipcRenderer.invoke('cash:getCategories'),
    listRegisters: (p: PaginationParams & { dateFrom?: string; dateTo?: string }) => ipcRenderer.invoke('cash:listRegisters', p),
  },

  // ── FACTURAS / POS ────────────────────────────────────────────────────
  invoices: {
    create:     (payload: CreateInvoicePayload) => ipcRenderer.invoke('invoices:create', payload),
    list:       (p: PaginationParams & { status?: string; dateFrom?: string; dateTo?: string; requiresOfficial?: boolean; registerId?: number; clientSearch?: string }) => ipcRenderer.invoke('invoices:list', p),
    getById:    (id: number) => ipcRenderer.invoke('invoices:getById', id),
    cancel:     (id: number, reason: string) => ipcRenderer.invoke('invoices:cancel', id, reason),
    getTaxRate: () => ipcRenderer.invoke('invoices:getTaxRate'),
  },

  // ── COMISIONES ────────────────────────────────────────────────────────
  commissions: {
    preview:      (dateFrom: string, dateTo: string) => ipcRenderer.invoke('commissions:preview', dateFrom, dateTo),
    confirm:      (dateFrom: string, dateTo: string, notes?: string) => ipcRenderer.invoke('commissions:confirm', dateFrom, dateTo, notes),
    listRuns:     (p: PaginationParams) => ipcRenderer.invoke('commissions:listRuns', p),
    getRunDetail: (runId: number) => ipcRenderer.invoke('commissions:getRunDetail', runId),
  },

  // ── AJUSTES ───────────────────────────────────────────────────────────
  settings: {
    getAll: () => ipcRenderer.invoke('settings:getAll'),
    set:    (updates: Record<string, string>) => ipcRenderer.invoke('settings:set', updates),
  },

  // ── DASHBOARD ─────────────────────────────────────────────────────────
  dashboard: {
    getStats: (dateFrom?: string, dateTo?: string) => ipcRenderer.invoke('dashboard:getStats', dateFrom, dateTo),
  },

  // ── AGENDA / GOOGLE CALENDAR ──────────────────────────────────────────
  calendar: {
    getStatus:          () => ipcRenderer.invoke('calendar:getStatus'),
    connect:            () => ipcRenderer.invoke('calendar:connect'),
    disconnect:         () => ipcRenderer.invoke('calendar:disconnect'),
    listCalendars:      () => ipcRenderer.invoke('calendar:listCalendars'),
    listAppointments:   (dateFrom: string, dateTo: string) => ipcRenderer.invoke('calendar:listAppointments', dateFrom, dateTo),
    createAppointment:  (data: {
      employee_id: number | null; client_id: number | null; service_id: number | null
      title: string; description?: string
      start_at: string; end_at: string; all_day?: boolean; color?: string
    }) => ipcRenderer.invoke('calendar:createAppointment', data),
    updateAppointment:  (id: number, data: Partial<{
      employee_id: number | null; client_id: number | null; service_id: number | null
      title: string; description: string; start_at: string; end_at: string
      all_day: boolean; color: string
    }>) => ipcRenderer.invoke('calendar:updateAppointment', id, data),
    cancelAppointment:  (id: number) => ipcRenderer.invoke('calendar:cancelAppointment', id),
    sync:               () => ipcRenderer.invoke('calendar:sync'),
    onCalendarUpdated:  (cb: () => void) => {
      const wrapped = () => cb()
      ipcRenderer.on('calendar:updated', wrapped)
      return () => ipcRenderer.removeListener('calendar:updated', wrapped)
    },
  },

  whatsapp: {
    getStatus:        () => ipcRenderer.invoke('whatsapp:getStatus'),
    connect:          () => ipcRenderer.invoke('whatsapp:connect'),
    disconnect:       () => ipcRenderer.invoke('whatsapp:disconnect'),
    preview:          (ids: number[], type: '1d'|'3d'|'7d'|'manual') => ipcRenderer.invoke('whatsapp:preview', ids, type),
    sendBulk:         (ids: number[], type: '1d'|'3d'|'7d'|'manual', forcedIds?: number[]) => ipcRenderer.invoke('whatsapp:sendBulk', ids, type, forcedIds ?? []),
    sendOne:          (id: number, type: '1d'|'3d'|'7d'|'manual')    => ipcRenderer.invoke('whatsapp:sendOne', id, type),
    getLog:           (page?: number, pageSize?: number)              => ipcRenderer.invoke('whatsapp:getLog', page, pageSize),
    getStats:         () => ipcRenderer.invoke('whatsapp:getStats'),
    restartScheduler: () => ipcRenderer.invoke('whatsapp:restartScheduler'),
    sendConfirmation: (appointmentId: number) =>  ipcRenderer.invoke('whatsapp:sendConfirmation', appointmentId),
    onStatus:  (cb: (data: { status: string; phone?: string; error?: string }) => void) => {
      const wrapped = (_: any, data: any) => cb(data)
      ipcRenderer.on('whatsapp:status', wrapped)
      return () => ipcRenderer.removeListener('whatsapp:status', wrapped)
    },
    onQr: (cb: (data: { qr: string }) => void) => {
      const wrapped = (_: any, data: any) => cb(data)
      ipcRenderer.on('whatsapp:qr', wrapped)
      return () => ipcRenderer.removeListener('whatsapp:qr', wrapped)
    },
    onQueueDone: (cb: () => void) => {
      ipcRenderer.on('whatsapp:queueDone', () => cb())
      return () => ipcRenderer.removeListener('whatsapp:queueDone', () => cb())
    },
  },
}

contextBridge.exposeInMainWorld('electronAPI', api)
