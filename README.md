# Workshop Asset Borrowing Tracker (WABT)

Sistem tracking peminjaman aset workshop (tools, mobil, ruangan) berbasis QR Code.

## Fitur Utama

- **Admin** (wajib login): kelola master aset, generate & cetak QR Code, lihat semua transaksi, dashboard status.
- **User peminjam** (tanpa login): scan QR Code di aset → isi form pinjam/kembali langsung dari HP.

## Stack

| Layer | Teknologi | Hosting |
|---|---|---|
| Frontend | React (Vite) + Tailwind CSS | Vercel |
| Backend | Node.js + Express (serverless function) | Vercel |
| Database | PostgreSQL | Neon |
| Foto aset & pengembalian | Disimpan sebagai base64 di database | Neon |

## Struktur Project

```
Workshop-Asset-Management-System/
├── api/       # Serverless function Vercel (menjalankan Express backend)
├── client/    # Frontend React (Vite + Tailwind)
├── server/    # Backend Express (Node.js + PostgreSQL)
├── PRD.md     # Product Requirements Document
└── package.json
```

## Setup Lokal

### Prasyarat

- Node.js 18+
- PostgreSQL (local atau [Neon](https://neon.tech))

### 1. Install dependencies

```bash
npm install
npm run install:all
```

### 2. Setup environment

```bash
# Server
cp server/.env.example server/.env
# Edit DATABASE_URL, JWT_SECRET, CORS_ORIGIN

# Client
cp client/.env.example client/.env
# Edit VITE_API_URL
```

### 3. Jalankan database migration

```bash
npm run migrate
```

### 4. Buat admin pertama

```bash
npm run seed:admin
```

### 5. Jalankan dev server

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3000

## Deploy

Arsitektur: **Frontend + Backend di Vercel** (satu project), **Database → Neon**.
`vercel.json` sudah mengatur: install dependency (`install:all`), build client, SPA rewrite, dan `api/index.js` sebagai serverless function Express.

### 1. Database (Neon)
- Buat project PostgreSQL di [Neon](https://neon.tech), salin connection string `DATABASE_URL`.
- Jalankan migration & buat admin **secara lokal** (Vercel tidak punya shell):
  ```bash
  cp server/.env.example server/.env   # isi DATABASE_URL, JWT_SECRET
  npm run migrate
  npm run seed:admin                  # buat admin pertama (nama, email, password)
  ```

### 2. Deploy ke Vercel
1. Push repo ke GitHub.
2. [vercel.com](https://vercel.com) → **New Project** → import repo.
3. Framework preset: **Other** (`vercel.json` yang mengatur build).
4. **Environment Variables** (Production):
   ```
   NODE_ENV=production
   DATABASE_URL=<dari Neon>
   JWT_SECRET=<string acak panjang>
   CORS_ORIGIN=https://<nama-project>.vercel.app
   MAX_FILE_SIZE_BYTES=2097152
   RATE_LIMIT_WINDOW_MS=60000
   RATE_LIMIT_MAX=30
   VITE_API_URL=/api
   ```
5. **Deploy**, lalu verifikasi: buka `https://<nama-project>.vercel.app/api/health` → `{"status":"ok"}`.
6. Login admin di `https://<nama-project>.vercel.app/admin/login`.

### 3. QR Code
- URL QR memakai origin browser (`window.location.origin`) saat cetak/lihat QR, sehingga otomatis mengarah ke domain produksi.

### Catatan (serverless)
- Foto disimpan sebagai base64 di DB (tanpa disk) → cocok untuk serverless. Limit body Vercel ~4.5MB, foto dibatasi 2MB.
- Cold start normal pada request pertama setelah function idle.
- Log `morgan` bisa dilihat di Vercel → Functions → Logs.

## Dokumentasi

- [PRD.md](./PRD.md) — Product Requirements Document lengkap
