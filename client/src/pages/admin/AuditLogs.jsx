import { useState, useEffect, useCallback } from 'react'
import { History, RotateCcw, ChevronLeft, ChevronRight, ShieldAlert } from 'lucide-react'
import AdminLayout from '../../components/AdminLayout'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import client from '../../api/client'

const ACTION_LABELS = {
  create_asset: 'Buat Aset',
  update_asset: 'Ubah Aset',
  delete_asset: 'Hapus Aset',
  import_assets: 'Import Aset',
  force_return: 'Paksa Kembalikan',
  delete_transaction: 'Hapus Transaksi',
  create_admin: 'Buat Admin',
  update_admin: 'Ubah Admin',
  delete_admin: 'Hapus Admin',
}

const ENTITY_LABELS = {
  assets: 'Aset',
  borrow_transactions: 'Transaksi',
  admin_users: 'Admin',
}

const ACTION_OPTIONS = [
  { value: '', label: 'Semua Aksi' },
  ...Object.entries(ACTION_LABELS).map(([value, label]) => ({ value, label })),
]

function fmt(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'medium' })
}

export default function AuditLogs() {
  const [logs, setLogs] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ action: '', search: '', from: '', to: '' })
  const [page, setPage] = useState(1)

  const isSuperAdmin = (() => {
    try {
      return JSON.parse(localStorage.getItem('wabt_admin') || 'null')?.role === 'superadmin'
    } catch { return false }
  })()

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit: 50, ...filters }
      Object.keys(params).forEach(k => { if (!params[k]) delete params[k] })
      const { data } = await client.get('/audit-logs', { params })
      setLogs(data.data)
      setPagination(data.pagination)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [page, filters])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const setFilter = (k, v) => { setFilters(f => ({ ...f, [k]: v })); setPage(1) }

  if (!isSuperAdmin) {
    return (
      <AdminLayout>
        <div className="p-8 text-center space-y-3">
          <ShieldAlert className="w-8 h-8 mx-auto text-rose-400" />
          <p className="text-sm text-slate-500">Halaman ini hanya untuk Super Admin.</p>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto animate-fade-in space-y-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Audit Logs</h1>
          <p className="text-xs text-slate-500 mt-0.5">{pagination.total} riwayat aksi admin</p>
        </div>

        {/* Filters */}
        <div className="card">
          <div className="p-3.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            <select className="input" value={filters.action}
              onChange={e => setFilter('action', e.target.value)}>
              {ACTION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <input className="input" placeholder="Cari admin / entitas / detail..."
              value={filters.search}
              onChange={e => setFilter('search', e.target.value)} />
            <input type="date" className="input" value={filters.from}
              onChange={e => setFilter('from', e.target.value)} />
            <input type="date" className="input" value={filters.to}
              onChange={e => setFilter('to', e.target.value)} />
          </div>
          <div className="px-3.5 pb-3.5">
            <button className="btn-secondary btn-sm" onClick={() => {
              setFilters({ action: '', search: '', from: '', to: '' })
              setPage(1)
            }}>
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>
          ) : logs.length === 0 ? (
            <EmptyState icon={<History className="w-6 h-6 text-slate-400" />} title="Belum ada riwayat"
              description="Aksi admin (buat/ubah/hapus aset, transaksi, admin) akan tercatat di sini." />
          ) : (
            <>
              <div className="table-wrapper border-0 rounded-none shadow-none">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Waktu</th>
                      <th>Admin</th>
                      <th>Aksi</th>
                      <th>Entitas</th>
                      <th>Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => (
                      <tr key={log.id}>
                        <td className="text-xs text-slate-500 whitespace-nowrap">{fmt(log.created_at)}</td>
                        <td className="font-semibold text-slate-800">{log.admin_name}</td>
                        <td>
                          <span className="badge bg-indigo-50 text-indigo-700 border-indigo-200/60">
                            {ACTION_LABELS[log.action] || log.action}
                          </span>
                        </td>
                        <td className="text-xs text-slate-500">{ENTITY_LABELS[log.entity_type] || log.entity_type} {log.entity_id ? `#${log.entity_id}` : ''}</td>
                        <td className="text-xs text-slate-500 max-w-md">
                          {log.details && Object.keys(log.details).length > 0 ? (
                            <code className="text-[11px] text-slate-500 bg-slate-100 px-2 py-1 rounded-md border border-slate-200/60 break-all">
                              {JSON.stringify(log.details)}
                            </code>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {pagination.pages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/40">
                  <p className="text-xs text-slate-500 font-medium">
                    Halaman {page} dari {pagination.pages} ({pagination.total} total)
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
      </div>
    </AdminLayout>
  )
}
