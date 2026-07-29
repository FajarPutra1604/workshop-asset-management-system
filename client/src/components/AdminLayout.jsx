import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Wrench,
  ClipboardList,
  Users,
  Settings,
  LogOut,
  Menu,
  X
} from 'lucide-react'

const TOKEN_KEY = 'wabt_token'
const ADMIN_KEY = 'wabt_admin'

function getAdmin() {
  try { return JSON.parse(localStorage.getItem(ADMIN_KEY) || 'null') } catch { return null }
}

const ROLE_LABELS = { superadmin: 'Super Admin', admin: 'Admin', operator: 'Operator', viewer: 'Viewer' }

function NavItem({ to, icon: Icon, label, onClick }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span>{label}</span>
    </NavLink>
  )
}

export default function AdminLayout({ children }) {
  const navigate = useNavigate()
  const token = localStorage.getItem(TOKEN_KEY)
  const admin = getAdmin()
  const [mobileOpen, setMobileOpen] = useState(false)

  if (!token) {
    navigate('/admin/login', { replace: true })
    return null
  }

  const role = admin?.role || 'admin'
  const isSuperAdmin = role === 'superadmin'
  const canManageAdmins = role === 'superadmin' || role === 'admin'

  function handleLogout() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(ADMIN_KEY)
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-slate-50/60 font-sans">
      {/* Mobile Top Navigation Header */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200/80 flex-shrink-0 z-30">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center text-white font-bold text-xs shadow-sm">
            W
          </div>
          <div>
            <p className="font-bold text-slate-900 text-xs leading-tight tracking-tight">WABT Admin</p>
            <p className="text-[10px] text-slate-400 font-medium">Workshop Asset Tracker</p>
          </div>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          aria-label="Toggle Menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Slide-Over Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-10 w-72 h-full bg-white flex flex-col justify-between p-4 shadow-2xl animate-slide-in">
            <div>
              <div className="flex items-center justify-between pb-4 mb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center text-white font-bold text-xs shadow-sm">
                    W
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-sm tracking-tight">WABT</p>
                    <p className="text-[11px] text-slate-400 font-medium">Asset Tracker</p>
                  </div>
                </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <nav className="space-y-1">
                <p className="px-3 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Navigation
                </p>
                <NavItem to="/admin/dashboard" icon={LayoutDashboard} label="Dashboard" onClick={() => setMobileOpen(false)} />
                <NavItem to="/admin/assets" icon={Wrench} label="Aset" onClick={() => setMobileOpen(false)} />
                <NavItem to="/admin/transactions" icon={ClipboardList} label="Transaksi" onClick={() => setMobileOpen(false)} />
                {canManageAdmins && <NavItem to="/admin/admin-users" icon={Users} label="Admin Users" onClick={() => setMobileOpen(false)} />}
                {isSuperAdmin && <NavItem to="/admin/settings" icon={Settings} label="Pengaturan" onClick={() => setMobileOpen(false)} />}
              </nav>
            </div>

            <div className="pt-3 border-t border-slate-100 bg-slate-50/50 rounded-2xl p-3">
              <div className="flex items-center gap-3 px-2 py-1.5 mb-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-semibold text-xs flex-shrink-0">
                  {admin?.name?.[0]?.toUpperCase() || 'A'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 truncate leading-snug">{admin?.name || 'Admin'}</p>
                  <p className="text-[10px] text-slate-400 truncate leading-none">{ROLE_LABELS[role] || role}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full btn-ghost btn-sm text-slate-500 hover:text-rose-600 hover:bg-rose-50/60 justify-start px-2"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Desktop Fixed Sidebar */}
      <aside className="hidden md:flex w-64 flex-shrink-0 bg-white border-r border-slate-200/80 flex-col justify-between">
        <div>
          {/* Header / Brand */}
          <div className="px-5 py-4 border-b border-slate-100/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center text-white font-bold text-xs shadow-sm">
                W
              </div>
              <div>
                <p className="font-bold text-slate-900 text-sm leading-tight tracking-tight">WABT</p>
                <p className="text-[11px] text-slate-400 font-medium">Asset Tracker</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200/60">
              v1.1
            </span>
          </div>

          {/* Navigation */}
          <nav className="px-3 py-4 space-y-1">
            <p className="px-3 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Navigation
            </p>
            <NavItem to="/admin/dashboard" icon={LayoutDashboard} label="Dashboard" />
            <NavItem to="/admin/assets" icon={Wrench} label="Aset" />
            <NavItem to="/admin/transactions" icon={ClipboardList} label="Transaksi" />
            {canManageAdmins && <NavItem to="/admin/admin-users" icon={Users} label="Admin Users" />}
            {isSuperAdmin && <NavItem to="/admin/settings" icon={Settings} label="Pengaturan" />}
          </nav>
        </div>

        {/* User Footer */}
        <div className="p-3 border-t border-slate-100/80 bg-slate-50/50">
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white border border-slate-200/70 shadow-subtle mb-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-semibold text-xs flex-shrink-0">
              {admin?.name?.[0]?.toUpperCase() || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-800 truncate leading-snug">{admin?.name || 'Admin'}</p>
              <p className="text-[10px] text-slate-400 truncate leading-none">{ROLE_LABELS[role] || role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full btn-ghost btn-sm text-slate-500 hover:text-rose-600 hover:bg-rose-50/60 justify-start px-3"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto min-w-0">
        {children}
      </main>
    </div>
  )
}
