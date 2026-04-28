import React, { useState, useEffect, useCallback } from 'react'
import {
  ShoppingCart, Plus, Trash2, Users, Receipt, Check,
  AlertCircle, Loader2, FileText, X, UserRound, Crown,
  Search, HelpCircle, Percent,
} from 'lucide-react'
import type {
  Service, Client, Employee, CashRegister,
  CreateInvoicePayload, PaymentMethod, Invoice, PaginatedResult, CommissionMode,
} from '../types'
import { PageHeader, Badge, Spinner, Paginator } from '../components/ui/index'
import { Autocomplete } from '../components/pos/Autocomplete'
import { Modal } from '../components/ui/Modal'

interface CartEmployee { employee_id: number; full_name: string; commission_pct: number; work_split_pct?: number }
interface CartLine {
  _key: string
  service_id: number; service_name: string; unit_price: number
  quantity: number; line_total: number
  owner_employee_id: number | null; owner_name: string | null
  employees: CartEmployee[]; showEmployees: boolean
}
interface PaymentLine { method: PaymentMethod; amount: number; reference: string }

const fmt = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: '💵 Efectivo', card: '💳 Tarjeta', transfer: '🔄 Transferencia',
}
const numVal = (n: number) => n === 0 ? '' : String(n)

// ── Borrador de venta en curso ────────────────────────────────────────────────
const DRAFT_KEY = 'luma_pos_draft'

interface PosDraft {
  cart:            CartLine[]
  client:          { id: number; label: string } | null
  payments:        PaymentLine[]
  requiresInvoice: boolean
  notes:           string
}

const loadDraft = (): PosDraft | null => {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? (JSON.parse(raw) as PosDraft) : null
  } catch { return null }
}

const saveDraft = (draft: PosDraft) => {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)) } catch { /* sin-op */ }
}

const clearDraft = () => {
  try { localStorage.removeItem(DRAFT_KEY) } catch { /* sin-op */ }
}

// ── Vista principal ───────────────────────────────────────────────────────────
export const PosPage: React.FC = () => {
  const [tab, setTab] = useState<'sale' | 'history'>('sale')

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'F2') { e.preventDefault(); setTab('sale') } }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Punto de Venta"
        subtitle="F2 = Nueva venta  |  Esc = Limpiar"
        icon={<ShoppingCart size={18} />}
        actions={
          <div className="flex gap-2">
            {(['sale', 'history'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className="luma-btn text-xs px-3 py-1.5"
                style={{
                  background: tab === t ? 'var(--color-accent)' : 'transparent',
                  color:      tab === t ? 'white' : 'var(--color-text-muted)',
                  border:     `1px solid ${tab === t ? 'var(--color-accent)' : 'var(--color-border)'}`,
                }}>
                {t === 'sale' ? <><ShoppingCart size={13} /> Nueva venta</> : <><FileText size={13} /> Historial</>}
              </button>
            ))}
          </div>
        }
      />
      <div className="flex-1 overflow-hidden">
        {tab === 'sale' ? <SaleView /> : <InvoiceHistoryView />}
      </div>
    </div>
  )
}

// ── Vista de venta ────────────────────────────────────────────────────────────
const SaleView: React.FC = () => {
  // Restaurar borrador si existe (persiste navegación entre secciones)
  const _draft = loadDraft()

  const [cart, setCart]              = useState<CartLine[]>(_draft?.cart ?? [])
  const [client, setClient]          = useState<{ id: number; label: string } | null>(_draft?.client ?? null)
  const [openRegister, setOpenReg]   = useState<CashRegister | null>(null)
  const [taxRate, setTaxRate]        = useState(0)
  const [commissionMode, setCommissionMode] = useState<CommissionMode>('simple')
  const [overheadPct, setOverheadPct] = useState(0)
  const [payments, setPayments]      = useState<PaymentLine[]>(_draft?.payments ?? [{ method: 'cash', amount: 0, reference: '' }])
  const [requiresInvoice, setReqInv] = useState(_draft?.requiresInvoice ?? false)
  const [notes, setNotes]            = useState(_draft?.notes ?? '')
  const [saving, setSaving]          = useState(false)
  const [error, setError]            = useState<string | null>(null)
  const [successFolio, setSuccess]   = useState<string | null>(null)
  const [allEmployees, setAllEmp]    = useState<Employee[]>([])
  const [confirmNoClient, setConfirmNoClient] = useState(false)
  const [hasDraft, setHasDraft]      = useState(!!_draft && (_draft.cart.length > 0 || !!_draft.client))

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClear() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  useEffect(() => {
    Promise.all([
      window.electronAPI.cash.getOpen(),
      window.electronAPI.invoices.getTaxRate(),
      window.electronAPI.employees.all(),
      window.electronAPI.settings.getAll(),
    ]).then(([cashRes, taxRes, empRes, settingsRes]) => {
      if (cashRes.ok) setOpenReg(cashRes.data as CashRegister)
      if (taxRes.ok)  setTaxRate(taxRes.data as number)
      if (empRes.ok)  setAllEmp(empRes.data as Employee[])
      if (settingsRes.ok) {
        const d = settingsRes.data as Record<string, string>
        setCommissionMode((d.commission_mode ?? 'simple') as CommissionMode)
        setOverheadPct(parseFloat(d.overhead_pct ?? '0'))
      }
    })
  }, [])

  const subtotal      = cart.reduce((s, l) => s + l.line_total, 0)
  const effectiveTax  = requiresInvoice ? taxRate : 0
  const taxAmount     = subtotal * (effectiveTax / 100)
  const total         = subtotal + taxAmount
  const paymentsTotal = payments.reduce((s, p) => s + (p.amount || 0), 0)
  const remaining     = total - paymentsTotal
  const paymentOk     = Math.abs(remaining) < 0.02

  // ── Persistir borrador automáticamente al cambiar cualquier campo relevante ────
  useEffect(() => {
    if (cart.length > 0 || client !== null) {
      saveDraft({ cart, client, payments, requiresInvoice, notes })
      setHasDraft(true)
    }
  }, [cart, client, payments, requiresInvoice, notes])

  useEffect(() => {
    if (cart.length > 0 && payments.length === 1 && payments[0].amount === 0) {
      setPayments([{ method: 'cash', amount: total, reference: '' }])
    }
  }, [total])

  const addService = (svc: Service) =>
    setCart(prev => [...prev, {
      _key: `${svc.id}_${Date.now()}`,
      service_id: svc.id, service_name: svc.name,
      unit_price: svc.price, quantity: 1, line_total: svc.price,
      owner_employee_id: svc.owner_employee_id,
      owner_name: svc.owner_name ?? null,
      employees: [], showEmployees: false,
    }])

  const removeService   = (key: string) => setCart(prev => prev.filter(l => l._key !== key))
  const toggleEmployees = (key: string) => setCart(prev => prev.map(l => l._key === key ? { ...l, showEmployees: !l.showEmployees } : l))
  const updateQty       = (key: string, qty: number) =>
    setCart(prev => prev.map(l => l._key !== key ? l : { ...l, quantity: Math.max(1, qty), line_total: l.unit_price * Math.max(1, qty) }))
  const addEmployee     = (lineKey: string, emp: Employee) =>
    setCart(prev => prev.map(l => {
      if (l._key !== lineKey || l.employees.find(e => e.employee_id === emp.id) || l.owner_employee_id === emp.id) return l
      return { ...l, employees: [...l.employees, { employee_id: emp.id, full_name: emp.full_name ?? `${emp.first_name} ${emp.last_name}`, commission_pct: emp.commission_pct }] }
    }))
  const removeEmployee = (lineKey: string, empId: number) =>
    setCart(prev => prev.map(l => l._key !== lineKey ? l : { ...l, employees: l.employees.filter(e => e.employee_id !== empId) }))

  const updateWorkSplit = (lineKey: string, empId: number, pct: number) =>
    setCart(prev => prev.map(l => {
      if (l._key !== lineKey) return l
      return { ...l, employees: l.employees.map(e => e.employee_id === empId ? { ...e, work_split_pct: pct } : e) }
    }))

  const usedMethods      = payments.map(p => p.method)
  const availableMethods = (['cash', 'card', 'transfer'] as PaymentMethod[]).filter(m => !usedMethods.includes(m))
  const addPayment       = () => { if (availableMethods.length === 0) return; setPayments(prev => [...prev, { method: availableMethods[0], amount: remaining > 0 ? remaining : 0, reference: '' }]) }
  const removePayment    = (i: number) => setPayments(prev => prev.filter((_, idx) => idx !== i))
  const updatePayment    = (i: number, field: keyof PaymentLine, val: PaymentMethod | number | string) =>
    setPayments(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: val } : p))

  // ── handleClear NO toca successFolio — ese se limpia solo o al iniciar nueva venta ──
  const handleClear = () => {
    setCart([]); setClient(null)
    setPayments([{ method: 'cash', amount: 0, reference: '' }])
    setReqInv(false); setNotes(''); setError(null)
    clearDraft(); setHasDraft(false)
    // NOTA: setSuccess(null) NO se llama aquí → el banner permanece visible
  }

  // Limpiar TODO (incluyendo banner éxito) al iniciar manualmente una nueva venta
  const handleNewSale = () => { handleClear(); setSuccess(null) }

  const validateAndConfirm = () => {
    setError(null)
    if (cart.length === 0) { setError('Agrega al menos un servicio.'); return }
    for (const line of cart) {
      if (line.employees.length === 0 && !line.owner_employee_id) {
        setError(`"${line.service_name}" no tiene empleado ni jefe. Asigna al menos uno.`); return
      }

      // Validar que la suma de participaciones sea 100% en Modo C
      if (commissionMode === 'manual' && line.employees.length > 0) {
        const totalSplit = line.employees.reduce((s, e) => s + (e.work_split_pct ?? (100 / line.employees.length)), 0)
        if (Math.abs(totalSplit - 100) > 0.5) {
          setError(`La participación en "${line.service_name}" debe sumar 100% (actual: ${totalSplit.toFixed(1)}%).`)
          return
        }
      }
    }
    if (!paymentOk) { setError(`Falta ${fmt(remaining)} por asignar al método de pago.`); return }
    if (!client) { setConfirmNoClient(true); return }
    doSave()
  }

  const doSave = async () => {
    setConfirmNoClient(false)
    setSaving(true); setError(null)
    const payload: CreateInvoicePayload = {
      register_id:               openRegister?.id ?? null,
      client_id:                 client?.id ?? null,
      requires_official_invoice: requiresInvoice,
      apply_tax:                 requiresInvoice,
      notes:                     notes || null,
      services: cart.map(l => ({
        service_id: l.service_id, service_name: l.service_name,
        unit_price: l.unit_price, quantity: l.quantity,
        employee_ids: l.employees.map(e => e.employee_id),
        // Modo C: enviar work_splits si el modo es manual
        ...(commissionMode === 'manual' && l.employees.length > 0
          ? { work_splits: l.employees.map(e => e.work_split_pct ?? (100 / l.employees.length)) }
          : {}),
      })),
      payments: payments.filter(p => p.amount > 0).map(p => ({
        payment_method: p.method, amount: p.amount, reference: p.reference || undefined,
      })),
    }
    try {
      const res = await window.electronAPI.invoices.create(payload)
      if (!res.ok) { setError(res.error ?? 'Error al crear la factura'); return }
      // ── FIX: primero mostrar el folio, luego limpiar el carrito ────────
      // handleClear() NO borra successFolio, así el banner queda visible
      const folio = (res.data as { folio: string }).folio
      clearDraft()           // borrar borrador al confirmar venta exitosa
      handleClear()          // limpia carrito, pagos, etc. (no el banner)
      setSuccess(folio)      // setSuccess DESPUÉS de handleClear → no se pisa
    } catch (e) { setError(String(e)) }
    finally { setSaving(false) }
  }

  const getAvailableEmployees = (line: CartLine) =>
    allEmployees.filter(e => e.id !== line.owner_employee_id && !line.employees.find(ae => ae.employee_id === e.id))

  return (
    <>
      <Modal isOpen={confirmNoClient} onClose={() => setConfirmNoClient(false)}
        title="¿Continuar sin cliente?" width="sm">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 text-sm" style={{ color: 'var(--color-text)' }}>
            <HelpCircle size={20} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--color-warning)' }} />
            <div>
              <p className="font-medium mb-1">No se seleccionó ningún cliente.</p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                La venta se registrará como <strong>Público General</strong> y no se actualizará
                el historial ni el contador de visitas de ningún cliente.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <button onClick={() => setConfirmNoClient(false)} className="luma-btn-ghost">
              Volver y seleccionar cliente
            </button>
            <button onClick={doSave} className="luma-btn-primary">Continuar sin cliente</button>
          </div>
        </div>
      </Modal>

      <div className="flex h-full overflow-hidden">
        {/* Panel izquierdo */}
        <div className="flex-1 flex flex-col overflow-hidden border-r" style={{ borderColor: 'var(--color-border)' }}>
          <div className="p-4 border-b flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
            {/* Banner de Modo de Comisión */}
            <div className="mt-3 mb-4 flex items-center gap-2 px-3 py-2 rounded-lg border text-[10px] uppercase font-bold tracking-wider"
                 style={{ 
                   borderColor: 'var(--color-border)',
                   background: 'var(--color-surface-2)',
                   color: 'var(--color-text-muted)'
                 }}>
              <Percent size={12} style={{ color: 'var(--color-accent)' }} />
              <span>Modo activo: </span>
              <span style={{ color: 'var(--color-accent)' }}>
                {commissionMode === 'simple' && 'Modo A — Simple'}
                {commissionMode === 'proportional' && 'Modo B — Proporcional Automático'}
                {commissionMode === 'manual' && `Modo C — Manual (${overheadPct}% Overhead)`}
              </span>
            </div>
            
            <Autocomplete
              placeholder="Buscar servicio por nombre..."
              icon={<ShoppingCart size={14} />}
              onSearch={async (q) => {
                const res = await window.electronAPI.services.list({ page: 1, pageSize: 10, search: q })
                if (!res.ok) return []
                return (res.data as { items: Service[] }).items.map(s => ({
                  id: s.id, label: s.name,
                  sublabel: `${fmt(s.price)} · ${s.duration_min}min · ${s.category_name}${s.owner_name ? ` · 👑 ${s.owner_name}` : ''}`,
                }))
              }}
              onSelect={async (opt) => {
                const res = await window.electronAPI.services.all()
                const svc = (res.ok ? (res.data as Service[]) : []).find(s => s.id === opt.id)
                if (svc) addService(svc)
              }}
            />

            
          </div>

          

          {/* ── Banner de éxito — persiste hasta que el cajero empiece otra venta ── */}
          {successFolio && (
            <div className="mx-4 mt-3 rounded-lg px-4 py-3 flex items-center justify-between text-sm animate-fade-in"
                 style={{ background: 'color-mix(in srgb,var(--color-success) 15%,transparent)', color: 'var(--color-success)' }}>
              <span className="flex items-center gap-2">
                <Check size={16} />
                ¡Venta registrada! Folio: <strong>{successFolio}</strong>
              </span>
              <button onClick={() => setSuccess(null)} className="opacity-60 hover:opacity-100">
                <X size={14} />
              </button>
            </div>
          )}

          {/* Banner de error */}
          {error && (
            <div className="mx-4 mt-3 rounded-lg px-4 py-3 flex items-center gap-2 text-sm animate-fade-in"
                 style={{ background: 'color-mix(in srgb,var(--color-danger) 12%,transparent)', color: 'var(--color-danger)' }}>
              <AlertCircle size={15} />{error}
            </div>
          )}

          <div className="flex-1 overflow-auto p-4 flex flex-col gap-3">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center"
                   style={{ color: 'var(--color-text-muted)' }}>
                <ShoppingCart size={40} strokeWidth={1} />
                <p className="text-sm">
                  Busca y agrega servicios arriba<br />
                  o presiona <kbd className="px-1.5 py-0.5 rounded text-xs border" style={{ borderColor: 'var(--color-border)' }}>F2</kbd>
                </p>
                {/* Si hay folio de éxito reciente, mostrar botón para nueva venta */}
                {successFolio && (
                  <button onClick={handleNewSale} className="luma-btn-primary text-sm">
                    <Plus size={14} /> Nueva venta
                  </button>
                )}
              </div>
            ) : cart.map(line => (
              <CartLineCard key={line._key} line={line}
                availableEmployees={getAvailableEmployees(line)}
                onRemove={() => removeService(line._key)}
                onUpdateQty={q => updateQty(line._key, q)}
                onToggleEmployees={() => toggleEmployees(line._key)}
                onAddEmployee={emp => addEmployee(line._key, emp)}
                onRemoveEmployee={id => removeEmployee(line._key, id)}
                onUpdateWorkSplit={(empId, pct) => updateWorkSplit(line._key, empId, pct)}
                commissionMode={commissionMode}
                overheadPct={overheadPct}
              />
            ))}
          </div>
        </div>

        {/* Panel derecho */}
        <div className="w-80 flex flex-col overflow-hidden flex-shrink-0">
          <div className="p-4 border-b flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
            <label className="luma-label mb-1">Cliente <span style={{ color: 'var(--color-text-muted)' }}>(opcional)</span></label>
            <Autocomplete placeholder="Buscar cliente..." icon={<UserRound size={14} />}
              selected={client} onClear={() => setClient(null)}
              onSearch={async (q) => {
                const res = await window.electronAPI.clients.search(q)
                if (!res.ok) return []
                return (res.data as Partial<Client>[]).map(c => ({
                  id: c.id!, label: `${c.first_name} ${c.last_name}`,
                  sublabel: c.phone ? `${c.phone_country} ${c.phone}` : c.email ?? undefined,
                }))
              }}
              onSelect={opt => setClient(opt)}
            />
            {!client && cart.length > 0 && (
              <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
                <AlertCircle size={11} /> Se registrará como Público General
              </p>
            )}
          </div>

          <div className="p-4 border-b flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex flex-col gap-1.5">
              <Row label="Subtotal" value={fmt(subtotal)} />
              {requiresInvoice
                ? <Row label={`IVA (${taxRate}%)`} value={fmt(taxAmount)} muted />
                : <Row label="IVA" value="No aplica" muted />
              }
              <div className="h-px my-1" style={{ background: 'var(--color-border)' }} />
              <Row label="Total" value={fmt(total)} accent bold />
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Método de pago</span>
              {availableMethods.length > 0 && (
                <button onClick={addPayment} className="text-xs luma-btn-ghost py-0.5 px-2">
                  <Plus size={11} /> Mixto
                </button>
              )}
            </div>

            {payments.map((pmt, i) => {
              const otherUsed     = payments.filter((_, idx) => idx !== i).map(p => p.method)
              const optionsForThis = (['cash', 'card', 'transfer'] as PaymentMethod[]).filter(m => !otherUsed.includes(m))
              return (
                <div key={i} className="flex flex-col gap-2 p-3 rounded-xl border"
                     style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)' }}>
                  <div className="flex gap-2 items-center">
                    <select value={pmt.method}
                      onChange={e => updatePayment(i, 'method', e.target.value as PaymentMethod)}
                      className="luma-input flex-1 text-xs py-1.5">
                      {optionsForThis.map(m => <option key={m} value={m}>{PAYMENT_LABELS[m]}</option>)}
                    </select>
                    {payments.length > 1 && (
                      <button onClick={() => removePayment(i)} className="luma-btn-ghost p-1 rounded" style={{ color: 'var(--color-danger)' }}>
                        <X size={13} />
                      </button>
                    )}
                  </div>
                  <input type="number" min="0" step="0.01" placeholder="0.00"
                    value={numVal(pmt.amount)}
                    onFocus={e => e.target.select()}
                    onChange={e => updatePayment(i, 'amount', parseFloat(e.target.value) || 0)}
                    className="luma-input text-sm font-bold" data-selectable />
                  {pmt.method !== 'cash' && (
                    <input type="text" placeholder="Referencia / últimos 4 dígitos"
                      value={pmt.reference} onChange={e => updatePayment(i, 'reference', e.target.value)}
                      className="luma-input text-xs" data-selectable />
                  )}
                </div>
              )
            })}

            {paymentsTotal > 0 && (
              <div className="rounded-lg px-3 py-2 text-sm flex items-center justify-between"
                   style={{
                     background: paymentOk ? 'color-mix(in srgb,var(--color-success) 12%,transparent)' : 'color-mix(in srgb,var(--color-warning) 12%,transparent)',
                     color:      paymentOk ? 'var(--color-success)' : 'var(--color-warning)',
                   }}>
                <span>{remaining < 0 ? 'Cambio:' : remaining > 0 ? 'Falta:' : '✓ Exacto'}</span>
                {remaining !== 0 && <strong>{fmt(Math.abs(remaining))}</strong>}
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--color-text-muted)' }}>
                <input type="checkbox" checked={requiresInvoice} onChange={e => setReqInv(e.target.checked)} />
                <Receipt size={12} /> Requiere factura oficial (aplica IVA)
              </label>
            </div>

            <div>
              <label className="luma-label">Notas</label>
              <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Observaciones..." className="luma-input resize-none text-xs" data-selectable />
            </div>

            {!openRegister && (
              <div className="text-xs rounded-lg px-3 py-2 flex items-start gap-2"
                   style={{ background: 'color-mix(in srgb,var(--color-warning) 12%,transparent)', color: 'var(--color-warning)' }}>
                <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
                Sin caja abierta. La venta se registrará sin asociar a caja.
              </div>
            )}
          </div>

          <div className="p-4 border-t flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
            <button onClick={validateAndConfirm} disabled={saving || cart.length === 0}
              className="luma-btn-primary w-full justify-center py-3 text-base"
              style={{ opacity: saving || cart.length === 0 ? 0.5 : 1 }}>
              {saving
                ? <><Loader2 size={18} className="animate-spin" /> Procesando...</>
                : <><Check size={18} /> Confirmar venta · {fmt(total)}</>}
            </button>
            {cart.length > 0 && (
              <button onClick={handleNewSale} className="luma-btn-ghost w-full justify-center mt-2 text-xs">
                <X size={13} /> Limpiar (Esc)
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ── CartLineCard ──────────────────────────────────────────────────────────────
const CartLineCard: React.FC<{
  line: CartLine; availableEmployees: Employee[]
  onRemove: () => void; onUpdateQty: (q: number) => void
  onToggleEmployees: () => void; onAddEmployee: (emp: Employee) => void
  onRemoveEmployee: (id: number) => void
  onUpdateWorkSplit: (empId: number, pct: number) => void
  commissionMode: CommissionMode
  overheadPct: number
}> = ({ line, availableEmployees, onRemove, onUpdateQty, onToggleEmployees, onAddEmployee, onRemoveEmployee, onUpdateWorkSplit, commissionMode, overheadPct }) => {
  const isValid = !!line.owner_employee_id || line.employees.length > 0
  return (
    <div className="luma-surface p-3 flex flex-col gap-2">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <p className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>{line.service_name}</p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {fmt(line.unit_price)} × {line.quantity} = <strong style={{ color: 'var(--color-accent)' }}>{fmt(line.line_total)}</strong>
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => onUpdateQty(line.quantity - 1)} className="luma-btn-ghost p-1 rounded text-xs">−</button>
          <input type="number" min="1" value={line.quantity === 0 ? '' : line.quantity}
            onFocus={e => e.target.select()}
            onChange={e => onUpdateQty(parseInt(e.target.value) || 1)}
            className="w-10 text-center text-xs luma-input py-1 px-0" data-selectable />
          <button onClick={() => onUpdateQty(line.quantity + 1)} className="luma-btn-ghost p-1 rounded text-xs">+</button>
        </div>
        <button onClick={onRemove} className="luma-btn-ghost p-1 rounded" style={{ color: 'var(--color-danger)' }}>
          <Trash2 size={13} />
        </button>
      </div>

      {line.owner_name && (
        <div className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-lg"
             style={{ background: 'color-mix(in srgb,var(--color-accent) 10%,transparent)', color: 'var(--color-accent)' }}>
          <Crown size={11} />
          <span>Jefe: <strong>{line.owner_name}</strong> — recibe el resto de la comisión</span>
        </div>
      )}

      {!isValid && (
        <div className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg"
             style={{ background: 'color-mix(in srgb,var(--color-danger) 10%,transparent)', color: 'var(--color-danger)' }}>
          <AlertCircle size={11} /> Asigna al menos un empleado auxiliar
        </div>
      )}

      <button onClick={onToggleEmployees}
        className="flex items-center gap-1.5 text-xs w-full px-2 py-1.5 rounded-lg border"
        style={{
          borderColor: line.employees.length > 0 ? 'var(--color-info)' : 'var(--color-border)',
          color:       line.employees.length > 0 ? 'var(--color-info)' : 'var(--color-text-muted)',
          background: 'transparent',
        }}>
        <Users size={12} />
        {line.employees.length === 0 ? 'Agregar empleado auxiliar (opcional)' : `${line.employees.length} auxiliar(es)`}
        <span className="ml-auto">{line.showEmployees ? '▲' : '▼'}</span>
      </button>

      {line.showEmployees && (
        <div className="flex flex-col gap-2 pl-2 border-l-2" style={{ borderColor: 'var(--color-border)' }}>
          {/* Modo B: badge informativo del factor automático */}
          {commissionMode === 'proportional' && line.employees.length > 1 && (
            <div className="text-xs px-2 py-1 rounded-lg"
                 style={{ background: 'color-mix(in srgb,var(--color-info) 10%,transparent)', color: 'var(--color-info)' }}>
              Factor automático: {(100 / line.employees.length).toFixed(1)}% por colaborador
            </div>
          )}
          {/* Validación Modo C: suma de splits debe ser 100 */}
          {commissionMode === 'manual' && line.employees.length > 0 && (() => {
            const total = line.employees.reduce((s, e) => s + (e.work_split_pct ?? (100 / line.employees.length)), 0)
            return Math.abs(total - 100) > 0.5 ? (
              <div className="text-xs px-2 py-1 rounded-lg"
                   style={{ background: 'color-mix(in srgb,var(--color-warning) 10%,transparent)', color: 'var(--color-warning)' }}>
                La participación debe sumar 100% (actual: {total.toFixed(1)}%)
              </div>
            ) : null
          })()}
          {line.employees.map(emp => {
            const defaultSplit = line.employees.length > 0 ? parseFloat((100 / line.employees.length).toFixed(1)) : 100
            const split = emp.work_split_pct ?? defaultSplit
            const factor = commissionMode === 'proportional' && line.employees.length > 1
              ? 1 / line.employees.length
              : commissionMode === 'manual' ? split / 100 : 1
            
            // Aplicar overhead solo en Modo C (manual) para el preview
            const baseTotal = commissionMode === 'manual' ? line.line_total * (1 - overheadPct / 100) : line.line_total
            const effectiveAmount = baseTotal * (emp.commission_pct / 100) * factor
            
            return (
              <div key={emp.employee_id} className="flex items-center gap-2">
                <span className="text-xs flex-1" style={{ color: 'var(--color-text)' }}>
                  {emp.full_name}<span className="ml-1" style={{ color: 'var(--color-text-muted)' }}>({emp.commission_pct}%)</span>
                </span>
                {/* Modo C: input de participación */}
                {commissionMode === 'manual' && (
                  <div className="flex items-center gap-1">
                    <input
                      type="number" min="1" max="100" step="1"
                      value={split}
                      onFocus={e => e.target.select()}
                      onChange={e => onUpdateWorkSplit(emp.employee_id, parseFloat(e.target.value) || 0)}
                      className="w-14 text-center text-xs luma-input py-1 px-1"
                      data-selectable
                    />
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>%</span>
                  </div>
                )}
                <span className="text-xs font-medium" style={{ color: 'var(--color-success)' }}>
                  {fmt(effectiveAmount)}
                </span>
                <button onClick={() => onRemoveEmployee(emp.employee_id)}
                  className="luma-btn-ghost p-0.5 rounded" style={{ color: 'var(--color-danger)' }}>
                  <X size={11} />
                </button>
              </div>
            )
          })}
          {availableEmployees.length > 0 && (
            <select className="luma-input text-xs py-1" value=""
              onChange={e => {
                const emp = availableEmployees.find(em => em.id === parseInt(e.target.value))
                if (emp) onAddEmployee(emp)
              }}>
              <option value="">+ Agregar auxiliar...</option>
              {availableEmployees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name ?? `${emp.first_name} ${emp.last_name}`} — {emp.commission_pct}%
                </option>
              ))}
            </select>
          )}
        </div>
      )}
    </div>
  )
}

const Row: React.FC<{ label: string; value: string; muted?: boolean; accent?: boolean; bold?: boolean }> = ({ label, value, muted, accent, bold }) => (
  <div className="flex justify-between items-center">
    <span className="text-xs" style={{ color: muted ? 'var(--color-text-muted)' : 'var(--color-text)' }}>{label}</span>
    <span className={`text-sm ${bold ? 'font-bold' : ''}`}
          style={{ color: accent ? 'var(--color-accent)' : muted ? 'var(--color-text-muted)' : 'var(--color-text)' }}>
      {value}
    </span>
  </div>
)

// ── Historial de facturas ─────────────────────────────────────────────────────
const InvoiceHistoryView: React.FC = () => {
  const [result, setResult]           = useState<PaginatedResult<Invoice> | null>(null)
  const [loading, setLoading]         = useState(true)
  const [page, setPage]               = useState(1)
  const [pageSize, setPageSize]       = useState(20)
  const [filterStatus, setStatus]     = useState('')
  const [dateFrom, setDateFrom]       = useState('')
  const [dateTo, setDateTo]           = useState('')
  const [onlyOfficial, setOfficial]   = useState(false)
  const [clientSearch, setClientSrch] = useState('')
  const [sortBy, setSortBy]           = useState<'folio' | 'created_at'>('created_at')
  const [sortDir, setSortDir]         = useState<'asc' | 'desc'>('desc')
  const [detailInvoice, setDetail]    = useState<Invoice | null>(null)
  const [cancelModal, setCancelModal] = useState<Invoice | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling]     = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await window.electronAPI.invoices.list({
      page, pageSize, status: filterStatus || undefined,
      dateFrom: dateFrom || undefined, dateTo: dateTo || undefined,
      requiresOfficial: onlyOfficial || undefined,
      clientSearch: clientSearch || undefined,
      sortBy, sortDir,
    })
    if (res.ok) setResult(res.data as PaginatedResult<Invoice>)
    setLoading(false)
  }, [page, pageSize, filterStatus, dateFrom, dateTo, onlyOfficial, clientSearch, sortBy, sortDir])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [filterStatus, dateFrom, dateTo, onlyOfficial, clientSearch, pageSize])

  const toggleSort = (col: 'folio' | 'created_at') => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('desc') }
    setPage(1)
  }

  const SortIcon = ({ col }: { col: 'folio' | 'created_at' }) => {
    if (sortBy !== col) return <span style={{ opacity: 0.3, fontSize: 10 }}>↕</span>
    return <span style={{ fontSize: 10 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const openDetail = async (inv: Invoice) => {
    const res = await window.electronAPI.invoices.getById(inv.id)
    if (res.ok) setDetail(res.data as Invoice)
  }

  const handleCancel = async () => {
    if (!cancelModal) return
    setCancelling(true)
    const res = await window.electronAPI.invoices.cancel(cancelModal.id, cancelReason)
    setCancelling(false)
    if (res.ok) { setCancelModal(null); setCancelReason(''); load() }
  }

  return (
    <div className="p-6 flex flex-col gap-4 h-full overflow-hidden">
      <div className="flex items-center gap-3 flex-wrap">
        <select value={filterStatus} onChange={e => setStatus(e.target.value)} className="luma-input w-36 text-sm">
          <option value="">Todos los estados</option>
          <option value="paid">Pagadas</option>
          <option value="pending">Pendientes</option>
          <option value="cancelled">Canceladas</option>
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="luma-input w-40 text-sm" />
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>a</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="luma-input w-40 text-sm" />
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
          <input type="text" placeholder="Buscar cliente..." value={clientSearch}
            onChange={e => setClientSrch(e.target.value)}
            className="luma-input pl-8 w-44 text-sm" data-selectable />
        </div>
        <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--color-text-muted)' }}>
          <input type="checkbox" checked={onlyOfficial} onChange={e => setOfficial(e.target.checked)} />
          <Receipt size={12} /> Solo factura oficial
        </label>
        {/* Contador de registros */}
        {result && (
          <span className="ml-auto text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {result.total === 0
              ? 'Sin registros'
              : `${((page - 1) * pageSize) + 1}–${Math.min(page * pageSize, result.total)} de ${result.total} registro${result.total !== 1 ? 's' : ''}`
            }
          </span>
        )}
      </div>

      {loading ? <div className="flex justify-center py-12"><Spinner size={32} /></div> : (
        <div className="luma-surface flex flex-col overflow-hidden" style={{ minHeight: 0 }}>
          <div className="overflow-auto flex-1">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                {(['Folio', 'Cliente', 'Total', 'Estado', 'Fecha', 'Acciones'] as const).map(h => {
                  const col = h === 'Folio' ? 'folio' : h === 'Fecha' ? 'created_at' : null
                  return col ? (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium cursor-pointer select-none"
                        style={{ color: sortBy === col ? 'var(--color-accent)' : 'var(--color-text-muted)' }}
                        onClick={() => toggleSort(col)}>
                      <span className="inline-flex items-center gap-1">{h} <SortIcon col={col} /></span>
                    </th>
                  ) : (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {result?.items.map((inv, i) => (
                <tr key={inv.id} className="hover:bg-white/5 transition-colors"
                    style={{ borderBottom: i < result.items.length - 1 ? '1px solid var(--color-border)' : 'none', opacity: inv.status === 'cancelled' ? 0.5 : 1 }}>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--color-accent)' }}>{inv.folio}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text)' }}>
                    {inv.client_name ?? '— Público general'}
                    {Boolean(inv.requires_official_invoice) && (
                      <Badge variant="warning" className="ml-2">
                        <Receipt size={9} />
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-text)' }}>{fmt(inv.total)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={inv.status === 'paid' ? 'success' : inv.status === 'cancelled' ? 'danger' : 'warning'}>
                      {inv.status === 'paid' ? 'Pagada' : inv.status === 'cancelled' ? 'Cancelada' : 'Pendiente'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {new Date(inv.created_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => openDetail(inv)} className="luma-btn-ghost p-1.5 rounded-lg" title="Ver detalle">
                        <FileText size={13} />
                      </button>
                      {inv.status !== 'cancelled' && (
                        <button onClick={() => { setCancelModal(inv); setCancelReason('') }}
                          className="luma-btn-ghost p-1.5 rounded-lg" style={{ color: 'var(--color-danger)' }}>
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          {result && (
            <div className="px-4 py-2 border-t flex-shrink-0 flex items-center justify-between" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Filas por página:</span>
                <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))}
                  className="luma-input text-xs py-0.5 px-2 w-16">
                  {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <Paginator page={page} pageSize={pageSize} total={result.total} onChange={setPage} />
            </div>
          )}
        </div>
      )}

      <Modal isOpen={!!detailInvoice} onClose={() => setDetail(null)}
        title={`Factura ${detailInvoice?.folio}`}
        subtitle={`${fmt(detailInvoice?.total ?? 0)} · ${detailInvoice?.client_name ?? 'Público general'}`}
        width="xl">
        {detailInvoice && <InvoiceDetail invoice={detailInvoice} />}
      </Modal>

      <Modal isOpen={!!cancelModal} onClose={() => setCancelModal(null)}
        title="Cancelar factura" subtitle={cancelModal?.folio} width="sm">
        <div className="flex flex-col gap-4">
          <div className="text-xs rounded-lg px-3 py-2"
               style={{ background: 'color-mix(in srgb,var(--color-danger) 12%,transparent)', color: 'var(--color-danger)' }}>
            Esta acción no se puede deshacer. La factura quedará marcada como cancelada.
          </div>
          <div>
            <label className="luma-label">Motivo de cancelación</label>
            <textarea rows={3} value={cancelReason} onChange={e => setCancelReason(e.target.value)}
              placeholder="Describe el motivo..." className="luma-input resize-none" data-selectable />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setCancelModal(null)} className="luma-btn-ghost">Cancelar</button>
            <button onClick={handleCancel} disabled={cancelling}
              className="luma-btn text-white text-sm" style={{ background: 'var(--color-danger)' }}>
              {cancelling ? <><Loader2 size={14} className="animate-spin" /> Cancelando...</> : 'Confirmar cancelación'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

const InvoiceDetail: React.FC<{ invoice: Invoice }> = ({ invoice }) => (
  <div className="flex flex-col gap-4">
    <div className="flex items-center justify-between p-2 rounded-lg border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
       <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Esquema de Comisiones:</span>
       <Badge variant="info" className="text-[10px] uppercase">
         {invoice.commission_mode === 'simple' ? 'Modo A — Simple' : 
          invoice.commission_mode === 'proportional' ? 'Modo B — Proporcional' : 
          invoice.commission_mode === 'manual' ? 'Modo C — Manual' : 'Desconocido'}
       </Badge>
    </div>
    <div>
      <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>SERVICIOS</p>
      {invoice.services?.map(svc => (
        <div key={svc.id} className="mb-3 p-3 rounded-xl" style={{ background: 'var(--color-surface-2)' }}>
          <div className="flex justify-between text-sm mb-1">
            <span style={{ color: 'var(--color-text)' }}>{svc.service_name} × {svc.quantity}</span>
            <span style={{ color: 'var(--color-accent)' }}>{fmt(svc.line_total)}</span>
          </div>
          {svc.employees?.map(emp => (
            <div key={emp.id} className="text-xs flex justify-between pl-3 mt-1" style={{ color: 'var(--color-text-muted)' }}>
              <span>
                {(emp as typeof emp & { is_owner?: boolean }).is_owner
                  ? <><Crown size={10} className="inline mr-1" style={{ color: 'var(--color-accent)' }} />{emp.employee_name} (Jefe)</>
                  : <><Users size={10} className="inline mr-1" />{emp.employee_name} ({emp.commission_pct}%)</>}
              </span>
              <span style={{ color: 'var(--color-success)' }}>{fmt(emp.commission_amount)}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
    <div className="rounded-xl p-3 flex flex-col gap-1" style={{ background: 'var(--color-surface-2)' }}>
      <Row label="Subtotal" value={fmt(invoice.subtotal)} />
      {invoice.tax_rate > 0
        ? <Row label={`IVA (${invoice.tax_rate}%)`} value={fmt(invoice.tax_amount)} muted />
        : <Row label="IVA" value="No aplicado" muted />}
      <Row label="Total" value={fmt(invoice.total)} accent bold />
    </div>
    <div>
      <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>PAGOS</p>
      {invoice.payments?.map(p => (
        <div key={p.id} className="flex justify-between text-sm mb-1">
          <span style={{ color: 'var(--color-text)' }}>
            {PAYMENT_LABELS[p.payment_method]}
            {p.reference && <span className="text-xs ml-1" style={{ color: 'var(--color-text-muted)' }}>({p.reference})</span>}
          </span>
          <span style={{ color: 'var(--color-success)' }}>{fmt(p.amount)}</span>
        </div>
      ))}
    </div>
    {invoice.cancellation_reason && (
      <div className="text-xs rounded-lg px-3 py-2"
           style={{ background: 'color-mix(in srgb,var(--color-danger) 12%,transparent)', color: 'var(--color-danger)' }}>
        Cancelada: {invoice.cancellation_reason}
      </div>
    )}
  </div>
)
