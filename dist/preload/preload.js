"use strict";
const electron = require("electron");
const api = {
  // ── APP ───────────────────────────────────────────────────────────────
  ping: () => electron.ipcRenderer.invoke("app:ping"),
  dbReady: () => electron.ipcRenderer.invoke("app:dbReady"),
  getLogPath: () => electron.ipcRenderer.invoke("app:getLogPath"),
  readLogs: (lines) => electron.ipcRenderer.invoke("app:readLogs", lines),
  logError: (message, stack) => electron.ipcRenderer.invoke("app:logError", message, stack),
  // ── EMPLEADOS ─────────────────────────────────────────────────────────
  employees: {
    list: (p) => electron.ipcRenderer.invoke("employees:list", p),
    getById: (id) => electron.ipcRenderer.invoke("employees:getById", id),
    create: (data) => electron.ipcRenderer.invoke("employees:create", data),
    update: (id, data, reason) => electron.ipcRenderer.invoke("employees:update", id, data, reason),
    toggle: (id) => electron.ipcRenderer.invoke("employees:toggle", id),
    all: () => electron.ipcRenderer.invoke("employees:all"),
    getRateHistory: (id) => electron.ipcRenderer.invoke("employees:getRateHistory", id)
  },
  // ── CATEGORÍAS ────────────────────────────────────────────────────────
  categories: {
    list: (includeInactive) => electron.ipcRenderer.invoke("categories:list", includeInactive),
    create: (data) => electron.ipcRenderer.invoke("categories:create", data),
    update: (id, data) => electron.ipcRenderer.invoke("categories:update", id, data),
    toggle: (id) => electron.ipcRenderer.invoke("categories:toggle", id)
  },
  // ── SERVICIOS ─────────────────────────────────────────────────────────
  services: {
    list: (p) => electron.ipcRenderer.invoke("services:list", p),
    all: () => electron.ipcRenderer.invoke("services:all"),
    create: (data) => electron.ipcRenderer.invoke("services:create", data),
    update: (id, data) => electron.ipcRenderer.invoke("services:update", id, data),
    toggle: (id) => electron.ipcRenderer.invoke("services:toggle", id)
  },
  // ── CLIENTES ──────────────────────────────────────────────────────────
  clients: {
    list: (p) => electron.ipcRenderer.invoke("clients:list", p),
    getById: (id) => electron.ipcRenderer.invoke("clients:getById", id),
    search: (query) => electron.ipcRenderer.invoke("clients:search", query),
    create: (data) => electron.ipcRenderer.invoke("clients:create", data),
    update: (id, data) => electron.ipcRenderer.invoke("clients:update", id, data),
    toggle: (id) => electron.ipcRenderer.invoke("clients:toggle", id)
  },
  // ── INVENTARIO ────────────────────────────────────────────────────────
  inventory: {
    list: (p) => electron.ipcRenderer.invoke("inventory:list", p),
    lowStockCount: () => electron.ipcRenderer.invoke("inventory:lowStockCount"),
    create: (data) => electron.ipcRenderer.invoke("inventory:create", data),
    update: (id, data) => electron.ipcRenderer.invoke("inventory:update", id, data),
    adjustStock: (id, delta, notes) => electron.ipcRenderer.invoke("inventory:adjustStock", id, delta, notes),
    toggle: (id) => electron.ipcRenderer.invoke("inventory:toggle", id)
  },
  // ── CAJA ──────────────────────────────────────────────────────────────
  cash: {
    getOpen: () => electron.ipcRenderer.invoke("cash:getOpen"),
    open: (p) => electron.ipcRenderer.invoke("cash:open", p),
    close: (p) => electron.ipcRenderer.invoke("cash:close", p),
    getSummary: (register_id) => electron.ipcRenderer.invoke("cash:getSummary", register_id),
    listMovements: (register_id, p) => electron.ipcRenderer.invoke("cash:listMovements", register_id, p),
    addMovement: (data) => electron.ipcRenderer.invoke("cash:addMovement", data),
    getCategories: () => electron.ipcRenderer.invoke("cash:getCategories"),
    listRegisters: (p) => electron.ipcRenderer.invoke("cash:listRegisters", p)
  },
  // ── FACTURAS / POS ────────────────────────────────────────────────────
  invoices: {
    create: (payload) => electron.ipcRenderer.invoke("invoices:create", payload),
    list: (p) => electron.ipcRenderer.invoke("invoices:list", p),
    getById: (id) => electron.ipcRenderer.invoke("invoices:getById", id),
    cancel: (id, reason) => electron.ipcRenderer.invoke("invoices:cancel", id, reason),
    getTaxRate: () => electron.ipcRenderer.invoke("invoices:getTaxRate")
  },
  // ── COMISIONES ────────────────────────────────────────────────────────
  commissions: {
    preview: (dateFrom, dateTo) => electron.ipcRenderer.invoke("commissions:preview", dateFrom, dateTo),
    confirm: (dateFrom, dateTo, notes) => electron.ipcRenderer.invoke("commissions:confirm", dateFrom, dateTo, notes),
    listRuns: (p) => electron.ipcRenderer.invoke("commissions:listRuns", p),
    getRunDetail: (runId) => electron.ipcRenderer.invoke("commissions:getRunDetail", runId)
  },
  // ── AJUSTES ───────────────────────────────────────────────────────────
  settings: {
    getAll: () => electron.ipcRenderer.invoke("settings:getAll"),
    set: (updates) => electron.ipcRenderer.invoke("settings:set", updates)
  },
  // ── DASHBOARD ─────────────────────────────────────────────────────────
  dashboard: {
    getStats: (dateFrom, dateTo) => electron.ipcRenderer.invoke("dashboard:getStats", dateFrom, dateTo)
  },
  // ── AGENDA / GOOGLE CALENDAR ──────────────────────────────────────────
  calendar: {
    getStatus: () => electron.ipcRenderer.invoke("calendar:getStatus"),
    connect: () => electron.ipcRenderer.invoke("calendar:connect"),
    disconnect: () => electron.ipcRenderer.invoke("calendar:disconnect"),
    listCalendars: () => electron.ipcRenderer.invoke("calendar:listCalendars"),
    listAppointments: (dateFrom, dateTo) => electron.ipcRenderer.invoke("calendar:listAppointments", dateFrom, dateTo),
    createAppointment: (data) => electron.ipcRenderer.invoke("calendar:createAppointment", data),
    updateAppointment: (id, data) => electron.ipcRenderer.invoke("calendar:updateAppointment", id, data),
    cancelAppointment: (id) => electron.ipcRenderer.invoke("calendar:cancelAppointment", id),
    sync: () => electron.ipcRenderer.invoke("calendar:sync")
  }
};
electron.contextBridge.exposeInMainWorld("electronAPI", api);
//# sourceMappingURL=preload.js.map
