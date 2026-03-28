import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, Scissors, Package, UserRound,
  CalendarDays, ShoppingCart, Vault, BadgeDollarSign,
  Settings, ChevronLeft, Sparkles,
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
]

interface SidebarProps {
  isAdmin: boolean
  collapsed: boolean
  onToggle: () => void
  salonName: string
}

export const Sidebar: React.FC<SidebarProps> = ({ isAdmin, collapsed, onToggle, salonName }) => {
  return (
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
          className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--color-accent)' }}
        >
          <Sparkles size={16} className="text-white" />
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
                  isActive
                    ? 'font-medium'
                    : 'hover:opacity-80'
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

      {/* ── Botón colapsar ── */}
      <div className="p-2 border-t flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
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
  )
}
