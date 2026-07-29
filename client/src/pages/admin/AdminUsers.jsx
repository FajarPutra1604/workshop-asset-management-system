import { useState, useEffect, useCallback } from 'react'
import { Users, Plus, Pencil, Trash2, Shield, FileText, ChevronLeft, ChevronRight } from 'lucide-react'
import AdminLayout from '../../components/AdminLayout'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import client from '../../api/client'

const ROLE_LABELS = { superadmin: 'Super Admin', admin: 'Admin', operator: 'Operator', viewer: 'Viewer' }

const ADMIN_KEY = 'wabt_admin'
function getAdmin() {
  try { return JSON.parse(localStorage.getItem(ADMIN_KEY) || 'null') } catch { return null }
}

export default function AdminUsers() {
  const currentAdmin = getAdmin()
  const canManage = currentAdmin?.role === 'superadmin' || currentAdmin?.role === 'admin'
  const isSuperAdmin = currentAdmin?.role === 'superadmin'

  const [admins, setAdmins] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('admins')

  const [modalCreate, setModalCreate] = useState(false)
  const [modalEdit, setModalEdit] = useState(null)
  const [modalDelete, setModalDelete] = useState(null)
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'operator' })
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState(null)

  // Audit logs
  const [logs, setLogs] = useState([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [logPage, setLogPage] = useState(1)
  const [logPagination, setLogPagination] = useState({ pages: 1, total: 0 })

  const fetchAdmins = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await client.get('/admin-users')
      setAdmins(data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAdmins() }, [fetchAdmins])

  const fetchLogs = useCallback(async (p) => {
    setLogsLoading(true)
    try {
      const { data } = await client.get(`/audit-logs?page=${p || logPage}&limit=30`)
      setLogs(data.data)
      setLogPagination(data.pagination)
    } catch (e) { console.error(e) }
    finally { setLogsLoading(false) }
  }, [logPage])

  useEffect(() => { if (tab === 'logs') fetchLogs() }, [tab, fetchLogs])

  async function handleCreate(e) {
    e.preventDefault()
    setFormLoading(true); setFormError(null)
    try {
      await client.post('/admin-users', formData)
      setModalCreate(false)
      setFormData({ name: '', email: '', password: '', role: 'operator' })
      fetchAdmins()
    } catch (e) { setFormError(e.response?.data?.error || 'Gagal membuat admin') }
    finally { setFormLoading(false) }
  }

  async function handleUpdate(e) {
    e.preventDefault()
    setFormLoading(true); setFormError(null)
    const payload = {}
    if (formData.name) payload.name = formData.name
    if (formData.email) payload.email = formData.email
    if (formData.password) payload.password = formData.password
    if (formData.role) payload.role = formData.role
    try {
      await client.put(`/admin-users/${modalEdit.id}`, payload)
      setModalEdit(null)
      fetchAdmins()
    } catch (e) { setFormError(e.response?.data?.error || 'Gagal memperbarui admin') }
    finally { setFormLoading(false) }
  }

  async function handleDelete() {
    try {
      await client.delete(`/admin-users/${modalDelete.id}`)
      setModalDelete(null)
      fetchAdmins()
    } catch (e) { alert(e.response?.data?.error || 'Gagal menghapus admin') }
  }

  function openEdit(admin) {
    setFormData({ name: admin.name, email: admin.email, password: '', role: admin.role })
    setFormError(null)
    setModalEdit(admin)
  }

  const creatableRoles = isSuperAdmin
    ? ['superadmin', 'admin', 'operator', 'viewer']
    : ['operator', 'viewer']

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto animate-fade-in space-y-4 sm:space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">Manajemen Admin</h1>
            <p className="text-xs text-slate-500 mt-0.5">{admins.length} akun terdaftar</p>
          </div>
          {canManage && tab === 'admins' && (
            <button className="btn-primary w-full sm:w-auto justify-center" onClick={() => {
              setFormData({ name: '', email: '', password: '', role: 'operator' })
              setFormError(null)
              setModalCreate(true)
            }}>
              <Plus className="w-4 h-4" />
              <span>Tambah Admin</span>
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200/80 overflow-x-auto whitespace-nowrap">
          <button onClick={() => setTab('admins')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-all
              ${tab === 'admins' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
            <Users className="w-3.5 h-3.5" />
            <span>Akun Admin</span>
          </button>
          {isSuperAdmin && (
            <button onClick={() => setTab('logs')}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-all
                ${tab === 'logs' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
              <FileText className="w-3.5 h-3.5" />
              <span>Audit Log</span>
            </button>
          )}
        </div>

        {tab === 'admins' && (
          <div className="card overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>
            ) : admins.length === 0 ? (
              <EmptyState icon={<Users className="w-6 h-6 text-slate-400" />} title="Belum ada admin" description="Tambahkan admin pertama." />
            ) : (
              <div className="table-wrapper border-0 rounded-none shadow-none">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Nama</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Bergabung</th>
                      {canManage && <th className="text-right">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {admins.map(admin => (
                      <tr key={admin.id} className={admin.id === currentAdmin?.id ? 'bg-indigo-50/30' : ''}>
                        <td>
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shadow-subtle flex-shrink-0">
                              {admin.name[0]?.toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900">{admin.name}</p>
                              {admin.id === currentAdmin?.id && <p className="text-[11px] text-indigo-600 font-semibold">(Akun Anda)</p>}
                            </div>
                          </div>
                        </td>
                        <td className="text-xs text-slate-600 font-medium">{admin.email}</td>
                        <td>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border
                            ${admin.role === 'superadmin' ? 'bg-purple-50 text-purple-700 border-purple-200/60' :
                              admin.role === 'admin' ? 'bg-indigo-50 text-indigo-700 border-indigo-200/60' :
                              admin.role === 'operator' ? 'bg-blue-50 text-blue-700 border-blue-200/60' :
                              'bg-slate-100 text-slate-600 border-slate-200/60'}`}>
                            {ROLE_LABELS[admin.role] || admin.role}
                          </span>
                        </td>
                        <td className="text-xs text-slate-500 font-medium">
                          {new Date(admin.created_at).toLocaleDateString('id-ID')}
                        </td>
                        {canManage && (
                          <td>
                            <div className="flex items-center justify-end gap-1">
                              {admin.id !== currentAdmin?.id && (
                                <>
                                  <button onClick={() => openEdit(admin)} className="btn-ghost btn-sm">
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => setModalDelete(admin)} className="btn-ghost btn-sm text-rose-600 hover:bg-rose-50/80">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'logs' && isSuperAdmin && (
          <div className="card overflow-hidden">
            {logsLoading ? (
              <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>
            ) : logs.length === 0 ? (
              <EmptyState icon={<FileText className="w-6 h-6 text-slate-400" />} title="Belum ada log" description="Aktifitas admin akan tercatat di sini." />
            ) : (
              <>
                <div className="table-wrapper border-0 rounded-none shadow-none">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Waktu</th>
                        <th>Admin</th>
                        <th>Aksi</th>
                        <th>Tipe Entity</th>
                        <th>Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map(log => (
                        <tr key={log.id}>
                          <td className="text-xs text-slate-500 font-medium whitespace-nowrap">
                            {new Date(log.created_at).toLocaleString('id-ID')}
                          </td>
                          <td className="font-semibold text-slate-800 text-xs">{log.admin_name}</td>
                          <td>
                            <code className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/60 text-slate-700">
                              {log.action}
                            </code>
                          </td>
                          <td className="text-xs font-medium text-slate-600">{log.entity_type}</td>
                          <td className="text-xs text-slate-500 font-mono max-w-xs truncate">{JSON.stringify(log.details)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {logPagination.pages > 1 && (
                  <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-t border-slate-100 bg-slate-50/40">
                    <p className="text-xs text-slate-500 font-medium">Halaman {logPage} dari {logPagination.pages}</p>
                    <div className="flex gap-2">
                      <button className="btn-secondary btn-sm" disabled={logPage <= 1} onClick={() => setLogPage(p => p - 1)}>
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button className="btn-secondary btn-sm" disabled={logPage >= logPagination.pages} onClick={() => setLogPage(p => p + 1)}>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Modal Create */}
        <Modal open={modalCreate} onClose={() => setModalCreate(false)} title="Tambah Admin Baru" size="md">
          <form onSubmit={handleCreate} className="space-y-4">
            {formError && <div className="px-3.5 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">{formError}</div>}
            <div>
              <label className="label label-required">Nama</label>
              <input className="input" required value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} placeholder="Nama lengkap" />
            </div>
            <div>
              <label className="label label-required">Email</label>
              <input className="input" type="email" required value={formData.email} onChange={e => setFormData(f => ({ ...f, email: e.target.value }))} placeholder="admin@workshop.com" />
            </div>
            <div>
              <label className="label label-required">Password</label>
              <input className="input" type="password" required minLength={8} value={formData.password} onChange={e => setFormData(f => ({ ...f, password: e.target.value }))} placeholder="Min 8 karakter" />
            </div>
            <div>
              <label className="label label-required">Role</label>
              <select className="input" value={formData.role} onChange={e => setFormData(f => ({ ...f, role: e.target.value }))}>
                {creatableRoles.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button type="submit" disabled={formLoading} className="btn-primary w-full sm:w-auto">{formLoading ? 'Menyimpan...' : 'Simpan Admin'}</button>
            </div>
          </form>
        </Modal>

        {/* Modal Edit */}
        <Modal open={!!modalEdit} onClose={() => setModalEdit(null)} title="Edit Admin" size="md">
          <form onSubmit={handleUpdate} className="space-y-4">
            {formError && <div className="px-3.5 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">{formError}</div>}
            <div>
              <label className="label">Nama</label>
              <input className="input" value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={formData.email} onChange={e => setFormData(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <label className="label">Password Baru <span className="text-slate-400 font-normal lowercase">(kosongkan jika tidak diubah)</span></label>
              <input className="input" type="password" minLength={8} value={formData.password} onChange={e => setFormData(f => ({ ...f, password: e.target.value }))} placeholder="Min 8 karakter" />
            </div>
            <div>
              <label className="label">Role</label>
              <select className="input" value={formData.role} onChange={e => setFormData(f => ({ ...f, role: e.target.value }))}>
                {creatableRoles.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button type="submit" disabled={formLoading} className="btn-primary w-full sm:w-auto">{formLoading ? 'Menyimpan...' : 'Simpan Perubahan'}</button>
            </div>
          </form>
        </Modal>

        {/* Modal Delete */}
        <Modal open={!!modalDelete} onClose={() => setModalDelete(null)} title="Konfirmasi Hapus" size="sm">
          <div className="text-center py-2 space-y-3">
            <p className="text-sm text-slate-700">
              Yakin ingin menghapus <strong className="text-slate-900">{modalDelete?.name}</strong> ({modalDelete?.email})?
            </p>
            <p className="text-xs text-slate-500">Tindakan ini tidak bisa dibatalkan.</p>
            <div className="flex flex-col-reverse sm:flex-row justify-center gap-2.5 pt-2">
              <button className="btn-secondary btn-sm w-full sm:w-auto" onClick={() => setModalDelete(null)}>Batal</button>
              <button className="btn-danger btn-sm w-full sm:w-auto" onClick={handleDelete}>Hapus Admin</button>
            </div>
          </div>
        </Modal>
      </div>
    </AdminLayout>
  )
}
