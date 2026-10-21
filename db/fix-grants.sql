-- =============================================================================
-- Fix lỗi: 401 / "permission denied for table admin_units"
--
-- Chạy file này trong Supabase SQL Editor nếu trang tra cứu báo
-- "JSON tĩnh (Supabase lỗi)" và DevTools Console có lỗi tương tự:
--   permission denied for table admin_units
--
-- Nguyên nhân: policy RLS đã đúng nhưng role anon chưa có quyền SELECT
-- ở cấp bảng (GRANT). RLS chỉ lọc dòng SAU KHI role đã có quyền truy cập bảng.
--
-- File này chỉ cấp quyền cho bảng/view ĐÃ TỒN TẠI, nên chạy lại an toàn trên
-- project có cả lớp legacy và lớp geo_*.
-- =============================================================================

grant usage on schema public to anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    -- Legacy: catalog + đối chiếu 63 -> 34
    'tool_categories', 'tools', 'admin_units', 'admin_unit_history',
    -- Lớp geo_*: 34 tỉnh + 3.321 xã/phường/đặc khu
    'geo_datasets', 'geo_levels', 'geo_unit_types', 'geo_documents', 'geo_units',
    'geo_unit_aliases', 'geo_metric_defs', 'geo_unit_metrics', 'geo_event_types',
    'geo_events', 'geo_event_units', 'geo_sources',
    'geo_current_units', 'geo_unit_summary', 'geo_data_quality'
  ] loop
    if to_regclass('public.' || table_name) is not null then
      execute format('grant select on public.%I to anon, authenticated', table_name);
    end if;
  end loop;
end $$;

-- Kiểm tra nhanh (chạy sau khi grant):
-- select count(*) from public.admin_units;          -- kỳ vọng 34
-- select count(*) from public.admin_unit_history;   -- kỳ vọng 63
-- select level_code, count(*) from public.geo_units group by level_code;
