import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || '/api'

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
})

// Request interceptor — inject Bearer token
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('wabt_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor — handle 401 globally
client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('wabt_token')
      localStorage.removeItem('wabt_admin')
      // Redirect ke login jika bukan di halaman public
      if (!window.location.pathname.startsWith('/scan')) {
        window.location.href = '/admin/login'
      }
    }
    return Promise.reject(err)
  },
)

export default client
