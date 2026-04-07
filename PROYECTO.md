# LUMA APP — Documento maestro del proyecto
> Versión del documento: 1.0 — Generado tras completar todas las fases principales.
> Este archivo es la fuente de verdad para cualquier desarrollador o agente que continúe el proyecto.

---

## 1. DESCRIPCIÓN GENERAL

Luma App es un sistema de gestión integral para salón de belleza, construido como **aplicación de escritorio** con Electron. Maneja ventas (POS), comisiones, empleados, clientes, inventario, caja registradora, agenda con Google Calendar y configuración del salón.

---

## 2. STACK TECNOLÓGICO

| Capa | Tecnología | Versión |
|---|---|---|
| Desktop | Electron | ^32.1.2 |
| Frontend | React + TypeScript | ^18.3.1 / ^5.6.3 |
| Build | Vite + vite-plugin-electron | ^5.4.8 |
| Estilos | Tailwind CSS | ^3.4.13 |
| Base de datos | SQLite (better-sqlite3) | ^11.5.0 |
| Estado global | Zustand | ^5.0.1 |
| Iconos | Lucide React | ^0.462.0 |
| Fechas | date-fns | ^4.1.0 |
| Google API | googleapis | ^171.4.0 |
| Router | react-router-dom | ^6.26.2 |

---

## 3. ESTRUCTURA DE ARCHIVOS

```
C:\Proyectos locales\Luma-app\
├── index.html                        ← Raíz para Vite (patrón vite-plugin-electron)
├── package.json
├── vite.config.ts                    ← CRÍTICO: tiene NODE_BUILTINS para externos
├── tailwind.config.js
├── tsconfig.json
├── PROYECTO.md                       ← Este archivo
├── AVANCE.md                         ← Historial de fases completadas
│
├── src/
│   ├── main/                         ← Proceso principal de Electron (Node.js)
│   │   ├── main.ts                   ← Entry point, registra handlers, inicia BD
│   │   ├── logger.ts                 ← Logger a archivo
│   │   └── ipc/
│   │       ├── handlers.ts           ← Registra TODOS los handlers
│   │       ├── appHandlers.ts        ← ping, dbReady, logs
│   │       ├── employeeHandlers.ts   ← CRUD + historial tarifas
│   │       ├── serviceHandlers.ts    ← CRUD categorías + servicios + owner
│   │       ├── clientHandlers.ts     ← CRUD + búsqueda
│   │       ├── inventoryHandlers.ts  ← CRUD + ajuste de stock
│   │       ├── cashRegisterHandlers.ts ← Apertura/cierre/movimientos
│   │       ├── invoiceHandlers.ts    ← POS + facturas (motor comisiones)
│   │       ├── commissionHandlers.ts ← Preview + confirmar + historial
│   │       ├── settingsHandlers.ts   ← Settings + Dashboard stats
│   │       └── calendarHandlers.ts   ← OAuth2 + CRUD citas + sync Google
│   │
│   ├── preload/
│   │   └── preload.ts                ← Bridge contextBridge → expone window.electronAPI
│   │
│   ├── database/
│   │   ├── database.ts               ← Migraciones 1-5, initDatabase, getDb
│   │   └── dbUtils.ts                ← getNextInvoiceFolio, withTransaction, nowISO
│   │
│   └── renderer/src/                 ← App React (proceso renderer)
│       ├── App.tsx                   ← Router principal con todas las rutas
│       ├── index.css                 ← Variables CSS de tema + clases luma-*
│       ├── main.tsx                  ← Entry point React
│       ├── types/index.ts            ← TODOS los tipos TypeScript del dominio
│       ├── hooks/
│       │   └── useAppState.ts        ← salonName, tema, applyTheme()
│       ├── store/                    ← Zustand stores (si aplica)
│       ├── components/
│       │   ├── ui/
│       │   │   ├── index.tsx         ← Badge, Spinner, Paginator, PageHeader, etc.
│       │   │   ├── Modal.tsx         ← Modal reutilizable
│       │   │   └── GoogleColorPicker.tsx
│       │   ├── layout/
│       │   │   ├── Sidebar.tsx
│       │   │   └── Titlebar.tsx
│       │   ├── pos/
│       │   │   └── Autocomplete.tsx  ← Autocomplete async genérico
│       │   ├── agenda/
│       │   │   └── AppointmentModal.tsx ← Formulario de cita con LocalAutocomplete
│       │   ├── employees/
│       │   ├── services/
│       │   │   ├── ServiceForm.tsx   ← Incluye selector de owner_employee_id
│       │   │   └── CategoryForm.tsx
│       │   ├── clients/
│       │   ├── cash/
│       │   └── inventory/
│       └── pages/
│           ├── DashboardPage.tsx     ← KPIs + sparkline + comisiones por empleado
│           ├── AgendaPage.tsx        ← Vista semana/mes + banner Google + alertas
│           ├── PosPage.tsx           ← Carrito + pagos mixtos + historial facturas
│           ├── CashPage.tsx          ← Apertura/cierre caja + movimientos
│           ├── CommissionsPage.tsx   ← Pre-cuadre expandible + historial
│           ├── EmployeesPage.tsx     ← CRUD + historial de tarifas
│           ├── ServicesPage.tsx      ← CRUD + columna jefe (owner)
│           ├── ClientsPage.tsx       ← CRUD + datos fiscales
│           ├── InventoryPage.tsx     ← CRUD + ajuste stock + stock bajo
│           ├── SettingsPage.tsx      ← Ajustes salón + temas + Google Calendar
│           └── index.tsx             ← Re-exporta SettingsPage, AgendaPage placeholder N/A
```

---

## 4. BASE DE DATOS — MIGRACIONES

La BD SQLite se guarda en `app.getPath('userData')/luma.db` (gestionado por Electron).

### Migraciones aplicadas (v1 → v5)

| # | Contenido |
|---|---|
| M1 | `users`, `settings`, `error_log` + seeds admin + settings iniciales |
| M2 | `employees`, `service_categories`, `services`, `clients`, `inventory_products`, `cash_registers`, `cash_movement_categories`, `cash_movements`, `invoices`, `invoice_services`, `invoice_service_employees`, `invoice_payments`, `commission_runs`, `commission_details`, `appointments`, `google_sync_queue`, `invoice_sequence` |
| M3 | `employees.role` (TEXT 'employee'\|'owner') + índice único nombre+apellido |
| M4 | `services.owner_employee_id` (FK employees) + tabla `employee_rate_history` |
| M5 | Tabla `google_oauth_tokens` (1 registro = cuenta del salón) + setting `google_calendar_id` |

### Tabla de settings (clave → valor)

```
salon_name          → string   Nombre del salón
salon_currency      → string   MXN / USD / EUR
tax_rate            → number   % de IVA (solo aplica con factura oficial)
tax_label           → string   "IVA" u otro texto
theme               → string   dark / light / custom
first_run           → boolean  true en primera ejecución
google_client_id    → string   Client ID de Google Cloud
google_secret       → string   Client Secret de Google Cloud
google_calendar_id  → string   ID del calendario a usar (default: 'primary')
custom_bg           → #hex     Variables del tema personalizado
custom_surface      → #hex
custom_surface2     → #hex
custom_border       → #hex
custom_accent       → #hex
custom_text         → #hex
custom_text_muted   → #hex
custom_success      → #hex
custom_danger       → #hex
custom_warning      → #hex
custom_info         → #hex
```

---

## 5. API IPC COMPLETA — `window.electronAPI`

Toda comunicación renderer→main pasa por `contextBridge` en `preload.ts`.

```typescript
window.electronAPI = {
  // App
  ping, dbReady, getLogPath, readLogs, logError,

  // Empleados
  employees: { list, getById, create, update(id, data, reason?), toggle, all, getRateHistory }

  // Categorías y Servicios
  categories: { list, create, update, toggle }
  services:   { list, all, create, update, toggle }

  // Clientes
  clients: { list, getById, search, create, update, toggle }

  // Inventario
  inventory: { list, lowStockCount, create, update, adjustStock, toggle }

  // Caja
  cash: { getOpen, open, close, getSummary, listMovements, addMovement, getCategories, listRegisters }

  // Facturas / POS
  invoices: { create, list, getById, cancel, getTaxRate }

  // Comisiones
  commissions: { preview, confirm, listRuns, getRunDetail }

  // Settings + Dashboard
  settings:  { getAll, set(updates: Record<string,string>) }
  dashboard: { getStats(dateFrom?, dateTo?) }

  // Agenda / Google Calendar
  calendar: {
    getStatus,           // → { connected, has_credentials, connected_at, calendar_id }
    connect,             // OAuth2 flow + pull inicial desde Google
    disconnect,          // Borra tokens localmente (no revoca en Google)
    listCalendars,       // Lista calendarios de la cuenta conectada
    listAppointments(dateFrom, dateTo),
    checkOverlaps(employeeId, startAt, endAt, excludeId?), // Sin side effects
    createAppointment(data & { force?: boolean }),
    updateAppointment(id, data & { force?: boolean }),
    cancelAppointment(id),
    sync,                // Push: local pending_sync → Google
    pull,                // Pull: Google → BD local (actualiza/inserta)
  }
}
```

---

## 6. REGLAS CRÍTICAS DEL NEGOCIO

### Motor de comisiones (rev.2 — Opción A)
- El **jefe del servicio** (`service.owner_employee_id`) se asigna en el catálogo, NO en el POS
- Empleados auxiliares: `comisión = line_total × commission_pct / 100`
- Jefe: recibe `line_total - suma_comisiones_auxiliares` (el resto)
- IVA: **solo aplica** cuando el cajero activa "Requiere factura oficial" (`apply_tax = true`)
- Facturas canceladas **NUNCA se eliminan** — solo cambian a `status = 'cancelled'`
- El folio es autoincrementado atómicamente: `V-00001`, `V-00002`...

### Empleados
- `role = 'employee'`: DEBE tener `base_salary > 0` Y `commission_pct > 0`
- `role = 'owner'`: DEBE tener `commission_pct > 0`, salario puede ser 0
- Cambio de `commission_pct` o `base_salary` → registra automáticamente en `employee_rate_history`

### Caja registradora
- Solo puede haber **una caja abierta** a la vez
- El cierre calcula diferencias por método de pago (sistema vs declarado)
- Cada pago de venta genera un movimiento de caja automático
- Cancelar una factura genera movimientos de caja inversos (si tiene caja)

### Agenda / Google Calendar
- Un token OAuth2 global del salón (cuenta administrador), NO por empleado
- Puerto de callback: `http://localhost:3737/callback` → debe estar en Google Cloud
- `pullFromGoogle()` se ejecuta automáticamente al conectar (últimos 7d + próximos 60d)
- Google Calendar API: máximo 250 eventos por request (`maxResults: 250`)
- Citas que cruzan medianoche NO son válidas para Google Calendar → forzar `end ≤ 23:30`
- Empalme de citas: **advertencia no bloqueante** — el usuario decide con `force: true`
- Al navegar a semanas/meses fuera del pull inicial → hacer `pull` manual desde el banner

---

## 7. SISTEMA DE TEMAS

### CSS Variables en `index.css`
```css
/* Tema oscuro — default */
:root, :root[data-theme="dark"] { ... }

/* Tema claro */
:root[data-theme="light"], .theme-light { ... }

/* Tema personalizado — variables inline en <html> via applyTheme() */
```

### `applyTheme(theme, settings)` en `useAppState.ts`
- `dark`/`light` → `root.setAttribute('data-theme', theme)` + limpia variables inline
- `custom` → aplica cada `custom_*` setting como variable inline en `<html>`
- Se llama al arrancar la app (en `useAppState useEffect`) y al cambiar tema en Ajustes

### Clases CSS reutilizables
```
luma-surface     → tarjeta con borde y fondo
luma-btn-primary → botón accent (naranja)
luma-btn-ghost   → botón transparente
luma-input       → input/select/textarea estilizado
luma-label       → etiqueta de campo
font-display     → fuente para títulos grandes
```

---

## 8. CONFIGURACIÓN CRÍTICA DE VITE

**PROBLEMA CONOCIDO**: `googleapis` es una librería masiva. Si se añade al bundle del renderer o no está en `external`, Vite agota la memoria (~4GB) y falla con `heap out of memory`.

**REGLA**: Todo módulo de Node.js que use el proceso principal (main) debe estar en `NODE_BUILTINS` en `vite.config.ts`:

```typescript
const NODE_BUILTINS = [
  'electron', 'better-sqlite3', 'googleapis',
  'path', 'fs', 'os', 'crypto', 'url', 'http', 'https',
  'http2', 'net', 'tls', 'zlib', 'stream', 'events',
  'buffer', 'util', 'assert', 'querystring', 'string_decoder',
  'child_process', 'worker_threads',
  'google-auth-library', 'gaxios', 'gcp-metadata', 'google-p12-pem',
]
```

---

## 9. PATRONES DE DISEÑO

### Patrón IPC (Main ↔ Renderer)
```
Renderer → window.electronAPI.X.y(args)
  → preload.ts: ipcRenderer.invoke('x:y', args)
  → main/ipc/xHandlers.ts: ipcMain.handle('x:y', handler)
  → Retorna siempre: { ok: boolean, data?: T, error?: string }
```

### Patrón de respuesta IPC
```typescript
// Siempre: { ok: true, data: T } o { ok: false, error: string }
// Caso especial de empalme:
{ ok: false, code: 'OVERLAP', error: string, data: Appointment[] }
```

### Fix del cero a la izquierda en inputs numéricos
```typescript
const numVal = (n: number) => n === 0 ? '' : String(n)
// Uso: value={numVal(form.price)} onFocus={e => e.target.select()}
```

### Banner de éxito en POS
```typescript
// handleClear() NO llama setSuccess(null) — el folio permanece visible
// handleNewSale() = handleClear() + setSuccess(null) — para nueva venta manual
const handleClear = () => {
  setCart([]); setClient(null); /* ... */
  // NUNCA: setSuccess(null) ← bug histórico
}
const doSave = async () => {
  handleClear()       // 1. Limpiar
  setSuccess(folio)   // 2. Mostrar banner (DESPUÉS del clear)
}
```

### Detección de empalme de citas
```typescript
// Frontend: consulta checkOverlaps en background al cambiar empleado/fechas
// Backend: detectOverlaps() busca citas del mismo empleado que se superpongan
// Flujo: advertencia → usuario confirma → force=true → se guarda
```

---

## 10. BUGS CONOCIDOS / PENDIENTES

### Pendiente: Pull paginado de Google Calendar
La API de Google Calendar retorna máximo `250` eventos por llamada. El pull actual trae los últimos 7 días + próximos 60 días con `maxResults: 250`. Si el salón tiene más de 250 eventos en ese rango, los más recientes se truncarán.

**Fix pendiente** en `calendarHandlers.ts → pullFromGoogle()`:
```typescript
// Implementar paginación con nextPageToken
let pageToken: string | undefined
do {
  const resp = await cal.events.list({ ..., pageToken, maxResults: 250 })
  // procesar resp.data.items
  pageToken = resp.data.nextPageToken ?? undefined
} while (pageToken)
```

### Pendiente: Citas más allá del rango de pull
Al navegar a semanas/meses fuera del rango inicial (ej: citas con 1 año de anticipación), esas citas no se mostrarán si no se importaron. La solución está disponible: botón **"Importar"** en el banner de conexión ejecuta `calendar:pull` manualmente.

**Fix pendiente**: hacer pull dinámico al navegar a rangos no cargados (lazy loading por rango).

### Pendiente: Usuario autenticado hardcodeado
Todos los handlers usan `created_by: 1`. Sistema de autenticación de usuarios pendiente.

### Pendiente: Historial de tarifas en UI
El backend registra cambios en `employee_rate_history` correctamente. La UI de `EmployeesPage` no muestra este historial aún — candidato para mejora futura.

---

## 11. INSTRUCCIONES DE ARRANQUE (REINSTALACIÓN)

```bash
# 1. Clonar/descomprimir el proyecto
cd "C:\Proyectos locales\Luma-app"

# 2. Instalar dependencias
npm install

# 3. Reconstruir módulos nativos para Electron (better-sqlite3)
npm run postinstall
# o manualmente:
npx electron-rebuild -f -w better-sqlite3

# 4. Ejecutar en modo desarrollo
npm run dev

# 5. Si la BD necesita resetear (para aplicar migraciones desde 0):
# Borrar el archivo de BD — se recrea automáticamente
# Windows:
del "%APPDATA%\luma-app\luma.db"
# o PowerShell:
Remove-Item "$env:APPDATA\luma-app\luma.db"
```

---

## 12. CONFIGURACIÓN GOOGLE CLOUD (PARA ACTIVAR LA AGENDA)

1. Ir a https://console.cloud.google.com
2. Crear proyecto → habilitar **Google Calendar API**
3. Configurar **Pantalla de consentimiento OAuth** → tipo "Externo" → agregar scope `https://www.googleapis.com/auth/calendar`
4. Crear credenciales → **Aplicación de escritorio** → copiar Client ID y Client Secret
5. En **URI de redireccionamiento**: agregar `http://localhost:3737/callback`
6. En Luma App → **Ajustes → Google Calendar** → pegar las credenciales → Guardar
7. En **Agenda** → clic en **"Conectar Google"** → autorizar en el navegador

> ⚠️ Mientras la app esté en modo "Prueba" en Google Cloud, solo los correos agregados como "usuarios de prueba" podrán conectarse.

---

## 13. COLORES DE GOOGLE CALENDAR

Los colores internos se mapean a los colorId de Google Calendar:

| Nombre interno | ColorId Google | Hex |
|---|---|---|
| lavender | 1 | #7986cb |
| sage | 2 | #33b679 |
| grape | 3 | #8d24aa |
| flamingo | 4 | #e67c73 |
| banana | 5 | #f6bf26 |
| tangerine | 6 | #f6891f |
| peacock | 7 | #039be5 |
| graphite | 8 | #616161 |
| blueberry | 9 | #3f51b5 |
| basil | 10 | #0f9d58 |
| tomato | 11 | #d50000 |

El color de una cita se hereda del `calendar_color` del empleado asignado.

---

## 14. DASHBOARD — MÉTRICAS DISPONIBLES

`window.electronAPI.dashboard.getStats(dateFrom?, dateTo?)` retorna:

```typescript
{
  period: { from, to },
  sales: { invoice_count, total_subtotal, total_tax, total_revenue },
  salesByMethod: { payment_method, total }[],
  commissions: { total_commissions },
  commissionsByEmployee: { id, name, role, calendar_color, commission_amount, services_total }[],
  topServices: { service_name, count, revenue }[],
  cancelled: number,
  pendingOfficial: number,   // facturas con factura oficial pendiente
  uniqueClients: number,
  dailySales: { day, total }[],
  lowStockCount: number,
}
```

---

## 15. CONVENCIONES DE CÓDIGO

- **Idioma**: todo en español (labels, mensajes de error, comentarios, nombres de BD)
- **Tipos**: siempre tipado estricto, nunca `any` si se puede evitar
- **IPC handlers**: siempre retornar `{ ok: boolean }` — nunca lanzar al renderer
- **Transacciones**: operaciones multi-tabla siempre en `withTransaction()`
- **Fechas en BD**: siempre en ISO 8601 como `TEXT` (`nowISO()`)
- **Inputs numéricos**: siempre `value={numVal(n)}` + `onFocus={e => e.target.select()}`
- **Modales de confirmación**: nunca usar `window.confirm` — siempre `<Modal>` propio
- **Sin `window.alert`**: usar toasts o banners inline
- **Formateo de moneda**: `fmt(n)` = `$X,XXX.XX` con `toLocaleString('es-MX')`
