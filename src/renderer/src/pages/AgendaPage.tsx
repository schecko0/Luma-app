import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  CalendarDays, ChevronLeft, ChevronRight, Plus,
  Wifi, WifiOff, Settings2, AlertCircle, Check, Loader2,
  Calendar, LayoutGrid, LogOut, RefreshCw, Bell, BellOff,
  Cloud, CloudOff, CloudAlert, Link2, MessageCircle,
} from 'lucide-react'
import type { Appointment, Employee } from '../types'
import { PageHeader, Spinner, Badge } from '../components/ui/index'
import { Modal } from '../components/ui/Modal'
import { AppointmentModal } from '../components/agenda/AppointmentModal'
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  addDays, addWeeks, addMonths, subWeeks, subMonths,
  format, isSameDay, isSameMonth, parseISO, isToday,
} from 'date-fns'
import { WhatsAppPreviewModal } from '../components/agenda/WhatsAppPreviewModal'
import { es } from 'date-fns/locale'

const GC_HEX: Record<string, string> = {
  tomato: '#d50000', flamingo: '#e67c73', tangerine: '#f6891f', banana: '#f6bf26',
  sage: '#33b679', basil: '#0f9d58', peacock: '#039be5', blueberry: '#3f51b5',
  lavender: '#7986cb', grape: '#8d24aa', graphite: '#616161',
}

const getSyncIcon = (status: string) => {
  switch (status) {
    case 'synced':       return <Cloud size={10} className="text-white/80" />
    case 'pending_sync': return <RefreshCw size={10} className="text-white/80 animate-spin-slow" />
    case 'local':        return <CloudOff size={10} className="text-white/60" />
    default:             return <CloudAlert size={10} className="text-white" />
  }
}

const aptColor = (apt: Appointment) => {
  if (!apt.employee_id && !apt.color) return '#4b5563'
  return GC_HEX[apt.color ?? ''] ?? GC_HEX[apt.employee_color ?? ''] ?? 'var(--color-accent)'
}

type CalView = 'week' | 'month'
interface GcStatus { connected: boolean; has_credentials: boolean; connected_at: string | null; calendar_id: string }
interface WaStatus { status: string; phone: string | null }

// ── Sistema de Alertas ────────────────────────────────────────────────────────
function playChime() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const now = ctx.currentTime
    const osc1 = ctx.createOscillator(); const osc2 = ctx.createOscillator()
    const gain = ctx.createGain()
    osc1.frequency.setValueAtTime(523.25, now)
    osc2.frequency.setValueAtTime(659.25, now)
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.2, now + 0.1)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5)
    osc1.connect(gain); osc2.connect(gain); gain.connect(ctx.destination)
    osc1.start(now); osc2.start(now); osc1.stop(now + 1.5); osc2.stop(now + 1.5)
  } catch (_) {}
}

function speakAlert(text: string) {
  if (!window.speechSynthesis) return
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'es-MX'; u.rate = 0.9; u.pitch = 1
  window.speechSynthesis.speak(u)
}

function showDesktopNotification(title: string, body: string) {
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.ico' })
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(p => {
      if (p === 'granted') new Notification(title, { body })
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
export const AgendaPage: React.FC = () => {
  const [view, setView]             = useState<CalView>('week')
  const [current, setCurrent]       = useState(new Date())
  const [appointments, setAppts]    = useState<Appointment[]>([])
  const [employees, setEmployees]   = useState<Employee[]>([])
  const [loading, setLoading]       = useState(true)
  const [syncing, setSyncing]       = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconn] = useState(false)
  const [gcStatus, setGcStatus]     = useState<GcStatus>({ connected: false, has_credentials: false, connected_at: null, calendar_id: 'primary' })
  const [waStatus, setWaStatus]     = useState<WaStatus>({ status: 'disconnected', phone: null })
  const [toast, setToast]           = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [waBulkOpen, setWaBulkOpen] = useState(false)
  const [waBulkIds, setWaBulkIds]   = useState<number[]>([])
  const [modalOpen, setModalOpen]   = useState(false)
  const [editingApt, setEditingApt] = useState<Appointment | null>(null)
  const [defaultStart, setDefStart] = useState<string | undefined>()
  const [cancelConfirm, setCancelConfirm] = useState<{ onConfirm: () => void; type: 'cancel-apt' | 'disconnect-gc' } | null>(null)
  const [pastDateConfirm, setPastDateConfirm] = useState<string | null>(null)
  const [alertsEnabled, setAlerts]  = useState(true)
  const alertedIds                  = useRef<Set<number>>(new Set())
  const alertTimerRef               = useRef<ReturnType<typeof setInterval> | null>(null)
  const allAptsRef                  = useRef<Appointment[]>([])

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  const { rangeFrom, rangeTo } = useMemo(() => {
    if (view === 'week') return {
      rangeFrom: format(startOfWeek(current, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      rangeTo:   format(endOfWeek(current,   { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    }
    return {
      rangeFrom: format(startOfMonth(current), 'yyyy-MM-dd'),
      rangeTo:   format(endOfMonth(current),   'yyyy-MM-dd'),
    }
  }, [current, view])

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const today   = format(new Date(), 'yyyy-MM-dd')
      const in7days = format(addDays(new Date(), 7), 'yyyy-MM-dd')
      const [aptRes, alertRes, empRes, gcRes] = await Promise.all([
        window.electronAPI.calendar.listAppointments(rangeFrom, rangeTo),
        window.electronAPI.calendar.listAppointments(today, in7days),
        window.electronAPI.employees.all(),
        window.electronAPI.calendar.getStatus(),
      ])
      if (aptRes.ok)   setAppts(aptRes.data as Appointment[])
      if (alertRes.ok) allAptsRef.current = alertRes.data as Appointment[]
      if (empRes.ok)   setEmployees(empRes.data as Employee[])
      if (gcRes.ok)    setGcStatus(gcRes.data as GcStatus)
    } finally { setLoading(false) }
  }, [rangeFrom, rangeTo])

  // Cargar estado de WhatsApp al montar y escuchar cambios en tiempo real
  useEffect(() => {
    window.electronAPI.whatsapp.getStatus().then((res: any) => {
      if (res.ok) setWaStatus(res.data)
    })
    const unsub = window.electronAPI.whatsapp.onStatus((data: any) => {
      setWaStatus({ status: data.status, phone: data.phone ?? null })
    })
    return () => unsub()
  }, [])

  useEffect(() => { loadAll() }, [rangeFrom, rangeTo])

  useEffect(() => {
    const unsubUpdate = window.electronAPI.calendar.onCalendarUpdated(() => {
      if (!loading) loadAll()
    })
    const unsubAuth = window.electronAPI.calendar.onCalendarAuthError((msg) => {
      showToast(msg, 'error')
      // Actualizar estado local para reflejar desconexión inmediata
      setGcStatus(prev => ({ ...prev, connected: false, connected_at: null }))
    })
    return () => { unsubUpdate(); unsubAuth() }
  }, [loadAll, loading])

  // Motor de alertas sonoras
  useEffect(() => {
    if (alertTimerRef.current) clearInterval(alertTimerRef.current)
    if (!alertsEnabled) {
      if (window.speechSynthesis) window.speechSynthesis.cancel()
      return
    }
    const checkAlerts = () => {
      const now = new Date()
      for (const apt of allAptsRef.current) {
        const start   = new Date(apt.start_at)
        const diffMin = Math.round((start.getTime() - now.getTime()) / 60000)
        if ((diffMin === 15 || diffMin === 5) && !alertedIds.current.has(parseInt(`${apt.id}${diffMin}`))) {
          alertedIds.current.add(parseInt(`${apt.id}${diffMin}`))
          playChime()
          const body = `${apt.service_name || apt.title} ${apt.client_name ? 'para ' + apt.client_name : ''}`
          showDesktopNotification(`Cita en ${diffMin} min`, body)
          const voiceText = `Cita en ${diffMin} minutos: ${body}`
          speakAlert(voiceText)
          showToast(`🔔 ${voiceText}`, 'success')
        }
      }
    }
    alertTimerRef.current = setInterval(checkAlerts, 30_000)
    checkAlerts()
    return () => { if (alertTimerRef.current) clearInterval(alertTimerRef.current) }
  }, [alertsEnabled])

  const prev    = () => setCurrent(v => view === 'week' ? subWeeks(v, 1) : subMonths(v, 1))
  const next    = () => setCurrent(v => view === 'week' ? addWeeks(v, 1) : addMonths(v, 1))
  const goToday = () => setCurrent(new Date())

  const openNew = (startISO?: string) => {
    if (startISO && new Date(startISO) < new Date()) {
      setPastDateConfirm(startISO)
      return
    }
    setEditingApt(null); setDefStart(startISO); setModalOpen(true)
  }

  const openEdit = (apt: Appointment) => {
    setEditingApt(apt); setDefStart(undefined); setModalOpen(true)
  }

  const handleConnect = async () => {
    setConnecting(true)
    try {
      const res = await window.electronAPI.calendar.connect()
      if (!res.ok) { showToast(res.error ?? 'Error al conectar', 'error'); return }
      showToast('¡Conectado con Google Calendar!')
      loadAll()
    } catch (e) { showToast(String(e), 'error') }
    finally { setConnecting(false) }
  }

  const handleDisconnect = async () => {
    setDisconn(true)
    try {
      const res = await window.electronAPI.calendar.disconnect()
      if (!res.ok) { showToast(res.error ?? 'Error al desconectar', 'error'); return }
      showToast('Desconectado de Google Calendar.')
      loadAll()
    } catch (e) { showToast(String(e), 'error') }
    finally { setDisconn(false) }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await window.electronAPI.calendar.sync()
      if (!res.ok) {
        showToast(res.error ?? 'Error al sincronizar', 'error')
        await loadAll(); return
      }
      const { synced, errors } = res.data as { synced: number; errors: number }
      showToast(errors > 0 ? `${synced} sincronizadas · ${errors} errores` : `${synced} citas sincronizadas`)
      await loadAll()
    } catch (e) { showToast(String(e), 'error'); await loadAll() }
    finally { setSyncing(false) }
  }

  const openWaBulk = async () => {
    const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd')
    const res = await window.electronAPI.calendar.listAppointments(tomorrow, tomorrow)
    if (res.ok) {
      const ids = (res.data as Appointment[])
        .filter((a: Appointment) => a.client_id !== null)
        .map((a: Appointment) => a.id)
      if (ids.length === 0) { showToast('No hay citas con cliente para mañana.', 'error'); return }
      setWaBulkIds(ids); setWaBulkOpen(true)
    }
  }

  const periodLabel = view === 'week'
    ? `${format(startOfWeek(current, { weekStartsOn: 1 }), 'd MMM', { locale: es })} – ${format(endOfWeek(current, { weekStartsOn: 1 }), 'd MMM yyyy', { locale: es })}`
    : format(current, 'MMMM yyyy', { locale: es }).replace(/^\w/, c => c.toUpperCase())

  const pastDateLabel = pastDateConfirm
    ? format(new Date(pastDateConfirm), "EEEE d 'de' MMMM 'a las' HH:mm", { locale: es })
    : ''

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Agenda"
        subtitle={periodLabel}
        icon={<CalendarDays size={18} />}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={prev} className="luma-btn-ghost p-2"><ChevronLeft size={16} /></button>
            <button onClick={goToday} className="luma-btn text-xs px-3 py-1.5 border"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>Hoy</button>
            <button onClick={next} className="luma-btn-ghost p-2"><ChevronRight size={16} /></button>

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

            <button onClick={() => setAlerts(a => !a)}
              title={alertsEnabled ? 'Desactivar alertas sonoras' : 'Activar alertas sonoras'}
              className="luma-btn-ghost p-2"
              style={{ color: alertsEnabled ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
              {alertsEnabled ? <Bell size={16} /> : <BellOff size={16} />}
            </button>
            <button onClick={openWaBulk} className="luma-btn-ghost text-xs flex items-center gap-1.5"
                    style={{ color: 'var(--color-accent)' }}
                    title="Enviar recordatorios WhatsApp para citas de mañana">
              <MessageCircle size={14} /> Recordatorios mañana
            </button>
            <button onClick={() => openNew()} className="luma-btn-primary text-xs">
              <Plus size={14} /> Nueva cita
            </button>
          </div>
        }
      />

      {/* Banner Google Calendar */}
      <ConnectionBanner
        status={gcStatus} connecting={connecting} syncing={syncing} disconnecting={disconnecting}
        onConnect={handleConnect} onSync={handleSync}
        onDisconnect={() => setCancelConfirm({ onConfirm: handleDisconnect, type: 'disconnect-gc' })}
        onRefresh={loadAll}
      />

      {/* Banner WhatsApp */}
      <WhatsAppBanner status={waStatus} />

      {toast && (
        <div className="mx-6 mt-1 rounded-lg px-4 py-2 text-xs flex items-center gap-2 animate-fade-in"
             style={{
               background: toast.type === 'error'
                 ? 'color-mix(in srgb,var(--color-danger) 12%,transparent)'
                 : 'color-mix(in srgb,var(--color-success) 12%,transparent)',
               color: toast.type === 'error' ? 'var(--color-danger)' : 'var(--color-success)',
             }}>
          {toast.type === 'error' ? <AlertCircle size={12} /> : <Bell size={12} />}
          {toast.msg}
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center h-full"><Spinner size={32} /></div>
        ) : view === 'week' ? (
          <WeekView current={current} appointments={appointments} employees={employees}
            onClickSlot={iso => openNew(iso)} onClickApt={openEdit} />
        ) : (
          <MonthView current={current} appointments={appointments}
            onClickDay={d => openNew(d.toISOString())} onClickApt={openEdit} />
        )}
      </div>

      <AppointmentModal
        isOpen={modalOpen} initial={editingApt}
        defaultStart={defaultStart} employees={employees}
        onClose={() => setModalOpen(false)} onSaved={loadAll}
        onConfirmCancel={onConfirm => setCancelConfirm({ onConfirm, type: 'cancel-apt' })}
      />

      <Modal isOpen={!!cancelConfirm} onClose={() => setCancelConfirm(null)}
        title={cancelConfirm?.type === 'disconnect-gc' ? '¿Desconectar Google Calendar?' : '¿Cancelar esta cita?'} width="sm">
        <div className="flex flex-col gap-4">
          <div className="rounded-lg px-4 py-3 text-sm"
               style={{ background: 'color-mix(in srgb,var(--color-danger) 12%,transparent)', color: 'var(--color-danger)' }}>
            {cancelConfirm?.type === 'disconnect-gc'
              ? 'Se desconectará tu cuenta de Google Calendar. Las citas ya sincronizadas no se eliminarán, pero dejarán de sincronizarse.'
              : `Esta acción no se puede deshacer. La cita quedará cancelada en Luma${gcStatus.connected ? ' y se eliminará de Google Calendar.' : '.'}`
            }
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setCancelConfirm(null)} className="luma-btn-ghost">Volver</button>
            <button onClick={() => { cancelConfirm?.onConfirm(); setCancelConfirm(null) }}
              className="luma-btn text-white text-sm" style={{ background: 'var(--color-danger)' }}>
              {cancelConfirm?.type === 'disconnect-gc' ? 'Sí, desconectar' : 'Confirmar cancelación'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!pastDateConfirm} onClose={() => setPastDateConfirm(null)}
        title="Fecha en el pasado" width="sm">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 rounded-lg px-4 py-3"
               style={{ background: 'color-mix(in srgb,var(--color-warning) 10%,transparent)', color: 'var(--color-warning)' }}>
            <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Estás agendando en el pasado</p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                El horario seleccionado (<strong style={{ color: 'var(--color-text)' }}>{pastDateLabel}</strong>) ya
                transcurrió. ¿Deseas registrar esta cita de todas formas?
              </p>
            </div>
          </div>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Esto es útil para registrar citas que no se agendaron a tiempo o para llevar un historial completo.
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setPastDateConfirm(null)} className="luma-btn-ghost">Cancelar</button>
            <button onClick={() => {
              const iso = pastDateConfirm!
              setPastDateConfirm(null)
              setEditingApt(null); setDefStart(iso); setModalOpen(true)
            }} className="luma-btn-primary">
              Sí, registrar de todas formas
            </button>
          </div>
        </div>
      </Modal>

      <WhatsAppPreviewModal
        isOpen={waBulkOpen}
        onClose={() => setWaBulkOpen(false)}
        appointmentIds={waBulkIds}
        reminderType="1d"
        contextLabel={`Citas del ${format(addDays(new Date(), 1), 'd MMM yyyy', { locale: es })}`}
      />
    </div>
  )
}

// ── Banner WhatsApp ───────────────────────────────────────────────────────────
// Solo se muestra si está conectado o si hay un problema — no muestra nada
// en estado 'disconnected' normal para no saturar la UI con banners.
const WhatsAppBanner: React.FC<{ status: WaStatus }> = ({ status }) => {
  // No mostrar nada si no está conectado — el admin sabe que puede configurarlo en Ajustes
  if (status.status !== 'ready') return null

  return (
    <div className="mx-6 mt-2 mb-4 rounded-xl px-4 py-2 flex items-center gap-3 border"
         style={{
           background:   'color-mix(in srgb,#1D9E75 8%,transparent)',
           borderColor:  'color-mix(in srgb,#1D9E75 25%,transparent)',
         }}>
      <MessageCircle size={14} style={{ color: '#1D9E75', flexShrink: 0 }} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium" style={{ color: '#1D9E75' }}>
          WhatsApp conectado
        </p>
        {status.phone && (
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Número del salón: <span className="font-mono">{status.phone}</span>
            {' · '}Los recordatorios automáticos están activos.
          </p>
        )}
      </div>
    </div>
  )
}

// ── Banner Google Calendar ────────────────────────────────────────────────────
const ConnectionBanner: React.FC<{
  status: GcStatus; connecting: boolean; syncing: boolean; disconnecting: boolean
  onConnect: () => void; onSync: () => void; onDisconnect: () => void; onRefresh: () => void
}> = ({ status, connecting, syncing, disconnecting, onConnect, onSync, onDisconnect, onRefresh }) => {
  if (!status.has_credentials) return (
    <div className="mx-6 mt-3 rounded-xl px-4 py-3 flex items-center gap-3 border"
         style={{ background: 'color-mix(in srgb,var(--color-text-muted) 8%,transparent)', borderColor: 'var(--color-border)' }}>
      <Settings2 size={15} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
      <p className="text-xs flex-1" style={{ color: 'var(--color-text-muted)' }}>
        Para sincronizar con Google Calendar, configura tu <strong>Client ID</strong> y <strong>Client Secret</strong> en{' '}
        <strong>Ajustes → Google Calendar</strong>.
      </p>
    </div>
  )
  if (status.connected) return (
    <div className="mx-6 mt-3 rounded-xl px-4 py-2.5 flex items-center gap-3 border"
         style={{ background: 'color-mix(in srgb,var(--color-success) 8%,transparent)', borderColor: 'color-mix(in srgb,var(--color-success) 25%,transparent)' }}>
      <Wifi size={15} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium" style={{ color: 'var(--color-success)' }}>Conectado a Google Calendar</p>
        {status.connected_at && (
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Desde {new Date(status.connected_at).toLocaleDateString('es-MX', { dateStyle: 'medium' })}
            {' · '}Calendario: <span className="font-mono">{status.calendar_id}</span>
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button onClick={onSync} disabled={syncing}
          className="luma-btn text-xs px-3 py-1.5 border"
          style={{ borderColor: 'var(--color-success)', color: 'var(--color-success)', background: 'transparent' }}>
          {syncing ? <><Loader2 size={11} className="animate-spin" /> Sincronizando...</> : <><RefreshCw size={11} /> Sincronizar</>}
        </button>
        <button onClick={onRefresh} className="luma-btn-ghost p-1.5" title="Recargar agenda">
          <RefreshCw size={13} />
        </button>
        <button onClick={onDisconnect} disabled={disconnecting}
          className="luma-btn text-xs px-3 py-1.5 border"
          style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)', background: 'transparent' }}>
          {disconnecting ? <><Loader2 size={11} className="animate-spin" /> Desconectando...</> : <><LogOut size={11} /> Desconectar</>}
        </button>
      </div>
    </div>
  )
  return (
    <div className="mx-6 mt-3 rounded-xl px-4 py-2.5 flex items-center gap-3 border"
         style={{ background: 'color-mix(in srgb,var(--color-warning) 8%,transparent)', borderColor: 'color-mix(in srgb,var(--color-warning) 25%,transparent)' }}>
      <WifiOff size={15} style={{ color: 'var(--color-warning)', flexShrink: 0 }} />
      <div className="flex-1">
        <p className="text-xs font-medium" style={{ color: 'var(--color-warning)' }}>No conectado a Google Calendar</p>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Las citas se guardan localmente. Conecta para sincronizar con Google.</p>
      </div>
      <button onClick={onConnect} disabled={connecting} className="luma-btn-primary text-xs flex-shrink-0">
        {connecting ? <><Loader2 size={12} className="animate-spin" /> Conectando...</> : <><Wifi size={12} /> Conectar Google</>}
      </button>
    </div>
  )
}

// ── Algoritmo de columnas para solapamientos ──────────────────────────────────
interface AptLayout extends Appointment { colIndex: number; colCount: number }

function computeLayout(apts: Appointment[]): AptLayout[] {
  const sorted = [...apts].sort((a, b) =>
    new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
  )
  const result: AptLayout[] = []
  let group: Appointment[] = []
  let groupEnd = new Date(0)

  const processGroup = (g: Appointment[]) => {
    const cols: Appointment[][] = []
    for (const apt of g) {
      const aptStart = new Date(apt.start_at)
      let placed = false
      for (const col of cols) {
        if (new Date(col[col.length - 1].end_at) <= aptStart) {
          col.push(apt); placed = true; break
        }
      }
      if (!placed) cols.push([apt])
    }
    const colCount = cols.length
    cols.forEach((col, ci) =>
      col.forEach(apt => result.push({ ...apt, colIndex: ci, colCount }))
    )
  }

  for (const apt of sorted) {
    const aptStart = new Date(apt.start_at)
    const aptEnd   = new Date(apt.end_at)
    if (group.length === 0) {
      group.push(apt); groupEnd = aptEnd
    } else if (aptStart < groupEnd) {
      group.push(apt); if (aptEnd > groupEnd) groupEnd = aptEnd
    } else {
      processGroup(group); group = [apt]; groupEnd = aptEnd
    }
  }
  if (group.length > 0) processGroup(group)
  return result
}

// ── Vista semanal — 24 horas con scroll sincronizado ─────────────────────────
const HOURS  = Array.from({ length: 24 }, (_, i) => i)
const HOUR_H = 56

const WeekView: React.FC<{
  current: Date; appointments: Appointment[]; employees: Employee[]
  onClickSlot: (iso: string) => void; onClickApt: (apt: Appointment) => void
}> = ({ current, appointments, onClickSlot, onClickApt }) => {
  const weekStart = startOfWeek(current, { weekStartsOn: 1 })
  const days      = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const now = new Date()
    const targetHour = days.some(d => isToday(d)) ? Math.max(now.getHours() - 1, 0) : 7
    el.scrollTop = targetHour * HOUR_H
  }, [current])

  const aptTop = (apt: Appointment) => {
    const d = parseISO(apt.start_at)
    return (d.getHours() + d.getMinutes() / 60) * HOUR_H
  }
  const aptHeight = (apt: Appointment) =>
    Math.max(
      ((new Date(apt.end_at).getTime() - new Date(apt.start_at).getTime()) / 60000 / 60) * HOUR_H,
      24
    )

  const layoutsByDay = useMemo(() =>
    days.map(day => {
      const dayApts = appointments.filter(a => isSameDay(parseISO(a.start_at), day))
      return computeLayout(dayApts)
    }),
    [appointments, days]
  )

  const nowLineTop = useMemo(() => {
    const n = new Date()
    return (n.getHours() + n.getMinutes() / 60) * HOUR_H
  }, [])

  const todayColIndex = days.findIndex(d => isToday(d))

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header días */}
      <div className="flex flex-shrink-0 border-b"
           style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="flex-shrink-0 w-14" />
        <div className="flex-1 grid grid-cols-7">
          {days.map(day => (
            <div key={day.toISOString()}
              className="flex flex-col items-center justify-center py-2 text-xs font-medium border-r"
              style={{ borderColor: 'var(--color-border)', height: 44 }}>
              <span style={{ color: isToday(day) ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
                {format(day, 'EEE', { locale: es }).toUpperCase()}
              </span>
              <span className="text-base font-bold mt-0.5"
                    style={{ color: isToday(day) ? 'var(--color-accent)' : 'var(--color-text)' }}>
                {format(day, 'd')}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Cuerpo scrollable */}
      <div ref={scrollRef} className="flex flex-1 overflow-auto">

        {/* Columna de horas */}
        <div className="flex-shrink-0 w-14 relative" style={{ height: HOURS.length * HOUR_H }}>
          {HOURS.map(h => (
            <div key={h} className="absolute right-2 text-xs select-none"
                 style={{ top: h === 0 ? 4 : h * HOUR_H - 8, color: 'var(--color-text-muted)' }}>
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="flex-1 grid grid-cols-7 relative"
             style={{ height: HOURS.length * HOUR_H, minWidth: 0 }}>

          {HOURS.map(h => (
            <React.Fragment key={h}>
              {days.map((_, di) => (
                <div key={di} className="border-r border-b"
                  style={{
                    position: 'absolute',
                    left: `${(di / 7) * 100}%`, top: h * HOUR_H,
                    width: `${100 / 7}%`, height: HOUR_H,
                    borderColor: 'var(--color-border)', cursor: 'pointer',
                  }}
                  onClick={() => {
                    const d = new Date(days[di]); d.setHours(h, 0, 0, 0)
                    onClickSlot(d.toISOString())
                  }}
                />
              ))}
            </React.Fragment>
          ))}

          {/* Línea de ahora */}
          {todayColIndex >= 0 && (
            <div style={{
              position: 'absolute', top: nowLineTop,
              left: `${(todayColIndex / 7) * 100}%`, width: `${100 / 7}%`,
              height: 2, background: 'var(--color-danger)', zIndex: 3, pointerEvents: 'none',
            }}>
              <div style={{
                position: 'absolute', left: 0, top: -4,
                width: 10, height: 10, borderRadius: '50%', background: 'var(--color-danger)',
              }} />
            </div>
          )}

          {/* Citas */}
          {days.map((_, di) => {
            const dayLayouts  = layoutsByDay[di]
            const dayLeftPct  = (di / 7) * 100
            const dayWidthPct = 100 / 7
            return dayLayouts.map(apt => {
              const PADDING = 3
              const colW    = dayWidthPct / apt.colCount
              const aptLeft = dayLeftPct + colW * apt.colIndex
              return (
                <div key={apt.id}
                  onClick={e => { e.stopPropagation(); onClickApt(apt) }}
                  className="absolute rounded-lg px-2 py-1.5 text-white text-xs cursor-pointer overflow-hidden shadow-md hover:brightness-110 transition-all flex flex-col gap-0.5 border border-white/10"
                  style={{
                    left: `calc(${aptLeft}% + ${PADDING}px)`,
                    width: `calc(${colW}% - ${PADDING * 2}px)`,
                    top: aptTop(apt) + 2, height: aptHeight(apt) - 4,
                    background: aptColor(apt), zIndex: 2,
                  }}
                  title={`${apt.title}${apt.client_name ? ' — ' + apt.client_name : ''}${apt.employee_name ? ' · ' + apt.employee_name : ''}`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex gap-1 items-center">
                      {getSyncIcon(apt.sync_status)}
                      {!apt.employee_id && <span title="Evento externo"><Link2 size={10} className="text-white/70" /></span>}
                    </div>
                    <span className="text-[9px] font-bold opacity-70 whitespace-nowrap">
                      {format(parseISO(apt.start_at), 'H:mm')}
                    </span>
                  </div>
                  <p className="font-bold truncate leading-tight text-[11px] drop-shadow-sm">{apt.title}</p>
                  {apt.client_name && (
                    <p className="opacity-90 truncate leading-none text-[10px] font-medium italic">• {apt.client_name}</p>
                  )}
                  {aptHeight(apt) > 45 && apt.colCount <= 2 && apt.employee_name && (
                    <p className="mt-auto opacity-70 truncate text-[9px] uppercase tracking-wider font-semibold">
                      {apt.employee_name.split(' ')[0]}
                    </p>
                  )}
                  {apt.colCount >= 3 && (
                    <p className="text-[9px] opacity-60 truncate">{format(parseISO(apt.end_at), 'H:mm')}</p>
                  )}
                </div>
              )
            })
          })}
        </div>
      </div>
    </div>
  )
}

// ── Vista mensual ─────────────────────────────────────────────────────────────
const MonthView: React.FC<{
  current: Date; appointments: Appointment[]
  onClickDay: (d: Date) => void; onClickApt: (apt: Appointment) => void
}> = ({ current, appointments, onClickDay, onClickApt }) => {
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
      <div className="grid grid-cols-7 text-center">
        {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d => (
          <div key={d} className="text-xs font-medium py-1" style={{ color: 'var(--color-text-muted)' }}>{d}</div>
        ))}
      </div>
      <div className="flex-1 grid overflow-hidden" style={{ gridTemplateRows: `repeat(${weeks.length}, 1fr)` }}>
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-t" style={{ borderColor: 'var(--color-border)' }}>
            {week.map((d, di) => {
              const apts = aptsByDay(d); const inMonth = isSameMonth(d, current)
              return (
                <div key={di}
                  className="border-r p-1 cursor-pointer hover:bg-white/5 transition-colors overflow-hidden flex flex-col"
                  style={{ borderColor: 'var(--color-border)', opacity: inMonth ? 1 : 0.35 }}
                  onClick={() => onClickDay(d)}>
                  <div className="flex items-center justify-center mb-1">
                    <span className="text-xs w-6 h-6 flex items-center justify-center rounded-full font-medium"
                          style={{ background: isToday(d) ? 'var(--color-accent)' : 'transparent', color: isToday(d) ? 'white' : 'var(--color-text-muted)' }}>
                      {format(d, 'd')}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5 overflow-hidden">
                    {apts.slice(0, 3).map(apt => (
                      <div key={apt.id}
                        onClick={e => { e.stopPropagation(); onClickApt(apt) }}
                        className="rounded text-white px-1 truncate cursor-pointer hover:opacity-80"
                        style={{ background: aptColor(apt), fontSize: 10, lineHeight: '16px' }}>
                        {format(parseISO(apt.start_at), 'H:mm')} {apt.title}
                      </div>
                    ))}
                    {apts.length > 3 && (
                      <span style={{ color: 'var(--color-text-muted)', fontSize: 10 }}>+{apts.length - 3} más</span>
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
