-- =============================================================================
-- Reset riêng bảng public.tools khi bảng cũ khác schema v3.
--
-- Chạy trong Supabase SQL Editor, sau đó chạy lại:
--   1. db/schema.sql
--   2. db/seed-tools.sql
--
-- Script sao lưu dữ liệu cũ vào public.tools_backup_<timestamp> trước khi xoá.
-- Chỉ dùng khi bảng tools cũ không còn được code khác phụ thuộc trực tiếp.
-- =============================================================================

do $$
declare
  backup_name text;
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'tools'
      and table_type = 'BASE TABLE'
  ) then
    raise notice 'public.tools chưa tồn tại; không cần reset.';
    return;
  end if;

  backup_name := 'tools_backup_' || to_char(now(), 'YYYYMMDD_HH24MISS');

  execute format(
    'create table public.%I as table public.tools',
    backup_name
  );

  execute 'drop table public.tools cascade';

  raise notice 'Đã sao lưu public.tools -> public.% và xoá bảng cũ.', backup_name;
end;
$$;
