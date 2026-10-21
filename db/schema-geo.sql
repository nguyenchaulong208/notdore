-- =============================================================================
-- NotDore — Lớp dữ liệu địa giới hành chính mở rộng (geo_*)
--
-- Chạy trong Supabase SQL Editor. File này độc lập với các bảng admin_units /
-- admin_unit_history cũ, nên không làm hỏng công cụ tra cứu hiện tại.
--
-- Mô hình:
--   geo_datasets      phiên bản dữ liệu (01/07/2025, các kỳ sắp xếp sau...)
--   geo_levels        cấp hành chính (tỉnh, xã...)
--   geo_unit_types    loại đơn vị (tỉnh, thành phố TW, xã, phường, đặc khu...)
--   geo_units         đơn vị hành chính, có parent_id để mở rộng xuống cấp xã
--   geo_unit_metrics  chỉ số dạng long-format (dân số, diện tích, số xã...)
--   geo_documents     văn bản pháp lý
--   geo_events        sự kiện sáp nhập / điều chỉnh / giữ nguyên
--   geo_event_units   liên kết nhiều-nhiều giữa sự kiện và đơn vị
--   geo_sources       nguồn tham chiếu của từng dataset
--   geo_unit_aliases  tên cũ / tên viết tắt / tên không dấu để tìm kiếm
--
-- Chỉ đọc công khai (RLS select). Ghi dữ liệu bằng SQL Editor hoặc service role.
-- =============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Dataset & từ vựng (level / type)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.geo_datasets (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,                 -- 'vn-admin-2025-07-01'
  name           text not null,
  description    text,
  country_code   text not null default 'VN',
  effective_from date not null,
  effective_to   date,
  is_current     boolean not null default false,
  metadata       jsonb not null default '{}'::jsonb,   -- số liệu tổng, ghi chú nguồn
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint geo_datasets_period_check
    check (effective_to is null or effective_to >= effective_from)
);

-- Mỗi quốc gia chỉ có một dataset đang hiện hành.
create unique index if not exists geo_datasets_current_uq
  on public.geo_datasets (country_code)
  where is_current;

create index if not exists idx_geo_datasets_effective
  on public.geo_datasets (effective_from desc);

create table if not exists public.geo_levels (
  code        text primary key,                        -- 'province', 'commune'
  name        text not null,                           -- 'Cấp tỉnh', 'Cấp xã'
  rank        smallint not null unique,                -- 1 = cao nhất
  description text
);

create table if not exists public.geo_unit_types (
  code        text primary key,                        -- 'tinh', 'xa', ...
  name        text not null,
  level_code  text not null references public.geo_levels(code) on delete restrict,
  description text,
  sort_order  int not null default 0,
  unique (level_code, name),
  -- Cần cho khoá ngoại ghép (type_code, level_code) ở geo_units.
  unique (code, level_code)
);

create index if not exists idx_geo_unit_types_level
  on public.geo_unit_types (level_code);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Văn bản pháp lý (đứng độc lập, có thể dùng cho nhiều dataset)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.geo_documents (
  id              uuid primary key default gen_random_uuid(),
  document_number text not null unique,                -- '202/2025/QH15'
  document_type   text,                                -- resolution | decision | law
  title           text not null,
  issuer          text,
  issued_date     date,
  effective_from  date,
  effective_to    date,
  url             text,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint geo_documents_period_check
    check (effective_to is null or effective_from is null or effective_to >= effective_from)
);

create index if not exists idx_geo_documents_issued
  on public.geo_documents (issued_date desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Đơn vị hành chính (cây; sẵn sàng cho cấp xã/phường/đặc khu)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.geo_units (
  id             uuid primary key default gen_random_uuid(),
  dataset_id     uuid not null references public.geo_datasets(id) on delete cascade,
  -- Xoá đơn vị cha thì xoá luôn cây con; dữ liệu hiện tại chỉ có cấp tỉnh
  -- nhưng cấu trúc đã sẵn sàng cho cấp xã/phường.
  parent_id      uuid references public.geo_units(id) on delete cascade,
  level_code     text not null references public.geo_levels(code) on delete restrict,
  type_code      text not null,
  code           text not null,                        -- mã nguồn; có thể trùng trong dữ liệu cũ
  name           text not null,
  slug           text not null,                        -- khóa tự nhiên ổn định trong dataset
  short_name     text,
  full_name      text,
  sort_order     int not null default 0,
  effective_from date,
  effective_to   date,
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint geo_units_period_check
    check (effective_to is null or effective_from is null or effective_to >= effective_from),
  constraint geo_units_slug_uq unique (dataset_id, slug),
  -- Không đặt unique(dataset_id, level_code, code) vì nguồn 2025 có mã '43'
  -- xuất hiện cho cả Điện Biên và Đồng Nai. Dùng slug/id làm khóa ổn định.
  constraint geo_units_code_name_uq unique (dataset_id, level_code, code, name),
  -- Loại đơn vị phải thuộc đúng cấp (không cho type 'xa' gắn với level 'province').
  constraint geo_units_type_level_fk
    foreign key (type_code, level_code)
    references public.geo_unit_types (code, level_code)
    on delete restrict
);

create index if not exists idx_geo_units_dataset
  on public.geo_units (dataset_id);

create index if not exists idx_geo_units_parent
  on public.geo_units (parent_id);

create index if not exists idx_geo_units_code
  on public.geo_units (dataset_id, code);

create index if not exists idx_geo_units_type
  on public.geo_units (dataset_id, type_code);

create index if not exists idx_geo_units_name_trgm
  on public.geo_units using gin (name gin_trgm_ops);

-- parent_id phải cùng dataset và không được tự trỏ vào chính nó.
create or replace function public.geo_units_check_parent()
returns trigger language plpgsql as $$
declare
  parent_dataset uuid;
begin
  if new.parent_id is null then
    return new;
  end if;

  if new.parent_id = new.id then
    raise exception 'geo_units: parent_id không thể trỏ tới chính nó';
  end if;

  select dataset_id into parent_dataset
  from public.geo_units
  where id = new.parent_id;

  if parent_dataset is null then
    raise exception 'geo_units: parent_id % không tồn tại', new.parent_id;
  end if;

  if parent_dataset <> new.dataset_id then
    raise exception 'geo_units: parent_id phải thuộc cùng dataset';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_geo_units_check_parent on public.geo_units;
create trigger trg_geo_units_check_parent
  before insert or update of parent_id, dataset_id on public.geo_units
  for each row execute function public.geo_units_check_parent();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Tên thay thế & chỉ số (long-format)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.geo_unit_aliases (
  id          bigserial primary key,
  unit_id     uuid not null references public.geo_units(id) on delete cascade,
  name        text not null,
  alias_type  text not null default 'alias',           -- old | short | unsigned | search
  is_primary  boolean not null default false,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  unique (unit_id, name)
);

create index if not exists idx_geo_unit_aliases_unit
  on public.geo_unit_aliases (unit_id);

create index if not exists idx_geo_unit_aliases_name_trgm
  on public.geo_unit_aliases using gin (name gin_trgm_ops);

create table if not exists public.geo_metric_defs (
  code        text primary key,                        -- 'population', 'commune_count'
  name        text not null,
  unit_label  text,                                    -- 'người', 'xã', 'km²'
  description text,
  sort_order  int not null default 0
);

create table if not exists public.geo_unit_metrics (
  id                 bigserial primary key,
  unit_id            uuid not null references public.geo_units(id) on delete cascade,
  metric_code        text not null references public.geo_metric_defs(code) on delete restrict,
  value              numeric not null,
  source_document_id uuid references public.geo_documents(id) on delete set null,
  metadata           jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  unique (unit_id, metric_code)
);

create index if not exists idx_geo_unit_metrics_code
  on public.geo_unit_metrics (metric_code);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Sự kiện sáp nhập / điều chỉnh
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.geo_event_types (
  code        text primary key,                        -- merge | split | adjust | keep ...
  name        text not null,
  description text,
  sort_order  int not null default 0
);

create table if not exists public.geo_events (
  id             uuid primary key default gen_random_uuid(),
  dataset_id     uuid not null references public.geo_datasets(id) on delete cascade,
  document_id    uuid references public.geo_documents(id) on delete set null,
  event_type     text not null references public.geo_event_types(code) on delete restrict,
  status         text not null default 'effective',   -- proposed | approved | effective | superseded | rejected
  title          text not null,
  description    text,
  effective_from date,
  effective_to   date,
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint geo_events_period_check
    check (effective_to is null or effective_from is null or effective_to >= effective_from)
);

create index if not exists idx_geo_events_dataset
  on public.geo_events (dataset_id, effective_from desc);

create index if not exists idx_geo_events_document
  on public.geo_events (document_id);

create table if not exists public.geo_event_units (
  id          bigserial primary key,
  event_id    uuid not null references public.geo_events(id) on delete cascade,
  -- Xoá unit phải xoá liên kết; nếu dùng `set null` thì dòng target sẽ vi phạm
  -- check (unit_id hoặc source_name) khi dataset bị xoá theo cascade.
  unit_id     uuid references public.geo_units(id) on delete cascade,
  source_name text,                                    -- tên đơn vị cũ chưa có row trong geo_units
  role        text not null,                           -- source | target | affected | unchanged
  note        text,
  metadata    jsonb not null default '{}'::jsonb,
  constraint geo_event_units_ref_check
    check (unit_id is not null or source_name is not null)
);

create unique index if not exists geo_event_units_uq
  on public.geo_event_units (event_id, role, coalesce(unit_id::text, source_name));

create index if not exists idx_geo_event_units_unit
  on public.geo_event_units (unit_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Nguồn tham chiếu của dataset
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.geo_sources (
  id          uuid primary key default gen_random_uuid(),
  dataset_id  uuid not null references public.geo_datasets(id) on delete cascade,
  title       text not null,
  publisher   text,
  url         text,
  accessed_at date,
  sort_order  int not null default 0,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_geo_sources_dataset
  on public.geo_sources (dataset_id, sort_order);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. View tiện dụng
-- ─────────────────────────────────────────────────────────────────────────────
create or replace view public.geo_current_units
with (security_invoker = true) as
select
  u.id,
  u.dataset_id,
  d.code            as dataset_code,
  u.parent_id,
  p.name            as parent_name,
  u.level_code,
  l.name            as level_name,
  l.rank            as level_rank,
  u.type_code,
  t.name            as type_name,
  u.code,
  u.name,
  u.slug,
  u.short_name,
  u.full_name,
  u.sort_order,
  u.effective_from,
  u.effective_to,
  u.metadata
from public.geo_units u
join public.geo_datasets d
  on d.id = u.dataset_id
 and d.is_current
 and d.effective_from <= current_date
 and (d.effective_to is null or d.effective_to >= current_date)
join public.geo_levels l
  on l.code = u.level_code
join public.geo_unit_types t
  on t.code = u.type_code
left join public.geo_units p
  on p.id = u.parent_id
where (u.effective_from is null or u.effective_from <= current_date)
  and (u.effective_to is null or u.effective_to >= current_date);

create or replace view public.geo_unit_summary
with (security_invoker = true) as
select
  u.id,
  u.dataset_id,
  d.code as dataset_code,
  d.is_current,
  u.code,
  u.name,
  u.slug,
  u.level_code,
  u.type_code,
  max(m.value) filter (where m.metric_code = 'unit_count_after')::int     as unit_count_after,
  max(m.value) filter (where m.metric_code = 'commune_count_before')::int as commune_count_before,
  max(m.value) filter (where m.metric_code = 'commune_count')::int        as commune_count,
  max(m.value) filter (where m.metric_code = 'ward_count')::int           as ward_count,
  max(m.value) filter (where m.metric_code = 'special_zone_count')::int   as special_zone_count,
  max(m.value) filter (where m.metric_code = 'not_applied_count')::int    as not_applied_count
from public.geo_units u
join public.geo_datasets d
  on d.id = u.dataset_id
left join public.geo_unit_metrics m
  on m.unit_id = u.id
group by
  u.id, u.dataset_id, d.code, d.is_current,
  u.code, u.name, u.slug, u.level_code, u.type_code;

-- Các mã đơn vị bị trùng trong cùng dataset/cấp.
-- Dữ liệu 01/07/2025 có một cảnh báo: mã '43' dùng cho cả Điện Biên và Đồng Nai.
create or replace view public.geo_data_quality
with (security_invoker = true) as
select
  dataset_id,
  level_code,
  code,
  count(*)::int                         as unit_count,
  array_agg(name order by name)         as names,
  array_agg(slug order by name)         as slugs
from public.geo_units
group by dataset_id, level_code, code
having count(*) > 1;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. updated_at
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_geo_datasets_updated_at on public.geo_datasets;
create trigger trg_geo_datasets_updated_at
  before update on public.geo_datasets
  for each row execute function public.set_updated_at();

drop trigger if exists trg_geo_units_updated_at on public.geo_units;
create trigger trg_geo_units_updated_at
  before update on public.geo_units
  for each row execute function public.set_updated_at();

drop trigger if exists trg_geo_documents_updated_at on public.geo_documents;
create trigger trg_geo_documents_updated_at
  before update on public.geo_documents
  for each row execute function public.set_updated_at();

drop trigger if exists trg_geo_events_updated_at on public.geo_events;
create trigger trg_geo_events_updated_at
  before update on public.geo_events
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. RLS: chỉ đọc công khai
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.geo_datasets        enable row level security;
alter table public.geo_levels          enable row level security;
alter table public.geo_unit_types      enable row level security;
alter table public.geo_documents       enable row level security;
alter table public.geo_units           enable row level security;
alter table public.geo_unit_aliases    enable row level security;
alter table public.geo_metric_defs     enable row level security;
alter table public.geo_unit_metrics    enable row level security;
alter table public.geo_event_types     enable row level security;
alter table public.geo_events          enable row level security;
alter table public.geo_event_units     enable row level security;
alter table public.geo_sources         enable row level security;

drop policy if exists "public read" on public.geo_datasets;
drop policy if exists "public read" on public.geo_levels;
drop policy if exists "public read" on public.geo_unit_types;
drop policy if exists "public read" on public.geo_documents;
drop policy if exists "public read" on public.geo_units;
drop policy if exists "public read" on public.geo_unit_aliases;
drop policy if exists "public read" on public.geo_metric_defs;
drop policy if exists "public read" on public.geo_unit_metrics;
drop policy if exists "public read" on public.geo_event_types;
drop policy if exists "public read" on public.geo_events;
drop policy if exists "public read" on public.geo_event_units;
drop policy if exists "public read" on public.geo_sources;

create policy "public read" on public.geo_datasets     for select to anon, authenticated using (true);
create policy "public read" on public.geo_levels       for select to anon, authenticated using (true);
create policy "public read" on public.geo_unit_types   for select to anon, authenticated using (true);
create policy "public read" on public.geo_documents    for select to anon, authenticated using (true);
create policy "public read" on public.geo_units        for select to anon, authenticated using (true);
create policy "public read" on public.geo_unit_aliases for select to anon, authenticated using (true);
create policy "public read" on public.geo_metric_defs  for select to anon, authenticated using (true);
create policy "public read" on public.geo_unit_metrics for select to anon, authenticated using (true);
create policy "public read" on public.geo_event_types  for select to anon, authenticated using (true);
create policy "public read" on public.geo_events       for select to anon, authenticated using (true);
create policy "public read" on public.geo_event_units  for select to anon, authenticated using (true);
create policy "public read" on public.geo_sources      for select to anon, authenticated using (true);

-- Cấp quyền đọc cho PostgREST; RLS vẫn là lớp kiểm soát cuối.
grant select on public.geo_datasets, public.geo_levels, public.geo_unit_types,
  public.geo_documents, public.geo_units, public.geo_unit_aliases,
  public.geo_metric_defs, public.geo_unit_metrics, public.geo_event_types,
  public.geo_events, public.geo_event_units, public.geo_sources
to anon, authenticated;

grant select on public.geo_current_units, public.geo_unit_summary,
  public.geo_data_quality
to anon, authenticated;
