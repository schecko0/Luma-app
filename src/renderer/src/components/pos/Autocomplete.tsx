import React, { useState, useRef, useEffect } from 'react'
import { Search, X } from 'lucide-react'
import { Spinner } from '../ui/index'

interface Option { id: number; label: string; sublabel?: string }

interface Props {
  placeholder: string
  onSearch: (q: string) => Promise<Option[]>
  onSelect: (option: Option) => void
  selected?: Option | null
  onClear?: () => void
  icon?: React.ReactNode
  disabled?: boolean
}

export const Autocomplete: React.FC<Props> = ({
  placeholder, onSearch, onSelect, selected, onClear, icon, disabled,
}) => {
  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState<Option[]>([])
  const [loading, setLoading]   = useState(false)
  const [open, setOpen]         = useState(false)
  const debounce                = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef                = useRef<HTMLInputElement>(null)
  const containerRef            = useRef<HTMLDivElement>(null)

  // Cerrar al hacer click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleChange = (q: string) => {
    setQuery(q)
    if (debounce.current) clearTimeout(debounce.current)
    if (!q.trim()) { setResults([]); setOpen(false); return }

    debounce.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await onSearch(q)
        setResults(res)
        setOpen(true)
      } finally { setLoading(false) }
    }, 250)
  }

  const handleSelect = (opt: Option) => {
    onSelect(opt)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  if (selected) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border"
           style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-accent)' }}>
        {icon && <span style={{ color: 'var(--color-accent)' }}>{icon}</span>}
        <span className="flex-1 text-sm font-medium" style={{ color: 'var(--color-text)' }}>
          {selected.label}
        </span>
        {selected.sublabel && (
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{selected.sublabel}</span>
        )}
        {onClear && (
          <button onClick={onClear} className="hover:opacity-70" style={{ color: 'var(--color-text-muted)' }}>
            <X size={14} />
          </button>
        )}
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }}>
          {loading ? <Spinner size={14} /> : (icon ?? <Search size={14} />)}
        </span>
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={e => handleChange(e.target.value)}
          onFocus={() => query && setOpen(true)}
          disabled={disabled}
          className="luma-input pl-9 text-sm"
          data-selectable
        />
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl shadow-2xl overflow-hidden border animate-slide-in"
             style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          {results.map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleSelect(opt)}
              className="w-full flex flex-col items-start px-4 py-2.5 text-sm hover:opacity-80 transition-colors border-b last:border-b-0"
              style={{ borderColor: 'var(--color-border)', textAlign: 'left' }}
            >
              <span style={{ color: 'var(--color-text)' }}>{opt.label}</span>
              {opt.sublabel && (
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{opt.sublabel}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {open && !loading && query.trim() && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl shadow-lg border px-4 py-3 text-xs"
             style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
          Sin resultados para "{query}"
        </div>
      )}
    </div>
  )
}
