import { useState, useEffect, useCallback } from 'react'
import { Search, RotateCcw, Camera, ClipboardList, ChevronLeft, ChevronRight, Download, Undo2, Trash2 } from 'lucide-react'
import AdminLayout from '../../components/AdminLayout'
import { Badge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { Modal } from '../../components/ui/Modal'
import client from '../../api/client'

const ADMIN_KEY = 'wabt_admin'

function getRole() {
  try { return JSON.parse(localStorage.getItem(ADMIN_KEY) || 'null')?.role || 'viewer' } catch { return 'viewer' }
}

const STATUS_OPTIONS = [
  { value: '', label: 'Semua Status' },
  { value: 'active', label: 'Aktif' },
  { value: 'returned', label: 'Dikembalikan' },
  { value: 'overdue', label: 'Overdue' },
]

const CATEGORY_OPTIONS = [
  { value: '', label: 'Semua Kategori' },
  { value: 'tool', label: 'Tool' },
  { value: 'vehicle', label: 'Kendaraan' },
  { value: 'room', label: 'Ruangan' },
]

function fmt(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })
}

function durationStr(borrowedAt, returnedAt, expectedAt) {
  const end = returnedAt ? new Date(returnedAt) : new Date()
  const start = new Date(borrowedAt)
  const hrs = Math.round((end - start) / 3600000 * 10) / 10
  const isOver = !returnedAt && expectedAt && new Date(expectedAt) < new Date()
  return (
    <span className={isOver ? 'text-rose-600 font-bold' : 'text-slate-600 font-medium'}>
      {hrs < 24 ? `${hrs} jam` : `${(hrs / 24).toFixed(1)} hari`}
      {isOver && ' (overdue)'}
    </span>
  )
}

function lateReturnText(tx) {
  if (!tx.is_late_return) return null
  const ms = new Date(tx.returned_at) - new Date(tx.expected_return_at)
  const days = Math.floor(ms / 86400000)
  return days > 0 ? `Telat ${days} hari` : 'Telat'
}

export default function Transactions() {
  const [transactions, setTransactions] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ status: '', category: '', search: '', from: '', to: '' })
  const [page, setPage] = useState(1)
  const [viewPhoto, setViewPhoto] = useState(null) // transaction object untuk lihat foto
  const [role] = useState(getRole)
  const canManage = role === 'admin' || role === 'superadmin'
  const [actionTx, setActionTx] = useState(null) // { tx, type: 'return' | 'delete' }
  const [actionLoading, setActionLoading] = useState(false)

  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit: 25, ...filters }
      Object.keys(params).forEach(k => { if (!params[k]) delete params[k] })
      const { data } = await client.get('/transactions', { params })
      setTransactions(data.data)
      setPagination(data.pagination)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [page, filters])

  useEffect(() => { fetchTransactions() }, [fetchTransactions])

  const setFilter = (k, v) => { setFilters(f => ({ ...f, [k]: v })); setPage(1) }

  async function handleForceReturn() {
    setActionLoading(true)
    try {
      await client.put(`/transactions/${actionTx.tx.id}/return`)
      setActionTx(null)
      fetchTransactions()
    } catch (e) {
      alert(e.response?.data?.error || 'Gagal menandai dikembalikan')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleDeleteTx() {
    setActionLoading(true)
    try {
      await client.delete(`/transactions/${actionTx.tx.id}`)
      setActionTx(null)
      fetchTransactions()
    } catch (e) {
      alert(e.response?.data?.error || 'Gagal menghapus transaksi')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto animate-fade-in space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Riwayat Transaksi</h1>
          <p className="text-xs text-slate-500 mt-0.5">{pagination.total} transaksi terdaftar</p>
        </div>

        {/* Filters */}
        <div className="card">
          <div className="p-3.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            <div className="relative lg:col-span-2">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="input pl-10"
                placeholder="Cari nama peminjam atau aset..."
                value={filters.search}
                onChange={e => setFilter('search', e.target.value)}
              />
            </div>
            <select className="input" value={filters.status}
              onChange={e => setFilter('status', e.target.value)}>
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select className="input" value={filters.category}
              onChange={e => setFilter('category', e.target.value)}>
              {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button className="btn-secondary btn-sm flex items-center justify-center gap-1.5" onClick={() => {
              setFilters({ status: '', category: '', search: '', from: '', to: '' })
              setPage(1)
            }}>
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>

          {/* Date range */}
          <div className="px-3.5 pb-3.5 pt-1 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Dari:</label>
              <input type="date" className="input text-xs py-1.5"
                value={filters.from}
                onChange={e => setFilter('from', e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sampai:</label>
              <input type="date" className="input text-xs py-1.5"
                value={filters.to}
                onChange={e => setFilter('to', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>
          ) : transactions.length === 0 ? (
            <EmptyState icon={<ClipboardList className="w-6 h-6 text-slate-400" />} title="Tidak ada transaksi" description="Belum ada transaksi yang cocok dengan filter yang dipilih." />
          ) : (
            <>
              <div className="table-wrapper border-0 rounded-none shadow-none">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Peminjam</th>
                      <th>Aset</th>
                      <th>Mulai Pinjam</th>
                      <th>Dikembalikan</th>
                      <th>Durasi</th>
                      <th>Status</th>
                      <th>Foto</th>
                      {canManage && <th className="text-right">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map(tx => {
                      const isOverdue = tx.is_overdue ||
                        (tx.status === 'active' && tx.expected_return_at &&
                          new Date(tx.expected_return_at) < new Date())
                      return (
                        <tr key={tx.id} className={isOverdue ? 'bg-rose-50/20 hover:bg-rose-50/40' : ''}>
                          <td>
                            <p className="font-semibold text-slate-900">{tx.borrower_name}</p>
                            {tx.borrower_contact && (
                              <p className="text-[11px] text-slate-400 font-mono">{tx.borrower_contact}</p>
                            )}
                          </td>
                          <td>
                            <p className="font-semibold text-slate-800">{tx.asset_name}</p>
                            <Badge category={tx.category} className="mt-1" />
                          </td>
                          <td className="text-xs">
                            <p className="text-slate-800 font-medium">{fmt(tx.borrowed_at)}</p>
                            {tx.expected_return_at && (
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                Est. kembali: {fmt(tx.expected_return_at)}
                              </p>
                            )}
                          </td>
                          <td className="text-xs text-slate-700 font-medium">{fmt(tx.returned_at)}</td>
                          <td className="text-xs">{durationStr(tx.borrowed_at, tx.returned_at, tx.expected_return_at)}</td>
                          <td>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge status={isOverdue ? 'overdue' : tx.status} />
                              {lateReturnText(tx) && (
                                <span className="badge bg-rose-50 text-rose-600 border-rose-200/80">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0" />
                                  {lateReturnText(tx)}
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            {tx.return_photo_url ? (
                              <button onClick={() => setViewPhoto(tx)}
                                className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                                <Camera className="w-3.5 h-3.5" />
                                <span>Lihat</span>
                              </button>
                            ) : <span className="text-slate-300 text-xs">—</span>}
                          </td>
                          {canManage && (
                            <td>
                              <div className="flex items-center justify-end gap-1">
                                {tx.status === 'active' && (
                                  <button title="Tandai Dikembalikan"
                                    onClick={() => setActionTx({ tx, type: 'return' })}
                                    className="btn-ghost btn-sm text-emerald-600 hover:bg-emerald-50/80">
                                    <Undo2 className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">Kembalikan</span>
                                  </button>
                                )}
                                <button title="Hapus Transaksi"
                                  onClick={() => setActionTx({ tx, type: 'delete' })}
                                  className="btn-ghost btn-sm text-rose-600 hover:bg-rose-50/80">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.pages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/40">
                  <p className="text-xs text-slate-500 font-medium">
                    Halaman {page} dari {pagination.pages} ({pagination.total} total)
                  </p>
                  <div className="flex gap-2">
                    <button className="btn-secondary btn-sm" disabled={page <= 1}
                      onClick={() => setPage(p => p - 1)}>
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Prev</span>
                    </button>
                    <button className="btn-secondary btn-sm" disabled={page >= pagination.pages}
                      onClick={() => setPage(p => p + 1)}>
                      <span>Next</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal: Lihat Foto Pengembalian */}
        <Modal open={!!viewPhoto} onClose={() => setViewPhoto(null)} title="Foto Pengembalian" size="lg">
          {viewPhoto && (
            <div className="space-y-4">
              <div className="text-xs text-slate-500">
                <p><strong className="text-slate-800">{viewPhoto.asset_name}</strong> — dipinjam oleh {viewPhoto.borrower_name}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 overflow-hidden bg-slate-100 flex items-center justify-center">
                <img
                  src={viewPhoto.return_photo_url}
                  alt={`Foto pengembalian ${viewPhoto.asset_name}`}
                  className="max-w-full max-h-[60vh] object-contain"
                />
              </div>
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button className="btn-secondary w-full sm:w-auto justify-center" onClick={() => setViewPhoto(null)}>Tutup</button>
                <a
                  className="btn-primary w-full sm:w-auto justify-center"
                  href={viewPhoto.return_photo_url}
                  download={`foto-pengembalian-${viewPhoto.id}.jpg`}
                >
                  <Download className="w-4 h-4" />
                  <span>Download Foto</span>
                </a>
              </div>
            </div>
          )}
        </Modal>
        {/* Modal: Konfirmasi Tandai Dikembalikan */}
        <Modal open={actionTx?.type === 'return'} onClose={() => setActionTx(null)} title="Tandai Dikembalikan" size="sm">
          {actionTx?.type === 'return' && (
            <div className="text-center space-y-4 py-2">
              <p className="text-sm text-slate-700">
                Yakin menandai transaksi <strong className="text-slate-900">{actionTx.tx.borrower_name}</strong> — <strong className="text-slate-900">{actionTx.tx.asset_name}</strong> sebagai dikembalikan?
              </p>
              <p className="text-xs text-slate-500">Aset akan otomatis kembali berstatus Tersedia. Aksi ini tercatat di audit log.</p>
              <div className="flex flex-col-reverse sm:flex-row justify-center gap-2.5 pt-2">
                <button className="btn-secondary btn-sm w-full sm:w-auto" onClick={() => setActionTx(null)}>Batal</button>
                <button className="btn-primary btn-sm w-full sm:w-auto" disabled={actionLoading} onClick={handleForceReturn}>
                  {actionLoading && <Spinner size="sm" className="text-white" />}
                  {actionLoading ? 'Memproses...' : 'Ya, Tandai Dikembalikan'}
                </button>
              </div>
            </div>
          )}
        </Modal>

        {/* Modal: Konfirmasi Hapus Transaksi */}
        <Modal open={actionTx?.type === 'delete'} onClose={() => setActionTx(null)} title="Hapus Transaksi" size="sm">
          {actionTx?.type === 'delete' && (
            <div className="text-center space-y-4 py-2">
              <p className="text-sm text-slate-700">
                Yakin menghapus transaksi <strong className="text-slate-900">{actionTx.tx.borrower_name}</strong> — <strong className="text-slate-900">{actionTx.tx.asset_name}</strong>?
              </p>
              <p className="text-xs text-slate-500">
                {actionTx.tx.status === 'active'
                  ? 'Transaksi masih aktif — aset akan dikembalikan ke status Tersedia.'
                  : 'Transaksi akan dihapus permanen dari riwayat.'}
              </p>
              <div className="flex flex-col-reverse sm:flex-row justify-center gap-2.5 pt-2">
                <button className="btn-secondary btn-sm w-full sm:w-auto" onClick={() => setActionTx(null)}>Batal</button>
                <button className="btn-danger btn-sm w-full sm:w-auto" disabled={actionLoading} onClick={handleDeleteTx}>
                  {actionLoading && <Spinner size="sm" className="text-white" />}
                  {actionLoading ? 'Memproses...' : 'Ya, Hapus'}
                </button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </AdminLayout>
  )
}
