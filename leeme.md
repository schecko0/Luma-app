# Luma App — Metas del Proyecto

> Aplicación de escritorio multiplataforma (Windows & macOS) para la gestión integral de un salón de belleza / negocio de estilismo.

---

## 🎯 Objetivo General

Construir una aplicación desktop **producción-lista**, robusta y moderna, que centralice todas las operaciones de un salón de belleza: agenda, ventas, inventario, comisiones y reportes financieros.

---

## 🏗️ Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Shell de escritorio | Electron |
| UI / Frontend | React + TypeScript |
| Bundler | Vite + vite-plugin-electron |
| Estilos | Tailwind CSS |
| Base de datos local | SQLite (better-sqlite3) |
| Iconos | Lucide React |
| Empaquetado | electron-builder |

---

## 📦 Módulos Planificados

### 1. Empleados
- Datos personales, salario base y porcentaje de comisión.
- Selector de color restringido a la paleta oficial de Google Calendar API.

### 2. Categorías de Servicios
- Agrupación lógica de servicios (ej. Cabello, Uñas, Faciales).

### 3. Servicios
- Título, descripción, precio y duración en minutos.

### 4. Inventario / Productos
- Nombre, proveedor, precio, cantidad, tipo de envase, volumen (ml) y piezas.

### 5. Clientes
- Historial de visitas y frecuencia.
- Datos fiscales: RFC/NIF, Razón Social, Código Postal, teléfono con código de país, email.

### 6. Agenda (Google Calendar)
- Sincronización bidireccional vía OAuth 2.0 (BYOK — el admin ingresa sus propias credenciales).
- Crear, editar y eliminar citas.
- Alertas a 15 min y 5 min antes del evento.
- Paginación con `pageToken` y filtros `timeMin`/`timeMax` para respetar límites de la API.
- **Cola offline:** si no hay internet, los cambios se guardan localmente y se sincronizan al restaurar la conexión.

### 7. POS / Facturación
- Autocompletados para Servicios, Clientes y Empleados.
- Una nota puede contener múltiples servicios.
- Cada servicio puede asignarse a uno o varios empleados.
- Pagos mixtos (Efectivo + Tarjeta + Transferencia).
- Impuestos configurables (IVA global).
- Subtotal, impuesto y total claramente desglosados.
- Bandera "Requiere Factura Oficial" para procesamiento posterior.
- Notas canceladas: nunca se eliminan (auditoría); excluidas de totales activos.

### 8. Caja Registradora
- Apertura y cierre de caja con cuadre por tipo de pago.
- Movimientos de entrada/salida con descripción y **categoría** (Insumos, Servicios, Nómina, etc.).
- Histórico filtrable por rango de fechas con tabla de comprobantes.

### 9. Motor de Comisiones
- Cálculo de splits complejos (ej. 2 empleadas al 20% cada una → cada una recibe $20 de $100; $60 al negocio).
- Generación por rango de fechas.
- Registro del admin que ejecutó el cuadre.
- **Pre-cuadre (Preview):** vista previa del desglose antes de confirmar.
- **Tabla de auditoría:** registro del origen exacto de cada comisión (empleada X, servicio Y, nota #Z).

### 10. Dashboard
- Métricas clave: ingresos, gastos, utilidad, participación por empleada.
- Usa categorías de gastos e impuestos para cálculos precisos.

### 11. Base de Datos Local
- SQLite — sin costos de nube.
- Todas las listas con **paginación** para evitar crashes de memoria.
- Imágenes: guardar ruta del archivo, no el blob.

### 12. Portabilidad de Datos
- Exportar e importar la base de datos completa.

### 13. Registro de Errores
- Sistema de logging para soporte y depuración.

---

## 🔐 Roles y Seguridad

| Módulo | Admin | Empleado |
|---|---|---|
| Caja Registradora | ✅ | ❌ |
| Comisiones | ✅ | ❌ |
| Dashboard | ✅ | ❌ |
| POS / Ventas | ✅ | ✅ |
| Agenda | ✅ | ✅ |
| Clientes | ✅ | ✅ |

- Usuario Admin creado automáticamente en el primer arranque.

---

## 🎨 UI / UX

- Temas: Claro, Oscuro y Personalizado.
- Totalmente responsive e interactiva.
- Ayuda contextual: tooltips, modales informativos, estados vacíos.
- Atajos de teclado en POS y navegación principal (ej. `F2` = Nueva Venta, `Esc` = Cancelar).

---

## 🚀 Fases de Desarrollo

1. **Fase 1 — Setup & Arquitectura Base:** Electron + React + Vite + Tailwind + SQLite.
2. **Fase 2 — Esquema de Base de Datos:** Todas las tablas, relaciones e índices.
3. **Fase 3 — Módulo Empleados.**
4. **Fase 4 — Módulo Servicios & Categorías.**
5. **Fase 5 — Módulo Clientes.**
6. **Fase 6 — Módulo Inventario.**
7. **Fase 7 — Agenda + Google Calendar.**
8. **Fase 8 — POS / Facturación.**
9. **Fase 9 — Caja Registradora.**
10. **Fase 10 — Motor de Comisiones.**
11. **Fase 11 — Dashboard.**
12. **Fase 12 — Portabilidad, Logging & Empaquetado final.**

---

*Generado con SalonArchitect — Claude Sonnet 4.6*
