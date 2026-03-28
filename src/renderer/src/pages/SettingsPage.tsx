import React, { useState, useEffect } from 'react'
import {
  Settings, Save, Loader2, Store, DollarSign, Palette,
  Calendar, Check, AlertCircle, RefreshCw, Pipette,
} from 'lucide-react'
import { PageHeader, Spinner } from '../components/ui/index'
import { applyTheme } from '../hooks/useAppState'

interface SettingsForm {
  salon_name: string
  salon_currency: string
  tax_label: string
  tax_rate: string
  theme: string
  // Colores del tema personalizado
  custom_bg: string
  custom_surface: string
  custom_surface2: string
  custom_border: string
  custom_accent: string
  custom_text: string
  custom_text_muted: string
  custom_success: string
  custom_danger: string
  custom_warning: string
  custom_info: string
  // Google Calendar
  google_client_id: string
  google_secret: string
}

const DEFAULTS: SettingsForm = {
  salon_name: '', salon_currency: 'MXN',
  tax_label: 'IVA', tax_rate: '16', theme: 'dark',
  custom_bg: '#0f0e17', custom_surface: '#1a1826', custom_surface2: '#232133',
  custom_border: '#2e2b3e', custom_accent: '#d4881f', custom_text: '#ede8d9',
  custom_text_muted: '#7a7490', custom_success: '#4caf7d', custom_danger: '#e05c5c',
  custom_warning: '#e4a73a', custom_info: '#4a90d9',
  google_client_id: '', google_secret: '',
}

const CURRENCIES = ['MXN', 'USD', 'EUR', 'COP', 'ARS', 'CLP', 'PEN']

export const SettingsPage: React.FC = () => {
  const [form, setForm]       = useState<SettingsForm>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    window.electronAPI.settings.getAll().then(res => {
      if (res.ok) {
        const d = res.data as Record<string, string>
        setForm(prev => ({
          ...prev,
          salon_name:      d.salon_name      ?? prev.salon_name,
          salon_currency:  d.salon_currency  ?? prev.salon_currency,
          tax_label:       d.tax_label       ?? prev.tax_label,
          tax_rate:        d.tax_rate        ?? prev.tax_rate,
          theme:           d.theme           ?? prev.theme,
          custom_bg:       d.custom_bg       ?? prev.custom_bg,
          custom_surface:  d.custom_surface  ?? prev.custom_surface,
          custom_surface2: d.custom_surface2 ?? prev.custom_surface2,
          custom_border:   d.custom_border   ?? prev.custom_border,
          custom_accent:   d.custom_accent   ?? prev.custom_accent,
          custom_text:     d.custom_text     ?? prev.custom_text,
          custom_text_muted: d.custom_text_muted ?? prev.custom_text_muted,
          custom_success:  d.custom_success  ?? prev.custom_success,
          custom_danger:   d.custom_danger   ?? prev.custom_danger,
          custom_warning:  d.custom_warning  ?? prev.custom_warning,
          custom_info:     d.custom_info     ?? prev.custom_info,
          google_client_id: d.google_client_id ?? '',
          google_secret:   d.google_secret   ?? '',
        }))
      }
      setLoading(false)
    })
  }, [])

  const set = (key: keyof SettingsForm, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }))
    setSaved(false)
    // Previsualizar tema personalizado en tiempo real
    if (key.startsWith('custom_') || key === 'theme') {
      const updated = { ...form, [key]: value }
      applyTheme(updated.theme, updated as unknown as Record<string, string>)
    }
  }

  const selectTheme = (t: string) => {
    set('theme', t)
    applyTheme(t, form as unknown as Record<string, string>)
  }

  const handleSave = async () => {
    setSaving(true); setError(null); setSaved(false)
    try {
      const res = await window.electronAPI.settings.set({
        salon_name:       form.salon_name.trim() || 'Mi Salón',
        salon_currency:   form.salon_currency,
        tax_label:        form.tax_label.trim()  || 'IVA',
        tax_rate:         String(parseFloat(form.tax_rate) || 0),
        theme:            form.theme,
        custom_bg:        form.custom_bg,
        custom_surface:   form.custom_surface,
        custom_surface2:  form.custom_surface2,
        custom_border:    form.custom_border,
        custom_accent:    form.custom_accent,
        custom_text:      form.custom_text,
        custom_text_muted: form.custom_text_muted,
        custom_success:   form.custom_success,
        custom_danger:    form.custom_danger,
        custom_warning:   form.custom_warning,
        custom_info:      form.custom_info,
        google_client_id: form.google_client_id.trim(),
        google_secret:    form.google_secret.trim(),
      })
      if (!res.ok) { setError(res.error ?? 'Error al guardar'); return }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) { setError(String(e)) }
    finally { setSaving(false) }
  }

  if (loading) return <div className="flex items-center justify-center h-full"><Spinner size={36} /></div>

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Ajustes"
        subtitle="Configuración del salón y preferencias del sistema"
        icon={<Settings size={18} />}
        actions={
          <button onClick={handleSave} disabled={saving} className="luma-btn-primary">
            {saving ? <><Loader2 size={15} className="animate-spin" /> Guardando...</>
              : saved ? <><Check size={15} /> Guardado</>
              : <><Save size={15} /> Guardar cambios</>}
          </button>
        }
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto flex flex-col gap-6">

          {error && (
            <div className="rounded-lg px-4 py-3 text-sm flex items-center gap-2"
                 style={{ background: 'color-mix(in srgb,var(--color-danger) 12%,transparent)', color: 'var(--color-danger)' }}>
              <AlertCircle size={14} />{error}
            </div>
          )}
          {saved && (
            <div className="rounded-lg px-4 py-3 text-sm flex items-center gap-2"
                 style={{ background: 'color-mix(in srgb,var(--color-success) 12%,transparent)', color: 'var(--color-success)' }}>
              <Check size={14} /> Configuración guardada. El nombre del salón se actualizará al reiniciar.
            </div>
          )}

          {/* Salón */}
          <Section title="Información del salón" icon={<Store size={16} />}>
            <div>
              <label className="luma-label">Nombre del salón</label>
              <input type="text" placeholder="Mi Salón" value={form.salon_name}
                onChange={e => set('salon_name', e.target.value)}
                className="luma-input" data-selectable />
            </div>
            <div>
              <label className="luma-label">Moneda</label>
              <select value={form.salon_currency}
                onChange={e => set('salon_currency', e.target.value)} className="luma-input w-40">
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </Section>

          {/* Fiscal */}
          <Section title="Configuración fiscal" icon={<DollarSign size={16} />}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="luma-label">Etiqueta del impuesto</label>
                <input type="text" placeholder="IVA" value={form.tax_label}
                  onChange={e => set('tax_label', e.target.value)} className="luma-input" data-selectable />
              </div>
              <div>
                <label className="luma-label">Tasa (%)</label>
                <input type="number" min="0" max="100" step="0.5"
                  value={form.tax_rate === '0' ? '' : form.tax_rate}
                  onFocus={e => e.target.select()}
                  onChange={e => set('tax_rate', e.target.value)}
                  className="luma-input" data-selectable />
              </div>
            </div>
            <div className="rounded-lg px-4 py-3 text-xs"
                 style={{ background: 'color-mix(in srgb,var(--color-info) 10%,transparent)', color: 'var(--color-info)' }}>
              El {form.tax_label || 'impuesto'} del {form.tax_rate || 0}% solo aplica cuando el cajero activa
              "Requiere factura oficial" en el POS.
            </div>
          </Section>

          {/* Apariencia */}
          <Section title="Apariencia" icon={<Palette size={16} />}>
            <div>
              <label className="luma-label mb-3">Tema</label>
              <div className="flex gap-3">
                {[
                  { value: 'dark',   label: '🌙 Oscuro' },
                  { value: 'light',  label: '☀️ Claro' },
                  { value: 'custom', label: '🎨 Personalizado' },
                ].map(t => (
                  <button key={t.value} type="button"
                    onClick={() => selectTheme(t.value)}
                    className="flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all"
                    style={{
                      borderColor: form.theme === t.value ? 'var(--color-accent)' : 'var(--color-border)',
                      background:  form.theme === t.value ? 'color-mix(in srgb,var(--color-accent) 12%,transparent)' : 'var(--color-surface-2)',
                      color:       form.theme === t.value ? 'var(--color-accent)' : 'var(--color-text-muted)',
                    }}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Editor de colores del modo personalizado */}
            {form.theme === 'custom' && (
              <div className="flex flex-col gap-4 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  Los cambios se previsualizan en tiempo real. Guarda para que persistan.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'custom_bg',         label: 'Fondo principal' },
                    { key: 'custom_surface',     label: 'Superficie (tarjetas)' },
                    { key: 'custom_surface2',    label: 'Superficie 2 (anidada)' },
                    { key: 'custom_border',      label: 'Bordes' },
                    { key: 'custom_accent',      label: 'Color de marca' },
                    { key: 'custom_text',        label: 'Texto principal' },
                    { key: 'custom_text_muted',  label: 'Texto secundario' },
                    { key: 'custom_success',     label: 'Éxito (verde)' },
                    { key: 'custom_danger',      label: 'Peligro (rojo)' },
                    { key: 'custom_warning',     label: 'Advertencia (amarillo)' },
                    { key: 'custom_info',        label: 'Información (azul)' },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-3">
                      <input
                        type="color"
                        value={(form as Record<string, string>)[key] ?? '#000000'}
                        onChange={e => set(key as keyof SettingsForm, e.target.value)}
                        className="w-9 h-9 rounded-lg border cursor-pointer flex-shrink-0"
                        style={{ borderColor: 'var(--color-border)', padding: '2px', background: 'var(--color-surface-2)' }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>{label}</p>
                        <p className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>
                          {(form as Record<string, string>)[key]}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Botón restablecer a defaults del modo oscuro */}
                <button
                  type="button"
                  onClick={() => {
                    const reset: Partial<SettingsForm> = {
                      custom_bg: '#0f0e17', custom_surface: '#1a1826', custom_surface2: '#232133',
                      custom_border: '#2e2b3e', custom_accent: '#d4881f', custom_text: '#ede8d9',
                      custom_text_muted: '#7a7490', custom_success: '#4caf7d', custom_danger: '#e05c5c',
                      custom_warning: '#e4a73a', custom_info: '#4a90d9',
                    }
                    const updated = { ...form, ...reset }
                    setForm(updated)
                    applyTheme('custom', updated as unknown as Record<string, string>)
                  }}
                  className="luma-btn-ghost text-xs self-start">
                  <RefreshCw size={12} /> Restablecer colores por defecto
                </button>
              </div>
            )}
          </Section>

          {/* Google Calendar */}
          <Section title="Google Calendar" icon={<Calendar size={16} />} badge="Próximamente">
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Configura tus credenciales de Google Cloud para sincronizar citas con Google Calendar.
            </p>
            <div>
              <label className="luma-label">Client ID</label>
              <input type="text" disabled placeholder="xxxxxxxx.apps.googleusercontent.com"
                value={form.google_client_id} onChange={e => set('google_client_id', e.target.value)}
                className="luma-input opacity-50 cursor-not-allowed" />
            </div>
            <div>
              <label className="luma-label">Client Secret</label>
              <input type="password" disabled placeholder="••••••••••••••••"
                value={form.google_secret} onChange={e => set('google_secret', e.target.value)}
                className="luma-input opacity-50 cursor-not-allowed" />
            </div>
          </Section>

          <div className="flex justify-end pb-4">
            <button onClick={handleSave} disabled={saving} className="luma-btn-primary px-8">
              {saving ? <><Loader2 size={15} className="animate-spin" /> Guardando...</>
                : saved ? <><Check size={15} /> Guardado</>
                : <><Save size={15} /> Guardar cambios</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const Section: React.FC<{ title: string; icon: React.ReactNode; badge?: string; children: React.ReactNode }> = ({ title, icon, badge, children }) => (
  <div className="luma-surface p-6 flex flex-col gap-4">
    <div className="flex items-center gap-2 pb-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
      <span style={{ color: 'var(--color-accent)' }}>{icon}</span>
      <h3 className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>{title}</h3>
      {badge && (
        <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: 'color-mix(in srgb,var(--color-info) 15%,transparent)', color: 'var(--color-info)' }}>
          {badge}
        </span>
      )}
    </div>
    {children}
  </div>
)