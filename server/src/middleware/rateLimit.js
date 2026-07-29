import rateLimit from 'express-rate-limit'

const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000
const MAX = Number(process.env.RATE_LIMIT_MAX) || 30

export const publicRateLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: `Terlalu banyak request. Coba lagi dalam ${WINDOW_MS / 1000} detik.`,
  },
})
