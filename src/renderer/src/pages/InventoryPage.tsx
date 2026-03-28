import React, { useState, useEffect, useCallback } from 'react'
import {
  Package, Plus, Search, Pencil, Power, PowerOff, Loader2,
  RefreshCw, AlertTriangle, TrendingDown, ArrowUp, ArrowDown,
} from 'lucide-react'
import type { InventoryProduct, PaginatedResult } from '../types'
import { Modal }         from '../components/ui/Modal'
import { Badge, EmptyState, Paginator, PageHeader, Spinner, SearchInput } from '../components/ui/index'
import { InventoryForm } from '../components/inventory/InventoryForm'

const PAGE_SIZE = 15

const CONTAINER_LABELS: Record<string, string> = {
  bottle: '🧴 Botella', tube: '🪥 Tubo', jar: '🫙 Tarro',
  box: '📦 Caja', sachet: '🗂️ Sobre', unit: '🔵 Unidad',
}

export const InventoryPage: React.FC = () => {
  const [result, setResult]             = useState<PaginatedResult<InventoryProduct> | null>(null)
  const [loading, setLoading]           = useState(true)
  const [page, setPage]                 = useState(1)
  const [search, setSearch]             = useState('')
  const [lowStockOnly, setLowStock]     = useState(false)
  const [includeInactive, setInactive]  = useState(false)
  const [modalOpen, setModalOpen]       = useState(false)
  const [editing, setEditing]           = useState<InventoryProduct | null>(null)
  const [adjustModal, setAdjustModal]   = useState<InventoryProduct | null>(null)
  const [adjustDelta, setAdjustDelta]   = useState<number>(0)
  const [adjustNotes, setAdjustNotes]   = useState('')
  const [adjustSaving, setAdjustSaving] = useState(false)
  const [toggling, setToggling]         = useState<number | null>(null)
  const [error, setError]               = useState<string | null>(null)
  const [backendError, setBackendError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await window.electronAPI.inventory.list({ page, pageSize: PAGE_SIZE, search, lowStockOnly, includeInactive })
      if (res.ok) setResult(res.data as PaginatedResult<InventoryProduct>)
      else setError(res.error ?? 'Error desconocido')
    } catch (e) { setError(String(e)) }
    finally { setLoading(false) }
  }, [page, search, lowStockOnly, includeInactive])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [search, lowStockOnly, includeInactive])

  const openCreate = () => { setEditing(null); setBackendError(null); setModalOpen(true) }
  const openEdit   = (p: InventoryProduct) => { setEditing(p); setBackendError(null); setModalOpen(true) }
  const closeModal = () => { setModalOpen(false); setEditing(null) }

  const handleSave = async (data: Omit<InventoryProduct, 'id' | 'created_at' | 'updated_at' | 'low_stock'>) => {
    setBackendError(null)
    const res = editing
      ? await window.electronAPI.inventory.update(editing.id, data)
      : await window.electronAPI.inventory.create(data)
    if (!res.ok) { setBackendError(res.error ?? 'Error'); return }
    closeModal(); load()
  }

  const handleToggle = async (p: InventoryProduct) => {
    setToggling(p.id)
    await window.electronAPI.inventory.toggle(p.id)
    load(); setToggling(null)
  }

  const openAdjust = (p: InventoryProduct) => {
    setAdjustModal(p); setAdjustDelta(0); setAdjustNotes(''); setBackendError(null)
  }

  const handleAdjust = async () => {
    if (!adjustModal || adjustDelta === 0) return
    setAdjustSaving(true)
    const res = await window.electronAPI.inventory.adjustStock(adjustModal.id, adjustDelta, adjustNotes || undefined)
    setAdjustSaving(false)
    if (!res.ok) { setBackendError(res.error ?? 'Error'); return }
    setAdjustModal(null); load()
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Inventario"
        subtitle={result ? `${result.total} producto${result.total !== 1 ? 's' : ''}` : ''}
        icon={<Package size={18} />}
        actions={
          <button onClick={openCreate} className="luma-btn-primary">
            <Plus size={16} /> Nuevo producto
          </button>
        }
      />

      {/* Filtros */}
      <div className="flex items-center gap-3 px-6 py-3 border-b flex-shrink-0"
           style={{ borderColor: 'var(--color-border)' }}>
        <SearchInput icon={<Search size={14} />} placeholder="Buscar por nombre, SKU o proveedor..."
          value={search} onChange={e => setSearch(e.target.value)} className="w-72" />

        <label className="flex items-center gap-2 text-xs cursor-pointer"
               style={{ color: lowStockOnly ? 'var(--color-warning)' : 'var(--color-text-muted)' }}>
          <input type="checkbox" checked={lowStockOnly} onChange={e => setLowStock(e.target.checked)} />
          <AlertTriangle size={12} /> Solo stock bajo
        </label>
        <label className="flex items-center gap-2 text-xs cursor-pointer"
               style={{ color: 'var(--color-text-muted)' }}>
          <input type="checkbox" checked={includeInactive} onChange={e => setInactive(e.target.checked)} />
          Ver inactivos
        </label>
        <button onClick={load} className="luma-btn-ghost p-2 ml-auto">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4">
        {error && (
          <div className="rounded-lg px-4 py-3 text-sm mb-4"
               style={{ background: 'color-mix(in srgb,var(--color-danger) 12%,transparent)', color: 'var(--color-danger)' }}>
            {error}
          </div>
        )}

        {loading && !result ? (
          <div className="flex items-center justify-center py-20"><Spinner size={32} /></div>
        ) : result?.items.length === 0 ? (
          <EmptyState icon={<Package size={26} />} title="Sin productos"
            description={search ? 'No hay resultados.' : 'Agrega tu primer producto al inventario.'}
            action={!search
              ? <button onClick={openCreate} className="luma-btn-primary text-sm"><Plus size={14} /> Agregar producto</button>
              : undefined} />
        ) : (
          <>
            <div className="luma-surface overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    {['Producto', 'Envase', 'Proveedor', 'Costo', 'Venta', 'Stock', 'Estado', 'Acciones'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium"
                          style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result?.items.map((prod, i) => {
                    const isLow = prod.quantity <= prod.min_stock && prod.min_stock > 0
                    return (
                      <tr key={prod.id} className="transition-colors hover:bg-white/5"
                          style={{ borderBottom: i < result.items.length - 1 ? '1px solid var(--color-border)' : 'none', opacity: prod.is_active ? 1 : 0.5 }}>
                        <td className="px-4 py-3">
                          <p className="font-medium" style={{ color: 'var(--color-text)' }}>{prod.name}</p>
                          {prod.sku && <p className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>{prod.sku}</p>}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          {CONTAINER_LABELS[prod.container_type] ?? prod.container_type}
                          {prod.volume_ml && <span className="block">{prod.volume_ml} ml</span>}
                          {prod.pieces    && <span className="block">{prod.pieces} pza</span>}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>{prod.supplier ?? '—'}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          ${prod.cost_price.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-text)' }}>
                          ${prod.sale_price.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {isLow && <TrendingDown size={13} style={{ color: 'var(--color-warning)' }} />}
                            <span className="font-medium" style={{ color: isLow ? 'var(--color-warning)' : 'var(--color-text)' }}>
                              {prod.quantity}
                            </span>
                            {prod.min_stock > 0 && (
                              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>/ mín {prod.min_stock}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={prod.is_active ? 'success' : 'muted'}>
                            {prod.is_active ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button onClick={() => openAdjust(prod)} title="Ajustar stock"
                              className="luma-btn-ghost p-1.5 rounded-lg" style={{ color: 'var(--color-info)' }}>
                              <ArrowUp size={14} />
                            </button>
                            <button onClick={() => openEdit(prod)} title="Editar" className="luma-btn-ghost p-1.5 rounded-lg">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => handleToggle(prod)} disabled={toggling === prod.id}
                              className="luma-btn-ghost p-1.5 rounded-lg"
                              style={{ color: prod.is_active ? 'var(--color-danger)' : 'var(--color-success)' }}>
                              {toggling === prod.id ? <Spinner size={14} />
                                : prod.is_active ? <PowerOff size={14} /> : <Power size={14} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {result && <Paginator page={page} pageSize={PAGE_SIZE} total={result.total} onChange={setPage} />}
          </>
        )}
      </div>

      {/* Modal crear/editar */}
      <Modal isOpen={modalOpen} onClose={closeModal}
        title={editing ? 'Editar producto' : 'Nuevo producto'} subtitle={editing?.name} width="lg">
        {backendError && (
          <div className="rounded-lg px-4 py-3 text-sm mb-4"
               style={{ background: 'color-mix(in srgb,var(--color-danger) 12%,transparent)', color: 'var(--color-danger)' }}>
            {backendError}
          </div>
        )}
        <InventoryForm initial={editing} onSave={handleSave} onCancel={closeModal} />
      </Modal>

      {/* Modal ajuste de stock */}
      <Modal isOpen={!!adjustModal} onClose={() => setAdjustModal(null)}
        title="Ajustar stock" subtitle={adjustModal?.name} width="sm">
        <div className="flex flex-col gap-4">
          {backendError && (
            <div className="rounded-lg px-4 py-3 text-sm"
                 style={{ background: 'color-mix(in srgb,var(--color-danger) 12%,transparent)', color: 'var(--color-danger)' }}>
              {backendError}
            </div>
          )}
          <div className="text-center py-2">
            <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Stock actual</p>
            <p className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>{adjustModal?.quantity}</p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[-10, -5, -1, 1, 5, 10, 25, 50].map(d => (
              <button key={d} type="button" onClick={() => setAdjustDelta(prev => prev + d)}
                className="py-2 rounded-lg text-sm font-medium border transition-colors"
                style={{ borderColor: d > 0 ? 'var(--color-success)' : 'var(--color-danger)', color: d > 0 ? 'var(--color-success)' : 'var(--color-danger)', background: 'transparent' }}>
                {d > 0 ? '+' : ''}{d}
              </button>
            ))}
          </div>
          <div>
            <label className="luma-label">Ajuste manual (+ entrada / - salida)</label>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setAdjustDelta(p => p - 1)} className="luma-btn-ghost p-2 rounded-lg"><ArrowDown size={16} /></button>
              <input type="number" value={adjustDelta}
                onChange={e => setAdjustDelta(parseInt(e.target.value) || 0)}
                className="luma-input text-center text-lg font-bold flex-1" data-selectable />
              <button type="button" onClick={() => setAdjustDelta(p => p + 1)} className="luma-btn-ghost p-2 rounded-lg"><ArrowUp size={16} /></button>
            </div>
            {adjustModal && (
              <p className="text-xs mt-1 text-center"
                 style={{ color: (adjustModal.quantity + adjustDelta) < 0 ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
                Resultado: {adjustModal.quantity + adjustDelta} unidades
              </p>
            )}
          </div>
          <div>
            <label className="luma-label">Motivo del ajuste</label>
            <input type="text" placeholder="Ej. Compra a proveedor, consumo en servicio..."
              value={adjustNotes} onChange={e => setAdjustNotes(e.target.value)}
              className="luma-input" data-selectable />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <button onClick={() => setAdjustModal(null)} className="luma-btn-ghost">Cancelar</button>
            <button onClick={handleAdjust} disabled={adjustDelta === 0 || adjustSaving} className="luma-btn-primary">
              {adjustSaving ? <><Loader2 size={14} className="animate-spin" /> Guardando...</> : 'Confirmar ajuste'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
