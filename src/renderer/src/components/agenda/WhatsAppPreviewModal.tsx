import React, { useState, useEffect, useCallback } from 'react'
import { Send, Loader2, MessageCircle, Phone, CheckCircle,
         Clock, User, Scissors, XCircle, Info,
         WifiOff, RotateCcw } from 'lucide-react'
import { Modal } from '../ui/Modal'
import type { WAPreviewResult, WAPreviewItem } from '../../types'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

type ReminderType = '1d' | '3d' | '7d' | 'manual'

interface Props {
  isOpen: boolean
  onClose: () => void
  appointmentIds: number[]
  reminderType: ReminderType
  contextLabel?: string
}

const STATUS_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  ready:               { label: 'Listo',          color: 'var(--color-success)',    icon: <CheckCircle size={12} /> },
  sent_today:          { label: 'Ya enviado hoy',  color: 'var(--color-warning)',    icon: <RotateCcw size={12} /> },
  skipped_no_phone:    { label: 'Sin teléfono',    color: 'var(--color-danger)',     icon: <Phone size={12} /> },
  skipped_no_template: { label: 'Sin plantilla',   color: 'var(--color-danger)',     icon: <XCircle size={12} /> },
  skipped_no_client:   { label: 'Sin cliente',     color: 'var(--color-text-muted)', icon: <User size={12} /> },
}

const REMINDER_LABELS: Record<ReminderType, string> = {
  '1d': '1 día antes', '3d': '3 días antes', '7d': '7 días antes', 'manual': 'Manual',
}

export const WhatsAppPreviewModal: React.FC<Props> = ({
  isOpen, onClose, appointmentIds, reminderType, contextLabel,
}) => {
  const [preview, setPreview]         = useState<WAPreviewResult | null>(null)
  const [loading, setLoading]         = useState(false)
  const [sending, setSending]         = useState(false)
  const [sent, setSent]               = useState(false)
  const [expandedId, setExpandedId]   = useState<number | null>(null)
  const [sendResult, setSendResult]   = useState<{ queued: number } | null>(null)
  const [waConnected, setWaConnected] = useState<boolean | null>(null)
  const [selected, setSelected]       = useState<Set<number>>(new Set())

  const loadPreview = useCallback(async () => {
    if (!isOpen || appointmentIds.length === 0) return
    setLoading(true)
    setPreview(null)
    setSent(false)
    setSendResult(null)
    setExpandedId(null)

    const [statusRes, previewRes] = await Promise.all([
      window.electronAPI.whatsapp.getStatus(),
      window.electronAPI.whatsapp.preview(appointmentIds, reminderType),
    ]) as [any, any]

    setWaConnected(statusRes.ok && statusRes.data?.status === 'ready')

    if (previewRes.ok) {
      const data: WAPreviewResult = previewRes.data
      setPreview(data)
      // Seleccionar por defecto solo los "ready" — los "sent_today" quedan desmarcados
      const defaultSelected = new Set(
        data.items
          .filter((i: WAPreviewItem) => i.status === 'ready')
          .map((i: WAPreviewItem) => i.appointmentId)
      )
      setSelected(defaultSelected)
    }
    setLoading(false)
  }, [isOpen, appointmentIds, reminderType])

  useEffect(() => { loadPreview() }, [loadPreview])

  const toggleItem = (id: number, item: WAPreviewItem) => {
    if (
      item.status === 'skipped_no_phone' ||
      item.status === 'skipped_no_template' ||
      item.status === 'skipped_no_client'
    ) return
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (!preview) return
    const selectable = preview.items
      .filter(i => i.status === 'ready' || i.status === 'sent_today')
      .map(i => i.appointmentId)
    const allSelected = selectable.every(id => selected.has(id))
    setSelected(allSelected ? new Set() : new Set(selectable))
  }

  const handleSend = async () => {
    if (!preview || selected.size === 0 || !waConnected) return
    setSending(true)
    const sentTodayIds = new Set(
      preview.items.filter(i => i.status === 'sent_today').map(i => i.appointmentId)
    )
    const forcedIds = [...selected].filter(id => sentTodayIds.has(id))
    const res: any = await window.electronAPI.whatsapp.sendBulk([...selected], reminderType, forcedIds)
    setSending(false)
    if (res.ok) { setSent(true); setSendResult(res.data) }
  }

  const selectableItems = preview?.items.filter(
    i => i.status === 'ready' || i.status === 'sent_today'
  ) ?? []
  const allSelectableSelected =
    selectableItems.length > 0 && selectableItems.every(i => selected.has(i.appointmentId))
  const canSend = waConnected && selected.size > 0 && !sending

  const renderBadge = (item: WAPreviewItem) => {
    const s = STATUS_META[item.status] ?? STATUS_META.ready
    return (
      <span
        className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0"
        style={{ color: s.color, background: `color-mix(in srgb,${s.color} 12%,transparent)` }}>
        {s.icon}{s.label}
      </span>
    )
  }

  return (
    <Modal
      isOpen={isOpen} onClose={onClose}
      title="Previsualización de envío WhatsApp" width="lg"
      subtitle={contextLabel ?? `Recordatorio ${REMINDER_LABELS[reminderType]}`}>

      <div className="flex flex-col" style={{ height: '65vh' }}>

        {/* ── Cargando ─────────────────────────────────────────────────── */}
        {loading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <Loader2 size={28} className="animate-spin" style={{ color: 'var(--color-accent)' }} />
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Preparando previsualización...
            </p>
          </div>
        )}

        {/* ── Pantalla de éxito ─────────────────────────────────────────── */}
        {!loading && sent && sendResult && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6">
            <div className="w-16 h-16 rounded-full flex items-center justify-center"
                 style={{ background: 'color-mix(in srgb,var(--color-success) 15%,transparent)' }}>
              <MessageCircle size={32} style={{ color: 'var(--color-success)' }} />
            </div>
            <div>
              <p className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>
                {sendResult.queued} mensaje{sendResult.queued !== 1 ? 's' : ''} en cola
              </p>
              <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                Los mensajes se enviarán con pausas automáticas. Revisa el estado en{' '}
                <strong>Ajustes → WhatsApp → Historial</strong>.
              </p>
            </div>
            <button onClick={onClose} className="luma-btn-primary px-8 mt-2">Entendido</button>
          </div>
        )}

        {/* ── Contenido principal ───────────────────────────────────────── */}
        {!loading && preview && !sent && (
          <>
            {/* Zona scrollable */}
            <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1">

              {/* Alerta: no conectado */}
              {waConnected === false && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs flex-shrink-0"
                     style={{
                       background: 'color-mix(in srgb,var(--color-danger) 10%,transparent)',
                       color: 'var(--color-danger)',
                       border: '1px solid color-mix(in srgb,var(--color-danger) 30%,transparent)',
                     }}>
                  <WifiOff size={14} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <strong>WhatsApp no está conectado.</strong> Ve a{' '}
                    <strong>Ajustes → WhatsApp</strong> y vincula el número del salón.
                  </div>
                </div>
              )}

              {/* Chips de resumen */}
              <div className="flex flex-wrap gap-2 flex-shrink-0">
                {preview.summary.ready > 0 && (
                  <span className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-medium"
                        style={{ background: 'color-mix(in srgb,var(--color-success) 12%,transparent)', color: 'var(--color-success)' }}>
                    <CheckCircle size={11} /> {preview.summary.ready} nuevos
                  </span>
                )}
                {preview.summary.sent_today > 0 && (
                  <span className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-medium"
                        style={{ background: 'color-mix(in srgb,var(--color-warning) 12%,transparent)', color: 'var(--color-warning)' }}>
                    <RotateCcw size={11} /> {preview.summary.sent_today} ya enviado hoy
                  </span>
                )}
                {preview.summary.skipped_no_phone > 0 && (
                  <span className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-medium"
                        style={{ background: 'color-mix(in srgb,var(--color-danger) 12%,transparent)', color: 'var(--color-danger)' }}>
                    <Phone size={11} /> {preview.summary.skipped_no_phone} sin teléfono
                  </span>
                )}
                {preview.summary.skipped_no_template > 0 && (
                  <span className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-medium"
                        style={{ background: 'color-mix(in srgb,var(--color-danger) 12%,transparent)', color: 'var(--color-danger)' }}>
                    <XCircle size={11} /> {preview.summary.skipped_no_template} sin plantilla
                  </span>
                )}
              </div>

              {/* Info: reenvío */}
              {preview.summary.sent_today > 0 && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs flex-shrink-0"
                     style={{
                       background: 'color-mix(in srgb,var(--color-info) 8%,transparent)',
                       color: 'var(--color-info)',
                       border: '1px solid color-mix(in srgb,var(--color-info) 25%,transparent)',
                     }}>
                  <Info size={14} className="flex-shrink-0 mt-0.5" />
                  <div>
                    Las citas <strong>"Ya enviado hoy"</strong> están desmarcadas por defecto.
                    Activa su checkbox para reenviar — útil si el teléfono fue corregido.
                  </div>
                </div>
              )}

              {/* Sin mensajes disponibles */}
              {selectableItems.length === 0 && (
                <div className="flex items-center gap-2 px-4 py-8 rounded-lg text-sm justify-center"
                     style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}>
                  <Info size={16} /> No hay mensajes disponibles para enviar.
                </div>
              )}

              {/* Lista de citas */}
              {preview.items.length > 0 && (
                <div className="rounded-xl border overflow-hidden flex-shrink-0"
                     style={{ borderColor: 'var(--color-border)' }}>

                  {/* Header — seleccionar todos */}
                  {selectableItems.length > 0 && (
                    <div className="flex items-center gap-3 px-4 py-2 border-b"
                         style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-2)' }}>
                      <input
                        type="checkbox"
                        checked={allSelectableSelected}
                        onChange={toggleAll}
                        className="w-4 h-4 cursor-pointer accent-[var(--color-accent)]"
                      />
                      <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                        {selected.size} de {selectableItems.length} seleccionados
                      </span>
                    </div>
                  )}

                  {preview.items.map((item: WAPreviewItem, idx: number) => {
                    const isSelectable = item.status === 'ready' || item.status === 'sent_today'
                    const isSelected   = selected.has(item.appointmentId)
                    const isSkipped    = !isSelectable
                    const isExpanded   = expandedId === item.appointmentId

                    return (
                      <div
                        key={item.appointmentId}
                        className={idx > 0 ? 'border-t' : ''}
                        style={{ borderColor: 'var(--color-border)', opacity: isSkipped ? 0.45 : 1 }}>

                        {/* ── Fila principal ────────────────────────────── */}
                        <div
                          className="flex items-center gap-2 px-4 py-3"
                          style={{
                            background: isSelected
                              ? 'color-mix(in srgb,var(--color-accent) 5%,transparent)'
                              : 'transparent',
                          }}>

                          {/* ZONA IZQUIERDA: checkbox + avatar + info — hace toggle al hacer clic */}
                          <div
                            className="flex items-center gap-3 flex-1 min-w-0"
                            style={{ cursor: isSelectable ? 'pointer' : 'default' }}
                            onClick={() => isSelectable && toggleItem(item.appointmentId, item)}>

                            {/* Checkbox */}
                            <div className="flex-shrink-0 w-4 flex items-center justify-center">
                              {isSelectable ? (
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleItem(item.appointmentId, item)}
                                  onClick={e => e.stopPropagation()}
                                  className="w-4 h-4 cursor-pointer accent-[var(--color-accent)]"
                                />
                              ) : (
                                <div className="w-4 h-4 rounded border"
                                     style={{ borderColor: 'var(--color-border)' }} />
                              )}
                            </div>

                            {/* Avatar */}
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                              style={{
                                background: isSelected
                                  ? 'color-mix(in srgb,var(--color-accent) 20%,transparent)'
                                  : 'color-mix(in srgb,var(--color-accent) 10%,transparent)',
                                color: 'var(--color-accent)',
                              }}>
                              {(item.clientName ?? '?')
                                .split(' ')
                                .map((n: string) => n[0])
                                .join('')
                                .slice(0, 2)
                                .toUpperCase()}
                            </div>

                            {/* Info de texto */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>
                                {item.clientName ?? '(Sin cliente)'}
                              </p>
                              <div className="flex items-center gap-2 flex-wrap">
                                {item.phone && (
                                  <span className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>
                                    {item.phone}
                                  </span>
                                )}
                                {item.meta && (
                                  <>
                                    <span style={{ color: 'var(--color-border)' }}>·</span>
                                    <span className="text-xs flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
                                      <Clock size={10} />
                                      {format(parseISO(item.meta.startAt), 'HH:mm', { locale: es })}
                                    </span>
                                    {item.meta.serviceName && (
                                      <>
                                        <span style={{ color: 'var(--color-border)' }}>·</span>
                                        <span className="text-xs flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
                                          <Scissors size={10} />{item.meta.serviceName}
                                        </span>
                                      </>
                                    )}
                                  </>
                                )}
                                {item.lastSentAt && (
                                  <>
                                    <span style={{ color: 'var(--color-border)' }}>·</span>
                                    <span className="text-xs" style={{ color: 'var(--color-warning)' }}>
                                      Enviado {format(parseISO(item.lastSentAt), 'HH:mm', { locale: es })}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* ZONA DERECHA: badge + chevron — totalmente independiente */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {renderBadge(item)}

                            {/* Botón chevron: SOLO expande/colapsa el mensaje */}
                            {isSelectable && item.message && (
                              <button
                                className="w-6 h-6 flex items-center justify-center rounded transition-opacity hover:opacity-70"
                                style={{ color: 'var(--color-text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                                onClick={e => {
                                  e.stopPropagation()
                                  setExpandedId(prev => prev === item.appointmentId ? null : item.appointmentId)
                                }}
                                title="Ver mensaje">
                                <span style={{
                                  display: 'inline-block',
                                  fontSize: 18,
                                  lineHeight: 1,
                                  transition: 'transform 0.15s',
                                  transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                }}>›</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* ── Burbuja expandida del mensaje ─────────────── */}
                        {isExpanded && item.message && (
                          <div className="px-4 pb-4">
                            <div className="rounded-xl p-3" style={{ background: 'var(--color-surface-2)' }}>
                              <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
                                Vista previa del mensaje:
                              </p>
                              <div
                                className="inline-block max-w-xs rounded-xl rounded-tl-sm px-4 py-2.5 text-sm leading-relaxed"
                                style={{ background: '#dcf8c6', color: '#1a1a1a' }}>
                                {item.message}
                                <div className="text-right text-[10px] mt-1" style={{ color: '#666' }}>
                                  {format(new Date(), 'HH:mm')} ✓
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Plantilla usada */}
              {preview.template && (
                <div className="rounded-lg px-4 py-3 text-xs flex-shrink-0"
                     style={{ background: 'var(--color-surface-2)' }}>
                  <p className="font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
                    Plantilla — Recordatorio {REMINDER_LABELS[reminderType]}:
                  </p>
                  <p className="font-mono leading-relaxed" style={{ color: 'var(--color-text)' }}>
                    {preview.template}
                  </p>
                </div>
              )}
            </div>

            {/* ── Botones SIEMPRE visibles al fondo ──────────────────────── */}
            <div
              className="flex-shrink-0 flex justify-end items-center gap-3 pt-3 mt-3 border-t"
              style={{ borderColor: 'var(--color-border)' }}>
              {waConnected === false && (
                <p className="text-xs mr-auto" style={{ color: 'var(--color-danger)' }}>
                  Conecta WhatsApp en Ajustes para poder enviar.
                </p>
              )}
              <button onClick={onClose} className="luma-btn-ghost">Cancelar</button>
              <button
                onClick={handleSend}
                disabled={!canSend}
                className="luma-btn-primary"
                style={{ opacity: canSend ? 1 : 0.45, cursor: canSend ? 'pointer' : 'not-allowed' }}>
                {sending
                  ? <><Loader2 size={14} className="animate-spin" /> Enviando...</>
                  : <><Send size={14} /> Enviar {selected.size} mensaje{selected.size !== 1 ? 's' : ''}</>}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
