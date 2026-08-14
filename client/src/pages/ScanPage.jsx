import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Wrench, Car, Building2, AlertTriangle, XCircle, Search, Package } from 'lucide-react'
import BorrowForm from '../components/BorrowForm'
import ReturnForm from '../components/ReturnForm'
import { Badge } from '../components/ui/Badge'
import { Spinner } from '../components/ui/Spinner'

const API = import.meta.env.VITE_API_URL || '/api'

function formatLateDuration(iso) {
  const ms = Date.now() - new Date(iso).getTime()
  if (ms <= 0) return ''
  const mins = Math.floor(ms / 60000)
  const days = Math.floor(mins / 1440)
  const hrs = Math.floor((mins % 1440) / 60)
  if (days > 0) return hrs > 0 ? `${days} hari ${hrs} jam` : `${days} hari`
  return `${hrs} jam`
}

function formatDate(iso) {
  return new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}

function OverdueBanner({ expectedReturnAt }) {
  const late = formatLateDuration(expectedReturnAt)
  if (!late) return null
  return (
    <div className="rounded-2xl border-2 border-rose-300 bg-rose-50 p-4 flex gap-3 animate-fade-in">
      <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center flex-shrink-0 shadow-subtle">
        <AlertTriangle className="w-5 h-5" />
      </div>
      <div className="text-xs text-rose-800 leading-relaxed">
        <p className="font-bold text-rose-900 text-sm">Pengembalian Telat</p>
        <p className="mt-1">
          Telat <strong className="text-rose-900">{late}</strong> dari jadwal kembali ({formatDate(expectedReturnAt)}).
        </p>
        <p className="mt-0.5 text-rose-700">Mohon segera kembalikan aset ini ke workshop.</p>
      </div>
    </div>
  )
}

function StatusInfo({ asset, activeTx }) {
  if (asset.status === 'maintenance') {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
          <Wrench className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-amber-800 tracking-tight">Aset Sedang Maintenance</h2>
        <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
          Aset ini sedang dalam perbaikan dan tidak bisa dipinjam saat ini.
        </p>
      </div>
    )
  }
  if (asset.status === 'lost') {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
          <XCircle className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-rose-800 tracking-tight">Aset Hilang</h2>
        <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
          Aset ini dilaporkan hilang. Hubungi admin workshop untuk informasi lebih lanjut.
        </p>
      </div>
    )
  }
  return null
}

export default function ScanPage() {
  const { assetCode } = useParams()
  const navigate = useNavigate()

  const [asset, setAsset] = useState(null)
  const [activeTx, setActiveTx] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchAsset() {
      setLoading(true)
      try {
        // Use fetch directly (no auth needed) via the public API
        const res = await fetch(`${API}/public/assets/${assetCode}`)
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Aset tidak ditemukan')
        setAsset(json.data)
        setActiveTx(json.active_transaction)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    fetchAsset()
  }, [assetCode])

  async function handleBorrow(payload) {
    const res = await fetch(`${API}/public/borrow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'Gagal meminjam')
    navigate('/scan/success', {
      state: {
        type: 'borrow',
        borrower_name: payload.borrower_name,
        asset,
        transaction: json.data,
      },
      replace: true,
    })
  }

  async function handleReturn(payload) {
    const res = await fetch(`${API}/public/return`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'Gagal mengembalikan')
    navigate('/scan/success', {
      state: {
        type: 'return',
        borrower_name: payload.return_by_name,
        asset,
        transaction: json.data,
      },
      replace: true,
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-xs text-slate-500 font-medium">Memuat informasi aset...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-sm w-full text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 inline-flex items-center justify-center text-slate-400">
            <Search className="w-7 h-7" />
          </div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Aset Tidak Ditemukan</h1>
          <p className="text-xs text-slate-500 leading-relaxed">{error}</p>
        </div>
      </div>
    )
  }

  const canInteract = asset.status === 'available' || asset.status === 'borrowed'
  const CATEGORY_ICONS = { tool: Wrench, vehicle: Car, room: Building2 }
  const CategoryIcon = CATEGORY_ICONS[asset.category] || Package

  return (
    <div className="min-h-screen bg-slate-50/60 font-sans">
      {/* Header */}
      <div className="bg-white border-b border-slate-200/80 shadow-subtle">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center gap-3.5">
            {asset.photo_url ? (
              <img src={asset.photo_url} alt={asset.name}
                className="w-14 h-14 rounded-2xl object-cover border border-slate-200/80 shadow-subtle flex-shrink-0" />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100
                              flex items-center justify-center text-indigo-600 shadow-subtle flex-shrink-0">
                <CategoryIcon className="w-7 h-7" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold text-slate-900 leading-tight tracking-tight">{asset.name}</h1>
              {asset.description && (
                <p className="text-xs text-slate-500 mt-0.5 truncate">{asset.description}</p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <Badge category={asset.category} />
                <Badge status={asset.status} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-md mx-auto px-4 py-6 animate-fade-in space-y-4">
        {activeTx?.expected_return_at && (
          <OverdueBanner expectedReturnAt={activeTx.expected_return_at} />
        )}
        {!canInteract ? (
          <div className="card">
            <div className="card-body">
              <StatusInfo asset={asset} activeTx={activeTx} />
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="card-body">
              {asset.status === 'available' ? (
                <BorrowForm asset={asset} onSubmit={handleBorrow} />
              ) : (
                <ReturnForm asset={asset} activeTx={activeTx} onSubmit={handleReturn} />
              )}
            </div>
          </div>
        )}

        <p className="text-center text-[11px] text-slate-400 font-medium mt-6">
          WABT — Workshop Asset Borrowing Tracker
        </p>
      </div>
    </div>
  )
}
