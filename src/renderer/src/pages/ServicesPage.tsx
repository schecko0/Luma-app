import React, { useState, useEffect, useCallback } from 'react'
import {
  Scissors, Plus, Search, Pencil, Power, PowerOff,
  RefreshCw, Tag, List, AlertCircle, Crown,
} from 'lucide-react'
import type { Service, ServiceCategory, Employee, PaginatedResult } from '../types'
import { Modal }        from '../components/ui/Modal'
import { Badge, EmptyState, Paginator, PageHeader, Spinner, SearchInput } from '../components/ui/index'
import { CategoryForm } from '../components/services/CategoryForm'
import { ServiceForm }  from '../components/services/ServiceForm'

type Tab = 'services' | 'categories'
const PAGE_SIZE = 15

const fmtDuration = (min: number) => {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60), m = min % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

export const ServicesPage: React.FC = () => {
  const [tab, setTab]                  = useState<Tab>('services')
  const [categories, setCategories]    = useState<ServiceCategory[]>([])
  const [owners, setOwners]            = useState<Employee[]>([])        // ← NUEVO: jefes activos
  const [result, setResult]            = useState<PaginatedResult<Service> | null>(null)
  const [loading, setLoading]          = useState(true)
  const [page, setPage]                = useState(1)
  const [search, setSearch]            = useState('')
  const [filterCat, setFilterCat]      = useState<number | undefined>()
  const [includeInactive, setInactive] = useState(false)
  const [modalOpen, setModalOpen]      = useState(false)
  const [editingService, setEditSvc]   = useState<Service | null>(null)
  const [editingCat, setEditCat]       = useState<ServiceCategory | null>(null)
  const [catModalOpen, setCatModal]    = useState(false)
  const [error, setError]              = useState<string | null>(null)
  const [toggling, setToggling]        = useState<number | null>(null)

  // Cargar categorías y owners en paralelo
  const loadCategories = useCallback(async () => {
    const res = await window.electronAPI.categories.list(true)
    if (res.ok) setCategories(res.data as ServiceCategory[])
  }, [])

  const loadOwners = useCallback(async () => {
    const res = await window.electronAPI.employees.all()
    if (res.ok) {
      // Filtrar solo los que tienen role = 'owner'
      const all = res.data as Employee[]
      setOwners(all.filter(e => e.role === 'owner'))
    }
  }, [])

  const loadServices = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await window.electronAPI.services.list({
        page, pageSize: PAGE_SIZE, search, categoryId: filterCat, includeInactive,
      })
      if (res.ok) setResult(res.data as PaginatedResult<Service>)
      else setError(res.error ?? 'Error desconocido')
    } catch (e) { setError(String(e)) }
    finally { setLoading(false) }
  }, [page, search, filterCat, includeInactive])

  useEffect(() => { loadCategories(); loadOwners() }, [loadCategories, loadOwners])
  useEffect(() => { if (tab === 'services') loadServices() }, [loadServices, tab])
  useEffect(() => { setPage(1) }, [search, filterCat, includeInactive])

  // ── Acciones servicios ──────────────────────────────────────────────
  const openCreateSvc = () => { setEditSvc(null); setModalOpen(true) }
  const openEditSvc   = (s: Service) => { setEditSvc(s); setModalOpen(true) }

  const handleSaveSvc = async (data: Omit<Service, 'id' | 'created_at' | 'updated_at' | 'category_name' | 'owner_name'>) => {
    const res = editingService
      ? await window.electronAPI.services.update(editingService.id, data)
      : await window.electronAPI.services.create(data)
    if (!res.ok) throw new Error(res.error)
    setModalOpen(false); setEditSvc(null); loadServices()
  }

  const handleToggleSvc = async (s: Service) => {
    setToggling(s.id)
    const res = await window.electronAPI.services.toggle(s.id)
    if (res.ok) loadServices()
    setToggling(null)
  }

  // ── Acciones categorías ─────────────────────────────────────────────
  const openCreateCat = () => { setEditCat(null); setCatModal(true) }
  const openEditCat   = (c: ServiceCategory) => { setEditCat(c); setCatModal(true) }

  const handleSaveCat = async (data: Omit<ServiceCategory, 'id' | 'created_at'>) => {
    const res = editingCat
      ? await window.electronAPI.categories.update(editingCat.id, data)
      : await window.electronAPI.categories.create(data)
    if (!res.ok) throw new Error(res.error)
    setCatModal(false); setEditCat(null); loadCategories()
  }

  const handleToggleCat = async (c: ServiceCategory) => {
    await window.electronAPI.categories.toggle(c.id)
    loadCategories()
  }

  const activeCats = categories.filter(c => c.is_active)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Servicios"
        subtitle="Catálogo de servicios y categorías"
        icon={<Scissors size={18} />}
        actions={
          tab === 'services'
            ? <button onClick={openCreateSvc} className="luma-btn-primary"><Plus size={16} /> Nuevo servicio</button>
            : <button onClick={openCreateCat} className="luma-btn-primary"><Plus size={16} /> Nueva categoría</button>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 px-6 pt-3 border-b flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
        {([['services', <List size={14} />, 'Servicios'], ['categories', <Tag size={14} />, 'Categorías']] as const).map(([t, icon, label]) => (
          <button key={t} onClick={() => setTab(t as Tab)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-all -mb-px"
            style={{
              borderColor: tab === t ? 'var(--color-accent)' : 'transparent',
              color:       tab === t ? 'var(--color-accent)' : 'var(--color-text-muted)',
            }}>
            {icon}{label}
          </button>
        ))}
      </div>

      {/* ── TAB: SERVICIOS ───────────────────────────────────────────── */}
      {tab === 'services' && (
        <>
          <div className="flex items-center gap-3 px-6 py-3 border-b flex-shrink-0"
               style={{ borderColor: 'var(--color-border)' }}>
            <SearchInput icon={<Search size={14} />} placeholder="Buscar servicio..."
              value={search} onChange={e => setSearch(e.target.value)} className="w-60" />
            <select value={filterCat ?? ''}
              onChange={e => setFilterCat(e.target.value ? parseInt(e.target.value) : undefined)}
              className="luma-input w-44 text-sm">
              <option value="">Todas las categorías</option>
              {activeCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <label className="flex items-center gap-2 text-xs cursor-pointer select-none"
                   style={{ color: 'var(--color-text-muted)' }}>
              <input type="checkbox" checked={includeInactive} onChange={e => setInactive(e.target.checked)} />
              Ver inactivos
            </label>
            <button onClick={loadServices} className="luma-btn-ghost p-2 ml-auto">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="flex-1 overflow-auto px-6 py-4">
            {error && (
              <div className="rounded-lg px-4 py-3 text-sm mb-4 flex items-center gap-2"
                   style={{ background: 'color-mix(in srgb,var(--color-danger) 12%,transparent)', color: 'var(--color-danger)' }}>
                <AlertCircle size={14} />{error}
              </div>
            )}
            {loading && !result ? (
              <div className="flex items-center justify-center py-20"><Spinner size={32} /></div>
            ) : result?.items.length === 0 ? (
              <EmptyState icon={<Scissors size={26} />} title="Sin servicios"
                description="Crea tu primer servicio para comenzar."
                action={<button onClick={openCreateSvc} className="luma-btn-primary text-sm"><Plus size={14} /> Crear servicio</button>} />
            ) : (
              <>
                <div className="luma-surface overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                        {['Servicio', 'Categoría', 'Jefe', 'Precio', 'Duración', 'Estado', 'Acciones'].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-medium"
                              style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result?.items.map((svc, i) => (
                        <tr key={svc.id} className="transition-colors hover:bg-white/5"
                            style={{ borderBottom: i < result.items.length - 1 ? '1px solid var(--color-border)' : 'none', opacity: svc.is_active ? 1 : 0.5 }}>
                          <td className="px-4 py-3">
                            <p className="font-medium" style={{ color: 'var(--color-text)' }}>{svc.name}</p>
                            {svc.description && <p className="text-xs truncate max-w-[180px]" style={{ color: 'var(--color-text-muted)' }}>{svc.description}</p>}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs px-2 py-1 rounded-full"
                                  style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}>
                              {svc.category_name}
                            </span>
                          </td>
                          {/* Columna Jefe */}
                          <td className="px-4 py-3">
                            {svc.owner_name
                              ? <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-accent)' }}>
                                  <Crown size={11} /> {svc.owner_name}
                                </span>
                              : <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>—</span>
                            }
                          </td>
                          <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-text)' }}>
                            ${svc.price.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="info">{fmtDuration(svc.duration_min)}</Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={svc.is_active ? 'success' : 'muted'}>
                              {svc.is_active ? 'Activo' : 'Inactivo'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              <button onClick={() => openEditSvc(svc)} className="luma-btn-ghost p-1.5 rounded-lg" title="Editar">
                                <Pencil size={14} />
                              </button>
                              <button onClick={() => handleToggleSvc(svc)} disabled={toggling === svc.id}
                                className="luma-btn-ghost p-1.5 rounded-lg"
                                style={{ color: svc.is_active ? 'var(--color-danger)' : 'var(--color-success)' }}>
                                {toggling === svc.id ? <Spinner size={14} /> : svc.is_active ? <PowerOff size={14} /> : <Power size={14} />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {result && <Paginator page={page} pageSize={PAGE_SIZE} total={result.total} onChange={setPage} />}
              </>
            )}
          </div>
        </>
      )}

      {/* ── TAB: CATEGORÍAS ─────────────────────────────────────────── */}
      {tab === 'categories' && (
        <div className="flex-1 overflow-auto px-6 py-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {categories.length === 0 ? (
              <div className="col-span-4">
                <EmptyState icon={<Tag size={26} />} title="Sin categorías"
                  action={<button onClick={openCreateCat} className="luma-btn-primary text-sm"><Plus size={14} /> Crear categoría</button>} />
              </div>
            ) : categories.map(cat => (
              <div key={cat.id} className="luma-surface p-4 flex flex-col gap-3"
                   style={{ opacity: cat.is_active ? 1 : 0.5 }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                    <span className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>{cat.name}</span>
                  </div>
                  <Badge variant={cat.is_active ? 'success' : 'muted'} className="text-xs">
                    {cat.is_active ? 'Activa' : 'Inactiva'}
                  </Badge>
                </div>
                {cat.description && <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{cat.description}</p>}
                <div className="flex gap-2 mt-auto pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                  <button onClick={() => openEditCat(cat)} className="luma-btn-ghost text-xs flex-1 justify-center">
                    <Pencil size={12} /> Editar
                  </button>
                  <button onClick={() => handleToggleCat(cat)}
                    className="luma-btn-ghost text-xs flex-1 justify-center"
                    style={{ color: cat.is_active ? 'var(--color-danger)' : 'var(--color-success)' }}>
                    {cat.is_active ? <><PowerOff size={12} /> Desactivar</> : <><Power size={12} /> Activar</>}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal servicio — ahora recibe owners */}
      <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); setEditSvc(null) }}
        title={editingService ? 'Editar servicio' : 'Nuevo servicio'}
        subtitle={editingService?.name} width="md">
        <FormWithError onSave={handleSaveSvc} onCancel={() => { setModalOpen(false); setEditSvc(null) }}>
          {(onSaveWrapped, onCancel) => (
            <ServiceForm
              initial={editingService}
              categories={activeCats}
              owners={owners}
              onSave={onSaveWrapped}
              onCancel={onCancel}
            />
          )}
        </FormWithError>
      </Modal>

      {/* Modal categoría */}
      <Modal isOpen={catModalOpen} onClose={() => { setCatModal(false); setEditCat(null) }}
        title={editingCat ? 'Editar categoría' : 'Nueva categoría'}
        subtitle={editingCat?.name} width="sm">
        <FormWithError onSave={handleSaveCat} onCancel={() => { setCatModal(false); setEditCat(null) }}>
          {(onSaveWrapped, onCancel) => (
            <CategoryForm initial={editingCat} onSave={onSaveWrapped} onCancel={onCancel} />
          )}
        </FormWithError>
      </Modal>
    </div>
  )
}

function FormWithError<T>({ onSave, onCancel, children }: {
  onSave: (data: T) => Promise<void>
  onCancel: () => void
  children: (onSave: (data: T) => Promise<void>, onCancel: () => void) => React.ReactNode
}) {
  const [backendError, setBackendError] = useState<string | null>(null)
  const wrapped = async (data: T) => {
    setBackendError(null)
    try { await onSave(data) }
    catch (e) { setBackendError(String(e).replace('Error: ', '')) }
  }
  return (
    <>
      {backendError && (
        <div className="rounded-lg px-4 py-3 text-sm mb-4"
             style={{ background: 'color-mix(in srgb,var(--color-danger) 12%,transparent)', color: 'var(--color-danger)' }}>
          {backendError}
        </div>
      )}
      {children(wrapped, onCancel)}
    </>
  )
}
