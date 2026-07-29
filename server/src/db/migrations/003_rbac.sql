-- ============================================================
-- WABT - Migration 003: RBAC & Audit Log
-- ============================================================

-- Tabel: audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id          SERIAL PRIMARY KEY,
    admin_id    INTEGER NOT NULL REFERENCES admin_users(id),
    admin_name  VARCHAR(150) NOT NULL,
    action      VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id   VARCHAR(50),
    details     JSONB DEFAULT '{}',
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_admin   ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created  ON audit_logs(created_at);

-- Seed superadmin pertama (pastikan admin pertama jadi superadmin)
UPDATE admin_users SET role = 'superadmin' WHERE id = 1 AND role = 'admin';

-- Fungsi helper audit log
CREATE OR REPLACE FUNCTION log_audit(
    p_admin_id INTEGER,
    p_admin_name VARCHAR,
    p_action VARCHAR,
    p_entity_type VARCHAR,
    p_entity_id VARCHAR DEFAULT NULL,
    p_details JSONB DEFAULT '{}'
) RETURNS VOID AS $$
BEGIN
    INSERT INTO audit_logs (admin_id, admin_name, action, entity_type, entity_id, details)
    VALUES (p_admin_id, p_admin_name, p_action, p_entity_type, p_entity_id, p_details);
END;
$$ LANGUAGE plpgsql;
