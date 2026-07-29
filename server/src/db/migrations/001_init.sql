-- ============================================================
-- WABT - Migration 001: Initial Schema
-- Tanggal: 28 Juli 2026
-- ============================================================

-- Tabel: admin_users
-- Akun admin yang bisa login ke dashboard
CREATE TABLE IF NOT EXISTS admin_users (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(150) NOT NULL,
    email           VARCHAR(150) UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,                    -- bcrypt
    role            VARCHAR(20) NOT NULL DEFAULT 'admin',
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- Tabel: assets
-- Master aset (generik untuk tools/vehicle/room)
CREATE TABLE IF NOT EXISTS assets (
    id              SERIAL PRIMARY KEY,
    asset_code      VARCHAR(50) UNIQUE NOT NULL,      -- UUID unik utk QR (anti-tebak)
    category        VARCHAR(20) NOT NULL
                        CHECK (category IN ('tool', 'vehicle', 'room')),
    name            VARCHAR(150) NOT NULL,            -- "Kunci No.13", "Avanza B 1234 XYZ", "Meeting Room A"
    description     TEXT,
    photo_url       TEXT,
    status          VARCHAR(20) NOT NULL DEFAULT 'available'
                        CHECK (status IN ('available', 'borrowed', 'maintenance', 'lost')),
    qr_code_url     TEXT,                              -- opsional, default URL dibentuk frontend
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),
    deleted_at      TIMESTAMP                          -- soft delete (nullable)
);
CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category);
CREATE INDEX IF NOT EXISTS idx_assets_status   ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_code     ON assets(asset_code);

-- Tabel: vehicle_details
CREATE TABLE IF NOT EXISTS vehicle_details (
    asset_id        INTEGER PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
    model           VARCHAR(100),
    plate_number    VARCHAR(20),
    last_odometer   INTEGER
);

-- Tabel: room_details
CREATE TABLE IF NOT EXISTS room_details (
    asset_id        INTEGER PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
    location        VARCHAR(150),
    capacity        INTEGER
);

-- Tabel: borrow_transactions
-- Riwayat peminjaman & pengembalian
CREATE TABLE IF NOT EXISTS borrow_transactions (
    id                          SERIAL PRIMARY KEY,
    asset_id                    INTEGER NOT NULL REFERENCES assets(id),
    borrower_name               VARCHAR(150) NOT NULL,     -- WAJIB
    borrower_contact            VARCHAR(100),              -- opsional: no. karyawan/HP
    purpose                     TEXT,
    estimated_duration_hours    NUMERIC,
    expected_return_at          TIMESTAMP,
    borrowed_at                 TIMESTAMP DEFAULT NOW(),
    returned_at                 TIMESTAMP,
    return_photo_url            TEXT,
    return_note                 TEXT,
    return_by_name              VARCHAR(150),
    status                      VARCHAR(20) NOT NULL DEFAULT 'active'
                                    CHECK (status IN ('active', 'returned', 'overdue')),
    -- field khusus mobil (nullable utk kategori lain)
    odometer_start              INTEGER,
    odometer_end                INTEGER,
    created_at                  TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_transactions_asset     ON borrow_transactions(asset_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status    ON borrow_transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_borrowed  ON borrow_transactions(borrowed_at);

-- ============================================================
-- Trigger: updated_at otomatis
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_admin_users_updated_at ON admin_users;
CREATE TRIGGER trg_admin_users_updated_at
    BEFORE UPDATE ON admin_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_assets_updated_at ON assets;
CREATE TRIGGER trg_assets_updated_at
    BEFORE UPDATE ON assets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
