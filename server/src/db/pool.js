import pg from 'pg'

const { Pool } = pg

if (!process.env.DATABASE_URL) {
  console.error('[DB] FATAL: DATABASE_URL belum di-set. Copy .env.example ke .env dan isi koneksi Neon/PostgreSQL.')
  process.exit(1)
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('neon.tech')
    ? { rejectUnauthorized: false }
    : undefined,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
})

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client:', err)
})

export async function query(text, params) {
  const start = Date.now()
  const result = await pool.query(text, params)
  const duration = Date.now() - start
  if (process.env.NODE_ENV !== 'production' && duration > 500) {
    console.warn(`[DB] Slow query (${duration}ms):`, text.slice(0, 80))
  }
  return result
}

export default pool
