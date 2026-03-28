import React, { useState, useEffect, useCallback } from 'react'
import {
  UserRound, Plus, Search, Pencil, Power, PowerOff,
  RefreshCw, UserX, Phone, Mail, Receipt,
} from 'lucide-react'
import type { Client, PaginatedResult } from '../types'
import { Modal }      from '../components/ui/Modal'
import { Badge, EmptyState, Paginator, PageHeader, Spinner, SearchInput } from '../components/ui/index'
import { ClientForm } from '../components/clients/ClientForm'

const PAGE_SIZE = 15

export const ClientsPage: React.FC = () => {
  const [result, setResult]           = useState<PaginatedResult<Client> | null>(null)
  const [loading, setLoading]         = useState(true)
  const [page, setPage]               = useState(1)
  const [search, setSearch]           = useState('')
  const [includeInactive, setInactive] = useState(false)
  const [modalOpen, setModalOpen]     = useState(false)
  const [editing, setEditing]         = useState<Client | null>(null)
  const [toggling, setToggling]       = useState<number | null>(null)
  const [error, setError]             = useState<string | null>(null)
  const [backendError, setBackendError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await window.electronAPI.clients.list({ page, pageSize: PAGE_SIZE, search, includeInactive })
      if (res.ok) setResult(res.data as PaginatedResult<Client>)
      else setError(res.error ?? 'Error desconocido')
    } catch (e) { setError(String(e)) }
    finally { setLoading(false) }
  }, [page, search, includeInactive])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [search, includeInactive])

  const openCreate = () => { setEditing(null); setBackendError(null); setModalOpen(true) }
  const openEdit   = (c: Client) => { setEditing(c); setBackendError(null); setModalOpen(true) }
  const closeModal = () => { setModalOpen(false); setEditing(null) }

  const handleSave = async (data: Omit<Client, 'id' | 'created_at' | 'updated_at' | 'full_name' | 'visit_count' | 'last_visit_at'>) => {
    setBackendError(null)
    try {
      const res = editing
        ? await window.electronAPI.clients.update(editing.id, data)
        : await window.electronAPI.clients.create(data)
      if (!res.ok) { setBackendError(res.error ?? 'Error al guardar'); return }
      closeModal(); load()
    } catch (e) { setBackendError(String(e)) }
  }

  const handleToggle = async (c: Client) => {
    setToggling(c.id)
    const res = await window.electronAPI.clients.toggle(c.id)
    if (res.ok) load()
    setToggling(null)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Clientes"
        subtitle={result ? `${result.total} cliente${result.total !== 1 ? 's' : ''} registrados` : ''}
        icon={<UserRound size={18} />}
        actions={
          <button onClick={openCreate} className="luma-btn-primary">
            <Plus size={16} /> Nuevo cliente
          </button>
        }
      />

      {/* Filtros */}
      <div className="flex items-center gap-3 px-6 py-3 border-b flex-shrink-0"
           style={{ borderColor: 'var(--color-border)' }}>
        <SearchInput icon={<Search size={14} />}
          placeholder="Buscar por nombre, teléfono o correo..."
          value={search} onChange={e => setSearch(e.target.value)} className="w-80" />
        <label className="flex items-center gap-2 text-xs cursor-pointer select-none"
               style={{ color: 'var(--color-text-muted)' }}>
          <input type="checkbox" checked={includeInactive} onChange={e => setInactive(e.target.checked)} />
          Mostrar inactivos
        </label>
        <button onClick={load} className="luma-btn-ghost p-2 ml-auto">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Contenido */}
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
          <EmptyState icon={<UserX size={26} />} title="Sin clientes"
            description={search ? 'No hay resultados para tu búsqueda.' : 'Agrega tu primer cliente para comenzar.'}
            action={!search
              ? <button onClick={openCreate} className="luma-btn-primary text-sm"><Plus size={14} /> Agregar cliente</button>
              : undefined} />
        ) : (
          <>
            <div className="luma-surface overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    {['Cliente', 'Contacto', 'Visitas', 'Última visita', 'Facturación', 'Estado', 'Acciones'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium"
                          style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result?.items.map((c, i) => {
                    const initials = `${c.first_name[0]}${c.last_name[0]}`.toUpperCase()
                    const hasTax   = !!(c.tax_id || c.tax_legal_name)
                    return (
                      <tr key={c.id} className="transition-colors hover:bg-white/5"
                          style={{ borderBottom: i < result.items.length - 1 ? '1px solid var(--color-border)' : 'none', opacity: c.is_active ? 1 : 0.5 }}>

                        {/* Nombre */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                                 style={{ background: 'var(--color-accent)' }}>
                              {initials}
                            </div>
                            <div>
                              <p className="font-medium" style={{ color: 'var(--color-text)' }}>
                                {c.first_name} {c.last_name}
                              </p>
                              {c.birthdate && (
                                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                  🎂 {new Date(c.birthdate + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Contacto */}
                        <td className="px-4 py-3">
                          {c.phone && (
                            <p className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-text)' }}>
                              <Phone size={11} /> {c.phone_country} {c.phone}
                            </p>
                          )}
                          {c.email && (
                            <p className="flex items-center gap-1 text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                              <Mail size={11} /> {c.email}
                            </p>
                          )}
                          {!c.phone && !c.email && <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                        </td>

                        {/* Visitas */}
                        <td className="px-4 py-3">
                          <Badge variant={c.visit_count > 5 ? 'success' : c.visit_count > 0 ? 'info' : 'muted'}>
                            {c.visit_count} {c.visit_count === 1 ? 'visita' : 'visitas'}
                          </Badge>
                        </td>

                        {/* Última visita */}
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          {c.last_visit_at
                            ? new Date(c.last_visit_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
                            : '—'}
                        </td>

                        {/* Facturación */}
                        <td className="px-4 py-3">
                          {hasTax
                            ? <Badge variant="success"><Receipt size={10} className="mr-1" />Con datos</Badge>
                            : <Badge variant="muted">Sin datos</Badge>}
                        </td>

                        {/* Estado */}
                        <td className="px-4 py-3">
                          <Badge variant={c.is_active ? 'success' : 'muted'}>
                            {c.is_active ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </td>

                        {/* Acciones */}
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button onClick={() => openEdit(c)} className="luma-btn-ghost p-1.5 rounded-lg" title="Editar">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => handleToggle(c)} disabled={toggling === c.id}
                              className="luma-btn-ghost p-1.5 rounded-lg"
                              style={{ color: c.is_active ? 'var(--color-danger)' : 'var(--color-success)' }}>
                              {toggling === c.id ? <Spinner size={14} /> : c.is_active ? <PowerOff size={14} /> : <Power size={14} />}
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

      {/* Modal */}
      <Modal isOpen={modalOpen} onClose={closeModal}
        title={editing ? 'Editar cliente' : 'Nuevo cliente'}
        subtitle={editing ? `${editing.first_name} ${editing.last_name}` : 'Completa los datos del cliente'}
        width="lg">
        {backendError && (
          <div className="rounded-lg px-4 py-3 text-sm mb-4"
               style={{ background: 'color-mix(in srgb,var(--color-danger) 12%,transparent)', color: 'var(--color-danger)' }}>
            {backendError}
          </div>
        )}
        <ClientForm initial={editing} onSave={handleSave} onCancel={closeModal} />
      </Modal>
    </div>
  )
}
