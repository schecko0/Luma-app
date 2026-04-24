import React, { useEffect } from 'react'
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

// ── Audio helpers (viven aquí para estar siempre montados) ────────────────────
function playChime() {
  try {
    const ctx  = new (window.AudioContext || (window as any).webkitAudioContext)()
    const now  = ctx.currentTime
    const osc1 = ctx.createOscillator()
    const osc2 = ctx.createOscillator()
    const gain = ctx.createGain()
    osc1.frequency.setValueAtTime(523.25, now)
    osc2.frequency.setValueAtTime(659.25, now)
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.2, now + 0.1)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5)
    osc1.connect(gain); osc2.connect(gain); gain.connect(ctx.destination)
    osc1.start(now); osc2.start(now); osc1.stop(now + 1.5); osc2.stop(now + 1.5)
  } catch (_) {}
}

function speakAlert(text: string) {
  if (!window.speechSynthesis) return
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'es-MX'; u.rate = 0.9; u.pitch = 1
  window.speechSynthesis.speak(u)
}

export default function App() {
  const { isAdmin, sidebarCollapsed, setSidebarCollapsed, salonName, salonLogo, refreshSettings } = useAppState()

  // ── Listener global de alertas — funciona en cualquier módulo ────────────────
  useEffect(() => {
    const unsub = window.electronAPI.alerts.onAlert(({ body, diffMin }) => {
      playChime()
      speakAlert(`Cita en ${diffMin} minutos: ${body}`)
    })
    return () => unsub()
  }, [])

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
