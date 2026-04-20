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
  ChevronDown, ChevronUp, Keyboard, Trash2, RotateCcw,
} from 'lucide-react'
import { PageHeader } from '../components/ui/index'

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

export const HelpPage: React.FC = () => {
  const [activeCat, setActiveCat] = useState<HelpCategory>('intro')
  const [searchQuery, setSearchQuery] = useState('')

  const categories: { id: HelpCategory; label: string; icon: React.ReactNode }[] = [
    { id: 'intro',       label: 'Introducción',    icon: <BookOpen size={15} /> },
    { id: 'dashboard',   label: 'Dashboard',       icon: <LayoutDashboard size={15} /> },
    { id: 'agenda',      label: 'Agenda y Citas',  icon: <Calendar size={15} /> },
    { id: 'pos',         label: 'Punto de Venta',  icon: <ShoppingCart size={15} /> },
    { id: 'commissions', label: 'Comisiones',      icon: <BadgeDollarSign size={15} /> },
    { id: 'cash',        label: 'Control de Caja', icon: <Vault size={15} /> },
    { id: 'employees',   label: 'Personal',        icon: <Users size={15} /> },
    { id: 'services',    label: 'Servicios',       icon: <Scissors size={15} /> },
    { id: 'clients',     label: 'Clientes',        icon: <UserRound size={15} /> },
    { id: 'inventory',   label: 'Inventario',      icon: <Package size={15} /> },
    { id: 'settings',    label: 'Configuracion',   icon: <Settings size={15} /> },
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
        subtitle="Guias detalladas para cada modulo de Luma"
        icon={<HelpCircle size={18} />}
      />
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-60 border-r flex flex-col flex-shrink-0" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
          <div className="p-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
              <Search size={12} style={{ color: 'var(--color-text-muted)' }} />
              <input type="text" placeholder="Buscar modulo..." value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-transparent text-xs outline-none flex-1" style={{ color: 'var(--color-text)' }} />
            </div>
          </div>
          <nav className="flex flex-col gap-0.5 p-2 overflow-y-auto flex-1">
            {filteredCats.map(cat => (
              <button key={cat.id} onClick={() => { setActiveCat(cat.id); setSearchQuery('') }}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all w-full text-left"
                style={activeCat === cat.id ? { background: 'var(--color-accent)', color: '#fff' } : { color: 'var(--color-text-muted)' }}>
                {cat.icon}
                <span className="font-medium flex-1">{cat.label}</span>
                {activeCat === cat.id && <ChevronRight size={12} className="ml-auto flex-shrink-0" />}
              </button>
            ))}
          </nav>
          <div className="p-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Luma App</p>
          </div>
        </aside>
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

// ── INTRODUCCION ──────────────────────────────────────────────────────────────
const IntroGuide = () => (
  <GuideWrapper icon={<BookOpen className="text-accent" />} title="Bienvenido a Luma"
    subtitle="Todo lo que necesitas para gestionar tu salon, en un solo lugar.">
    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      Luma es una aplicacion de escritorio pensada para salones de belleza. Conecta tus citas, ventas,
      comisiones, inventario y comunicacion con clientes sin que tengas que saltar entre varias herramientas.
    </p>
    <SectionTitle>Por donde empezar</SectionTitle>
    <div className="flex flex-col gap-0 mt-2">
      {[
        { icon: <Vault size={16} />,        step: '1. Abrir caja',        desc: 'Antes de registrar cualquier venta, abre la caja del dia desde el modulo de Caja.' },
        { icon: <Calendar size={16} />,     step: '2. Consultar agenda',  desc: 'Revisa las citas programadas para el dia y confirma quien esta disponible.' },
        { icon: <ShoppingCart size={16} />, step: '3. Registrar ventas',  desc: 'Cobra los servicios en el Punto de Venta y asigna que especialista realizo cada uno.' },
        { icon: <BadgeDollarSign size={16} />, step: '4. Cerrar caja',    desc: 'Al final del turno, cuenta el efectivo y cierra la caja para obtener el resumen del dia.' },
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
    <SectionTitle>Modulos disponibles</SectionTitle>
    <div className="grid grid-cols-2 gap-3">
      {[
        { icon: <LayoutDashboard size={14} />, label: 'Dashboard',      desc: 'Estadisticas y KPIs del negocio.' },
        { icon: <Calendar size={14} />,        label: 'Agenda',         desc: 'Citas y sincronizacion con Google.' },
        { icon: <ShoppingCart size={14} />,    label: 'Punto de Venta', desc: 'Cobros, pagos mixtos y facturas.' },
        { icon: <BadgeDollarSign size={14} />, label: 'Comisiones',     desc: 'Cuadre y pago al personal.' },
        { icon: <Vault size={14} />,           label: 'Caja',           desc: 'Apertura, cierre y movimientos.' },
        { icon: <Users size={14} />,           label: 'Personal',       desc: 'Empleados y tasas de comision.' },
        { icon: <Scissors size={14} />,        label: 'Servicios',      desc: 'Catalogo de servicios y categorias.' },
        { icon: <UserRound size={14} />,       label: 'Clientes',       desc: 'Base de datos de clientes.' },
        { icon: <Package size={14} />,         label: 'Inventario',     desc: 'Productos e insumos con alertas.' },
        { icon: <Settings size={14} />,        label: 'Configuracion',  desc: 'Ajustes, temas, WhatsApp y Papelera.' },
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
    <CalloutBox icon={<Smartphone size={16} />} variant="info" title="Automatizacion con WhatsApp">
      Vincula el telefono del salon en Configuracion y Luma enviara recordatorios de citas
      automaticamente 1, 3 y 7 dias antes. No necesitas escribir nada manualmente.
    </CalloutBox>
  </GuideWrapper>
)

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
const DashboardGuide = () => (
  <GuideWrapper icon={<LayoutDashboard className="text-accent" />} title="Dashboard"
    subtitle="El resumen diario y mensual de tu negocio a primera vista.">
    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      Al abrir el Dashboard veras un panel con indicadores clave del periodo seleccionado.
      Por defecto muestra el mes en curso, pero puedes cambiar las fechas con los selectores en la esquina superior derecha.
    </p>
    <SectionTitle>Que muestra cada tarjeta</SectionTitle>
    <div className="flex flex-col gap-3">
      {[
        { icon: <TrendingUp size={14} />,      color: 'var(--color-accent)',   label: 'Ingresos del periodo',  desc: 'Suma de todas las ventas completadas. Tambien muestra cuantas ventas se realizaron.' },
        { icon: <BadgeDollarSign size={14} />, color: 'var(--color-warning)',  label: 'Comisiones totales',    desc: 'El monto acumulado que se le debe al personal por sus servicios en el periodo.' },
        { icon: <Users size={14} />,           color: 'var(--color-info)',     label: 'Clientes unicos',       desc: 'Cuantos clientes distintos tuvieron al menos una venta en el periodo.' },
        { icon: <ShoppingCart size={14} />,    color: 'var(--color-success)',  label: 'Ventas realizadas',     desc: 'Numero total de facturas generadas, incluyendo cuantas fueron canceladas.' },
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
    <CalloutBox icon={<RefreshCw size={16} />} variant="tip" title="Actualizar datos">
      Si acabas de registrar una venta y los datos no se han actualizado, usa el boton de refresco
      en la barra de acciones para recargar el panel manualmente.
    </CalloutBox>
  </GuideWrapper>
)

// ── AGENDA ────────────────────────────────────────────────────────────────────
const AgendaGuide = () => (
  <GuideWrapper icon={<Calendar className="text-accent" />} title="Agenda y Citas"
    subtitle="Gestiona el tiempo de tus especialistas y manten informados a tus clientes.">
    <SectionTitle>Vista general</SectionTitle>
    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      La Agenda muestra un calendario con vistas de Semana y Mes. Las citas aparecen coloreadas segun el especialista asignado.
    </p>
    <HelpStep number={1} title="Crear una nueva cita"
      body="Haz clic en cualquier espacio vacio del calendario. Se abrira un formulario donde debes seleccionar el cliente, el servicio, el especialista y la fecha y hora de inicio. La duracion se calcula automaticamente segun el servicio elegido." />
    <HelpStep number={2} title="Editar o cancelar una cita"
      body="Haz clic sobre cualquier cita existente para abrir su detalle. Desde ahi puedes modificar los datos o cancelarla. Las citas canceladas quedan en la Papelera para auditoria y posible restauracion." />
    <HelpStep number={3} title="Enviar recordatorios por WhatsApp"
      body="En la barra superior de la Agenda hay un icono de WhatsApp. Al hacer clic se abre un panel con todas las citas del dia visible. Puedes seleccionar los clientes a los que deseas enviar recordatorio y hacer el envio con un solo clic." />
    <SectionTitle>Sincronizacion con Google Calendar</SectionTitle>
    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      Si tienes Google Calendar configurado, las citas se sincronizan automaticamente con la cuenta del salon.
    </p>
    <CalloutBox icon={<Cloud size={16} />} variant="info" title="Primera sincronizacion">
      Al conectar por primera vez, el sistema importa citas de los ultimos 7 dias y los proximos 60 dias.
    </CalloutBox>
  </GuideWrapper>
)

// ── PUNTO DE VENTA ────────────────────────────────────────────────────────────
const PosGuide = () => (
  <GuideWrapper icon={<ShoppingCart className="text-accent" />} title="Punto de Venta (POS)"
    subtitle="Registra cobros, asigna comisiones y emite comprobantes desde una sola pantalla.">
    <HelpStep number={1} title="Seleccionar al cliente (opcional)"
      body="Escribe el nombre o telefono del cliente en el campo de busqueda y seleccionalo de la lista." />
    <HelpStep number={2} title="Agregar servicios al carrito"
      body="Usa el campo de busqueda de servicios para agregar lo que se realizo. Cada linea muestra el nombre del servicio, su precio y un selector de empleados." />
    <HelpStep number={3} title="Asignar quien realizo cada servicio"
      body="En cada linea del carrito, selecciona el especialista que realizo ese servicio. Si varios participaron, agregarlos todos es fundamental para el calculo correcto de comisiones." />
    <HelpStep number={4} title="Aplicar pagos y guardar"
      body='Elige el metodo de pago (Efectivo, Tarjeta o Transferencia) y haz clic en "Guardar venta". El sistema genera automaticamente un folio, registra la venta en caja y calcula las comisiones.' />
    <SectionTitle>Atajos de teclado</SectionTitle>
    <div className="flex flex-col gap-2">
      <KeyboardShortcut keys={['F2']} desc="Limpiar carrito e iniciar nueva venta" />
      <KeyboardShortcut keys={['ESC']} desc="Cancelar busqueda activa" />
    </div>
  </GuideWrapper>
)

// ── COMISIONES ────────────────────────────────────────────────────────────────
const CommissionsGuide = () => (
  <GuideWrapper icon={<BadgeDollarSign className="text-accent" />} title="Comisiones"
    subtitle="Calcula y registra la distribucion de ingresos al personal de forma automatica.">
    <SectionTitle>Logica de reparto</SectionTitle>
    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      Colaborador auxiliar recibe su porcentaje de comision sobre el precio. El jefe del servicio (Owner) recibe el remanente total despues de pagar las comisiones de los auxiliares.
    </p>
    <HelpStep number={1} title="Seleccionar periodo" body="Elige el rango de fechas y si deseas incluir sueldos base en este corte." />
    <HelpStep number={2} title="Revisar el pre-cuadre" body="Veras el total facturado y la tabla por empleado con el detalle de cada ticket." />
    <HelpStep number={3} title="Confirmar y auditar" body="Al confirmar, se genera un registro historico. El sistema marca esos servicios como pagados." />
    <CalloutBox icon={<Zap size={16} />} variant="tip" title="Cuadres parciales">
      Puedes hacer cuadres en cualquier momento. Los nuevos cuadres solo incluiran ventas pendientes.
    </CalloutBox>
  </GuideWrapper>
)

// ── CONTROL DE CAJA ───────────────────────────────────────────────────────────
const CashGuide = () => (
  <GuideWrapper icon={<Vault className="text-accent" />} title="Control de Caja"
    subtitle="Transparencia total de los ingresos y egresos del dia.">
    <HelpStep number={1} title="Abrir la caja al inicio del dia" body="Ingresa el monto de efectivo con el que inicias. Este valor es tu punto de partida para el conteo al cierre." />
    <HelpStep number={2} title="Registrar movimientos manuales" body="Pagos a proveedores, compras de material, propinas, etc. Registralos con el boton Nuevo movimiento para mantener el saldo actualizado." />
    <HelpStep number={3} title="Cerrar la caja al final del turno" body="Ingresa el monto real que estas contando. El sistema mostrara si hay diferencia versus el saldo esperado." />
    <CalloutBox icon={<AlertTriangle size={16} />} variant="warning" title="Ventas canceladas">
      Si cancelas una venta desde el POS, el sistema genera automaticamente movimientos de caja inversos. No necesitas registrar nada manual.
    </CalloutBox>
  </GuideWrapper>
)

// ── PERSONAL ──────────────────────────────────────────────────────────────────
const EmployeesGuide = () => (
  <GuideWrapper icon={<Users className="text-accent" />} title="Personal"
    subtitle="Administra a tu equipo, sus roles, datos y tasas de comision.">

    <SectionTitle>Roles del personal</SectionTitle>
    <div className="grid grid-cols-2 gap-3 mt-2">
      <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <div className="flex items-center gap-2 mb-2"><Users size={14} style={{ color: 'var(--color-info)' }} /><p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Empleado</p></div>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>Especialista que realiza servicios. Recibe su comision calculada sobre el precio de los servicios que realiza.</p>
      </div>
      <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <div className="flex items-center gap-2 mb-2"><Crown size={14} style={{ color: 'var(--color-accent)' }} /><p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Owner (Jefe)</p></div>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>Dueno o responsable principal. Recibe el remanente del precio del servicio despues de pagar comisiones de auxiliares.</p>
      </div>
    </div>

    <SectionTitle>Datos del formulario</SectionTitle>
    <div className="flex flex-col gap-0">
      {[
        { label: 'Nombre y apellido',  desc: 'Requeridos. Se usan en todas las pantallas, reportes de comisiones y recordatorios de citas.' },
        { label: 'Telefono',           desc: 'Opcional. Util como dato de contacto interno del salon.' },
        { label: 'Fecha de ingreso',   desc: 'Opcional. Permite saber desde cuando trabaja cada persona en el salon y llevar un registro de antiguedad.' },
        { label: 'Sueldo base',        desc: 'Monto fijo mensual del colaborador. Se suma a las comisiones cuando activas la opcion "Incluir sueldos base" al generar un cuadre de comisiones.' },
        { label: 'Comision (%)',       desc: 'Porcentaje que recibe el colaborador sobre el precio de cada servicio que realiza como auxiliar. Ejemplo: si el servicio cuesta $500 y su comision es 30%, recibe $150.' },
        { label: 'Color de agenda',    desc: 'Color que identifica al colaborador en el calendario de la Agenda y en Google Calendar. Facilita ver de un vistazo quien tiene cada cita sin leer el nombre.' },
      ].map((f, i) => (
        <div key={i} className="flex items-start gap-3 text-xs py-3 border-b last:border-b-0" style={{ borderColor: 'var(--color-border)' }}>
          <strong className="w-36 flex-shrink-0 pt-0.5" style={{ color: 'var(--color-text)' }}>{f.label}</strong>
          <span className="leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>{f.desc}</span>
        </div>
      ))}
    </div>

    <SectionTitle>Desactivar un empleado</SectionTitle>
    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      Si alguien ya no trabaja en el salon, usa el boton de encendido/apagado en la tabla para desactivarlo.
      Un empleado inactivo no aparecera en el POS ni en la Agenda, pero conserva todo su historial de ventas y comisiones.
      Activa "Ver inactivos" en los filtros si necesitas reactivarlo.
    </p>

    <CalloutBox icon={<Info size={16} />} variant="info" title="Historial de cambios en tasas">
      Cada vez que modificas el porcentaje de comision o el sueldo base, el sistema guarda automaticamente
      un registro del valor anterior con la fecha. Esto garantiza que los cuadres historicos reflejen
      las condiciones del momento en que se generaron.
    </CalloutBox>
  </GuideWrapper>
)

// ── SERVICIOS ─────────────────────────────────────────────────────────────────
const ServicesGuide = () => (
  <GuideWrapper icon={<Scissors className="text-accent" />} title="Servicios y Categorias"
    subtitle="El catalogo de lo que ofrece tu salon, organizado y listo para usar en el POS.">
    <HelpStep number={1} title="Crear una categoria" body='Ve a la pestana Categorias y haz clic en "Nueva categoria". Asigna un nombre y un color para identificarla visualmente.' />
    <HelpStep number={2} title="Crear un servicio" body='Haz clic en "Nuevo servicio". Completa el nombre, precio y duracion en minutos. La duracion se usa en la Agenda para calcular la hora de fin de la cita.' />
    <HelpStep number={3} title="Asignar jefe del servicio" body='En el campo "Jefe del servicio" asigna cual de los empleados Owner es el responsable. Esto determina quien recibe el remanente en el calculo de comisiones.' />
    <CalloutBox icon={<Crown size={16} />} variant="tip" title="Por que asignar un jefe en el servicio">
      El jefe se asigna en el catalogo, no en cada venta. Esto permite que el sistema calcule automaticamente quien recibe el remanente sin que tengas que especificarlo en cada cobro.
    </CalloutBox>
  </GuideWrapper>
)

// ── CLIENTES ──────────────────────────────────────────────────────────────────
const ClientsGuide = () => (
  <GuideWrapper icon={<UserRound className="text-accent" />} title="Clientes"
    subtitle="Tu base de datos de clientes con historial de visitas y datos de contacto.">
    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      Mantener el directorio actualizado te permite agendar citas mas rapido y enviar recordatorios por WhatsApp.
    </p>
    <SectionTitle>Campos del formulario</SectionTitle>
    <div className="flex flex-col gap-2 mt-2">
      {[
        { label: 'Nombre y apellido', desc: 'Requeridos. Se usan en todas las pantallas y notificaciones.' },
        { label: 'Telefono', desc: 'Necesario para enviar recordatorios de WhatsApp. Incluye el codigo de pais.' },
        { label: 'Fecha de nacimiento', desc: 'Opcional. Aparece con un icono de cumpleanos para no olvidar felicitarlos.' },
        { label: 'Datos de facturacion', desc: 'RFC y razon social. Solo si el cliente solicita facturas fiscales.' },
      ].map((f, i) => (
        <div key={i} className="flex items-start gap-3 text-xs py-2 border-b last:border-b-0" style={{ borderColor: 'var(--color-border)' }}>
          <strong className="w-40 flex-shrink-0" style={{ color: 'var(--color-text)' }}>{f.label}</strong>
          <span style={{ color: 'var(--color-text-muted)' }}>{f.desc}</span>
        </div>
      ))}
    </div>
  </GuideWrapper>
)

// ── INVENTARIO ────────────────────────────────────────────────────────────────
const InventoryGuide = () => (
  <GuideWrapper icon={<Package className="text-accent" />} title="Inventario de Productos"
    subtitle="Control de insumos y productos de venta con alertas de stock bajo.">
    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      El inventario no descuenta automaticamente el stock al hacer una venta; los ajustes se hacen manualmente.
    </p>
    <HelpStep number={1} title="Agregar un producto" body='Haz clic en "Nuevo producto". Completa el nombre, precio, cantidad actual y el stock minimo que dispara la alerta.' />
    <HelpStep number={2} title="Ajustar el stock" body='En la tabla, usa el boton "Ajustar" de la fila del producto para sumar o restar unidades e indicar el motivo. Los ajustes quedan registrados.' />
    <CalloutBox icon={<AlertTriangle size={16} />} variant="warning" title="Alertas de stock bajo">
      Cuando un producto cae por debajo de su stock minimo, aparece una alerta en el Dashboard.
    </CalloutBox>
  </GuideWrapper>
)

// ── CONFIGURACION ─────────────────────────────────────────────────────────────
const SettingsGuide = () => (
  <GuideWrapper icon={<Settings className="text-accent" />} title="Configuracion"
    subtitle="Personaliza Luma para que se adapte a la identidad y operacion de tu salon.">
    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      La pantalla de Configuracion esta organizada en siete pestanas. A continuacion se explica que puedes hacer en cada una.
    </p>

    <SectionTitle>Pestana: General</SectionTitle>
    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      Aqui configuras el nombre del salon, la moneda (MXN, USD, EUR) y el porcentaje de IVA que se aplica
      cuando una venta requiere factura oficial.
    </p>

    <SectionTitle>Pestana: Apariencia</SectionTitle>
    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      Elige entre tres modos: Oscuro, Claro o Personalizado. El modo Personalizado te permite ajustar
      individualmente los colores de fondo, superficie, borde, acento y textos. Los cambios se aplican en tiempo real.
    </p>

    <SectionTitle>Pestana: Google Calendar</SectionTitle>
    <HelpStep number={1} title="Obtener las credenciales"
      body="Ve a Google Cloud Console, crea un proyecto, habilita la Google Calendar API y genera credenciales de tipo 'Aplicacion de escritorio'. Copia el Client ID y el Client Secret." />
    <HelpStep number={2} title="Ingresar las credenciales en Luma"
      body="Pega el Client ID y Client Secret en los campos correspondientes y guarda. Agrega http://localhost:3737/callback como URI de redireccion en tu proyecto de Google Cloud." />
    <HelpStep number={3} title="Conectar la cuenta"
      body='Una vez guardadas las credenciales, ve al modulo de Agenda y haz clic en "Conectar Google". Se abrira el navegador para que autorices el acceso.' />

    <SectionTitle>Pestana: Comisiones</SectionTitle>
    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      Define como el sistema debe calcular el pago a tus colaboradores: Modo Simple (pago integro),
      Proporcional Automatico (reparto equitativo) o Proporcional Manual (ajuste fino por colaborador con overhead opcional).
    </p>

    <SectionTitle>Pestana: WhatsApp</SectionTitle>
    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      Escanea el codigo QR con el telefono del salon para vincular WhatsApp. Una vez conectado configura
      los recordatorios automaticos (1, 3 y 7 dias antes), las plantillas de mensaje y la pausa entre envios
      (minimo 12 segundos recomendado para evitar bloqueos).
    </p>

    <SectionTitle>Pestana: Sistema</SectionTitle>
    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      Exporta o importa la base de datos completa como archivo de respaldo. Tambien puedes consultar
      la bitacora de eventos del sistema para diagnosticar problemas tecnicos y vaciar el archivo de log.
    </p>
    <CalloutBox icon={<ShieldCheck size={16} />} variant="warning" title="Respaldo semanal recomendado">
      Exporta la base de datos al menos una vez por semana y guarda el archivo en un lugar seguro.
      Si el equipo falla, podras restaurar toda la informacion desde la copia de seguridad.
    </CalloutBox>

    <SectionTitle>Pestana: Papelera de citas</SectionTitle>
    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      Cada vez que se cancela una cita en la Agenda, el sistema guarda automaticamente una copia
      completa del registro antes de marcarla como cancelada. Esto sirve para dos propositos:
    </p>
    <div className="grid grid-cols-2 gap-3 mt-1">
      <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <div className="flex items-center gap-2 mb-2">
          <ClipboardList size={14} style={{ color: 'var(--color-info)' }} />
          <p className="text-xs font-semibold" style={{ color: 'var(--color-text)' }}>Auditoria</p>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
          Queda un registro permanente de cuando fue cancelada cada cita, que datos tenia y desde
          que parte del sistema se cancelo. Util para resolver disputas o revisar el historial del salon.
        </p>
      </div>
      <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <div className="flex items-center gap-2 mb-2">
          <RotateCcw size={14} style={{ color: 'var(--color-success)' }} />
          <p className="text-xs font-semibold" style={{ color: 'var(--color-text)' }}>Restauracion</p>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
          Si una cita fue cancelada por error, puedes recuperarla con un solo clic. El sistema
          crea una nueva cita identica y la envia a sincronizar con Google Calendar automaticamente.
        </p>
      </div>
    </div>
    <HelpStep number={1} title="Ver la papelera"
      body="Ve a Configuracion y abre la pestana Papelera. Veras la tabla con todas las citas canceladas que aun no han sido restauradas, ordenadas de la mas reciente a la mas antigua." />
    <HelpStep number={2} title="Restaurar una cita"
      body="Haz clic en el boton verde con el icono de restaurar en la fila de la cita que deseas recuperar. Aparecera un modal de confirmacion con los datos de la cita. Confirma y la cita volvera a la Agenda como nueva." />
    <HelpStep number={3} title="Que pasa despues de restaurar"
      body="La cita restaurada aparece en la Agenda con todos sus datos originales: cliente, empleado, servicio, color y horario. Si tienes Google Calendar conectado, se sincroniza automaticamente. La entrada en la papelera se marca como restaurada y desaparece de la lista." />
    <CalloutBox icon={<Trash2 size={16} />} variant="info" title="Las citas canceladas no se borran">
      Cancelar una cita nunca elimina el registro original de la base de datos. Solo cambia su estado
      a cancelada y guarda el snapshot en la papelera. Esto garantiza trazabilidad total sin importar
      cuanto tiempo haya pasado.
    </CalloutBox>
  </GuideWrapper>
)

// ── COMPONENTES REUTILIZABLES ─────────────────────────────────────────────────
const GuideWrapper: React.FC<{ icon: React.ReactNode; title: string; subtitle: string; children: React.ReactNode }> = ({ icon, title, subtitle, children }) => (
  <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
    <div className="flex flex-col gap-1">
      <h2 className="text-2xl font-bold flex items-center gap-3" style={{ color: 'var(--color-text)' }}>{icon} {title}</h2>
      <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{subtitle}</p>
    </div>
    {children}
  </div>
)

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="text-sm font-bold uppercase tracking-wider pt-2" style={{ color: 'var(--color-accent)' }}>{children}</h3>
)

const HelpStep: React.FC<{ number: number; title: string; body: string; tip?: string }> = ({ number, title, body, tip }) => (
  <div className="flex gap-4">
    <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
         style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--color-accent) 40%, transparent)', color: 'var(--color-accent)' }}>
      {number}
    </div>
    <div className="flex flex-col gap-1 pt-0.5 flex-1">
      <h4 className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>{title}</h4>
      <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>{body}</p>
      {tip && <div className="mt-1.5 text-[11px] font-medium flex items-center gap-1" style={{ color: 'var(--color-info)' }}><ArrowRight size={11} /> {tip}</div>}
    </div>
  </div>
)

const CalloutBox: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode; variant: 'info' | 'warning' | 'tip' }> = ({ icon, title, children, variant }) => {
  const colors = {
    info:    { border: 'var(--color-info)',    bg: 'color-mix(in srgb, var(--color-info) 10%, transparent)',    text: 'var(--color-info)' },
    warning: { border: 'var(--color-warning)', bg: 'color-mix(in srgb, var(--color-warning) 10%, transparent)', text: 'var(--color-warning)' },
    tip:     { border: 'var(--color-accent)',  bg: 'color-mix(in srgb, var(--color-accent) 10%, transparent)',  text: 'var(--color-accent)' },
  }[variant]
  return (
    <div className="rounded-xl p-4 border-l-4 flex gap-3" style={{ borderLeftColor: colors.border, background: colors.bg }}>
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
             style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
          {k}
        </kbd>
      ))}
    </div>
    <span style={{ color: 'var(--color-text-muted)' }}>{desc}</span>
  </div>
)
