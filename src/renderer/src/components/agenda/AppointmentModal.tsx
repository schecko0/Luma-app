import React, { useState, useEffect } from 'react'
import { Save, Loader2, Trash2, Clock, User, UserRound, Scissors, AlignLeft } from 'lucide-react'
import type { Employee, Client, Service, Appointment } from '../../types'
import { Modal } from '../ui/Modal'

interface AppointmentFormData {
  title: string
  employee_id: number | null
  client_id: number | null
  service_id: number | null
  start_at: string
  end_at: string
  description: string
  color: string
}

interface Props {
  isOpen: boolean
  initial?: Appointment | null          // null = crear, Appointment = editar
  defaultStart?: string                 // ISO datetime para pre-rellenar al hacer click en la grilla
  employees: Employee[]
  onClose: () => void
  onSaved: () => void
}

const GC_COLORS = [
  { value: 'tomato',    label: 'Rojo',     hex: '#d50000' },
  { value: 'flamingo',  label: 'Rosa',     hex: '#e67c73' },
  { value: 'tangerine', label: 'Naranja',  hex: '#f6891f' },
  { value: 'banana',    label: 'Amarillo', hex: '#f6bf26' },
  { value: 'sage',      label: 'Verde',    hex: '#33b679' },
  { value: 'basil',     label: 'Verde oscuro', hex: '#0f9d58' },
  { value: 'peacock',   label: 'Azul',     hex: '#039be5' },
  { value: 'blueberry', label: 'Índigo',   hex: '#3f51b5' },
  { value: 'lavender',  label: 'Lavanda',  hex: '#7986cb' },
  { value: 'grape',     label: 'Morado',   hex: '#8d24aa' },
  { value: 'graphite',  label: 'Gris',     hex: '#616161' },
]

// Redondear datetime a los 30min más cercanos
function roundToHalfHour(dt: string): string {
  const d = new Date(dt)
  const m = d.getMinutes()
  d.setMinutes(m < 30 ? 30 : 60, 0, 0)
  return d.toISOString().slice(0, 16)
}

function addMinutes(dt: string, min: number): string {
  const d = new Date(dt)
  d.setMinutes(d.getMinutes() + min)
  return d.toISOString().slice(0, 16)
}

export const AppointmentModal: React.FC<Props> = ({
  isOpen, initial, defaultStart, employees, onClose, onSaved,
}) => {
  const [form, setForm]         = useState<AppointmentFormData>(emptyForm(defaultStart))
  const [clients, setClients]   = useState<Client[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [saving, setSaving]     = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError]       = useState<string | null>(null)

  // Cargar clientes y servicios una sola vez
  useEffect(() => {
    Promise.all([
      window.electronAPI.clients.list({ page: 1, pageSize: 200 }),
      window.electronAPI.services.all(),
    ]).then(([cRes, sRes]) => {
      if (cRes.ok) setClients((cRes.data as { items: Client[] }).items)
      if (sRes.ok) setServices(sRes.data as Service[])
    })
  }, [])

  // Resetear formulario al abrir
  useEffect(() => {
    if (!isOpen) return
    if (initial) {
      setForm({
        title:       initial.title,
        employee_id: initial.employee_id,
        client_id:   initial.client_id,
        service_id:  initial.service_id,
        start_at:    initial.start_at.slice(0, 16),
        end_at:      initial.end_at.slice(0, 16),
        description: initial.description ?? '',
        color:       initial.color ?? 'peacock',
      })
    } else {
      setForm(emptyForm(defaultStart))
    }
    setError(null)
  }, [isOpen, initial, defaultStart])

  // Auto-titulo cuando se selecciona servicio + cliente
  useEffect(() => {
    if (form.title) return   // si ya hay título manual, no pisar
    const svc = services.find(s => s.id === form.service_id)
    const cli = clients.find(c => c.id === form.client_id)
    if (svc || cli) {
      const parts = [svc?.name, cli ? `${cli.first_name} ${cli.last_name}` : null].filter(Boolean)
      setForm(prev => ({ ...prev, title: parts.join(' — ') }))
    }
  }, [form.service_id, form.client_id])

  // Ajustar end_at cuando cambia servicio (duración automática)
  const handleServiceChange = (serviceId: number | null) => {
    const svc = services.find(s => s.id === serviceId)
    const newEnd = svc ? addMinutes(form.start_at, svc.duration_min) : addMinutes(form.start_at, 60)
    setForm(prev => ({ ...prev, service_id: serviceId, end_at: newEnd, title: '' }))
  }

  const set = <K extends keyof AppointmentFormData>(k: K, v: AppointmentFormData[K]) => {
    setForm(prev => ({ ...prev, [k]: v }))
    setError(null)
  }

  const handleSave = async () => {
    if (!form.title.trim()) { setError('El título es requerido.'); return }
    if (!form.start_at)      { setError('Indica la fecha y hora de inicio.'); return }
    if (!form.end_at)        { setError('Indica la fecha y hora de fin.'); return }
    if (form.end_at <= form.start_at) { setError('La hora de fin debe ser posterior al inicio.'); return }

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
      onSaved()
      onClose()
    } catch (e) { setError(String(e)) }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!initial) return
    if (!window.confirm('¿Cancelar esta cita? No se puede deshacer.')) return
    setDeleting(true)
    try {
      const res = await window.electronAPI.calendar.cancelAppointment(initial.id)
      if (!res.ok) { setError(res.error ?? 'Error al cancelar'); return }
      onSaved(); onClose()
    } catch (e) { setError(String(e)) }
    finally { setDeleting(false) }
  }

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

        {/* Título */}
        <div>
          <label className="luma-label">Título <span style={{ color: 'var(--color-danger)' }}>*</span></label>
          <input type="text" placeholder="Ej. Corte de cabello — María" value={form.title}
            onChange={e => set('title', e.target.value)} className="luma-input" data-selectable />
        </div>

        {/* Empleado */}
        <div>
          <label className="luma-label"><User size={11} className="inline mr-1" />Empleado</label>
          <select value={form.employee_id ?? ''} onChange={e => set('employee_id', e.target.value ? parseInt(e.target.value) : null)} className="luma-input">
            <option value="">Sin asignar</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.full_name ?? `${emp.first_name} ${emp.last_name}`}</option>
            ))}
          </select>
        </div>

        {/* Cliente */}
        <div>
          <label className="luma-label"><UserRound size={11} className="inline mr-1" />Cliente</label>
          <select value={form.client_id ?? ''} onChange={e => { set('client_id', e.target.value ? parseInt(e.target.value) : null); set('title', '') }} className="luma-input">
            <option value="">Sin cliente</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
            ))}
          </select>
        </div>

        {/* Servicio */}
        <div>
          <label className="luma-label"><Scissors size={11} className="inline mr-1" />Servicio</label>
          <select value={form.service_id ?? ''} onChange={e => handleServiceChange(e.target.value ? parseInt(e.target.value) : null)} className="luma-input">
            <option value="">Sin servicio</option>
            {services.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.duration_min}min)</option>
            ))}
          </select>
        </div>

        {/* Fecha/hora inicio y fin */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="luma-label"><Clock size={11} className="inline mr-1" />Inicio</label>
            <input type="datetime-local" value={form.start_at}
              onChange={e => { set('start_at', e.target.value); set('end_at', addMinutes(e.target.value, 60)) }}
              className="luma-input" data-selectable />
          </div>
          <div>
            <label className="luma-label"><Clock size={11} className="inline mr-1" />Fin</label>
            <input type="datetime-local" value={form.end_at}
              onChange={e => set('end_at', e.target.value)} className="luma-input" data-selectable />
          </div>
        </div>

        {/* Descripción */}
        <div>
          <label className="luma-label"><AlignLeft size={11} className="inline mr-1" />Notas</label>
          <textarea rows={2} placeholder="Observaciones..." value={form.description}
            onChange={e => set('description', e.target.value)}
            className="luma-input resize-none" data-selectable />
        </div>

        {/* Selector de color */}
        <div>
          <label className="luma-label">Color</label>
          <div className="flex gap-2 flex-wrap">
            {GC_COLORS.map(c => (
              <button key={c.value} type="button" title={c.label}
                onClick={() => set('color', c.value)}
                className="w-6 h-6 rounded-full transition-transform border-2"
                style={{
                  background:   c.hex,
                  borderColor:  form.color === c.value ? 'var(--color-text)' : 'transparent',
                  transform:    form.color === c.value ? 'scale(1.25)' : 'scale(1)',
                }}
              />
            ))}
          </div>
        </div>

        {/* Acciones */}
        <div className="flex justify-between items-center pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            {initial && (
              <button onClick={handleDelete} disabled={deleting}
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

function emptyForm(defaultStart?: string): AppointmentFormData {
  const start = defaultStart
    ? roundToHalfHour(defaultStart)
    : roundToHalfHour(new Date().toISOString())
  return {
    title: '', employee_id: null, client_id: null, service_id: null,
    start_at: start, end_at: addMinutes(start, 60),
    description: '', color: 'peacock',
  }
}
