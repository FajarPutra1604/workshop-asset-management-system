import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wrench, Eye, EyeOff, Lock, Mail, ArrowRight } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { Spinner } from '../../components/ui/Spinner'

export default function Login() {
  const { login, loading, error } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPass, setShowPass] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    const { ok } = await login(form.email, form.password)
    if (ok) navigate('/admin/assets', { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 relative overflow-hidden font-sans">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-indigo-600/15 blur-[120px]" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-violet-600/15 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-sm animate-scale-in space-y-6">
        {/* Brand Card Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex w-12 h-12 rounded-2xl bg-indigo-600 text-white
                          items-center justify-center shadow-lg shadow-indigo-600/30 border border-indigo-500/40">
            <Wrench className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">WABT Admin</h1>
          <p className="text-slate-400 text-xs font-medium">Workshop Asset Management System</p>
        </div>

        {/* Form Card */}
        <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-800 rounded-3xl p-7 shadow-2xl space-y-5">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-white tracking-tight">Masuk ke Dashboard</h2>
            <p className="text-xs text-slate-400">Masukkan kredensial akun admin Anda</p>
          </div>

          {error && (
            <div className="px-3.5 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="admin@workshop.com"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80
                             text-white placeholder:text-slate-500 text-sm
                             focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500
                             transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80
                             text-white placeholder:text-slate-500 text-sm
                             focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500
                             transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700
                         text-white font-semibold text-sm transition-all duration-150 shadow-md shadow-indigo-600/20
                         disabled:opacity-50 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2 pt-2.5"
            >
              {loading ? <Spinner size="sm" className="text-white" /> : null}
              <span>{loading ? 'Masuk...' : 'Masuk ke Sistem'}</span>
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-slate-600 font-medium">
          Workshop Asset Management System v1.1
        </p>
      </div>
    </div>
  )
}
