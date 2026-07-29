# Workshop Asset Borrowing Tracker (WABT)

Sistem tracking peminjaman aset workshop (tools, mobil, ruangan) berbasis QR Code.

## Fitur Utama

- **Admin** (wajib login): kelola master aset, generate & cetak QR Code, lihat semua transaksi, dashboard status.
- **User peminjam** (tanpa login): scan QR Code di aset → isi form pinjam/kembali langsung dari HP.

## Stack

| Layer | Teknologi | Hosting |
|---|---|---|
| Frontend | React (Vite) + Tailwind CSS | Vercel |
| Backend | Node.js + Express | Render |
| Database | PostgreSQL | Neon |
| File Storage | Disk server (`/uploads`) | Render (ephemeral) |

## Struktur Project

```
Workshop-Asset-Management-System/
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

Lihat detail di `PRD.md` Section 12 (Infrastruktur & Deployment).

## Dokumentasi

- [PRD.md](./PRD.md) — Product Requirements Document lengkap
