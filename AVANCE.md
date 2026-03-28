# 📋 LUMA APP — Estado Final del Proyecto
> Todas las fases principales completadas. Pendiente: Agenda (Google Calendar).

---

## ✅ Estado por módulo

| Módulo | Estado | Notas |
|---|---|---|
| Dashboard | ✅ Completo | KPIs, sparkline, top servicios, comisiones por empleado, alertas |
| POS / Facturas | ✅ Completo | Motor comisiones rev.2, IVA dinámico, pagos mixtos sin duplicados, banner éxito |
| Comisiones | ✅ Completo | Preview + confirmación + historial de runs |
| Caja | ✅ Completo | Card saldo inicial, traducción, modal detalle movimiento |
| Empleados | ✅ Completo | Historial de tarifas en backend |
| Servicios | ✅ Completo | owner_employee_id en catálogo |
| Clientes | ✅ Completo | CRUD + datos fiscales |
| Inventario | ✅ Completo | CRUD + ajuste de stock + alerta stock bajo |
| Ajustes | ✅ Completo | salon_name, moneda, tax_rate, tax_label, tema |
| Agenda | ⏳ Placeholder | Google Calendar OAuth2 — fase futura |

---

## 🔌 IPC API completa

```typescript
window.electronAPI = {
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
}
```

---

## 🗄️ Migraciones SQLite

| # | Contenido |
|---|---|
| M1 | users, settings, error_log |
| M2 | Schema completo de negocio (14 tablas) |
| M3 | employees.role + índice nombre único |
| M4 | services.owner_employee_id + employee_rate_history |

---

## 🐛 Notas técnicas importantes

### Fix banner éxito en POS
`handleClear()` NO llama `setSuccess(null)`. El orden en `doSave` es:
1. `handleClear()` → limpia carrito/pagos
2. `setSuccess(folio)` → activa el banner (después de clear, no se pisa)
El banner tiene botón `×` para cerrarlo y `handleNewSale()` lo limpia todo.

### Motor de comisiones (rev.2)
- Empleados auxiliares: `line_total × commission_pct / 100`
- Jefe del servicio (owner): recibe `line_total - suma_comisiones_auxiliares`
- El jefe se asigna en el **catálogo de servicios** (`service.owner_employee_id`), no en el POS
- `work_split_pct` se mantiene en BD pero siempre es 100 con el nuevo modelo

### IVA dinámico
- Sin "Requiere factura oficial": `tax_rate = 0`, `apply_tax = false`
- Con "Requiere factura oficial": aplica el IVA configurado en Ajustes

### Usuario hardcoded
Todos los handlers usan `created_by: 1`. Sistema de autenticación pendiente.

---

## 📦 Para la fase de Agenda (futura)

Necesitará:
1. Handler `calendar:auth` — OAuth2 BYOK (PKCE flow)
2. Handler `calendar:sync` — Push/pull citas ↔ Google Calendar
3. Tabla `appointments` ya existe en M2
4. Tabla `google_sync_queue` ya existe en M2
5. Credenciales en settings: `google_client_id`, `google_secret`
6. `AgendaPage.tsx` — vista de calendario semanal/mensual

Sugerencia de librería UI para el calendario: `react-big-calendar` o `@fullcalendar/react`
