import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import morgan from 'morgan'

import authRouter from './routes/auth.js'
import assetsRouter from './routes/assets.js'
import transactionsRouter from './routes/transactions.js'
import dashboardRouter from './routes/dashboard.js'
import publicRouter from './routes/public.js'
import settingsRouter from './routes/settings.js'
import adminUsersRouter from './routes/admin-users.js'
import auditLogsRouter from './routes/audit-logs.js'
import { publicRateLimiter } from './middleware/rateLimit.js'
import { errorHandler } from './middleware/errorHandler.js'

const app = express()
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'

app.use(cors({ origin: CORS_ORIGIN.split(',').map((s) => s.trim()), credentials: true }))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(morgan('dev'))

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api/auth', authRouter)
app.use('/api/assets', assetsRouter)
app.use('/api/transactions', transactionsRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/public', publicRateLimiter, publicRouter)
app.use('/api/settings', settingsRouter)
app.use('/api/admin-users', adminUsersRouter)
app.use('/api/audit-logs', auditLogsRouter)

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' })
})

app.use(errorHandler)

export default app
