/**
 * Centralized error handler middleware.
 * Must be mounted LAST (after all routes).
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    const mb = Math.round((Number(process.env.MAX_FILE_SIZE_BYTES) || 2 * 1024 * 1024) / (1024 * 1024) * 10) / 10
    return res.status(413).json({ error: `Ukuran file terlalu besar. Maksimum ${mb}MB.` })
  }

  // Express-validator / manual validation errors (thrown with status 400/422)
  if (err.status && err.status < 500) {
    return res.status(err.status).json({ error: err.message })
  }

  // Database constraint violations
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Data sudah ada (duplikat).' })
  }

  if (err.code === '23503') {
    return res.status(400).json({ error: 'Referensi data tidak valid.' })
  }

  // Unknown / internal errors
  console.error('[ERROR]', err)
  res.status(500).json({
    error: process.env.NODE_ENV === 'production' ? 'Terjadi kesalahan server.' : err.message,
  })
}
