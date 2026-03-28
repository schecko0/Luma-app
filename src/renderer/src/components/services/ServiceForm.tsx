import React, { useState, useEffect } from 'react'
import { Save, Loader2, Clock, DollarSign, Crown } from 'lucide-react'
import type { Service, ServiceCategory, Employee } from '../../types'

type ServiceFormData = Omit<Service, 'id' | 'created_at' | 'updated_at' | 'category_name' | 'owner_name'>

const EMPTY: ServiceFormData = {
  category_id: 0, name: '', description: null,
  price: 0, duration_min: 60, owner_employee_id: null, is_active: true,
}

interface Props {
  initial?: Service | null
  categories: ServiceCategory[]
  owners: Employee[]         // solo empleados con role = 'owner'
  onSave: (data: ServiceFormData) => Promise<void>
  onCancel: () => void
}

export const ServiceForm: React.FC<Props> = ({ initial, categories, owners, onSave, onCancel }) => {
  const [form, setForm]     = useState<ServiceFormData>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof ServiceFormData, string>>>({})

  useEffect(() => {
    if (initial) {
      setForm({
        category_id: initial.category_id, name: initial.name,
        description: initial.description, price: initial.price,
        duration_min: initial.duration_min,
        owner_employee_id: initial.owner_employee_id,
        is_active: initial.is_active,
      })
    } else {
      const firstCat = categories.find(c => c.is_active)
      setForm({ ...EMPTY, category_id: firstCat?.id ?? 0 })
    }
    setErrors({})
  }, [initial, categories])

  const set = <K extends keyof ServiceFormData>(k: K, v: ServiceFormData[K]) => {
    setForm(p => ({ ...p, [k]: v }))
    setErrors(p => ({ ...p, [k]: undefined }))
  }

  const validate = () => {
    const e: typeof errors = {}
    if (!form.name.trim())     e.name         = 'El nombre es requerido.'
    if (!form.category_id)     e.category_id  = 'Selecciona una categoría.'
    if (form.price < 0)        e.price        = 'El precio no puede ser negativo.'
    if (form.duration_min < 1) e.duration_min = 'La duración debe ser al menos 1 minuto.'
    setErrors(e)
    return !Object.keys(e).length
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }

  const formatDuration = (min: number) => {
    if (min < 60) return `${min} min`
    const h = Math.floor(min / 60), m = min % 60
    return m > 0 ? `${h}h ${m}min` : `${h}h`
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">

      {/* Categoría */}
      <div>
        <label className="luma-label">Categoría <span style={{ color: 'var(--color-danger)' }}>*</span></label>
        <select value={form.category_id} onChange={e => set('category_id', parseInt(e.target.value))} className="luma-input">
          <option value={0} disabled>Selecciona una categoría...</option>
          {categories.filter(c => c.is_active).map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {errors.category_id && <p className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>{errors.category_id}</p>}
      </div>

      {/* Nombre */}
      <div>
        <label className="luma-label">Nombre del servicio <span style={{ color: 'var(--color-danger)' }}>*</span></label>
        <input type="text" placeholder="Ej. Corte de cabello" value={form.name}
          onChange={e => set('name', e.target.value)} className="luma-input" />
        {errors.name && <p className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>{errors.name}</p>}
      </div>

      {/* Descripción */}
      <div>
        <label className="luma-label">Descripción</label>
        <textarea rows={2} placeholder="Detalles del servicio..."
          value={form.description ?? ''}
          onChange={e => set('description', e.target.value || null)}
          className="luma-input resize-none" data-selectable />
      </div>

      {/* Precio y duración */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="luma-label">
            <DollarSign size={12} className="inline mr-1" />
            Precio (MXN) <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <input type="number" min="0" step="0.50" placeholder="0.00"
            value={form.price === 0 ? '' : form.price}
            onChange={e => set('price', parseFloat(e.target.value) || 0)}
            className="luma-input" />
          {errors.price && <p className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>{errors.price}</p>}
        </div>
        <div>
          <label className="luma-label">
            <Clock size={12} className="inline mr-1" />Duración <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <input type="number" min="0" step="5" placeholder="60"
            value={form.duration_min === 0 ? '' : form.duration_min}
            //value={form.duration_min} 
            onChange={e => set('duration_min', parseInt(e.target.value) || 0)}
            className="luma-input" />
          {form.duration_min > 0 && (
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{formatDuration(form.duration_min)}</p>
          )}
        </div>
      </div>

      {/* Jefe responsable del servicio */}
      <div className="rounded-xl p-4 border" style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)' }}>
        <label className="luma-label mb-2">
          <Crown size={12} className="inline mr-1" style={{ color: 'var(--color-accent)' }} />
          Jefe responsable (recibe el resto de la comisión)
        </label>
        <select
          value={form.owner_employee_id ?? ''}
          onChange={e => set('owner_employee_id', e.target.value ? parseInt(e.target.value) : null)}
          className="luma-input"
        >
          <option value="">Sin jefe asignado</option>
          {owners.map(o => (
            <option key={o.id} value={o.id}>
              👑 {o.full_name ?? `${o.first_name} ${o.last_name}`} — {o.commission_pct}%
            </option>
          ))}
        </select>
        {!form.owner_employee_id && (
          <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
            Si no asignas un jefe, el monto restante después de las comisiones de empleados no se distribuirá.
          </p>
        )}
        {form.owner_employee_id && (
          <p className="text-xs mt-2" style={{ color: 'var(--color-success)' }}>
            El jefe recibirá: precio del servicio − comisiones de empleados auxiliares.
          </p>
        )}
      </div>

      {/* Acciones */}
      <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
        <button type="button" onClick={onCancel} className="luma-btn-ghost">Cancelar</button>
        <button type="submit" disabled={saving} className="luma-btn-primary">
          {saving
            ? <><Loader2 size={15} className="animate-spin" /> Guardando...</>
            : <><Save size={15} /> {initial ? 'Actualizar' : 'Crear servicio'}</>}
        </button>
      </div>
    </form>
  )
}
