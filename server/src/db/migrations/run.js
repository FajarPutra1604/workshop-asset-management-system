import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const { Pool } = pg

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const migrationsDir = path.join(__dirname)

if (!process.env.DATABASE_URL) {
  console.error('[migrate] FATAL: DATABASE_URL belum di-set.')
  process.exit(1)
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('neon.tech')
    ? { rejectUnauthorized: false }
    : undefined,
})

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT NOW()
    )
  `)
}

async function getAppliedMigrations() {
  const { rows } = await pool.query('SELECT filename FROM schema_migrations ORDER BY filename')
  return new Set(rows.map((r) => r.filename))
}

async function runMigration(filename) {
  const filepath = path.join(migrationsDir, filename)
  const sql = fs.readFileSync(filepath, 'utf8')
  console.log(`[migrate] Applying: ${filename}`)
  await pool.query('BEGIN')
  try {
    await pool.query(sql)
    await pool.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename])
    await pool.query('COMMIT')
    console.log(`[migrate] OK: ${filename}`)
  } catch (err) {
    await pool.query('ROLLBACK')
    console.error(`[migrate] FAILED: ${filename}`, err.message)
    throw err
  }
}

async function main() {
  try {
    await ensureMigrationsTable()
    const applied = await getAppliedMigrations()
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort()

    if (files.length === 0) {
      console.log('[migrate] Tidak ada file migration.')
      return
    }

    let count = 0
    for (const f of files) {
      if (applied.has(f)) {
        console.log(`[migrate] Skip (sudah): ${f}`)
        continue
      }
      await runMigration(f)
      count++
    }
    console.log(`[migrate] Selesai. ${count} migration baru diaplikasikan.`)
  } catch (err) {
    console.error('[migrate] Error:', err)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

main()
