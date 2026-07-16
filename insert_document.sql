-- ============================================================
-- Script thêm văn bản: Nghị định 163/2017/NĐ-CP
-- Chạy trong Supabase SQL Editor (Dashboard → SQL Editor)
-- An toàn để chạy nhiều lần (dùng ON CONFLICT DO NOTHING)
-- ============================================================

BEGIN;

-- ── 1. Đảm bảo tag tồn tại ──────────────────────────────────
INSERT INTO public.document_tags (name)
VALUES ('thue-gtgt')
ON CONFLICT (name) DO NOTHING;

-- ── 2. Thêm văn bản vào bảng documents ──────────────────────
INSERT INTO public.documents (title, code, description)
VALUES (
  'Nghị định 163/2017/NĐ-CP Quy định về kinh doanh dịch vụ Logistics',
  '163/2017/NĐ-CP',
  'Nghị định quy định về điều kiện kinh doanh dịch vụ logistics, trách nhiệm của thương nhân kinh doanh dịch vụ logistics và giải quyết tranh chấp liên quan.'
)
-- Bỏ qua nếu đã có văn bản cùng code (tránh trùng lặp)
ON CONFLICT DO NOTHING
RETURNING id;

-- ── 3. Lấy ID vừa insert (dùng CTE để tái sử dụng) ──────────
WITH doc AS (
  SELECT id FROM public.documents
  WHERE code = '163/2017/NĐ-CP'
  LIMIT 1
),
tag AS (
  SELECT id FROM public.document_tags
  WHERE name = 'thue-gtgt'
  LIMIT 1
)

-- ── 4. Gán tag cho văn bản ───────────────────────────────────
INSERT INTO public.document_tag_map (document_id, tag_id)
SELECT doc.id, tag.id FROM doc, tag
ON CONFLICT (document_id, tag_id) DO NOTHING;

-- ── 5. Thêm file Google Drive ────────────────────────────────
WITH doc AS (
  SELECT id FROM public.documents
  WHERE code = '163/2017/NĐ-CP'
  LIMIT 1
)
INSERT INTO public.document_files (
  document_id,
  drive_type,
  drive_file_id,
  drive_view_url,
  drive_download_url,
  mime_type
)
SELECT
  doc.id,
  'google',
  '1Erb8e8xoRI6kvh7oHRCHKBksQNWdfkkw',
  'https://drive.google.com/file/d/1Erb8e8xoRI6kvh7oHRCHKBksQNWdfkkw/view?usp=sharing',
  'https://drive.google.com/uc?export=download&id=1Erb8e8xoRI6kvh7oHRCHKBksQNWdfkkw',
  'application/pdf'
FROM doc
-- Không insert lại nếu file đã tồn tại cho document này
WHERE NOT EXISTS (
  SELECT 1 FROM public.document_files df
  WHERE df.document_id = doc.id
    AND df.drive_file_id = '1Erb8e8xoRI6kvh7oHRCHKBksQNWdfkkw'
);

COMMIT;

-- ── Kiểm tra kết quả ─────────────────────────────────────────
SELECT
  d.id,
  d.code,
  d.title,
  t.name  AS tag,
  df.drive_view_url
FROM public.documents d
JOIN public.document_tag_map dtm ON dtm.document_id = d.id
JOIN public.document_tags     t  ON t.id = dtm.tag_id
LEFT JOIN public.document_files df ON df.document_id = d.id
WHERE d.code = '163/2017/NĐ-CP';
