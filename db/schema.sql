-- =============================================================================
-- NotDore — Schema v3 (rebuild)
-- Chạy trong Supabase SQL Editor. Frontend chỉ ĐỌC (anon key + RLS select).
-- Ghi dữ liệu: qua SQL Editor hoặc service role ở server, không lộ ra client.
-- =============================================================================

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Danh mục & công cụ (catalog)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.tool_categories (
  id          text primary key,                 -- 'dia-gioi', 'tai-chinh', ...
  name        text not null,
  description text,
  icon        text,                             -- class FontAwesome, vd 'fa-map-location-dot'
  sort_order  int  not null default 0
);

create table if not exists public.tools (
  id           text primary key,                -- slug, vd 'dia-gioi-hanh-chinh'
  category_id  text references public.tool_categories(id) on delete set null,
  name         text not null,
  description  text,
  icon         text,
  url          text,                            -- trang nội bộ
  external_url text,                            -- hoặc link ngoài
  tags         text[] not null default '{}',
  status       text not null default 'ready'    -- ready | soon | beta
               check (status in ('ready', 'soon', 'beta')),
  featured     boolean not null default false,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint tools_target_check check (url is not null or external_url is not null)
);

create index if not exists idx_tools_category on public.tools(category_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Địa giới hành chính (cấp tỉnh, sau sáp nhập 01/07/2025)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.admin_units (
  code          text primary key,               -- mã đơn vị (2 ký tự), vd '79'
  name          text not null,                  -- 'Thành phố Hồ Chí Minh'
  type          text not null,                  -- 'Tỉnh' | 'Thành phố' | 'Thủ đô'
  region        text,                           -- 'Bắc Bộ' | 'Trung Bộ' | 'Nam Bộ'
  centrally_run boolean not null default false,
  capital       text,                           -- trung tâm hành chính (nếu có)
  population    bigint,
  area_km2      numeric(12, 2),
  merged_from   text,                           -- mô tả các đơn vị cũ
  note          text,
  updated_at    timestamptz not null default now()
);

create index if not exists idx_admin_units_region on public.admin_units(region);

-- Bảng đối chiếu: đơn vị TRƯỚC sáp nhập -> đơn vị hiện tại
create table if not exists public.admin_unit_history (
  id         bigserial primary key,
  old_name   text not null,                     -- 'Sóc Trăng'
  old_type   text,                              -- 'Tỉnh'
  new_code   text not null references public.admin_units(code) on delete cascade,
  changed    boolean not null default true,     -- false = giữ nguyên / chỉ đổi tên
  note       text,
  unique (old_name, new_code)
);

create index if not exists idx_history_new_code on public.admin_unit_history(new_code);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RLS: chỉ cho phép đọc công khai
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.tool_categories     enable row level security;
alter table public.tools               enable row level security;
alter table public.admin_units         enable row level security;
alter table public.admin_unit_history  enable row level security;

drop policy if exists "public read" on public.tool_categories;
drop policy if exists "public read" on public.tools;
drop policy if exists "public read" on public.admin_units;
drop policy if exists "public read" on public.admin_unit_history;

create policy "public read" on public.tool_categories    for select to anon, authenticated using (true);
create policy "public read" on public.tools              for select to anon, authenticated using (true);
create policy "public read" on public.admin_units        for select to anon, authenticated using (true);
create policy "public read" on public.admin_unit_history for select to anon, authenticated using (true);

-- Cấp quyền đọc cho PostgREST; RLS vẫn là lớp kiểm soát cuối.
-- Thiếu GRANT sẽ bị 401 "permission denied for table ...", dù policy đã đúng.
grant usage on schema public to anon, authenticated;
grant select on public.tool_categories, public.tools,
  public.admin_units, public.admin_unit_history
to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Trigger updated_at
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_tools_updated_at on public.tools;
create trigger trg_tools_updated_at
  before update on public.tools
  for each row execute function public.set_updated_at();

drop trigger if exists trg_admin_units_updated_at on public.admin_units;
create trigger trg_admin_units_updated_at
  before update on public.admin_units
  for each row execute function public.set_updated_at();
