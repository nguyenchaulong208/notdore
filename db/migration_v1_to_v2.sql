-- =============================================================================
-- NotDore — Migration v1 → v2
-- Chạy file này trong Supabase SQL Editor nếu đã có dữ liệu ở v1.
-- An toàn: chỉ thêm cột mới, không xoá dữ liệu cũ.
-- =============================================================================

-- Bật extension uuid nếu chưa có
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Thêm cột mới vào bảng documents ──────────────────────────────────────────
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS issued_date  DATE,
  ADD COLUMN IF NOT EXISTS expiry_date  DATE,
  ADD COLUMN IF NOT EXISTS status       TEXT NOT NULL DEFAULT 'hieu_luc'
                                        CHECK (status IN ('hieu_luc', 'het_hieu_luc', 'chua_hieu_luc')),
  ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ── Trigger tự động cập nhật updated_at ──────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_documents_updated_at ON documents;
CREATE TRIGGER trg_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Thêm cột label vào document_tags nếu chưa có ─────────────────────────────
ALTER TABLE document_tags
  ADD COLUMN IF NOT EXISTS label TEXT;

-- ── Cập nhật label cho tags hiện có ──────────────────────────────────────────
UPDATE document_tags SET label = 'Thuế GTGT'      WHERE name = 'thue-gtgt' AND label IS NULL;
UPDATE document_tags SET label = 'Thuế TNCN'      WHERE name = 'thue-tncn' AND label IS NULL;
UPDATE document_tags SET label = 'Thuế TNDN'      WHERE name = 'thue-tndn' AND label IS NULL;
UPDATE document_tags SET label = 'BHXH'           WHERE name = 'bhxh'      AND label IS NULL;

-- ── Thêm tags mới nếu chưa tồn tại ──────────────────────────────────────────
INSERT INTO document_tags (name, label) VALUES
  ('ke-toan',        'Kế toán'),
  ('hai-quan',       'Hải quan'),
  ('xuat-nhap-khau', 'Xuất nhập khẩu')
ON CONFLICT (name) DO NOTHING;

-- ── Thêm index mới ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_documents_issued_date ON documents(issued_date DESC);
CREATE INDEX IF NOT EXISTS idx_documents_status      ON documents(status);

-- ── Kiểm tra kết quả ─────────────────────────────────────────────────────────
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'documents'
ORDER BY ordinal_position;
