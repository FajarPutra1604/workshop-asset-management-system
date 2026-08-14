import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/admin/Login'
import Assets from './pages/admin/Assets'
import Transactions from './pages/admin/Transactions'
import Dashboard from './pages/admin/Dashboard'
import Settings from './pages/admin/Settings'
import AdminUsers from './pages/admin/AdminUsers'
import AuditLogs from './pages/admin/AuditLogs'
import ScanPage from './pages/ScanPage'
import ScanSuccess from './pages/ScanSuccess'

function PrivateRoute({ element }) {
  const token = localStorage.getItem('wabt_token')
  return token ? element : <Navigate to="/admin/login" replace />
}

export default function App() {
  return (
    <Routes>
      {/* ── Public Scan Routes ─────────────────────────────── */}
      <Route path="/scan/success" element={<ScanSuccess />} />
      <Route path="/scan/:assetCode" element={<ScanPage />} />

      {/* ── Admin Routes ───────────────────────────────────── */}
      <Route path="/admin/login" element={<Login />} />
      <Route path="/admin" element={<Navigate to="/admin/assets" replace />} />

      {/* Protected admin pages */}
      <Route path="/admin/dashboard" element={<PrivateRoute element={<Dashboard />} />} />
      <Route path="/admin/assets" element={<PrivateRoute element={<Assets />} />} />
      <Route path="/admin/transactions" element={<PrivateRoute element={<Transactions />} />} />
      <Route path="/admin/settings" element={<PrivateRoute element={<Settings />} />} />
      <Route path="/admin/admin-users" element={<PrivateRoute element={<AdminUsers />} />} />
      <Route path="/admin/audit-logs" element={<PrivateRoute element={<AuditLogs />} />} />

      {/* Default fallback */}
      <Route path="*" element={<Navigate to="/admin/login" replace />} />
    </Routes>
  )
}
