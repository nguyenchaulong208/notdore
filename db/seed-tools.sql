-- Seed catalog: danh mục + công cụ. Chạy sau db/schema.sql.
-- Nội dung khớp với assets/data/tools.json (bản fallback khi chưa cấu hình Supabase).

insert into public.tool_categories (id, name, description, icon, sort_order) values
  ('dia-gioi',  'Địa giới & Hành chính', 'Tra cứu đơn vị hành chính, sáp nhập tỉnh thành, mã đơn vị.', 'fa-map-location-dot', 1),
  ('tai-chinh', 'Tài chính & Kế toán',   'Tính lương, thuế, lãi vay, chiết khấu, quy đổi.',               'fa-calculator',       2),
  ('tien-ich',  'Tiện ích văn bản',      'Đọc số thành chữ, chuẩn hoá tiếng Việt, đếm ký tự, tạo QR.',    'fa-wand-magic-sparkles', 3),
  ('nhan-su',   'Nhân sự',               'Chấm công, giờ làm thêm, ngày phép.',                           'fa-users',            4)
on conflict (id) do update
  set name = excluded.name,
      description = excluded.description,
      icon = excluded.icon,
      sort_order = excluded.sort_order;

insert into public.tools (id, category_id, name, description, icon, url, tags, status, featured, sort_order) values
  (
    'dia-gioi-hanh-chinh', 'dia-gioi',
    'Tra cứu địa giới hành chính',
    'Đối chiếu 63 tỉnh thành cũ sang 34 đơn vị sau sáp nhập 2025. Tìm theo tên cũ, tên mới, vùng hoặc mã đơn vị.',
    'fa-map-location-dot',
    'tools/dia-gioi-hanh-chinh.html',
    array['sáp nhập 2025', 'tỉnh thành', 'tra cứu'],
    'ready', true, 1
  ),
  (
    'tinh-luong-gross-net', 'tai-chinh',
    'Tính lương Gross ↔ Net',
    'Quy đổi lương gross sang net và ngược lại, gồm BHXH, BHYT, BHTN và thuế TNCN.',
    'fa-money-bill-wave', null,
    array['lương', 'TNCN', 'BHXH'],
    'soon', false, 2
  ),
  (
    'doc-so-tien', 'tien-ich',
    'Đọc số tiền thành chữ',
    'Chuyển số tiền sang chữ tiếng Việt chuẩn, dùng cho hoá đơn, hợp đồng, phiếu thu.',
    'fa-font', null,
    array['hoá đơn', 'hợp đồng', 'số thành chữ'],
    'soon', false, 3
  ),
  (
    'lich-tra-no-vay', 'tai-chinh',
    'Lịch trả nợ vay',
    'Lập bảng trả gốc và lãi theo dư nợ giảm dần hoặc niên kim cố định, xuất Excel.',
    'fa-table-list', null,
    array['vay', 'lãi suất', 'amortization'],
    'soon', false, 4
  )
on conflict (id) do update
  set category_id = excluded.category_id,
      name = excluded.name,
      description = excluded.description,
      icon = excluded.icon,
      url = excluded.url,
      tags = excluded.tags,
      status = excluded.status,
      featured = excluded.featured,
      sort_order = excluded.sort_order;
