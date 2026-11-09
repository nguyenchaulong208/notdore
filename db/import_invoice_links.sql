-- Tạo bảng invoice_links trên Supabase
CREATE TABLE IF NOT EXISTS public.invoice_links (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  type text NOT NULL,
  url text NOT NULL,
  note text,
  created_at timestamptz DEFAULT now()
);

-- Bật RLS
ALTER TABLE public.invoice_links ENABLE ROW LEVEL SECURITY;

-- Policy: cho phép mọi người đọc
DROP POLICY IF EXISTS "Allow public read" ON public.invoice_links;
CREATE POLICY "Allow public read" ON public.invoice_links
  FOR SELECT USING (true);

-- GRANT
GRANT SELECT ON public.invoice_links TO anon, authenticated;

-- Xóa dữ liệu cũ
DELETE FROM public.invoice_links;

-- Insert dữ liệu
INSERT INTO public.invoice_links (name, type, url, note) VALUES
  ('BKAV eHoadon — Tra cứu hóa đơn', 'Hóa đơn điện tử', 'http://ehoadon.vn', 'Cổng tra cứu hóa đơn BKAV'),
  ('BKAV SoLog — Tra cứu hóa đơn', 'Hóa đơn điện tử', 'http://solog.ehoadon.vn', 'Cổng tra cứu hóa đơn BKAV SoLog'),
  ('BKAV — Tra cứu bằng mã tra cứu', 'Hóa đơn điện tử', 'http://tracuu.ehoadon.vn', 'Tra cứu hóa đơn BKAV bằng mã tra cứu'),
  ('VNPT Invoice — Bình Dương port', 'Hóa đơn điện tử', 'https://bnpbinhduong-tt78.vnpt-invoice.com.vn/', 'Cổng tra cứu hóa đơn VNPT Bình Dương'),
  ('VNPT Invoice — Hàng hóa Nội Bài', 'Hóa đơn điện tử', 'https://hanghoanoibai-tt78.vnpt-invoice.com.vn', 'Cổng tra cứu hóa đơn VNPT Hàng hóa Nội Bài'),
  ('VNPT Invoice — Hương Dương port', 'Hóa đơn điện tử', 'https://huongduongport-tt78.vnpt-invoice.com.vn', 'Cổng tra cứu hóa đơn VNPT Hương Dương'),
  ('ALS Invoice — Tra cứu hóa đơn', 'Hóa đơn điện tử', 'https://invoice.als.com.vn', 'Cổng tra cứu hóa đơn ALS'),
  ('VNPT Invoice — Nam Đình Vũ port', 'Hóa đơn điện tử', 'https://namdinhvuport-tt78.vnpt-invoice.com.vn', 'Cổng tra cứu hóa đơn VNPT Nam Đình Vũ'),
  ('VNPT Invoice — SCSC', 'Hóa đơn điện tử', 'https://scsc-tt78.vnpt-invoice.com.vn', 'Cổng tra cứu hóa đơn VNPT SCSC'),
  ('VNPT Invoice — SNP', 'Hóa đơn điện tử', 'https://snp-tt78.vnpt-invoice.com.vn', 'Cổng tra cứu hóa đơn VNPT SNP');