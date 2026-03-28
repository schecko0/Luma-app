import React, { useState, useEffect } from 'react'
import { Save, Loader2, Plus, Minus } from 'lucide-react'
import type { InventoryProduct, ContainerType } from '../../types'

type ProductFormData = Omit<InventoryProduct, 'id' | 'created_at' | 'updated_at' | 'low_stock'>

const CONTAINER_TYPES: { value: ContainerType; label: string; emoji: string }[] = [
  { value: 'bottle',  label: 'Frasco/Botella', emoji: '🧴' },
  { value: 'tube',    label: 'Tubo',           emoji: '🪥' },
  { value: 'jar',     label: 'Tarro',          emoji: '🫙' },
  { value: 'box',     label: 'Caja',           emoji: '📦' },
  { value: 'sachet',  label: 'Sobre',          emoji: '🗂️' },
  { value: 'unit',    label: 'Pieza/Unidad',   emoji: '🔵' },
]

const EMPTY: ProductFormData = {
  name: '', supplier: null, sku: null, container_type: 'unit',
  volume_ml: null, pieces: null, cost_price: 0, sale_price: 0,
  quantity: 0, min_stock: 0, notes: null, photo_path: null, is_active: true,
}

interface Props {
  initial?: InventoryProduct | null
  onSave: (data: ProductFormData) => Promise<void>
  onCancel: () => void
}

export const InventoryForm: React.FC<Props> = ({ initial, onSave, onCancel }) => {
  const [form, setForm]     = useState<ProductFormData>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof ProductFormData, string>>>({})

  useEffect(() => {
    setForm(initial
      ? {
          name: initial.name, supplier: initial.supplier, sku: initial.sku,
          container_type: initial.container_type, volume_ml: initial.volume_ml,
          pieces: initial.pieces, cost_price: initial.cost_price,
          sale_price: initial.sale_price, quantity: initial.quantity,
          min_stock: initial.min_stock, notes: initial.notes,
          photo_path: initial.photo_path, is_active: initial.is_active,
        }
      : EMPTY)
    setErrors({})
  }, [initial])

  const set = <K extends keyof ProductFormData>(k: K, v: ProductFormData[K]) => {
    setForm(p => ({ ...p, [k]: v }))
    setErrors(p => ({ ...p, [k]: undefined }))
  }

  const validate = () => {
    const e: typeof errors = {}
    if (!form.name.trim())   e.name       = 'El nombre es requerido.'
    if (form.cost_price < 0) e.cost_price = 'No puede ser negativo.'
    if (form.sale_price < 0) e.sale_price = 'No puede ser negativo.'
    if (form.quantity < 0)   e.quantity   = 'No puede ser negativo.'
    if (form.min_stock < 0)  e.min_stock  = 'No puede ser negativo.'
    setErrors(e)
    return !Object.keys(e).length
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }

  const showVolume = ['bottle', 'tube', 'jar', 'sachet'].includes(form.container_type)
  const showPieces = ['box', 'unit'].includes(form.container_type)

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">

      {/* Nombre y SKU */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label className="luma-label">Nombre <span style={{ color: 'var(--color-danger)' }}>*</span></label>
          <input type="text" placeholder="Ej. Tinte Rubio Platino" value={form.name}
            onChange={e => set('name', e.target.value)} className="luma-input" />
          {errors.name && <p className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>{errors.name}</p>}
        </div>
        <div>
          <label className="luma-label">SKU / Código</label>
          <input type="text" placeholder="TRP-001" value={form.sku ?? ''}
            onChange={e => set('sku', e.target.value || null)} className="luma-input" />
        </div>
      </div>

      {/* Proveedor */}
      <div>
        <label className="luma-label">Proveedor</label>
        <input type="text" placeholder="Ej. L'Oréal México" value={form.supplier ?? ''}
          onChange={e => set('supplier', e.target.value || null)} className="luma-input" />
      </div>

      {/* Tipo de envase */}
      <div>
        <label className="luma-label">Tipo de envase</label>
        <div className="flex flex-wrap gap-2 mt-1">
          {CONTAINER_TYPES.map(ct => (
            <button key={ct.value} type="button" onClick={() => set('container_type', ct.value)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-all"
              style={{
                borderColor: form.container_type === ct.value ? 'var(--color-accent)' : 'var(--color-border)',
                background:  form.container_type === ct.value ? 'color-mix(in srgb,var(--color-accent) 12%,transparent)' : 'transparent',
                color:       form.container_type === ct.value ? 'var(--color-accent)' : 'var(--color-text-muted)',
              }}>
              {ct.emoji} {ct.label}
            </button>
          ))}
        </div>
      </div>

      {/* Volumen / Piezas */}
      {(showVolume || showPieces) && (
        <div className="grid grid-cols-2 gap-3">
          {showVolume && (
            <div>
              <label className="luma-label">Volumen (ml)</label>
              <input type="number" min="0" step="0.1" placeholder="500"
                value={form.volume_ml ?? ''}
                onChange={e => set('volume_ml', parseFloat(e.target.value) || null)}
                className="luma-input" />
            </div>
          )}
          {showPieces && (
            <div>
              <label className="luma-label">Piezas por unidad</label>
              <input type="number" min="1" step="1" placeholder="1"
                value={form.pieces ?? ''}
                onChange={e => set('pieces', parseInt(e.target.value) || null)}
                className="luma-input" />
            </div>
          )}
        </div>
      )}

      {/* Precios */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="luma-label">Precio de costo (MXN)</label>
          <input type="number" min="0" step="0.01" placeholder="0.00"
          
            value={form.cost_price === 0 ? '' : form.cost_price}
            onChange={e => set('cost_price', parseFloat(e.target.value) || 0)}
            className="luma-input" />
          {errors.cost_price && <p className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>{errors.cost_price}</p>}
        </div>
        <div>
          <label className="luma-label">Precio de venta (MXN)</label>
          <input type="number" min="0" step="0.01" placeholder="0.00"
            value={form.sale_price === 0 ? '' : form.sale_price}
            onChange={e => set('sale_price', parseFloat(e.target.value) || 0)}
            className="luma-input" />
          {form.cost_price > 0 && form.sale_price > 0 && (
            <p className="text-xs mt-1" style={{ color: 'var(--color-success)' }}>
              Margen: {(((form.sale_price - form.cost_price) / form.cost_price) * 100).toFixed(1)}%
            </p>
          )}
        </div>
      </div>

      {/* Stock */}
      <div
        className="rounded-xl p-4 border grid grid-cols-2 gap-3"
        style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)' }}
      >
        <div>
          <label className="luma-label">
            <Plus size={11} className="inline mr-1" />Cantidad actual
          </label>
          <input type="number" min="0" step="0.01" placeholder="0"
            value={form.quantity === 0 ? '' : form.quantity}
            onChange={e => set('quantity', parseFloat(e.target.value) || 0)}
            className="luma-input" />
          {errors.quantity && <p className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>{errors.quantity}</p>}
        </div>
        <div>
          <label className="luma-label">
            <Minus size={11} className="inline mr-1" />Stock mínimo (alerta)
          </label>
          <input type="number" min="0" step="0.01" placeholder="0"
            value={form.min_stock === 0 ? '' : form.min_stock}
            onChange={e => set('min_stock', parseFloat(e.target.value) || 0)}
            className="luma-input" />
          {form.min_stock > 0 && form.quantity <= form.min_stock && (
            <p className="text-xs mt-1" style={{ color: 'var(--color-warning)' }}>
              ⚠️ Stock actual por debajo del mínimo
            </p>
          )}
        </div>
      </div>

      {/* Notas */}
      <div>
        <label className="luma-label">Notas</label>
        <textarea rows={2} placeholder="Observaciones, instrucciones de uso..."
          value={form.notes ?? ''}
          onChange={e => set('notes', e.target.value || null)}
          className="luma-input resize-none" data-selectable />
      </div>

      {/* Acciones */}
      <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
        <button type="button" onClick={onCancel} className="luma-btn-ghost">Cancelar</button>
        <button type="submit" disabled={saving} className="luma-btn-primary">
          {saving
            ? <><Loader2 size={15} className="animate-spin" /> Guardando...</>
            : <><Save size={15} /> {initial ? 'Actualizar' : 'Crear producto'}</>}
        </button>
      </div>
    </form>
  )
}
