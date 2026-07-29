import 'dotenv/config'
import bcrypt from 'bcryptjs'
import pool from '../db/pool.js'

const email = process.argv[2] || 'admin@wabt.com'
const password = process.argv[3] || 'admin123'

const hash = await bcrypt.hash(password, 10)
await pool.query('UPDATE admin_users SET password_hash = $1 WHERE email = $2', [hash, email])
console.log(`Password untuk ${email} direset ke: ${password}`)
await pool.end()
