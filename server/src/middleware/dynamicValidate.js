import pool from '../db/pool.js'

async function loadValidValues(table, column) {
  const { rows } = await pool.query(
    `SELECT DISTINCT ${column} FROM ${table} WHERE is_active = TRUE`
  )
  return rows.map(r => r[column])
}

const cache = { categories: null, assetStatuses: null, txStatuses: null }
let lastFetch = 0
const CACHE_TTL = 60000

// Dipanggil saat master kategori/status berubah agar validasi langsung pakai data baru
export function invalidateValidValues() {
  cache.categories = null
  cache.assetStatuses = null
  cache.txStatuses = null
  lastFetch = 0
}

async function getValidValues() {
  const now = Date.now()
  if (!cache.categories || now - lastFetch > CACHE_TTL) {
    const [catRows, statRows, txRows] = await Promise.all([
      pool.query('SELECT slug FROM asset_categories WHERE is_active = TRUE'),
      pool.query('SELECT slug FROM asset_statuses WHERE is_active = TRUE'),
      pool.query('SELECT slug FROM transaction_statuses WHERE is_active = TRUE'),
    ])
    cache.categories = catRows.rows.map(r => r.slug)
    cache.assetStatuses = statRows.rows.map(r => r.slug)
    cache.txStatuses = txRows.rows.map(r => r.slug)
    lastFetch = now
  }
  return cache
}

export async function validateCategory(req, res, next) {
  const { category } = req.body
  if (category) {
    const valid = await getValidValues()
    if (!valid.categories.includes(category)) {
      return res.status(400).json({ error: `Kategori "${category}" tidak valid` })
    }
  }
  next()
}

export async function validateAssetStatus(req, res, next) {
  const { status } = req.body
  if (status) {
    const valid = await getValidValues()
    if (!valid.assetStatuses.includes(status)) {
      return res.status(400).json({ error: `Status "${status}" tidak valid` })
    }
  }
  next()
}

export async function validateTxStatus(req, res, next) {
  const { status } = req.body
  if (status) {
    const valid = await getValidValues()
    if (!valid.txStatuses.includes(status)) {
      return res.status(400).json({ error: `Status transaksi "${status}" tidak valid` })
    }
  }
  next()
}

export async function validateQueryCategory(req, res, next) {
  const { category } = req.query
  if (category) {
    const valid = await getValidValues()
    if (!valid.categories.includes(category)) {
      return res.status(400).json({ error: `Kategori "${category}" tidak valid` })
    }
  }
  next()
}

export async function validateQueryAssetStatus(req, res, next) {
  const { status } = req.query
  if (status) {
    const valid = await getValidValues()
    if (!valid.assetStatuses.includes(status)) {
      return res.status(400).json({ error: `Status "${status}" tidak valid` })
    }
  }
  next()
}
