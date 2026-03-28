import React, { useState, useEffect } from 'react'
import { Save, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import type { Client } from '../../types'

type ClientFormData = Omit<Client, 'id' | 'created_at' | 'updated_at' | 'full_name' | 'visit_count' | 'last_visit_at'>

const EMPTY: ClientFormData = {
  first_name: '', last_name: '', email: null, phone: null,
  phone_country: '+52', birthdate: null,
  tax_id: null, tax_legal_name: null, tax_zip_code: null,
  tax_regime: null, tax_use: null,
  notes: null, photo_path: null, is_active: true,
}

// Regímenes fiscales México (SAT)
const TAX_REGIMES = [
  '601 - General de Ley Personas Morales',
  '603 - Personas Morales con Fines no Lucrativos',
  '605 - Sueldos y Salarios e Ingresos Asimilados a Salarios',
  '606 - Arrendamiento',
  '607 - Régimen de Enajenación o Adquisición de Bienes',
  '608 - Demás ingresos',
  '610 - Residentes en el Extranjero sin Establecimiento Permanente en México',
  '611 - Ingresos por Dividendos (socios y accionistas)',
  '612 - Personas Físicas con Actividades Empresariales y Profesionales',
  '614 - Ingresos por intereses',
  '615 - Régimen de los ingresos por obtención de premios',
  '616 - Sin obligaciones fiscales',
  '620 - Sociedades Cooperativas de Producción que optan por diferir sus ingresos',
  '621 - Incorporación Fiscal',
  '622 - Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras',
  '623 - Opcional para Grupos de Sociedades',
  '624 - Coordinados',
  '625 - Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas',
  '626 - Régimen Simplificado de Confianza',
]

// Usos del CFDI más comunes
const TAX_USES = [
  'G01 - Adquisición de mercancias',
  'G02 - Devoluciones, descuentos o bonificaciones',
  'G03 - Gastos en general',
  'I01 - Construcciones',
  'I02 - Mobilario y equipo de oficina por inversiones',
  'I03 - Equipo de transporte',
  'I04 - Equipo de computo y accesorios',
  'I05 - Dados, troqueles, moldes, matrices y herramental',
  'I06 - Comunicaciones telefónicas',
  'I07 - Comunicaciones satelitales',
  'I08 - Otra maquinaria y equipo',
  'D01 - Honorarios médicos, dentales y gastos hospitalarios',
  'D02 - Gastos médicos por incapacidad o discapacidad',
  'D03 - Gastos funerales',
  'D04 - Donativos',
  'D10 - Pagos por servicios educativos (colegiaturas)',
  'S01 - Sin efectos fiscales',
  'CP01 - Pagos',
  'CN01 - Nómina',
]

interface Props {
  initial?: Client | null
  onSave: (data: ClientFormData) => Promise<void>
  onCancel: () => void
}

export const ClientForm: React.FC<Props> = ({ initial, onSave, onCancel }) => {
  const [form, setForm]           = useState<ClientFormData>(EMPTY)
  const [saving, setSaving]       = useState(false)
  const [errors, setErrors]       = useState<Partial<Record<keyof ClientFormData, string>>>({})
  const [showFiscal, setShowFiscal] = useState(false)

  useEffect(() => {
    if (initial) {
      setForm({
        first_name: initial.first_name, last_name: initial.last_name,
        email: initial.email, phone: initial.phone,
        phone_country: initial.phone_country, birthdate: initial.birthdate,
        tax_id: initial.tax_id, tax_legal_name: initial.tax_legal_name,
        tax_zip_code: initial.tax_zip_code, tax_regime: initial.tax_regime,
        tax_use: initial.tax_use, notes: initial.notes,
        photo_path: initial.photo_path, is_active: initial.is_active,
      })
      // Abrir sección fiscal si ya tiene datos
      if (initial.tax_id || initial.tax_legal_name) setShowFiscal(true)
    } else {
      setForm(EMPTY)
      setShowFiscal(false)
    }
    setErrors({})
  }, [initial])

  const set = <K extends keyof ClientFormData>(k: K, v: ClientFormData[K]) => {
    setForm(p => ({ ...p, [k]: v }))
    setErrors(p => ({ ...p, [k]: undefined }))
  }

  const validate = () => {
    const e: typeof errors = {}
    if (!form.first_name.trim()) e.first_name = 'El nombre es requerido.'
    if (!form.last_name.trim())  e.last_name  = 'El apellido es requerido.'
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

      {/* Nombre y apellido */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="luma-label">Nombre <span style={{ color: 'var(--color-danger)' }}>*</span></label>
          <input type="text" placeholder="Ej. María" value={form.first_name}
            onChange={e => set('first_name', e.target.value)} className="luma-input" />
          {errors.first_name && <p className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>{errors.first_name}</p>}
        </div>
        <div>
          <label className="luma-label">Apellido <span style={{ color: 'var(--color-danger)' }}>*</span></label>
          <input type="text" placeholder="Ej. López" value={form.last_name}
            onChange={e => set('last_name', e.target.value)} className="luma-input" />
          {errors.last_name && <p className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>{errors.last_name}</p>}
        </div>
      </div>

      {/* Contacto */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="luma-label">Correo electrónico</label>
          <input type="email" placeholder="maria@ejemplo.com" value={form.email ?? ''}
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

      {/* Fecha de nacimiento */}
      <div>
        <label className="luma-label">Fecha de nacimiento</label>
        <input type="date" value={form.birthdate ?? ''}
          onChange={e => set('birthdate', e.target.value || null)} className="luma-input w-48" />
      </div>

      {/* Notas */}
      <div>
        <label className="luma-label">Notas</label>
        <textarea rows={2} placeholder="Preferencias, alergias, observaciones..."
          value={form.notes ?? ''}
          onChange={e => set('notes', e.target.value || null)}
          className="luma-input resize-none" data-selectable />
      </div>

      {/* ── Datos fiscales (colapsable) ─────────────────────────────────── */}
      <div className="rounded-xl border overflow-hidden"
           style={{ borderColor: 'var(--color-border)' }}>
        <button
          type="button"
          onClick={() => setShowFiscal(p => !p)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors hover:opacity-80"
          style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)' }}
        >
          <span>🧾 Datos fiscales para facturación oficial</span>
          {showFiscal ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showFiscal && (
          <div className="p-4 flex flex-col gap-4" style={{ background: 'var(--color-surface)' }}>
            {/* RFC y Razón Social */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="luma-label">RFC / Tax ID</label>
                <input type="text" placeholder="XAXX010101000" value={form.tax_id ?? ''}
                  onChange={e => set('tax_id', e.target.value.toUpperCase() || null)}
                  className="luma-input font-mono" />
              </div>
              <div>
                <label className="luma-label">Código Postal Fiscal</label>
                <input type="text" placeholder="06600" maxLength={5} value={form.tax_zip_code ?? ''}
                  onChange={e => set('tax_zip_code', e.target.value || null)}
                  className="luma-input" />
              </div>
            </div>

            <div>
              <label className="luma-label">Razón Social</label>
              <input type="text" placeholder="Nombre o empresa tal como aparece en el SAT"
                value={form.tax_legal_name ?? ''}
                onChange={e => set('tax_legal_name', e.target.value || null)}
                className="luma-input" />
            </div>

            {/* Régimen fiscal */}
            <div>
              <label className="luma-label">Régimen Fiscal</label>
              <select value={form.tax_regime ?? ''}
                onChange={e => set('tax_regime', e.target.value || null)}
                className="luma-input">
                <option value="">Seleccionar régimen...</option>
                {TAX_REGIMES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            {/* Uso CFDI */}
            <div>
              <label className="luma-label">Uso del CFDI</label>
              <select value={form.tax_use ?? ''}
                onChange={e => set('tax_use', e.target.value || null)}
                className="luma-input">
                <option value="">Seleccionar uso...</option>
                {TAX_USES.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Acciones */}
      <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
        <button type="button" onClick={onCancel} className="luma-btn-ghost">Cancelar</button>
        <button type="submit" disabled={saving} className="luma-btn-primary">
          {saving
            ? <><Loader2 size={15} className="animate-spin" /> Guardando...</>
            : <><Save size={15} /> {initial ? 'Actualizar' : 'Crear cliente'}</>}
        </button>
      </div>
    </form>
  )
}
