import { useState } from 'react'
import imageCompression from 'browser-image-compression'
import { Package, Camera, CheckCircle2, AlertCircle } from 'lucide-react'
import { Spinner } from './ui/Spinner'

const CONDITION_OPTIONS = [
  { value: '', label: 'Tidak ada catatan' },
  { value: 'Baik', label: 'Baik' },
  { value: 'Rusak', label: 'Rusak' },
  { value: 'Hilang sebagian', label: 'Hilang sebagian' },
]

const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.2,          // 200KB
  maxWidthOrHeight: 1920,
  useWebWorker: true,
  onProgress: () => {},
}

export default function ReturnForm({ asset, activeTx, onSubmit }) {
  const [form, setForm] = useState({
    return_by_name: '',
    return_note: '',
    odometer_end: '',
  })
  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [compressing, setCompressing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const photoRequired = asset.category === 'vehicle'

  async function handlePhotoChange(e) {
    const file = e.target.files[0]
    if (!file) return

    setCompressing(true)
    try {
      const compressed = await imageCompression(file, COMPRESSION_OPTIONS)
      setPhoto(compressed)
      setPhotoPreview(URL.createObjectURL(compressed))
    } catch (err) {
      console.error('Compression error:', err)
      setPhoto(file)
      setPhotoPreview(URL.createObjectURL(file))
    } finally {
      setCompressing(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (photoRequired && !photo) {
      setError('Foto kondisi kendaraan wajib diupload')
      return
    }

    setLoading(true); setError(null)
    try {
      const fd = new FormData()
      fd.append('asset_code', asset.asset_code)
      fd.append('return_by_name', form.return_by_name)
      if (form.return_note) fd.append('return_note', form.return_note)
      if (form.odometer_end) fd.append('odometer_end', form.odometer_end)
      if (photo) fd.append('return_photo', photo)

      await onSubmit(fd)
    } catch (e) {
      setError(e.message || 'Terjadi kesalahan')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-3 p-3.5 bg-indigo-50/60 rounded-2xl border border-indigo-100/80 mb-2">
        <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-subtle flex-shrink-0">
          <Package className="w-4 h-4" />
        </div>
        <div>
          <p className="text-xs font-bold text-indigo-900">Sedang Dipinjam Oleh:</p>
          <p className="text-xs font-semibold text-indigo-700">{activeTx?.borrower_name}</p>
          {activeTx?.borrowed_at && (
            <p className="text-[11px] text-indigo-500 font-medium mt-0.5">
              Sejak {new Date(activeTx.borrowed_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          )}
        </div>
      </div>

      {error && (
        <div className="px-3.5 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
          {error}
        </div>
      )}

      <div>
        <label className="label label-required">Nama Pengembali</label>
        <input
          className="input"
          required
          value={form.return_by_name}
          onChange={e => set('return_by_name', e.target.value)}
          placeholder="Nama Anda (boleh sama dengan peminjam)"
          autoFocus
        />
      </div>

      <div>
        <label className="label">
          Catatan Kondisi
          <span className="text-slate-400 font-normal lowercase"> (opsional)</span>
        </label>
        <select className="input" value={form.return_note}
          onChange={e => set('return_note', e.target.value)}>
          {CONDITION_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {form.return_note === 'Rusak' && (
          <textarea
            className="input mt-2"
            rows={2}
            placeholder="Jelaskan kerusakan lebih detail..."
            onChange={e => set('return_note', `Rusak: ${e.target.value}`)}
          />
        )}
      </div>

      {/* Odometer — vehicle */}
      {asset.category === 'vehicle' && (
        <div>
          <label className="label">KM Akhir <span className="text-slate-400 font-normal lowercase">(opsional)</span></label>
          <input
            type="number"
            className="input"
            value={form.odometer_end}
            onChange={e => set('odometer_end', e.target.value)}
            placeholder="Misal: 45238"
            min="0"
          />
        </div>
      )}

      {/* Foto upload */}
      <div>
        <label className={`label ${photoRequired ? 'label-required' : ''}`}>
          Foto Kondisi Saat Kembali
          {!photoRequired && <span className="text-slate-400 font-normal lowercase"> (opsional)</span>}
        </label>

        {/* Camera capture for mobile */}
        <label className={`block w-full rounded-2xl border-2 border-dashed
                           ${photoPreview ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200 bg-slate-50/60'}
                           cursor-pointer hover:bg-slate-100/80 transition-all overflow-hidden`}>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoChange}
            className="sr-only"
            required={photoRequired && !photo}
          />
          {compressing ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <Spinner />
              <p className="text-xs font-medium text-slate-500">Mengkompresi foto...</p>
            </div>
          ) : photoPreview ? (
            <div className="relative">
              <img src={photoPreview} alt="Preview" className="w-full max-h-48 object-cover" />
              <div className="absolute bottom-2.5 right-2.5 bg-emerald-600 text-white text-[11px] font-semibold px-2.5 py-1 rounded-lg shadow-sm flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Siap upload</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200/80 flex items-center justify-center text-slate-500 shadow-subtle">
                <Camera className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold text-slate-700">Ambil foto / pilih dari galeri</p>
              <p className="text-[11px] text-slate-400">Otomatis dikompresi ke max 200KB</p>
            </div>
          )}
        </label>
      </div>

      <button
        type="submit"
        disabled={loading || compressing}
        className="w-full btn-success btn-lg mt-2 justify-center"
      >
        {loading ? <Spinner size="sm" className="text-white" /> : <CheckCircle2 className="w-4 h-4" />}
        <span>{loading ? 'Memproses...' : 'Konfirmasi Kembalikan'}</span>
      </button>
    </form>
  )
}
