import React from 'react'
import { BrowserRouter, Routes,  Navigate, HashRouter, Route } from 'react-router-dom'
import { Sidebar }          from './components/layout/Sidebar'
import { Titlebar }         from './components/layout/Titlebar'
import { DashboardPage }    from './pages/DashboardPage'
import { EmployeesPage }    from './pages/EmployeesPage'
import { ServicesPage }     from './pages/ServicesPage'
import { ClientsPage }      from './pages/ClientsPage'
import { InventoryPage }    from './pages/InventoryPage'
import { CashPage }         from './pages/CashPage'
import { PosPage }          from './pages/PosPage'
import { CommissionsPage }  from './pages/CommissionsPage'
import { AgendaPage }       from './pages/AgendaPage'
import { SettingsPage, HelpPage } from './pages/index'
import { useAppState }      from './hooks/useAppState'

export default function App() {
  const { isAdmin, sidebarCollapsed, setSidebarCollapsed, salonName, salonLogo, refreshSettings } = useAppState()

  return (
    <HashRouter>
      <div className="flex flex-col h-screen overflow-hidden">
        <Titlebar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar isAdmin={isAdmin} collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} 
            salonName={salonName} salonLogo={salonLogo} />
          <main className="flex-1 overflow-hidden flex flex-col" style={{ background: 'var(--color-bg)' }}>
            <Routes>
              <Route path="/"            element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard"   element={<DashboardPage />} />
              <Route path="/agenda"      element={<AgendaPage />} />
              <Route path="/pos"         element={<PosPage />} />
              <Route path="/clients"     element={<ClientsPage />} />
              <Route path="/employees"   element={<EmployeesPage />} />
              <Route path="/services"    element={<ServicesPage />} />
              <Route path="/inventory"   element={<InventoryPage />} />
              <Route path="/cash"        element={<CashPage />} />
              <Route path="/commissions" element={<CommissionsPage />} />
              <Route path="/settings"    element={<SettingsPage onSaved={refreshSettings} />} />
              <Route path="/help"        element={<HelpPage />} />
              <Route path="*"            element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </HashRouter>
  )
}
