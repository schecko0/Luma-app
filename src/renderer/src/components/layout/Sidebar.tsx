import React, { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, Scissors, Package, UserRound,
  CalendarDays, ShoppingCart, Vault, BadgeDollarSign,
  Settings, ChevronLeft, Sparkles, BookOpen, DownloadCloud,
  ExternalLink, Terminal, X,
} from 'lucide-react'
import clsx from 'clsx'

interface NavItem {
  to: string
  icon: React.ReactNode
  label: string
  adminOnly?: boolean
}

const navItems: NavItem[] = [
  { to: '/dashboard',   icon: <LayoutDashboard size={18} />,   label: 'Dashboard',    adminOnly: true },
  { to: '/agenda',      icon: <CalendarDays size={18} />,      label: 'Agenda' },
  { to: '/pos',         icon: <ShoppingCart size={18} />,      label: 'Ventas (POS)' },
  { to: '/clients',     icon: <UserRound size={18} />,         label: 'Clientes' },
  { to: '/employees',   icon: <Users size={18} />,             label: 'Empleados',    adminOnly: true },
  { to: '/services',    icon: <Scissors size={18} />,          label: 'Servicios' },
  { to: '/inventory',   icon: <Package size={18} />,           label: 'Inventario' },
  { to: '/cash',        icon: <Vault size={18} />,             label: 'Caja',         adminOnly: true },
  { to: '/commissions', icon: <BadgeDollarSign size={18} />,   label: 'Comisiones',   adminOnly: true },
  { to: '/settings',    icon: <Settings size={18} />,          label: 'Ajustes' },
  { to: '/help',        icon: <BookOpen size={18} />,          label: 'Ayuda' },
]

interface SidebarProps {
  isAdmin: boolean
  collapsed: boolean
  onToggle: () => void
  salonName: string
  salonLogo?: string
}

export const Sidebar: React.FC<SidebarProps> = ({ isAdmin, collapsed, onToggle, salonName, salonLogo }) => {

  const [version, setVersion]           = useState<string>('')
  const [updateReady, setUpdateReady]   = useState(false)
  const [updateInfo, setUpdateInfo]     = useState<any>(null)
  const [showMacModal, setShowMacModal] = useState(false)

  useEffect(() => {
    window.electronAPI?.getAppVersion().then(setVersion)

    const removeAvailable = window.electronAPI?.onUpdateAvailable((info: any) => {
      setUpdateInfo(info)
      if (info?.manualInstall) {
        // Mac: solo mostramos el boton informativo, no descargamos
        setUpdateReady(true)
      }
    })

    const removeDownloaded = window.electronAPI?.onUpdateDownloaded((info: any) => {
      setUpdateInfo(info)
      setUpdateReady(true)
    })

    return () => {
      removeAvailable?.()
      removeDownloaded?.()
    }
  }, [])

  const isMacUpdate = updateInfo?.manualInstall === true
  const newVersion  = updateInfo?.version ?? ''
  const releaseUrl  = `https://github.com/schecko0/Luma-app/releases/tag/v${newVersion}`

  return (
    <>
      <aside
        className={clsx(
          'flex flex-col h-full border-r transition-all duration-300 ease-in-out flex-shrink-0',
          collapsed ? 'w-[60px]' : 'w-[220px]'
        )}
        style={{
          background: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
        }}
      >
        {/* ── Logo / Nombre del salón ── */}
        <div
          className={clsx(
            'flex items-center gap-3 px-3 py-4 border-b flex-shrink-0',
            collapsed && 'justify-center'
          )}
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div
            className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden"
            style={{ background: salonLogo ? 'transparent' : 'var(--color-accent)' }}
          >
            {salonLogo ? (
              <img src={salonLogo} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <Sparkles size={16} className="text-white" />
            )}
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="font-display font-semibold text-sm leading-tight truncate"
                 style={{ color: 'var(--color-text)' }}>
                {salonName || 'Luma'}
              </p>
              <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                Gestión de salón
              </p>
            </div>
          )}
        </div>

        {/* ── Navegación ── */}
        <nav className="flex-1 overflow-y-auto py-2 px-2">
          {navItems
            .filter(item => !item.adminOnly || isAdmin)
            .map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 px-2 py-2 rounded-lg mb-0.5 text-sm transition-all duration-150',
                    collapsed && 'justify-center',
                    isActive ? 'font-medium' : 'hover:opacity-80'
                  )
                }
                style={({ isActive }) => ({
                  background: isActive ? 'color-mix(in srgb, var(--color-accent) 15%, transparent)' : 'transparent',
                  color: isActive ? 'var(--color-accent)' : 'var(--color-text-muted)',
                })}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                {!collapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            ))}
        </nav>

        {/* ── Footer: versión + colapsar ── */}
        <div className="p-2 border-t flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
          {!collapsed && (
            <div className="px-2 pb-1">
              {updateReady ? (
                <button
                  onClick={() => isMacUpdate ? setShowMacModal(true) : window.electronAPI?.installUpdate()}
                  className="w-full flex items-center justify-center gap-1.5 text-xs py-1.5 px-2 rounded-lg font-medium transition-all hover:opacity-90 active:scale-95"
                  style={{ background: 'var(--color-accent)', color: '#fff' }}
                >
                  <DownloadCloud size={13} />
                  <span>Actualizar ahora</span>
                </button>
              ) : (
                <p className="text-[10px] px-1" style={{ color: 'var(--color-text-muted)' }}>
                  v{version}
                </p>
              )}
            </div>
          )}

          <button
            onClick={onToggle}
            className={clsx(
              'w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs transition-all duration-150',
              'hover:opacity-80',
              collapsed && 'justify-center'
            )}
            style={{ color: 'var(--color-text-muted)' }}
            title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          >
            <ChevronLeft
              size={16}
              className={clsx('transition-transform duration-300', collapsed && 'rotate-180')}
            />
            {!collapsed && <span>Colapsar</span>}
          </button>
        </div>
      </aside>

      {/* ── Modal informativo de actualización en Mac ── */}
      {showMacModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
             style={{ background: 'rgba(0,0,0,0.6)' }}
             onClick={() => setShowMacModal(false)}>
          <div className="relative w-full max-w-md rounded-2xl p-6 flex flex-col gap-5"
               style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
               onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                     style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)' }}>
                  <DownloadCloud size={20} style={{ color: 'var(--color-accent)' }} />
                </div>
                <div>
                  <p className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>Nueva versión disponible</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>v{newVersion} ya está publicada</p>
                </div>
              </div>
              <button onClick={() => setShowMacModal(false)}
                className="p-1 rounded-lg hover:opacity-70"
                style={{ color: 'var(--color-text-muted)' }}>
                <X size={16} />
              </button>
            </div>

            {/* Pasos */}
            <div className="flex flex-col gap-3">
              {[
                {
                  n: '1',
                  title: 'Descarga el instalador',
                  body: `Descarga el archivo .dmg correspondiente a tu Mac desde la página de releases.`,
                  action: (
                    <button
                      onClick={() => window.open(releaseUrl, '_blank')}
                      className="flex items-center gap-1.5 text-xs mt-1.5 font-medium hover:underline"
                      style={{ color: 'var(--color-accent)' }}>
                      <ExternalLink size={11} /> Abrir página de releases
                    </button>
                  )
                },
                {
                  n: '2',
                  title: 'Instala la nueva versión',
                  body: 'Abre el .dmg y arrastra Luma App a la carpeta Applications. No necesitas desinstalar la versión anterior, se sobreescribe automáticamente.',
                },
                {
                  n: '3',
                  title: 'Si macOS bloquea la app',
                  body: 'Abre Terminal y ejecuta el siguiente comando para quitar la cuarentena:',
                  action: (
                    <div className="flex items-center gap-2 mt-1.5 px-3 py-2 rounded-lg"
                         style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
                      <Terminal size={11} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                      <code className="text-[10px] font-mono flex-1 select-all"
                            style={{ color: 'var(--color-accent)' }}>
                        xattr -cr "/Applications/Luma App.app"
                      </code>
                      <button
                        onClick={() => navigator.clipboard.writeText('xattr -cr "/Applications/Luma App.app"')}
                        className="text-[9px] px-1.5 py-0.5 rounded hover:opacity-70"
                        style={{ background: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                        Copiar
                      </button>
                    </div>
                  )
                },
              ].map(step => (
                <div key={step.n} className="flex gap-3">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5"
                       style={{ background: 'color-mix(in srgb, var(--color-accent) 20%, transparent)', color: 'var(--color-accent)' }}>
                    {step.n}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold" style={{ color: 'var(--color-text)' }}>{step.title}</p>
                    <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>{step.body}</p>
                    {step.action}
                  </div>
                </div>
              ))}
            </div>

            <button onClick={() => setShowMacModal(false)}
              className="luma-btn-ghost text-xs w-full py-2">
              Cerrar
            </button>
          </div>
        </div>
      )}
    </>
  )
}
