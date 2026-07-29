import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, QrCode, Pencil, Trash2, Wrench, ChevronLeft, ChevronRight } from 'lucide-react'
import AdminLayout from '../../components/AdminLayout'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { QRCodeDisplay } from '../../components/QRCodeDisplay'
import client from '../../api/client'

const EMPTY_FORM = {
  name: '', category: '', description: '', status: 'available',
  model: '', plate_number: '', last_odometer: '',
  location: '', capacity: '',
}

function AssetForm({ initial, onSubmit, loading, error, constants }) {
  const [form, setForm] = useState(initial || EMPTY_FORM)
  const [photo, setPhoto] = useState(null)

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  function handleSubmit(e) {
    e.preventDefault()
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => { if (v !== '') fd.append(k, v) })
    if (photo) fd.append('photo', photo)
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

        <div className="sm:col-span-2">
          <label className="label">Foto Aset</label>
          <input type="file" accept="image/*"
            onChange={e => setPhoto(e.target.files[0])}
            className="block w-full text-xs text-slate-600
                       file:mr-3 file:py-2 file:px-3.5 file:rounded-xl
                       file:border-0 file:text-xs file:font-semibold
                       file:bg-indigo-50 file:text-indigo-700
                       hover:file:bg-indigo-100 cursor-pointer transition-all" />
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
            <button className="btn-primary w-full sm:w-auto justify-center" onClick={() => { setFormError(null); setModalCreate(true) }}>
              <Plus className="w-4 h-4" />
              <span>Tambah Aset</span>
            </button>
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
                    {assets.map(asset => (
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
                              <p className="font-semibold text-slate-900">{asset.name}</p>
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
                    ))}
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
                model: modalEdit.vehicle_detail?.model || '',
                plate_number: modalEdit.vehicle_detail?.plate_number || '',
                last_odometer: modalEdit.vehicle_detail?.last_odometer || '',
                location: modalEdit.room_detail?.location || '',
                capacity: modalEdit.room_detail?.capacity || '',
              }}
              onSubmit={handleUpdate}
              loading={formLoading}
              error={formError}
              constants={constants}
            />
          )}
        </Modal>

        {/* Modal: QR Code */}
        <Modal open={!!modalQR} onClose={() => setModalQR(null)} title="QR Code Aset" size="sm">
          {modalQR && <QRCodeDisplay assetCode={modalQR.asset_code} assetName={modalQR.name} />}
        </Modal>

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
