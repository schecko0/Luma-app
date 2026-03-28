import React, { useState, useCallback } from 'react'
import {
  BadgeDollarSign, CalendarRange, ChevronDown, ChevronUp,
  Check, Loader2, AlertCircle, History, Eye,
} from 'lucide-react'
import type { CommissionPreview, CommissionPreviewEmployee, CommissionRun, PaginatedResult } from '../types'
import { PageHeader, Badge, Spinner, Paginator } from '../components/ui/index'
import { Modal } from '../components/ui/Modal'

const fmt    = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
const fmtPct = (n: number) => `${n.toFixed(1)}%`

type Tab = 'new' | 'history'

export const CommissionsPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('new')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Comisiones"
        subtitle="Cálculo y cuadre de comisiones por rango de fechas"
        icon={<BadgeDollarSign size={18} />}
        actions={
          <div className="flex gap-2">
            {(['new', 'history'] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className="luma-btn text-xs px-3 py-1.5"
                style={{
                  background: tab === t ? 'var(--color-accent)' : 'transparent',
                  color:      tab === t ? 'white' : 'var(--color-text-muted)',
                  border:     `1px solid ${tab === t ? 'var(--color-accent)' : 'var(--color-border)'}`,
                }}>
                {t === 'new' ? <><Eye size={13} /> Nuevo cuadre</> : <><History size={13} /> Historial</>}
              </button>
            ))}
          </div>
        }
      />
      <div className="flex-1 overflow-auto">
        {tab === 'new' ? <NewCommissionView /> : <CommissionHistoryView />}
      </div>
    </div>
  )
}

// ── Vista de nuevo cuadre ─────────────────────────────────────────────────────
const NewCommissionView: React.FC = () => {
  // Calcular fechas por defecto: primer y último día del mes actual
  const now     = new Date()
  const defFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const defTo   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

  const [dateFrom, setDateFrom]   = useState(defFrom)
  const [dateTo, setDateTo]       = useState(defTo)
  const [preview, setPreview]     = useState<CommissionPreview | null>(null)
  const [loadingPreview, setLP]   = useState(false)
  const [confirming, setConf]     = useState(false)
  const [notes, setNotes]         = useState('')
  const [error, setError]         = useState<string | null>(null)
  const [success, setSuccess]     = useState<string | null>(null)
  const [expandedEmp, setExpanded] = useState<Set<number>>(new Set())

  const handlePreview = async () => {
    if (!dateFrom || !dateTo) { setError('Selecciona un rango de fechas.'); return }
    setLP(true); setError(null); setPreview(null); setSuccess(null)
    try {
      const res = await window.electronAPI.commissions.preview(dateFrom, dateTo)
      if (!res.ok) { setError(res.error ?? 'Error al calcular'); return }
      setPreview(res.data as CommissionPreview)
    } catch (e) { setError(String(e)) }
    finally { setLP(false) }
  }

  const handleConfirm = async () => {
    if (!preview) return
    setConf(true); setError(null)
    try {
      const res = await window.electronAPI.commissions.confirm(dateFrom, dateTo, notes || undefined)
      if (!res.ok) { setError(res.error ?? 'Error al confirmar'); return }
      const { runId } = res.data as { runId: number }
      setSuccess(`Cuadre #${runId} confirmado y guardado correctamente.`)
      setPreview(null)
    } catch (e) { setError(String(e)) }
    finally { setConf(false) }
  }

  const toggleEmployee = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="p-6 flex flex-col gap-6 max-w-4xl mx-auto">

      {/* Selector de fechas */}
      <div className="luma-surface p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <CalendarRange size={16} style={{ color: 'var(--color-accent)' }} />
          <h3 className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>Rango de fechas</h3>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <label className="luma-label">Desde</label>
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPreview(null) }}
              className="luma-input w-44" />
          </div>
          <div>
            <label className="luma-label">Hasta</label>
            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPreview(null) }}
              className="luma-input w-44" />
          </div>
          <div className="flex items-end">
            <button onClick={handlePreview} disabled={loadingPreview}
              className="luma-btn-primary mt-4">
              {loadingPreview ? <><Loader2 size={15} className="animate-spin" /> Calculando...</> : <><Eye size={15} /> Calcular pre-cuadre</>}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg px-4 py-3 text-sm flex items-center gap-2"
             style={{ background: 'color-mix(in srgb,var(--color-danger) 12%,transparent)', color: 'var(--color-danger)' }}>
          <AlertCircle size={14} />{error}
        </div>
      )}

      {success && (
        <div className="rounded-lg px-4 py-3 text-sm flex items-center gap-2"
             style={{ background: 'color-mix(in srgb,var(--color-success) 12%,transparent)', color: 'var(--color-success)' }}>
          <Check size={14} />{success}
        </div>
      )}

      {/* Pre-cuadre */}
      {preview && (
        <>
          {/* Tarjetas de resumen */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total facturado',   value: fmt(preview.total_invoiced),    color: 'var(--color-text)',    sub: `Del ${preview.date_from} al ${preview.date_to}` },
              { label: 'Total comisiones',  value: fmt(preview.total_commissions), color: 'var(--color-warning)', sub: `${preview.employees.length} empleado(s)` },
              { label: 'Ingreso del salón', value: fmt(preview.total_business),    color: 'var(--color-success)', sub: `${((preview.total_business / preview.total_invoiced) * 100 || 0).toFixed(1)}% del total` },
            ].map(card => (
              <div key={card.label} className="luma-surface p-4">
                <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>{card.label}</p>
                <p className="text-2xl font-bold font-display" style={{ color: card.color }}>{card.value}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{card.sub}</p>
              </div>
            ))}
          </div>

          {preview.employees.length === 0 ? (
            <div className="luma-surface p-8 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
              No hay servicios con empleados asignados en este rango de fechas.
            </div>
          ) : (
            <>
              {/* Tabla por empleado (expandible) */}
              <div className="luma-surface overflow-hidden">
                <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                    Desglose por empleado
                  </p>
                </div>
                {preview.employees.map(emp => (
                  <EmployeeCommissionRow
                    key={emp.employee_id}
                    emp={emp}
                    expanded={expandedEmp.has(emp.employee_id)}
                    onToggle={() => toggleEmployee(emp.employee_id)}
                  />
                ))}
              </div>

              {/* Confirmación */}
              <div className="luma-surface p-5 flex flex-col gap-4 border-2"
                   style={{ borderColor: 'var(--color-accent)' }}>
                <h3 className="font-semibold font-display" style={{ color: 'var(--color-text)' }}>
                  ¿Confirmar y guardar este cuadre?
                </h3>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  Esta acción guardará el cuadre en el historial de auditoría. No afecta las ventas existentes.
                </p>
                <div>
                  <label className="luma-label">Notas del cuadre (opcional)</label>
                  <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder="Observaciones, período especial, etc." className="luma-input resize-none" data-selectable />
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setPreview(null)} className="luma-btn-ghost">
                    Cancelar
                  </button>
                  <button onClick={handleConfirm} disabled={confirming} className="luma-btn-primary">
                    {confirming
                      ? <><Loader2 size={15} className="animate-spin" /> Confirmando...</>
                      : <><Check size={15} /> Confirmar cuadre</>}
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

// ── Fila de empleado expandible ───────────────────────────────────────────────
const EmployeeCommissionRow: React.FC<{
  emp: CommissionPreviewEmployee
  expanded: boolean
  onToggle: () => void
}> = ({ emp, expanded, onToggle }) => (
  <div style={{ borderBottom: '1px solid var(--color-border)' }}>
    {/* Cabecera de empleado */}
    <button onClick={onToggle}
      className="w-full flex items-center gap-4 px-4 py-3 hover:bg-white/5 transition-colors"
      style={{ textAlign: 'left' }}>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>{emp.employee_name}</span>
          <Badge variant="info">{fmtPct(emp.commission_pct)} comisión</Badge>
        </div>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
          {emp.details.length} servicio(s) · Base: {fmt(emp.base_salary)}/período
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="font-bold" style={{ color: 'var(--color-warning)' }}>{fmt(emp.commission_amount)}</p>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>comisión total</p>
      </div>
      {expanded ? <ChevronUp size={16} style={{ color: 'var(--color-text-muted)' }} />
                : <ChevronDown size={16} style={{ color: 'var(--color-text-muted)' }} />}
    </button>

    {/* Detalle expandido */}
    {expanded && (
      <div className="px-4 pb-3" style={{ background: 'var(--color-surface-2)' }}>
        <table className="w-full text-xs">
          <thead>
            <tr>
              {['Folio', 'Fecha', 'Servicio', 'Monto línea', 'Split', '% Comisión', 'Comisión'].map(h => (
                <th key={h} className="text-left py-2 pr-4 font-medium"
                    style={{ color: 'var(--color-text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {emp.details.map((d, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--color-border)' }}>
                <td className="py-2 pr-4 font-mono" style={{ color: 'var(--color-accent)' }}>{d.invoice_folio}</td>
                <td className="py-2 pr-4" style={{ color: 'var(--color-text-muted)' }}>
                  {new Date(d.invoice_date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                </td>
                <td className="py-2 pr-4" style={{ color: 'var(--color-text)' }}>{d.service_name}</td>
                <td className="py-2 pr-4" style={{ color: 'var(--color-text)' }}>{fmt(d.line_total)}</td>
                <td className="py-2 pr-4" style={{ color: 'var(--color-text-muted)' }}>{d.work_split_pct}%</td>
                <td className="py-2 pr-4" style={{ color: 'var(--color-text-muted)' }}>{fmtPct(d.commission_pct)}</td>
                <td className="py-2 font-medium" style={{ color: 'var(--color-warning)' }}>{fmt(d.commission_amount)}</td>
              </tr>
            ))}
            {/* Subtotal del empleado */}
            <tr style={{ borderTop: '2px solid var(--color-border)' }}>
              <td colSpan={6} className="py-2 font-medium text-right pr-4" style={{ color: 'var(--color-text-muted)' }}>
                Total comisión:
              </td>
              <td className="py-2 font-bold" style={{ color: 'var(--color-warning)' }}>{fmt(emp.commission_amount)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    )}
  </div>
)

// ── Historial de cuadres ──────────────────────────────────────────────────────
const CommissionHistoryView: React.FC = () => {
  const [result, setResult]     = useState<PaginatedResult<CommissionRun> | null>(null)
  const [loading, setLoading]   = useState(true)
  const [page, setPage]         = useState(1)
  const [detailRun, setDetail]  = useState<{ run: CommissionRun; details: unknown[] } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await window.electronAPI.commissions.listRuns({ page, pageSize: 15 })
    if (res.ok) setResult(res.data as PaginatedResult<CommissionRun>)
    setLoading(false)
  }, [page])

  React.useEffect(() => { load() }, [load])

  const openDetail = async (run: CommissionRun) => {
    const res = await window.electronAPI.commissions.getRunDetail(run.id)
    if (res.ok) setDetail(res.data as { run: CommissionRun; details: unknown[] })
  }

  return (
    <div className="p-6 flex flex-col gap-4 h-full overflow-auto">
      {loading ? (
        <div className="flex justify-center py-12"><Spinner size={32} /></div>
      ) : result?.items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3" style={{ color: 'var(--color-text-muted)' }}>
          <BadgeDollarSign size={40} strokeWidth={1} />
          <p className="text-sm">No hay cuadres confirmados aún.</p>
        </div>
      ) : (
        <div className="luma-surface overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                {['#', 'Período', 'Total comisiones', 'Ingreso salón', 'Ejecutado por', 'Fecha', 'Detalle'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium"
                      style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result?.items.map((run, i) => (
                <tr key={run.id} className="hover:bg-white/5 transition-colors"
                    style={{ borderBottom: i < result.items.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--color-accent)' }}>#{run.id}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text)' }}>
                    {run.date_from} → {run.date_to}
                  </td>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-warning)' }}>
                    {fmt(run.total_commissions)}
                  </td>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-success)' }}>
                    {fmt(run.total_business)}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {run.executed_by_username}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {new Date(run.created_at).toLocaleDateString('es-MX')}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => openDetail(run)} className="luma-btn-ghost p-1.5 rounded-lg">
                      <Eye size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {result && <Paginator page={page} pageSize={15} total={result.total} onChange={setPage} />}
        </div>
      )}

      {/* Modal detalle del run */}
      <Modal isOpen={!!detailRun} onClose={() => setDetail(null)}
        title={`Cuadre #${detailRun?.run.id}`}
        subtitle={`${detailRun?.run.date_from} → ${detailRun?.run.date_to}`}
        width="xl">
        {detailRun && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="luma-surface p-3 text-center">
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Total comisiones</p>
                <p className="text-xl font-bold" style={{ color: 'var(--color-warning)' }}>{fmt(detailRun.run.total_commissions)}</p>
              </div>
              <div className="luma-surface p-3 text-center">
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Ingreso del salón</p>
                <p className="text-xl font-bold" style={{ color: 'var(--color-success)' }}>{fmt(detailRun.run.total_business)}</p>
              </div>
            </div>
            <div className="luma-surface overflow-hidden max-h-96 overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}>
                    {['Empleado', 'Folio', 'Servicio', 'Monto', 'Split', 'Comisión%', 'Comisión $'].map(h => (
                      <th key={h} className="text-left px-3 py-2 font-medium"
                          style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(detailRun.details as Record<string, unknown>[]).map((d, i) => (
                    <tr key={i} className="hover:bg-white/5"
                        style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td className="px-3 py-2" style={{ color: 'var(--color-text)' }}>{String(d.employee_name)}</td>
                      <td className="px-3 py-2 font-mono" style={{ color: 'var(--color-accent)' }}>{String(d.invoice_folio)}</td>
                      <td className="px-3 py-2" style={{ color: 'var(--color-text-muted)' }}>{String(d.service_name)}</td>
                      <td className="px-3 py-2" style={{ color: 'var(--color-text)' }}>{fmt(Number(d.line_total))}</td>
                      <td className="px-3 py-2" style={{ color: 'var(--color-text-muted)' }}>{Number(d.work_split_pct)}%</td>
                      <td className="px-3 py-2" style={{ color: 'var(--color-text-muted)' }}>{fmtPct(Number(d.commission_pct))}</td>
                      <td className="px-3 py-2 font-medium" style={{ color: 'var(--color-warning)' }}>{fmt(Number(d.commission_amount))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
