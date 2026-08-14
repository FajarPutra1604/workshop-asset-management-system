import { useState, useEffect, useCallback } from 'react'
import imageCompression from 'browser-image-compression'
import { Plus, Search, QrCode, Pencil, Trash2, Wrench, ChevronLeft, ChevronRight, FileSpreadsheet, Download, Upload, Camera, Printer } from 'lucide-react'
import AdminLayout from '../../components/AdminLayout'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { QRCodeDisplay, QRCodePrint } from '../../components/QRCodeDisplay'
import client from '../../api/client'

const EMPTY_FORM = {
  name: '', category: '', description: '', status: 'available',
  model: '', plate_number: '', last_odometer: '',
  location: '', capacity: '', quantity: '',
}

const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.2,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
}

function AssetForm({ initial, onSubmit, loading, error, constants, initialPhoto }) {
  const [form, setForm] = useState(initial || EMPTY_FORM)
  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(initialPhoto || null)
  const [removePhoto, setRemovePhoto] = useState(false)
  const [compressing, setCompressing] = useState(false)

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  async function handlePhotoChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setRemovePhoto(false)
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

  function handleRemovePhoto() {
    setRemovePhoto(true)
    setPhoto(null)
    setPhotoPreview(null)
  }

  function handleSubmit(e) {
    e.preventDefault()
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => { if (v !== '') fd.append(k, v) })
    if (photo) fd.append('photo', photo)
    if (removePhoto) fd.append('remove_photo', '1')
    onSubmit(fd)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="px-3.5 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
        <div className="sm:col-span-2">
          <label className="label label-required">Nama Aset</label>
          <input className="input" required value={form.name}
            onChange={e => set('name', e.target.value)} placeholder="Kunci No. 13" />
        </div>

        <div>
          <label className="label label-required">Kategori</label>
          <select className="input" value={form.category} onChange={e => set('category', e.target.value)}>
            {(constants?.categories || []).map(c => (
              <option key={c.slug} value={c.slug}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Status</label>
          <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
            {(constants?.asset_statuses || []).filter(s => s.slug !== 'borrowed').map(s => (
              <option key={s.slug} value={s.slug}>{s.name}</option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="label">Deskripsi</label>
          <textarea className="input" rows={2} value={form.description}
            onChange={e => set('description', e.target.value)} placeholder="Deskripsi singkat..." />
        </div>

        {form.category === 'tool' && !initial && (
          <div className="sm:col-span-2">
            <label className="label">Jumlah Unit <span className="text-slate-400 font-normal lowercase">(barang yang sama banyak)</span></label>
            <input type="number" min="1" max="500" className="input" value={form.quantity}
              onChange={e => set('quantity', e.target.value)} placeholder="Misal: 20 (1 = satu barang)" />
            {Number(form.quantity) > 1 && (
              <p className="mt-1.5 text-[11px] font-medium text-indigo-600">
                Akan membuat {form.quantity} unit: "{form.name || 'Nama Aset'} (Unit 1)" s/d "(Unit {form.quantity})", masing-masing dengan QR sendiri.
              </p>
            )}
          </div>
        )}

        <div className="sm:col-span-2">
          <label className="label">Foto Aset</label>
          <label className="block w-full rounded-2xl border-2 border-dashed cursor-pointer
                         transition-all overflow-hidden
                         ${photoPreview ? 'border-emerald-300 bg-emerald-50/40' : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/80'}">
            <input type="file" accept="image/*" capture="environment"
              onChange={handlePhotoChange} className="sr-only" />
            {compressing ? (
              <div className="flex flex-col items-center justify-center py-6 gap-2">
                <Spinner />
                <p className="text-xs font-medium text-slate-500">Mengkompresi foto...</p>
              </div>
            ) : photoPreview ? (
              <div className="relative">
                <img src={photoPreview} alt="Preview" className="w-full max-h-44 object-cover" />
                <span className="absolute top-2.5 right-2.5 bg-emerald-600 text-white text-[11px] font-semibold px-2 py-0.5 rounded-lg">
                  {initialPhoto && !photo ? 'Foto saat ini' : 'Siap upload'}
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 gap-1.5 text-slate-500">
                <Camera className="w-6 h-6" />
                <p className="text-xs font-semibold text-slate-700">Pilih / ambil foto</p>
                <p className="text-[11px] text-slate-400">Otomatis dikompresi ke max 200KB</p>
              </div>
            )}
          </label>
          {photoPreview && (
            <button type="button" onClick={handleRemovePhoto}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-rose-600 hover:text-rose-800">
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus Foto</span>
            </button>
          )}
          {removePhoto && (
            <p className="mt-1 text-[11px] text-rose-500">Foto aset akan dihapus saat disimpan.</p>
          )}
        </div>
      </div>

      {/* Vehicle fields */}
      {form.category === 'vehicle' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4 pt-3 border-t border-slate-100">
          <p className="sm:col-span-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Detail Kendaraan</p>
          <div>
            <label className="label">Model</label>
            <input className="input" value={form.model} onChange={e => set('model', e.target.value)} placeholder="Toyota Avanza" />
          </div>
          <div>
            <label className="label">No. Polisi</label>
            <input className="input" value={form.plate_number} onChange={e => set('plate_number', e.target.value)} placeholder="B 1234 XYZ" />
          </div>
          <div>
            <label className="label">Odometer (km)</label>
            <input type="number" className="input" value={form.last_odometer}
              onChange={e => set('last_odometer', e.target.value)} placeholder="0" min="0" />
          </div>
        </div>
      )}

      {/* Room fields */}
      {form.category === 'room' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4 pt-3 border-t border-slate-100">
          <p className="sm:col-span-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Detail Ruangan</p>
          <div>
            <label className="label">Lokasi</label>
            <input className="input" value={form.location} onChange={e => set('location', e.target.value)} placeholder="Lantai 2, Gedung A" />
          </div>
          <div>
            <label className="label">Kapasitas</label>
            <input type="number" className="input" value={form.capacity}
              onChange={e => set('capacity', e.target.value)} placeholder="10" min="1" />
          </div>
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 pt-3 border-t border-slate-100">
        <button type="submit" disabled={loading} className="btn-primary w-full sm:w-auto">
          {loading && <Spinner size="sm" className="text-white" />}
          {loading ? 'Menyimpan...' : 'Simpan Aset'}
        </button>
      </div>
    </form>
  )
}

function ImportExcelModal({ categories, onClose, onImported }) {
  const [selected, setSelected] = useState(null)
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  async function downloadTemplate(cat) {
    try {
      const res = await client.get(`/assets/import-template/${cat.slug}`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `template-${cat.slug}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e.response?.data?.error || 'Gagal mengunduh template')
    }
  }

  async function handleImport() {
    if (!file || !selected) return
    setLoading(true); setError(null); setResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('category', selected.slug)
      const { data } = await client.post('/assets/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setResult(data)
      setFile(null)
      onImported()
    } catch (e) {
      setError(e.response?.data?.error || 'Gagal melakukan import')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="px-3.5 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">{error}</div>
      )}

      {result && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-2">
          <div className="flex flex-wrap gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
              {result.imported} berhasil
            </span>
            {result.skipped > 0 && (
              <span className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold">
                {result.skipped} dilewati (nama sudah ada)
              </span>
            )}
          </div>
          {result.errors.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-1.5">{result.errors.length} baris bermasalah:</p>
              <ul className="max-h-36 overflow-y-auto space-y-1 text-xs text-slate-500">
                {result.errors.map((e, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-slate-400 font-mono flex-shrink-0">Baris {e.row > 0 ? e.row : '-'}</span>
                    <span className="truncate">{[e.name, e.error].filter(Boolean).join(' — ')}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div>
        <label className="label label-required">1. Pilih Kategori</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {(categories || []).map((c) => (
            <button
              key={c.slug}
              type="button"
              onClick={() => { setSelected(c); setResult(null); setError(null) }}
              className={`px-3 py-3 rounded-xl border text-sm font-semibold transition-all flex items-center justify-center gap-2
                ${selected?.slug === c.slug
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500/20'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50/40'}`}
            >
              <span>{c.icon}</span>
              <span>{c.name}</span>
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
          <div className="text-xs text-slate-600 leading-relaxed">
            <p className="font-bold text-slate-800 text-sm mb-0.5">Template {selected.name}</p>
            <p>Kolom wajib: <strong>Nama Aset</strong>. Baris dengan nama sudah ada otomatis dilewati.</p>
            {selected.slug === 'tool' && (
              <p className="text-[11px] text-slate-500 mt-1">Template Barang punya kolom <strong>Jumlah</strong> (opsional) — isi angka untuk membuat banyak unit sekaligus.</p>
            )}
          </div>
          <button type="button" className="btn-secondary w-full sm:w-auto justify-center flex-shrink-0" onClick={() => downloadTemplate(selected)}>
            <Download className="w-4 h-4" />
            <span>Download Template</span>
          </button>
        </div>
      )}

      <div>
        <label className="label">2. Upload File Excel</label>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={(e) => { setFile(e.target.files[0]); setResult(null); setError(null) }}
          className="block w-full text-xs text-slate-600
                     file:mr-3 file:py-2 file:px-3.5 file:rounded-xl
                     file:border-0 file:text-xs file:font-semibold
                     file:bg-indigo-50 file:text-indigo-700
                     hover:file:bg-indigo-100 cursor-pointer transition-all"
        />
      </div>

      <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 pt-2 border-t border-slate-100">
        <button className="btn-secondary w-full sm:w-auto justify-center" onClick={onClose}>Tutup</button>
        <button className="btn-primary w-full sm:w-auto justify-center" disabled={!file || !selected || loading} onClick={handleImport}>
          {loading && <Spinner size="sm" className="text-white" />}
          <Upload className="w-4 h-4" />
          <span>{loading ? 'Mengimpor...' : 'Import Excel'}</span>
        </button>
      </div>
    </div>
  )
}

function PrintQRModal({ assets, loading, onClose }) {
  return (
    <div className="space-y-4">
      {loading ? (
        <div className="flex items-center justify-center py-10"><Spinner size="lg" /></div>
      ) : assets.length === 0 ? (
        <div className="text-center py-10 text-sm text-slate-500">
          <QrCode className="w-8 h-8 mx-auto text-slate-300 mb-2" />
          Tidak ada aset untuk dicetak. Ubah filter atau tambah aset dulu.
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              <strong className="text-slate-800">{assets.length}</strong> aset siap dicetak
            </p>
            <p className="text-[11px] text-slate-400">Klik Print untuk mencetak label QR</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-96 overflow-y-auto bg-white rounded-xl border border-slate-200/70 p-3">
            {assets.map((a) => (
              <QRCodePrint key={a.id} assetCode={a.asset_code} assetName={a.name} />
            ))}
          </div>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button className="btn-secondary w-full sm:w-auto justify-center" onClick={onClose}>Tutup</button>
            <button className="btn-primary w-full sm:w-auto justify-center" onClick={() => window.print()}>
              <Printer className="w-4 h-4" />
              <span>Print QR</span>
            </button>
          </div>
        </>
      )}
    </div>
  )
}

const ADMIN_KEY = 'wabt_admin'

function getRole() {
  try { return JSON.parse(localStorage.getItem(ADMIN_KEY) || 'null')?.role || 'viewer' } catch { return 'viewer' }
}

export default function Assets() {
  const [assets, setAssets] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ category: '', status: '', search: '' })
  const [page, setPage] = useState(1)
  const [role] = useState(getRole)
  const canWrite = role === 'admin' || role === 'superadmin'
  const [constants, setConstants] = useState(null)

  // Modals
  const [modalCreate, setModalCreate] = useState(false)
  const [modalEdit, setModalEdit] = useState(null)   // asset object
  const [modalQR, setModalQR] = useState(null)       // asset object
  const [modalDelete, setModalDelete] = useState(null) // asset object
  const [modalImport, setModalImport] = useState(false)
  const [modalPrint, setModalPrint] = useState(false)
  const [printAssets, setPrintAssets] = useState([])
  const [printLoading, setPrintLoading] = useState(false)

  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState(null)

  const fetchAssets = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit: 20, ...filters }
      Object.keys(params).forEach(k => { if (!params[k]) delete params[k] })
      const { data } = await client.get('/assets', { params })
      setAssets(data.data)
      setPagination(data.pagination)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [page, filters])

  useEffect(() => { fetchAssets() }, [fetchAssets])
  useEffect(() => {
    client.get('/settings/constants').then(({ data }) => setConstants(data)).catch(() => {})
  }, [])

  async function handleCreate(fd) {
    setFormLoading(true); setFormError(null)
    try {
      await client.post('/assets', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setModalCreate(false)
      fetchAssets()
    } catch (e) {
      setFormError(e.response?.data?.error || 'Gagal membuat aset')
    } finally { setFormLoading(false) }
  }

  async function handleUpdate(fd) {
    setFormLoading(true); setFormError(null)
    try {
      await client.put(`/assets/${modalEdit.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setModalEdit(null)
      fetchAssets()
    } catch (e) {
      setFormError(e.response?.data?.error || 'Gagal memperbarui aset')
    } finally { setFormLoading(false) }
  }

  async function handleDelete() {
    try {
      await client.delete(`/assets/${modalDelete.id}`)
      setModalDelete(null)
      fetchAssets()
    } catch (e) {
      alert(e.response?.data?.error || 'Gagal menghapus aset')
    }
  }

  const setFilter = (k, v) => { setFilters(f => ({ ...f, [k]: v })); setPage(1) }

  async function handleExport() {
    try {
      const params = { ...filters }
      Object.keys(params).forEach(k => { if (!params[k]) delete params[k] })
      const res = await client.get('/assets/export', { params, responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = 'export-aset.xlsx'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert(e.response?.data?.error || 'Gagal export Excel')
    }
  }

  async function openPrintModal() {
    setModalPrint(true)
    setPrintLoading(true)
    setPrintAssets([])
    try {
      const params = {}
      if (filters.category) params.category = filters.category
      if (filters.status) params.status = filters.status
      const { data } = await client.get('/assets/print', { params })
      setPrintAssets(data.data)
    } catch (e) {
      alert(e.response?.data?.error || 'Gagal memuat data QR')
      setModalPrint(false)
    } finally {
      setPrintLoading(false)
    }
  }

  // Hitung jumlah unit per nama dasar (untuk badge "×N" barang yang sama)
  const unitCounts = {}
  assets.forEach((a) => {
    const base = a.name.replace(/\s*\(Unit \d+\)\s*$/i, '')
    unitCounts[base] = (unitCounts[base] || 0) + 1
  })

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto animate-fade-in space-y-4 sm:space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">Manajemen Aset</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {pagination.total} aset terdaftar dalam sistem
            </p>
          </div>
          {canWrite && (
            <div className="flex flex-col sm:flex-row gap-2.5">
              <button className="btn-secondary w-full sm:w-auto justify-center" onClick={handleExport}>
                <Download className="w-4 h-4" />
                <span>Export Excel</span>
              </button>
              <button className="btn-secondary w-full sm:w-auto justify-center" onClick={openPrintModal}>
                <QrCode className="w-4 h-4" />
                <span>Cetak QR</span>
              </button>
              <button className="btn-secondary w-full sm:w-auto justify-center" onClick={() => { setModalImport(true) }}>
                <FileSpreadsheet className="w-4 h-4" />
                <span>Import Excel</span>
              </button>
              <button className="btn-primary w-full sm:w-auto justify-center" onClick={() => { setFormError(null); setModalCreate(true) }}>
                <Plus className="w-4 h-4" />
                <span>Tambah Aset</span>
              </button>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="card">
          <div className="p-3 sm:p-3.5 flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="input pl-10"
                placeholder="Cari nama atau deskripsi aset..."
                value={filters.search}
                onChange={e => setFilter('search', e.target.value)}
              />
            </div>
            <select className="input sm:w-44" value={filters.category}
              onChange={e => setFilter('category', e.target.value)}>
              <option value="">Semua Kategori</option>
              {(constants?.categories || []).map(c => (
                <option key={c.slug} value={c.slug}>{c.name}</option>
              ))}
            </select>
            <select className="input sm:w-40" value={filters.status}
              onChange={e => setFilter('status', e.target.value)}>
              <option value="">Semua Status</option>
              {(constants?.asset_statuses || []).map(s => (
                <option key={s.slug} value={s.slug}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>
          ) : assets.length === 0 ? (
            <EmptyState
              icon={<Wrench className="w-6 h-6 text-slate-400" />}
              title="Belum ada aset"
              description="Tambah aset pertama untuk mulai mengelola inventori workshop."
              action={canWrite ? (
                <button className="btn-primary btn-sm" onClick={() => setModalCreate(true)}>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Aset</span>
                </button>
              ) : undefined}
            />
          ) : (
            <>
              <div className="table-wrapper border-0 rounded-none shadow-none">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Aset</th>
                      <th>Kategori</th>
                      <th>Status</th>
                      <th>Kode QR</th>
                      <th className="text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map(asset => {
                      const base = asset.name.replace(/\s*\(Unit \d+\)\s*$/i, '')
                      const unitCount = unitCounts[base] || 1
                      return (
                      <tr key={asset.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            {asset.photo_url ? (
                              <img src={asset.photo_url} alt={asset.name}
                                className="w-9 h-9 rounded-xl object-cover border border-slate-200 flex-shrink-0" />
                            ) : (
                              <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 font-semibold text-xs flex-shrink-0">
                                {asset.name[0]?.toUpperCase()}
                              </div>
                            )}
                            <div>
                              <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                                {asset.name}
                                {unitCount > 1 && (
                                  <span className="badge bg-indigo-50 text-indigo-600 border-indigo-200/60 px-1.5 py-0 text-[10px]">×{unitCount}</span>
                                )}
                              </p>
                              {asset.description && (
                                <p className="text-xs text-slate-500 truncate max-w-xs">{asset.description}</p>
                              )}
                              {asset.plate_number && (
                                <p className="text-[11px] text-slate-400 font-mono">{asset.plate_number}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td><Badge category={asset.category} /></td>
                        <td><Badge status={asset.status} /></td>
                        <td>
                          <code className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded-md border border-slate-200/60">
                            {asset.asset_code}
                          </code>
                        </td>
                        <td>
                          <div className="flex items-center justify-end gap-1">
                            <button title="QR Code"
                              onClick={() => setModalQR(asset)}
                              className="btn-ghost btn-sm text-indigo-600 hover:bg-indigo-50/80">
                              <QrCode className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">QR</span>
                            </button>
                            {canWrite && (
                              <button title="Edit"
                                onClick={() => { setFormError(null); setModalEdit(asset) }}
                                className="btn-ghost btn-sm">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {canWrite && (
                              <button title="Hapus"
                                onClick={() => setModalDelete(asset)}
                                className="btn-ghost btn-sm text-rose-600 hover:bg-rose-50/80">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.pages > 1 && (
                <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-t border-slate-100 bg-slate-50/40">
                  <p className="text-xs text-slate-500 font-medium">
                    Halaman {page} dari {pagination.pages}
                  </p>
                  <div className="flex gap-2">
                    <button className="btn-secondary btn-sm" disabled={page <= 1}
                      onClick={() => setPage(p => p - 1)}>
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Prev</span>
                    </button>
                    <button className="btn-secondary btn-sm" disabled={page >= pagination.pages}
                      onClick={() => setPage(p => p + 1)}>
                      <span className="hidden sm:inline">Next</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal: Create */}
        <Modal open={modalCreate} onClose={() => setModalCreate(false)} title="Tambah Aset Baru" size="lg">
          <AssetForm onSubmit={handleCreate} loading={formLoading} error={formError} constants={constants} />
        </Modal>

        {/* Modal: Edit */}
        <Modal open={!!modalEdit} onClose={() => setModalEdit(null)} title="Edit Aset" size="lg">
          {modalEdit && (
            <AssetForm
              key={modalEdit.id}
              initial={{
                name: modalEdit.name,
                category: modalEdit.category,
                description: modalEdit.description || '',
                status: modalEdit.status,
                model: modalEdit.model || '',
                plate_number: modalEdit.plate_number || '',
                last_odometer: modalEdit.last_odometer || '',
                location: modalEdit.location || '',
                capacity: modalEdit.capacity || '',
              }}
              onSubmit={handleUpdate}
              loading={formLoading}
              error={formError}
              constants={constants}
              initialPhoto={modalEdit.photo_url || null}
            />
          )}
        </Modal>

        {/* Modal: QR Code */}
        <Modal open={!!modalQR} onClose={() => setModalQR(null)} title="QR Code Aset" size="sm">
          {modalQR && <QRCodeDisplay assetCode={modalQR.asset_code} assetName={modalQR.name} />}
        </Modal>

        {/* Modal: Import Excel */}
        <Modal open={modalImport} onClose={() => setModalImport(false)} title="Import Aset dari Excel" size="lg">
          <ImportExcelModal categories={constants?.categories} onClose={() => setModalImport(false)} onImported={fetchAssets} />
        </Modal>

        {/* Modal: Cetak QR Massal */}
        <Modal open={modalPrint} onClose={() => setModalPrint(false)} title="Cetak QR Massal" size="lg">
          <PrintQRModal assets={printAssets} loading={printLoading} onClose={() => setModalPrint(false)} />
        </Modal>

        {/* Area cetak QR (hanya tampil saat print) */}
        {modalPrint && printAssets.length > 0 && (
          <div className="print-only">
            <div className="grid grid-cols-3 gap-4 p-6">
              {printAssets.map((a) => (
                <div key={a.id} className="qr-label">
                  <QRCodePrint assetCode={a.asset_code} assetName={a.name} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal: Delete Confirmation */}
        <Modal open={!!modalDelete} onClose={() => setModalDelete(null)} title="Hapus Aset" size="sm">
          {modalDelete && (
            <div className="text-center space-y-4 py-2">
              <p className="text-sm text-slate-700">
                Yakin ingin menghapus <strong className="text-slate-900">{modalDelete.name}</strong>?
              </p>
              <p className="text-xs text-slate-500">Aset akan dihapus secara permanen dari daftar inventori.</p>
              <div className="flex flex-col-reverse sm:flex-row justify-center gap-2.5 pt-2">
                <button className="btn-secondary btn-sm w-full sm:w-auto" onClick={() => setModalDelete(null)}>Batal</button>
                <button className="btn-danger btn-sm w-full sm:w-auto" onClick={handleDelete}>Hapus Aset</button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </AdminLayout>
  )
}
