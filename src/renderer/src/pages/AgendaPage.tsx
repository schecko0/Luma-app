import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  CalendarDays, ChevronLeft, ChevronRight, Plus, RefreshCw,
  Wifi, WifiOff, Settings, AlertCircle, Check, Loader2,
  Calendar, LayoutGrid,
} from 'lucide-react'
import type { Appointment, Employee } from '../types'
import { PageHeader, Spinner, Badge } from '../components/ui/index'
import { AppointmentModal } from '../components/agenda/AppointmentModal'
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  addDays, addWeeks, addMonths, subWeeks, subMonths,
  format, isSameDay, isSameMonth, parseISO, isToday,
} from 'date-fns'
import { es } from 'date-fns/locale'

// Colores Google Calendar → CSS
const GC_HEX: Record<string, string> = {
  tomato: '#d50000', flamingo: '#e67c73', tangerine: '#f6891f', banana: '#f6bf26',
  sage: '#33b679', basil: '#0f9d58', peacock: '#039be5', blueberry: '#3f51b5',
  lavender: '#7986cb', grape: '#8d24aa', graphite: '#616161',
}

const aptColor = (apt: Appointment) =>
  GC_HEX[apt.color ?? ''] ?? GC_HEX[apt.employee_color ?? ''] ?? 'var(--color-accent)'

type CalView = 'week' | 'month'

// ─────────────────────────────────────────────────────────────────────────────
export const AgendaPage: React.FC = () => {
  const [view, setView]               = useState<CalView>('week')
  const [current, setCurrent]         = useState(new Date())
  const [appointments, setAppts]      = useState<Appointment[]>([])
  const [employees, setEmployees]     = useState<Employee[]>([])
  const [loading, setLoading]         = useState(true)
  const [syncing, setSyncing]         = useState(false)
  const [gcStatus, setGcStatus]       = useState<{ connected: boolean; has_credentials: boolean }>({ connected: false, has_credentials: false })
  const [syncMsg, setSyncMsg]         = useState<string | null>(null)
  const [connecting, setConnecting]   = useState(false)
  // Modal de cita
  const [modalOpen, setModalOpen]     = useState(false)
  const [editingApt, setEditingApt]   = useState<Appointment | null>(null)
  const [defaultStart, setDefStart]   = useState<string | undefined>()

  // Rango de fechas visible según la vista
  const { rangeFrom, rangeTo } = useMemo(() => {
    if (view === 'week') {
      return {
        rangeFrom: format(startOfWeek(current, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        rangeTo:   format(endOfWeek(current, { weekStartsOn: 1 }),   'yyyy-MM-dd'),
      }
    }
    return {
      rangeFrom: format(startOfMonth(current), 'yyyy-MM-dd'),
      rangeTo:   format(endOfMonth(current),   'yyyy-MM-dd'),
    }
  }, [current, view])

  // Carga de citas y empleados
  const loadAppointments = useCallback(async () => {
    setLoading(true)
    try {
      const [aptRes, empRes, gcRes] = await Promise.all([
        window.electronAPI.calendar.listAppointments(rangeFrom, rangeTo),
        window.electronAPI.employees.all(),
        window.electronAPI.calendar.getStatus(),
      ])
      if (aptRes.ok) setAppts(aptRes.data as Appointment[])
      if (empRes.ok) setEmployees(empRes.data as Employee[])
      if (gcRes.ok)  setGcStatus(gcRes.data as { connected: boolean; has_credentials: boolean })
    } finally { setLoading(false) }
  }, [rangeFrom, rangeTo])

  useEffect(() => { loadAppointments() }, [loadAppointments])

  // Navegación
  const prev = () => setCurrent(v => view === 'week' ? subWeeks(v, 1) : subMonths(v, 1))
  const next = () => setCurrent(v => view === 'week' ? addWeeks(v, 1) : addMonths(v, 1))
  const goToday = () => setCurrent(new Date())

  // Abrir modal para nueva cita
  const openNew = (startISO?: string) => {
    setEditingApt(null)
    setDefStart(startISO)
    setModalOpen(true)
  }

  // Abrir modal para editar cita
  const openEdit = (apt: Appointment) => {
    setEditingApt(apt)
    setDefStart(undefined)
    setModalOpen(true)
  }

  // Conectar Google Calendar
  const handleConnect = async () => {
    setConnecting(true); setSyncMsg(null)
    try {
      const res = await window.electronAPI.calendar.connect()
      if (!res.ok) { setSyncMsg(`Error: ${res.error}`); return }
      setSyncMsg('¡Conectado correctamente!')
      loadAppointments()
    } catch (e) { setSyncMsg(String(e)) }
    finally { setConnecting(false) }
  }

  // Sincronizar manualmente
  const handleSync = async () => {
    setSyncing(true); setSyncMsg(null)
    try {
      const res = await window.electronAPI.calendar.sync()
      if (!res.ok) { setSyncMsg(`Error: ${res.error}`); return }
      const { synced, errors } = res.data as { synced: number; errors: number; total: number }
      setSyncMsg(`Sincronizadas: ${synced}${errors > 0 ? ` · Errores: ${errors}` : ''}`)
      loadAppointments()
    } catch (e) { setSyncMsg(String(e)) }
    finally { setSyncing(false) }
  }

  // Título del período visible
  const periodLabel = view === 'week'
    ? `${format(startOfWeek(current, { weekStartsOn: 1 }), 'd MMM', { locale: es })} – ${format(endOfWeek(current, { weekStartsOn: 1 }), 'd MMM yyyy', { locale: es })}`
    : format(current, 'MMMM yyyy', { locale: es }).replace(/^\w/, c => c.toUpperCase())

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Agenda"
        subtitle={periodLabel}
        icon={<CalendarDays size={18} />}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {/* Navegación */}
            <button onClick={prev} className="luma-btn-ghost p-2"><ChevronLeft size={16} /></button>
            <button onClick={goToday} className="luma-btn text-xs px-3 py-1.5 border"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>Hoy</button>
            <button onClick={next} className="luma-btn-ghost p-2"><ChevronRight size={16} /></button>

            {/* Toggle vista */}
            <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'var(--color-border)' }}>
              {(['week', 'month'] as CalView[]).map(v => (
                <button key={v} onClick={() => setView(v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors"
                  style={{
                    background: view === v ? 'var(--color-accent)' : 'transparent',
                    color:      view === v ? 'white' : 'var(--color-text-muted)',
                  }}>
                  {v === 'week' ? <><LayoutGrid size={12} /> Semana</> : <><Calendar size={12} /> Mes</>}
                </button>
              ))}
            </div>

            {/* Sincronización */}
            {gcStatus.connected ? (
              <button onClick={handleSync} disabled={syncing} className="luma-btn text-xs px-3 py-1.5 border"
                style={{ borderColor: 'var(--color-success)', color: 'var(--color-success)', background: 'transparent' }}>
                {syncing ? <><Loader2 size={12} className="animate-spin" /> Sincronizando...</> : <><Wifi size={12} /> Sincronizar</>}
              </button>
            ) : gcStatus.has_credentials ? (
              <button onClick={handleConnect} disabled={connecting}
                className="luma-btn text-xs px-3 py-1.5 border"
                style={{ borderColor: 'var(--color-warning)', color: 'var(--color-warning)', background: 'transparent' }}>
                {connecting ? <><Loader2 size={12} className="animate-spin" /> Conectando...</> : <><WifiOff size={12} /> Conectar Google</>}
              </button>
            ) : (
              <Badge variant="muted"><Settings size={10} /> Configura credenciales en Ajustes</Badge>
            )}

            <button onClick={() => openNew()} className="luma-btn-primary text-xs">
              <Plus size={14} /> Nueva cita
            </button>
          </div>
        }
      />

      {/* Mensaje de sincronización */}
      {syncMsg && (
        <div className="mx-6 mt-2 rounded-lg px-4 py-2 text-xs flex items-center gap-2"
             style={{
               background: syncMsg.startsWith('Error') ? 'color-mix(in srgb,var(--color-danger) 12%,transparent)' : 'color-mix(in srgb,var(--color-success) 12%,transparent)',
               color:      syncMsg.startsWith('Error') ? 'var(--color-danger)' : 'var(--color-success)',
             }}>
          {syncMsg.startsWith('Error') ? <AlertCircle size={12} /> : <Check size={12} />}
          {syncMsg}
        </div>
      )}

      {/* Cuerpo del calendario */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center h-full"><Spinner size={32} /></div>
        ) : view === 'week' ? (
          <WeekView
            current={current}
            appointments={appointments}
            employees={employees}
            onClickSlot={startISO => openNew(startISO)}
            onClickApt={openEdit}
          />
        ) : (
          <MonthView
            current={current}
            appointments={appointments}
            onClickDay={d => openNew(d.toISOString())}
            onClickApt={openEdit}
          />
        )}
      </div>

      {/* Modal de cita */}
      <AppointmentModal
        isOpen={modalOpen}
        initial={editingApt}
        defaultStart={defaultStart}
        employees={employees}
        onClose={() => setModalOpen(false)}
        onSaved={loadAppointments}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Vista semanal — columnas por día, filas por hora
// ─────────────────────────────────────────────────────────────────────────────
const HOURS = Array.from({ length: 15 }, (_, i) => i + 7) // 7:00 → 21:00
const HOUR_H = 56 // px por hora

const WeekView: React.FC<{
  current: Date
  appointments: Appointment[]
  employees: Employee[]
  onClickSlot: (startISO: string) => void
  onClickApt: (apt: Appointment) => void
}> = ({ current, appointments, employees, onClickSlot, onClickApt }) => {
  const weekStart = startOfWeek(current, { weekStartsOn: 1 })
  const days      = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const aptsByDay = (day: Date) =>
    appointments.filter(a => isSameDay(parseISO(a.start_at), day))

  const aptTop = (apt: Appointment) => {
    const d = parseISO(apt.start_at)
    return ((d.getHours() - 7) + d.getMinutes() / 60) * HOUR_H
  }
  const aptHeight = (apt: Appointment) => {
    const start = parseISO(apt.start_at)
    const end   = parseISO(apt.end_at)
    const mins  = (end.getTime() - start.getTime()) / 60000
    return Math.max((mins / 60) * HOUR_H, 24)
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Columna de horas */}
      <div className="flex-shrink-0 w-14 overflow-hidden" style={{ paddingTop: 40 }}>
        <div style={{ position: 'relative', height: HOURS.length * HOUR_H }}>
          {HOURS.map(h => (
            <div key={h}
              className="absolute left-0 right-0 text-right pr-2 text-xs"
              style={{ top: (h - 7) * HOUR_H - 8, color: 'var(--color-text-muted)' }}>
              {h}:00
            </div>
          ))}
        </div>
      </div>

      {/* Días */}
      <div className="flex-1 overflow-auto">
        {/* Cabecera días */}
        <div className="grid grid-cols-7 sticky top-0 z-10 border-b"
             style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', height: 40 }}>
          {days.map(day => (
            <div key={day.toISOString()}
              className="flex flex-col items-center justify-center text-xs font-medium border-r"
              style={{
                borderColor: 'var(--color-border)',
                color: isToday(day) ? 'var(--color-accent)' : 'var(--color-text-muted)',
              }}>
              <span>{format(day, 'EEE', { locale: es }).toUpperCase()}</span>
              <span className={`text-base font-bold mt-0.5 ${isToday(day) ? 'text-accent' : ''}`}
                    style={{ color: isToday(day) ? 'var(--color-accent)' : 'var(--color-text)' }}>
                {format(day, 'd')}
              </span>
            </div>
          ))}
        </div>

        {/* Grilla */}
        <div className="grid grid-cols-7" style={{ position: 'relative', height: HOURS.length * HOUR_H }}>
          {/* Líneas de hora horizontales */}
          {HOURS.map(h => (
            <React.Fragment key={h}>
              {days.map((_, di) => (
                <div key={di}
                  className="border-r border-b"
                  style={{
                    position: 'absolute',
                    left:     `${(di / 7) * 100}%`,
                    top:      (h - 7) * HOUR_H,
                    width:    `${100 / 7}%`,
                    height:   HOUR_H,
                    borderColor: 'var(--color-border)',
                  }}
                  onClick={() => {
                    const d = new Date(days[di])
                    d.setHours(h, 0, 0, 0)
                    onClickSlot(d.toISOString())
                  }}
                />
              ))}
            </React.Fragment>
          ))}

          {/* Eventos */}
          {days.map((day, di) =>
            aptsByDay(day).map(apt => (
              <div key={apt.id}
                onClick={e => { e.stopPropagation(); onClickApt(apt) }}
                className="absolute rounded-lg px-1.5 py-1 text-white text-xs cursor-pointer overflow-hidden shadow-sm hover:opacity-90 transition-opacity"
                style={{
                  left:       `calc(${(di / 7) * 100}% + 2px)`,
                  width:      `calc(${100 / 7}% - 4px)`,
                  top:        aptTop(apt),
                  height:     aptHeight(apt),
                  background: aptColor(apt),
                  zIndex:     2,
                }}>
                <p className="font-medium truncate leading-tight">{apt.title}</p>
                {apt.client_name && (
                  <p className="opacity-80 truncate text-xs leading-tight">{apt.client_name}</p>
                )}
                <p className="opacity-70 text-xs leading-tight">
                  {format(parseISO(apt.start_at), 'H:mm')}–{format(parseISO(apt.end_at), 'H:mm')}
                </p>
                {apt.sync_status === 'synced' && (
                  <span className="absolute top-0.5 right-0.5 text-white/70 text-xs">☁</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Vista mensual — cuadrícula de días
// ─────────────────────────────────────────────────────────────────────────────
const MonthView: React.FC<{
  current: Date
  appointments: Appointment[]
  onClickDay: (d: Date) => void
  onClickApt: (apt: Appointment) => void
}> = ({ current, appointments, onClickDay, onClickApt }) => {
  // Construir semanas del mes (lunes a domingo)
  const monthStart = startOfMonth(current)
  const gridStart  = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd    = endOfWeek(endOfMonth(current), { weekStartsOn: 1 })

  const weeks: Date[][] = []
  let day = gridStart
  while (day <= gridEnd) {
    const week: Date[] = []
    for (let i = 0; i < 7; i++) { week.push(day); day = addDays(day, 1) }
    weeks.push(week)
  }

  const aptsByDay = (d: Date) => appointments.filter(a => isSameDay(parseISO(a.start_at), d))

  return (
    <div className="flex flex-col h-full overflow-hidden p-4 gap-2">
      {/* Cabecera de días de la semana */}
      <div className="grid grid-cols-7 text-center">
        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
          <div key={d} className="text-xs font-medium py-1" style={{ color: 'var(--color-text-muted)' }}>{d}</div>
        ))}
      </div>

      {/* Semanas */}
      <div className="flex-1 grid overflow-hidden" style={{ gridTemplateRows: `repeat(${weeks.length}, 1fr)` }}>
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-t" style={{ borderColor: 'var(--color-border)' }}>
            {week.map((d, di) => {
              const apts    = aptsByDay(d)
              const inMonth = isSameMonth(d, current)
              return (
                <div key={di}
                  className="border-r p-1 cursor-pointer hover:bg-white/5 transition-colors overflow-hidden flex flex-col"
                  style={{ borderColor: 'var(--color-border)', opacity: inMonth ? 1 : 0.35 }}
                  onClick={() => onClickDay(d)}>
                  {/* Número del día */}
                  <div className="flex items-center justify-center mb-1">
                    <span className="text-xs w-6 h-6 flex items-center justify-center rounded-full font-medium"
                          style={{
                            background: isToday(d) ? 'var(--color-accent)' : 'transparent',
                            color:      isToday(d) ? 'white' : 'var(--color-text-muted)',
                          }}>
                      {format(d, 'd')}
                    </span>
                  </div>
                  {/* Citas del día (máx 3 visibles) */}
                  <div className="flex flex-col gap-0.5 overflow-hidden">
                    {apts.slice(0, 3).map(apt => (
                      <div key={apt.id}
                        onClick={e => { e.stopPropagation(); onClickApt(apt) }}
                        className="rounded text-white text-xs px-1 truncate cursor-pointer hover:opacity-80"
                        style={{ background: aptColor(apt), fontSize: 10, lineHeight: '16px' }}>
                        {format(parseISO(apt.start_at), 'H:mm')} {apt.title}
                      </div>
                    ))}
                    {apts.length > 3 && (
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)', fontSize: 10 }}>
                        +{apts.length - 3} más
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
