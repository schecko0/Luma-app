import React, { useState, useEffect } from 'react'
import { Save, Loader2 } from 'lucide-react'
import type { ServiceCategory } from '../../types'

// Iconos disponibles mapeados a emojis visuales para el picker
const ICON_OPTIONS: { value: string; label: string; emoji: string }[] = [
  { value: 'scissors',  label: 'Tijeras',   emoji: '✂️'  },
  { value: 'sparkles',  label: 'Brillos',   emoji: '✨'  },
  { value: 'smile',     label: 'Facial',    emoji: '🧖'  },
  { value: 'eye',       label: 'Cejas',     emoji: '👁️'  },
  { value: 'wind',      label: 'Masaje',    emoji: '💆'  },
  { value: 'droplets',  label: 'Color',     emoji: '🎨'  },
  { value: 'heart',     label: 'Spa',       emoji: '💅'  },
  { value: 'zap',       label: 'Keratina',  emoji: '⚡'  },
  { value: 'star',      label: 'Otros',     emoji: '⭐'  },
]

const COLOR_OPTIONS = [
  '#d4881f','#e4a73a','#4caf7d','#4a90d9',
  '#9b59b6','#dc4a3d','#e8a838','#1abc9c',
  '#e74c3c','#3498db','#8e44ad','#616161',
]

type CategoryFormData = Omit<ServiceCategory, 'id' | 'created_at'>

const EMPTY: CategoryFormData = {
  name: '', description: null, color: '#d4881f',
  icon: 'scissors', sort_order: 0, is_active: true,
}

interface Props {
  initial?: ServiceCategory | null
  onSave: (data: CategoryFormData) => Promise<void>
  onCancel: () => void
}

export const CategoryForm: React.FC<Props> = ({ initial, onSave, onCancel }) => {
  const [form, setForm]     = useState<CategoryFormData>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof CategoryFormData, string>>>({})

  useEffect(() => {
    setForm(initial
      ? { name: initial.name, description: initial.description, color: initial.color,
          icon: initial.icon, sort_order: initial.sort_order, is_active: initial.is_active }
      : EMPTY)
    setErrors({})
  }, [initial])

  const set = <K extends keyof CategoryFormData>(k: K, v: CategoryFormData[K]) => {
    setForm(p => ({ ...p, [k]: v }))
    setErrors(p => ({ ...p, [k]: undefined }))
  }

  const validate = () => {
    const e: typeof errors = {}
    if (!form.name.trim()) e.name = 'El nombre es requerido.'
    setErrors(e)
    return !Object.keys(e).length
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">

      {/* Nombre */}
      <div>
        <label className="luma-label">Nombre <span style={{ color: 'var(--color-danger)' }}>*</span></label>
        <input type="text" placeholder="Ej. Cabello" value={form.name}
          onChange={e => set('name', e.target.value)} className="luma-input" />
        {errors.name && <p className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>{errors.name}</p>}
      </div>

      {/* Descripción */}
      <div>
        <label className="luma-label">Descripción</label>
        <textarea rows={2} placeholder="Descripción opcional..."
          value={form.description ?? ''}
          onChange={e => set('description', e.target.value || null)}
          className="luma-input resize-none" data-selectable />
      </div>

      {/* Icono */}
      <div>
        <label className="luma-label">Icono</label>
        <div className="flex flex-wrap gap-2 mt-1">
          {ICON_OPTIONS.map(opt => (
            <button key={opt.value} type="button"
              onClick={() => set('icon', opt.value)}
              title={opt.label}
              className="w-10 h-10 rounded-xl text-lg flex items-center justify-center border-2 transition-all"
              style={{
                borderColor: form.icon === opt.value ? 'var(--color-accent)' : 'var(--color-border)',
                background:  form.icon === opt.value
                  ? 'color-mix(in srgb, var(--color-accent) 15%, transparent)' : 'transparent',
              }}>
              {opt.emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Color */}
      <div>
        <label className="luma-label">Color de etiqueta</label>
        <div className="flex flex-wrap gap-2 mt-1">
          {COLOR_OPTIONS.map(c => (
            <button key={c} type="button" onClick={() => set('color', c)}
              className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
              style={{
                background: c,
                borderColor: form.color === c ? 'var(--color-text)' : 'transparent',
                boxShadow:   form.color === c ? `0 0 0 2px var(--color-bg), 0 0 0 4px ${c}` : 'none',
              }} />
          ))}
        </div>
      </div>

      {/* Orden */}
      <div>
        <label className="luma-label">Orden de aparición</label>
        <input type="number" min="0" step="1" value={form.sort_order}
          onChange={e => set('sort_order', parseInt(e.target.value) || 0)}
          className="luma-input w-28" />
      </div>

      {/* Acciones */}
      <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
        <button type="button" onClick={onCancel} className="luma-btn-ghost">Cancelar</button>
        <button type="submit" disabled={saving} className="luma-btn-primary">
          {saving
            ? <><Loader2 size={15} className="animate-spin" /> Guardando...</>
            : <><Save size={15} /> {initial ? 'Actualizar' : 'Crear categoría'}</>}
        </button>
      </div>
    </form>
  )
}
