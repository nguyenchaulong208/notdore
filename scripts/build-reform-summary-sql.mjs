/**
 * Sinh SQL cập nhật số liệu tổng hợp xã/phường trước và sau sắp xếp 2025.
 *
 * Chạy:
 *   node scripts/build-reform-summary-sql.mjs
 *
 * Nguồn: db/data/commune-reform-summary.json
 * Đầu ra: db/seed-commune-reform-summary.sql
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const INPUT = resolve(ROOT, "db/data/commune-reform-summary.json");
const OUTPUT = resolve(ROOT, "db/seed-commune-reform-summary.sql");

const data = JSON.parse(readFileSync(INPUT, "utf8"));
const rows = data.rows;
const totals = data.meta?.totals ?? {};

if (!Array.isArray(rows) || rows.length === 0) {
  throw new Error("Không có rows trong db/data/commune-reform-summary.json");
}

const required = [
  "province_slug",
  "ma_tinh",
  "ten_tinh",
  "stt_nx",
  "tinh_trang",
  "xa_truoc",
  "xa_sau",
  "phuong_sau",
  "dac_ku_sau",
  "khong_thuc_hien",
  "unit_count_after",
];

for (const row of rows) {
  for (const key of required) {
    if (row[key] === undefined || row[key] === null) {
      throw new Error(`Thiếu trường ${key} trong dòng ${JSON.stringify(row)}`);
    }
  }
  if (!Array.isArray(row.not_applied_units)) {
    throw new Error(`Thiếu not_applied_units trong dòng ${row.ten_tinh}`);
  }
  if (row.not_applied_units.length !== Number(row.khong_thuc_hien)) {
    throw new Error(
      `${row.ten_tinh}: not_applied_units=${row.not_applied_units.length}, khong_thuc_hien=${row.khong_thuc_hien}`,
    );
  }
}

const notAppliedRows = rows.flatMap((row) =>
  row.not_applied_units.map((unit) => ({
    province_slug: row.province_slug,
    resolution_number: row.stt_nx,
    unit_slug: unit.unit_slug,
    unit_name: unit.unit_name,
    unit_type: unit.unit_type,
    source_name: unit.source_name,
    source_type: unit.source_type ?? null,
    match: unit.match,
    name_variant: Boolean(unit.name_variant),
  })),
);

if (notAppliedRows.length !== Number(totals.khong_thuc_hien ?? 0)) {
  throw new Error(
    `Số đơn vị không thực hiện sắp xếp=${notAppliedRows.length}, tổng nguồn=${totals.khong_thuc_hien}`,
  );
}
if (new Set(notAppliedRows.map((unit) => unit.unit_slug)).size !== notAppliedRows.length) {
  throw new Error("Có unit_slug trùng trong not_applied_units");
}

const sqlText = (value) => `'${String(value).replaceAll("'", "''")}'`;
const sqlJson = (value) => `${sqlText(JSON.stringify(value))}::jsonb`;
const sqlInt = (value) => {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`Giá trị số không hợp lệ: ${value}`);
  }
  return String(n);
};

const summaryValues = rows
  .map((r) => {
    const metadata = {
      source_field: "danh_sach_xa_phuong_truoc_sau_sap_xep.json",
      note:
        "Số liệu tổng hợp theo tỉnh; metadata.not_applied_units chỉ chứa 127 đơn vị " +
        "không thực hiện sắp xếp, không phải danh sách tên của 3.194 đơn vị còn lại.",
      not_applied_type: r.not_applied_type ?? null,
      not_applied_unit_count: r.not_applied_units.length,
      not_applied_units: r.not_applied_units.map((unit) => unit.source_name),
      not_applied_unit_details: r.not_applied_units.map((unit) => ({
        source_name: unit.source_name,
        unit_slug: unit.unit_slug,
        unit_name: unit.unit_name,
        unit_type: unit.unit_type,
        match: unit.match,
        name_variant: Boolean(unit.name_variant),
      })),
    };
    return `  (${[
      sqlText(r.province_slug),
      sqlText(r.ma_tinh),
      sqlText(r.ten_tinh),
      sqlText(r.stt_nx),
      sqlText(r.tinh_trang),
      sqlInt(r.xa_truoc),
      sqlInt(r.xa_sau),
      sqlInt(r.phuong_sau),
      sqlInt(r.dac_ku_sau),
      sqlInt(r.khong_thuc_hien),
      sqlJson(metadata),
    ].join(", ")})`;
  })
  .join(",\n");

const metricRows = [];
for (const r of rows) {
  const metrics = [
    ["commune_count_before", r.xa_truoc, "202/2025/QH15", "xa_truoc"],
    ["commune_count", r.xa_sau, r.stt_nx, "xa_sau"],
    ["ward_count", r.phuong_sau, r.stt_nx, "phuong_sau"],
    ["special_zone_count", r.dac_ku_sau, r.stt_nx, "dac_ku_sau"],
    ["not_applied_count", r.khong_thuc_hien, r.stt_nx, "khong_thuc_hien"],
    ["unit_count_after", r.unit_count_after, r.stt_nx, "unit_count_after"],
  ];
  for (const [code, value, documentNumber, field] of metrics) {
    metricRows.push(
      `  (${[
        sqlText(r.province_slug),
        sqlText(code),
        sqlInt(value),
        sqlText(documentNumber),
        sqlJson({ source_field: field, note: "Đồng bộ từ bảng tổng hợp sắp xếp 2025." }),
      ].join(", ")})`,
    );
  }
}

const notAppliedValues = notAppliedRows
  .map(
    (unit) =>
      `  (${[
        sqlText(unit.province_slug),
        sqlText(unit.resolution_number),
        sqlText(unit.unit_slug),
        sqlText(unit.unit_name),
        sqlText(unit.unit_type),
        sqlText(unit.source_name),
        unit.source_type === null ? "null" : sqlText(unit.source_type),
        sqlText(unit.match),
        unit.name_variant ? "true" : "false",
      ].join(", ")})`,
  )
  .join(",\n");

const totalsJson = JSON.stringify(totals);
const sourceNote = data.meta?.source_total_note ?? "";

const sql = `-- =============================================================================
-- NotDore — số liệu tổng hợp xã/phường/đặc khu trước và sau sắp xếp 2025
--
-- Tệp này được sinh tự động bởi scripts/build-reform-summary-sql.mjs.
-- Nguồn dữ liệu: db/data/commune-reform-summary.json
--
-- LƯU Ý QUAN TRỌNG
--   Dữ liệu nguồn gồm SỐ LIỆU TỔNG HỢP theo 34 tỉnh/thành và TÊN 127 đơn vị
--   không thực hiện sắp xếp. 3.194 đơn vị hình thành sau sắp xếp vẫn chưa có
--   danh sách tên trước sắp xếp; muốn có đủ phải đọc riêng 34 nghị quyết
--   UBTVQH (1654–1687/NQ-UBTVQH15).
--
--   xa_truoc            : số xã ghi nhận trước sắp xếp theo nguồn
--   xa_sau              : số xã sau sắp xếp
--   phuong_sau          : số phường sau sắp xếp
--   dac_ku_sau          : số đặc khu sau sắp xếp
--   khong_thuc_hien     : số đơn vị không thực hiện sắp xếp (127)
--   unit_count_after    : xa_sau + phuong_sau + dac_ku_sau + khong_thuc_hien
--
--   127 đơn vị giữ nguyên được đối chiếu với geo_units cấp xã và cập nhật
--   metadata: reform_status=not_applied, changed=false, before_names, source_name.
--   Tên gốc trong nguồn được giữ ở source_name; 2 trường hợp khác chính tả
--   (Tuấn Đáo/Tuấn Đạo, Thuận Hòa/Thuận Hoà) được ghi chú, không sửa tên geo_units.
--
--   Bản tổng hợp trước có tong_quan.tong_xa_truoc = 3233, nhưng tổng 34 dòng
--   xa_truoc lại là 2621. Script dùng tổng theo 34 dòng và giữ nguyên ghi chú
--   về sai lệch trong metadata của dataset; không tự ý sửa số liệu nguồn.
--
-- Chạy sau db/schema-geo.sql, db/seed-geo-1-core.sql, các seed cấp xã và
-- db/seed-geo-3-relations.sql để có đủ dataset, đơn vị, văn bản và sự kiện.
-- Có thể chạy lại nhiều lần (idempotent).
-- =============================================================================

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Bảng tổng hợp (một dòng cho mỗi tỉnh/thành trong dataset hiện hành)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.geo_reform_summaries (
  id                  bigserial primary key,
  dataset_id          uuid not null references public.geo_datasets(id) on delete cascade,
  unit_id             uuid references public.geo_units(id) on delete set null,
  province_slug       text not null,
  province_code       text not null,
  province_name       text not null,
  resolution_number   text not null,
  status              text not null default 'Sắp xếp',
  communes_before     integer not null check (communes_before >= 0),
  communes_after      integer not null check (communes_after >= 0),
  wards_after         integer not null check (wards_after >= 0),
  special_zones_after integer not null check (special_zones_after >= 0),
  not_applied         integer not null check (not_applied >= 0),
  total_units_after   integer generated always as
    (communes_after + wards_after + special_zones_after + not_applied) stored,
  communes_delta      integer generated always as
    (communes_after - communes_before) stored,
  source_document_id  uuid references public.geo_documents(id) on delete set null,
  metadata            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create unique index if not exists geo_reform_summaries_dataset_name_uq
  on public.geo_reform_summaries (dataset_id, province_name);

create index if not exists idx_geo_reform_summaries_dataset
  on public.geo_reform_summaries (dataset_id);

create index if not exists idx_geo_reform_summaries_unit
  on public.geo_reform_summaries (unit_id);

drop trigger if exists trg_geo_reform_summaries_updated_at
  on public.geo_reform_summaries;
create trigger trg_geo_reform_summaries_updated_at
  before update on public.geo_reform_summaries
  for each row execute function public.set_updated_at();

alter table public.geo_reform_summaries enable row level security;

drop policy if exists "public read" on public.geo_reform_summaries;
create policy "public read" on public.geo_reform_summaries
  for select to anon, authenticated using (true);

grant select on public.geo_reform_summaries to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Upsert 34 dòng tổng hợp
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.geo_reform_summaries (
  dataset_id,
  unit_id,
  province_slug,
  province_code,
  province_name,
  resolution_number,
  status,
  communes_before,
  communes_after,
  wards_after,
  special_zones_after,
  not_applied,
  source_document_id,
  metadata
)
select
  d.id,
  u.id,
  v.province_slug,
  v.province_code,
  v.province_name,
  v.resolution_number,
  v.status,
  v.communes_before,
  v.communes_after,
  v.wards_after,
  v.special_zones_after,
  v.not_applied,
  doc.id,
  v.metadata
from (values
${summaryValues}
) as v(
  province_slug,
  province_code,
  province_name,
  resolution_number,
  status,
  communes_before,
  communes_after,
  wards_after,
  special_zones_after,
  not_applied,
  metadata
)
join public.geo_datasets d
  on d.code = 'vn-admin-2025-07-01'
left join public.geo_units u
  on u.dataset_id = d.id
 and u.level_code = 'province'
 and u.slug = v.province_slug
left join public.geo_documents doc
  on doc.document_number = v.resolution_number
on conflict (dataset_id, province_name) do update set
  unit_id             = excluded.unit_id,
  province_slug       = excluded.province_slug,
  province_code       = excluded.province_code,
  resolution_number   = excluded.resolution_number,
  status              = excluded.status,
  communes_before     = excluded.communes_before,
  communes_after      = excluded.communes_after,
  wards_after         = excluded.wards_after,
  special_zones_after = excluded.special_zones_after,
  not_applied         = excluded.not_applied,
  source_document_id  = excluded.source_document_id,
  metadata            = public.geo_reform_summaries.metadata || excluded.metadata;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Đánh dấu 127 đơn vị không thực hiện sắp xếp trên geo_units cấp xã
--    Chỉ cập nhật metadata; không đổi tên, mã hay slug của geo_units.
-- ─────────────────────────────────────────────────────────────────────────────
with not_applied(
  province_slug,
  resolution_number,
  unit_slug,
  unit_name,
  unit_type,
  source_name,
  source_type,
  match_kind,
  name_variant
) as (
  values
${notAppliedValues}
),
matched as (
  select
    u.id,
    u.name,
    v.province_slug,
    v.resolution_number,
    v.unit_slug,
    v.unit_name,
    v.unit_type,
    v.source_name,
    v.source_type,
    v.match_kind,
    v.name_variant
  from public.geo_units u
  join public.geo_datasets d
    on d.id = u.dataset_id
   and d.code = 'vn-admin-2025-07-01'
  join not_applied v
    on v.unit_slug = u.slug
  where u.level_code = 'commune'
)
update public.geo_units u
set metadata = u.metadata || jsonb_build_object(
  'reform_status', 'not_applied',
  'not_applied', true,
  'changed', false,
  'before_names', jsonb_build_array(
    regexp_replace(m.name, '^(Xã|Phường|Đặc khu|Thị trấn)\\s+', '', 'i')
  ),
  'before_note', 'Không thực hiện sắp xếp theo ' || m.resolution_number || '.',
  'note', 'Không thực hiện sắp xếp theo ' || m.resolution_number || '.' ||
    case when m.name_variant then
      ' Nguồn ghi "' || m.source_name || '", đơn vị hiện hành là "' || m.name || '".'
    else '' end,
  'source_resolution', m.resolution_number,
  'source_effective_date', '2025-07-01',
  'source_name', m.source_name,
  'source_type', m.source_type,
  'source_match', m.match_kind,
  'source_name_variant', m.name_variant,
  'source_unit_type', m.unit_type
)
from matched m
where u.id = m.id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Đồng bộ các chỉ số per-tỉnh trong geo_unit_metrics
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.geo_unit_metrics (
  unit_id,
  metric_code,
  value,
  source_document_id,
  metadata
)
select
  u.id,
  m.metric_code,
  m.value,
  doc.id,
  m.metadata
from (values
${metricRows.join(",\n")}
) as m(
  province_slug,
  metric_code,
  value,
  document_number,
  metadata
)
join public.geo_datasets d
  on d.code = 'vn-admin-2025-07-01'
join public.geo_units u
  on u.dataset_id = d.id
 and u.level_code = 'province'
 and u.slug = m.province_slug
left join public.geo_documents doc
  on doc.document_number = m.document_number
on conflict (unit_id, metric_code) do update set
  value              = excluded.value,
  source_document_id = excluded.source_document_id,
  metadata           = public.geo_unit_metrics.metadata || excluded.metadata;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Gắn số nghị quyết / trạng thái / danh sách giữ nguyên vào sự kiện hiện có
-- ─────────────────────────────────────────────────────────────────────────────
update public.geo_events e
set metadata = e.metadata || jsonb_build_object(
  'resolution_number', s.resolution_number,
  'reform_status', s.status,
  'not_applied', s.not_applied,
  'not_applied_units', s.metadata->'not_applied_units'
)
from public.geo_reform_summaries s
where e.dataset_id = s.dataset_id
  and e.metadata->>'province_slug' = s.province_slug;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Ghi chú tổng hợp vào metadata dataset (không ghi đè metadata cũ)
-- ─────────────────────────────────────────────────────────────────────────────
update public.geo_datasets d
set metadata = d.metadata || jsonb_build_object(
  'reform_summary', ${sqlJson({
    source_file: "db/data/commune-reform-summary.json",
    rows: rows.length,
    totals,
    not_applied_units: notAppliedRows.length,
    not_applied_source_file: "db/source/danh_sach_xa_phuong_truoc_sau_sap_xep.json",
    not_applied_note:
      "Chỉ 127 đơn vị không thực hiện sắp xếp có tên; 3.194 đơn vị còn lại chỉ có số liệu tổng hợp.",
    source_total_note: sourceNote,
  })}
)
where d.code = 'vn-admin-2025-07-01';

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Kiểm tra nhanh (chỉ cảnh báo, không chặn giao dịch)
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_rows          integer;
  v_before        integer;
  v_after         integer;
  v_units         integer;
  v_metrics       integer;
  v_not_applied   integer;
begin
  select
    count(*),
    coalesce(sum(communes_before), 0),
    coalesce(sum(total_units_after), 0)
  into v_rows, v_before, v_after
  from public.geo_reform_summaries s
  join public.geo_datasets d on d.id = s.dataset_id
  where d.code = 'vn-admin-2025-07-01';

  select count(*) into v_units
  from public.geo_units u
  join public.geo_datasets d on d.id = u.dataset_id
  where d.code = 'vn-admin-2025-07-01'
    and u.level_code = 'province';

  select count(*) into v_metrics
  from public.geo_unit_metrics m
  join public.geo_units u on u.id = m.unit_id
  join public.geo_datasets d on d.id = u.dataset_id
  where d.code = 'vn-admin-2025-07-01'
    and m.metric_code in (
      'commune_count_before', 'commune_count', 'ward_count',
      'special_zone_count', 'not_applied_count', 'unit_count_after'
    );

  select count(*) into v_not_applied
  from public.geo_units u
  join public.geo_datasets d on d.id = u.dataset_id
  where d.code = 'vn-admin-2025-07-01'
    and u.level_code = 'commune'
    and u.metadata->>'reform_status' = 'not_applied';

  raise notice 'geo_reform_summaries: % dòng; communes_before=%; total_units_after=%',
    v_rows, v_before, v_after;
  raise notice 'geo_units cấp tỉnh: %; geo_unit_metrics liên quan: %; đơn vị giữ nguyên: %',
    v_units, v_metrics, v_not_applied;

  if v_rows <> ${rows.length} then
    raise warning 'Số dòng tổng hợp là %, mong đợi ${rows.length}.', v_rows;
  end if;
  if v_before <> ${Number(totals.xa_truoc ?? 0)} then
    raise warning 'Tổng communes_before là %, mong đợi ${Number(totals.xa_truoc ?? 0)}.', v_before;
  end if;
  if v_after <> ${Number(totals.unit_count_after ?? 0)} then
    raise warning 'Tổng total_units_after là %, mong đợi ${Number(totals.unit_count_after ?? 0)}.', v_after;
  end if;
  if v_not_applied <> ${notAppliedRows.length} then
    raise warning 'Số geo_units được đánh dấu not_applied là %, mong đợi ${notAppliedRows.length}.',
      v_not_applied;
  end if;
end
$$;

commit;

-- =============================================================================
-- Kiểm tra sau khi chạy:
--   select * from public.geo_reform_summaries order by province_name;
--   select sum(communes_before), sum(communes_after), sum(wards_after),
--          sum(special_zones_after), sum(not_applied), sum(total_units_after)
--   from public.geo_reform_summaries;
--   select * from public.geo_unit_summary
--   where level_code = 'province' order by name;
-- =============================================================================
`;

writeFileSync(OUTPUT, sql, "utf8");
console.log(`Đã ghi ${OUTPUT}`);
console.log(`- ${rows.length} dòng tổng hợp`);
console.log(`- ${metricRows.length} dòng geo_unit_metrics`);
console.log(`- ${notAppliedRows.length} đơn vị không thực hiện sắp xếp sẽ được đánh dấu`);
console.log(`- Tổng xã trước: ${totals.xa_truoc ?? "?"}`);
console.log(`- Tổng đơn vị sau: ${totals.unit_count_after ?? "?"}`);
