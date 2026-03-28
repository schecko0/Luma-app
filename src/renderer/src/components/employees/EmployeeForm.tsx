import React, { useState, useEffect } from 'react'
import { Save, Loader2, Info } from 'lucide-react'
import type { Employee, EmployeeRole, GoogleCalendarColor } from '../../types'
import { GoogleColorPicker } from '../ui/GoogleColorPicker'

type EmployeeFormData = Omit<Employee, 'id' | 'created_at' | 'updated_at' | 'full_name'>

const EMPTY_FORM: EmployeeFormData = {
  first_name:         '',
  last_name:          '',
  email:              null,
  phone:              null,
  phone_country:      '+52',
  role:               'employee',
  calendar_color:     'peacock',
  base_salary:        0,
  commission_pct:     0,
  google_calendar_id: null,
  hire_date:          null,
  notes:              null,
  photo_path:         null,
  is_active:          true,
}

interface EmployeeFormProps {
  initial?: Employee | null
  onSave: (data: EmployeeFormData) => Promise<void>
  onCancel: () => void
}

export const EmployeeForm: React.FC<EmployeeFormProps> = ({ initial, onSave, onCancel }) => {
  const [form, setForm]     = useState<EmployeeFormData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof EmployeeFormData, string>>>({})

  useEffect(() => {
    if (initial) {
      setForm({
        first_name:         initial.first_name,
        last_name:          initial.last_name,
        email:              initial.email,
        phone:              initial.phone,
        phone_country:      initial.phone_country,
        role:               initial.role,
        calendar_color:     initial.calendar_color,
        base_salary:        initial.base_salary,
        commission_pct:     initial.commission_pct,
        google_calendar_id: initial.google_calendar_id,
        hire_date:          initial.hire_date,
        notes:              initial.notes,
        photo_path:         initial.photo_path,
        is_active:          initial.is_active,
      })
    } else {
      setForm(EMPTY_FORM)
    }
    setErrors({})
  }, [initial])

  const set = <K extends keyof EmployeeFormData>(key: K, value: EmployeeFormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
    setErrors(prev => ({ ...prev, [key]: undefined }))
  }

  // Validación con reglas condicionales por rol
  const validate = (): boolean => {
    const errs: typeof errors = {}

    if (!form.first_name.trim()) errs.first_name = 'El nombre es requerido.'
    if (!form.last_name.trim())  errs.last_name  = 'El apellido es requerido.'

    if (form.commission_pct < 0 || form.commission_pct > 100)
      errs.commission_pct = 'Debe estar entre 0 y 100.'

    if (form.base_salary < 0)
      errs.base_salary = 'No puede ser negativo.'

    // Reglas específicas por rol (espejo de las validaciones del backend)
    if (form.role === 'employee') {
      if (!form.base_salary || form.base_salary <= 0)
        errs.base_salary = 'Un empleado debe tener salario base mayor a $0.'
      if (!form.commission_pct || form.commission_pct <= 0)
        errs.commission_pct = 'Un empleado debe tener comisión mayor a 0%.'
    }

    if (form.role === 'owner') {
      if (!form.commission_pct || form.commission_pct <= 0)
        errs.commission_pct = 'El dueño/jefe debe tener comisión mayor a 0%.'
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }

  const isOwner = form.role === 'owner'

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">

      {/* ── Rol del empleado ─────────────────────────────────────────── */}
      <div
        className="rounded-xl p-4 border"
        style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)' }}
      >
        <label className="luma-label mb-2">
          Rol en el salón <span style={{ color: 'var(--color-danger)' }}>*</span>
        </label>
        <div className="flex gap-3">
          {/* Opción: Empleado */}
          <button
            type="button"
            onClick={() => set('role', 'employee')}
            className="flex-1 flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border-2 transition-all duration-150 cursor-pointer"
            style={{
              borderColor: form.role === 'employee' ? 'var(--color-accent)' : 'var(--color-border)',
              background:  form.role === 'employee'
                ? 'color-mix(in srgb, var(--color-accent) 10%, transparent)'
                : 'transparent',
            }}
          >
            <span className="text-lg">💼</span>
            <span className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>
              Empleado
            </span>
            <span className="text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
              Salario base + comisión requeridos
            </span>
          </button>

          {/* Opción: Dueño/Jefe */}
          <button
            type="button"
            onClick={() => set('role', 'owner')}
            className="flex-1 flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border-2 transition-all duration-150 cursor-pointer"
            style={{
              borderColor: form.role === 'owner' ? 'var(--color-accent)' : 'var(--color-border)',
              background:  form.role === 'owner'
                ? 'color-mix(in srgb, var(--color-accent) 10%, transparent)'
                : 'transparent',
            }}
          >
            <span className="text-lg">👑</span>
            <span className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>
              Dueño / Jefe
            </span>
            <span className="text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
              Salario base opcional, comisión requerida
            </span>
          </button>
        </div>

        {/* Hint informativo según el rol */}
        <div
          className="flex items-start gap-2 mt-3 px-3 py-2 rounded-lg text-xs"
          style={{ background: 'color-mix(in srgb, var(--color-info) 10%, transparent)', color: 'var(--color-info)' }}
        >
          <Info size={13} className="flex-shrink-0 mt-0.5" />
          {isOwner
            ? 'El dueño/jefe recibe su porcentaje de comisión directamente. El resto va a los gastos del salón. El salario base es opcional.'
            : 'El empleado recibe salario base fijo más comisión por los servicios que realiza. Ambos valores son obligatorios.'
          }
        </div>
      </div>

      {/* ── Nombre y apellido ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="luma-label">
            Nombre <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <input type="text" placeholder="Ej. Ana" value={form.first_name}
            onChange={e => set('first_name', e.target.value)} className="luma-input" />
          {errors.first_name && (
            <p className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>{errors.first_name}</p>
          )}
        </div>
        <div>
          <label className="luma-label">
            Apellido <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <input type="text" placeholder="Ej. García" value={form.last_name}
            onChange={e => set('last_name', e.target.value)} className="luma-input" />
          {errors.last_name && (
            <p className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>{errors.last_name}</p>
          )}
        </div>
      </div>

      {/* ── Contacto ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="luma-label">Correo electrónico</label>
          <input type="email" placeholder="ana@ejemplo.com" value={form.email ?? ''}
            onChange={e => set('email', e.target.value || null)} className="luma-input" />
        </div>
        <div>
          <label className="luma-label">Teléfono</label>
          <div className="flex gap-2">
            <select value={form.phone_country}
              onChange={e => set('phone_country', e.target.value)}
              className="luma-input w-24 flex-shrink-0">
              <option value="+52">🇲🇽 +52</option>
              <option value="+1">🇺🇸 +1</option>
              <option value="+34">🇪🇸 +34</option>
              <option value="+57">🇨🇴 +57</option>
              <option value="+54">🇦🇷 +54</option>
            </select>
            <input type="tel" placeholder="55 1234 5678" value={form.phone ?? ''}
              onChange={e => set('phone', e.target.value || null)} className="luma-input flex-1" />
          </div>
        </div>
      </div>

      {/* ── Salario base y comisión ───────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="luma-label">
            Salario base (MXN)
            {!isOwner && <span style={{ color: 'var(--color-danger)' }}> *</span>}
            {isOwner  && <span className="ml-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>(opcional)</span>}
          </label>
          <input type="number" min="0" step="0.01" placeholder="0.00"
            value={form.base_salary === 0 ? '' : form.base_salary}
            onChange={e => set('base_salary', parseFloat(e.target.value) || 0)}
            className="luma-input" />
          {errors.base_salary && (
            <p className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>{errors.base_salary}</p>
          )}
        </div>
        <div>
          <label className="luma-label">
            Comisión (%) <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <input type="number" min="0" max="100" step="0.5" placeholder="0"
            value={form.commission_pct === 0 ? '' : form.commission_pct}
            onChange={e => set('commission_pct', parseFloat(e.target.value) || 0)}
            className="luma-input" />
          {errors.commission_pct && (
            <p className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>{errors.commission_pct}</p>
          )}
          {/* Hint en tiempo real de cuánto va al negocio */}
          {form.commission_pct > 0 && (
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
              {form.commission_pct}% al {isOwner ? 'dueño' : 'empleado'} →{' '}
              <span style={{ color: 'var(--color-success)' }}>
                {(100 - form.commission_pct).toFixed(1)}% al salón
              </span>
            </p>
          )}
        </div>
      </div>

      {/* ── Fecha de ingreso ──────────────────────────────────────────── */}
      <div>
        <label className="luma-label">Fecha de ingreso</label>
        <input type="date" value={form.hire_date ?? ''}
          onChange={e => set('hire_date', e.target.value || null)} className="luma-input" />
      </div>

      {/* ── Color Google Calendar ─────────────────────────────────────── */}
      <div className="rounded-xl p-4 border"
           style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)' }}>
        <GoogleColorPicker
          value={form.calendar_color as GoogleCalendarColor}
          onChange={color => set('calendar_color', color)}
        />
      </div>

      {/* ── Notas ────────────────────────────────────────────────────── */}
      <div>
        <label className="luma-label">Notas internas</label>
        <textarea rows={3}
          placeholder="Especialidades, horarios especiales, observaciones..."
          value={form.notes ?? ''}
          onChange={e => set('notes', e.target.value || null)}
          className="luma-input resize-none" data-selectable />
      </div>

      {/* ── Acciones ─────────────────────────────────────────────────── */}
      <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
        <button type="button" onClick={onCancel} className="luma-btn-ghost">
          Cancelar
        </button>
        <button type="submit" disabled={saving} className="luma-btn-primary">
          {saving
            ? <><Loader2 size={15} className="animate-spin" /> Guardando...</>
            : <><Save size={15} /> {initial ? 'Actualizar' : 'Crear empleado'}</>
          }
        </button>
      </div>
    </form>
  )
}
