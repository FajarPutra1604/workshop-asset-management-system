import { useState, useCallback } from 'react'
import client from '../api/client'

const TOKEN_KEY = 'wabt_token'
const ADMIN_KEY = 'wabt_admin'

function getStoredAuth() {
  try {
    const token = localStorage.getItem(TOKEN_KEY)
    const admin = JSON.parse(localStorage.getItem(ADMIN_KEY) || 'null')
    return { token, admin }
  } catch {
    return { token: null, admin: null }
  }
}

export function useAuth() {
  const stored = getStoredAuth()
  const [token, setToken] = useState(stored.token)
  const [admin, setAdmin] = useState(stored.admin)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const isAuthenticated = Boolean(token)

  const login = useCallback(async (email, password) => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await client.post('/auth/login', { email, password })
      localStorage.setItem(TOKEN_KEY, data.token)
      localStorage.setItem(ADMIN_KEY, JSON.stringify(data.admin))
      setToken(data.token)
      setAdmin(data.admin)
      return { ok: true }
    } catch (err) {
      const msg = err.response?.data?.error || 'Login gagal. Coba lagi.'
      setError(msg)
      return { ok: false, error: msg }
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(ADMIN_KEY)
    setToken(null)
    setAdmin(null)
  }, [])

  return { token, admin, isAuthenticated, loading, error, login, logout }
}
