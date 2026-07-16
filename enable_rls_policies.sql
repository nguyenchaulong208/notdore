-- ============================================================
-- Cấp quyền đọc công khai (anonymous) cho các bảng NotDore
-- Chạy trong: Supabase Dashboard → SQL Editor
-- ============================================================

-- Bảng documents
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON public.documents;
CREATE POLICY "Allow public read"
  ON public.documents FOR SELECT
  USING (true);

-- Bảng document_tags
ALTER TABLE public.document_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON public.document_tags;
CREATE POLICY "Allow public read"
  ON public.document_tags FOR SELECT
  USING (true);

-- Bảng document_tag_map
ALTER TABLE public.document_tag_map ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON public.document_tag_map;
CREATE POLICY "Allow public read"
  ON public.document_tag_map FOR SELECT
  USING (true);

-- Bảng document_files
ALTER TABLE public.document_files ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON public.document_files;
CREATE POLICY "Allow public read"
  ON public.document_files FOR SELECT
  USING (true);

-- Kiểm tra: xem policies đã tạo
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('documents','document_tags','document_tag_map','document_files');
