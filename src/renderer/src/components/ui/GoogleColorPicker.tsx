import React from 'react'
import { Check } from 'lucide-react'
import type { GoogleCalendarColor } from '../../types'

// Mapa oficial de colores Google Calendar API → hex visual
export const GOOGLE_CALENDAR_COLORS: Record<GoogleCalendarColor, { hex: string; label: string }> = {
  tomato:     { hex: '#D50000', label: 'Tomate'     },
  flamingo:   { hex: '#E67C73', label: 'Flamingo'   },
  tangerine:  { hex: '#F4511E', label: 'Mandarina'  },
  banana:     { hex: '#F6BF26', label: 'Plátano'    },
  sage:       { hex: '#33B679', label: 'Salvia'      },
  basil:      { hex: '#0B8043', label: 'Albahaca'   },
  peacock:    { hex: '#039BE5', label: 'Pavo Real'  },
  blueberry:  { hex: '#3F51B5', label: 'Arándano'   },
  lavender:   { hex: '#7986CB', label: 'Lavanda'    },
  grape:      { hex: '#8E24AA', label: 'Uva'        },
  graphite:   { hex: '#616161', label: 'Grafito'    },
}

interface GoogleColorPickerProps {
  value: GoogleCalendarColor
  onChange: (color: GoogleCalendarColor) => void
  label?: string
}

export const GoogleColorPicker: React.FC<GoogleColorPickerProps> = ({
  value, onChange, label = 'Color en agenda',
}) => {
  return (
    <div>
      <label className="luma-label">{label}</label>
      <div className="flex flex-wrap gap-2 mt-1">
        {(Object.entries(GOOGLE_CALENDAR_COLORS) as [GoogleCalendarColor, { hex: string; label: string }][]).map(
          ([colorKey, { hex, label: colorLabel }]) => (
            <button
              key={colorKey}
              type="button"
              title={colorLabel}
              onClick={() => onChange(colorKey)}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2"
              style={{
                backgroundColor: hex,
                boxShadow: value === colorKey ? `0 0 0 3px var(--color-bg), 0 0 0 5px ${hex}` : undefined,
              }}
            >
              {value === colorKey && <Check size={14} className="text-white drop-shadow" />}
            </button>
          )
        )}
      </div>
      <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
        Color seleccionado:{' '}
        <span style={{ color: GOOGLE_CALENDAR_COLORS[value]?.hex, fontWeight: 600 }}>
          {GOOGLE_CALENDAR_COLORS[value]?.label}
        </span>
      </p>
    </div>
  )
}
