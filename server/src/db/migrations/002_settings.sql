-- ============================================================
-- WABT - Migration 002: Master Data Settings
-- Membuat tabel referensi untuk kategori, status, dan field dinamis
-- ============================================================

-- Tabel: asset_categories
CREATE TABLE IF NOT EXISTS asset_categories (
    id          SERIAL PRIMARY KEY,
    slug        VARCHAR(50) UNIQUE NOT NULL,
    name        VARCHAR(100) NOT NULL,
    icon        VARCHAR(10) DEFAULT '',
    color       VARCHAR(7) DEFAULT '#6366f1',
    description VARCHAR(255) DEFAULT '',
    sort_order  INTEGER DEFAULT 0,
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Tabel: asset_statuses
CREATE TABLE IF NOT EXISTS asset_statuses (
    id          SERIAL PRIMARY KEY,
    slug        VARCHAR(50) UNIQUE NOT NULL,
    name        VARCHAR(100) NOT NULL,
    color       VARCHAR(7) DEFAULT '#6366f1',
    badge_class VARCHAR(50) DEFAULT '',
    sort_order  INTEGER DEFAULT 0,
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Tabel: transaction_statuses
CREATE TABLE IF NOT EXISTS transaction_statuses (
    id          SERIAL PRIMARY KEY,
    slug        VARCHAR(50) UNIQUE NOT NULL,
    name        VARCHAR(100) NOT NULL,
    color       VARCHAR(7) DEFAULT '#6366f1',
    sort_order  INTEGER DEFAULT 0,
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Tabel: category_fields — field dinamis per kategori
CREATE TABLE IF NOT EXISTS category_fields (
    id              SERIAL PRIMARY KEY,
    category_slug   VARCHAR(50) NOT NULL REFERENCES asset_categories(slug),
    field_key       VARCHAR(50) NOT NULL,
    field_label     VARCHAR(100) NOT NULL,
    field_type      VARCHAR(20) NOT NULL DEFAULT 'text',
    is_required     BOOLEAN DEFAULT FALSE,
    placeholder     VARCHAR(255) DEFAULT '',
    sort_order      INTEGER DEFAULT 0,
    is_active       BOOLEAN DEFAULT TRUE,
    UNIQUE (category_slug, field_key)
);

-- Seed default categories
INSERT INTO asset_categories (slug, name, icon, color, description, sort_order) VALUES
    ('tool', 'Tool', '🔧', '#8b5cf6', 'Perkakas dan alat kerja', 1),
    ('vehicle', 'Kendaraan', '🚗', '#0ea5e9', 'Kendaraan operasional', 2),
    ('room', 'Ruangan', '🚪', '#14b8a6', 'Ruang meeting dan fasilitas', 3)
ON CONFLICT (slug) DO NOTHING;

-- Seed default asset statuses
INSERT INTO asset_statuses (slug, name, color, badge_class, sort_order) VALUES
    ('available', 'Tersedia', '#10b981', 'badge-available', 1),
    ('borrowed', 'Dipinjam', '#3b82f6', 'badge-borrowed', 2),
    ('maintenance', 'Maintenance', '#f59e0b', 'badge-maintenance', 3),
    ('lost', 'Hilang', '#94a3b8', 'badge-lost', 4)
ON CONFLICT (slug) DO NOTHING;

-- Seed default transaction statuses
INSERT INTO transaction_statuses (slug, name, color, sort_order) VALUES
    ('active', 'Aktif', '#3b82f6', 1),
    ('returned', 'Dikembalikan', '#10b981', 2),
    ('overdue', 'Overdue', '#ef4444', 3)
ON CONFLICT (slug) DO NOTHING;

-- Seed default category fields
INSERT INTO category_fields (category_slug, field_key, field_label, field_type, is_required, placeholder, sort_order) VALUES
    ('vehicle', 'model', 'Model', 'text', false, 'Toyota Avanza', 1),
    ('vehicle', 'plate_number', 'No. Polisi', 'text', false, 'B 1234 XYZ', 2),
    ('vehicle', 'last_odometer', 'Odometer (km)', 'number', false, '0', 3),
    ('vehicle', 'odometer_start', 'KM Awal', 'number', false, 'Misal: 45000', 4),
    ('vehicle', 'odometer_end', 'KM Akhir', 'number', false, 'Misal: 45238', 5),
    ('room', 'location', 'Lokasi', 'text', false, 'Lantai 2, Gedung A', 1),
    ('room', 'capacity', 'Kapasitas', 'number', false, '10', 2)
ON CONFLICT (category_slug, field_key) DO NOTHING;
