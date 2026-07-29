import { useState, useEffect, useCallback } from 'react'
import { Search, RotateCcw, Camera, ClipboardList, ChevronLeft, ChevronRight } from 'lucide-react'
import AdminLayout from '../../components/AdminLayout'
import { Badge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import client from '../../api/client'

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

export default function Transactions() {
  const [transactions, setTransactions] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ status: '', category: '', search: '', from: '', to: '' })
  const [page, setPage] = useState(1)

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
                            <Badge status={isOverdue ? 'overdue' : tx.status} />
                          </td>
                          <td>
                            {tx.return_photo_url ? (
                              <a href={tx.return_photo_url} target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                                <Camera className="w-3.5 h-3.5" />
                                <span>Lihat</span>
                              </a>
                            ) : <span className="text-slate-300 text-xs">—</span>}
                          </td>
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
      </div>
    </AdminLayout>
  )
}
