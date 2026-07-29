import { useState, useEffect } from 'react'
import client from '../../api/client'

const DEFAULT_STYLE = 'badge bg-slate-100/80 text-slate-600 border-slate-200/60'

const STATUS_DOT_COLORS = {
  available: 'bg-emerald-500',
  returned: 'bg-emerald-500',
  active: 'bg-blue-500',
  borrowed: 'bg-blue-500',
  overdue: 'bg-rose-500',
  maintenance: 'bg-amber-500',
  lost: 'bg-slate-400',
}

const CATEGORY_STYLES = {
  tool: 'badge-tool',
  vehicle: 'badge-vehicle',
  room: 'badge-room',
}

export function Badge({ status, category, children, className = '' }) {
  const [constants, setConstants] = useState(null)

  useEffect(() => {
    client.get('/settings/constants')
      .then(({ data }) => setConstants(data))
      .catch(() => {})
  }, [])

  if (constants && status) {
    const statusDef = constants.asset_statuses?.find(s => s.slug === status)
      || constants.transaction_statuses?.find(s => s.slug === status)
    if (statusDef) {
      return (
        <span
          className={`badge ${className}`}
          style={{
            backgroundColor: statusDef.color + '15',
            color: statusDef.color,
            borderColor: statusDef.color + '30',
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: statusDef.color }}
          />
          {children || statusDef.name}
        </span>
      )
    }
  }

  if (constants && category) {
    const catDef = constants.categories?.find(c => c.slug === category)
    if (catDef) {
      return (
        <span
          className={`badge ${className}`}
          style={{
            backgroundColor: catDef.color + '12',
            color: catDef.color,
            borderColor: catDef.color + '25',
          }}
        >
          {catDef.icon && <span className="mr-0.5 text-xs">{catDef.icon}</span>}
          {children || catDef.name}
        </span>
      )
    }
  }

  // Fallback for status
  if (status) {
    const fallbackLabels = {
      available: 'Tersedia', borrowed: 'Dipinjam', overdue: 'Overdue',
      maintenance: 'Maintenance', lost: 'Hilang', active: 'Aktif', returned: 'Dikembalikan',
    }
    const badgeClass = `badge-${status}` in STATUS_DOT_COLORS ? `badge-${status}` : DEFAULT_STYLE
    const dotColor = STATUS_DOT_COLORS[status] || 'bg-slate-400'

    return (
      <span className={`badge badge-${status} ${className}`}>
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
        {children || fallbackLabels[status] || status}
      </span>
    )
  }

  // Fallback for category
  if (category) {
    const fallbackLabels = { tool: 'Tool', vehicle: 'Kendaraan', room: 'Ruangan' }
    const catClass = CATEGORY_STYLES[category] || DEFAULT_STYLE
    return (
      <span className={`${catClass} ${className}`}>
        {children || fallbackLabels[category] || category}
      </span>
    )
  }

  return <span className={`${DEFAULT_STYLE} ${className}`}>{children}</span>
}
