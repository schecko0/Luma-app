import React, { useState, useEffect, useCallback } from 'react'
import {
  LayoutDashboard, TrendingUp, ShoppingBag, Users, BadgeDollarSign,
  Receipt, AlertCircle, Package, RefreshCw, CalendarRange,
  ArrowUp, ArrowDown, DollarSign, CreditCard, ArrowRightLeft, Crown,
} from 'lucide-react'
import { PageHeader, Spinner, Badge } from '../components/ui/index'

// ── Tipos de los datos del dashboard ─────────────────────────────────────────
interface DashboardStats {
  period: { from: string; to: string }
  sales: { invoice_count: number; total_subtotal: number; total_tax: number; total_revenue: number }
  salesByMethod: { payment_method: string; total: number }[]
  commissions: { total_commissions: number }
  commissionsByEmployee: { id: number; name: string; role: string; calendar_color: string; commission_amount: number; services_total: number }[]
  topServices: { service_name: string; count: number; revenue: number }[]
  cancelled: number
  pendingOfficial: number
  uniqueClients: number
  dailySales: { day: string; total: number }[]
  lowStockCount: number
}

const fmt     = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
const fmtInt  = (n: number) => n.toLocaleString('es-MX')
const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })

// Color de Google Calendar → CSS color
const GC_COLORS: Record<string, string> = {
  sage: '#33b679', flamingo: '#e67c73', tangerine: '#f6bf26', banana: '#f6bf26',
  peacock: '#039be5', blueberry: '#3f51b5', lavender: '#7986cb', grape: '#8d24aa',
  graphite: '#616161', basil: '#0f9d58', tomato: '#d50000',
}

// Fecha helpers
const today       = () => new Date().toISOString().split('T')[0]
const firstOfMonth = () => {
  const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

// ── Componente principal ──────────────────────────────────────────────────────
export const DashboardPage: React.FC = () => {
  const [stats, setStats]       = useState<DashboardStats | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [dateFrom, setDateFrom] = useState(firstOfMonth)
  const [dateTo, setDateTo]     = useState(today)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await window.electronAPI.dashboard.getStats(dateFrom, dateTo)
      if (res.ok) setStats(res.data as DashboardStats)
      else setError(res.error ?? 'Error al cargar estadísticas')
    } catch (e) { setError(String(e)) }
    finally { setLoading(false) }
  }, [dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Dashboard"
        subtitle="Resumen del negocio en tiempo real"
        icon={<LayoutDashboard size={18} />}
        actions={
          <div className="flex items-center gap-2">
            <CalendarRange size={14} style={{ color: 'var(--color-text-muted)' }} />
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="luma-input text-xs w-36" />
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>al</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="luma-input text-xs w-36" />
            <button onClick={load} className="luma-btn-ghost p-2">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-auto p-6 flex flex-col gap-6">
        {error && (
          <div className="rounded-lg px-4 py-3 text-sm flex items-center gap-2"
               style={{ background: 'color-mix(in srgb,var(--color-danger) 12%,transparent)', color: 'var(--color-danger)' }}>
            <AlertCircle size={14} />{error}
          </div>
        )}

        {loading && !stats ? (
          <div className="flex justify-center items-center py-20"><Spinner size={36} /></div>
        ) : stats ? (
          <>
            {/* ── Fila 1: KPI cards ────────────────────────────────────── */}
            <div className="grid grid-cols-4 gap-4">
              <KpiCard
                label="Ingresos del período"
                value={fmt(stats.sales.total_revenue)}
                sub={`${fmtInt(stats.sales.invoice_count)} venta(s)`}
                icon={<TrendingUp size={18} />}
                color="var(--color-accent)"
              />
              <KpiCard
                label="Comisiones totales"
                value={fmt(stats.commissions.total_commissions)}
                sub={`${stats.commissionsByEmployee.length} colaborador(es)`}
                icon={<BadgeDollarSign size={18} />}
                color="var(--color-warning)"
              />
              <KpiCard
                label="Clientes únicos"
                value={fmtInt(stats.uniqueClients)}
                sub="con venta en el período"
                icon={<Users size={18} />}
                color="var(--color-info)"
              />
              <KpiCard
                label="Ventas realizadas"
                value={fmtInt(stats.sales.invoice_count)}
                sub={`${stats.cancelled} cancelada(s)`}
                icon={<ShoppingBag size={18} />}
                color="var(--color-success)"
              />
            </div>

            {/* ── Fila 2: Sparkline de ventas por día ──────────────────── */}
            {stats.dailySales.length > 0 && (
              <div className="luma-surface p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                    Ventas por día
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Total período:</span>
                    <span className="text-sm font-bold" style={{ color: 'var(--color-accent)' }}>
                      {fmt(stats.dailySales.reduce((s, d) => s + d.total, 0))}
                    </span>
                  </div>
                </div>
                <Sparkline key={`${dateFrom}-${dateTo}`} data={stats.dailySales} />
              </div>
            )}

            {/* ── Fila 3: Métodos de pago + Top servicios ───────────────── */}
            <div className="grid grid-cols-3 gap-4">
              {/* Métodos de pago */}
              <div className="luma-surface p-5 flex flex-col gap-4">
                <h3 className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Ventas por método</h3>
                {[
                  { key: 'cash',     label: 'Efectivo',      icon: <DollarSign size={14} />,       color: 'var(--color-success)' },
                  { key: 'card',     label: 'Tarjeta',        icon: <CreditCard size={14} />,       color: 'var(--color-info)' },
                  { key: 'transfer', label: 'Transferencia',  icon: <ArrowRightLeft size={14} />,   color: 'var(--color-warning)' },
                ].map(({ key, label, icon, color }) => {
                  const entry = stats.salesByMethod.find(s => s.payment_method === key)
                  const total = entry?.total ?? 0
                  const pct   = stats.sales.total_revenue > 0 ? (total / stats.sales.total_revenue) * 100 : 0
                  return (
                    <div key={key} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5" style={{ color }}>
                          {icon} {label}
                        </span>
                        <span className="font-medium" style={{ color: 'var(--color-text)' }}>{fmt(total)}</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-2)' }}>
                        <div className="h-full rounded-full transition-all duration-500"
                             style={{ width: `${pct}%`, background: color }} />
                      </div>
                      <span className="text-xs text-right" style={{ color: 'var(--color-text-muted)' }}>
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Top servicios */}
              <div className="luma-surface p-5 col-span-2">
                <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--color-text)' }}>
                  Top servicios del período
                </h3>
                {stats.topServices.length === 0 ? (
                  <p className="text-xs text-center py-4" style={{ color: 'var(--color-text-muted)' }}>Sin datos en este período.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                        {['Servicio', 'Veces', 'Ingresos'].map(h => (
                          <th key={h} className="text-left pb-2 text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {stats.topServices.map((svc, i) => (
                        <tr key={i} style={{ borderBottom: i < stats.topServices.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                          <td className="py-2 text-xs pr-4" style={{ color: 'var(--color-text)' }}>
                            <span className="inline-flex items-center gap-1.5">
                              <span className="font-mono text-xs px-1.5 py-0.5 rounded"
                                    style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}>
                                #{i + 1}
                              </span>
                              {svc.service_name}
                            </span>
                          </td>
                          <td className="py-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>{svc.count}×</td>
                          <td className="py-2 text-xs font-medium" style={{ color: 'var(--color-success)' }}>{fmt(svc.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* ── Fila 4: Comisiones por empleado ──────────────────────── */}
            {stats.commissionsByEmployee.length > 0 && (
              <div className="luma-surface p-5">
                <h3 className="text-sm font-medium mb-4" style={{ color: 'var(--color-text)' }}>
                  Comisiones por colaborador
                </h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {stats.commissionsByEmployee.map(emp => (
                    <div key={emp.id} className="rounded-xl p-4 border flex flex-col gap-2"
                         style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)' }}>
                      <div className="flex items-center gap-2">
                        {/* Dot de color del calendario */}
                        <div className="w-3 h-3 rounded-full flex-shrink-0"
                             style={{ background: GC_COLORS[emp.calendar_color] ?? 'var(--color-accent)' }} />
                        <span className="text-xs font-medium truncate" style={{ color: 'var(--color-text)' }}>
                          {emp.name}
                        </span>
                        {emp.role === 'owner' && <Crown size={10} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />}
                      </div>
                      <div>
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Comisión</p>
                        <p className="text-lg font-bold" style={{ color: 'var(--color-warning)' }}>
                          {fmt(emp.commission_amount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>En servicios</p>
                        <p className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>
                          {fmt(emp.services_total)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Fila 5: Alertas ──────────────────────────────────────── */}
            {(stats.lowStockCount > 0 || stats.pendingOfficial > 0 || stats.cancelled > 0) && (
              <div className="flex flex-wrap gap-3">
                {stats.lowStockCount > 0 && (
                  <AlertBadge
                    icon={<Package size={13} />}
                    label={`${stats.lowStockCount} producto(s) con stock bajo`}
                    color="var(--color-danger)"
                    href="/inventory"
                  />
                )}
                {stats.pendingOfficial > 0 && (
                  <AlertBadge
                    icon={<Receipt size={13} />}
                    label={`${stats.pendingOfficial} factura(s) oficial(es) pendiente(s)`}
                    color="var(--color-warning)"
                    href="/pos"
                  />
                )}
                {stats.cancelled > 0 && (
                  <AlertBadge
                    icon={<AlertCircle size={13} />}
                    label={`${stats.cancelled} venta(s) cancelada(s) en el período`}
                    color="var(--color-text-muted)"
                  />
                )}
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
const KpiCard: React.FC<{ label: string; value: string; sub: string; icon: React.ReactNode; color: string }> = ({ label, value, sub, icon, color }) => (
  <div className="luma-surface p-5 flex flex-col gap-3">
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <span className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: `color-mix(in srgb,${color} 15%,transparent)`, color }}>
        {icon}
      </span>
    </div>
    <div>
      <p className="text-2xl font-bold font-display" style={{ color }}>{value}</p>
      <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{sub}</p>
    </div>
  </div>
)

// ── Sparkline SVG de ventas por día ──────────────────────────────────────────
const Sparkline: React.FC<{ data: { day: string; total: number }[] }> = ({ data }) => {
  const W = 900, H = 160, PAD = 30
  const max = Math.max(...data.map(d => d.total), 1)
  const xStep = (W - PAD * 2) / Math.max(data.length - 1, 1)

  const points = data.map((d, i) => ({
    x: PAD + i * xStep,
    y: (H - PAD) - ((d.total / max) * (H - PAD * 2)),
    day: d.day,
    total: d.total,
  }))

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const areaD = `${pathD} L${points[points.length - 1].x},${H - PAD} L${PAD},${H - PAD} Z`

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minHeight: 160 }}>
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#sparkGrad)" />
        <path d={pathD} fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="3" fill="var(--color-accent)" />
            {/* Etiquetas en los extremos y el punto más alto */}
            {(i === 0 || i === points.length - 1 || p.total === max) && (
              <>
                <text x={p.x} y={p.y - 12} textAnchor="middle" fontSize="11" fontWeight="bold" fill="var(--color-text)">
                  {fmt(p.total)}
                </text>
                <text x={p.x} y={H - 5} textAnchor="middle" fontSize="10" fill="var(--color-text-muted)">
                  {fmtDate(p.day)}
                </text>
              </>
            )}
          </g>
        ))}
      </svg>
    </div>
  )
}

// ── Alerta badge ──────────────────────────────────────────────────────────────
const AlertBadge: React.FC<{ icon: React.ReactNode; label: string; color: string; href?: string }> = ({ icon, label, color, href }) => (
  <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg border"
       style={{ background: `color-mix(in srgb,${color} 10%,transparent)`, borderColor: `color-mix(in srgb,${color} 30%,transparent)`, color }}>
    {icon}
    {label}
  </div>
)

// ── Placeholder (para index.tsx hasta que sea reemplazado) ────────────────────
export const PlaceholderPage: React.FC<{ title: string; description?: string; icon?: React.ReactNode }> = ({ title, description, icon }) => (
  <div className="flex flex-col h-full items-center justify-center gap-4 p-8 text-center"
       style={{ color: 'var(--color-text-muted)' }}>
    {icon}
    <div>
      <h2 className="text-xl font-semibold font-display mb-2" style={{ color: 'var(--color-text)' }}>{title}</h2>
      {description && <p className="text-sm max-w-sm mx-auto">{description}</p>}
    </div>
    <Badge variant="info">Próximamente</Badge>
  </div>
)
