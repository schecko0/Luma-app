import React, { useState, useEffect, useCallback } from 'react'
import {
  Vault, LockOpen, Lock, Plus, RefreshCw, Loader2,
  CalendarRange, ArrowUp, ArrowDown, CheckCircle2, AlertCircle,
  DollarSign, CreditCard, ArrowRightLeft, History, FileText, X,
} from 'lucide-react'
import type { CashRegister, CashMovement, CashMovementCategory, Invoice, PaginatedResult } from '../types'
import { Badge, PageHeader, Spinner, Paginator } from '../components/ui/index'
import { Modal } from '../components/ui/Modal'

type CashView = 'current' | 'history'

const fmt = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`

// Traducción de métodos de pago
const PAYMENT_LABELS: Record<string, string> = {
  cash:     '💵 Efectivo',
  card:     '💳 Tarjeta',
  transfer: '🔄 Transferencia',
}

// Fix cero a la izquierda
const numVal = (n: number) => n === 0 ? '' : String(n)

export const CashPage: React.FC = () => {
  const [view, setView]               = useState<CashView>('current')
  const [openRegister, setOpenReg]    = useState<CashRegister | null>(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)

  const loadOpenRegister = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await window.electronAPI.cash.getOpen()
      if (res.ok) setOpenReg(res.data as CashRegister | null)
      else setError(res.error ?? 'Error')
    } catch (e) { setError(String(e)) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadOpenRegister() }, [loadOpenRegister])

  if (loading) return <div className="flex items-center justify-center h-full"><Spinner size={36} /></div>

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Caja Registradora"
        subtitle={openRegister
          ? `Abierta desde ${new Date(openRegister.opened_at).toLocaleString('es-MX')}`
          : 'Sin caja abierta'}
        icon={<Vault size={18} />}
        actions={
          <div className="flex gap-2">
            {(['current', 'history'] as CashView[]).map(v => (
              <button key={v} onClick={() => setView(v)}
                className="luma-btn text-xs px-3 py-1.5"
                style={{
                  background: view === v ? 'var(--color-accent)' : 'transparent',
                  color:      view === v ? 'white' : 'var(--color-text-muted)',
                  border:     `1px solid ${view === v ? 'var(--color-accent)' : 'var(--color-border)'}`,
                }}>
                {v === 'current' ? <><Vault size={13} /> Caja actual</> : <><History size={13} /> Historial</>}
              </button>
            ))}
          </div>
        }
      />

      {error && (
        <div className="mx-6 mt-4 rounded-lg px-4 py-3 text-sm flex items-center gap-2"
             style={{ background: 'color-mix(in srgb,var(--color-danger) 12%,transparent)', color: 'var(--color-danger)' }}>
          <AlertCircle size={14} />{error}
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {view === 'current'
          ? openRegister
            ? <OpenCashView register={openRegister} onRefresh={loadOpenRegister} onClose={() => { setOpenReg(null); loadOpenRegister() }} />
            : <OpenCashForm onOpened={loadOpenRegister} />
          : <CashHistoryView />
        }
      </div>
    </div>
  )
}

// ── Formulario apertura ───────────────────────────────────────────────────────
const OpenCashForm: React.FC<{ onOpened: () => void }> = ({ onOpened }) => {
  const [initialCash, setInitialCash] = useState(0)
  const [notes, setNotes]             = useState('')
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState<string | null>(null)

  const handleOpen = async () => {
    setSaving(true); setError(null)
    try {
      const res = await window.electronAPI.cash.open({ initial_cash: initialCash, opened_by: 1, notes: notes || undefined })
      if (!res.ok) { setError(res.error ?? 'Error al abrir caja'); return }
      onOpened()
    } catch (e) { setError(String(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="flex items-center justify-center h-full p-8">
      <div className="luma-surface p-8 w-full max-w-md flex flex-col gap-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
               style={{ background: 'color-mix(in srgb,var(--color-accent) 15%,transparent)', color: 'var(--color-accent)' }}>
            <LockOpen size={28} />
          </div>
          <h2 className="font-display font-semibold text-xl" style={{ color: 'var(--color-text)' }}>Abrir caja</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Ingresa el efectivo inicial para comenzar el turno.
          </p>
        </div>
        {error && (
          <div className="rounded-lg px-4 py-3 text-sm"
               style={{ background: 'color-mix(in srgb,var(--color-danger) 12%,transparent)', color: 'var(--color-danger)' }}>
            {error}
          </div>
        )}
        <div>
          <label className="luma-label text-center block">Efectivo inicial en caja (MXN)</label>
          <input type="number" min="0" step="0.01" placeholder="0.00"
            value={numVal(initialCash)}
            onFocus={e => e.target.select()}
            onChange={e => setInitialCash(parseFloat(e.target.value) || 0)}
            className="luma-input text-center text-2xl font-bold" data-selectable />
        </div>
        <div>
          <label className="luma-label">Notas de apertura</label>
          <textarea rows={2} placeholder="Notas opcionales..." value={notes}
            onChange={e => setNotes(e.target.value)} className="luma-input resize-none" data-selectable />
        </div>
        <button onClick={handleOpen} disabled={saving} className="luma-btn-primary justify-center py-3">
          {saving ? <><Loader2 size={16} className="animate-spin" /> Abriendo...</> : <><LockOpen size={16} /> Abrir caja</>}
        </button>
      </div>
    </div>
  )
}

// ── Vista caja abierta ────────────────────────────────────────────────────────
const OpenCashView: React.FC<{ register: CashRegister; onRefresh: () => void; onClose: () => void }> = ({ register, onRefresh, onClose }) => {
  const [summary, setSummary]         = useState<Record<string, unknown> | null>(null)
  const [movements, setMovements]     = useState<PaginatedResult<CashMovement> | null>(null)
  const [categories, setCategories]   = useState<CashMovementCategory[]>([])
  const [movPage, setMovPage]         = useState(1)
  const [showMovForm, setShowMovForm] = useState(false)
  const [showCloseForm, setShowClose] = useState(false)
  // ← NUEVO: modal de detalle de movimiento
  const [detailMov, setDetailMov]     = useState<CashMovement | null>(null)

  const loadAll = useCallback(async () => {
    const [sumRes, movRes, catRes] = await Promise.all([
      window.electronAPI.cash.getSummary(register.id),
      window.electronAPI.cash.listMovements(register.id, { page: movPage, pageSize: 20 }),
      window.electronAPI.cash.getCategories(),
    ])
    if (sumRes.ok) setSummary(sumRes.data as Record<string, unknown>)
    if (movRes.ok) setMovements(movRes.data as PaginatedResult<CashMovement>)
    if (catRes.ok) setCategories(catRes.data as CashMovementCategory[])
  }, [register.id, movPage])

  useEffect(() => { loadAll() }, [loadAll])

  const salesByMethod = (summary?.salesByMethod as { payment_method: string; total: number }[]) ?? []
  const totalSales    = salesByMethod.reduce((s, r) => s + r.total, 0)
  const getSale       = (m: string) => salesByMethod.find(r => r.payment_method === m)?.total ?? 0

  return (
    <div className="p-6 flex flex-col gap-6">

      {/* ── Cards de resumen (ahora 4: saldo inicial + 3 métodos) ───── */}
      <div className="grid grid-cols-4 gap-4">
        {/* Card saldo inicial ← NUEVO */}
        <div className="luma-surface p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2" style={{ color: 'var(--color-text-muted)' }}>
            <DollarSign size={16} />
            <span className="text-xs font-medium">Saldo inicial</span>
          </div>
          <p className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
            {fmt(register.initial_cash)}
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>efectivo al abrir</p>
        </div>

        {[
          { label: 'Efectivo',       icon: <DollarSign size={16} />,      method: 'cash',     color: 'var(--color-success)' },
          { label: 'Tarjeta',        icon: <CreditCard size={16} />,      method: 'card',     color: 'var(--color-info)' },
          { label: 'Transferencia',  icon: <ArrowRightLeft size={16} />,  method: 'transfer', color: 'var(--color-warning)' },
        ].map(({ label, icon, method, color }) => (
          <div key={method} className="luma-surface p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2" style={{ color }}>
              {icon}
              <span className="text-xs font-medium">{label}</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{fmt(getSale(method))}</p>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>ventas del turno</p>
          </div>
        ))}
      </div>

      {/* Totales + acciones */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Total ventas del turno</p>
          <p className="text-3xl font-bold font-display" style={{ color: 'var(--color-accent)' }}>{fmt(totalSales)}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowMovForm(true)} className="luma-btn text-sm border"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
            <Plus size={14} /> Movimiento
          </button>
          <button onClick={onRefresh} className="luma-btn-ghost p-2"><RefreshCw size={14} /></button>
          <button onClick={() => setShowClose(true)} className="luma-btn text-sm text-white"
            style={{ background: 'var(--color-danger)' }}>
            <Lock size={14} /> Cerrar caja
          </button>
        </div>
      </div>

      {showMovForm && (
        <MovementForm registerId={register.id} categories={categories}
          onSaved={() => { setShowMovForm(false); loadAll() }}
          onCancel={() => setShowMovForm(false)} />
      )}

      {showCloseForm && (
        <CloseRegisterForm register={register} summary={summary}
          onClosed={() => { setShowClose(false); onClose() }}
          onCancel={() => setShowClose(false)} />
      )}

      {/* Tabla de movimientos */}
      <div className="luma-surface overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between"
             style={{ borderColor: 'var(--color-border)' }}>
          <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Movimientos del turno</span>
        </div>
        {movements?.items.length === 0 ? (
          <p className="text-center py-8 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Sin movimientos registrados aún.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                {['Tipo', 'Descripción / Servicio', 'Método', 'Monto', 'Hora', 'Acción'].map(h => (
                  <th key={h} className="text-left px-4 py-2 text-xs font-medium"
                      style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {movements?.items.map((mov, i) => (
                <tr key={mov.id} className="hover:bg-white/5"
                    style={{ borderBottom: i < (movements.items.length - 1) ? '1px solid var(--color-border)' : 'none' }}>
                  <td className="px-4 py-2">
                    {mov.type === 'in'
                      ? <Badge variant="success"><ArrowUp size={10} /> Entrada</Badge>
                      : <Badge variant="danger"><ArrowDown size={10} /> Salida</Badge>}
                  </td>
                  {/* Descripción: muestra descripción o categoría, NO "—" cuando viene de venta */}
                  <td className="px-4 py-2 text-xs" style={{ color: 'var(--color-text)' }}>
                    {mov.description
                      ? mov.description
                      : mov.category_name
                        ? mov.category_name
                        : <span style={{ color: 'var(--color-text-muted)' }}>Sin descripción</span>
                    }
                    {mov.invoice_id && (
                      <span className="ml-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>(venta)</span>
                    )}
                  </td>
                  {/* Método traducido al español */}
                  <td className="px-4 py-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {PAYMENT_LABELS[mov.payment_method] ?? mov.payment_method}
                  </td>
                  <td className="px-4 py-2 font-medium"
                      style={{ color: mov.type === 'in' ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    {mov.type === 'in' ? '+' : '-'}{fmt(mov.amount)}
                  </td>
                  <td className="px-4 py-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {new Date(mov.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  {/* ← NUEVO: botón ver detalle */}
                  <td className="px-4 py-2">
                    <button onClick={() => setDetailMov(mov)}
                      className="luma-btn-ghost p-1.5 rounded-lg" title="Ver detalle">
                      <FileText size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {movements && <Paginator page={movPage} pageSize={20} total={movements.total} onChange={setMovPage} />}
      </div>

      {/* Modal detalle de movimiento ← NUEVO */}
      <Modal isOpen={!!detailMov} onClose={() => setDetailMov(null)}
        title="Detalle del movimiento" width="sm">
        {detailMov && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Tipo',        value: detailMov.type === 'in' ? '📥 Entrada' : '📤 Salida' },
                { label: 'Método',      value: PAYMENT_LABELS[detailMov.payment_method] ?? detailMov.payment_method },
                { label: 'Monto',       value: fmt(detailMov.amount) },
                { label: 'Categoría',   value: detailMov.category_name ?? 'Sin categoría' },
                { label: 'Hora',        value: new Date(detailMov.created_at).toLocaleTimeString('es-MX') },
                { label: 'Referencia',  value: detailMov.reference ?? '—' },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg p-3" style={{ background: 'var(--color-surface-2)' }}>
                  <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{value}</p>
                </div>
              ))}
            </div>
            {detailMov.description && (
              <div className="rounded-lg p-3" style={{ background: 'var(--color-surface-2)' }}>
                <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Descripción</p>
                <p className="text-sm" style={{ color: 'var(--color-text)' }}>{detailMov.description}</p>
              </div>
            )}
            {detailMov.invoice_id && (
              <div className="flex items-center gap-2 text-xs rounded-lg px-3 py-2"
                   style={{ background: 'color-mix(in srgb,var(--color-info) 10%,transparent)', color: 'var(--color-info)' }}>
                <FileText size={12} />
                Movimiento generado por venta (factura interna #{detailMov.invoice_id})
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

// ── Formulario de movimiento ──────────────────────────────────────────────────
const MovementForm: React.FC<{
  registerId: number; categories: CashMovementCategory[]
  onSaved: () => void; onCancel: () => void
}> = ({ registerId, categories, onSaved, onCancel }) => {
  const [type, setType]     = useState<'in' | 'out'>('out')
  const [method, setMethod] = useState<'cash' | 'card' | 'transfer'>('cash')
  const [catId, setCatId]   = useState<number | null>(null)
  const [amount, setAmount] = useState(0)
  const [desc, setDesc]     = useState('')
  const [ref, setRef]       = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const filtered = categories.filter(c => c.type === type || c.type === 'both')

  const handleSave = async () => {
    if (amount <= 0) { setError('El monto debe ser mayor a cero.'); return }
    setSaving(true); setError(null)
    try {
      const res = await window.electronAPI.cash.addMovement({
        register_id: registerId, category_id: catId, type,
        payment_method: method, amount,
        description: desc || null, reference: ref || null,
        created_by: 1, invoice_id: null,
      })
      if (!res.ok) { setError(res.error ?? 'Error'); return }
      onSaved()
    } catch (e) { setError(String(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="luma-surface p-5 flex flex-col gap-4">
      <h3 className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>Registrar movimiento</h3>
      {error && (
        <div className="rounded-lg px-3 py-2 text-xs"
             style={{ background: 'color-mix(in srgb,var(--color-danger) 12%,transparent)', color: 'var(--color-danger)' }}>
          {error}
        </div>
      )}
      <div className="flex gap-2">
        {(['in', 'out'] as const).map(t => (
          <button key={t} type="button" onClick={() => { setType(t); setCatId(null) }}
            className="flex-1 py-2 rounded-lg text-sm font-medium border transition-all"
            style={{
              borderColor: type === t ? (t === 'in' ? 'var(--color-success)' : 'var(--color-danger)') : 'var(--color-border)',
              color:       type === t ? (t === 'in' ? 'var(--color-success)' : 'var(--color-danger)') : 'var(--color-text-muted)',
              background:  type === t ? `color-mix(in srgb,${t === 'in' ? 'var(--color-success)' : 'var(--color-danger)'} 10%,transparent)` : 'transparent',
            }}>
            {t === 'in' ? <><ArrowUp size={13} className="inline mr-1" />Entrada</> : <><ArrowDown size={13} className="inline mr-1" />Salida</>}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="luma-label">Método de pago</label>
          <select value={method} onChange={e => setMethod(e.target.value as typeof method)} className="luma-input">
            <option value="cash">💵 Efectivo</option>
            <option value="card">💳 Tarjeta</option>
            <option value="transfer">🔄 Transferencia</option>
          </select>
        </div>
        <div>
          <label className="luma-label">Categoría</label>
          <select value={catId ?? ''} onChange={e => setCatId(e.target.value ? parseInt(e.target.value) : null)} className="luma-input">
            <option value="">Sin categoría</option>
            {filtered.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="luma-label">Monto (MXN)</label>
        <input type="number" min="0.01" step="0.01" placeholder="0.00"
          value={numVal(amount)}
          onFocus={e => e.target.select()}
          onChange={e => setAmount(parseFloat(e.target.value) || 0)}
          className="luma-input" data-selectable />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="luma-label">Descripción</label>
          <input type="text" placeholder="Motivo del movimiento..." value={desc}
            onChange={e => setDesc(e.target.value)} className="luma-input" data-selectable />
        </div>
        <div>
          <label className="luma-label">Referencia / Folio</label>
          <input type="text" placeholder="Opcional" value={ref}
            onChange={e => setRef(e.target.value)} className="luma-input" data-selectable />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="luma-btn-ghost">Cancelar</button>
        <button onClick={handleSave} disabled={saving} className="luma-btn-primary">
          {saving ? <><Loader2 size={14} className="animate-spin" /> Guardando...</> : <><Plus size={14} /> Registrar</>}
        </button>
      </div>
    </div>
  )
}

// ── Formulario cierre con cuadre ──────────────────────────────────────────────
const CloseRegisterForm: React.FC<{
  register: CashRegister; summary: Record<string, unknown> | null
  onClosed: () => void; onCancel: () => void
}> = ({ register, summary, onClosed, onCancel }) => {
  const salesByMethod  = (summary?.salesByMethod as { payment_method: string; total: number }[]) ?? []
  const getSale        = (m: string) => salesByMethod.find(r => r.payment_method === m)?.total ?? 0
  const systemCash     = register.initial_cash + getSale('cash')
  const systemCard     = getSale('card')
  const systemTransfer = getSale('transfer')

  const [declaredCash,     setDeclaredCash]     = useState(systemCash)
  const [declaredCard,     setDeclaredCard]      = useState(systemCard)
  const [declaredTransfer, setDeclaredTransfer]  = useState(systemTransfer)
  const [notes, setNotes]   = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const diffCash     = declaredCash     - systemCash
  const diffCard     = declaredCard     - systemCard
  const diffTransfer = declaredTransfer - systemTransfer

  const handleClose = async () => {
    setSaving(true); setError(null)
    try {
      const res = await window.electronAPI.cash.close({
        register_id: register.id, closed_by: 1,
        final_cash_declared: declaredCash, final_card_declared: declaredCard,
        final_transfer_declared: declaredTransfer, notes: notes || undefined,
      })
      if (!res.ok) { setError(res.error ?? 'Error'); return }
      onClosed()
    } catch (e) { setError(String(e)) }
    finally { setSaving(false) }
  }

  const DiffBadge: React.FC<{ diff: number }> = ({ diff }) => (
    <span className="text-xs font-medium"
          style={{ color: Math.abs(diff) < 0.01 ? 'var(--color-success)' : diff > 0 ? 'var(--color-info)' : 'var(--color-danger)' }}>
      {diff >= 0 ? '+' : ''}{fmt(diff)}
    </span>
  )

  return (
    <div className="luma-surface p-6 flex flex-col gap-5 border-2" style={{ borderColor: 'var(--color-danger)' }}>
      <div className="flex items-center gap-3">
        <Lock size={20} style={{ color: 'var(--color-danger)' }} />
        <div>
          <h3 className="font-semibold font-display" style={{ color: 'var(--color-text)' }}>Cierre de caja</h3>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Ingresa los montos físicos contados</p>
        </div>
      </div>
      {error && (
        <div className="rounded-lg px-3 py-2 text-xs"
             style={{ background: 'color-mix(in srgb,var(--color-danger) 12%,transparent)', color: 'var(--color-danger)' }}>
          {error}
        </div>
      )}
      <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--color-border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
              {['Método', 'Sistema', 'Declarado', 'Diferencia'].map(h => (
                <th key={h} className="text-left px-4 py-2 text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { label: '💵 Efectivo',      system: systemCash,     declared: declaredCash,     diff: diffCash,     set: setDeclaredCash },
              { label: '💳 Tarjeta',       system: systemCard,     declared: declaredCard,     diff: diffCard,     set: setDeclaredCard },
              { label: '🔄 Transferencia', system: systemTransfer, declared: declaredTransfer, diff: diffTransfer, set: setDeclaredTransfer },
            ].map(row => (
              <tr key={row.label} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td className="px-4 py-2 text-xs" style={{ color: 'var(--color-text)' }}>{row.label}</td>
                <td className="px-4 py-2 text-right text-xs" style={{ color: 'var(--color-text-muted)' }}>{fmt(row.system)}</td>
                <td className="px-4 py-2 text-right">
                  <input type="number" min="0" step="0.01"
                    value={numVal(row.declared)}
                    onFocus={e => e.target.select()}
                    onChange={e => row.set(parseFloat(e.target.value) || 0)}
                    className="luma-input text-right text-sm w-28 py-1 inline-block" data-selectable />
                </td>
                <td className="px-4 py-2 text-right"><DiffBadge diff={row.diff} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(Math.abs(diffCash) > 0.01 || Math.abs(diffCard) > 0.01 || Math.abs(diffTransfer) > 0.01) && (
        <div className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs"
             style={{ background: 'color-mix(in srgb,var(--color-warning) 12%,transparent)', color: 'var(--color-warning)' }}>
          <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
          Existen diferencias entre el sistema y lo contado físicamente. Se guardarán en el historial.
        </div>
      )}
      <div>
        <label className="luma-label">Notas de cierre</label>
        <textarea rows={2} placeholder="Observaciones del turno..." value={notes}
          onChange={e => setNotes(e.target.value)} className="luma-input resize-none" data-selectable />
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="luma-btn-ghost">Cancelar</button>
        <button onClick={handleClose} disabled={saving}
          className="luma-btn text-white text-sm" style={{ background: 'var(--color-danger)' }}>
          {saving ? <><Loader2 size={14} className="animate-spin" /> Cerrando...</> : <><Lock size={14} /> Confirmar cierre</>}
        </button>
      </div>
    </div>
  )
}

// ── Historial de cajas ────────────────────────────────────────────────────────
const CashHistoryView: React.FC = () => {
  const [result, setResult]     = useState<PaginatedResult<CashRegister & { total_sales: number }> | null>(null)
  const [loading, setLoading]   = useState(true)
  const [page, setPage]         = useState(1)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await window.electronAPI.cash.listRegisters({ page, pageSize: 15, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined })
    if (res.ok) setResult(res.data as PaginatedResult<CashRegister & { total_sales: number }>)
    setLoading(false)
  }, [page, dateFrom, dateTo])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [dateFrom, dateTo])

  return (
    <div className="p-6 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <CalendarRange size={16} style={{ color: 'var(--color-text-muted)' }} />
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="luma-input w-40 text-sm" />
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>a</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="luma-input w-40 text-sm" />
        <button onClick={load} className="luma-btn-ghost p-2">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading ? <div className="flex justify-center py-12"><Spinner size={32} /></div> : (
        <div className="luma-surface overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                {['Apertura', 'Cierre', 'Abierta por', 'Saldo inicial', 'Total ventas', 'Estado', 'Cuadre'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium"
                      style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result?.items.map((reg, i) => {
                const hasDiff = reg.status === 'closed' &&
                  (Math.abs(reg.diff_cash ?? 0) > 0.01 || Math.abs(reg.diff_card ?? 0) > 0.01 || Math.abs(reg.diff_transfer ?? 0) > 0.01)
                return (
                  <tr key={reg.id} className="hover:bg-white/5"
                      style={{ borderBottom: i < result.items.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text)' }}>
                      {new Date(reg.opened_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {reg.closed_at ? new Date(reg.closed_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>{reg.opened_by_username}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text)' }}>{fmt(reg.initial_cash)}</td>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-accent)' }}>
                      {fmt((reg as CashRegister & { total_sales: number }).total_sales)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={reg.status === 'open' ? 'success' : 'muted'}>
                        {reg.status === 'open' ? '🟢 Abierta' : '⚫ Cerrada'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {reg.status === 'closed'
                        ? hasDiff
                          ? <Badge variant="warning"><AlertCircle size={10} /> Con diferencias</Badge>
                          : <Badge variant="success"><CheckCircle2 size={10} /> Cuadrada</Badge>
                        : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {result && <Paginator page={page} pageSize={15} total={result.total} onChange={setPage} />}
        </div>
      )}
    </div>
  )
}
