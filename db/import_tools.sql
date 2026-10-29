-- Create tool tables
CREATE TABLE IF NOT EXISTS public.tool_categories (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  icon text,
  sort_order integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.tools (
  id text PRIMARY KEY,
  category_id text REFERENCES public.tool_categories(id),
  name text NOT NULL,
  description text,
  icon text,
  url text,
  external_url text,
  tags text[],
  status text DEFAULT 'ready',
  featured boolean DEFAULT false,
  sort_order integer DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.tool_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tools ENABLE ROW LEVEL SECURITY;

-- Public read policies
DROP POLICY IF EXISTS "public read" ON public.tool_categories;
DROP POLICY IF EXISTS "public read" ON public.tools;
CREATE POLICY "public read" ON public.tool_categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public read" ON public.tools FOR SELECT TO anon, authenticated USING (true);

GRANT SELECT ON public.tool_categories, public.tools TO anon, authenticated;

-- Clean import
DELETE FROM public.tools;
DELETE FROM public.tool_categories;

-- Insert categories
INSERT INTO public.tool_categories (id, name, description, icon, sort_order) VALUES ('dia-gioi', 'Địa giới & Hành chính', 'Tra cứu đơn vị hành chính, sáp nhập tỉnh thành, mã đơn vị.', 'fa-map-location-dot', 1);

-- Insert tools
INSERT INTO public.tools (id, category_id, name, description, icon, url, tags, status, featured, sort_order) VALUES ('dia-gioi-hanh-chinh', 'dia-gioi', 'Tra cứu địa giới hành chính', 'Đối chiếu 63 tỉnh thành cũ sang 34 đơn vị sau sáp nhập 2025. Tìm theo tên cũ, tên mới, vùng hoặc mã đơn vị.', 'fa-map-location-dot', 'tools/dia-gioi-hanh-chinh.html', ARRAY['sáp nhập 2025', 'tỉnh thành', 'tra cứu'], 'ready', true, 1);
