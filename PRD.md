# PRD — Workshop Asset Borrowing Tracker (WABT)

**Versi:** 1.1
**Tanggal:** 28 Juli 2026
**Status:** Final (Reviewed)

---

## Riwayat Revisi

| Versi | Tanggal | Perubahan |
|---|---|---|
| 1.0 | 23 Juli 2026 | Draft awal |
| 1.1 | 28 Juli 2026 | Penyederhanaan scope MVP, finalisasi stack & infrastruktur, perluasan status aset, soft delete, auto-compress foto 200KB, bootstrap admin via CLI seed |

---

## 1. Latar Belakang & Problem Statement

Saat ini proses peminjaman barang di workshop (tools, kunci, alat ukur, dll), mobil operasional, dan ruangan meeting/kerja masih dilakukan secara manual (buku catatan / tidak tercatat sama sekali). Hal ini menyebabkan:

- Sulit melacak siapa yang sedang meminjam barang/mobil/ruangan tertentu.
- Barang sering hilang atau tidak dikembalikan tepat waktu tanpa ada bukti.
- Tidak ada riwayat (history) peminjaman untuk audit atau evaluasi utilisasi aset.
- Proses pencatatan manual memakan waktu dan rawan human error.

## 2. Tujuan Produk

1. Menyediakan sistem self-service berbasis **QR Code** agar peminjam bisa mencatat peminjaman/pengembalian tanpa perlu admin/petugas.
2. Mencatat riwayat peminjaman secara digital (siapa, kapan, berapa lama, kondisi saat kembali).
3. Mendukung 3 kategori aset dengan alur yang mirip namun field yang disesuaikan:
   - **Tools/Alat Workshop** (contoh: kunci nomor 13 di Box Kumpulan Kunci)
   - **Mobil Operasional**
   - **Ruangan**
4. Admin dapat mencetak/generate QR Code untuk ditempel di masing-masing aset.
5. Memberikan visibilitas status aset secara real-time (tersedia / sedang dipinjam / overdue / maintenance / lost).

> **Catatan Scope (v1.1):** Untuk MVP, fokus utama adalah tracking peminjaman alat workshop. Fitur kompleks (verifikasi OTP, approval, notifikasi, maintenance tracking) sengaja **tidak dibangun** untuk menjaga kesederhanaan. Lihat Section 14 (Out of Scope).

## 3. Target Pengguna & Role

| Role | Akses Login | Deskripsi |
|---|---|---|
| **Peminjam (User)** | ❌ Tidak perlu login | Scan QR → isi form pinjam / kembali. Cukup isi **Nama Peminjam (wajib)** + field opsional lainnya. Frictionless, fokus pada kecepatan via scan QR. |
| **Admin** | ✅ Wajib login (JWT) | Kelola master data aset (tools, mobil, ruangan), generate & cetak QR Code, lihat semua transaksi, lihat dashboard. |

> **Keputusan desain:** Hanya **Admin** yang memiliki akun & wajib login. Peminjam **selalu anonymous** (tidak butuh akun) untuk meminimalkan hambatan adopsi. Verifikasi identitas peminjam hanya berupa input nama manual — dianggap cukup untuk kebutuhan tracking internal workshop.

## 4. Konsep Alur Utama

### 4.1 Alur Umum (berlaku utk Tools, Mobil, Ruangan)

```
[Admin buat aset di dashboard → generate & cetak QR → tempel di aset fisik]
                                    │
                                    ▼
                          [User scan QR Code]
                                    │
                                    ▼
                       Sistem cek status aset
                                    │
                           ┌────────┴────────┐
                           ▼                 ▼
                     STATUS:             STATUS:
                     TERSEDIA            DIPINJAM
                           │                 │
                           ▼                 ▼
                     Form PINJAM       Form KEMBALIKAN
                     (nama wajib)      (nama + foto)
                           │                 │
                           ▼                 ▼
                  DB → status            DB → status
                  "borrowed"            "available"
```

Setiap QR Code **statis per aset** (bukan per transaksi). Saat di-scan, sistem otomatis mendeteksi status aset tersebut:
- Jika **available** → diarahkan ke **Form Peminjaman**.
- Jika **borrowed** → diarahkan ke **Form Pengembalian**.
- Jika **maintenance** atau **lost** → menampilkan info aset tidak tersedia (tidak bisa dipinjam).

Ini menghindari kebutuhan generate QR baru setiap transaksi.

### 4.2 Detail per Kategori Aset

#### A. Tools / Alat Workshop
- Contoh: Box Kumpulan Kunci → tiap kunci (misal Kunci No. 13) punya QR Code sendiri.
- Field Form Pinjam:
  - **Nama peminjam (WAJIB)**
  - No. Karyawan / Divisi (opsional)
  - Keperluan / Catatan (opsional)
  - Estimasi lama pinjam (jam/hari)
- Field Form Kembali:
  - Nama (harus diisi ulang)
  - Upload foto barang saat dikembalikan (**opsional** untuk tools kecil)
  - Catatan kondisi (opsional: Baik / Rusak / Hilang sebagian)

#### B. Mobil Operasional
- Field tambahan khusus:
  - **Model Mobil** (foreign key ke master data mobil, tiap mobil = 1 QR unik ditempel di dashboard/kaca)
  - **Tujuan Pemakaian**
  - **Estimasi Lama Pinjam** (jam/hari, dengan tanggal & jam rencana kembali)
  - **KM Awal** (opsional)
- Field Form Kembali:
  - Nama
  - Upload foto kondisi mobil saat kembali (wajib)
  - **KM Akhir** (opsional)
  - Catatan kondisi

#### C. Ruangan
- Field tambahan khusus:
  - **Nama Ruangan** (misal: Meeting Room A, Ruang Diskusi Engineering)
  - **Keperluan Penggunaan**
  - **Estimasi Lama Pemakaian** (jam mulai ��� jam selesai)
  - Jumlah peserta (opsional)
- Field Form Kembali/Selesai:
  - Nama
  - Upload foto kondisi ruangan (misal: sudah dirapikan)
  - Catatan (opsional)

> Catatan desain: Ketiga kategori di-generalisasi dalam satu tabel `assets` dengan `category` (tool/vehicle/room) + tabel detail terpisah untuk field spesifik (`vehicle_details`, `room_details`), agar mudah dikembangkan tanpa duplikasi.

## 5. Fitur Utama (Functional Requirements)

### 5.1 Auth Admin
- `POST /api/auth/login` dengan email + password.
- Password di-hash dengan **bcryptjs**.
- Login berhasil → return **JWT** (expiry 24 jam).
- Middleware `auth.js` memverifikasi token di semua endpoint `/api/assets`, `/api/transactions`, `/api/dashboard`.
- Bootstrap admin pertama via **CLI script** `npm run seed:admin` (input interaktif email + password) — tidak ada endpoint `/register` di API.

### 5.2 QR Code Management (Admin Only)
- Admin dapat membuat aset baru (tools/mobil/ruangan) melalui form input master data.
- Sistem otomatis generate **asset_code** unik per aset menggunakan **UUID** (anti-tebak, anti-duplikasi).
- QR Code di-generate **client-side** menggunakan library `qrcode.react` (tidak bebani backend).
- URL yang di-encode: `https://{FRONTEND_DOMAIN}/scan/{asset_code}`.
- Admin dapat **download QR Code** sebagai PNG siap print (termasuk label nama aset).
- Admin dapat **bulk print** untuk banyak aset sekaligus.

### 5.3 Landing Page Scan (Public, No Login)
- URL unik per aset (`/scan/:assetCode`) menampilkan:
  - Info aset (nama, kategori, foto jika ada).
  - Status saat ini (Tersedia / Sedang Dipinjam oleh siapa sejak kapan / Maintenance / Lost).
  - Form dinamis sesuai status (Pinjam/Kembalikan/Tidak Tersedia) dan sesuai kategori aset.
- **Mobile-first** (mayoritas akses dari HP saat scan QR).
- Upload foto langsung dari kamera HP (`<input type="file" capture="environment">`).
- **Auto-compress foto di frontend** ke max **200KB** sebelum upload (library `browser-image-compression`) untuk hemat storage & bandwidth.

### 5.4 Riwayat & Tracking (Admin Only)
- Setiap transaksi (pinjam & kembali) tercatat di tabel `borrow_transactions` dengan timestamp.
- History per aset: siapa saja yang pernah pinjam, kapan, berapa lama, foto kondisi tiap pengembalian.
- Deteksi **overdue**: jika `expected_return_at` terlampaui dan status masih `active` → flag `overdue` (otomatis di-query, tidak perlu cron job untuk MVP).
- Filter & search transaksi (per aset, per tanggal, per status).

### 5.5 Dashboard Admin (Admin Only)
- Ringkasan status semua aset per kategori:
  - Total aset, Tersedia, Dipinjam, Overdue, Maintenance, Lost.
- Grafik utilisasi aset (memanfaatkan `recharts`):
  - Aset paling sering dipinjam (top 5/10).
  - Tren peminjaman per minggu/bulan.
- Daftar transaksi overdue yang perlu follow-up.

### 5.6 Manajemen Aset (Admin Only)
- CRUD aset (create, read, update, **soft delete** dengan `deleted_at`).
- Upload foto aset (master).
- Update status aset secara manual ke `maintenance` atau `lost` jika dibutuhkan.

## 6. Non-Functional Requirements

- **Frontend:** React (Vite) + Tailwind CSS. Halaman scan harus ringan & cepat load di jaringan mobile/workshop.
- **Backend:** Node.js + Express.
- **Database:** PostgreSQL (hosting di **Neon**, region AWS Singapore).
- **File storage:** Foto pengembalian & foto master aset disimpan di **disk server Render** (folder `uploads/`). Memang ephemeral di free tier, tetapi **data foto boleh hilang setiap 3 bulan** sesuai keputusan stakeholder. Tidak menggunakan cloud storage tambahan.
- **Auth:** JWT (24 jam expiry) untuk admin. Endpoint publik (`/api/public/*`) tidak butuh token tetapi di proteksi:
  - **Rate limiting** dengan `express-rate-limit` (mis. max 30 request/menit per IP).
  - Validasi input dengan `express-validator`.
- **QR Code generation:** Client-side via `qrcode.react` (download PNG). Backend tidak perlu generate QR.
- **Kompressi foto:** Frontend menggunakan `browser-image-compression` dengan target max **200KB** sebelum upload.
- **CORS:** Whitelist domain frontend di backend.
- **Audit sederhana:** Cukup `created_at` & `updated_at` di setiap tabel. Tidak ada tabel audit log terpisah.
- **Availability:** Sistem di-deploy di cloud (Render + Neon + Vercel), accessible dari jaringan internal workshop.
- **Region:** Semua service di region **Singapore** (terdekat dengan Indonesia, latency ~20-50ms).

## 7. Struktur Data (Skema PostgreSQL Final)

```sql
-- Master aset (generik utk semua kategori)
CREATE TABLE assets (
    id SERIAL PRIMARY KEY,
    asset_code VARCHAR(50) UNIQUE NOT NULL,   -- UUID unik utk QR (anti-tebak)
    category VARCHAR(20) NOT NULL CHECK (category IN ('tool', 'vehicle', 'room')),
    name VARCHAR(150) NOT NULL,               -- "Kunci No. 13", "Avanza B 1234 XYZ", "Meeting Room A"
    description TEXT,
    photo_url TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'available'
        CHECK (status IN ('available', 'borrowed', 'maintenance', 'lost')),
    qr_code_url TEXT,                          -- opsional, default URL dari frontend domain
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP                       -- soft delete (nullable)
);

-- Detail spesifik kendaraan
CREATE TABLE vehicle_details (
    asset_id INTEGER PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
    model VARCHAR(100),
    plate_number VARCHAR(20),
    last_odometer INTEGER
);

-- Detail spesifik ruangan
CREATE TABLE room_details (
    asset_id INTEGER PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
    location VARCHAR(150),
    capacity INTEGER
);

-- Transaksi peminjaman
CREATE TABLE borrow_transactions (
    id SERIAL PRIMARY KEY,
    asset_id INTEGER NOT NULL REFERENCES assets(id),
    borrower_name VARCHAR(150) NOT NULL,      -- WAJIB
    borrower_contact VARCHAR(100),            -- opsional: no. karyawan/HP
    purpose TEXT,
    estimated_duration_hours NUMERIC,
    expected_return_at TIMESTAMP,
    borrowed_at TIMESTAMP DEFAULT NOW(),
    returned_at TIMESTAMP,
    return_photo_url TEXT,
    return_note TEXT,
    return_by_name VARCHAR(150),
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'returned', 'overdue')),
    -- field khusus mobil (nullable utk kategori lain)
    odometer_start INTEGER,
    odometer_end INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_assets_category ON assets(category);
CREATE INDEX idx_assets_status ON assets(status);
CREATE INDEX idx_transactions_asset ON borrow_transactions(asset_id);
CREATE INDEX idx_transactions_status ON borrow_transactions(status);
CREATE INDEX idx_transactions_borrowed_at ON borrow_transactions(borrowed_at);

-- Admin users
CREATE TABLE admin_users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,              -- bcrypt
    role VARCHAR(20) NOT NULL DEFAULT 'admin',
    created_at TIMESTAMP DEFAULT NOW()
);
```

## 8. API Endpoints

| Method | Endpoint | Deskripsi | Akses |
|---|---|---|---|
| POST | `/api/auth/login` | Login admin → return JWT | Public (auth endpoint) |
| GET | `/api/assets` | List aset (filter by category, status; exclude soft-deleted) | Admin |
| GET | `/api/assets/:id` | Detail aset | Admin |
| POST | `/api/assets` | Tambah aset baru (auto-generate `asset_code` UUID) | Admin |
| PUT | `/api/assets/:id` | Update aset | Admin |
| DELETE | `/api/assets/:id` | Soft delete aset (set `deleted_at`) | Admin |
| GET | `/api/assets/:id/qrcode` | Info QR Code (URL & asset_code) — render di frontend | Admin |
| GET | `/api/transactions` | List semua transaksi (filter, search, pagination) | Admin |
| GET | `/api/dashboard/summary` | Statistik ringkas utk dashboard | Admin |
| GET | `/api/public/assets/:assetCode` | Info aset + status (halaman scan) | Public (rate-limited) |
| POST | `/api/public/borrow` | Submit form peminjaman | Public (rate-limited) |
| POST | `/api/public/return` | Submit form pengembalian (multipart, termasuk foto) | Public (rate-limited) |

## 9. Alur Halaman Scan (Frontend)

1. User scan QR → membuka `https://{FRONTEND_DOMAIN}/scan/{asset_code}`.
2. Frontend fetch `GET /api/public/assets/:assetCode` untuk ambil info & status.
3. Switch berdasarkan `status`:
   - `available` → render **BorrowForm** (dinamis sesuai `category`).
   - `borrowed` → render **ReturnForm** (nama + upload foto opsional + catatan).
   - `maintenance` / `lost` → tampilkan info "Aset tidak tersedia".
4. Setelah submit sukses → tampilkan halaman konfirmasi ("Berhasil dipinjam/dikembalikan") + tombol selesai.
5. Foto di-kompres di frontend ke max 200KB sebelum dikirim (POST multipart/form-data).

## 10. Roadmap / Fase Pengembangan

| Fase | Scope |
|---|---|
| **MVP (Fase 1)** | Lihat Section 13 (Plan Eksekusi) — Fase 0 sampai 5. |
| **Fase 2 ( future)** | Notifikasi WhatsApp/Email reminder overdue, integrasi cloud storage (OneDrive/Cloudinary) utk simpan foto permanen, laporan utilisasi per divisi, PWA offline mode. |
| **Fase 3 (future)** | Verifikasi OTP/PIN peminjam, approval workflow utk mobil, multiple-asset borrow, booking ruangan di muka, maintenance/calibration tracking. |

## 11. Asumsi & Keputusan Final

| # | Pertanyaan | Keputusan |
|---|---|---|
| 1 | Apakah peminjam perlu login? | **Tidak.** Cukup isi nama manual. Frictionless untuk adopsi cepat. |
| 2 | Apakah 1 aset hanya bisa dipinjam 1 orang dalam 1 waktu? | **Ya.** 1 aset = 1 peminjaman aktif. |
| 3 | Penyimpanan foto: lokal atau cloud? | **Disk server Render** (ephemeral, data boleh hilang tiap 3 bulan). Tidak pakai cloud storage. |
| 4 | Apakah butuh approval sebelum pinjam? | **Tidak.** Langsung self-service, tercatat begitu form disubmit. |
| 5 | Bagaimana buat admin pertama? | **CLI script** `npm run seed:admin` (input interaktif email + password). |
| 6 | QR Code generation: server atau client? | **Client-side** dengan `qrcode.react` (lebih simpel). |
| 7 | Bagaimana cegah QR dipalsukan? | `asset_code` pakai **UUID random** (anti-tebak). |
| 8 | Ukuran maksimal foto upload? | **200KB** (di-compress di frontend sebelum dikirim). |

## 12. Infrastruktur & Deployment

### 12.1 Stack Final

| Layer | Teknologi | Hosting | Region | Tier |
|---|---|---|---|---|
| Frontend | React (Vite) + Tailwind CSS | **Vercel** | Singapore (`sin1`) | Free |
| Backend | Node.js + Express | **Render** | Singapore | Free |
| Database | PostgreSQL | **Neon** | AWS Singapore (`ap-southeast-1`) | Free (0.5 GB) |
| File Storage | Disk Render (`/uploads`) | **Render** | Singapore | Ephemeral (free tier) |
| QR Code | `qrcode.react` (client) | — | — | Open source |
| Foto Compress | `browser-image-compression` (client) | — | — | Open source |

### 12.2 Domain (Gratis)
- Frontend: `https://{nama}.vercel.app`
- Backend: `https://{nama}.onrender.com`
- QR Code URL yang di-encode: `https://{nama}.vercel.app/scan/{asset_code}`

### 12.3 Catatan Operasional
- **Render free tier** sleep setelah 15 menit idle → cold start ~30 detik. Untuk traffic kecil (5 transaksi/hari) dapat ditoleransi. Opsional: pasang cron-job.org ping tiap 10 menit biar selalu on.
- **Neon** autosuspend setelah tidak diakses 1 minggu, tapi wake-up otomatis & gratis.
- **Folder `/uploads` di Render** ephemeral — file hilang saat service re-deploy/restart. Karena foto boleh hilang tiap 3 bulan, ini acceptable.
- **Vercel** tidak ada batas deployment untuk personal use, custom domain gratis (subdomain bawaan).

### 12.4 Environment Variables

**Backend (`.env`):**
```
PORT=3000
DATABASE_URL=postgres://...@neon.tech/wabt
JWT_SECRET=...
CORS_ORIGIN=https://{nama}.vercel.app
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=30
```

**Frontend (`.env`):**
```
VITE_API_URL=https://{nama}.onrender.com/api
```

## 13. Plan Eksekusi MVP

### Fase 0 — Setup & Infrastruktur
1. Inisialisasi monorepo (folder `client/` + `server/`).
2. Setup Vite + React + Tailwind di `client/`.
3. Setup Express + dependencies di `server/`: `express`, `pg`, `jsonwebtoken`, `bcryptjs`, `multer`, `cors`, `dotenv`, `express-rate-limit`, `express-validator`.
4. Buat akun Neon → dapat connection string → simpan di `.env`.
5. Buat file `.env.example` di kedua folder.

### Fase 1 — Database & Auth
6. Tulis migration `001_init.sql` (skema Section 7).
7. Script `npm run seed:admin` (CLI interaktif untuk buat admin pertama).
8. Implementasi `POST /api/auth/login` + middleware JWT verify.

### Fase 2 — Master Aset (Admin)
9. CRUD `/api/assets` (list, create, update, soft delete).
10. Endpoint upload foto master aset (`multer` disk storage).
11. Frontend Admin: halaman Login + halaman Assets (table + form modal).
12. Komponen `<QRCode />` (`qrcode.react`) + tombol download PNG + bulk print.

### Fase 3 — Halaman Scan (Public)
13. `GET /api/public/assets/:assetCode` (info + status).
14. `POST /api/public/borrow` (validasi: status harus `available`).
15. `POST /api/public/return` (`multer` upload foto + update status).
16. Frontend `ScanPage.jsx`:
    - Fetch asset → switch render sesuai status.
    - Mobile-first, form dinamis per kategori.
    - Kompress foto ke 200KB pakai `browser-image-compression` sebelum POST.
17. Halaman konfirmasi sukses.

### Fase 4 — Riwayat & Dashboard
18. `GET /api/transactions` (filter by asset/category/status/date range + pagination).
19. `GET /api/dashboard/summary` (count per status, top borrowed assets, overdue list).
20. Frontend: Transactions page (tabel + filter + search).
21. Frontend: Dashboard (cards ringkasan + chart `recharts` + list overdue).

### Fase 5 — Polish & Deploy
22. Rate limiting `express-rate-limit` di `/api/public/*`.
23. Validasi input `express-validator` di endpoint public.
24. Error handling middleware terpusat.
25. Deploy backend ke Render + connect Neon DB + jalankan migration via `npm run migrate`.
26. Deploy frontend ke Vercel + set `VITE_API_URL`.
27. Test end-to-end: print QR → scan HP → pinjam → kembali → cek di dashboard.
28. Tulis README singkat (cara setup lokal + deploy).

## 14. Out of Scope (Sengaja TIDAK Dibangun di MVP)

Sesuai keputusan "yang simple aja", fitur berikut **dikecualikan** dari MVP dan baru dipertimbangkan di Fase 2/3:

- ❌ Verifikasi PIN/OTP/SSO peminjam — cukup input nama manual.
- ❌ Approval workflow (PIC/supervisor approve pinjam mobil).
- ❌ Notifikasi WhatsApp/Email reminder overdue.
- ❌ Maintenance/calibration tracking alat ukur.
- ❌ Multiple-asset borrow (pinjam banyak barang sekaligus).
- ❌ Booking/reservasi ruangan di muka (hanya real-time check-in).
- ❌ Cloud storage permanen (OneDrive/Cloudinary) — pakai disk Render ephemeral.
- ❌ Tabel audit log terpisah — cukup `created_at` & `updated_at` di tiap tabel.
- ❌ PWA / offline mode.
- ❌ Multiple admin roles (admin/viewer) — semua admin sama.
- ❌ Export laporan Excel.
- ❌ Internasionalisasi (multi-bahasa) — UI Bahasa Indonesia saja.

## 15. Struktur Folder Project

```
Workshop-Asset-Management-System/
├── client/                          # React Vite + Tailwind
│   ├── src/
│   │   ├── pages/
│   │   │   ├── ScanPage.jsx                # /scan/:assetCode (public)
│   │   │   └── admin/
│   │   │       ├── Login.jsx
│   │   │       ├── Dashboard.jsx
│   │   │       ├── Assets.jsx              # CRUD aset + generate QR
│   │   │       └── Transactions.jsx
│   │   ├── components/
│   │   │   ├── QRCodeDisplay.jsx           # qrcode.react wrapper
│   │   │   ├── BorrowForm.jsx
│   │   │   ├── ReturnForm.jsx
│   │   │   └── ui/                         # button, input, table, dll
│   │   ├── api/                            # axios instance + endpoints
│   │   ├── hooks/                          # useAuth, useAssets, dst
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css                       # tailwind
│   ├── public/
│   ├── .env.example
│   ├── package.json
│   └── vite.config.js
├── server/                          # Express + PostgreSQL
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── assets.js
│   │   │   ├── transactions.js
│   │   │   ├── dashboard.js
│   │   │   └── public.js                    # /api/public/*
│   │   ├── middleware/
│   │   │   ├── auth.js                     # JWT verify
│   │   │   ├── upload.js                   # multer
│   │   │   ├── rateLimit.js
│   │   │   └── errorHandler.js
│   │   ├── db/
│   │   │   ├── pool.js                     # pg Pool
│   │   │   └── migrations/
│   │   │       ├── 001_init.sql
│   │   │       └── run.js                  # migration runner
│   │   ├── scripts/
│   │   │   └── seedAdmin.js                # npm run seed:admin
│   │   ├── utils/
│   │   │   ├── jwt.js
│   │   │   └── crypto.js                   # UUID generator
│   │   └── index.js                        # entry point
│   ├── uploads/                            # foto (ephemeral)
│   ├── .env.example
│   ├── package.json
│   └── README.md
├── PRD.md
├── .gitignore
└── README.md
```
