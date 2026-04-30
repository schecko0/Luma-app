import React, { useState, useCallback, useEffect } from 'react'
import {
  BadgeDollarSign, CalendarRange, ChevronDown, ChevronUp,
  Check, Loader2, AlertCircle, History, Eye, Info, Search, X, User, FileSpreadsheet
} from 'lucide-react'
import * as XLSX from 'xlsx'
import type { CommissionPreview, CommissionPreviewEmployee, CommissionRun, PaginatedResult, CommissionDetail } from '../types'
import { PageHeader, Badge, Spinner, Paginator } from '../components/ui/index'
import { Modal } from '../components/ui/Modal'
import { Autocomplete } from '../components/pos/Autocomplete'

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
const fmt_es = (n: number) =>
  n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const PAYMENT_LABELS: Record<string, string> = {
  cash:     'Efectivo',
  card:     'Tarjeta',
  transfer: 'Transferencia',
}
const COMMISSION_MODE_LABELS: Record<string, string> = {
  simple:       'Modo A (Simple)',
  proportional: 'Modo B (Proporcional)',
  manual:       'Modo C (Manual)',
}

const translatePayments = (raw: string | null): string => {
  if (!raw) return ''
  return raw.split(', ').map(m => PAYMENT_LABELS[m.trim()] ?? m.trim()).join(', ')
}

const NewCommissionView: React.FC = () => {
  // Calcular fechas por defecto: primer y último día del mes actual
  const now     = new Date()
  const defFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const defTo   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

  const [dateFrom, setDateFrom]   = useState(defFrom)
  const [dateTo, setDateTo]       = useState(defTo)
  const [includeSalaries, setIncludeSalaries] = useState(false)
  const [preview, setPreview]     = useState<CommissionPreview | null>(null)
  const [loadingPreview, setLP]   = useState(false)
  const [exportingXls, setExportingXls] = useState(false)
  const [confirming, setConf]     = useState(false)
  const [notes, setNotes]         = useState('')
  const [error, setError]         = useState<string | null>(null)
  const [success, setSuccess]     = useState<string | null>(null)
  const [expandedEmp, setExpanded] = useState<Set<number>>(new Set())

  // ── Exportar ventas a Excel ───────────────────────────────────────────
  const handleExportSales = async () => {
    if (!dateFrom || !dateTo) { setError('Selecciona un rango de fechas para exportar.'); return }
    setExportingXls(true); setError(null)
    try {
      const res = await window.electronAPI.invoices.exportSalesData(dateFrom, dateTo)
      if (!res.ok || !res.data) { setError(res.error ?? 'Error al obtener datos'); return }

      const { invoices, serviceLines } = res.data as {
        invoices: {
          id: number; folio: string; status: string; commission_mode: string
          subtotal: number; tax_rate: number; tax_amount: number; total: number
          fecha: string; client_name: string; client_phone: string | null
          created_by_username: string; metodos_pago: string | null; notes: string | null
        }[]
        serviceLines: {
          invoice_id: number; invoice_service_id: number
          service_name: string; unit_price: number; quantity: number; line_total: number
          employee_id: number; employee_name: string; employee_role: string
          commission_pct: number; work_split_pct: number; commission_amount: number
          is_owner: number; commission_run_id: number | null
        }[]
      }

      if (invoices.length === 0) {
        setError(`No se encontraron ventas entre ${dateFrom} y ${dateTo}.`)
        return
      }

      const wb = XLSX.utils.book_new()

      // ── Pestaña 1: Ventas (resumen de invoices) ──────────────────────
      const totalSubtotal = invoices.reduce((s, i) => s + i.subtotal, 0)
      const totalIva      = invoices.reduce((s, i) => s + i.tax_amount, 0)
      const totalTotal    = invoices.reduce((s, i) => s + i.total, 0)

      const ventasData = [
        ['Folio', 'Fecha', 'Cliente', 'Teléfono', 'Subtotal', 'IVA', 'Total', 'Método(s) de pago', 'Modo comisión', 'Registrado por', 'Notas'],
        ...invoices.map(inv => [
          inv.folio, inv.fecha, inv.client_name, inv.client_phone ?? '',
          inv.subtotal, inv.tax_amount, inv.total,
          translatePayments(inv.metodos_pago),
          COMMISSION_MODE_LABELS[inv.commission_mode] ?? inv.commission_mode,
          inv.created_by_username, inv.notes ?? ''
        ]),
        [],
        ['', '', '', 'TOTALES', totalSubtotal, totalIva, totalTotal]
      ]
      const wsVentas = XLSX.utils.aoa_to_sheet(ventasData)
      wsVentas['!cols'] = [10,12,22,14,12,10,12,20,14,16,24].map(w => ({ wch: w }))
      XLSX.utils.book_append_sheet(wb, wsVentas, 'Ventas')

      // ── Pestaña 2: Comisiones (totales por empleado) ─────────────────
      const empTotals = new Map<string, { comisiones: number; servicios: number; count: number }>()
      for (const sl of serviceLines) {
        const key = sl.employee_name
        if (!empTotals.has(key)) empTotals.set(key, { comisiones: 0, servicios: 0, count: 0 })
        const e = empTotals.get(key)!
        e.comisiones += sl.commission_amount
        e.servicios  += sl.line_total
        e.count      += 1
      }
      const comisionesData = [
        ['Empleado', 'Servicios realizados', 'Total vendido (líneas asignadas)', 'Total comisión'],
        ...Array.from(empTotals.entries()).map(([nombre, vals]) => [
          nombre, vals.count, vals.servicios, vals.comisiones
        ]),
        [],
        ['TOTAL', '', Array.from(empTotals.values()).reduce((s, v) => s + v.servicios, 0), Array.from(empTotals.values()).reduce((s, v) => s + v.comisiones, 0)]
      ]
      const wsComisiones = XLSX.utils.aoa_to_sheet(comisionesData)
      wsComisiones['!cols'] = [24, 22, 30, 18].map(w => ({ wch: w }))
      XLSX.utils.book_append_sheet(wb, wsComisiones, 'Comisiones')

      // ── Pestaña por empleado: desglose individual ────────────────────
      const byEmployee = new Map<string, typeof serviceLines>()
      for (const sl of serviceLines) {
        if (!byEmployee.has(sl.employee_name)) byEmployee.set(sl.employee_name, [])
        byEmployee.get(sl.employee_name)!.push(sl)
      }

      for (const [nombre, lines] of byEmployee.entries()) {
        // Enriquecer con datos del invoice (fecha, folio)
        const invoiceMap = new Map(invoices.map(i => [i.id, i]))
        const totalLinea     = lines.reduce((s, sl) => s + sl.line_total, 0)
        const totalComision = lines.reduce((s, sl) => s + sl.commission_amount, 0)

        const detalleData = [
          ['Folio', 'Fecha', 'Servicio', 'Precio unitario', 'Cantidad', 'Total línea', 'Rol', '% Comisión', '% Trabajo', 'Monto comisión', 'Cuadre previo'],
          ...lines.map(sl => {
            const inv = invoiceMap.get(sl.invoice_id)
            return [
              inv?.folio ?? '', inv?.fecha ?? '',
              sl.service_name, sl.unit_price, sl.quantity, sl.line_total,
              sl.is_owner ? 'Jefe (Remanente)' : 'Auxiliar',
              sl.commission_pct / 100,
              sl.work_split_pct / 100,
              sl.commission_amount,
              sl.commission_run_id ? `Cuadre #${sl.commission_run_id}` : 'Pendiente'
            ]
          }),
          [],
          ['', '', '', '', '', totalLinea, '', '', '', totalComision]
        ]
        const wsEmp = XLSX.utils.aoa_to_sheet(detalleData)
        wsEmp['!cols'] = [10,12,22,14,10,12,16,12,12,14,14].map(w => ({ wch: w }))
        // Formatear columnas de porcentaje (r=1 es la fila 2 en Excel, saltando el header)
        for (let r = 1; r <= lines.length; r++) {
          const hCell = XLSX.utils.encode_cell({ r, c: 7 })
          const wCell = XLSX.utils.encode_cell({ r, c: 8 })
          if (wsEmp[hCell]) wsEmp[hCell].z = '0.0%'
          if (wsEmp[wCell]) wsEmp[wCell].z = '0.0%'
        }
        // Truncar nombre a 31 chars (límite de Excel para nombre de hoja)
        const sheetName = nombre.substring(0, 31)
        XLSX.utils.book_append_sheet(wb, wsEmp, sheetName)
      }

      // ── Descargar ────────────────────────────────────────────────────
      const fileName = `ventas_${dateFrom}_${dateTo}.xlsx`
      XLSX.writeFile(wb, fileName)
    } catch (e) { setError(String(e)) }
    finally { setExportingXls(false) }
  }

  const handlePreview = async () => {
    if (!dateFrom || !dateTo) { setError('Selecciona un rango de fechas.'); return }
    setLP(true); setError(null); setPreview(null); setSuccess(null)
    try {
      const res = await window.electronAPI.commissions.preview(dateFrom, dateTo, includeSalaries)
      if (!res.ok) { setError(res.error ?? 'Error al calcular'); return }
      setPreview(res.data as CommissionPreview)
    } catch (e) { setError(String(e)) }
    finally { setLP(false) }
  }

  const handleConfirm = async () => {
    if (!preview) return
    setConf(true); setError(null)
    try {
      const res = await window.electronAPI.commissions.confirm(dateFrom, dateTo, notes || undefined, includeSalaries)
      if (!res.ok) { setError(res.error ?? 'Error al confirmar'); return }
      const { runId, lines_processed } = res.data as { runId: number; lines_processed: number }
      setSuccess(`Cuadre #${runId} confirmado. Se procesaron ${lines_processed} línea(s) de comisión.`)
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
          <h3 className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>Rango de fechas y opciones</h3>
        </div>
        <div className="flex items-center gap-5 flex-wrap">
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
          <div className="flex items-center gap-2 pt-5">
            <button
              onClick={() => { setIncludeSalaries(!includeSalaries); setPreview(null) }}
              className="luma-btn text-xs px-4 py-2 flex items-center gap-2 transition-all"
              style={{
                background: includeSalaries ? 'var(--color-warning)' : 'transparent',
                color:      includeSalaries ? 'black' : 'var(--color-text-muted)',
                border:     `1px solid ${includeSalaries ? 'var(--color-warning)' : 'var(--color-border)'}`,
                fontWeight: includeSalaries ? '600' : '400'
              }}
            >
              {includeSalaries ? <Check size={14} /> : <div className="w-3.5 h-3.5 rounded-full border border-current opacity-30" />}
              ¿Incluir sueldos base?
            </button>
          </div>
          <div className="flex items-end gap-2 ml-auto">
            <button onClick={handleExportSales} disabled={exportingXls}
              className="luma-btn mt-4 flex items-center gap-1.5 text-xs px-3 py-2"
              style={{
                background: 'transparent',
                color: exportingXls ? 'var(--color-text-muted)' : 'var(--color-success)',
                border: '1px solid var(--color-success)',
              }}>
              {exportingXls
                ? <><Loader2 size={14} className="animate-spin" /> Exportando...</>
                : <><FileSpreadsheet size={14} /> Exportar ventas</>}
            </button>
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
          {/* Advertencia: líneas ya comisionadas en el rango */}
          {preview.already_commissioned > 0 && (
            <div className="rounded-lg px-4 py-3 text-sm flex items-start gap-2"
                 style={{ background: 'color-mix(in srgb,var(--color-info) 10%,transparent)', color: 'var(--color-info)', border: '1px solid color-mix(in srgb,var(--color-info) 25%,transparent)' }}>
              <Info size={15} className="mt-0.5 flex-shrink-0" />
              <span>
                <strong>{preview.already_commissioned} Venta(s)</strong> de este rango ya fueron incluidas
                en un cuadre anterior y <strong>no se incluirán</strong> en este cuadre.
                Solo se mostrarán las Ventas pendientes de comisionar.
              </span>
            </div>
          )}
          {/* Tarjetas de resumen */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Total facturado en el periodo', value: fmt(preview.total_invoiced),    color: 'var(--color-text)',    sub: `Del ${preview.date_from} al ${preview.date_to}` },
              { label: 'Total a repartir',              value: fmt(preview.total_to_pay),      color: 'var(--color-warning)', sub: `${fmt(preview.total_commissions)} en comisiones + ${fmt(preview.total_salaries)} en sueldos base` },
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
                    Desglose por colaborador / jefe
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
                  Esta acción guardará el cuadre en el historial de auditoría y marcará los servicios como pagados.
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
          {emp.is_owner && <Badge variant="success">Jefe de servicio</Badge>}
          {!emp.is_owner && <Badge variant="info">Colaborador</Badge>}
        </div>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
          {emp.details.length} servicios realizados · {fmtPct(emp.commission_pct)} comisión base
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="font-bold" style={{ color: 'var(--color-warning)' }}>{fmt(emp.total_to_pay)}</p>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {emp.salary_amount > 0 ? `${fmt(emp.commission_amount)} com. + ${fmt(emp.salary_amount)} sueldo` : 'total comisión'}
        </p>
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
              {['Folio', 'Fecha', 'Servicio', 'Monto línea', 'Rol', '% Comisión', 'Monto a pagar'].map(h => (
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
                <td className="py-2 pr-4">
                  {d.is_owner ? <span style={{ color: 'var(--color-success)' }}>Jefe (Remanente)</span>
                             : <span style={{ color: 'var(--color-info)' }}>Auxiliar ({d.work_split_pct}%)</span>}
                </td>
                <td className="py-2 pr-4" style={{ color: 'var(--color-text-muted)' }}>{fmtPct(d.commission_pct)}</td>
                <td className="py-2 font-medium" style={{ color: 'var(--color-warning)' }}>{fmt(d.commission_amount)}</td>
              </tr>
            ))}
            {/* Subtotal del empleado */}
            {emp.salary_amount > 0 && (
              <tr style={{ borderTop: '1px solid var(--color-border)' }}>
                <td colSpan={6} className="py-2 font-medium text-right pr-4" style={{ color: 'var(--color-text-muted)' }}>
                  Sueldo base:
                </td>
                <td className="py-2 font-bold" style={{ color: 'var(--color-text)' }}>{fmt(emp.salary_amount)}</td>
              </tr>
            )}
            <tr style={{ borderTop: '2px solid var(--color-border)' }}>
              <td colSpan={6} className="py-2 font-medium text-right pr-4" style={{ color: 'var(--color-text-muted)' }}>
                Total a pagar:
              </td>
              <td className="py-2 font-bold text-lg" style={{ color: 'var(--color-warning)' }}>{fmt(emp.total_to_pay)}</td>
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
  const [detailRun, setDetail]  = useState<{ run: CommissionRun; details: CommissionDetail[] } | null>(null)
  const [expandedDetailEmp, setExpandedDetail] = useState<Set<number>>(new Set())

  // Filtros
  const [filterEmp, setFilterEmp]   = useState<{ id: number; label: string } | null>(null)
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo]     = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await window.electronAPI.commissions.listRuns({
      page,
      pageSize: 15,
      employeeId: filterEmp?.id,
      dateFrom:   filterFrom || undefined,
      dateTo:     filterTo   || undefined
    })
    if (res.ok) setResult(res.data as PaginatedResult<CommissionRun>)
    setLoading(false)
  }, [page, filterEmp, filterFrom, filterTo])

  useEffect(() => { load() }, [load])

  const handleSearchEmp = async (q: string) => {
    const res = await window.electronAPI.employees.list({ search: q, pageSize: 10 })
    if (!res.ok) return []
    return (res.data as PaginatedResult<any>).items.map(e => ({
      id: e.id,
      label: `${e.first_name} ${e.last_name}`,
      sublabel: e.role === 'owner' ? 'Jefe' : 'Colaborador'
    }))
  }

  const clearFilters = () => {
    setFilterEmp(null)
    setFilterFrom('')
    setFilterTo('')
    setPage(1)
  }

  const openDetail = async (run: CommissionRun) => {
    const res = await window.electronAPI.commissions.getRunDetail(run.id)
    if (res.ok) {
      setDetail(res.data as { run: CommissionRun; details: CommissionDetail[] })
      // No reseteamos expandedDetail aquí si hay un filtro activo (se encarga el useEffect abajo)
      if (!filterEmp) setExpandedDetail(new Set())
    }
  }

  const toggleDetailEmployee = (id: number) => {
    setExpandedDetail(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Agrupar detalles por empleado para el modal
  const groupedDetails = React.useMemo(() => {
    if (!detailRun) return []
    const map = new Map<number, {
      id: number,
      name: string,
      commissions: number,
      salary: number,
      items: CommissionDetail[]
    }>()

    for (const d of detailRun.details) {
      // Si hay un filtro de empleado activo, ignoramos a los demás en el detalle del modal
      if (filterEmp && d.employee_id !== filterEmp.id) continue

      if (!map.has(d.employee_id)) {
        map.set(d.employee_id, { id: d.employee_id, name: d.employee_name, commissions: 0, salary: 0, items: [] })
      }
      const g = map.get(d.employee_id)!
      g.items.push(d)
      g.commissions += d.commission_amount
      g.salary      += d.base_salary_snapshot
    }
    return Array.from(map.values())
  }, [detailRun, filterEmp])

  // Efecto para expandir automáticamente si hay filtro
  useEffect(() => {
    if (detailRun && filterEmp) {
      setExpandedDetail(new Set([filterEmp.id]))
    }
  }, [detailRun, filterEmp])

  return (
    <div className="p-6 flex flex-col gap-4 h-full overflow-auto">

      {/* Barra de filtros */}
      <div className="luma-surface p-4 flex items-center gap-4 flex-wrap border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div className="w-64">
          <label className="luma-label text-[10px] uppercase tracking-wider mb-1.5 block">Filtrar por empleado</label>
          <Autocomplete
            placeholder="Nombre del empleado..."
            onSearch={handleSearchEmp}
            onSelect={opt => { setFilterEmp(opt); setPage(1) }}
            selected={filterEmp}
            onClear={() => { setFilterEmp(null); setPage(1) }}
            icon={<User size={14} />}
          />
        </div>
        <div>
          <label className="luma-label text-[10px] uppercase tracking-wider mb-1.5 block">Desde</label>
          <input type="date" value={filterFrom} onChange={e => { setFilterFrom(e.target.value); setPage(1) }}
            className="luma-input text-xs h-[38px]" />
        </div>
        <div>
          <label className="luma-label text-[10px] uppercase tracking-wider mb-1.5 block">Hasta</label>
          <input type="date" value={filterTo} onChange={e => { setFilterTo(e.target.value); setPage(1) }}
            className="luma-input text-xs h-[38px]" />
        </div>
        {(filterEmp || filterFrom || filterTo) && (
          <div className="flex items-end h-[38px]">
            <button onClick={clearFilters} className="luma-btn-ghost text-[10px] px-2 py-1 flex items-center gap-1 uppercase tracking-tight">
              <X size={12} /> Limpiar filtros
            </button>
          </div>
        )}
      </div>

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
                {['#', 'Período', 'Total pagado', 'Total facturado', 'Ejecutado por', 'Fecha', 'Detalle'].map(h => (
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
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-text)' }}>
                    {fmt(run.total_commissions + run.total_business)}
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
        title={`Detalle de Cuadre #${detailRun?.run.id}`}
        subtitle={`${detailRun?.run.date_from} → ${detailRun?.run.date_to}`}
        width="xl">
        {detailRun && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="luma-surface p-3 text-center">
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Total distribuido</p>
                <p className="text-xl font-bold" style={{ color: 'var(--color-warning)' }}>{fmt(detailRun.run.total_commissions)}</p>
              </div>
              <div className="luma-surface p-3 text-center">
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Notas</p>
                <p className="text-sm italic" style={{ color: 'var(--color-text-muted)' }}>{detailRun.run.notes || 'Sin notas'}</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 max-h-[60vh] overflow-auto pr-2">
              {groupedDetails.map((g, idx) => {
                const isExpanded = expandedDetailEmp.has(g.id)
                return (
                  <div key={idx} className="luma-surface overflow-hidden border" style={{ borderColor: 'var(--color-border)' }}>
                    <button onClick={() => toggleDetailEmployee(g.id)}
                      className="w-full px-3 py-2 bg-white/5 flex justify-between items-center hover:bg-white/10 transition-colors">
                      <div className="flex items-center gap-2">
                        {isExpanded ? <ChevronUp size={14} style={{ color: 'var(--color-text-muted)' }} />
                                   : <ChevronDown size={14} style={{ color: 'var(--color-text-muted)' }} />}
                        <span className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>{g.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] block leading-none" style={{ color: 'var(--color-text-muted)' }}>
                          {g.salary > 0 ? `${fmt(g.commissions)} com. + ${fmt(g.salary)} sueldo` : 'total comisiones'}
                        </span>
                        <span className="font-bold text-sm" style={{ color: 'var(--color-warning)' }}>{fmt(g.commissions + g.salary)}</span>
                      </div>
                    </button>

                    {isExpanded && (
                      <table className="w-full text-[10px]">
                        <thead>
                          <tr style={{ background: 'var(--color-surface-2)' }}>
                            {['Folio', 'Servicio', 'Monto', 'Rol', 'Pago'].map(h => (
                              <th key={h} className="text-left px-3 py-1.5 font-medium" style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {g.items.map((d, i) => (
                            <tr key={i} style={{ borderTop: '1px solid var(--color-border)' }}>
                              <td className="px-3 py-1.5 font-mono" style={{ color: 'var(--color-accent)' }}>{d.invoice_folio}</td>
                              <td className="px-3 py-1.5" style={{ color: 'var(--color-text)' }}>{d.service_name}</td>
                              <td className="px-3 py-1.5" style={{ color: 'var(--color-text-muted)' }}>{fmt(d.line_total)}</td>
                              <td className="px-3 py-1.5">
                                {d.is_owner ? <span style={{ color: 'var(--color-success)' }}>Jefe</span> : <span style={{ color: 'var(--color-info)' }}>Aux</span>}
                              </td>
                              <td className="px-3 py-1.5 font-medium" style={{ color: 'var(--color-warning)' }}>{fmt(d.commission_amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
