import React, { useState, useEffect } from 'react'
import {
  Settings, Save, Loader2, Store, DollarSign, Palette,
  Calendar, Check, AlertCircle, RefreshCw, ExternalLink,
  ChevronDown, ChevronUp, Eye, EyeOff, ShieldCheck,
  Database, Download, Upload, FileText, History, Terminal,
  AlertTriangle, Trash2, Info, Activity,
} from 'lucide-react'
import { PageHeader, Spinner, Paginator, Badge } from '../components/ui/index'

import { Modal } from '../components/ui/Modal'
import { applyTheme } from '../hooks/useAppState'
import { ErrorLog } from '../types'

interface SettingsForm {
  salon_name: string
  salon_currency: string
  tax_label: string
  tax_rate: string
  theme: string
  custom_bg: string; custom_surface: string; custom_surface2: string
  custom_border: string; custom_accent: string; custom_text: string
  custom_text_muted: string; custom_success: string; custom_danger: string
  custom_warning: string; custom_info: string
  google_client_id: string
  google_secret: string
}

const DEFAULTS: SettingsForm = {
  salon_name: '', salon_currency: 'MXN',
  tax_label: 'IVA', tax_rate: '16', theme: 'dark',
  custom_bg: '#0f0d0b', custom_surface: '#1a1714', custom_surface2: '#242019',
  custom_border: '#2e2920', custom_accent: '#d4881f', custom_text: '#f5f0e8',
  custom_text_muted: '#8a8070', custom_success: '#4caf7d', custom_danger: '#dc4a3d',
  custom_warning: '#e8a838', custom_info: '#4a90d9',
  google_client_id: '', google_secret: '',
}

const CURRENCIES = ['MXN', 'USD', 'EUR', 'COP', 'ARS', 'CLP', 'PEN']

type TabId = 'general' | 'appearance' | 'google' | 'system'

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('general')
  const [form, setForm]           = useState<SettingsForm>(DEFAULTS)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [showSecret, setShowSec]  = useState(false)
  const [showGuide, setShowGuide] = useState(false)

  // Estados para logs y sistema
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([])
  const [logsTotal, setLogsTotal] = useState(0)
  const [logsPage, setLogsPage]   = useState(1)
  const [logsLoading, setLogsLoading] = useState(false)
  const [rawLogs, setRawLogs]     = useState<string | null>(null)
  const [selectedError, setSelectedError] = useState<ErrorLog | null>(null)
  const [showImportConfirm, setShowImportConfirm] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [successMsg, setSuccessMsg] = useState<{ title: string; body: string } | null>(null)

  useEffect(() => {
    window.electronAPI.settings.getAll().then(res => {
      if (res.ok) {
        const d = res.data as Record<string, string>
        setForm(prev => ({
          ...prev,
          salon_name:       d.salon_name       ?? prev.salon_name,
          salon_currency:   d.salon_currency   ?? prev.salon_currency,
          tax_label:        d.tax_label        ?? prev.tax_label,
          tax_rate:         d.tax_rate         ?? prev.tax_rate,
          theme:            d.theme            ?? prev.theme,
          custom_bg:        d.custom_bg        ?? prev.custom_bg,
          custom_surface:   d.custom_surface   ?? prev.custom_surface,
          custom_surface2:  d.custom_surface2  ?? prev.custom_surface2,
          custom_border:    d.custom_border    ?? prev.custom_border,
          custom_accent:    d.custom_accent    ?? prev.custom_accent,
          custom_text:      d.custom_text      ?? prev.custom_text,
          custom_text_muted: d.custom_text_muted ?? prev.custom_text_muted,
          custom_success:   d.custom_success   ?? prev.custom_success,
          custom_danger:    d.custom_danger    ?? prev.custom_danger,
          custom_warning:   d.custom_warning   ?? prev.custom_warning,
          custom_info:      d.custom_info      ?? prev.custom_info,
          google_client_id: d.google_client_id ?? '',
          google_secret:    d.google_secret    ?? '',
        }))
      }
      setLoading(false)
    })
  }, [])

  // Cargar logs cuando se activa la pestaña de sistema
  useEffect(() => {
    if (activeTab === 'system') {
      loadErrorLogs(1)
    }
  }, [activeTab])

  const loadErrorLogs = async (page: number) => {
    setLogsLoading(true)
    try {
      const res = await window.electronAPI.getErrorLogs(page, 10)
      if (res.ok) {
        setErrorLogs(res.data.items)
        setLogsTotal(res.data.total)
        setLogsPage(page)
      }
    } finally {
      setLogsLoading(false)
    }
  }

  const handleExport = async () => {
    const res = await window.electronAPI.exportDb()
    if (res.ok) {
      setSuccessMsg({
        title: 'Exportación Exitosa',
        body: `Se ha guardado una copia de seguridad en: ${res.data}`
      })
    } else if (res.error !== 'Cancelado por el usuario') {
      setError(res.error || 'Error al exportar')
    }
  }

  const handleImport = async () => {
    setShowImportConfirm(false)
    const res = await window.electronAPI.importDb()
    if (res.ok) {
      setSuccessMsg({
        title: 'Importación Exitosa',
        body: 'La base de datos se ha restaurado correctamente. La aplicación se reiniciará al cerrar este mensaje.'
      })
    } else if (res.error !== 'Cancelado') {
      setError(res.error || 'Error al importar')
    }
  }

  const viewRawLogs = async () => {
    const logs = await window.electronAPI.readLogs(500)
    setRawLogs(logs)
  }

  const set = (key: keyof SettingsForm, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }))
    setSaved(false)
    if (key.startsWith('custom_') || key === 'theme') {
      const updated = { ...form, [key]: value }
      applyTheme(updated.theme, updated as unknown as Record<string, string>)
    }
  }

  const selectTheme = (t: string) => {
    setForm(prev => ({ ...prev, theme: t }))
    setSaved(false)
    applyTheme(t, { ...form, theme: t } as unknown as Record<string, string>)
  }

  const handleSave = async () => {
    setSaving(true); setError(null); setSaved(false)
    try {
      const res = await window.electronAPI.settings.set({
        salon_name:        form.salon_name.trim()  || 'Mi Salón',
        salon_currency:    form.salon_currency,
        tax_label:         form.tax_label.trim()   || 'IVA',
        tax_rate:          String(parseFloat(form.tax_rate) || 0),
        theme:             form.theme,
        custom_bg:         form.custom_bg,
        custom_surface:    form.custom_surface,
        custom_surface2:   form.custom_surface2,
        custom_border:     form.custom_border,
        custom_accent:     form.custom_accent,
        custom_text:       form.custom_text,
        custom_text_muted: form.custom_text_muted,
        custom_success:    form.custom_success,
        custom_danger:     form.custom_danger,
        custom_warning:    form.custom_warning,
        custom_info:       form.custom_info,
        google_client_id:  form.google_client_id.trim(),
        google_secret:     form.google_secret.trim(),
      })
      if (!res.ok) { setError(res.error ?? 'Error al guardar'); return }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) { setError(String(e)) }
    finally { setSaving(false) }
  }

  if (loading) return <div className="flex items-center justify-center h-full"><Spinner size={36} /></div>

  const hasCredentials = form.google_client_id.trim().length > 0 && form.google_secret.trim().length > 0

  const tabs: { id: TabId, label: string, icon: React.ReactNode }[] = [
    { id: 'general',    label: 'General',    icon: <Store size={14} /> },
    { id: 'appearance', label: 'Apariencia', icon: <Palette size={14} /> },
    { id: 'google',     label: 'Google',     icon: <Calendar size={14} /> },
    { id: 'system',     label: 'Sistema',    icon: <Terminal size={14} /> },
  ]

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

      {/* ── Tabs Navigation ─────────────────────────────────────────── */}
      <div className="px-6 flex gap-1 border-b" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-2 px-4 py-3 text-xs font-medium transition-all relative"
            style={{
              color: activeTab === tab.id ? 'var(--color-accent)' : 'var(--color-text-muted)',
            }}
          >
            {tab.icon}
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-accent)]" />
            )}
          </button>
        ))}
      </div>

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
              <Check size={14} /> Configuración guardada correctamente.
            </div>
          )}

          {/* ── Tab: General ────────────────────────────────────────────── */}
          {activeTab === 'general' && (
            <>
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
            </>
          )}

          {/* ── Tab: Apariencia ─────────────────────────────────────────── */}
          {activeTab === 'appearance' && (
            <Section title="Apariencia" icon={<Palette size={16} />}>
              <div>
                <label className="luma-label mb-3">Tema</label>
                <div className="flex gap-3">
                  {[
                    { value: 'dark',   label: '🌙 Oscuro' },
                    { value: 'light',  label: '☀️ Claro' },
                    { value: 'custom', label: '🎨 Personalizado' },
                  ].map(t => (
                    <button key={t.value} type="button" onClick={() => selectTheme(t.value)}
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

              {form.theme === 'custom' && (
                <div className="flex flex-col gap-4 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    Los cambios se previsualizan en tiempo real. Guarda para que persistan.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      ['custom_bg',         'Fondo principal'],
                      ['custom_surface',     'Superficie (tarjetas)'],
                      ['custom_surface2',    'Superficie 2 (anidada)'],
                      ['custom_border',      'Bordes'],
                      ['custom_accent',      'Color de marca'],
                      ['custom_text',        'Texto principal'],
                      ['custom_text_muted',  'Texto secundario'],
                      ['custom_success',     'Éxito (verde)'],
                      ['custom_danger',      'Peligro (rojo)'],
                      ['custom_warning',     'Advertencia (amarillo)'],
                      ['custom_info',        'Información (azul)'],
                    ] as [keyof SettingsForm, string][]).map(([key, label]) => (
                      <div key={key} className="flex items-center gap-3">
                        <input type="color"
                          value={(form as Record<string, string>)[key] ?? '#000000'}
                          onChange={e => set(key, e.target.value)}
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
                  <button type="button" onClick={() => {
                      const reset = { ...DEFAULTS }
                      const updated = { ...form, ...{
                        custom_bg: reset.custom_bg, custom_surface: reset.custom_surface,
                        custom_surface2: reset.custom_surface2, custom_border: reset.custom_border,
                        custom_accent: reset.custom_accent, custom_text: reset.custom_text,
                        custom_text_muted: reset.custom_text_muted, custom_success: reset.custom_success,
                        custom_danger: reset.custom_danger, custom_warning: reset.custom_warning,
                        custom_info: reset.custom_info,
                      }}
                      setForm(updated)
                      applyTheme('custom', updated as unknown as Record<string, string>)
                    }}
                    className="luma-btn-ghost text-xs self-start">
                    <RefreshCw size={12} /> Restablecer colores por defecto
                  </button>
                </div>
              )}
            </Section>
          )}

          {/* ── Tab: Google Calendar ─────────────────────────────────────────── */}
          {activeTab === 'google' && (
            <Section title="Google Calendar" icon={<Calendar size={16} />}>

              {/* Estado actual de credenciales */}
              <div className="flex items-center gap-3 rounded-lg px-4 py-3"
                   style={{
                     background: hasCredentials
                       ? 'color-mix(in srgb,var(--color-success) 10%,transparent)'
                       : 'color-mix(in srgb,var(--color-warning) 10%,transparent)',
                   }}>
                <ShieldCheck size={16} style={{ color: hasCredentials ? 'var(--color-success)' : 'var(--color-warning)', flexShrink: 0 }} />
                <div className="flex-1">
                  <p className="text-xs font-medium" style={{ color: hasCredentials ? 'var(--color-success)' : 'var(--color-warning)' }}>
                    {hasCredentials ? 'Credenciales configuradas' : 'Credenciales no configuradas'}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {hasCredentials
                      ? 'Ve a la Agenda para conectar con Google y autorizar el acceso.'
                      : 'Ingresa tu Client ID y Client Secret de Google Cloud para habilitar la Agenda.'}
                  </p>
                </div>
              </div>

              {/* Campos de credenciales — HABILITADOS */}
              <div>
                <label className="luma-label">Client ID de Google Cloud</label>
                <input type="text" placeholder="xxxxxxxxxxxxxxxx.apps.googleusercontent.com"
                  value={form.google_client_id}
                  onChange={e => set('google_client_id', e.target.value)}
                  className="luma-input" data-selectable />
              </div>
              <div>
                <label className="luma-label">Client Secret</label>
                <div className="relative">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    placeholder="GOCSPX-••••••••••••••••"
                    value={form.google_secret}
                    onChange={e => set('google_secret', e.target.value)}
                    className="luma-input pr-10" data-selectable />
                  <button type="button" onClick={() => setShowSec(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 luma-btn-ghost p-0"
                    style={{ color: 'var(--color-text-muted)' }}>
                    {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* Guía desplegable de cómo crear la app en Google Cloud */}
              <button type="button" onClick={() => setShowGuide(g => !g)}
                className="flex items-center gap-2 text-xs w-full px-3 py-2.5 rounded-lg border transition-colors"
                style={{
                  borderColor: 'var(--color-border)',
                  color:       'var(--color-text-muted)',
                  background:  'var(--color-surface-2)',
                }}>
                <ExternalLink size={13} style={{ color: 'var(--color-accent)' }} />
                <span className="flex-1 text-left font-medium" style={{ color: 'var(--color-text)' }}>
                  ¿Cómo crear la app en Google Cloud Console?
                </span>
                {showGuide ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showGuide && <GoogleCloudGuide />}
            </Section>
          )}

          {/* ── Tab: Sistema (Fase 12 y 13) ─────────────────────────────── */}
          {activeTab === 'system' && (
            <>
              {/* Portabilidad (Fase 12) */}
              <Section title="Portabilidad de datos" icon={<Database size={16} />}>
                <div className="flex gap-3">
                  <button onClick={handleExport} className="flex-1 luma-surface p-4 flex flex-col items-center gap-2 hover:border-[var(--color-accent)] transition-all group">
                    <Download size={24} className="text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)]" />
                    <span className="text-xs font-semibold">Exportar Respaldo</span>
                    <span className="text-[10px] text-center text-[var(--color-text-muted)]">Descarga una copia de seguridad de todos tus datos actuales.</span>
                  </button>
                  <button onClick={() => setShowImportConfirm(true)} className="flex-1 luma-surface p-4 flex flex-col items-center gap-2 hover:border-[var(--color-danger)] transition-all group">
                    <Upload size={24} className="text-[var(--color-text-muted)] group-hover:text-[var(--color-danger)]" />
                    <span className="text-xs font-semibold">Importar Respaldo</span>
                    <span className="text-[10px] text-center text-[var(--color-text-muted)]">Carga un archivo de respaldo previo. <strong className="text-[var(--color-danger)]">Reemplaza datos.</strong></span>
                  </button>
                </div>
              </Section>

              {/* Bitácora de Eventos (Fase 13) */}
              <Section title="Bitácora de eventos" icon={<Activity size={16} />}>
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-[10px] text-[var(--color-text-muted)] uppercase font-bold tracking-wider">Últimos movimientos y registros</p>
                    <div className="flex gap-2">
                      <button onClick={() => setShowClearConfirm(true)} 
                        className="luma-btn-ghost py-1 text-[10px] text-[var(--color-danger)] hover:bg-[color-mix(in srgb,var(--color-danger) 10%,transparent)]"
                      >
                        <Trash2 size={12} /> Vaciar log
                      </button>
                      <button onClick={viewRawLogs} className="luma-btn-ghost py-1 text-[10px]">
                        <FileText size={12} /> Ver archivo
                      </button>
                    </div>
                  </div>
                  
                  <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                    <table className="w-full text-left text-xs">
                      <thead style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}>
                        <tr>
                          <th className="px-3 py-2 font-semibold w-20">Nivel</th>
                          <th className="px-3 py-2 font-semibold w-32">Fecha</th>
                          <th className="px-3 py-2 font-semibold">Evento</th>
                          <th className="px-3 py-2 w-10"></th>
                        </tr>
                      </thead>
                      <tbody style={{ color: 'var(--color-text)' }}>
                        {logsLoading ? (
                          <tr><td colSpan={4} className="px-3 py-8 text-center"><Spinner size={16} /></td></tr>
                        ) : errorLogs.length === 0 ? (
                          <tr><td colSpan={4} className="px-3 py-8 text-center text-[var(--color-text-muted)]">No hay eventos registrados.</td></tr>
                        ) : errorLogs.map(log => (
                          <tr key={log.id} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                            <td className="px-3 py-2">
                              <Badge variant={
                                log.level === 'error' ? 'danger' : 
                                log.level === 'warn' ? 'warning' :
                                log.level === 'info' ? 'info' : 'muted'
                              } className="uppercase text-[9px]">
                                {log.level}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-[10px] font-mono">
                              {new Date(log.occurred_at).toLocaleString('es-MX', { hour12: true })}
                            </td>
                            <td className="px-3 py-2 truncate max-w-[200px]">
                              {log.message}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button onClick={() => setSelectedError(log)} className="p-1 luma-btn-ghost">
                                <Eye size={12} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {logsTotal > 10 && (
                    <div className="pt-2">
                      <Paginator 
                        page={logsPage} 
                        pageSize={10} 
                        total={logsTotal} 
                        onChange={loadErrorLogs} 
                      />
                    </div>
                  )}
                </div>
              </Section>
            </>
          )}

          <div className="flex justify-end pb-4">
            <button onClick={handleSave} disabled={saving} className="luma-btn-primary px-8">
              {saving ? <><Loader2 size={15} className="animate-spin" /> Guardando...</>
                : saved ? <><Check size={15} /> Guardado</>
                : <><Save size={15} /> Guardar cambios</>}
            </button>
          </div>
        </div>
      </div>

      {/* ── Modales ─────────────────────────────────────────────────── */}
      
      {/* Detalle del Evento */}
      <Modal 
        isOpen={!!selectedError} 
        onClose={() => setSelectedError(null)} 
        title="Detalle del Evento"
      >
        {selectedError && (
          <div className="flex flex-col gap-4 max-h-[60vh] overflow-auto select-text">
            <div className="flex items-center gap-3 p-3 rounded-lg"
                 style={{ 
                   background: selectedError.level === 'error' ? 'color-mix(in srgb,var(--color-danger) 10%,transparent)' :
                              selectedError.level === 'warn' ? 'color-mix(in srgb,var(--color-warning) 10%,transparent)' :
                              'color-mix(in srgb,var(--color-info) 10%,transparent)'
                 }}>
              {selectedError.level === 'error' ? <AlertTriangle className="text-[var(--color-danger)]" size={20} /> :
               selectedError.level === 'warn' ? <AlertCircle className="text-[var(--color-warning)]" size={20} /> :
               <Info className="text-[var(--color-info)]" size={20} />}
              <span className="text-sm font-semibold selection:bg-[var(--color-accent)] selection:text-white"
                    style={{ 
                      color: selectedError.level === 'error' ? 'var(--color-danger)' :
                             selectedError.level === 'warn' ? 'var(--color-warning)' :
                             'var(--color-info)'
                    }}>
                {selectedError.message}
              </span>
            </div>
            <div>
              <p className="text-[10px] text-[var(--color-text-muted)] uppercase font-bold mb-1">Fecha y Hora (Local)</p>
              <p className="text-xs selection:bg-[var(--color-accent)] selection:text-white">
                {new Date(selectedError.occurred_at).toLocaleString('es-MX', { dateStyle: 'full', timeStyle: 'medium', hour12: true })}
              </p>
            </div>
            {selectedError.stack && (
              <div>
                <p className="text-[10px] text-[var(--color-text-muted)] uppercase font-bold mb-1">Stack Trace</p>
                <pre className="text-[10px] p-3 rounded bg-black/30 font-mono overflow-auto leading-relaxed select-text selection:bg-[var(--color-accent)] selection:text-white">
                  {selectedError.stack}
                </pre>
              </div>
            )}
            {selectedError.context && (
              <div>
                <p className="text-[10px] text-[var(--color-text-muted)] uppercase font-bold mb-1">Contexto</p>
                <pre className="text-[10px] p-3 rounded bg-black/30 font-mono overflow-auto select-text selection:bg-[var(--color-accent)] selection:text-white">
                  {selectedError.context}
                </pre>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Log de Archivo */}
      <Modal 
        isOpen={rawLogs !== null} 
        onClose={() => setRawLogs(null)} 
        title="Log de Sistema (luma.log)" 
        width="xl"
      >
        <div className="bg-black p-4 rounded-lg">
          <pre className="text-[10px] font-mono text-green-500 overflow-auto max-h-[70vh] leading-relaxed select-text selection:bg-white selection:text-black">
            {rawLogs || 'El archivo de log está vacío.'}
          </pre>
        </div>
      </Modal>

      {/* Confirmación de Importación */}
      <Modal 
        isOpen={showImportConfirm} 
        onClose={() => setShowImportConfirm(false)} 
        title="Confirmar Importación"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-[color-mix(in srgb,var(--color-danger) 10%,transparent)] border border-[var(--color-danger)]">
            <AlertTriangle className="text-[var(--color-danger)] shrink-0" size={20} />
            <div className="flex flex-col gap-1">
              <p className="text-sm font-bold text-[var(--color-danger)]">¡ADVERTENCIA CRÍTICA!</p>
              <p className="text-xs text-[var(--color-text)]">
                Al importar una base de datos, <strong>se borrarán todos los datos actuales</strong> (ventas, citas, clientes, etc.) y serán reemplazados por los del archivo que elijas.
              </p>
            </div>
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">Se recomienda hacer una exportación (respaldo) de tus datos actuales antes de proceder.</p>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowImportConfirm(false)} className="flex-1 luma-btn-ghost py-2.5">Cancelar</button>
            <button onClick={handleImport} className="flex-1 luma-btn-primary py-2.5 bg-[var(--color-danger)] hover:bg-[var(--color-danger)] border-none">
              Entiendo, proceder
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirmación de Vaciado de Log */}
      <Modal 
        isOpen={showClearConfirm} 
        onClose={() => setShowClearConfirm(false)} 
        title="Vaciar Log de Archivo"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-[color-mix(in srgb,var(--color-warning) 10%,transparent)] border border-[var(--color-warning)]">
            <AlertCircle className="text-[var(--color-warning)] shrink-0" size={20} />
            <div className="flex flex-col gap-1">
              <p className="text-sm font-bold text-[var(--color-warning)]">Atención</p>
              <p className="text-xs text-[var(--color-text)]">
                ¿Estás seguro de que quieres vaciar el archivo de log (luma.log)?
              </p>
            </div>
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">Esta acción es irreversible, pero la bitácora de la base de datos se conservará.</p>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowClearConfirm(false)} className="flex-1 luma-btn-ghost py-2.5">Cancelar</button>
            <button 
              onClick={async () => {
                await window.electronAPI.clearLogs()
                setShowClearConfirm(false)
                setSuccessMsg({ title: 'Log Vaciado', body: 'El archivo de registro ha sido limpiado.' })
              }} 
              className="flex-1 luma-btn-primary py-2.5"
            >
              Sí, vaciar archivo
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal de Éxito Genérico */}
      <Modal 
        isOpen={!!successMsg} 
        onClose={() => {
          const isImport = successMsg?.title.includes('Importación')
          setSuccessMsg(null)
          if (isImport) window.location.reload()
        }} 
        title={successMsg?.title || 'Operación Exitosa'}
      >
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center bg-[color-mix(in srgb,var(--color-success) 15%,transparent)] text-[var(--color-success)]">
            <Check size={32} />
          </div>
          <p className="text-sm" style={{ color: 'var(--color-text)' }}>
            {successMsg?.body}
          </p>
          <button 
            onClick={() => {
              const isImport = successMsg?.title.includes('Importación')
              setSuccessMsg(null)
              if (isImport) window.location.reload()
            }} 
            className="luma-btn-primary px-10 mt-2"
          >
            Aceptar
          </button>
        </div>
      </Modal>
    </div>
  )
}

// ── Guía paso a paso de Google Cloud Console ──────────────────────────────────
const GoogleCloudGuide: React.FC = () => (
  <div className="flex flex-col gap-4 p-4 rounded-xl border text-xs"
       style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)' }}>

    <div className="flex items-center gap-2">
      <span className="text-base">📋</span>
      <p className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>
        Guía: Crear credenciales OAuth2 en Google Cloud
      </p>
    </div>

    {[
      {
        n: 1, title: 'Crear o seleccionar un proyecto',
        body: 'Ve a console.cloud.google.com → Haz clic en el selector de proyectos (arriba) → "Nuevo proyecto". Ponle un nombre como "Luma Salon".',
        link: 'https://console.cloud.google.com/projectcreate',
        linkLabel: 'Abrir Google Cloud Console',
      },
      {
        n: 2, title: 'Habilitar la API de Google Calendar',
        body: 'En el menú lateral: APIs y servicios → Biblioteca → busca "Google Calendar API" → haz clic en ella → "Habilitar".',
        link: 'https://console.cloud.google.com/apis/library/calendar-json.googleapis.com',
        linkLabel: 'Ir a la API de Calendar',
      },
      {
        n: 3, title: 'Configurar la pantalla de consentimiento OAuth',
        body: 'APIs y servicios → Pantalla de consentimiento OAuth → Tipo de usuario: "Externo" → Completar nombre de la app, correo de soporte y tu correo en "Datos de contacto del desarrollador" → Guardar y continuar. En "Permisos": agrega el scope ".../auth/calendar". Agrega tu correo como usuario de prueba.',
        link: 'https://console.cloud.google.com/apis/credentials/consent',
        linkLabel: 'Configurar consentimiento',
      },
      {
        n: 4, title: 'Crear las credenciales OAuth 2.0',
        body: 'APIs y servicios → Credenciales → "+ Crear credenciales" → "ID de cliente de OAuth" → Tipo: "Aplicación de escritorio" → Nombre: "Luma App" → "Crear".',
        link: 'https://console.cloud.google.com/apis/credentials',
        linkLabel: 'Ir a Credenciales',
      },
      {
        n: 5, title: 'Copiar el Client ID y Client Secret',
        body: 'Después de crear, verás una ventana con tu "ID de cliente" y "Secreto de cliente". Cópialos y pégalos en los campos de arriba. Guarda los ajustes.',
        link: null, linkLabel: null,
      },
      {
        n: 6, title: 'Conectar desde la Agenda',
        body: 'Una vez guardadas las credenciales, ve al módulo "Agenda" → haz clic en "Conectar Google" → se abrirá tu navegador para que autorices el acceso → regresa a la app. ¡Listo!',
        link: null, linkLabel: null,
      },
    ].map(step => (
      <div key={step.n} className="flex gap-3">
        <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
             style={{ background: 'var(--color-accent)' }}>
          {step.n}
        </div>
        <div className="flex-1 flex flex-col gap-1">
          <p className="font-semibold" style={{ color: 'var(--color-text)' }}>{step.title}</p>
          <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.6 }}>{step.body}</p>
          {step.link && (
            <button type="button"
              onClick={() => window.open(step.link!, '_blank')}
              className="flex items-center gap-1 self-start mt-1 hover:underline"
              style={{ color: 'var(--color-accent)' }}>
              <ExternalLink size={11} /> {step.linkLabel}
            </button>
          )}
        </div>
      </div>
    ))}

    <div className="rounded-lg px-3 py-2 flex items-start gap-2"
         style={{ background: 'color-mix(in srgb,var(--color-warning) 10%,transparent)', color: 'var(--color-warning)' }}>
      <span className="flex-shrink-0 mt-0.5">⚠️</span>
      <p style={{ lineHeight: 1.6 }}>
        <strong>Modo de prueba:</strong> mientras la app esté en estado "Prueba" en Google Cloud,
        solo los correos que agregues como "usuarios de prueba" podrán conectarse. Para uso
        ilimitado, publícala (verificación de Google requerida, opcional para uso interno).
      </p>
    </div>
  </div>
)

// ── Section wrapper ───────────────────────────────────────────────────────────
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
