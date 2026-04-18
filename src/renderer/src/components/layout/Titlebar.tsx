import React from 'react'
import { Minus, Square, X } from 'lucide-react'

/**
 * Barra de título personalizada — solo se muestra en Windows/Linux
 * (en macOS se usan los semáforos nativos con titleBarStyle: 'hiddenInset')
 */
export const Titlebar: React.FC = () => {
  if (navigator.platform.toLowerCase().includes('mac')) return null

  return (
    <div
      className="titlebar-drag flex items-center justify-between h-8 flex-shrink-0 border-b px-3 text-xs select-none"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      <span className="font-display font-medium" style={{ color: 'var(--color-accent)' }}>
        Luma App
      </span>
      {/* Botones de ventana — Windows style */}
      <div className="titlebar-no-drag flex items-center gap-1">
        <button
          onClick={() => window.electronAPI?.minimizeWindow()}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 transition-colors"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <Minus size={12} />
        </button>
        <button
          onClick={() => window.electronAPI?.maximizeWindow()}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 transition-colors"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <Square size={11} />
        </button>
        <button
          onClick={() => window.electronAPI?.closeWindow()}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-500 transition-colors"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <X size={13} />
        </button>
      </div>
    </div>
  )
}
