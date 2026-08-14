import 'dotenv/config'
import pg from 'pg'
import XLSX from 'xlsx'
import { writeFileSync } from 'node:fs'

const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
const BASE = 'http://localhost:3000'
const results = []
const pass = (n) => results.push(`PASS - ${n}`)
const fail = (n, d = '') => results.push(`FAIL - ${n}${d ? ' :: ' + d : ''}`)

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@wabt.com', password: 'admin123' }),
})
const token = (await login.json()).token

async function api(path, { method = 'GET', body } = {}) {
  const headers = { Authorization: `Bearer ${token}` }
  let payload
  if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body) }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload })
  let json = null
  try { json = await res.json() } catch {}
  return { status: res.status, json }
}

// POST /assets dengan quantity=3 (tool)
{
  const r = await api('/api/assets', { method: 'POST', body: { name: 'Qty Kunci Pas', category: 'tool', quantity: 3 } })
  pass('create tool quantity=3 -> 201', r.status === 201)
  pass('return data array berisi 3', Array.isArray(r.json?.data) && r.json?.data?.length === 3)
  const names = r.json?.data?.map(a => a.name) || []
  pass('nama unit ter-suffix', names[0] === 'Qty Kunci Pas (Unit 1)' && names[2] === 'Qty Kunci Pas (Unit 3)')
  const codes = r.json?.data?.map(a => a.asset_code)
  pass('QR unik tiap unit', new Set(codes).size === 3)
  const ids = r.json?.data?.map(a => a.id)

  // quantity > 1 pada non-tool harus ditolak
  const r2 = await api('/api/assets', { method: 'POST', body: { name: 'Qty Mobil', category: 'vehicle', quantity: 2 } })
  pass('vehicle quantity>1 -> 400', r2.status === 400 && r2.json?.error?.includes('tool'))

  // quantity invalid
  const r3 = await api('/api/assets', { method: 'POST', body: { name: 'X', category: 'tool', quantity: 501 } })
  pass('quantity 501 -> 400', r3.status === 400)
  const r4 = await api('/api/assets', { method: 'POST', body: { name: 'Y', category: 'tool', quantity: 'abc' } })
  pass('quantity non-angka -> 400', r4.status === 400)

  // cleanup
  for (const id of ids || []) await api(`/api/assets/${id}`, { method: 'DELETE' })
}

// Import dengan kolom Jumlah
{
  const ws = XLSX.utils.aoa_to_sheet([
    ['Nama Aset', 'Status', 'Deskripsi', 'Jumlah'],
    ['Import Gergaji', 'available', 'gergaji besi', '4'],
    ['Import Obeng Tunggal', 'available', 'satu saja', ''],
  ])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Aset')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  writeFileSync('C:/Users/61250046/AppData/Local/Temp/opencode/qty.xlsx', buf)

  const fd = new FormData()
  fd.append('file', new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'qty.xlsx')
  fd.append('category', 'tool')
  const res = await fetch(`${BASE}/api/assets/import`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd })
  const json = await res.json()
  // 4 unit Gergaji + 1 Obeng = 5
  pass('import jumlah -> imported 5', json.imported === 5, JSON.stringify(json))
  const q = await pool.query(`SELECT name FROM assets WHERE name LIKE 'Import Gergaji%' OR name LIKE 'Import Obeng%'`)
  const nms = q.rows.map(r => r.name)
  pass('gergaji unit 1-4 ada', ['Import Gergaji (Unit 1)','Import Gergaji (Unit 4)'].every(x => nms.includes(x)))
  pass('obeng tunggal tanpa suffix', nms.includes('Import Obeng Tunggal'))

  // import ulang (semua sudah ada -> 0 imported)
  const fd2 = new FormData()
  fd2.append('file', new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'qty.xlsx')
  fd2.append('category', 'tool')
  const res2 = await fetch(`${BASE}/api/assets/import`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd2 })
  const json2 = await res2.json()
  pass('import ulang -> skipped 5', json2.skipped === 5, JSON.stringify(json2))

  await pool.query(`DELETE FROM assets WHERE name LIKE 'Import Gergaji%' OR name LIKE 'Import Obeng%'`)
}

console.log(results.join('\n'))
console.log(`Total: ${results.length}, FAIL: ${results.filter(r => r.startsWith('FAIL')).length}`)
await pool.end()
