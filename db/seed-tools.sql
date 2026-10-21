-- Seed catalog: danh mục + công cụ. Chạy sau db/schema.sql.
-- Nội dung khớp với assets/data/tools.json (bản fallback khi chưa cấu hình Supabase).
-- Hiện chỉ có công cụ địa giới; các công cụ khác sẽ thêm khi hoàn thiện.

insert into public.tool_categories (id, name, description, icon, sort_order) values
  ('dia-gioi', 'Địa giới & Hành chính', 'Tra cứu đơn vị hành chính, sáp nhập tỉnh thành, mã đơn vị.', 'fa-map-location-dot', 1)
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
