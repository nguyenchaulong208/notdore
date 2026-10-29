-- =============================================================================
-- NotDore — Database Redesign (Clean Version)
-- Chạy trong Supabase SQL Editor.
-- Loại bỏ 12+ bảng geo_* thừa, chỉ giữ 4 bảng cốt lõi + 2 view.
-- =============================================================================

-- ═══════════════════════════════════════════════════════════════════════════════
-- Extensions
-- ═══════════════════════════════════════════════════════════════════════════════
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. admin_units — 34 tỉnh (dữ liệu hiện tại sau sắp xếp)
-- ═══════════════════════════════════════════════════════════════════════════════
create table if not exists public.admin_units (
  code          text primary key,               -- mã đơn vị (2 ký tự), vd '79'
  name          text not null,                  -- 'Thành phố Hồ Chí Minh'
  type          text not null,                  -- 'Tỉnh' | 'Thành phố' | 'Thủ đô'
  region        text,                           -- 'Bắc Bộ' | 'Trung Bộ' | 'Nam Bộ'
  centrally_run boolean not null default false,
  merged_from   text,                           -- mô tả các đơn vị cũ
  note          text,
  updated_at    timestamptz not null default now()
);

create index if not exists idx_admin_units_region on public.admin_units(region);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. communes — 3,321 đơn vị (xã/phường/đặc khu) với beforeNames
--    Đây là bảng chính cho tính năng tra cứu trước–sau sắp xếp
-- ═══════════════════════════════════════════════════════════════════════════════
create table if not exists public.communes (
  code             text not null,               -- mã nguồn
  name             text not null,               -- tên sau sắp xếp (tên hiện tại)
  province_code    text not null,               -- mã tỉnh
  province_name    text,                        -- tên tỉnh (denormalized)
  level_code       text not null default 'xa', -- 'xa' | 'phuong' | 'dac_ku'
  before_names     jsonb,                       -- danh sách tên cũ (trước sắp xếp)
  before_names_str text,                        -- dạng text: "tên1, tên2"
  status           text not null default 'merged', -- merged | not_applied | unchanged
  source           text,                        -- ghi nguồn pháp lý
  note             text,                        -- ghi chú
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint communes_code_pk primary key (code, province_code),
  constraint communes_name_uq unique (name, province_code),
  constraint communes_status_check
    check (status in ('merged', 'not_applied', 'unchanged'))
);

create index if not exists idx_communes_province on public.communes(province_code);
create index if not exists idx_communes_status on public.communes(status);
create index if not exists idx_communes_before_names on public.communes
  using gin (before_names jsonb_path_ops);

-- Thêm trigger updated_at đơn giản
create or replace function public.set_communes_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_communes_updated_at on public.communes;
create trigger trg_communes_updated_at
  before update on public.communes
  for each row execute function public.set_communes_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. admin_unit_history — đối chiếu 63 đơn vị cũ → đơn vị mới
-- (fill từ admin_unit_history legacy hoặc auto từ communes.before_names)
-- ═══════════════════════════════════════════════════════════════════════════════
create table if not exists public.admin_unit_history (
  id         bigserial primary key,
  old_name   text not null,                     -- 'Sóc Trăng'
  old_type   text,                              -- 'Tỉnh'
  new_code   text not null,                     -- mã unit hiện tại (FK → communes.code)
  new_name   text,                              -- tên hiện tại
  changed    boolean not null default true,     -- false = giữ nguyên / chỉ đổi tên
  note       text,
  unique (old_name, new_code)
);

create index if not exists idx_history_new_code on public.admin_unit_history(new_code);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. documents — văn bản pháp lý tham khảo
-- ═══════════════════════════════════════════════════════════════════════════════
create table if not exists public.documents (
  id              uuid primary key default gen_random_uuid(),
  document_number text not null unique,          -- '202/2025/QH15' | '1655/NQ-UBTVQH15'
  document_type   text,                           -- resolution | decision | law
  title           text not null,
  issuer          text,
  issued_date     date,
  effective_from  date,
  effective_to    date,
  url             text,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_documents_number on public.documents(document_number);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. sources — nguồn dữ liệu
-- ═══════════════════════════════════════════════════════════════════════════════
create table if not exists public.sources (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  publisher   text,
  url         text,
  accessed_at date,
  sort_order  int not null default 0,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_sources_title on public.sources(title);

-- ═══════════════════════════════════════════════════════════════════════════════
-- Views tiện dụng (thay thế 3 view cũ)
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. commune_trail — view hiển thị trước–sau sắp xếp
create or replace view public.commune_trail
with (security_invoker = true) as
select
  c.code,
  c.name as after_name,
  c.province_code,
  c.province_name,
  c.level_code,
  c.before_names,
  c.before_names_str,
  c.status,
  u.name as province_name_full
from public.communes c
left join public.admin_units u
  on u.code = c.province_code
where (c.before_names is not null or c.status = 'unchanged')
order by c.province_code, c.name;

-- 2. merged_units — danh sách tất cả đơn vị đã sáp nhập
create or replace view public.merged_units
with (security_invoker = true) as
select
  au.code as new_code,
  au.name as new_name,
  au.type as new_type,
  array_agg(distinct uh.old_name) as old_names
from public.admin_units au
left join public.admin_unit_history uh
  on uh.new_code = au.code
group by au.code, au.name, au.type;

-- ═══════════════════════════════════════════════════════════════════════════════
-- RLS: chỉ đọc công khai
-- ═══════════════════════════════════════════════════════════════════════════════
alter table public.admin_units         enable row level security;
alter table public.communes            enable row level security;
alter table public.admin_unit_history  enable row level security;
alter table public.documents           enable row level security;
alter table public.sources             enable row level security;

drop policy if exists "public read" on public.admin_units;
drop policy if exists "public read" on public.communes;
drop policy if exists "public read" on public.admin_unit_history;
drop policy if exists "public read" on public.documents;
drop policy if exists "public read" on public.sources;

create policy "public read" on public.admin_units         for select to anon, authenticated using (true);
create policy "public read" on public.communes            for select to anon, authenticated using (true);
create policy "public read" on public.admin_unit_history  for select to anon, authenticated using (true);
create policy "public read" on public.documents           for select to anon, authenticated using (true);
create policy "public read" on public.sources             for select to anon, authenticated using (true);

grant select on public.admin_units, public.communes,
    public.admin_unit_history, public.documents, public.sources
to anon, authenticated;

-- Thêm grant cho triggers (cần cho để tránh lỗi)
grant execute on function public.set_communes_updated_at() to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Quy tắc dữ liệu (constraints)
-- ═══════════════════════════════════════════════════════════════════════════════
alter table public.communes
  add constraint communes_before_names_check
  check (before_names is not null or status in ('not_applied', 'unchanged'));

-- ═══════════════════════════════════════════════════════════════════════════════
-- ✅ Database redesigned (4 tables + 2 views + RLS)
-- Sạch hơn 17 bảng cũ, dễ bảo trì và tra cứu.
-- ═══════════════════════════════════════════════════════════════════════════════
