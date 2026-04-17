# Luma App — Gestión Integral para Salones de Belleza

![Luma App](resources/icon.ico) <!-- Si tienes un banner, puedes ponerlo aquí -->

**Luma App** es una solución de escritorio moderna y robusta diseñada para transformar la operación de salones de belleza y barberías. Construida con una arquitectura de vanguardia, ofrece herramientas críticas para la gestión de clientes, agenda inteligente y control financiero.

---

## 🚀 Características Principales

- **Agenda Inteligente**: Gestión de citas con algoritmos para evitar solapamientos y visualización dinámica (semanal/mensual).
- **Integración con Google Calendar**: Sincronización bidireccional en tiempo real para llevar la agenda en el móvil.
- **Automatización de WhatsApp**: Envío automático de recordatorios (1d, 3d, 7d antes) y confirmación de citas mediante `whatsapp-web.js`.
- **Motor de Comisiones Flexible**: 
  - **Modo Simple**: Comisión íntegra por colaborador.
  - **Modo Proporcional**: Reparto automático equitativo.
  - **Modo Manual**: Ajuste fino de porcentajes y reserva de insumos (Overhead).
- **Punto de Venta (POS)**: Generación de tickets, gestión de pagos mixtos y facturación con IVA configurable.
- **Inventario y Caja**: Control de stock con alertas de nivel bajo y registro de movimientos de caja (entradas/salidas).
- **Temas Personalizables**: Modos claro, oscuro y personalización total de colores de la UI.
- **Portabilidad**: Sistema robusto de importación/exportación de base de datos (SQLite).

## 🛠️ Stack Tecnológico

- **Frontend**: [React](https://reactjs.org/) + [TypeScript](https://www.typescriptlang.org/)
- **Desktop**: [Electron](https://www.electronjs.org/)
- **Estilos**: [Tailwind CSS](https://tailwindcss.com/)
- **Base de Datos**: [SQLite](https://www.sqlite.org/) (Better-SQLite3)
- **Iconografía**: [Lucide React](https://lucide.dev/)
- **Estado**: [Zustand](https://github.com/pmndrs/zustand)

## 📦 Instalación y Desarrollo

```bash
# Instalar dependencias
npm install

# Ejecutar en modo desarrollo (Hot Reload)
npm run dev

# Compilar ejecutable para Windows
npm run build:win
```

## 🤖 Desarrollo con IA
Este proyecto es un testimonio del desarrollo de software moderno asistido por IA. Puedes consultar el archivo `PrompInicial.md` para ver la base metodológica y las reglas de ingeniería aplicadas durante su construcción.

---

### Autor
- **schecko0** — *Desarrollador Senior*
- **Licencia**: MIT
