# 📋 LUMA APP — Estado del Proyecto
> Última actualización: Abril 2026

---

## ✅ Estado por módulo

| Módulo | Estado | Notas |
|---|---|---|
| Dashboard | ✅ Completo | KPIs, sparkline, top servicios, comisiones por empleado, alertas stock bajo |
| POS / Facturas | ✅ Completo | Motor comisiones rev.2, IVA dinámico, pagos mixtos, banner éxito |
| Comisiones | ✅ Completo | Preview + confirmación + historial de runs con auditoría |
| Caja | ✅ Completo | Apertura/cierre, cuadre por método de pago, movimientos categorizados |
| Empleados | ✅ Completo | CRUD + historial de tarifas (backend) + color Google Calendar |
| Servicios | ✅ Completo | CRUD + owner_employee_id + categorías |
| Clientes | ✅ Completo | CRUD + datos fiscales + historial de visitas |
| Inventario | ✅ Completo | CRUD + ajuste de stock + alerta stock bajo |
| Ajustes | ✅ Completo | General, apariencia (temas), Google Calendar, WhatsApp, Sistema |
| Agenda | ✅ Completo | Vista semanal/mensual, algoritmo de columnas para solapamientos, alertas de voz/sonido/notificación, sync bidireccional Google Calendar, cola de reintentos offline |
| WhatsApp | ✅ Completo | Vinculación QR, recordatorios automáticos cron (1d/3d/7d), envío manual con previsualización, checkboxes por cita, reenvío controlado, cola anti-spam, log de auditoría |
| Portabilidad | ✅ Completo | Export/import de base de datos SQLite |
| Logs | ✅ Completo | Bitácora de eventos en BD + archivo luma.log |

---

## 🔌 IPC API completa

```typescript
window.electronAPI = {
  // Core
  ping, dbReady, getLogPath, readLogs, clearLogs,
  logError, getErrorLogs, exportDb, importDb,

  // Módulos de negocio
  employees:   { list, getById, create, update(id, data, reason?), toggle, all, getRateHistory },
  categories:  { list, create, update, toggle },
  services:    { list, all, create, update, toggle },
  clients:     { list, getById, search, create, update, toggle },
  inventory:   { list, lowStockCount, create, update, adjustStock, toggle },
  cash:        { getOpen, open, close, getSummary, listMovements, addMovement, getCategories, listRegisters },
  invoices:    { create, list, getById, cancel, getTaxRate },
  commissions: { preview, confirm, listRuns, getRunDetail },
  settings:    { getAll, set(updates: Record<string,string>) },
  dashboard:   { getStats(dateFrom?, dateTo?) },

  // Agenda / Google Calendar
  calendar: {
    getStatus, connect, disconnect, listCalendars,
    listAppointments(dateFrom, dateTo),
    createAppointment, updateAppointment, cancelAppointment,
    sync, pull(dateFrom?, dateTo?),
    onCalendarUpdated(cb) → unsub,
  },

  // WhatsApp
  whatsapp: {
    getStatus, connect, disconnect,
    preview(ids, reminderType),
    sendBulk(ids, reminderType, forcedIds?),
    sendOne(id, reminderType),
    getLog(page?, pageSize?),
    getStats,
    restartScheduler,
    onStatus(cb) → unsub,
    onQr(cb) → unsub,
    onQueueDone(cb) → unsub,
  },
}
```

---

## 🗄️ Migraciones SQLite

| # | Contenido |
|---|---|
| M1 | users, settings, error_log — seeds iniciales |
| M2 | Schema completo de negocio: employees, services, categories, clients, inventory, cash_registers, cash_movements, invoices, invoice_services, invoice_service_employees, invoice_payments, commission_runs, commission_details, appointments, google_sync_queue, invoice_sequence |
| M3 | employees.role + índice nombre único |
| M4 | services.owner_employee_id + employee_rate_history |
| M5 | google_oauth_tokens + seed google_calendar_id |
| M6 | whatsapp_reminder_log + seeds de settings WA (plantillas, toggles, límites) |

---

## 🏗️ Arquitectura principal

```
src/
├── main/
│   ├── main.ts                  — Entry point Electron, init DB, handlers, WA reconexión
│   ├── logger.ts                — Sistema de logging (consola + archivo + BD)
│   ├── whatsappService.ts       — Cliente WA, cola anti-spam, scheduler cron, preview
│   └── ipc/
│       ├── handlers.ts          — Registro central de todos los handlers
│       ├── calendarHandlers.ts  — OAuth2, sync bidireccional, cola offline, pull paginado
│       ├── whatsappHandlers.ts  — IPC bridge para whatsappService
│       ├── appHandlers.ts       — DB export/import, logs
│       ├── settingsHandlers.ts  — Settings + Dashboard stats
│       └── [módulos].ts         — employees, services, clients, inventory, cash, invoices, commissions
├── database/
│   ├── database.ts              — initDatabase(), migraciones M1-M6, getDb()
│   └── dbUtils.ts               — nowISO() y helpers
├── preload/
│   └── preload.ts               — contextBridge con toda la API tipada
└── renderer/src/
    ├── pages/
    │   ├── AgendaPage.tsx        — Calendario semanal/mensual + WhatsApp bulk
    │   ├── SettingsPage.tsx      — Tabs: General, Apariencia, Google, WhatsApp, Sistema
    │   └── [módulos].tsx
    └── components/
        └── agenda/
            ├── AppointmentModal.tsx       — CRUD de citas + botón WA individual
            └── WhatsAppPreviewModal.tsx   — Preview con checkboxes, reenvío controlado
```

---

## 🐛 Notas técnicas importantes

### Motor de comisiones (rev.2)
- Empleados auxiliares: `line_total × commission_pct / 100`
- Jefe del servicio (owner): recibe `line_total - suma_comisiones_auxiliares`
- El jefe se asigna en el **catálogo de servicios** (`service.owner_employee_id`), no en el POS

### IVA dinámico
- Sin "Requiere factura oficial": `tax_rate = 0`, `apply_tax = false`
- Con "Requiere factura oficial": aplica el IVA configurado en Ajustes

### Google Calendar — Comportamiento clave
- **Lazy pull**: si no hay citas locales en el rango visible, se hace pull automático de Google solo para ese rango
- **Cola offline**: si no hay internet, las operaciones se encolan en `google_sync_queue` y se reintentan con backoff exponencial (2^n minutos, máx 5 intentos)
- **Sesión caducada**: si Google devuelve `invalid_grant`, se borra el token y se notifica al usuario para reconectar

### WhatsApp — Comportamiento clave
- **Formato MX**: números de 10 dígitos se convierten a `521XXXXXXXXXX@c.us` (con el `1` de celular)
- **Anti-spam**: delay aleatorio entre `wa_delay_seconds` y `wa_delay_seconds × 2` entre mensajes
- **Reenvío forzado**: `sendBulk(ids, type, forcedIds)` — los IDs en `forcedIds` ignoran el bloqueo de "ya enviado hoy"
- **Detección enviado hoy**: busca en `whatsapp_reminder_log` status `sent` o `pending` con `COALESCE(sent_at, created_at)` del día actual

### Agenda — Algoritmo de columnas (solapamientos)
El `computeLayout()` en `AgendaPage.tsx` agrupa citas solapadas y las distribuye en columnas. Cada cita recibe `colIndex` y `colCount` para calcular su `left` y `width` dentro de la columna del día. Escala correctamente para 2, 3, N citas simultáneas.

### Usuario hardcoded
Todos los handlers usan `created_by: 1`. **Sistema de autenticación pendiente** — es el siguiente paso crítico para producción.

---

## 📌 Pendientes para producción

| # | Tarea | Prioridad |
|---|---|---|
| 1 | **Sistema de autenticación** — login admin/empleado, roles, `created_by` dinámico | 🔴 Alta |
| 2 | Historial de tarifas en UI de empleados (backend ya existe en `employee_rate_history`) | 🟡 Media |
| 3 | Generación de ejecutable (.exe / .dmg) con `electron-builder` | 🟡 Media |
| 4 | Pruebas de regresión en módulos de comisiones y caja | 🟡 Media |
