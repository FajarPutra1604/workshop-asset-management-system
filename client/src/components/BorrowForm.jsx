import { useState } from 'react'
import { CheckCircle2, Wrench, Car, Building2, Calendar, Clock, Sparkles } from 'lucide-react'
import { Spinner } from './ui/Spinner'

const CATEGORY_ICONS = { tool: Wrench, vehicle: Car, room: Building2 }
const CATEGORY_LABEL = { tool: 'Tool', vehicle: 'Kendaraan', room: 'Ruangan' }

function toLocalDatetimeString(date) {
  const d = new Date(date)
  const pad = (n) => String(n).padStart(2, '0')
  const yyyy = d.getFullYear()
  const mm = pad(d.getMonth() + 1)
  const dd = pad(d.getDate())
  const hh = pad(d.getHours())
  const min = pad(d.getMinutes())
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`
}

function fmtDisplayDatetime(isoOrStr) {
  if (!isoOrStr) return ''
  const d = new Date(isoOrStr)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function BorrowForm({ asset, onSubmit }) {
  const now = new Date()
  const defaultReturn = new Date(now.getTime() + 2 * 3600 * 1000)

  const [form, setForm] = useState({
    borrower_name: '',
    borrower_contact: '',
    purpose: '',
    borrowed_at: toLocalDatetimeString(now),
    expected_return_at: toLocalDatetimeString(defaultReturn),
    odometer_start: '',
    attendees: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const CategoryIcon = CATEGORY_ICONS[asset.category] || Wrench

  // Calculate duration in hours between start and end
  const startDate = new Date(form.borrowed_at)
  const endDate = new Date(form.expected_return_at)
  const diffMs = endDate.getTime() - startDate.getTime()
  const durationHours = diffMs > 0 ? Math.round((diffMs / (3600 * 1000)) * 10) / 10 : 0
  const durationDays = (durationHours / 24).toFixed(1)

  function applyQuickPreset(hoursToAdd) {
    const start = new Date(form.borrowed_at || Date.now())
    const newEnd = new Date(start.getTime() + hoursToAdd * 3600 * 1000)
    set('expected_return_at', toLocalDatetimeString(newEnd))
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (diffMs <= 0) {
      setError('Waktu tanggal kembali harus lebih akhir dari waktu tanggal pinjam')
      return
    }

    setLoading(true); setError(null)
    try {
      const returnAtIso = new Date(form.expected_return_at).toISOString()
      await onSubmit({
        asset_code: asset.asset_code,
        borrower_name: form.borrower_name,
        borrower_contact: form.borrower_contact || undefined,
        purpose: form.purpose || undefined,
        expected_return_at: returnAtIso,
        estimated_duration_hours: durationHours > 0 ? durationHours : undefined,
        odometer_start: asset.category === 'vehicle' && form.odometer_start
          ? Number(form.odometer_start)
          : undefined,
      })
    } catch (e) {
      setError(e.message || 'Terjadi kesalahan')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
        <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-subtle flex-shrink-0">
          <CategoryIcon className="w-5 h-5" />
        </div>
        <div>
          <p className="font-bold text-slate-900 text-base tracking-tight">Form Peminjaman</p>
          <p className="text-xs text-slate-500 font-medium">Kategori {CATEGORY_LABEL[asset.category] || asset.category}</p>
        </div>
      </div>

      {error && (
        <div className="px-3.5 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
          {error}
        </div>
      )}

      {/* Nama — WAJIB */}
      <div>
        <label className="label label-required">Nama Peminjam</label>
        <input
          className="input"
          required
          value={form.borrower_name}
          onChange={e => set('borrower_name', e.target.value)}
          placeholder="Nama lengkap Anda"
          autoFocus
        />
      </div>

      {/* Kontak / No. Karyawan */}
      <div>
        <label className="label">No. Karyawan / No. HP <span className="text-slate-400 font-normal lowercase">(opsional)</span></label>
        <input
          className="input"
          value={form.borrower_contact}
          onChange={e => set('borrower_contact', e.target.value)}
          placeholder="EMP-001 atau 0812..."
        />
      </div>

      {/* Rentang Waktu & Tanggal Peminjaman */}
      <div className="space-y-3 p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-indigo-600" />
            <span>Jadwal & Waktu Peminjaman</span>
          </label>
          <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
            {durationHours >= 24 ? `${durationDays} Hari` : `${durationHours} Jam`}
          </span>
        </div>

        {/* Tanggal Mulai Pinjam */}
        <div>
          <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
            Pinjam Mulai (Tanggal & Jam)
          </label>
          <input
            type="datetime-local"
            className="input text-xs"
            required
            value={form.borrowed_at}
            onChange={e => set('borrowed_at', e.target.value)}
          />
        </div>

        {/* Tanggal Rencana Kembali */}
        <div>
          <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
            Rencana Kembali (Tanggal & Jam)
          </label>
          <input
            type="datetime-local"
            className="input text-xs"
            required
            value={form.expected_return_at}
            onChange={e => set('expected_return_at', e.target.value)}
          />
        </div>

        {/* Preset durasi cepat */}
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Quick Presets:</p>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => applyQuickPreset(2)} className="px-2 py-1 bg-white border border-slate-200 hover:border-indigo-400 hover:text-indigo-600 text-[11px] font-semibold rounded-lg text-slate-600 transition-all shadow-subtle">
              +2 Jam
            </button>
            <button type="button" onClick={() => applyQuickPreset(4)} className="px-2 py-1 bg-white border border-slate-200 hover:border-indigo-400 hover:text-indigo-600 text-[11px] font-semibold rounded-lg text-slate-600 transition-all shadow-subtle">
              +4 Jam
            </button>
            <button type="button" onClick={() => applyQuickPreset(24)} className="px-2 py-1 bg-white border border-slate-200 hover:border-indigo-400 hover:text-indigo-600 text-[11px] font-semibold rounded-lg text-slate-600 transition-all shadow-subtle">
              +1 Hari (Besok)
            </button>
            <button type="button" onClick={() => applyQuickPreset(72)} className="px-2 py-1 bg-white border border-slate-200 hover:border-indigo-400 hover:text-indigo-600 text-[11px] font-semibold rounded-lg text-slate-600 transition-all shadow-subtle">
              +3 Hari
            </button>
          </div>
        </div>

        {/* Summary box */}
        {form.borrowed_at && form.expected_return_at && diffMs > 0 && (
          <div className="p-2.5 bg-white rounded-xl border border-slate-200/70 text-[11px] space-y-1 text-slate-600">
            <p className="flex items-center justify-between">
              <span className="text-slate-400">Dari:</span>
              <strong className="text-slate-800">{fmtDisplayDatetime(form.borrowed_at)}</strong>
            </p>
            <p className="flex items-center justify-between">
              <span className="text-slate-400">Sampai:</span>
              <strong className="text-slate-800">{fmtDisplayDatetime(form.expected_return_at)}</strong>
            </p>
          </div>
        )}
      </div>

      {/* Tujuan */}
      <div>
        <label className="label">
          {asset.category === 'vehicle' ? 'Tujuan Pemakaian' :
           asset.category === 'room' ? 'Keperluan Penggunaan' : 'Keperluan / Catatan'}
          <span className="text-slate-400 font-normal lowercase"> (opsional)</span>
        </label>
        <textarea
          className="input"
          rows={2}
          value={form.purpose}
          onChange={e => set('purpose', e.target.value)}
          placeholder={
            asset.category === 'vehicle' ? 'Misal: Antar dokumen ke klien' :
            asset.category === 'room' ? 'Misal: Rapat tim engineering' :
            'Misal: Servis kendaraan unit 03'
          }
        />
      </div>

      {/* Odometer — khusus vehicle */}
      {asset.category === 'vehicle' && (
        <div>
          <label className="label">KM Awal <span className="text-slate-400 font-normal lowercase">(opsional)</span></label>
          <input
            type="number"
            className="input"
            value={form.odometer_start}
            onChange={e => set('odometer_start', e.target.value)}
            placeholder="Misal: 45000"
            min="0"
          />
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full btn-primary btn-lg mt-2 justify-center"
      >
        {loading ? <Spinner size="sm" className="text-white" /> : <CheckCircle2 className="w-4 h-4" />}
        <span>{loading ? 'Memproses...' : 'Konfirmasi Pinjam Aset'}</span>
      </button>
    </form>
  )
}
