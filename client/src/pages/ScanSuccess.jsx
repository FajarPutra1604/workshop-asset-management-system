import { useLocation, Link } from 'react-router-dom'
import { CheckCircle2, ArrowUpRight, ArrowLeft, Calendar, Clock, User, Package, MapPin } from 'lucide-react'

function fmt(isoStr, opts) {
  if (!isoStr) return '—'
  try {
    return new Date(isoStr).toLocaleString('id-ID', opts)
  } catch {
    return '—'
  }
}

function InfoRow({ label, value, accent }) {
  return (
    <div className="flex justify-between items-start gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-500 font-medium shrink-0">{label}</span>
      <span className={`text-xs font-semibold text-right ${accent || 'text-slate-900'}`}>{value || '—'}</span>
    </div>
  )
}

export default function ScanSuccess() {
  const { state } = useLocation()

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500 text-sm">Halaman tidak valid.</p>
      </div>
    )
  }

  const { type, borrower_name, asset, transaction } = state
  const isBorrow = type === 'borrow'

  const dateOpts = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }
  const timeOpts = { hour: '2-digit', minute: '2-digit' }

  const startDate = isBorrow ? transaction?.borrowed_at : transaction?.borrowed_at
  const endDate   = isBorrow ? transaction?.expected_return_at : transaction?.returned_at

  // Duration in hours/days
  let durationLabel = null
  if (startDate && endDate) {
    const diffMs = new Date(endDate) - new Date(startDate)
    if (diffMs > 0) {
      const totalHours = diffMs / (1000 * 3600)
      if (totalHours >= 24) {
        const days  = Math.floor(totalHours / 24)
        const hours = Math.round(totalHours % 24)
        durationLabel = hours > 0 ? `${days} hari ${hours} jam` : `${days} hari`
      } else {
        durationLabel = `${Math.round(totalHours * 10) / 10} jam`
      }
    }
  }

  return (
    <div className="min-h-screen bg-slate-50/80 flex items-center justify-center p-4 font-sans">
      <div className="max-w-sm w-full text-center animate-scale-in space-y-5">
        {/* Icon */}
        <div className={`inline-flex w-20 h-20 rounded-3xl items-center justify-center border shadow-subtle
                         ${isBorrow ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'}`}>
          {isBorrow ? <ArrowUpRight className="w-10 h-10" /> : <CheckCircle2 className="w-10 h-10" />}
        </div>

        <div>
          <h1 className={`text-xl font-bold tracking-tight mb-1
                          ${isBorrow ? 'text-indigo-900' : 'text-emerald-900'}`}>
            {isBorrow ? 'Peminjaman Berhasil! 🎉' : 'Pengembalian Berhasil! ✅'}
          </h1>
          <p className="text-xs text-slate-500">
            {isBorrow
              ? `Halo, ${borrower_name}! Peminjaman aset tercatat.`
              : `Terima kasih, ${borrower_name}! Pengembalian aset tercatat.`}
          </p>
        </div>

        {/* Invoice Card */}
        <div className="card p-5 text-left space-y-0">
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md
                              ${isBorrow ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
              {isBorrow ? '📤 Peminjaman' : '📥 Pengembalian'}
            </span>
          </div>

          <InfoRow label="Peminjam" value={borrower_name} />
          <InfoRow label="Aset" value={asset?.name} />
          {transaction?.purpose && (
            <InfoRow label="Keperluan" value={transaction.purpose} />
          )}

          {/* Borrow date/time block */}
          {startDate && (
            <div className="py-2.5 border-b border-slate-100">
              <p className="text-xs text-slate-500 font-medium mb-1.5 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {isBorrow ? 'Mulai Pinjam' : 'Tanggal Dipinjam'}
              </p>
              <div className="bg-slate-50/80 rounded-xl border border-slate-100 px-3 py-2 space-y-0.5">
                <p className="text-xs font-bold text-slate-900">{fmt(startDate, dateOpts)}</p>
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {fmt(startDate, timeOpts)}
                </p>
              </div>
            </div>
          )}

          {/* Return/expected return date/time */}
          {endDate && (
            <div className="py-2.5 border-b border-slate-100">
              <p className="text-xs text-slate-500 font-medium mb-1.5 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {isBorrow ? 'Rencana Kembali' : 'Tanggal Dikembalikan'}
              </p>
              <div className={`rounded-xl border px-3 py-2 space-y-0.5
                               ${isBorrow ? 'bg-amber-50/60 border-amber-100' : 'bg-emerald-50/60 border-emerald-100'}`}>
                <p className={`text-xs font-bold ${isBorrow ? 'text-amber-900' : 'text-emerald-900'}`}>
                  {fmt(endDate, dateOpts)}
                </p>
                <p className={`text-xs flex items-center gap-1 ${isBorrow ? 'text-amber-600' : 'text-emerald-600'}`}>
                  <Clock className="w-3 h-3" />
                  {fmt(endDate, timeOpts)}
                </p>
              </div>
            </div>
          )}

          {/* Duration badge */}
          {durationLabel && (
            <div className="py-2.5 border-b border-slate-100">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 font-medium">
                  {isBorrow ? 'Durasi Peminjaman' : 'Total Durasi'}
                </span>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-lg
                                  ${isBorrow ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'}`}>
                  ⏱ {durationLabel}
                </span>
              </div>
            </div>
          )}

          {/* Waktu transaksi dicatat */}
          <InfoRow
            label="Dicatat pada"
            value={fmt(transaction?.borrowed_at || new Date(), { ...dateOpts, ...timeOpts })}
          />
        </div>

        <div className="pt-2">
          <Link
            to={`/scan/${asset?.asset_code}`}
            replace
            className="btn-primary w-full justify-center flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Halaman Aset</span>
          </Link>
        </div>

        <p className="text-[11px] text-slate-400 font-medium">
          WABT — Workshop Asset Borrowing Tracker
        </p>
      </div>
    </div>
  )
}
