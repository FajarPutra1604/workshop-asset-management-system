import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, Sliders, Tag, Activity, ListFilter, ChevronLeft, ChevronRight } from 'lucide-react'
import AdminLayout from '../../components/AdminLayout'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import client from '../../api/client'

const TABS = [
  { key: 'categories', label: 'Kategori Aset', icon: Tag },
  { key: 'asset-statuses', label: 'Status Aset', icon: Activity },
  { key: 'transaction-statuses', label: 'Status Transaksi', icon: ListFilter },
  { key: 'category-fields', label: 'Field Kategori', icon: Sliders },
]

function ColorInput({ value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <input type="color" value={value || '#6366f1'}
        onChange={e => onChange(e.target.value)}
        className="w-9 h-9 p-0.5 rounded-xl border border-slate-200 bg-white cursor-pointer shadow-subtle flex-shrink-0" />
      <input type="text" value={value || ''}
        onChange={e => onChange(e.target.value)}
        className="input font-mono text-xs" placeholder="#6366f1" maxLength={7} />
    </div>
  )
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState('categories')
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState({})
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState(null)

  const tabs = TABS
  const itemsPerPage = 15

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const endpoints = {
        categories: '/settings/categories',
        'asset-statuses': '/settings/asset-statuses',
        'transaction-statuses': '/settings/transaction-statuses',
        'category-fields': '/settings/category-fields',
      }
      const promises = Object.entries(endpoints).map(async ([key, url]) => {
        const { data } = await client.get(url)
        return [key, data]
      })
      const results = await Promise.all(promises)
      setData(Object.fromEntries(results))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const items = data[activeTab] || []
  const totalPages = Math.ceil(items.length / itemsPerPage)
  const paginated = items.slice((page - 1) * itemsPerPage, page * itemsPerPage)

  function openCreate() {
    setEditItem(null)
    if (activeTab === 'categories') setForm({ slug: '', name: '', icon: '', color: '#6366f1', description: '', sort_order: items.length + 1 })
    else if (activeTab === 'asset-statuses') setForm({ slug: '', name: '', color: '#6366f1', badge_class: '', sort_order: items.length + 1 })
    else if (activeTab === 'transaction-statuses') setForm({ slug: '', name: '', color: '#6366f1', sort_order: items.length + 1 })
    else if (activeTab === 'category-fields') setForm({ category_slug: '', field_key: '', field_label: '', field_type: 'text', is_required: false, placeholder: '', sort_order: 0 })
    setFormError(null)
    setModalOpen(true)
  }

  function openEdit(item) {
    setEditItem(item)
    setForm({ ...item })
    setFormError(null)
    setModalOpen(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormLoading(true); setFormError(null)
    try {
      const endpointMap = {
        categories: '/settings/categories',
        'asset-statuses': '/settings/asset-statuses',
        'transaction-statuses': '/settings/transaction-statuses',
      }
      const url = endpointMap[activeTab]
      if (editItem) {
        const slug = editItem.slug
        await client.put(`${url}/${slug}`, form)
      } else {
        await client.post(url, form)
      }
      setModalOpen(false)
      fetchData()
    } catch (e) {
      setFormError(e.response?.data?.error || 'Operasi gagal')
    } finally {
      setFormLoading(false)
    }
  }

  async function handleDelete(item) {
    if (!confirm(`Hapus "${item.name || item.field_label}"?`)) return
    try {
      const endpointMap = {
        categories: '/settings/categories',
        'asset-statuses': '/settings/asset-statuses',
        'transaction-statuses': '/settings/transaction-statuses',
      }
      const url = endpointMap[activeTab]
      if (activeTab === 'category-fields') {
        await client.delete(`/settings/category-fields/${item.id}`)
      } else {
        await client.delete(`${url}/${item.slug}`)
      }
      fetchData()
    } catch (e) {
      alert(e.response?.data?.error || 'Gagal menghapus')
    }
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const categoryOptions = data['categories']?.map(c => ({ value: c.slug, label: c.name })) || []
  const typeOptions = [
    { value: 'text', label: 'Text' },
    { value: 'number', label: 'Number' },
    { value: 'textarea', label: 'Textarea' },
  ]

  function renderForm() {
    if (activeTab === 'categories') return (
      <div className="space-y-4">
        <div>
          <label className="label label-required">Slug</label>
          <input className="input" value={form.slug} onChange={e => set('slug', e.target.value.toLowerCase().replace(/\s+/g, '_'))}
            placeholder="kategori_baru" disabled={!!editItem} required />
        </div>
        <div>
          <label className="label label-required">Nama Kategori</label>
          <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Nama Kategori" required />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
          <div>
            <label className="label">Ikon (Emoji)</label>
            <input className="input" value={form.icon} onChange={e => set('icon', e.target.value)} placeholder="🔧" maxLength={5} />
          </div>
          <div>
            <label className="label">Warna Accent</label>
            <ColorInput value={form.color} onChange={v => set('color', v)} />
          </div>
        </div>
        <div>
          <label className="label">Deskripsi</label>
          <input className="input" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Deskripsi kategori..." />
        </div>
        <div>
          <label className="label">Urutan (Sort Order)</label>
          <input type="number" className="input" value={form.sort_order} onChange={e => set('sort_order', Number(e.target.value))} min="0" />
        </div>
      </div>
    )
    if (activeTab === 'asset-statuses' || activeTab === 'transaction-statuses') return (
      <div className="space-y-4">
        <div>
          <label className="label label-required">Slug</label>
          <input className="input" value={form.slug} onChange={e => set('slug', e.target.value.toLowerCase().replace(/\s+/g, '_'))}
            placeholder="status_baru" disabled={!!editItem} required />
        </div>
        <div>
          <label className="label label-required">Nama Status</label>
          <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Nama Status" required />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
          <div>
            <label className="label">Warna Accent</label>
            <ColorInput value={form.color} onChange={v => set('color', v)} />
          </div>
          <div>
            <label className="label">Urutan (Sort Order)</label>
            <input type="number" className="input" value={form.sort_order} onChange={e => set('sort_order', Number(e.target.value))} min="0" />
          </div>
        </div>
        {activeTab === 'asset-statuses' && (
          <div>
            <label className="label">Class Badge CSS (opsional)</label>
            <input className="input" value={form.badge_class} onChange={e => set('badge_class', e.target.value)} placeholder="badge-available" />
          </div>
        )}
      </div>
    )
    if (activeTab === 'category-fields') return (
      <div className="space-y-4">
        <div>
          <label className="label label-required">Kategori</label>
          <select className="input" value={form.category_slug} onChange={e => set('category_slug', e.target.value)} required>
            <option value="">Pilih kategori...</option>
            {categoryOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label label-required">Field Key</label>
          <input className="input" value={form.field_key} onChange={e => set('field_key', e.target.value.toLowerCase().replace(/\s+/g, '_'))}
            placeholder="field_key" required />
        </div>
        <div>
          <label className="label label-required">Label Field</label>
          <input className="input" value={form.field_label} onChange={e => set('field_label', e.target.value)} placeholder="Nama Field" required />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
          <div>
            <label className="label">Tipe Input</label>
            <select className="input" value={form.field_type} onChange={e => set('field_type', e.target.value)}>
              {typeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Placeholder</label>
            <input className="input" value={form.placeholder} onChange={e => set('placeholder', e.target.value)} placeholder="Placeholder..." />
          </div>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <input type="checkbox" id="is_required" checked={form.is_required}
            onChange={e => set('is_required', e.target.checked)} className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500" />
          <label htmlFor="is_required" className="text-xs font-semibold text-slate-700">Wajib diisi (Required)</label>
        </div>
        <div>
          <label className="label">Urutan (Sort Order)</label>
          <input type="number" className="input" value={form.sort_order} onChange={e => set('sort_order', Number(e.target.value))} min="0" />
        </div>
      </div>
    )
  }

  function renderTable() {
    if (loading) return <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>
    if (items.length === 0) return <EmptyState icon={<Sliders className="w-6 h-6 text-slate-400" />} title="Belum ada data" description={`Belum ada konfigurasi ${activeTab.replace('-', ' ')}.`} action={
      <button className="btn-primary btn-sm" onClick={openCreate}><Plus className="w-3.5 h-3.5" /><span>Tambah</span></button>
    } />

    if (activeTab === 'categories') return (
      <table className="table">
        <thead><tr><th>Slug</th><th>Nama</th><th>Warna</th><th>Total Field</th><th>Urutan</th><th className="text-right">Aksi</th></tr></thead>
        <tbody>
          {paginated.map(item => {
            const fieldCount = data['category-fields']?.filter(f => f.category_slug === item.slug).length || 0
            return (
              <tr key={item.slug}>
                <td className="font-mono text-xs text-slate-600">{item.slug}</td>
                <td><span className="flex items-center gap-2 font-semibold text-slate-900">{item.icon} {item.name}</span></td>
                <td>
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-3.5 h-3.5 rounded-full border border-slate-200" style={{ background: item.color }} />
                    <span className="font-mono text-xs text-slate-500">{item.color}</span>
                  </div>
                </td>
                <td className="text-xs text-slate-600 font-medium">{fieldCount} field</td>
                <td className="text-xs text-slate-600 font-medium">{item.sort_order}</td>
                <td className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button className="btn-ghost btn-sm" onClick={() => openEdit(item)}><Pencil className="w-3.5 h-3.5" /></button>
                    <button className="btn-ghost btn-sm text-rose-600 hover:bg-rose-50/80" onClick={() => handleDelete(item)}><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    )
    if (activeTab === 'asset-statuses' || activeTab === 'transaction-statuses') return (
      <table className="table">
        <thead><tr><th>Slug</th><th>Nama</th><th>Warna</th><th>Urutan</th><th className="text-right">Aksi</th></tr></thead>
        <tbody>
          {paginated.map(item => (
            <tr key={item.slug}>
              <td className="font-mono text-xs text-slate-600">{item.slug}</td>
              <td>
                <span className="flex items-center gap-2 font-semibold text-slate-900">
                  <span className="inline-block w-2 h-2 rounded-full" style={{ background: item.color }} />
                  {item.name}
                </span>
              </td>
              <td><span className="font-mono text-xs text-slate-500">{item.color}</span></td>
              <td className="text-xs text-slate-600 font-medium">{item.sort_order}</td>
              <td className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <button className="btn-ghost btn-sm" onClick={() => openEdit(item)}><Pencil className="w-3.5 h-3.5" /></button>
                  <button className="btn-ghost btn-sm text-rose-600 hover:bg-rose-50/80" onClick={() => handleDelete(item)}><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )
    if (activeTab === 'category-fields') return (
      <table className="table">
        <thead><tr><th>Kategori</th><th>Key</th><th>Label</th><th>Tipe</th><th>Wajib</th><th>Urutan</th><th className="text-right">Aksi</th></tr></thead>
        <tbody>
          {paginated.map(item => (
            <tr key={item.id}>
              <td className="font-mono text-xs text-slate-600">{item.category_slug}</td>
              <td className="font-mono text-xs text-slate-600">{item.field_key}</td>
              <td className="font-semibold text-slate-900 text-xs">{item.field_label}</td>
              <td className="text-xs text-slate-600 font-medium">{item.field_type}</td>
              <td className="text-xs text-slate-600 font-medium">{item.is_required ? 'Ya' : 'Tidak'}</td>
              <td className="text-xs text-slate-600 font-medium">{item.sort_order}</td>
              <td className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <button className="btn-ghost btn-sm text-rose-600 hover:bg-rose-50/80" onClick={() => handleDelete(item)}><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto animate-fade-in space-y-4 sm:space-y-5">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">Pengaturan Sistem</h1>
          <p className="text-xs text-slate-500 mt-0.5">Kelola data master kategori, status aset, dan bidang dinamis</p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200/80 overflow-x-auto whitespace-nowrap">
          {tabs.map(tab => {
            const TabIcon = tab.icon
            return (
              <button key={tab.key}
                onClick={() => { setActiveTab(tab.key); setPage(1) }}
                className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-all
                  ${activeTab === tab.key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                <TabIcon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        <div className="card overflow-hidden">
          <div className="card-header flex flex-row items-center justify-between gap-3">
            <h2 className="text-xs sm:text-sm font-semibold text-slate-900 tracking-tight">
              {activeTab === 'categories' ? 'Daftar Kategori Aset' :
               activeTab === 'asset-statuses' ? 'Status Aset' :
               activeTab === 'transaction-statuses' ? 'Status Transaksi' :
               'Field Dinamis Kategori'}
            </h2>
            <button className="btn-primary btn-sm" onClick={openCreate}>
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tambah Data</span>
              <span className="sm:hidden">Tambah</span>
            </button>
          </div>
          <div className="table-wrapper border-0 rounded-none shadow-none">{renderTable()}</div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-t border-slate-100 bg-slate-50/40">
              <p className="text-xs text-slate-500 font-medium">Halaman {page} dari {totalPages}</p>
              <div className="flex gap-2">
                <button className="btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button className="btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Edit Data Master' : 'Tambah Data Master'} size="md">
          {formError && <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">{formError}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            {renderForm()}
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button type="button" className="btn-secondary btn-sm w-full sm:w-auto" onClick={() => setModalOpen(false)}>Batal</button>
              <button type="submit" disabled={formLoading} className="btn-primary btn-sm w-full sm:w-auto">
                {formLoading ? 'Menyimpan...' : 'Simpan Data'}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </AdminLayout>
  )
}
