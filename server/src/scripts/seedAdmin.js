import 'dotenv/config'
import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import bcrypt from 'bcryptjs'
import pool from '../db/pool.js'

async function main() {
  const rl = readline.createInterface({ input, output })

  console.log('\n=== WABT — Buat Admin Pertama ===\n')

  const name = (await rl.question('Nama admin: ')).trim()
  if (!name) {
    console.error('Nama tidak boleh kosong.')
    rl.close()
    return
  }

  const email = (await rl.question('Email admin: ')).trim().toLowerCase()
  if (!email || !email.includes('@')) {
    console.error('Email tidak valid.')
    rl.close()
    return
  }

  const password = (await rl.question('Password (min 8 karakter): ')).trim()
  if (!password || password.length < 8) {
    console.error('Password minimal 8 karakter.')
    rl.close()
    return
  }

  rl.close()

  try {
    const exists = await pool.query('SELECT id FROM admin_users WHERE email = $1', [email])
    if (exists.rows.length > 0) {
      console.error(`\nAdmin dengan email "${email}" sudah ada. Gunakan email lain atau hapus dulu.`)
      return
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const result = await pool.query(
      `INSERT INTO admin_users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'superadmin')
       RETURNING id, name, email, role, created_at`,
      [name, email, passwordHash],
    )

    console.log('\n✓ Admin berhasil dibuat:')
    console.log(result.rows[0])
    console.log('\nSekarang bisa login di dashboard admin.')
  } catch (err) {
    console.error('\nGagal membuat admin:', err.message)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

main()
