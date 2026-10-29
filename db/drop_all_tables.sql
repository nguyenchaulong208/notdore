-- =============================================================================
-- NotDore — DROP ALL TABLES (full cleanup)
-- Chạy trong Supabase SQL Editor để xóa toàn bộ dữ liệu hiện có,
-- sau đó import data mới theo kiến trúc sạch (db_redesigned_clean.sql).
-- =============================================================================

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. Drop Views (phải trước khi drop bảng)
-- ═══════════════════════════════════════════════════════════════════════════════
-- New clean schema views
drop view if exists public.commune_trail;
drop view if exists public.merged_units;

-- Legacy geo views (old schema)
drop view if exists public.geo_current_units;
drop view if exists public.geo_unit_summary;
drop view if exists public.geo_data_quality;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. Drop RLS Policies
-- ═══════════════════════════════════════════════════════════════════════════════
-- New clean schema policies
do $$
declare
  tbl text;
  tbl_exists boolean;
begin
  foreach tbl in array array[
    'admin_units', 'admin_unit_history',
    'geo_datasets', 'geo_levels', 'geo_unit_types', 'geo_documents', 'geo_units',
    'geo_unit_aliases', 'geo_metric_defs', 'geo_unit_metrics', 'geo_event_types',
    'geo_events', 'geo_event_units', 'geo_sources', 'geo_reform_summaries',
    'documents', 'sources'
  ] loop
    -- Check if table exists before dropping policies
    select exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = tbl
    ) into tbl_exists;
    
    if tbl_exists then
      begin
        execute format('drop policy if exists "public read" on public.%I cascade', tbl);
      exception
        when undefined_table then
          -- Table doesn't exist, skip silently
          null;
      end;
    end if;
  end loop;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. Drop Tables (foreign keys: child first)
-- ═══════════════════════════════════════════════════════════════════════════════
-- New clean schema tables
drop table if exists public.communes cascade;
drop table if exists public.documents cascade;
drop table if exists public.sources cascade;
drop table if exists public.admin_unit_history cascade;
drop table if exists public.admin_units cascade;

-- Old legacy tables
drop table if exists public.parent cascade;
drop table if exists public.legacy_geo_units cascade;
drop table if exists public.legacy_admin_unit_history cascade;

-- Old geo_* tables
drop table if exists public.geo_datasets cascade;
drop table if exists public.geo_levels cascade;
drop table if exists public.geo_unit_types cascade;
drop table if exists public.geo_documents cascade;
drop table if exists public.geo_units cascade;
drop table if exists public.geo_unit_aliases cascade;
drop table if exists public.geo_metric_defs cascade;
drop table if exists public.geo_unit_metrics cascade;
drop table if exists public.geo_event_types cascade;
drop table if exists public.geo_events cascade;
drop table if exists public.geo_event_units cascade;
drop table if exists public.geo_sources cascade;
drop table if exists public.geo_reform_summaries cascade;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. Drop Extensions (optional)
-- ═══════════════════════════════════════════════════════════════════════════════
drop extension if exists "pgcrypto";
drop extension if exists "pg_trgm";

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. Clean up triggers (if any remain)
-- ═══════════════════════════════════════════════════════════════════════════════
drop trigger if exists trg_communes_updated_at on public.communes;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. Verify cleanup
-- ═══════════════════════════════════════════════════════════════════════════════
-- Kiểm tra số lượng bảng còn lại
select 'Tables remaining' as check_type, count(*) as cnt
from information_schema.tables
where table_schema = 'public'
and table_type = 'BASE TABLE';

-- Show remaining tables
select table_name
from information_schema.tables
where table_schema = 'public'
and table_type = 'BASE TABLE'
order by table_name;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ✅ DROP COMPLETE
-- Bây giờ import data theo kiến trúc mới:
--   1. Chạy db_redesigned_clean.sql (tạo lại các bảng, view, RLS)
--   2. Import admin-communes.json → public.communes
--   3. Import admin_unit_history mappings → public.admin_unit_history
--   4. Import documents, sources nếu cần
-- ═══════════════════════════════════════════════════════════════════════════════
