import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import {
  Package,
  CheckCircle2,
  ArrowUpRight,
  AlertTriangle,
  Wrench,
  XCircle,
  Clock,
  ChevronRight,
  History
} from 'lucide-react'
import AdminLayout from '../../components/AdminLayout'
import { Badge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'
import client from '../../api/client'

const STATUS_COLORS = {
  available: '#10b981',
  borrowed: '#3b82f6',
  overdue: '#f43f5e',
  maintenance: '#f59e0b',
  lost: '#64748b',
}

const CATEGORY_COLORS = { tool: '#8b5cf6', vehicle: '#0ea5e9', room: '#14b8a6' }

function StatCard({ label, value, color, icon: Icon, iconBg, subtitle }) {
  return (
    <div className="stat-card animate-fade-in group">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
          <p className={`text-2xl font-bold mt-1 tracking-tight ${color || 'text-slate-900'}`}>{value}</p>
          {subtitle && <p className="text-[11px] text-slate-400 mt-1 font-medium">{subtitle}</p>}
        </div>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center border border-slate-200/60 shadow-subtle group-hover:scale-105 transition-all ${iconBg || 'bg-slate-100/80 text-slate-600'}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
    </div>
  )
}

const CUSTOM_TOOLTIP = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-xl shadow-modal px-3.5 py-2.5 text-xs">
        <p className="font-semibold text-slate-800 border-b border-slate-100 pb-1.5 mb-1.5">{label}</p>
        {payload.map((p) => (
          <div key={p.name} className="flex items-center gap-2 py-0.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-slate-600">{p.name}:</span>
            <span className="font-semibold text-slate-900">{p.value}</span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

function fmtWeek(isoString) {
  if (!isoString) return ''
  const d = new Date(isoString)
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: res } = await client.get('/dashboard/summary')
        setData(res)
      } catch (e) {
        setError(e.response?.data?.error || 'Gagal memuat dashboard')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-full py-40">
          <Spinner size="lg" />
        </div>
      </AdminLayout>
    )
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="p-8 text-center text-rose-600 font-medium">{error}</div>
      </AdminLayout>
    )
  }

  const { summary, by_category, top_assets, weekly_trend, overdue_list, late_return_list } = data

  // Pie chart data — status breakdown
  const pieData = [
    { name: 'Tersedia', value: summary.available, color: STATUS_COLORS.available },
    { name: 'Dipinjam', value: summary.borrowed, color: STATUS_COLORS.borrowed },
    { name: 'Overdue', value: summary.overdue, color: STATUS_COLORS.overdue },
    { name: 'Maintenance', value: summary.maintenance, color: STATUS_COLORS.maintenance },
    { name: 'Hilang', value: summary.lost, color: STATUS_COLORS.lost },
  ].filter(d => d.value > 0)

  // Weekly trend data
  const trendData = weekly_trend.map(w => ({
    week: fmtWeek(w.week_start),
    'Peminjaman': w.borrow_count,
  }))

  // Top assets bar chart
  const topData = top_assets.map(a => ({
    name: a.name.length > 16 ? a.name.slice(0, 16) + '…' : a.name,
    Peminjaman: a.borrow_count,
    fill: CATEGORY_COLORS[a.category] || '#6366f1',
  }))

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto animate-fade-in space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Ringkasan & analisis status aset workshop
          </p>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
          <StatCard label="Total Aset" value={summary.total_assets} icon={Package}
            iconBg="bg-slate-100 text-slate-700" />
          <StatCard label="Tersedia" value={summary.available} color="text-emerald-600" icon={CheckCircle2}
            iconBg="bg-emerald-50 text-emerald-600" />
          <StatCard label="Dipinjam" value={summary.borrowed} color="text-blue-600" icon={ArrowUpRight}
            iconBg="bg-blue-50 text-blue-600" />
          <StatCard label="Overdue" value={summary.overdue} color="text-rose-600" icon={AlertTriangle}
            iconBg="bg-rose-50 text-rose-600" subtitle="Perlu follow-up" />
          <StatCard label="Dikembalikan Telat" value={summary.late_returns} color="text-amber-600" icon={History}
            iconBg="bg-amber-50 text-amber-600" subtitle="Setelah jatuh tempo" />
          <StatCard label="Maintenance" value={summary.maintenance} color="text-amber-600" icon={Wrench}
            iconBg="bg-amber-50 text-amber-600" />
          <StatCard label="Hilang" value={summary.lost} color="text-slate-500" icon={XCircle}
            iconBg="bg-slate-100 text-slate-500" />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Status Pie */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-sm font-semibold text-slate-900 tracking-tight">Distribusi Status Aset</h2>
            </div>
            <div className="card-body">
              {pieData.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-10">Belum ada data status</p>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                      paddingAngle={3} dataKey="value" nameKey="name">
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} stroke="transparent" />
                      ))}
                    </Pie>
                    <Tooltip content={<CUSTOM_TOOLTIP />} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* By Category */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-sm font-semibold text-slate-900 tracking-tight">Aset per Kategori</h2>
            </div>
            <div className="card-body space-y-4">
              {by_category.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-10">Belum ada data kategori</p>
              ) : by_category.map(cat => (
                <div key={cat.category} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Badge category={cat.category} />
                    <span className="text-xs font-semibold text-slate-600">{cat.total} aset</span>
                  </div>
                  <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-slate-100">
                    <div className="bg-emerald-500 transition-all rounded-full"
                      style={{ width: `${(cat.available / cat.total) * 100}%` }} />
                    <div className="bg-blue-500 transition-all rounded-full"
                      style={{ width: `${(cat.borrowed / cat.total) * 100}%` }} />
                    <div className="bg-amber-500 transition-all rounded-full"
                      style={{ width: `${(cat.maintenance / cat.total) * 100}%` }} />
                    <div className="bg-slate-400 transition-all rounded-full"
                      style={{ width: `${(cat.lost / cat.total) * 100}%` }} />
                  </div>
                  <div className="flex items-center gap-4 text-[11px] text-slate-500 pt-0.5">
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"/>{cat.available} Tersedia</span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-500"/>{cat.borrowed} Dipinjam</span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"/>{cat.maintenance} Repair</span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-slate-400"/>{cat.lost} Hilang</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Trend + Top Assets */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Weekly Trend */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-sm font-semibold text-slate-900 tracking-tight">Tren Peminjaman (8 Minggu)</h2>
            </div>
            <div className="card-body">
              {trendData.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-10">Belum ada data peminjaman</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={trendData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                    <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<CUSTOM_TOOLTIP />} />
                    <Bar dataKey="Peminjaman" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Top Aset */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-sm font-semibold text-slate-900 tracking-tight">Top 5 Aset Terbanyak Dipinjam</h2>
            </div>
            <div className="card-body">
              {topData.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-10">Belum ada peminjaman</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={topData} layout="vertical"
                    margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={120}
                      tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CUSTOM_TOOLTIP />} />
                    <Bar dataKey="Peminjaman" radius={[0, 6, 6, 0]} barSize={16}>
                      {topData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Overdue List */}
        {overdue_list.length > 0 && (
          <div className="card border-rose-200/80">
            <div className="card-header bg-rose-50/40">
              <h2 className="text-sm font-semibold text-rose-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Transaksi Overdue — Perlu Follow-Up</span>
              </h2>
              <span className="badge-overdue">{overdue_list.length} item</span>
            </div>
            <div className="table-wrapper border-0 rounded-none shadow-none">
              <table className="table">
                <thead>
                  <tr>
                    <th>Peminjam</th>
                    <th>Aset</th>
                    <th>Mulai Pinjam</th>
                    <th>Seharusnya Kembali</th>
                    <th>Terlambat</th>
                  </tr>
                </thead>
                <tbody>
                  {overdue_list.map(tx => {
                    const hrs = Math.round((Date.now() - new Date(tx.expected_return_at)) / 3600000)
                    return (
                      <tr key={tx.id} className="bg-rose-50/20 hover:bg-rose-50/40">
                        <td className="font-semibold text-slate-900">{tx.borrower_name}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-800">{tx.asset_name}</span>
                            <Badge category={tx.category} />
                          </div>
                        </td>
                        <td className="text-xs text-slate-500">
                          {new Date(tx.borrowed_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="text-xs font-medium text-rose-600">
                          {new Date(tx.expected_return_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="font-bold text-rose-600 text-xs">
                          {hrs < 24 ? `${hrs} jam` : `${(hrs / 24).toFixed(1)} hari`}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Dikembalikan Telat List */}
        {late_return_list.length > 0 && (
          <div className="card border-amber-200/80">
            <div className="card-header bg-amber-50/40">
              <h2 className="text-sm font-semibold text-amber-900 flex items-center gap-2">
                <History className="w-4 h-4 text-amber-600" />
                <span>Transaksi Dikembalikan Telat</span>
              </h2>
              <span className="badge bg-amber-50 text-amber-700 border-amber-200/60">{late_return_list.length} item</span>
            </div>
            <div className="table-wrapper border-0 rounded-none shadow-none">
              <table className="table">
                <thead>
                  <tr>
                    <th>Peminjam</th>
                    <th>Aset</th>
                    <th>Mulai Pinjam</th>
                    <th>Jatuh Tempo</th>
                    <th>Dikembalikan</th>
                    <th>Telat</th>
                  </tr>
                </thead>
                <tbody>
                  {late_return_list.map(tx => {
                    const ms = new Date(tx.returned_at) - new Date(tx.expected_return_at)
                    const days = Math.floor(ms / 86400000)
                    const hrs = Math.floor((ms % 86400000) / 3600000)
                    return (
                      <tr key={tx.id} className="bg-amber-50/20 hover:bg-amber-50/40">
                        <td className="font-semibold text-slate-900">{tx.borrower_name}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-800">{tx.asset_name}</span>
                            <Badge category={tx.category} />
                          </div>
                        </td>
                        <td className="text-xs text-slate-500">
                          {new Date(tx.borrowed_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="text-xs text-slate-500">
                          {new Date(tx.expected_return_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="text-xs font-medium text-emerald-600">
                          {new Date(tx.returned_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="font-bold text-amber-600 text-xs">
                          {days > 0 ? `${days} hari ${hrs} jam` : `${hrs} jam`}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
