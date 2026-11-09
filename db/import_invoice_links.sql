-- Tạo bảng invoice_links trên Supabase
CREATE TABLE IF NOT EXISTS public.invoice_links (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  type text NOT NULL,
  url text NOT NULL,
  note text,
  created_at timestamptz DEFAULT now()
);

-- Bật RLS (tùy chọn)
ALTER TABLE public.invoice_links ENABLE ROW LEVEL SECURITY;

-- Policy: cho phép mọi người đọc
CREATE POLICY "Allow public read" ON public.invoice_links
  FOR SELECT USING (true);

-- GRANT
GRANT SELECT ON public.invoice_links TO anon, authenticated;

-- Xóa dữ liệu cũ (nếu có) trước khi insert
DELETE FROM public.invoice_links;

-- Insert dữ liệu từ JSON
INSERT INTO public.invoice_links (name, type, url, note) VALUES
  ('Tổng cục Thuế — Tra cứu hóa đơn điện tử', 'Hóa đơn điện tử', 'https://hoadondientu.gdt.gov.vn/', 'Tra cứu hóa đơn điện tử do Tổng cục Thuế quản lý'),
  ('Cục Thuế TP.HCM', 'Hóa đơn điện tử', 'https://hoadon.hochiminhcity.gov.vn/', 'Tra cứu hóa đơn điện tử TP.HCM'),
  ('Hóa đơn VNPT', 'Hóa đơn điện tử', 'https://hoadondientu.vnpt.vn/', 'Tra cứu hóa đơn VNPT'),
  ('Hóa đơn Viettel', 'Hóa đơn điện tử', 'https://hoadon.viettel.vn/', 'Tra cứu hóa đơn Viettel'),
  ('Hóa đơn FPT', 'Hóa đơn điện tử', 'https://hoadon.fpt.vn/', 'Tra cứu hóa đơn FPT'),
  ('Hóa đơn MISA meInvoice', 'Hóa đơn điện tử', 'https://hoadon.misa.com.vn/', 'Tra cứu hóa đơn MISA'),
  ('Hóa đơn BKAV eHoadon', 'Hóa đơn điện tử', 'https://hoadon.bkav.com.vn/', 'Tra cứu hóa đơn BKAV'),
  ('Biên lai điện tử — Tổng cục Thuế', 'Biên lai', 'https://bienlaidientu.gdt.gov.vn/', 'Tra cứu biên lai điện tử'),
  ('Tra cứu MST — Tổng cục Thuế', 'Mã số thuế', 'https://tracuunnt.gdt.gov.vn/tcnnt/mstdn.jsp', 'Tra cứu thông tin doanh nghiệp theo MST');
HTMLEOF
echo "Done"