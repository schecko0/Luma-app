import { create } from 'zustand'
import type { Theme } from '../types'

interface ThemeStore {
  theme: Theme
  setTheme: (theme: Theme) => void
}

export const useThemeStore = create<ThemeStore>((set) => ({
  theme: 'dark',
  setTheme: (theme) => {
    set({ theme })
    // Aplicar clase al <html> para que Tailwind darkMode: 'class' funcione
    const root = document.documentElement
    root.classList.remove('dark', 'theme-light', 'theme-custom')
    if (theme === 'dark')   root.classList.add('dark')
    if (theme === 'light')  root.classList.add('theme-light')
    if (theme === 'custom') root.classList.add('theme-custom')
    // Persistir en localStorage mientras no tengamos settings en DB
    localStorage.setItem('luma-theme', theme)
  },
}))

// Hidratar tema guardado al cargar la app
const saved = localStorage.getItem('luma-theme') as Theme | null
if (saved) useThemeStore.getState().setTheme(saved)
