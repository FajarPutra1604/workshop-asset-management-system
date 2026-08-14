import app from '../server/src/app.js'

// Vercel serverless function — semua route Express di bawah /api.
// Normalisasi path agar aman apa pun format URL yang diterima Vercel.
export default function handler(req, res) {
  if (req.url && !req.url.startsWith('/api')) {
    req.url = `/api${req.url === '/' ? '' : req.url}`
  }
  return app(req, res)
}
