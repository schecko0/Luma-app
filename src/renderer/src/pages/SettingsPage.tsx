import React, { useState, useEffect } from 'react'
import {
  Settings, Save, Loader2, Store, DollarSign, Palette,
  Calendar, Check, AlertCircle, RefreshCw, ExternalLink,
  ChevronDown, ChevronUp, Eye, EyeOff, ShieldCheck,
  Database, Download, Upload, FileText, History, Terminal,
  AlertTriangle, Trash2, Info, Activity, MessageCircle, Wifi, WifiOff, Send, Clock, ToggleLeft, ToggleRight,
  Percent, Users,
} from 'lucide-react'

import { PageHeader, Spinner, Paginator, Badge } from '../components/ui/index'

import { Modal } from '../components/ui/Modal'
import { applyTheme } from '../hooks/useAppState'
import { ErrorLog, WhatsAppReminderLog, CommissionMode } from '../types'

interface SettingsForm {
  salon_name: string
  salon_currency: string
  salon_logo: string
  tax_label: string
  tax_rate: string
  theme: string
  custom_bg: string; custom_surface: string; custom_surface2: string
  custom_border: string; custom_accent: string; custom_text: string
  custom_text_muted: string; custom_success: string; custom_danger: string
  custom_warning: string; custom_info: string
  google_client_id: string
  google_secret: string
  wa_confirm_on_create: string
  wa_template_confirm: string
  wa_logo_path: string
  commission_mode: CommissionMode
  overhead_pct: string
}

const DEFAULTS: SettingsForm = {
  salon_name: '', salon_currency: 'MXN', salon_logo: '',
  tax_label: 'IVA', tax_rate: '16', theme: 'dark',
  custom_bg: '#0f0d0b', custom_surface: '#1a1714', custom_surface2: '#242019',
  custom_border: '#2e2920', custom_accent: '#d4881f', custom_text: '#f5f0e8',
  custom_text_muted: '#8a8070', custom_success: '#4caf7d', custom_danger: '#dc4a3d',
  custom_warning: '#e8a838', custom_info: '#4a90d9',
  google_client_id: '', google_secret: '',wa_confirm_on_create: 'false', wa_template_confirm: '', wa_logo_path: '',
  commission_mode: 'simple' as CommissionMode, overhead_pct: '0',
}

const CURRENCIES = ['MXN', 'USD', 'EUR', 'COP', 'ARS', 'CLP', 'PEN']

type TabId = 'general' | 'appearance' | 'google' | 'whatsapp' | 'commissions' | 'system'

export const SettingsPage: React.FC<{ onSaved?: () => void }> = ({ onSaved }) => {
  const [activeTab, setActiveTab] = useState<TabId>('general')
  const [form, setForm]           = useState<SettingsForm>(DEFAULTS)
  const [logoPath, setLogoPath]   = useState('')
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

  // ── Estados WhatsApp ───────────────────────────────────────────────────────
  const [waStatus, setWaStatus]       = useState<string>('disconnected')
  const [waPhone, setWaPhone]         = useState<string | null>(null)
  const [waQr, setWaQr]              = useState<string | null>(null)
  const [waConnecting, setWaConnecting] = useState(false)
  const [waStats, setWaStats]         = useState({ sentToday: 0, sentTotal: 0, deliveryRate: 100 })
  const [waLog, setWaLog]            = useState<WhatsAppReminderLog[]>([])
  const [waLogTotal, setWaLogTotal]  = useState(0)
  const [waLogPage, setWaLogPage]    = useState(1)
  const [waSettings, setWaSettings]  = useState({
    wa_reminder_1d: 'true', wa_reminder_3d: 'true', wa_reminder_7d: 'false',
    wa_max_per_day: '60',   wa_delay_seconds: '12', wa_send_hour: '9',
    wa_template_1d: '', wa_template_3d: '', wa_template_7d: '',
    wa_confirm_on_create: 'false',wa_template_confirm:  '',wa_logo_path:'',
  })
  const [waLogoPreview, setWaLogoPreview] = useState<string | null>(null)
  const [waLogoFullscreen, setWaLogoFullscreen] = useState(false)


  useEffect(() => {
    window.electronAPI.settings.getAll().then(async (res: { ok: boolean; data?: Record<string, string>; error?: string }) => {
      if (res.ok) {
        const d = res.data as Record<string, string>
        
        let logoBase64 = ''
        if (d.salon_logo) {
          setLogoPath(d.salon_logo)
          const lRes = await (window.electronAPI as any).readImageAsBase64?.(d.salon_logo)
          if (lRes?.ok) logoBase64 = lRes.data
        }

        setForm(prev => ({
          ...prev,
          salon_name:       d.salon_name       ?? prev.salon_name,
          salon_currency:   d.salon_currency   ?? prev.salon_currency,
          salon_logo:       logoBase64,
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
          wa_confirm_on_create: d.wa_confirm_on_create ?? prev.wa_confirm_on_create,
          wa_template_confirm:  d.wa_template_confirm  ?? prev.wa_template_confirm,
          wa_logo_path:         d.wa_logo_path         ?? prev.wa_logo_path,
          commission_mode: (d.commission_mode ?? 'simple') as CommissionMode,
          overhead_pct:    d.overhead_pct    ?? '0',
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

  useEffect(() => {
    if (activeTab !== 'whatsapp') return
    const path = waSettings.wa_logo_path
    if (path) {
      ;(window.electronAPI as any).readImageAsBase64?.(path)
        .then((res: any) => { if (res?.ok) setWaLogoPreview(res.data) })
    } else {
      setWaLogoPreview(null)
    }
  }, [activeTab, waSettings.wa_logo_path])

  // Cargar datos de WhatsApp al activar la pestaña
  useEffect(() => {
    if (activeTab !== 'whatsapp') return

    // Estado del cliente
    window.electronAPI.whatsapp.getStatus().then((res: any) => {
      if (res.ok) { setWaStatus(res.data.status); setWaPhone(res.data.phone) }
    })
    // Stats
    window.electronAPI.whatsapp.getStats().then((res: any) => {
      if (res.ok) setWaStats(res.data)
    })
    // Settings de WA
    window.electronAPI.settings.getAll().then((res: any) => {
      if (res.ok) {
        const d = res.data
        setWaSettings(prev => ({
          wa_reminder_1d:   d.wa_reminder_1d   ?? prev.wa_reminder_1d,
          wa_reminder_3d:   d.wa_reminder_3d   ?? prev.wa_reminder_3d,
          wa_reminder_7d:   d.wa_reminder_7d   ?? prev.wa_reminder_7d,
          wa_max_per_day:   d.wa_max_per_day   ?? prev.wa_max_per_day,
          wa_delay_seconds: d.wa_delay_seconds ?? prev.wa_delay_seconds,
          wa_send_hour:     d.wa_send_hour     ?? prev.wa_send_hour,
          wa_template_1d:   d.wa_template_1d   ?? prev.wa_template_1d,
          wa_template_3d:   d.wa_template_3d   ?? prev.wa_template_3d,
          wa_template_7d:   d.wa_template_7d   ?? prev.wa_template_7d,
          wa_confirm_on_create: d.wa_confirm_on_create ?? prev.wa_confirm_on_create,
          wa_template_confirm:  d.wa_template_confirm  ?? prev.wa_template_confirm,
          wa_logo_path:         d.wa_logo_path         ?? prev.wa_logo_path,
        }))
      }
    })
    loadWaLog(1)

    // Escuchar push events del proceso principal
    const unsubStatus = window.electronAPI.whatsapp.onStatus((data: any) => {
      setWaStatus(data.status)
      if (data.phone) setWaPhone(data.phone)
      if (data.status === 'ready') { setWaQr(null); setWaConnecting(false) }
      if (data.status === 'error') setWaConnecting(false)
    })
    const unsubQr = window.electronAPI.whatsapp.onQr((data: any) => {
      setWaQr(data.qr); setWaStatus('qr')
    })
    return () => { unsubStatus(); unsubQr() }
  }, [activeTab])

  const loadWaLog = async (page: number) => {
    const res = await window.electronAPI.whatsapp.getLog(page, 15)
    if (res.ok) {
      setWaLog(res.data.rows)
      setWaLogTotal(res.data.total)
      setWaLogPage(page)
    }
  }

  const handleWaConnect = async () => {
    setWaConnecting(true); setWaQr(null)
    await window.electronAPI.whatsapp.connect()

    // Polling de respaldo: por si el evento push llega antes que el listener
    const poll = setInterval(async () => {
      const res = await window.electronAPI.whatsapp.getStatus()
      if (res.ok && res.data.status === 'ready') {
        setWaStatus('ready')
        setWaPhone(res.data.phone)
        setWaQr(null)
        setWaConnecting(false)
        clearInterval(poll)
      }
      if (res.ok && res.data.status === 'error') {
        setWaConnecting(false)
        clearInterval(poll)
      }
    }, 2000)

    // Timeout de seguridad: máximo 2 minutos esperando
    setTimeout(() => {
      clearInterval(poll)
      setWaConnecting(false)
    }, 120_000)
  }

  const handleWaDisconnect = async () => {
    await window.electronAPI.whatsapp.disconnect()
    setWaStatus('disconnected'); setWaPhone(null); setWaQr(null)
  }

  const saveWaSettings = async () => {
    setSaving(true)
    await window.electronAPI.settings.set(waSettings)
    await window.electronAPI.whatsapp.restartScheduler()
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const setWa = (key: keyof typeof waSettings, value: string) =>
    setWaSettings(prev => ({ ...prev, [key]: value }))

  const toggleWa = (key: keyof typeof waSettings) =>
    setWa(key, waSettings[key] === 'true' ? 'false' : 'true')

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
        salon_logo:        logoPath,
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
        commission_mode:   form.commission_mode,
        overhead_pct:      String(parseFloat(form.overhead_pct) || 0),
      })
      if (!res.ok) { setError(res.error ?? 'Error al guardar'); return }
      setSaved(true)
      onSaved?.()
      setTimeout(() => setSaved(false), 3000)
    } catch (e) { setError(String(e)) }
    finally { setSaving(false) }
  }

  const handleUploadLogo = async () => {
    const res = await (window.electronAPI as any).settings.uploadLogo()
    if (res.ok) {
      setLogoPath(res.data)
      const previewRes = await (window.electronAPI as any).readImageAsBase64?.(res.data)
      if (previewRes?.ok) {
        set('salon_logo' as any, previewRes.data)
      }
    } else if (res.error !== 'Cancelado') {
      setError(res.error || 'Error al cargar logo')
    }
  }

  if (loading) return <div className="flex items-center justify-center h-full"><Spinner size={36} /></div>

  const hasCredentials = form.google_client_id.trim().length > 0 && form.google_secret.trim().length > 0

  const tabs: { id: TabId, label: string, icon: React.ReactNode }[] = [
    { id: 'general',     label: 'General',     icon: <Store size={14} /> },
    { id: 'appearance',  label: 'Apariencia',  icon: <Palette size={14} /> },
    { id: 'google',      label: 'Google',      icon: <Calendar size={14} /> },
    { id: 'commissions', label: 'Comisiones',  icon: <Percent size={14} /> },
    { id: 'system',      label: 'Sistema',     icon: <Terminal size={14} /> },
    { id: 'whatsapp',    label: 'WhatsApp',    icon: <MessageCircle size={14} /> },
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
                <div className="flex items-start gap-6">
                  {/* Preview Logo */}
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-24 h-24 rounded-2xl border-2 border-dashed flex items-center justify-center overflow-hidden bg-white/5"
                         style={{ borderColor: 'var(--color-border)' }}>
                      {form.salon_logo ? (
                        <img src={form.salon_logo} alt="Logo" className="w-full h-full object-cover" />
                      ) : (
                        <Store size={32} className="opacity-20" />
                      )}
                    </div>
                    <button onClick={handleUploadLogo} className="luma-btn-ghost text-[10px] uppercase font-bold py-1 px-3 border border-white/10 rounded-lg">
                      {form.salon_logo ? 'Cambiar Logo' : 'Cargar Logo'}
                    </button>
                    {form.salon_logo && (
                      <button onClick={() => { set('salon_logo' as any, ''); setLogoPath('') }} className="text-[9px] text-danger hover:underline">
                        Quitar
                      </button>
                    )}

                  </div>

                  <div className="flex-1 flex flex-col gap-4">
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
                  </div>
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
                          value={form[key] ?? '#000000'}
                          onChange={e => set(key, e.target.value)}
                          className="w-9 h-9 rounded-lg border cursor-pointer flex-shrink-0"
                          style={{ borderColor: 'var(--color-border)', padding: '2px', background: 'var(--color-surface-2)' }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>{label}</p>
                          <p className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>
                            {form[key]}
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

          {/* ── Tab: WhatsApp ───────────────────────────────────────────────── */}
          {activeTab === 'whatsapp' && (
            <>
              {/* Conexión */}
              <Section title="Vinculación de WhatsApp" icon={<MessageCircle size={16} />}>                
                {/* Estado */}
                <div className="flex items-center gap-3 p-3 rounded-lg"
                    style={{
                      background: waStatus === 'ready'
                        ? 'color-mix(in srgb,var(--color-success) 10%,transparent)'
                        : 'color-mix(in srgb,var(--color-warning) 10%,transparent)'
                    }}>
                  {waStatus === 'ready'
                    ? <Wifi size={16} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
                    : <WifiOff size={16} style={{ color: 'var(--color-warning)', flexShrink: 0 }} />}
                  <div className="flex-1">
                    <p className="text-xs font-medium"
                      style={{ color: waStatus === 'ready' ? 'var(--color-success)' : 'var(--color-warning)' }}>
                      {waStatus === 'ready' ? `Conectado — ${waPhone ?? ''}` :
                      waStatus === 'qr'    ? 'Esperando escaneo del QR...' :
                      waStatus === 'connecting' ? 'Iniciando conexión...' :
                      waStatus === 'error' ? 'Error de conexión' : 'No vinculado'}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {waStatus === 'ready'
                        ? 'El número del salón está activo y puede enviar recordatorios.'
                        : 'Vincula el número del salón escaneando el QR con WhatsApp.'}
                    </p>
                  </div>
                  {waStatus === 'ready'
                    ? <button onClick={handleWaDisconnect} className="luma-btn-ghost text-xs"
                              style={{ color: 'var(--color-danger)' }}>Desvincular</button>
                    : <button onClick={handleWaConnect} disabled={waConnecting} className="luma-btn-primary text-xs">
                        {waConnecting ? <><Loader2 size={12} className="animate-spin" /> Iniciando...</>
                                    : 'Vincular WhatsApp'}
                      </button>
                  }
                </div>

                {/* QR */}
                {waQr && (
                  <div className="flex flex-col items-center gap-3 p-4 rounded-lg border"
                      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-2)' }}>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      Abre WhatsApp en el teléfono del salón → Dispositivos vinculados → Vincular dispositivo
                    </p>
                    <QRCodeDisplay qr={waQr} />
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      El QR expira en 60 segundos. Se regenera automáticamente.
                    </p>
                  </div>
                )}

                {/* Stats */}
                {waStatus === 'ready' && (
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Enviados hoy',    value: waStats.sentToday },
                      { label: 'Total enviados',  value: waStats.sentTotal },
                      { label: 'Tasa de entrega', value: `${waStats.deliveryRate}%` },
                    ].map(s => (
                      <div key={s.label} className="rounded-lg p-3 text-center"
                          style={{ background: 'var(--color-surface-2)' }}>
                        <div className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>{s.value}</div>
                        <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {/* Recordatorios automáticos */}
              <Section title="Recordatorios automáticos" icon={<Clock size={16} />}>
                {[
                  { key: 'wa_reminder_1d' as const, label: 'Recordatorio 1 día antes',  desc: 'Se envía cada mañana a la hora configurada' },
                  { key: 'wa_reminder_3d' as const, label: 'Recordatorio 3 días antes', desc: 'Permite cancelar con tiempo para reasignar el espacio' },
                  { key: 'wa_reminder_7d' as const, label: 'Recordatorio 7 días antes', desc: 'Para citas con mucha anticipación' },
                ].map(item => (
                  <div key={item.key} className="flex items-center gap-3 py-2 border-b last:border-0"
                      style={{ borderColor: 'var(--color-border)' }}>
                    <div className="flex-1">
                      <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{item.label}</p>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{item.desc}</p>
                    </div>
                    <button onClick={() => toggleWa(item.key)} className="flex-shrink-0">
                      {waSettings[item.key] === 'true'
                        ? <ToggleRight size={28} style={{ color: 'var(--color-success)' }} />
                        : <ToggleLeft  size={28} style={{ color: 'var(--color-text-muted)' }} />}
                    </button>
                  </div>
                ))}

                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div>
                    <label className="luma-label">Hora de envío</label>
                    <select value={waSettings.wa_send_hour}
                      onChange={e => setWa('wa_send_hour', e.target.value)} className="luma-input">
                      {Array.from({ length: 16 }, (_, i) => i + 7).map(h => (
                        <option key={h} value={String(h)}>{String(h).padStart(2,'0')}:00</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="luma-label">Máx. mensajes/día</label>
                    <input type="number" min="10" max="200" value={waSettings.wa_max_per_day}
                      onChange={e => setWa('wa_max_per_day', e.target.value)} className="luma-input" />
                  </div>
                  <div>
                    <label className="luma-label">Pausa entre envíos (seg)</label>
                    <input type="number" min="5" max="60" value={waSettings.wa_delay_seconds}
                      onChange={e => setWa('wa_delay_seconds', e.target.value)} className="luma-input" />
                  </div>
                </div>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  La pausa entre mensajes se aplica con un margen aleatorio para imitar comportamiento humano y reducir el riesgo de detección.
                </p>
              </Section>

              {/* Plantillas */}
              <Section title="Plantillas de mensaje" icon={<Send size={16} />}>
                <div className="flex flex-wrap gap-2 p-3 rounded-lg"
                    style={{ background: 'var(--color-surface-2)' }}>
                  <p className="text-xs w-full mb-1" style={{ color: 'var(--color-text-muted)' }}>
                    Variables disponibles — haz clic para copiar:
                  </p>
                  {['{nombre}', '{fecha}', '{hora}', '{servicio}', '{empleado}', '{salon}'].map(v => (
                    <button key={v} onClick={() => navigator.clipboard.writeText(v)}
                      className="text-xs px-2 py-1 rounded font-mono border transition-colors"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-accent)',
                              background: 'color-mix(in srgb,var(--color-accent) 8%,transparent)' }}>
                      {v}
                    </button>
                  ))}
                </div>

                {/* Confirmación automática al crear cita */}
                <div className="flex flex-col gap-2 pb-4 mb-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                        Confirmación al crear cita
                      </p>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        Envía un mensaje automático al cliente cuando se agenda una nueva cita
                      </p>
                    </div>
                    <button onClick={() => toggleWa('wa_confirm_on_create')}>
                      {waSettings.wa_confirm_on_create === 'true'
                        ? <ToggleRight size={28} style={{ color: 'var(--color-success)' }} />
                        : <ToggleLeft  size={28} style={{ color: 'var(--color-text-muted)' }} />}
                    </button>
                  </div>

                  {/* Selector de logo */}
                  <div>
                    <label className="luma-label">Logo del salón (imagen para adjuntar)</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        readOnly
                        placeholder="Sin logo seleccionado — se enviará solo texto"
                        value={waSettings.wa_logo_path ?? ''}
                        className="luma-input flex-1 text-xs"
                        style={{ color: 'var(--color-text-muted)' }}
                      />
                      <button
                        className="luma-btn-ghost text-xs flex-shrink-0"
                        onClick={async () => {
                          const res = await (window.electronAPI as any).selectImageFile?.()
                          if (res?.ok && res.path) {
                            setWa('wa_logo_path' as any, res.path)
                            // Leer como base64 para preview
                            const previewRes = await (window.electronAPI as any).readImageAsBase64?.(res.path)
                            if (previewRes?.ok) setWaLogoPreview(previewRes.data)
                          }
                        }}>
                        Seleccionar
                      </button>
                      {waSettings.wa_logo_path && (
                        <button
                          className="luma-btn-ghost text-xs flex-shrink-0"
                          style={{ color: 'var(--color-danger)' }}
                          onClick={() => {
                            setWa('wa_logo_path' as any, '')
                            setWaLogoPreview(null)
                          }}>
                          Quitar
                        </button>
                      )}
                    </div>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                      Formatos: JPG, PNG, WEBP. Recomendado: mínimo 400×400px.
                    </p>
                  </div>

                  {waLogoPreview && (
                    <div className="flex items-start gap-3 p-3 rounded-lg"
                        style={{ background: 'var(--color-surface-2)' }}>
                      {/* Thumbnail clicable */}
                      <img
                        src={waLogoPreview}
                        alt="Logo del salón"
                        className="w-16 h-16 rounded-lg object-cover border cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0"
                        style={{ borderColor: 'var(--color-border)' }}
                        onClick={() => setWaLogoFullscreen(true)}
                        title="Clic para ver en tamaño completo"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>
                          Logo seleccionado
                        </p>
                        <p className="text-xs mt-0.5 truncate font-mono" style={{ color: 'var(--color-text-muted)' }}>
                          {waSettings.wa_logo_path}
                        </p>
                        <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                          Haz clic en la imagen para verla en tamaño completo.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Template de confirmación */}
                  <div>
                    <label className="luma-label">Mensaje de confirmación</label>
                    <textarea
                      rows={5}
                      value={waSettings.wa_template_confirm ?? ''}
                      onChange={e => setWa('wa_template_confirm' as any, e.target.value)}
                      disabled={waSettings.wa_confirm_on_create !== 'true'}
                      className="luma-input resize-none font-mono text-xs leading-relaxed"
                      style={{ opacity: waSettings.wa_confirm_on_create === 'true' ? 1 : 0.5 }}
                    />
                  </div>
                </div>
                {([
                  { key: 'wa_template_1d' as const, label: 'Plantilla — 1 día antes',  enabled: waSettings.wa_reminder_1d === 'true' },
                  { key: 'wa_template_3d' as const, label: 'Plantilla — 3 días antes', enabled: waSettings.wa_reminder_3d === 'true' },
                  { key: 'wa_template_7d' as const, label: 'Plantilla — 7 días antes', enabled: waSettings.wa_reminder_7d === 'true' },
                ] as const).map(tpl => (
                  <div key={tpl.key} className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <label className="luma-label flex-1">{tpl.label}</label>
                      {!tpl.enabled && (
                        <span className="text-xs px-2 py-0.5 rounded-full"
                              style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}>
                          Desactivado
                        </span>
                      )}
                    </div>
                    <textarea rows={3} value={waSettings[tpl.key]}
                      onChange={e => setWa(tpl.key, e.target.value)}
                      disabled={!tpl.enabled}
                      placeholder={tpl.enabled ? 'Escribe el mensaje...' : 'Activa este recordatorio para editar la plantilla'}
                      className="luma-input resize-none font-mono text-xs leading-relaxed"
                      style={{ opacity: tpl.enabled ? 1 : 0.5 }} />
                    {tpl.enabled && !waSettings[tpl.key].trim() && (
                      <p className="text-xs" style={{ color: 'var(--color-danger)' }}>
                        ⚠ Sin plantilla — las citas de este tipo serán omitidas en el envío.
                      </p>
                    )}
                  </div>
                ))}

                <div className="flex justify-end pt-2">
                  <button onClick={saveWaSettings} disabled={saving} className="luma-btn-primary">
                    {saving ? <><Loader2 size={14} className="animate-spin" /> Guardando...</>
                            : <><Save size={14} /> Guardar plantillas y ajustes</>}
                  </button>
                </div>
              </Section>

              {/* Historial */}
              <Section title="Historial de envíos" icon={<History size={16} />}>
                <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                  <table className="w-full text-left text-xs">
                    <thead style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}>
                      <tr>
                        <th className="px-3 py-2 font-semibold">Cliente</th>
                        <th className="px-3 py-2 font-semibold w-24">Tipo</th>
                        <th className="px-3 py-2 font-semibold w-24">Estado</th>
                        <th className="px-3 py-2 font-semibold w-32">Fecha</th>
                      </tr>
                    </thead>
                    <tbody style={{ color: 'var(--color-text)' }}>
                      {waLog.length === 0 ? (
                        <tr><td colSpan={4} className="px-3 py-8 text-center"
                                style={{ color: 'var(--color-text-muted)' }}>
                          No hay mensajes registrados aún.
                        </td></tr>
                      ) : waLog.map(log => (
                        <tr key={log.id} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                          <td className="px-3 py-2">
                            <p className="font-medium truncate max-w-[160px]">{log.client_name ?? '—'}</p>
                            <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{log.phone}</p>
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant="muted" className="text-[10px] uppercase">{log.reminder_type}</Badge>
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant={
                              log.status === 'sent'    ? 'success' :
                              log.status === 'failed'  ? 'danger'  :
                              log.status === 'pending' ? 'warning' : 'muted'
                            } className="text-[10px]">
                              {log.status === 'sent' ? 'Enviado' : log.status === 'failed' ? 'Falló' :
                              log.status === 'pending' ? 'En cola' : 'Omitido'}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-[10px] font-mono whitespace-nowrap"
                              style={{ color: 'var(--color-text-muted)' }}>
                            {log.sent_at
                              ? new Date(log.sent_at).toLocaleString('es-MX', { hour12: true, dateStyle: 'short', timeStyle: 'short' })
                              : new Date(log.created_at).toLocaleString('es-MX', { hour12: true, dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {waLogTotal > 15 && (
                  <Paginator page={waLogPage} pageSize={15} total={waLogTotal} onChange={loadWaLog} />
                )}
              </Section>
            </>
          )}

          {/* ── Tab: Comisiones (Bloque 5) ─────────────────────────────── */}
          {activeTab === 'commissions' && (
            <Section title="Motor de Comisiones" icon={<Percent size={16} />}>
              <div className="flex flex-col gap-6">
                <div>
                  <label className="luma-label mb-3">Modo de cálculo</label>
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      {
                        id: 'simple',
                        title: 'Modo A — Simple (Default)',
                        desc: 'Cada colaborador recibe su comisión completa. Si hay varios colaboradores, el margen del salón se reduce.',
                        icon: <Users size={16} />
                      },
                      {
                        id: 'proportional',
                        title: 'Modo B — Proporcional Automático',
                        desc: 'La comisión se divide automáticamente entre el número de colaboradores (50/50, 33/33, etc).',
                        icon: <RefreshCw size={16} />
                      },
                      {
                        id: 'manual',
                        title: 'Modo C — Proporcional Manual',
                        desc: 'Permite asignar porcentajes de participación específicos a cada colaborador en el POS.',
                        icon: <Settings size={16} />
                      }
                    ].map(m => (
                      <button key={m.id} type="button" onClick={() => set('commission_mode', m.id as CommissionMode)}
                        className="flex items-start gap-3 p-4 rounded-xl border text-left transition-all"
                        style={{
                          borderColor: form.commission_mode === m.id ? 'var(--color-accent)' : 'var(--color-border)',
                          background:  form.commission_mode === m.id ? 'color-mix(in srgb,var(--color-accent) 8%,transparent)' : 'var(--color-surface-2)',
                        }}>
                        <div className="mt-0.5" style={{ color: form.commission_mode === m.id ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
                          {m.icon}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold" style={{ color: form.commission_mode === m.id ? 'var(--color-accent)' : 'var(--color-text)' }}>
                            {m.title}
                          </p>
                          <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)', lineHeight: '1.4' }}>
                            {m.desc}
                          </p>
                        </div>
                        <div className="mt-1">
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${form.commission_mode === m.id ? 'border-[var(--color-accent)]' : 'border-[var(--color-border)]'}`}>
                            {form.commission_mode === m.id && <div className="w-2 h-2 rounded-full bg-[var(--color-accent)]" />}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {form.commission_mode === 'manual' && (
                  <div className="pt-4 border-t flex flex-col gap-4 animate-fade-in" style={{ borderColor: 'var(--color-border)' }}>
                    <div>
                      <label className="luma-label">Costos fijos / Reserva de Insumos (Overhead %)</label>
                      <div className="flex items-center gap-3">
                        <input type="number" min="0" max="100" step="1"
                          value={form.overhead_pct}
                          onFocus={e => e.target.select()}
                          onChange={e => set('overhead_pct', e.target.value)}
                          className="luma-input w-24" data-selectable />
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>%</span>
                      </div>
                      <div className="mt-2 p-3 rounded-lg border border-[var(--color-warning)] bg-[color-mix(in srgb,var(--color-warning) 10%,transparent)]">
                        <p className="text-[10px] leading-relaxed" style={{ color: 'var(--color-warning)' }}>
                          <strong>⚠️ AVISO DE TRANSPARENCIA:</strong> Al activar un % de Overhead, la comisión del colaborador se calcula sobre el 
                          remanente neto, no sobre el precio total al público. 
                          <br /><em>Ejemplo: Si un servicio cuesta $100 y hay 10% de overhead, el empleado verá que su comisión se calcula sobre $90.</em>
                          <br /><strong>Se recomienda informar a su equipo que este porcentaje cubre el costo de los materiales que utilizan.</strong>
                        </p>
                      </div>
                    </div>

                    <div className="rounded-lg p-4 flex flex-col gap-2" style={{ background: 'color-mix(in srgb,var(--color-info) 8%,transparent)' }}>
                      <p className="text-xs font-bold" style={{ color: 'var(--color-info)' }}>Ejemplo de transparencia para el empleado:</p>
                      <div className="flex flex-col gap-1 mt-1">
                        <PreviewRow label="Precio cobrado al cliente" value="$1,000.00" />
                        <PreviewRow label={`Reserva para Insumos (${form.overhead_pct}%)`} value={`- $${(1000 * parseFloat(form.overhead_pct || '0') / 100).toFixed(2)}`} />
                        <div className="h-px my-1 bg-white/10" />
                        <PreviewRow label="Base para cálculo de comisiones" value={`$${(1000 * (1 - parseFloat(form.overhead_pct || '0') / 100)).toFixed(2)}`} accent />
                        <div className="mt-2 p-2 rounded bg-black/20">
                           <p className="text-[10px] opacity-90" style={{ color: 'var(--color-text)' }}>
                            Si el empleado tiene <strong>40% de comisión</strong>, recibirá:<br />
                            <span className="text-sm font-bold" style={{ color: 'var(--color-success)' }}>
                              ${(1000 * (1 - parseFloat(form.overhead_pct || '0') / 100) * 0.4).toFixed(2)}
                            </span>
                            <span className="text-[9px] block opacity-60">En lugar de $400.00 (sin overhead).</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
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
      {/* Modal fullscreen del logo — ver imagen en pantalla completa */}
      <Modal
        isOpen={waLogoFullscreen}
        onClose={() => setWaLogoFullscreen(false)}
        title="Logo del salón"
        width="lg">
        <div className="flex flex-col items-center gap-4">
          {waLogoPreview && (
            <img
              src={waLogoPreview}
              alt="Logo del salón"
              className="max-w-full rounded-xl border"
              style={{ maxHeight: '70vh', objectFit: 'contain', borderColor: 'var(--color-border)' }}
            />
          )}
          <button onClick={() => setWaLogoFullscreen(false)} className="luma-btn-primary px-8">
            Cerrar
          </button>
        </div>
      </Modal>
    </div>
  )
}


// ── QR Code display usando qrcode como data URL ───────────────────────────────
const QRCodeDisplay: React.FC<{ qr: string }> = ({ qr }) => {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    // qrcode está disponible en el proceso renderer vía window si lo exponemos,
    // pero más simple: generamos el QR como imagen SVG inline usando la cadena cruda
    // que whatsapp-web.js entrega (ya es una cadena qr estándar).
    // Usamos una API pública del CDN para generar el QR en el renderer.
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qr)}`
    setDataUrl(url)
  }, [qr])

  if (!dataUrl) return <div className="w-44 h-44 rounded-lg animate-pulse"
                             style={{ background: 'var(--color-surface-2)' }} />
  return (
    <img src={dataUrl} alt="QR WhatsApp" width={180} height={180}
         className="rounded-lg border" style={{ borderColor: 'var(--color-border)' }} />
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

// ── PreviewRow para ejemplos numéricos en tab Comisiones ─────────────────────
const PreviewRow: React.FC<{ label: string; value: string; accent?: boolean }> = ({ label, value, accent }) => (
  <div className="flex justify-between text-xs">
    <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
    <span className="font-medium" style={{ color: accent ? 'var(--color-accent)' : 'var(--color-text)' }}>{value}</span>
  </div>
)
