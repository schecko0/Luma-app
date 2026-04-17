import React, { useState, useMemo } from 'react'
import {
  BookOpen, HelpCircle, Calendar, ShoppingCart, Vault,
  Users, Scissors, Settings, ChevronRight, Info,
  AlertTriangle, ArrowRight, Wifi, Bell, Package,
  BadgeDollarSign, MousePointer2, Zap, MessageCircle,
  Smartphone, LayoutDashboard, UserRound, Search,
  Crown, Receipt, CreditCard, DollarSign, ArrowRightLeft,
  Cloud, RefreshCw, CheckCircle2, KeyRound, Tag,
  TrendingUp, ClipboardList, Palette, ShieldCheck,
  ChevronDown, ChevronUp, Keyboard,
} from 'lucide-react'
import { PageHeader } from '../components/ui/index'

// ── Tipos ─────────────────────────────────────────────────────────────────────
type HelpCategory =
  | 'intro'
  | 'dashboard'
  | 'agenda'
  | 'pos'
  | 'commissions'
  | 'cash'
  | 'employees'
  | 'services'
  | 'clients'
  | 'inventory'
  | 'settings'

// ── Página principal ──────────────────────────────────────────────────────────
export const HelpPage: React.FC = () => {
  const [activeCat, setActiveCat] = useState<HelpCategory>('intro')
  const [searchQuery, setSearchQuery] = useState('')

  const categories: { id: HelpCategory; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'intro',       label: 'Introducción',       icon: <BookOpen size={15} /> },
    { id: 'dashboard',   label: 'Dashboard',          icon: <LayoutDashboard size={15} /> },
    { id: 'agenda',      label: 'Agenda y Citas',     icon: <Calendar size={15} /> },
    { id: 'pos',         label: 'Punto de Venta',     icon: <ShoppingCart size={15} /> },
    { id: 'commissions', label: 'Comisiones',         icon: <BadgeDollarSign size={15} /> },
    { id: 'cash',        label: 'Control de Caja',    icon: <Vault size={15} /> },
    { id: 'employees',   label: 'Personal',           icon: <Users size={15} /> },
    { id: 'services',    label: 'Servicios',          icon: <Scissors size={15} /> },
    { id: 'clients',     label: 'Clientes',           icon: <UserRound size={15} /> },
    { id: 'inventory',   label: 'Inventario',         icon: <Package size={15} /> },
    { id: 'settings',    label: 'Configuración',      icon: <Settings size={15} /> },
  ]

  const filteredCats = useMemo(() => {
    if (!searchQuery.trim()) return categories
    const q = searchQuery.toLowerCase()
    return categories.filter(c => c.label.toLowerCase().includes(q))
  }, [searchQuery])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Centro de Ayuda"
        subtitle="Guías detalladas para cada módulo de Luma"
        icon={<HelpCircle size={18} />}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar ──────────────────────────────────────────────── */}
        <aside className="w-60 border-r flex flex-col flex-shrink-0" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
          {/* Buscador de módulos */}
          <div className="p-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
              <Search size={12} style={{ color: 'var(--color-text-muted)' }} />
              <input
                type="text"
                placeholder="Buscar módulo..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-transparent text-xs outline-none flex-1"
                style={{ color: 'var(--color-text)' }}
              />
            </div>
          </div>

          <nav className="flex flex-col gap-0.5 p-2 overflow-y-auto flex-1">
            {filteredCats.map(cat => (
              <button
                key={cat.id}
                onClick={() => { setActiveCat(cat.id); setSearchQuery('') }}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all w-full text-left"
                style={
                  activeCat === cat.id
                    ? { background: 'var(--color-accent)', color: '#fff' }
                    : { color: 'var(--color-text-muted)' }
                }
              >
                {cat.icon}
                <span className="font-medium flex-1">{cat.label}</span>
                {cat.badge && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: 'var(--color-warning)', color: '#000' }}>
                    {cat.badge}
                  </span>
                )}
                {activeCat === cat.id && <ChevronRight size={12} className="ml-auto flex-shrink-0" />}
              </button>
            ))}
          </nav>

          {/* Pie del sidebar */}
          <div className="p-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <p className="text-[10px] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
              Luma App · Versión 1.0
            </p>
          </div>
        </aside>

        {/* ── Contenido ────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto p-8" style={{ background: 'var(--color-bg, var(--color-surface-2))' }}>
          <div className="max-w-3xl mx-auto flex flex-col gap-8 pb-20">
            {activeCat === 'intro'       && <IntroGuide />}
            {activeCat === 'dashboard'   && <DashboardGuide />}
            {activeCat === 'agenda'      && <AgendaGuide />}
            {activeCat === 'pos'         && <PosGuide />}
            {activeCat === 'commissions' && <CommissionsGuide />}
            {activeCat === 'cash'        && <CashGuide />}
            {activeCat === 'employees'   && <EmployeesGuide />}
            {activeCat === 'services'    && <ServicesGuide />}
            {activeCat === 'clients'     && <ClientsGuide />}
            {activeCat === 'inventory'   && <InventoryGuide />}
            {activeCat === 'settings'    && <SettingsGuide />}
          </div>
        </main>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// GUÍAS
// ─────────────────────────────────────────────────────────────────────────────

// ── INTRODUCCIÓN ──────────────────────────────────────────────────────────────
const IntroGuide = () => (
  <GuideWrapper
    icon={<BookOpen className="text-accent" />}
    title="Bienvenido a Luma"
    subtitle="Todo lo que necesitas para gestionar tu salón, en un solo lugar."
  >
    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      Luma es una aplicación de escritorio pensada para salones de belleza. Conecta tus citas, ventas,
      comisiones, inventario y comunicación con clientes sin que tengas que saltar entre varias herramientas.
    </p>

    <SectionTitle>¿Por dónde empezar?</SectionTitle>
    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      El flujo de trabajo diario en Luma siempre sigue el mismo orden:
    </p>

    <div className="flex flex-col gap-0 mt-2">
      {[
        { icon: <Vault size={16} />, step: '1. Abrir caja',         desc: 'Antes de registrar cualquier venta, abre la caja del día desde el módulo de Caja.' },
        { icon: <Calendar size={16} />, step: '2. Consultar agenda', desc: 'Revisa las citas programadas para el día y confirma quién está disponible.' },
        { icon: <ShoppingCart size={16} />, step: '3. Registrar ventas', desc: 'Cobra los servicios en el Punto de Venta y asigna qué especialista realizó cada uno.' },
        { icon: <BadgeDollarSign size={16} />, step: '4. Cerrar caja', desc: 'Al final del turno, cuenta el efectivo y cierra la caja para obtener el resumen del día.' },
      ].map((item, i) => (
        <div key={i} className="flex items-start gap-4 py-4 border-b last:border-b-0" style={{ borderColor: 'var(--color-border)' }}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
               style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', color: 'var(--color-accent)' }}>
            {item.icon}
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{item.step}</p>
            <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>{item.desc}</p>
          </div>
        </div>
      ))}
    </div>

    <SectionTitle>Módulos disponibles</SectionTitle>
    <div className="grid grid-cols-2 gap-3">
      {[
        { icon: <LayoutDashboard size={14} />, label: 'Dashboard',       desc: 'Estadísticas y KPIs del negocio.' },
        { icon: <Calendar size={14} />,        label: 'Agenda',          desc: 'Citas y sincronización con Google.' },
        { icon: <ShoppingCart size={14} />,    label: 'Punto de Venta',  desc: 'Cobros, pagos mixtos y facturas.' },
        { icon: <BadgeDollarSign size={14} />, label: 'Comisiones',      desc: 'Cuadre y pago al personal.' },
        { icon: <Vault size={14} />,           label: 'Caja',            desc: 'Apertura, cierre y movimientos.' },
        { icon: <Users size={14} />,           label: 'Personal',        desc: 'Empleados y tasas de comisión.' },
        { icon: <Scissors size={14} />,        label: 'Servicios',       desc: 'Catálogo de servicios y categorías.' },
        { icon: <UserRound size={14} />,       label: 'Clientes',        desc: 'Base de datos de clientes.' },
        { icon: <Package size={14} />,         label: 'Inventario',      desc: 'Productos e insumos con alertas.' },
        { icon: <Settings size={14} />,        label: 'Configuración',   desc: 'Ajustes, temas y WhatsApp.' },
      ].map((m, i) => (
        <div key={i} className="flex items-start gap-3 p-3 rounded-xl border"
             style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
          <span style={{ color: 'var(--color-accent)' }}>{m.icon}</span>
          <div>
            <p className="text-xs font-semibold" style={{ color: 'var(--color-text)' }}>{m.label}</p>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{m.desc}</p>
          </div>
        </div>
      ))}
    </div>

    <CalloutBox icon={<Smartphone size={16} />} variant="info" title="Automatización con WhatsApp">
      Vincula el teléfono del salón en Configuración → WhatsApp y Luma enviará recordatorios de citas
      automáticamente 1, 3 y 7 días antes. No necesitas escribir nada manualmente.
    </CalloutBox>
  </GuideWrapper>
)

// ── DASHBOARD ────────────────────────────────────────────────────────────────
const DashboardGuide = () => (
  <GuideWrapper
    icon={<LayoutDashboard className="text-accent" />}
    title="Dashboard"
    subtitle="El resumen diario y mensual de tu negocio a primera vista."
  >
    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      Al abrir el Dashboard verás un panel con indicadores clave del período seleccionado. Por defecto muestra
      el mes en curso, pero puedes cambiar las fechas con los selectores en la esquina superior derecha.
    </p>

    <SectionTitle>¿Qué muestra cada tarjeta?</SectionTitle>
    <div className="flex flex-col gap-3">
      {[
        { icon: <TrendingUp size={14} />, color: 'var(--color-accent)',   label: 'Ingresos del período',  desc: 'Suma de todas las ventas completadas (sin contar canceladas). También muestra cuántas ventas se realizaron.' },
        { icon: <BadgeDollarSign size={14} />, color: 'var(--color-warning)', label: 'Comisiones totales', desc: 'El monto acumulado que el sistema calcula que se le debe al personal por sus servicios en el período.' },
        { icon: <Users size={14} />,      color: 'var(--color-info)',     label: 'Clientes únicos',        desc: 'Cuántos clientes distintos tuvieron al menos una venta en el período.' },
        { icon: <ShoppingCart size={14} />, color: 'var(--color-success)', label: 'Ventas realizadas',    desc: 'Número total de facturas generadas, incluyendo cuántas fueron canceladas.' },
      ].map((kpi, i) => (
        <div key={i} className="flex items-start gap-3 p-3 rounded-xl border"
             style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
          <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `color-mix(in srgb, ${kpi.color} 15%, transparent)`, color: kpi.color }}>
            {kpi.icon}
          </span>
          <div>
            <p className="text-xs font-semibold" style={{ color: 'var(--color-text)' }}>{kpi.label}</p>
            <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>{kpi.desc}</p>
          </div>
        </div>
      ))}
    </div>

    <SectionTitle>Gráfica de ventas por día</SectionTitle>
    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      Debajo de las tarjetas verás una línea que muestra el total vendido por cada día del período.
      Los puntos marcados en los extremos y en el pico máximo incluyen el monto exacto y la fecha.
      Útil para identificar los días con mayor actividad.
    </p>

    <SectionTitle>Ventas por método de pago</SectionTitle>
    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      Muestra cuánto se cobró en efectivo, tarjeta y transferencia, con una barra que indica el porcentaje
      de cada método respecto al total. Ayuda a saber cuánto esperar en la caja al final del día.
    </p>

    <SectionTitle>Alertas activas</SectionTitle>
    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      Si hay productos con stock bajo, ventas canceladas en el período o facturas con comprobante fiscal
      pendiente, aparecerán etiquetas de alerta en la parte inferior del Dashboard.
    </p>

    <CalloutBox icon={<RefreshCw size={16} />} variant="tip" title="Actualizar datos">
      Si acabas de registrar una venta y los datos no se han actualizado, usa el botón con el ícono de
      refresco (↺) en la barra de acciones para recargar el panel manualmente.
    </CalloutBox>
  </GuideWrapper>
)

// ── AGENDA ───────────────────────────────────────────────────────────────────
const AgendaGuide = () => (
  <GuideWrapper
    icon={<Calendar className="text-accent" />}
    title="Agenda y Citas"
    subtitle="Gestiona el tiempo de tus especialistas y mantén informados a tus clientes."
  >
    <SectionTitle>Vista general</SectionTitle>
    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      La Agenda muestra un calendario con dos vistas: <strong style={{ color: 'var(--color-text)' }}>Semana</strong> y <strong style={{ color: 'var(--color-text)' }}>Mes</strong>.
      Puedes cambiar entre ellas con los botones en la parte superior derecha.
      En la vista de semana, cada columna corresponde a un día y cada fila a un bloque horario.
      Las citas aparecen coloreadas según el especialista asignado.
    </p>

    <HelpStep number={1} title="Crear una nueva cita"
      body="Haz clic en cualquier espacio vacío del calendario. Se abrirá un formulario donde debes seleccionar el cliente (puedes buscarlo por nombre o teléfono), el servicio a realizar, el especialista que lo atenderá, y la fecha y hora de inicio. La duración se calcula automáticamente según el servicio elegido." />

    <HelpStep number={2} title="Detectar empalmes"
      body="Si el especialista ya tiene una cita en ese horario, el sistema lo avisará con una advertencia. Puedes optar por guardar de todas formas si el empalme es intencional (por ejemplo, servicios que no requieren atención continua)." />

    <HelpStep number={3} title="Editar o cancelar una cita"
      body="Haz clic sobre cualquier cita existente para abrir su detalle. Desde ahí puedes modificar los datos o cancelarla. Las citas canceladas no se eliminan; quedan registradas con ese estado para auditoría." />

    <HelpStep number={4} title="Enviar recordatorios por WhatsApp"
      body="En la barra superior de la Agenda hay un ícono de WhatsApp. Al hacer clic se abre un panel con todas las citas del día visible. Puedes seleccionar los clientes a los que deseas enviar recordatorio y hacer el envío con un solo clic. También puedes enviarlo individualmente desde el detalle de cada cita." />

    <SectionTitle>Sincronización con Google Calendar</SectionTitle>
    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      Si tienes Google Calendar configurado en Ajustes, las citas se sincronizan automáticamente con la cuenta
      del salón. Las citas con una nube (☁) en su esquina están sincronizadas. Si una cita tiene un ícono
      de advertencia, significa que está pendiente de sincronizar (puede ocurrir si no hay conexión a internet).
    </p>

    <CalloutBox icon={<Cloud size={16} />} variant="info" title="¿No ves citas de fechas futuras lejanas?">
      Al conectar por primera vez, el sistema importa citas de los últimos 7 días y los próximos 60 días.
      Para importar citas más lejanas, usa el botón <strong>"Importar"</strong> que aparece en el banner
      de conexión de Google dentro de la Agenda.
    </CalloutBox>

    <SectionTitle>Alertas de voz</SectionTitle>
    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      El sistema cuenta con un lector de voz (TTS). Cuando falten pocos minutos para una cita,
      Luma emitirá un sonido y anunciará en voz alta el nombre del cliente y el servicio.
      Puedes configurar el tiempo de anticipación y el tipo de alerta en Configuración → General.
    </p>
  </GuideWrapper>
)

// ── PUNTO DE VENTA ───────────────────────────────────────────────────────────
const PosGuide = () => (
  <GuideWrapper
    icon={<ShoppingCart className="text-accent" />}
    title="Punto de Venta (POS)"
    subtitle="Registra cobros, asigna comisiones y emite comprobantes desde una sola pantalla."
  >
    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      El POS está dividido en dos columnas: a la izquierda el carrito de la venta actual, y a la
      derecha el historial de ventas del día. La pantalla está diseñada para usarse rápidamente,
      incluso con el teclado solamente.
    </p>

    <SectionTitle>Registrar una venta paso a paso</SectionTitle>

    <HelpStep number={1} title="Seleccionar al cliente (opcional)"
      body="Escribe el nombre o teléfono del cliente en el campo de búsqueda y selecciónalo de la lista. Si el cliente no está registrado, puedes hacer la venta sin asignar uno. Asociar el cliente permite llevar un historial de visitas." />

    <HelpStep number={2} title="Agregar servicios al carrito"
      body="Usa el campo de búsqueda de servicios para agregar lo que se realizó. Puedes buscar por nombre parcial. Cada línea del carrito muestra el nombre del servicio, su precio y un selector de empleados." />

    <HelpStep number={3} title="Asignar quién realizó cada servicio"
      body="En cada línea del carrito, selecciona el especialista (o especialistas) que realizó ese servicio. Si varios participaron, agrégalos todos usando el botón '+'. Esto es fundamental para el cálculo correcto de comisiones. El porcentaje de trabajo de cada uno se puede ajustar manualmente." />

    <HelpStep number={4} title="Aplicar pagos"
      body="En la sección de pagos, elige el método: Efectivo, Tarjeta o Transferencia. Si el cliente pagó con varios métodos (por ejemplo, parte en efectivo y parte con tarjeta), agrega cada uno por separado. El sistema valida que la suma de los pagos cubra el total antes de permitir guardar." />

    <HelpStep number={5} title="Guardar la venta"
      body='Haz clic en "Guardar venta". El sistema genera automáticamente un folio (V-00001, V-00002…), registra la venta en caja, y calcula las comisiones de cada especialista. Verás un banner verde con el folio de la venta al completarse.' tip="Presiona F2 para limpiar el carrito e iniciar una nueva venta. El folio de la venta anterior permanece visible hasta que inicies una nueva." />

    <SectionTitle>Factura oficial con IVA</SectionTitle>
    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      Si el cliente requiere un comprobante fiscal, activa el interruptor <strong style={{ color: 'var(--color-text)' }}>"Requiere factura oficial"</strong> antes de guardar.
      El sistema aplicará el porcentaje de IVA configurado en Ajustes y lo sumará al subtotal.
      Este impuesto <em>no</em> se aplica en ventas normales; solo cuando se activa explícitamente.
    </p>

    <SectionTitle>Modo de Comisión Activo</SectionTitle>
    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      En la parte superior del buscador de servicios verás un banner que indica el modo de cálculo actual:
    </p>
    <ul className="list-disc ml-5 mt-2 text-xs flex flex-col gap-1" style={{ color: 'var(--color-text-muted)' }}>
      <li><strong style={{ color: 'var(--color-text)' }}>Modo A — Simple:</strong> Cada colaborador recibe su % de comisión íntegro.</li>
      <li><strong style={{ color: 'var(--color-text)' }}>Modo B — Proporcional:</strong> La comisión se divide automáticamente según el número de colaboradores.</li>
      <li><strong style={{ color: 'var(--color-text)' }}>Modo C — Manual:</strong> Permite asignar porcentajes específicos por persona y descuenta el overhead configurado.</li>
    </ul>

    <SectionTitle>Historial de ventas</SectionTitle>
    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      La columna derecha muestra las ventas del día actual. Puedes hacer clic en cualquier venta para
      ver su detalle completo, incluyendo los servicios, los especialistas asignados y los pagos.
      Desde el detalle también puedes cancelar una venta si fue registrada por error.
    </p>

    <CalloutBox icon={<AlertTriangle size={16} />} variant="warning" title="Sobre las cancelaciones">
      Cancelar una venta no la elimina. Queda registrada con estado "Cancelada" y el sistema genera
      automáticamente los movimientos de caja inversos para corregir el saldo. No necesitas hacer
      nada manual en Caja después de cancelar.
    </CalloutBox>

    <SectionTitle>Atajos de teclado</SectionTitle>
    <div className="flex flex-col gap-2">
      <KeyboardShortcut keys={['F2']} desc="Limpiar carrito e iniciar nueva venta" />
      <KeyboardShortcut keys={['ESC']} desc="Cancelar búsqueda activa" />
    </div>
  </GuideWrapper>
)

// ── COMISIONES ───────────────────────────────────────────────────────────────
const CommissionsGuide = () => (
  <GuideWrapper
    icon={<BadgeDollarSign className="text-accent" />}
    title="Comisiones"
    subtitle="Calcula y registra la distribución de ingresos al personal de forma automática."
  >
    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      El módulo de Comisiones permite realizar el cuadre periódico para pagar a los colaboradores y jefes.
      Está dividido en <strong style={{ color: 'var(--color-text)' }}>Nuevo cuadre</strong> (cálculo actual)
      e <strong style={{ color: 'var(--color-text)' }}>Historial</strong> (auditoría de pagos pasados).
    </p>

    <SectionTitle>Lógica de Asociación y Reparto</SectionTitle>
    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      Luma utiliza un modelo de asociación donde el precio total del servicio se reparte íntegramente
      entre quienes participaron en él:
    </p>
    <div className="flex flex-col gap-2 p-4 rounded-xl border mt-2"
         style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
        <strong style={{ color: 'var(--color-text)' }}>Colaborador Auxiliar:</strong> recibe su <code>% de comisión</code> directo sobre el precio del servicio.
      </p>
      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
        <strong style={{ color: 'var(--color-text)' }}>Jefe del servicio (Owner):</strong> recibe el <code>remanente total</code> (Precio − comisiones de auxiliares).
      </p>
      <p className="text-xs mt-1 italic" style={{ color: 'var(--color-text-muted)' }}>
        El "jefe" es el responsable del servicio y quien absorbe los costos de insumos y renta del salón.
      </p>
    </div>

    <SectionTitle>Generar un nuevo cuadre</SectionTitle>

    <HelpStep number={1} title="Seleccionar periodo y opciones"
      body="Elige el rango de fechas. Si deseas que en este corte se pague también el sueldo base mensual de los empleados, activa el chip '¿Incluir sueldos base?'. Si ya lo pagaste en un corte anterior, déjalo desactivado para calcular solo comisiones." />

    <CalloutBox icon={<Info size={16} />} variant="info" title="Diferencia entre Comisiones y Sueldos">
      <ul className="list-disc ml-5 text-[10px] flex flex-col gap-1">
        <li><strong>Solo Comisiones:</strong> Ideal para pagos semanales o quincenales basados solo en productividad.</li>
        <li><strong>Con Sueldos Base:</strong> Ideal para cortes donde se pagan sueldos base. Suma el 'sueldo base' configurado en la ficha de cada empleado al total de sus comisiones del periodo.</li>
      </ul>
    </CalloutBox>

    <HelpStep number={2} title="Revisar el pre-cuadre"
      body="Verás el total facturado y el 'Total a repartir' (que incluye comisiones + sueldos si se activaron). La tabla por empleado es colapsable; haz clic para ver el detalle de cada ticket, fecha y si el empleado actuó como Jefe o Auxiliar." />

    <HelpStep number={3} title="Confirmar y auditar"
      body="Al confirmar, se genera un registro histórico. El sistema marcará esos servicios como pagados para que no vuelvan a aparecer en futuros cuadres." />

    <SectionTitle>Historial y Auditoría Inteligente</SectionTitle>
    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      En la pestaña Historial puedes buscar pagos específicos usando los filtros:
    </p>
    <ul className="list-disc ml-5 mt-2 text-xs flex flex-col gap-1" style={{ color: 'var(--color-text-muted)' }}>
      <li><strong style={{ color: 'var(--color-text)' }}>Por empleado:</strong> Selecciona un colaborador para ver solo los cuadres donde recibió dinero. Al abrir el detalle, el sistema filtrará y expandirá automáticamente la información de ese empleado.</li>
      <li><strong style={{ color: 'var(--color-text)' }}>Por fecha:</strong> Filtra para auditar periodos específicos (meses o años pasados).</li>
      <li><strong style={{ color: 'var(--color-text)' }}>Detalle colapsable:</strong> Los reportes históricos ahora se agrupan por empleado, permitiendo ver de un vistazo cuánto fue comisión y cuánto sueldo base.</li>
    </ul>

    <CalloutBox icon={<Zap size={16} />} variant="tip" title="Cuadres parciales">
      Puedes hacer cuadres en cualquier momento. Si haces un cuadre a mediodía y luego hay más ventas, al hacer un nuevo cuadre por la tarde, el sistema solo incluirá las ventas nuevas que quedaron pendientes.
    </CalloutBox>
  </GuideWrapper>
)

// ── CONTROL DE CAJA ──────────────────────────────────────────────────────────
const CashGuide = () => (
  <GuideWrapper
    icon={<Vault className="text-accent" />}
    title="Control de Caja"
    subtitle="Transparencia total de los ingresos y egresos del día."
  >
    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      La caja es el registro financiero del día. Cada venta que se realiza en el POS genera
      automáticamente un movimiento de ingreso en la caja abierta. Solo puede haber una caja
      abierta a la vez.
    </p>

    <HelpStep number={1} title="Abrir la caja al inicio del día"
      body="Al entrar al módulo de Caja, si no hay ninguna abierta, verás el formulario de apertura. Ingresa el monto de efectivo con el que inicias (el 'fondo de caja'). Este valor es tu punto de partida para el conteo al cierre." />

    <HelpStep number={2} title="Registrar movimientos manuales"
      body="Durante el día pueden ocurrir salidas de efectivo que no son ventas: pago de un proveedor, compra de material, propina al equipo, etc. Regístralos con el botón 'Nuevo movimiento'. Elige la categoría, el tipo (Entrada o Salida) y el monto. Esto mantiene el saldo esperado actualizado." />

    <HelpStep number={3} title="Cerrar la caja al final del turno"
      body="Haz clic en 'Cerrar caja'. Verás cuánto espera el sistema que tengas en efectivo según las ventas y movimientos. Ingresa el monto real que estás contando. Si hay diferencia, el sistema la muestra claramente. Agrega notas si es necesario y confirma el cierre." />

    <SectionTitle>Ver el resumen de la caja</SectionTitle>
    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      Con la caja abierta, puedes ver en tiempo real el desglose de ingresos por método de pago
      (efectivo, tarjeta, transferencia) y el listado completo de movimientos del día con su categoría.
    </p>

    <CalloutBox icon={<AlertTriangle size={16} />} variant="warning" title="Ventas canceladas">
      Si cancelas una venta desde el POS, el sistema genera automáticamente movimientos de salida
      en la caja para compensar el ingreso original. No necesitas registrar nada manual.
    </CalloutBox>

    <SectionTitle>Historial de cajas cerradas</SectionTitle>
    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      En la parte inferior del módulo puedes consultar todos los cierres de caja anteriores.
      Cada registro muestra el período, el saldo esperado, el declarado, y la diferencia.
    </p>
  </GuideWrapper>
)

// ── PERSONAL ─────────────────────────────────────────────────────────────────
const EmployeesGuide = () => (
  <GuideWrapper
    icon={<Users className="text-accent" />}
    title="Personal"
    subtitle="Administra a tu equipo, sus roles y sus tasas de comisión."
  >
    <SectionTitle>Roles del personal</SectionTitle>
    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      Cada integrante del equipo tiene uno de dos roles:
    </p>
    <div className="grid grid-cols-2 gap-3 mt-2">
      <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <div className="flex items-center gap-2 mb-2">
          <Users size={14} style={{ color: 'var(--color-info)' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Empleado</p>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
          Especialista que realiza servicios. Debe tener un salario base y un porcentaje de comisión.
          Recibe su comisión calculada sobre el precio de los servicios que realiza.
        </p>
      </div>
      <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <div className="flex items-center gap-2 mb-2">
          <Crown size={14} style={{ color: 'var(--color-accent)' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Owner (Jefe)</p>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
          Dueño o responsable principal. El salario puede ser cero. Recibe el remanente del precio
          del servicio después de pagar las comisiones de los auxiliares.
        </p>
      </div>
    </div>

    <SectionTitle>Crear o editar un empleado</SectionTitle>
    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      Haz clic en <strong style={{ color: 'var(--color-text)' }}>"Nuevo empleado"</strong> en la esquina superior derecha.
      El formulario pide nombre, apellido, rol, teléfono, porcentaje de comisión y salario base.
      También puedes asignar un <strong style={{ color: 'var(--color-text)' }}>color de agenda</strong> que se usará para identificar
      sus citas en el calendario y en Google Calendar.
    </p>

    <CalloutBox icon={<Info size={16} />} variant="info" title="Historial de cambios en tasas">
      Cada vez que modificas el porcentaje de comisión o el salario de un empleado, el sistema
      guarda automáticamente un registro del cambio anterior con la fecha. Esto garantiza que
      los cuadres históricos reflejen las condiciones del momento en que se generaron.
    </CalloutBox>

    <SectionTitle>Desactivar un empleado</SectionTitle>
    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      Si alguien ya no trabaja en el salón, usa el botón de encendido/apagado (⏻) en la tabla para
      desactivarlo. Un empleado inactivo no aparecerá en el POS ni en la Agenda, pero conserva
      todo su historial de ventas y comisiones.
    </p>
  </GuideWrapper>
)

// ── SERVICIOS ────────────────────────────────────────────────────────────────
const ServicesGuide = () => (
  <GuideWrapper
    icon={<Scissors className="text-accent" />}
    title="Servicios y Categorías"
    subtitle="El catálogo de lo que ofrece tu salón, organizado y listo para usar en el POS."
  >
    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      Este módulo tiene dos pestañas: <strong style={{ color: 'var(--color-text)' }}>Servicios</strong> con el listado completo, y
      <strong style={{ color: 'var(--color-text)' }}> Categorías</strong> para agruparlos. Puedes filtrar la lista por categoría
      o buscar por nombre en la barra de filtros.
    </p>

    <SectionTitle>Crear una categoría</SectionTitle>
    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      Antes de crear servicios, es recomendable tener al menos una categoría. Ve a la pestaña
      <strong style={{ color: 'var(--color-text)' }}> Categorías</strong> y haz clic en <strong style={{ color: 'var(--color-text)' }}>"Nueva categoría"</strong>.
      Asigna un nombre (por ejemplo: "Cabello", "Uñas", "Spa") y un color. El color ayuda a
      identificarlas visualmente en el catálogo.
    </p>

    <SectionTitle>Crear un servicio</SectionTitle>
    <HelpStep number={1} title="Datos básicos"
      body='Haz clic en "Nuevo servicio". Completa el nombre, la descripción (opcional), el precio y la duración en minutos. La duración se usa en la Agenda para calcular automáticamente la hora de fin de una cita.' />
    <HelpStep number={2} title="Asignar categoría"
      body="Selecciona la categoría a la que pertenece el servicio. Solo aparecerán las categorías activas." />
    <HelpStep number={3} title="Asignar jefe del servicio (Owner)"
      body='En el campo "Jefe del servicio" puedes asignar cuál de los empleados con rol Owner es el responsable de este servicio. Esto determina quién recibe el remanente en el cálculo de comisiones. Si lo dejas vacío, el sistema solo calculará comisiones para los auxiliares asignados en el POS.' />

    <CalloutBox icon={<Crown size={16} />} variant="tip" title="¿Por qué asignar un jefe en el servicio?">
      El jefe del servicio se asigna aquí, en el catálogo, <em>no</em> en cada venta. Esto permite
      que el sistema calcule automáticamente quién recibe el remanente sin que tengas que especificarlo
      en cada cobro del POS.
    </CalloutBox>

    <SectionTitle>Desactivar un servicio</SectionTitle>
    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      Si ya no ofreces un servicio, desactívalo con el botón (⏻) en la tabla. No aparecerá en el POS
      ni en la Agenda, pero el historial de ventas que lo incluyen se conserva intacto.
      Activa "Ver inactivos" en los filtros si necesitas recuperarlo.
    </p>
  </GuideWrapper>
)

// ── CLIENTES ─────────────────────────────────────────────────────────────────
const ClientsGuide = () => (
  <GuideWrapper
    icon={<UserRound className="text-accent" />}
    title="Clientes"
    subtitle="Tu base de datos de clientes con historial de visitas y datos de contacto."
  >
    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      Mantener el directorio de clientes actualizado te permite agendar citas más rápido, llevar
      un seguimiento de su frecuencia de visita y enviarles recordatorios por WhatsApp.
    </p>

    <SectionTitle>Agregar un cliente</SectionTitle>
    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      Haz clic en <strong style={{ color: 'var(--color-text)' }}>"Nuevo cliente"</strong>. El formulario incluye:
    </p>
    <div className="flex flex-col gap-2 mt-2">
      {[
        { label: 'Nombre y apellido', desc: 'Requeridos. Se usan en todas las pantallas y notificaciones.' },
        { label: 'Teléfono', desc: 'Necesario para enviar recordatorios de WhatsApp. Incluye el código de país.' },
        { label: 'Correo electrónico', desc: 'Opcional. Para contacto por email.' },
        { label: 'Fecha de nacimiento', desc: 'Opcional. Aparece en la lista con un ícono 🎂 para que no olvides felicitarlos.' },
        { label: 'Datos de facturación', desc: 'RFC y razón social. Solo es necesario si el cliente solicita facturas fiscales.' },
      ].map((f, i) => (
        <div key={i} className="flex items-start gap-3 text-xs py-2 border-b last:border-b-0"
             style={{ borderColor: 'var(--color-border)' }}>
          <strong className="w-40 flex-shrink-0" style={{ color: 'var(--color-text)' }}>{f.label}</strong>
          <span style={{ color: 'var(--color-text-muted)' }}>{f.desc}</span>
        </div>
      ))}
    </div>

    <SectionTitle>Buscar un cliente</SectionTitle>
    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      La barra de búsqueda en la parte superior acepta nombre, teléfono o correo electrónico.
      La búsqueda es instantánea conforme escribes.
    </p>

    <SectionTitle>Historial de visitas</SectionTitle>
    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      En la tabla verás cuántas visitas ha tenido cada cliente y la fecha de su última visita.
      Esta información se actualiza automáticamente cada vez que se registra una venta asociada a ese cliente en el POS.
    </p>

    <CalloutBox icon={<Receipt size={16} />} variant="tip" title="Datos de facturación">
      Si un cliente tiene RFC y razón social registrados, aparecerá el badge <strong>"Con datos"</strong>
      en la columna de Facturación. Esto facilita identificar rápidamente quién puede solicitar
      factura oficial antes de abrir el POS.
    </CalloutBox>
  </GuideWrapper>
)

// ── INVENTARIO ───────────────────────────────────────────────────────────────
const InventoryGuide = () => (
  <GuideWrapper
    icon={<Package className="text-accent" />}
    title="Inventario de Productos"
    subtitle="Control de insumos y productos de venta con alertas de stock bajo."
  >
    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      El inventario es una lista de los productos físicos del salón, ya sea para uso interno
      (tintes, shampoos) o para venta al público. El módulo no descuenta automáticamente el stock
      al hacer una venta; los ajustes se hacen manualmente.
    </p>

    <SectionTitle>Agregar un producto</SectionTitle>
    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      Haz clic en <strong style={{ color: 'var(--color-text)' }}>"Nuevo producto"</strong>. Completa el nombre, la descripción opcional, el precio de venta o costo,
      la cantidad actual en existencia y el <strong style={{ color: 'var(--color-text)' }}>stock mínimo</strong>. Este último es el umbral a partir
      del cual el sistema emitirá una alerta.
    </p>

    <SectionTitle>Ajustar el stock</SectionTitle>
    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      No necesitas editar el producto completo para cambiar la cantidad. En la tabla, usa el botón
      <strong style={{ color: 'var(--color-text)' }}> "Ajustar"</strong> de la fila del producto. Puedes sumar o restar unidades e indicar
      el motivo (por ejemplo: "Llegó pedido", "Rotura", "Venta directa"). Los ajustes quedan
      registrados para trazabilidad.
    </p>

    <SectionTitle>Alertas de stock bajo</SectionTitle>
    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      Cuando un producto cae por debajo de su stock mínimo, aparece resaltado en la tabla del
      inventario y también se muestra una alerta en el <strong style={{ color: 'var(--color-text)' }}>Dashboard</strong> con el número de
      productos en esa condición. Haz clic en la alerta del Dashboard para ir directamente al inventario.
    </p>

    <CalloutBox icon={<AlertTriangle size={16} />} variant="warning" title="Productos inactivos">
      Desactivar un producto lo oculta de la lista principal, pero conserva su historial de ajustes.
      Usa el filtro <strong>"Ver inactivos"</strong> si necesitas reactivarlo o consultarlo.
    </CalloutBox>
  </GuideWrapper>
)

// ── CONFIGURACIÓN ─────────────────────────────────────────────────────────────
const SettingsGuide = () => (
  <GuideWrapper
    icon={<Settings className="text-accent" />}
    title="Configuración"
    subtitle="Personaliza Luma para que se adapte al identidad y operación de tu salón."
  >
    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      La pantalla de Configuración está organizada en cinco pestañas. A continuación se explica qué puedes hacer en cada una.
    </p>

    <SectionTitle>Pestaña: General</SectionTitle>
    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      Aquí configuras el nombre del salón, la moneda (MXN, USD, EUR) y el porcentaje de IVA que se aplica
      cuando una venta requiere factura oficial. El nombre del salón aparece en el menú lateral de la aplicación.
    </p>

    <SectionTitle>Pestaña: Apariencia</SectionTitle>
    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      Elige entre tres modos: <strong style={{ color: 'var(--color-text)' }}>Oscuro</strong>, <strong style={{ color: 'var(--color-text)' }}>Claro</strong> o <strong style={{ color: 'var(--color-text)' }}>Personalizado</strong>.
      El modo Personalizado te permite ajustar individualmente los colores de fondo, superficie, borde,
      acento, textos y estados (éxito, error, advertencia, info) usando un selector de color. Los cambios
      se aplican en tiempo real.
    </p>

    <SectionTitle>Pestaña: Google Calendar</SectionTitle>
    <HelpStep number={1} title="Obtener las credenciales"
      body="Ve a Google Cloud Console, crea un proyecto, habilita la Google Calendar API y genera credenciales de tipo 'Aplicación de escritorio'. Copia el Client ID y el Client Secret." />
    <HelpStep number={2} title="Ingresar las credenciales en Luma"
      body="Pega el Client ID y Client Secret en los campos correspondientes y guarda. Asegúrate también de agregar http://localhost:3737/callback como URI de redirección en tu proyecto de Google Cloud." />
    <HelpStep number={3} title="Conectar la cuenta"
      body='Una vez guardadas las credenciales, ve al módulo de Agenda y haz clic en el botón "Conectar Google". Se abrirá el navegador para que autorices el acceso. Tras la autorización, las citas comenzarán a sincronizarse automáticamente.' />

    <SectionTitle>Pestaña: WhatsApp</SectionTitle>
    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      Escanea el código QR con el teléfono del salón para vincular WhatsApp. Una vez conectado,
      puedes configurar los recordatorios automáticos (1, 3 y 7 días antes de la cita), los
      mensajes personalizados para cada tipo de recordatorio, la pausa entre mensajes para evitar
      bloqueos (recomendado: mínimo 12 segundos) y los horarios en los que se permiten envíos.
    </p>

    <SectionTitle>Pestaña: Comisiones</SectionTitle>
    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      Define cómo el sistema debe calcular el pago a tus colaboradores. Puedes elegir entre:
    </p>
    <ul className="list-disc ml-5 mt-2 text-xs flex flex-col gap-1" style={{ color: 'var(--color-text-muted)' }}>
      <li><strong style={{ color: 'var(--color-text)' }}>Modo Simple:</strong> Pago íntegro por servicio.</li>
      <li><strong style={{ color: 'var(--color-text)' }}>Proporcional Automático:</strong> Reparto equitativo si participan varios especialistas.</li>
      <li><strong style={{ color: 'var(--color-text)' }}>Proporcional Manual:</strong> Permite ajuste fino por colaborador y definir una <strong>Reserva para Insumos (Overhead)</strong>.</li>
    </ul>

    <CalloutBox icon={<AlertTriangle size={16} />} variant="warning" title="Importante: Transparencia con el equipo">
      Si utilizas la <strong>Reserva para Insumos (Overhead)</strong>, el sistema descontará ese porcentaje del precio total antes de calcular el 40%, 30%, etc. del colaborador. 
      Esto se utiliza para cubrir el costo de materiales (tintes, productos) y debe ser acordado con el colaborador para evitar confusiones sobre su pago neto.
    </CalloutBox>

    <SectionTitle>Pestaña: Sistema</SectionTitle>
    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      Desde aquí puedes <strong style={{ color: 'var(--color-text)' }}>exportar</strong> una copia de seguridad de toda la base de datos
      en un archivo <code>.db</code>, e <strong style={{ color: 'var(--color-text)' }}>importar</strong> una copia previamente guardada para restaurar
      la información. También puedes consultar la bitácora de errores del sistema para diagnosticar
      cualquier problema técnico.
    </p>

    <CalloutBox icon={<ShieldCheck size={16} />} variant="warning" title="Respaldo semanal recomendado">
      Exporta la base de datos al menos una vez por semana y guarda el archivo en un lugar seguro
      (nube, USB). Si el equipo falla, podrás restaurar toda la información desde la copia de seguridad.
    </CalloutBox>
  </GuideWrapper>
)

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTES REUTILIZABLES
// ─────────────────────────────────────────────────────────────────────────────

const GuideWrapper: React.FC<{
  icon: React.ReactNode
  title: string
  subtitle: string
  children: React.ReactNode
}> = ({ icon, title, subtitle, children }) => (
  <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
    <div className="flex flex-col gap-1">
      <h2 className="text-2xl font-bold font-display flex items-center gap-3" style={{ color: 'var(--color-text)' }}>
        {icon} {title}
      </h2>
      <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{subtitle}</p>
    </div>
    {children}
  </div>
)

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="text-sm font-bold uppercase tracking-wider pt-2"
      style={{ color: 'var(--color-accent)' }}>
    {children}
  </h3>
)

const HelpStep: React.FC<{
  number: number
  title: string
  body: string
  tip?: string
}> = ({ number, title, body, tip }) => (
  <div className="flex gap-4 group">
    <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all"
         style={{
           background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)',
           border: '1px solid color-mix(in srgb, var(--color-accent) 40%, transparent)',
           color: 'var(--color-accent)',
         }}>
      {number}
    </div>
    <div className="flex flex-col gap-1 pt-0.5 flex-1">
      <h4 className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>{title}</h4>
      <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>{body}</p>
      {tip && (
        <div className="mt-1.5 text-[11px] font-medium flex items-center gap-1" style={{ color: 'var(--color-info)' }}>
          <ArrowRight size={11} /> {tip}
        </div>
      )}
    </div>
  </div>
)

const CalloutBox: React.FC<{
  icon: React.ReactNode
  title: string
  children: React.ReactNode
  variant: 'info' | 'warning' | 'tip'
}> = ({ icon, title, children, variant }) => {
  const colors = {
    info:    { border: 'var(--color-info)',    bg: 'color-mix(in srgb, var(--color-info) 10%, transparent)',    text: 'var(--color-info)' },
    warning: { border: 'var(--color-warning)', bg: 'color-mix(in srgb, var(--color-warning) 10%, transparent)', text: 'var(--color-warning)' },
    tip:     { border: 'var(--color-accent)',  bg: 'color-mix(in srgb, var(--color-accent) 10%, transparent)',  text: 'var(--color-accent)' },
  }[variant]

  return (
    <div className="rounded-xl p-4 border-l-4 flex gap-3"
         style={{ borderLeftColor: colors.border, background: colors.bg }}>
      <span className="flex-shrink-0 mt-0.5" style={{ color: colors.text }}>{icon}</span>
      <div>
        <p className="text-xs font-bold mb-1" style={{ color: colors.text }}>{title}</p>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>{children}</p>
      </div>
    </div>
  )
}

const KeyboardShortcut: React.FC<{ keys: string[]; desc: string }> = ({ keys, desc }) => (
  <div className="flex items-center gap-3 text-xs">
    <div className="flex gap-1 flex-shrink-0">
      {keys.map((k, i) => (
        <kbd key={i} className="px-2 py-1 rounded text-xs font-mono font-semibold"
             style={{
               background: 'var(--color-surface-2)',
               border: '1px solid var(--color-border)',
               color: 'var(--color-text)',
             }}>
          {k}
        </kbd>
      ))}
    </div>
    <span style={{ color: 'var(--color-text-muted)' }}>{desc}</span>
  </div>
)
