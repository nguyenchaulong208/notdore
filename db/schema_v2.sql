-- =============================================================================
-- NotDore — Schema v2
-- Thay đổi so với v1:
--   + documents.issued_date  DATE          Ngày ban hành văn bản
--   + documents.expiry_date  DATE NULL     Ngày hết hiệu lực (NULL = chưa xác định)
--   + documents.status       TEXT          hieu_luc | het_hieu_luc | chua_hieu_luc
--   + documents.updated_at   TIMESTAMPTZ   Tự động cập nhật khi row thay đổi
--
-- Chạy file này trong Supabase SQL Editor để tạo mới hoàn toàn.
-- Nếu đã có dữ liệu, hãy dùng migration_v1_to_v2.sql thay thế.
-- =============================================================================

-- Xoá các bảng cũ nếu tồn tại (đúng thứ tự dependency)
DROP TABLE IF EXISTS document_tag_map  CASCADE;
DROP TABLE IF EXISTS document_files    CASCADE;
DROP TABLE IF EXISTS document_tags     CASCADE;
DROP TABLE IF EXISTS documents         CASCADE;

-- Bật extension uuid nếu chưa có
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────────
-- Bảng: documents
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE documents (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code         TEXT        NOT NULL,                   -- Số hiệu: 163/2017/NĐ-CP
  title        TEXT        NOT NULL,                   -- Tên văn bản đầy đủ
  description  TEXT,                                   -- Tóm tắt nội dung
  issued_date  DATE,                                   -- Ngày ban hành
  expiry_date  DATE,                                   -- Ngày hết hiệu lực (NULL = còn/chưa xác định)
  status       TEXT        NOT NULL DEFAULT 'hieu_luc' -- hieu_luc | het_hieu_luc | chua_hieu_luc
                CHECK (status IN ('hieu_luc', 'het_hieu_luc', 'chua_hieu_luc')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tự động cập nhật updated_at khi row thay đổi
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Bảng: document_files
-- Một văn bản có thể có nhiều file (PDF, DOCX, XLSX…)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE document_files (
  id                  UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id         UUID  NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  drive_view_url      TEXT,                        -- Link xem online (Google Drive / iframe)
  drive_download_url  TEXT,                        -- Link tải xuống
  mime_type           TEXT  DEFAULT 'application/pdf',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_document_files_doc_id ON document_files(document_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Bảng: document_tags
-- Danh mục / nhãn phân loại văn bản
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE document_tags (
  id    UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  name  TEXT  NOT NULL UNIQUE,    -- thue-gtgt | thue-tncn | thue-tndn | bhxh
  label TEXT                      -- Tên hiển thị: Thuế GTGT | …
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Bảng: document_tag_map
-- Quan hệ nhiều-nhiều: document ↔ tag
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE document_tag_map (
  document_id  UUID NOT NULL REFERENCES documents(id)     ON DELETE CASCADE,
  tag_id       UUID NOT NULL REFERENCES document_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (document_id, tag_id)
);

CREATE INDEX idx_tag_map_tag_id ON document_tag_map(tag_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Dữ liệu mặc định: tags
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO document_tags (name, label) VALUES
  ('thue-gtgt', 'Thuế GTGT'),
  ('thue-tncn', 'Thuế TNCN'),
  ('thue-tndn', 'Thuế TNDN'),
  ('bhxh',      'BHXH'),
  ('ke-toan',   'Kế toán'),
  ('hai-quan',  'Hải quan'),
  ('xuat-nhap-khau', 'Xuất nhập khẩu');
