-- ============================================================
-- WABT - Migration 004: Dynamic Constraints
-- Menghapus CHECK constraints agar kategori/status bisa dinamis
-- ============================================================

ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_category_check;
ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_status_check;
ALTER TABLE borrow_transactions DROP CONSTRAINT IF EXISTS borrow_transactions_status_check;
