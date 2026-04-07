import React, { useState, useEffect, useRef } from 'react'
import { Save, Loader2, Trash2, Clock, User, UserRound, Scissors, AlignLeft, X, Search } from 'lucide-react'
import type { Employee, Client, Service, Appointment } from '../../types'
import { Modal } from '../ui/Modal'
import { Spinner } from '../ui/index'

// ── Colores de Google Calendar ────────────────────────────────────────────────
const GC_HEX: Record<string, string> = {
  tomato: '#d50000', flamingo: '#e67c73', tangerine: '#f6891f', banana: '#f6bf26',
  sage: '#33b679', basil: '#0f9d58', peacock: '#039be5', blueberry: '#3f51b5',
  lavender: '#7986cb', grape: '#8d24aa', graphite: '#616161',
}

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface AppointmentFormData {
  title: string
  employee_id: number | null
  client_id: number | null
  service_id: number | null
  start_at: string   // formato "YYYY-MM-DDTHH:MM"
  end_at: string
  description: string
  color: string      // nombre del color GC (ej: 'peacock')
}

interface SelectedItems {
  employee: { id: number; label: string; color: string } | null
  client:   { id: number; label: string; sublabel?: string } | null
  service:  { id: number; label: string; duration: number } | null
}

interface Props {
  isOpen: boolean
  initial?: Appointment | null
  defaultStart?: string
  employees: Employee[]
  onClose: () => void
  onSaved: () => void
  // Callback para mostrar modal de confirmación en lugar de window.confirm
  onConfirmCancel: (onConfirm: () => void) => void
}

// ── Helpers de fecha ──────────────────────────────────────────────────────────
function toLocalDatetimeInput(isoOrLocal: string): string {
  // Convierte cualquier string de fecha a formato "YYYY-MM-DDTHH:MM" para el input
  const d = new Date(isoOrLocal)
  if (isNaN(d.getTime())) return isoOrLocal.slice(0, 16)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function addMinutesLocal(localDT: string, min: number): string {
  const d = new Date(localDT)
  d.setMinutes(d.getMinutes() + min)
  return toLocalDatetimeInput(d.toISOString())
}

function roundToHalfHour(isoStr: string): string {
  const d = new Date(isoStr)
  const m = d.getMinutes()
  if (m === 0 || m === 30) { /* ya está redondeado */ }
  else if (m < 30) d.setMinutes(30, 0, 0)
  else { d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 1) }
  return toLocalDatetimeInput(d.toISOString())
}

// Verifica si inicio y fin están en el mismo día calendario
function isSameDay(start: string, end: string): boolean {
  return start.slice(0, 10) === end.slice(0, 10)
}

function emptyForm(defaultStart?: string): AppointmentFormData {
  const start = defaultStart ? roundToHalfHour(defaultStart) : roundToHalfHour(new Date().toISOString())
  return {
    title: '', employee_id: null, client_id: null, service_id: null,
    start_at: start, end_at: addMinutesLocal(start, 60),
    description: '', color: 'peacock',
  }
}

// ── Autocomplete genérico simple (sin async, sobre lista estática) ────────────
interface ACProps {
  icon: React.ReactNode
  placeholder: string
  items: { id: number; label: string; sublabel?: string; color?: string }[]
  selected: { id: number; label: string; sublabel?: string; color?: string } | null
  onSelect: (item: { id: number; label: string; sublabel?: string; color?: string }) => void
  onClear: () => void
  colorDot?: boolean
}

const SimpleAutocomplete: React.FC<ACProps> = ({ icon, placeholder, items, selected, onSelect, onClear, colorDot }) => {
  const [query, setQuery]     = useState('')
  const [open, setOpen]       = useState(false)
  const containerRef          = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (!containerRef.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const filtered = query.trim()
    ? items.filter(i => i.label.toLowerCase().includes(query.toLowerCase()) || (i.sublabel ?? '').toLowerCase().includes(query.toLowerCase()))
    : items

  if (selected) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border"
           style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-accent)' }}>
        {colorDot && selected.color && (
          <div className="w-3 h-3 rounded-full flex-shrink-0"
               style={{ background: GC_HEX[selected.color] ?? selected.color }} />
        )}
        <span className="flex-shrink-0" style={{ color: 'var(--color-accent)' }}>{icon}</span>
        <span className="flex-1 text-sm font-medium" style={{ color: 'var(--color-text)' }}>{selected.label}</span>
        {selected.sublabel && <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{selected.sublabel}</span>}
        <button onClick={onClear} className="hover:opacity-70 flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}>
          <X size={14} />
        </button>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }}>
          <Search size={13} />
        </span>
        <input
          type="text" placeholder={placeholder} value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          className="luma-input pl-8 text-sm" data-selectable
        />
      </div>
      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl shadow-2xl overflow-hidden border max-h-48 overflow-y-auto"
             style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {query ? `Sin resultados para "${query}"` : 'Sin opciones'}
            </p>
          ) : filtered.map(item => (
            <button key={item.id} type="button"
              onClick={() => { onSelect(item); setQuery(''); setOpen(false) }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:opacity-80 transition-colors border-b last:border-b-0"
              style={{ borderColor: 'var(--color-border)', textAlign: 'left' }}>
              {colorDot && item.color && (
                <div className="w-3 h-3 rounded-full flex-shrink-0"
                     style={{ background: GC_HEX[item.color] ?? item.color }} />
              )}
              <div className="flex flex-col items-start">
                <span style={{ color: 'var(--color-text)' }}>{item.label}</span>
                {item.sublabel && <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{item.sublabel}</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Modal principal ───────────────────────────────────────────────────────────
export const AppointmentModal: React.FC<Props> = ({
  isOpen, initial, defaultStart, employees, onClose, onSaved, onConfirmCancel,
}) => {
  const [form, setForm]       = useState<AppointmentFormData>(emptyForm(defaultStart))
  const [selected, setSelected] = useState<SelectedItems>({ employee: null, client: null, service: null })
  const [clients, setClients]   = useState<Client[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [saving, setSaving]     = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [endDayWarning, setEndDayWarning] = useState(false)

  // Cargar clientes y servicios
  useEffect(() => {
    Promise.all([
      window.electronAPI.clients.list({ page: 1, pageSize: 500 }),
      window.electronAPI.services.all(),
    ]).then(([cRes, sRes]) => {
      if (cRes.ok) setClients((cRes.data as { items: Client[] }).items)
      if (sRes.ok) setServices(sRes.data as Service[])
    })
  }, [])

  // Resetear formulario al abrir — PRESERVAR todos los valores del initial
  useEffect(() => {
    if (!isOpen) return
    if (initial) {
      // Convertir a formato local para los inputs datetime-local
      const startLocal = toLocalDatetimeInput(initial.start_at)
      const endLocal   = toLocalDatetimeInput(initial.end_at)
      setForm({
        title:       initial.title,
        employee_id: initial.employee_id,
        client_id:   initial.client_id,
        service_id:  initial.service_id,
        start_at:    startLocal,
        end_at:      endLocal,
        description: initial.description ?? '',
        color:       initial.color ?? 'peacock',
      })
      // Reconstituir los objetos seleccionados para los autocompletes
      const emp = employees.find(e => e.id === initial.employee_id)
      const cli = clients.find(c => c.id === initial.client_id)
      const svc = services.find(s => s.id === initial.service_id)
      setSelected({
        employee: emp ? { id: emp.id, label: emp.full_name ?? `${emp.first_name} ${emp.last_name}`, color: emp.calendar_color } : null,
        client:   cli ? { id: cli.id, label: `${cli.first_name} ${cli.last_name}`, sublabel: cli.phone ?? undefined } : null,
        service:  svc ? { id: svc.id, label: `${svc.name} (${svc.duration_min}min)`, duration: svc.duration_min } : null,
      })
    } else {
      const f = emptyForm(defaultStart)
      setForm(f)
      setSelected({ employee: null, client: null, service: null })
    }
    setError(null)
    setEndDayWarning(false)
  }, [isOpen, initial, defaultStart, employees, clients, services])

  // Auto-título: solo si el campo está vacío
  useEffect(() => {
    if (form.title && initial?.title !== form.title) return // título ya fue editado manualmente
    const parts = [
      selected.service ? selected.service.label.split('(')[0].trim() : null,
      selected.client  ? selected.client.label : null,
    ].filter(Boolean)
    if (parts.length > 0) setForm(prev => ({ ...prev, title: parts.join(' — ') }))
  }, [selected.service?.id, selected.client?.id])

  const set = <K extends keyof AppointmentFormData>(k: K, v: AppointmentFormData[K]) => {
    setForm(prev => ({ ...prev, [k]: v }))
    setError(null)
  }

  // Seleccionar empleado → el color viene del empleado
  const handleEmployeeSelect = (item: { id: number; label: string; color?: string }) => {
    setSelected(prev => ({ ...prev, employee: { id: item.id, label: item.label, color: item.color ?? 'peacock' } }))
    set('employee_id', item.id)
    set('color', item.color ?? 'peacock') // color de la cita = color del empleado
  }

  const handleEmployeeClear = () => {
    setSelected(prev => ({ ...prev, employee: null }))
    set('employee_id', null)
    // Si no hay empleado, resetear a color por defecto
    set('color', 'peacock')
  }

  // Seleccionar servicio → calcular hora fin automáticamente
  const handleServiceSelect = (item: { id: number; label: string; duration?: number }) => {
    setSelected(prev => ({ ...prev, service: { id: item.id, label: item.label, duration: item.duration ?? 60 } }))
    set('service_id', item.id)

    const duration = item.duration ?? 60
    const newEnd   = addMinutesLocal(form.start_at, duration)

    // Validar que no pase de medianoche (Google Calendar no acepta citas que cruzan días)
    if (!isSameDay(form.start_at, newEnd)) {
      // Forzar fin al 23:30 del mismo día
      const endOfDay = form.start_at.slice(0, 10) + 'T23:30'
      set('end_at', endOfDay)
      setEndDayWarning(true)
    } else {
      set('end_at', newEnd)
      setEndDayWarning(false)
    }
    setForm(prev => ({ ...prev, title: '' })) // limpiar título para auto-generar
  }

  // Cambiar hora de inicio → recalcular fin si hay servicio
  const handleStartChange = (newStart: string) => {
    set('start_at', newStart)
    const duration = selected.service?.duration ?? 60
    const newEnd   = addMinutesLocal(newStart, duration)
    if (!isSameDay(newStart, newEnd)) {
      set('end_at', newStart.slice(0, 10) + 'T23:30')
      setEndDayWarning(true)
    } else {
      set('end_at', newEnd)
      setEndDayWarning(false)
    }
  }

  const handleSave = async () => {
    if (!form.title.trim()) { setError('El título es requerido.'); return }
    if (!form.start_at)      { setError('Indica la fecha y hora de inicio.'); return }
    if (!form.end_at)        { setError('Indica la fecha y hora de fin.'); return }
    if (form.end_at <= form.start_at) { setError('La hora de fin debe ser posterior al inicio.'); return }
    if (!isSameDay(form.start_at, form.end_at)) {
      setError('La cita no puede terminar en un día diferente al que inicia (limitación de Google Calendar).')
      return
    }

    setSaving(true); setError(null)
    try {
      const payload = {
        employee_id:  form.employee_id,
        client_id:    form.client_id,
        service_id:   form.service_id,
        title:        form.title.trim(),
        description:  form.description || undefined,
        start_at:     new Date(form.start_at).toISOString(),
        end_at:       new Date(form.end_at).toISOString(),
        color:        form.color,
      }
      const res = initial
        ? await window.electronAPI.calendar.updateAppointment(initial.id, payload)
        : await window.electronAPI.calendar.createAppointment(payload)

      if (!res.ok) { setError(res.error ?? 'Error al guardar'); return }
      onSaved(); onClose()
    } catch (e) { setError(String(e)) }
    finally { setSaving(false) }
  }

  // Cancelar cita — usa modal personalizado en lugar de window.confirm
  const handleDeleteClick = () => {
    onConfirmCancel(async () => {
      setDeleting(true)
      try {
        const res = await window.electronAPI.calendar.cancelAppointment(initial!.id)
        if (!res.ok) { setError(res.error ?? 'Error al cancelar'); return }
        onSaved(); onClose()
      } catch (e) { setError(String(e)) }
      finally { setDeleting(false) }
    })
  }

  // Listas para autocompletes
  const employeeItems = employees.map(e => ({
    id: e.id, label: e.full_name ?? `${e.first_name} ${e.last_name}`,
    sublabel: e.role === 'owner' ? 'Jefe' : undefined,
    color: e.calendar_color,
  }))
  const clientItems = clients.map(c => ({
    id: c.id, label: `${c.first_name} ${c.last_name}`,
    sublabel: c.phone ?? c.email ?? undefined,
    color: undefined,
  }))
  const serviceItems = services.map(s => ({
    id: s.id, label: s.name,
    sublabel: `${s.duration_min} min · ${s.category_name ?? ''}`,
    duration: s.duration_min,
    color: undefined,
  }))

  // Color visual de la cita (derivado del empleado seleccionado)
  const previewColor = GC_HEX[form.color] ?? 'var(--color-accent)'

  return (
    <Modal
      isOpen={isOpen} onClose={onClose}
      title={initial ? 'Editar cita' : 'Nueva cita'}
      subtitle={initial?.title} width="md"
    >
      <div className="flex flex-col gap-4">
        {error && (
          <div className="rounded-lg px-3 py-2 text-xs"
               style={{ background: 'color-mix(in srgb,var(--color-danger) 12%,transparent)', color: 'var(--color-danger)' }}>
            {error}
          </div>
        )}
        {endDayWarning && (
          <div className="rounded-lg px-3 py-2 text-xs"
               style={{ background: 'color-mix(in srgb,var(--color-warning) 12%,transparent)', color: 'var(--color-warning)' }}>
            ⚠️ El servicio excedería la medianoche. La hora de fin se ajustó a las 23:30 del mismo día.
          </div>
        )}

        {/* Título con indicador de color de la cita */}
        <div>
          <label className="luma-label">Título <span style={{ color: 'var(--color-danger)' }}>*</span></label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border border-white/30"
                 style={{ background: previewColor }} />
            <input type="text" placeholder="Ej. Corte — María García" value={form.title}
              onChange={e => set('title', e.target.value)}
              className="luma-input pl-8" data-selectable />
          </div>
        </div>

        {/* Empleado — autocomplete con dot de color */}
        <div>
          <label className="luma-label"><User size={11} className="inline mr-1" />Empleado</label>
          <SimpleAutocomplete
            icon={<User size={13} />}
            placeholder="Buscar empleado..."
            items={employeeItems}
            selected={selected.employee}
            onSelect={handleEmployeeSelect}
            onClear={handleEmployeeClear}
            colorDot
          />
        </div>

        {/* Cliente — autocomplete */}
        <div>
          <label className="luma-label"><UserRound size={11} className="inline mr-1" />Cliente</label>
          <SimpleAutocomplete
            icon={<UserRound size={13} />}
            placeholder="Buscar cliente..."
            items={clientItems}
            selected={selected.client}
            onSelect={item => { setSelected(prev => ({ ...prev, client: item })); set('client_id', item.id); setForm(prev => ({ ...prev, title: '' })) }}
            onClear={() => { setSelected(prev => ({ ...prev, client: null })); set('client_id', null) }}
          />
        </div>

        {/* Servicio — autocomplete con duración */}
        <div>
          <label className="luma-label"><Scissors size={11} className="inline mr-1" />Servicio</label>
          <SimpleAutocomplete
            icon={<Scissors size={13} />}
            placeholder="Buscar servicio..."
            items={serviceItems}
            selected={selected.service}
            onSelect={handleServiceSelect}
            onClear={() => { setSelected(prev => ({ ...prev, service: null })); set('service_id', null) }}
          />
        </div>

        {/* Fecha/hora inicio y fin */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="luma-label"><Clock size={11} className="inline mr-1" />Inicio</label>
            <input type="datetime-local" value={form.start_at}
              onChange={e => handleStartChange(e.target.value)}
              className="luma-input" data-selectable />
          </div>
          <div>
            <label className="luma-label"><Clock size={11} className="inline mr-1" />Fin</label>
            <input type="datetime-local" value={form.end_at}
              onChange={e => { set('end_at', e.target.value); setEndDayWarning(!isSameDay(form.start_at, e.target.value)) }}
              className="luma-input" data-selectable />
          </div>
        </div>

        {/* Descripción */}
        <div>
          <label className="luma-label"><AlignLeft size={11} className="inline mr-1" />Notas</label>
          <textarea rows={2} placeholder="Observaciones..." value={form.description}
            onChange={e => set('description', e.target.value)}
            className="luma-input resize-none" data-selectable />
        </div>

        {/* Color de la cita (solo informativo, viene del empleado) */}
        <div className="flex items-center gap-3 rounded-lg px-3 py-2"
             style={{ background: 'var(--color-surface-2)' }}>
          <div className="w-4 h-4 rounded-full border border-white/20 flex-shrink-0"
               style={{ background: previewColor }} />
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Color de la cita: <strong style={{ color: 'var(--color-text)' }}>{form.color}</strong>
            {selected.employee
              ? ` (color del empleado ${selected.employee.label})`
              : ' — asigna un empleado para usar su color'}
          </p>
        </div>

        {/* Acciones */}
        <div className="flex justify-between items-center pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            {initial && (
              <button onClick={handleDeleteClick} disabled={deleting}
                className="luma-btn text-sm" style={{ color: 'var(--color-danger)' }}>
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Cancelar cita
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="luma-btn-ghost">Cerrar</button>
            <button onClick={handleSave} disabled={saving} className="luma-btn-primary">
              {saving ? <><Loader2 size={14} className="animate-spin" /> Guardando...</> : <><Save size={14} /> {initial ? 'Actualizar' : 'Crear cita'}</>}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
