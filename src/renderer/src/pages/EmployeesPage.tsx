import React, { useState, useEffect, useCallback } from 'react'
import {
  Users, Plus, Search, Pencil, PowerOff, Power, RefreshCw, UserX,
} from 'lucide-react'
import type { Employee, PaginatedResult } from '../types'
import { Modal }        from '../components/ui/Modal'
import { Badge, EmptyState, Paginator, PageHeader, Spinner, SearchInput } from '../components/ui/index'
import { EmployeeForm } from '../components/employees/EmployeeForm'
import { GOOGLE_CALENDAR_COLORS } from '../components/ui/GoogleColorPicker'
import type { GoogleCalendarColor } from '../types'

const PAGE_SIZE = 15

export const EmployeesPage: React.FC = () => {
  const [result, setResult]           = useState<PaginatedResult<Employee> | null>(null)
  const [loading, setLoading]         = useState(true)
  const [page, setPage]               = useState(1)
  const [search, setSearch]           = useState('')
  const [includeInactive, setInclude] = useState(false)
  const [modalOpen, setModalOpen]     = useState(false)
  const [editing, setEditing]         = useState<Employee | null>(null)
  const [toggling, setToggling]       = useState<number | null>(null)
  const [error, setError]             = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await window.electronAPI.employees.list({
        page, pageSize: PAGE_SIZE, search, includeInactive,
      })
      if (res.ok) setResult(res.data as PaginatedResult<Employee>)
      else setError(res.error ?? 'Error desconocido')
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [page, search, includeInactive])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [search, includeInactive])

  const openCreate = () => { setEditing(null); setModalOpen(true) }
  const openEdit   = (emp: Employee) => { setEditing(emp); setModalOpen(true) }
  const closeModal = () => { setModalOpen(false); setEditing(null) }

  const handleSave = async (data: Omit<Employee, 'id' | 'created_at' | 'updated_at' | 'full_name'>) => {
    let res
    if (editing) {
      res = await window.electronAPI.employees.update(editing.id, data)
    } else {
      res = await window.electronAPI.employees.create(data)
    }
    if (!res.ok) throw new Error(res.error)
    closeModal()
    load()
  }

  const handleToggle = async (emp: Employee) => {
    setToggling(emp.id)
    try {
      const res = await window.electronAPI.employees.toggle(emp.id)
      if (res.ok) load()
    } finally {
      setToggling(null)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Empleados"
        subtitle={result ? `${result.total} empleado${result.total !== 1 ? 's' : ''} registrados` : ''}
        icon={<Users size={18} />}
        actions={
          <button onClick={openCreate} className="luma-btn-primary">
            <Plus size={16} /> Nuevo empleado
          </button>
        }
      />

      {/* Filtros */}
      <div className="flex items-center gap-3 px-6 py-3 border-b flex-shrink-0"
           style={{ borderColor: 'var(--color-border)' }}>
        <SearchInput
          icon={<Search size={14} />}
          placeholder="Buscar por nombre o correo..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-72"
        />
        <label className="flex items-center gap-2 text-xs cursor-pointer select-none"
               style={{ color: 'var(--color-text-muted)' }}>
          <input type="checkbox" checked={includeInactive}
            onChange={e => setInclude(e.target.checked)} className="rounded" />
          Mostrar inactivos
        </label>
        <button onClick={load} title="Recargar" className="luma-btn-ghost p-2 ml-auto">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {error && (
          <div className="rounded-lg px-4 py-3 text-sm mb-4"
               style={{ background: 'color-mix(in srgb, var(--color-danger) 12%, transparent)', color: 'var(--color-danger)' }}>
            {error}
          </div>
        )}

        {loading && !result ? (
          <div className="flex items-center justify-center py-20"><Spinner size={32} /></div>
        ) : result?.items.length === 0 ? (
          <EmptyState
            icon={<UserX size={26} />}
            title="Sin empleados"
            description={search ? 'No hay resultados para tu búsqueda.' : 'Agrega tu primer empleado para comenzar.'}
            action={!search
              ? <button onClick={openCreate} className="luma-btn-primary text-sm"><Plus size={14} /> Agregar empleado</button>
              : undefined
            }
          />
        ) : (
          <>
            <div className="luma-surface overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    {['Empleado', 'Rol', 'Contacto', 'Salario base', 'Comisión', 'Estado', 'Acciones'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium"
                          style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result?.items.map((emp, i) => {
                    const colorInfo = GOOGLE_CALENDAR_COLORS[emp.calendar_color as GoogleCalendarColor]
                    const isLast    = i === (result.items.length - 1)
                    return (
                      <tr key={emp.id}
                          style={{
                            borderBottom: isLast ? 'none' : '1px solid var(--color-border)',
                            opacity: emp.is_active ? 1 : 0.5,
                          }}
                          className="transition-colors hover:bg-white/5">

                        {/* Nombre + avatar */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                                 style={{ background: colorInfo?.hex ?? '#039BE5' }}
                                 title={`Color agenda: ${colorInfo?.label}`}>
                              {emp.first_name[0]}{emp.last_name[0]}
                            </div>
                            <div>
                              <p className="font-medium" style={{ color: 'var(--color-text)' }}>
                                {emp.first_name} {emp.last_name}
                              </p>
                              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                {colorInfo?.label ?? emp.calendar_color}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Rol — badge diferenciado */}
                        <td className="px-4 py-3">
                          {emp.role === 'owner'
                            ? <Badge variant="warning">👑 Dueño/Jefe</Badge>
                            : <Badge variant="info">💼 Empleado</Badge>
                          }
                        </td>

                        {/* Contacto */}
                        <td className="px-4 py-3">
                          <p style={{ color: 'var(--color-text)' }}>{emp.email ?? '—'}</p>
                          {emp.phone && (
                            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                              {emp.phone_country} {emp.phone}
                            </p>
                          )}
                        </td>

                        {/* Salario */}
                        <td className="px-4 py-3" style={{ color: 'var(--color-text)' }}>
                          {emp.base_salary > 0
                            ? `$${emp.base_salary.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
                            : <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                          }
                        </td>

                        {/* Comisión */}
                        <td className="px-4 py-3">
                          <Badge variant="info">{emp.commission_pct}%</Badge>
                        </td>

                        {/* Estado */}
                        <td className="px-4 py-3">
                          <Badge variant={emp.is_active ? 'success' : 'muted'}>
                            {emp.is_active ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </td>

                        {/* Acciones */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => openEdit(emp)} title="Editar"
                              className="luma-btn-ghost p-1.5 rounded-lg">
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => handleToggle(emp)}
                              title={emp.is_active ? 'Desactivar' : 'Activar'}
                              disabled={toggling === emp.id}
                              className="luma-btn-ghost p-1.5 rounded-lg"
                              style={{ color: emp.is_active ? 'var(--color-danger)' : 'var(--color-success)' }}>
                              {toggling === emp.id
                                ? <Spinner size={14} />
                                : emp.is_active ? <PowerOff size={14} /> : <Power size={14} />
                              }
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {result && (
              <Paginator page={page} pageSize={PAGE_SIZE} total={result.total} onChange={setPage} />
            )}
          </>
        )}
      </div>

      {/* Modal crear/editar con manejo de errores del backend */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editing ? 'Editar empleado' : 'Nuevo empleado'}
        subtitle={editing ? `${editing.first_name} ${editing.last_name}` : 'Completa los datos del empleado'}
        width="lg"
      >
        <EmployeeFormWithError
          initial={editing}
          onSave={handleSave}
          onCancel={closeModal}
        />
      </Modal>
    </div>
  )
}

// Wrapper que captura errores del backend y los muestra en el formulario
const EmployeeFormWithError: React.FC<{
  initial: Employee | null
  onSave: (data: Omit<Employee, 'id' | 'created_at' | 'updated_at' | 'full_name'>) => Promise<void>
  onCancel: () => void
}> = ({ initial, onSave, onCancel }) => {
  const [backendError, setBackendError] = useState<string | null>(null)

  const handleSave = async (data: Omit<Employee, 'id' | 'created_at' | 'updated_at' | 'full_name'>) => {
    setBackendError(null)
    try {
      await onSave(data)
    } catch (err) {
      setBackendError(String(err).replace('Error: ', ''))
    }
  }

  return (
    <>
      {backendError && (
        <div className="rounded-lg px-4 py-3 text-sm mb-4"
             style={{ background: 'color-mix(in srgb, var(--color-danger) 12%, transparent)', color: 'var(--color-danger)' }}>
          {backendError}
        </div>
      )}
      <EmployeeForm initial={initial} onSave={handleSave} onCancel={onCancel} />
    </>
  )
}
