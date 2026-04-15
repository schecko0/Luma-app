import { useState, useEffect } from 'react'

interface AppState {
  isAdmin: boolean
  salonName: string
  salonLogo: string
  sidebarCollapsed: boolean
  setSidebarCollapsed: (v: boolean) => void
  refreshSettings: () => Promise<void>
}

export function useAppState(): AppState {
  const [salonName, setSalonName]               = useState('Luma')
  const [salonLogo, setSalonLogo]               = useState('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const isAdmin = true // TODO: auth real

  const refreshSettings = async () => {
    const res = await window.electronAPI.settings.getAll()
    if (res.ok) {
      const s = res.data as Record<string, string>
      if (s.salon_name) setSalonName(s.salon_name)
      
      // CARGAR LOGO COMO BASE64 (Estrategia similar a WhatsApp)
      if (s.salon_logo) {
        const logoRes = await (window.electronAPI as any).readImageAsBase64?.(s.salon_logo)
        if (logoRes?.ok) setSalonLogo(logoRes.data)
        else setSalonLogo('')
      } else {
        setSalonLogo('')
      }
      
      applyTheme(s.theme ?? 'dark', s)
    }
  }

  useEffect(() => { refreshSettings() }, [])

  return { isAdmin, salonName, salonLogo, sidebarCollapsed, setSidebarCollapsed, refreshSettings }
}

// ─────────────────────────────────────────────────────────────────────────────
// applyTheme — aplica el tema al <html> en tiempo real
//
// Estrategia:
//   dark   → data-theme="dark"  + sin variables inline + quita .theme-light
//   light  → data-theme="light" + sin variables inline + quita .theme-light
//            (el CSS tiene :root[data-theme="light"] con los colores claros)
//   custom → data-theme="custom" + aplica variables inline desde settings
// ─────────────────────────────────────────────────────────────────────────────
export function applyTheme(theme: string, settings: Record<string, string> = {}) {
  const root = document.documentElement

  // Variables a limpiar cuando se sale del modo custom
  const CSS_VARS = [
    '--color-bg', '--color-surface', '--color-surface-2', '--color-border',
    '--color-accent', '--color-accent-hover', '--color-text', '--color-text-muted',
    '--color-success', '--color-danger', '--color-warning', '--color-info',
  ]

  if (theme === 'custom') {
    // Aplicar variables inline para previsualización en tiempo real
    const map: Record<string, string> = {
      '--color-bg':           settings.custom_bg          ?? '#0f0d0b',
      '--color-surface':      settings.custom_surface     ?? '#1a1714',
      '--color-surface-2':    settings.custom_surface2    ?? '#242019',
      '--color-border':       settings.custom_border      ?? '#2e2920',
      '--color-accent':       settings.custom_accent      ?? '#d4881f',
      '--color-accent-hover': settings.custom_accent      ?? '#e4a73a', // misma base
      '--color-text':         settings.custom_text        ?? '#f5f0e8',
      '--color-text-muted':   settings.custom_text_muted  ?? '#8a8070',
      '--color-success':      settings.custom_success     ?? '#4caf7d',
      '--color-danger':       settings.custom_danger      ?? '#dc4a3d',
      '--color-warning':      settings.custom_warning     ?? '#e8a838',
      '--color-info':         settings.custom_info        ?? '#4a90d9',
    }
    for (const [k, v] of Object.entries(map)) {
      root.style.setProperty(k, v)
    }
    root.classList.remove('theme-light')
    root.setAttribute('data-theme', 'custom')
    return
  }

  // dark o light — limpiar variables inline para que el CSS tome control
  CSS_VARS.forEach(v => root.style.removeProperty(v))
  root.classList.remove('theme-light')

  // El atributo data-theme activa el selector en index.css
  // :root[data-theme="dark"]  → variables oscuras (default)
  // :root[data-theme="light"] → variables claras
  root.setAttribute('data-theme', theme)
}
