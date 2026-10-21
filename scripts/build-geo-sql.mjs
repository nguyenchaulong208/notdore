/**
 * build-geo-sql.mjs
 * Sinh script seed Supabase cho lớp dữ liệu địa giới mở rộng (geo_*).
 *
 * Chạy:
 *   npm run build:geo
 *   node scripts/build-geo-sql.mjs "C:\duong\dan\database_vietnam_merger.json"
 *
 * Kết quả: db/seed-geo.sql (34 cấp tỉnh + 3.321 xã/phường/đặc khu)
 * Schema tương ứng: db/schema-geo.sql
 * Dữ liệu cấp xã đọc thêm: db/source/communes-open-api.json
 *
 * Script giữ nguyên dữ liệu gốc (kể cả mã trùng), chỉ chuẩn hoá thành các bảng
 * có khoá ổn định (slug) để có thể bổ sung cấp xã/phường và các kỳ dữ liệu sau.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "db/seed-geo.sql");

const inputPath =
  process.argv[2] ?? resolve(ROOT, "db/source/database_vietnam_merger.json");
const communesPath = resolve(ROOT, "db/source/communes-open-api.json");

const DATASET_CODE = "vn-admin-2025-07-01";
const DATASET_NAME = "Việt Nam — Đơn vị hành chính sau sắp xếp 01/07/2025";
const COUNTRY_CODE = "VN";
const EFFECTIVE_FROM = "2025-07-01";

/* ── Tiện ích ────────────────────────────────────────────────────────────── */

const sqlText = (value) => {
  if (value === null || value === undefined) return "null";
  return `'${String(value).replace(/'/g, "''")}'`;
};

const sqlJson = (value) => `${sqlText(JSON.stringify(value ?? {}))}::jsonb`;

const sqlNumber = (value) => {
  if (value === null || value === undefined || value === "") return "null";
  const number = Number(value);
  return Number.isFinite(number) ? String(number) : "null";
};

const slugify = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

const normalizeName = (value) =>
  slugify(String(value ?? "").replace(/^(Thành phố|Tỉnh|Thủ đô)\s+/i, ""));

const isoDate = (value) => {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(value ?? "").trim());
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
};

const unique = (values) => [...new Set(values.filter(Boolean))];

const sourceNamesFromLabel = (label) => {
  const cleaned = String(label ?? "")
    .replace(/^Kết luận\s+\d+:\s*/i, "")
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .trim();

  if (!cleaned) return [];
  return unique(cleaned.split(/\s+\+\s+/).map((part) => part.trim()));
};

const classifyEvent = (province, resolution) => {
  const text = `${province.noi_dung ?? ""} ${resolution?.loai ?? ""}`;

  // Ưu tiên "điều chỉnh": nhiều tỉnh giữ nguyên cấp tỉnh nhưng vẫn chỉnh thể
  // diện tích / đồng bộ cấp xã, nên vẫn là một sự kiện điều chỉnh.
  if (/chỉnh thể diện tích|đồng bộ cấp xã|tạo 1/i.test(text)) return "adjust";
  if (/không sáp nhập|giữ nguyên/i.test(text)) return "keep";
  return "merge";
};

/* ── Đọc & kiểm tra dữ liệu ──────────────────────────────────────────────── */

const raw = JSON.parse(await readFile(inputPath, "utf8"));
const provincesRaw = Array.isArray(raw.tinh) ? raw.tinh : [];
const evaluationsRaw = Array.isArray(raw.danh_gia_capan_xa_phuong)
  ? raw.danh_gia_capan_xa_phuong
  : [];
const resolutionsRaw = Array.isArray(raw.chitiet_cong_hoan)
  ? raw.chitiet_cong_hoan
  : [];

if (!provincesRaw.length) {
  throw new Error("JSON không có mảng 'tinh'.");
}

const warnings = [];

/* Dữ liệu cấp xã là tùy chọn: nếu chưa có file thì seed chỉ có 34 tỉnh. */
let communesRaw = null;
try {
  communesRaw = JSON.parse(await readFile(communesPath, "utf8"));
} catch {
  warnings.push(`Chưa có ${communesPath}; seed chỉ sinh cấp tỉnh.`);
}

const resolutionByKey = new Map();
for (const resolution of resolutionsRaw) {
  const key = normalizeName(resolution.ten_tinh);
  if (resolutionByKey.has(key)) {
    warnings.push(`Nhiều nghị quyết cùng tỉnh: ${resolution.ten_tinh}`);
  } else {
    resolutionByKey.set(key, resolution);
  }
}

const evaluationByKey = new Map();
for (const evaluation of evaluationsRaw) {
  const key = normalizeName(evaluation.ten_tinh);
  if (evaluationByKey.has(key)) {
    warnings.push(`Nhiều dòng đánh giá cùng tỉnh: ${evaluation.ten_tinh}`);
  } else {
    evaluationByKey.set(key, evaluation);
  }
}

for (const province of provincesRaw) {
  const key = normalizeName(province.ten);
  if (!resolutionByKey.has(key)) warnings.push(`Thiếu nghị quyết: ${province.ten}`);
  if (!evaluationByKey.has(key)) warnings.push(`Thiếu đánh giá cấp xã: ${province.ten}`);
}

/* Mã trùng trong cùng cấp: dữ liệu 2025 có '43' cho cả Điện Biên và Đồng Nai. */
const codeGroups = new Map();
for (const province of provincesRaw) {
  const key = `province:${province.ma}`;
  if (!codeGroups.has(key)) codeGroups.set(key, []);
  codeGroups.get(key).push(province.ten);
}
const duplicateCodes = [...codeGroups.entries()]
  .filter(([, names]) => names.length > 1)
  .map(([key, names]) => ({ key: key.split(":")[1], names }));

for (const duplicate of duplicateCodes) {
  warnings.push(
    `Mã '${duplicate.key}' trùng cho: ${duplicate.names.join(", ")} — giữ nguyên, dùng slug làm khoá.`,
  );
}

/* ── Chuẩn hoá tỉnh/thành ────────────────────────────────────────────────── */

const usedSlugs = new Set();
const provinces = provincesRaw.map((province, index) => {
  const key = normalizeName(province.ten);
  const resolution = resolutionByKey.get(key) ?? null;
  const evaluation = evaluationByKey.get(key) ?? null;

  const baseSlug = `${province.ma}-${slugify(province.ten)}`;
  let slug = baseSlug;
  let suffix = 2;
  while (usedSlugs.has(slug)) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
  usedSlugs.add(slug);

  const typeCode =
    province.loai === "tỉnh" ? "tinh" : "thanh_pho_truc_thuoc_trung_quan";

  return {
    ...province,
    slug,
    sortOrder: index + 1,
    typeCode,
    effectiveFrom: isoDate(province.xac_thuc_dong) ?? EFFECTIVE_FROM,
    resolution,
    evaluation,
    eventType: classifyEvent(province, resolution),
  };
});

/* ── Chuẩn hoá xã/phường/đặc khu ────────────────────────────────────────── */

const communeStats = communesRaw?.meta?.stats ?? null;
const communeUnits = [];

if (Array.isArray(communesRaw?.communes) && communesRaw.communes.length) {
  const provinceSlugs = new Set(provinces.map((province) => province.slug));
  const usedCommuneSlugs = new Set();

  for (const [index, commune] of communesRaw.communes.entries()) {
    if (!provinceSlugs.has(commune.parentSlug)) {
      warnings.push(`Cấp xã ${commune.name}: không tìm thấy parentSlug '${commune.parentSlug}'.`);
      continue;
    }

    const baseSlug = `${commune.code}-${slugify(commune.name)}`;
    let slug = baseSlug;
    let suffix = 2;
    while (usedCommuneSlugs.has(slug)) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }
    usedCommuneSlugs.add(slug);

    communeUnits.push({
      parentSlug: commune.parentSlug,
      typeCode: commune.type,
      code: commune.code,
      name: commune.name,
      slug,
      sortOrder: Number(commune.sortOrder) || index + 1,
      effectiveFrom: commune.effectiveFrom ?? EFFECTIVE_FROM,
      metadata: {
        source: communesRaw.meta?.source ?? "provinces.open-api.vn",
        source_url: communesRaw.meta?.sourceUrl ?? null,
        province_code: commune.provinceCode ?? null,
        province_name: commune.provinceName ?? null,
        geo_province_code: commune.geoProvinceCode ?? null,
        api_province_code: commune.apiProvinceCode ?? null,
        short_codename: commune.shortCodename ?? null,
        type_label: commune.typeLabel ?? null,
      },
    });
  }

  if (communeUnits.length !== 3321) {
    warnings.push(`Số xã/phường/đặc khu=${communeUnits.length}, kỳ vọng 3321.`);
  }
} else {
  warnings.push("Không có dữ liệu cấp xã; seed chỉ sinh 34 tỉnh.");
}

/* Kiểm tra tổng số liệu so với meta. */
const sum = (list, key) =>
  list.reduce((total, item) => total + Number(item?.[key] ?? 0), 0);

const meta = raw.meta ?? {};
const totals = {
  provinces: provinces.length,
  unitsAfter: sum(provincesRaw, "so_don_vi_moi"),
  communesBefore: sum(provincesRaw, "so_xa_truoc"),
  communes: sum(provincesRaw, "so_xa_moi"),
  wards: sum(provincesRaw, "so_phuong_moi"),
  specialZones: sum(provincesRaw, "so_dac_ku_moi"),
  notApplied: sum(provincesRaw, "so_not_applied"),
};

if (meta.total_provinces != null && Number(meta.total_provinces) !== totals.provinces) {
  warnings.push(`meta.total_provinces=${meta.total_provinces}, thực tế=${totals.provinces}`);
}
if (meta.total_units_after != null && Number(meta.total_units_after) !== totals.unitsAfter) {
  warnings.push(`meta.total_units_after=${meta.total_units_after}, thực tế=${totals.unitsAfter}`);
}
if (meta.total_xa != null && Number(meta.total_xa) !== totals.communes) {
  warnings.push(`meta.total_xa=${meta.total_xa}, thực tế=${totals.communes}`);
}
if (meta.total_phuong != null && Number(meta.total_phuong) !== totals.wards) {
  warnings.push(`meta.total_phuong=${meta.total_phuong}, thực tế=${totals.wards}`);
}
if (meta.total_dac_ku != null && Number(meta.total_dac_ku) !== totals.specialZones) {
  warnings.push(`meta.total_dac_ku=${meta.total_dac_ku}, thực tế=${totals.specialZones}`);
}
if (meta.total_not_applied != null && Number(meta.total_not_applied) !== totals.notApplied) {
  warnings.push(`meta.total_not_applied=${meta.total_not_applied}, thực tế=${totals.notApplied}`);
}

for (const province of provinces) {
  const evaluation = province.evaluation;
  const componentTotal =
    Number(evaluation?.so_xa ?? province.so_xa_moi ?? 0) +
    Number(evaluation?.so_phuong ?? province.so_phuong_moi ?? 0) +
    Number(evaluation?.so_dac_ku ?? province.so_dac_ku_moi ?? 0) +
    Number(evaluation?.so_not_applied ?? province.so_not_applied ?? 0);

  if (Number(province.so_don_vi_moi) !== componentTotal) {
    warnings.push(
      `${province.ten}: so_don_vi_moi=${province.so_don_vi_moi} nhưng tổng thành phần=${componentTotal}`,
    );
  }

  if (evaluation) {
    const pairs = [
      ["so_xa_moi", "so_xa"],
      ["so_phuong_moi", "so_phuong"],
      ["so_dac_ku_moi", "so_dac_ku"],
      ["so_not_applied", "so_not_applied"],
    ];
    for (const [left, right] of pairs) {
      if (Number(province[left]) !== Number(evaluation[right])) {
        warnings.push(
          `${province.ten}: ${left}=${province[left]} lệch đánh giá ${right}=${evaluation[right]}`,
        );
      }
    }
  }
}

/* ── Văn bản pháp lý ────────────────────────────────────────────────────── */

const documents = new Map();

const addDocument = (document) => {
  if (!documents.has(document.number)) documents.set(document.number, document);
};

addDocument({
  number: "202/2025/QH15",
  type: "resolution",
  title: "Sắp xếp đơn vị hành chính cấp tỉnh",
  issuer: "Quốc hội",
  issued: "2025-06-12",
  effective: EFFECTIVE_FROM,
  metadata: {
    source: "Nghị quyết 202/2025/QH15",
    scope: "province",
  },
});

addDocument({
  number: "19/2025/QĐ-TTg",
  type: "decision",
  title: "Bảng mã số đơn vị hành chính",
  issuer: "Thủ tướng Chính phủ",
  issued: "2025-06-30",
  effective: EFFECTIVE_FROM,
  metadata: {
    source: "Quyết định 19/2025/QĐ-TTg",
    scope: "code_table",
  },
});

for (const resolution of resolutionsRaw) {
  addDocument({
    number: resolution.so_quyet,
    type: "resolution",
    title: `Sắp xếp đơn vị hành chính cấp xã — ${resolution.ten_tinh}`,
    issuer: "Ủy ban Thường vụ Quốc hội",
    issued: "2025-06-16",
    effective: EFFECTIVE_FROM,
    metadata: {
      province_name: resolution.ten_tinh,
      source_label: resolution.loai,
    },
  });
}

/* ── Sự kiện & liên kết ─────────────────────────────────────────────────── */

const events = provinces.map((province) => ({
  provinceSlug: province.slug,
  eventType: province.eventType,
  title:
    province.resolution?.loai ??
    `Sắp xếp đơn vị hành chính — ${province.ten}`,
  description: province.noi_dung ?? null,
  effectiveFrom: province.effectiveFrom,
  documentNumber: province.resolution?.so_quyet ?? null,
  metadata: {
    province_code: province.ma,
    province_slug: province.slug,
    source_field: "tinh.noi_dung",
    source_label: province.resolution?.loai ?? null,
  },
}));

const eventUnits = [];
for (const event of events) {
  eventUnits.push({ provinceSlug: event.provinceSlug, role: "target", sourceName: null });

  const sourceNames = sourceNamesFromLabel(event.title);
  for (const sourceName of sourceNames) {
    eventUnits.push({
      provinceSlug: event.provinceSlug,
      role: "source",
      sourceName,
    });
  }
}

/* ── Chỉ số ─────────────────────────────────────────────────────────────── */

const metrics = [];
for (const province of provinces) {
  const evaluation = province.evaluation;

  const addMetric = (code, value, documentNumber) => {
    if (value === null || value === undefined || value === "") return;
    metrics.push({
      unitSlug: province.slug,
      code,
      value: Number(value),
      documentNumber: documentNumber ?? null,
    });
  };

  addMetric("unit_count_after", province.so_don_vi_moi, province.resolution?.so_quyet);
  addMetric("commune_count_before", province.so_xa_truoc, "202/2025/QH15");
  addMetric(
    "commune_count",
    evaluation?.so_xa ?? province.so_xa_moi,
    province.resolution?.so_quyet,
  );
  addMetric(
    "ward_count",
    evaluation?.so_phuong ?? province.so_phuong_moi,
    province.resolution?.so_quyet,
  );
  addMetric(
    "special_zone_count",
    evaluation?.so_dac_ku ?? province.so_dac_ku_moi,
    province.resolution?.so_quyet,
  );
  addMetric(
    "not_applied_count",
    evaluation?.so_not_applied ?? province.so_not_applied,
    province.resolution?.so_quyet,
  );
}

/* ── Sinh SQL ───────────────────────────────────────────────────────────── */

const lines = [];
const push = (line = "") => lines.push(line);

push("-- =============================================================================");
push("-- Auto-generated by scripts/build-geo-sql.mjs — đừng sửa tay.");
push(`-- Nguồn: ${basename(inputPath)}`);
push(`-- Dataset: ${DATASET_CODE} — ${DATASET_NAME}`);
push(`-- Số đơn vị cấp tỉnh: ${provinces.length}`);
if (duplicateCodes.length) {
  push("--");
  push("-- CẢNH BÁO DỮ LIỆU:");
  for (const duplicate of duplicateCodes) {
    push(`--   mã '${duplicate.key}' trùng cho: ${duplicate.names.join(", ")}`);
  }
  push("--   Schema không dùng code làm khoá duy nhất; dùng slug/id.");
}
push("--");
push("-- Chạy sau db/schema-geo.sql trong Supabase SQL Editor.");
push("-- =============================================================================");
push();
push("begin;");
push();
push("-- Làm sạch dataset cùng mã để chạy lại không bị nhân đôi.");
push(`delete from public.geo_datasets where code = ${sqlText(DATASET_CODE)};`);
push(`update public.geo_datasets set is_current = false where country_code = ${sqlText(COUNTRY_CODE)} and code <> ${sqlText(DATASET_CODE)};`);
push();

push("-- ── 1. Dataset ───────────────────────────────────────────────────────────────");
push("insert into public.geo_datasets");
push("  (code, name, description, country_code, effective_from, effective_to, is_current, metadata)");
push("values (");
push(`  ${sqlText(DATASET_CODE)},`);
push(`  ${sqlText(DATASET_NAME)},`);
push(`  ${sqlText(meta.note ?? null)},`);
push(`  ${sqlText(COUNTRY_CODE)},`);
push(`  ${sqlText(EFFECTIVE_FROM)},`);
push("  null,");
push("  true,");
push(`  ${sqlJson({
    created_by: meta.created_by ?? null,
    effective_date: meta.effective_date ?? null,
    totals: {
      provinces: totals.provinces,
      units_after: totals.unitsAfter,
      communes_before: totals.communesBefore,
      communes: totals.communes,
      wards: totals.wards,
      special_zones: totals.specialZones,
      not_applied: totals.notApplied,
      newly_formed_communes: totals.communes,
      newly_formed_wards: totals.wards,
    },
    official_totals: communeStats ? {
      provinces: communeStats.provinces,
      total: communeStats.total,
      communes: communeStats.xa,
      wards: communeStats.phuong,
      special_zones: communeStats.dac_ku,
      not_applied: totals.notApplied,
    } : null,
    source_file: basename(inputPath),
    commune_source_file: communeUnits.length ? basename(communesPath) : null,
  })}`);
push(");");
push();

push("-- ── 2. Cấp & loại đơn vị ─────────────────────────────────────────────────────");
push("insert into public.geo_levels (code, name, rank, description) values");
push("  ('province', 'Cấp tỉnh', 1, 'Tỉnh, thành phố trực thuộc Trung ương'),");
push("  ('commune',  'Cấp xã',  2, 'Xã, phường, đặc khu (và thị trấn nếu có)')");
push("on conflict (code) do update");
push("  set name = excluded.name, rank = excluded.rank, description = excluded.description;");
push();
push("insert into public.geo_unit_types (code, name, level_code, description, sort_order) values");
push("  ('tinh', 'Tỉnh', 'province', 'Tỉnh trực thuộc Trung ương', 1),");
push("  ('thanh_pho_truc_thuoc_trung_quan', 'Thành phố trực thuộc Trung ương', 'province', 'Thành phố trực thuộc Trung ương', 2),");
push("  ('xa', 'Xã', 'commune', 'Xã thuộc tỉnh/thành phố', 1),");
push("  ('phuong', 'Phường', 'commune', 'Phường thuộc tỉnh/thành phố', 2),");
push("  ('dac_ku', 'Đặc khu', 'commune', 'Đặc khu thuộc tỉnh/thành phố', 3),");
push("  ('thi_tran', 'Thị trấn', 'commune', 'Thị trấn (dự phòng cho dữ liệu sau)', 4)");
push("on conflict (code) do update");
push("  set name = excluded.name, level_code = excluded.level_code,");
push("      description = excluded.description, sort_order = excluded.sort_order;");
push();

push("-- ── 3. Định nghĩa chỉ số & loại sự kiện ─────────────────────────────────────");
push("insert into public.geo_metric_defs (code, name, unit_label, description, sort_order) values");
push("  ('unit_count_before', 'Tổng số đơn vị trước sắp xếp', 'đơn vị', 'Dự phòng cho dữ liệu lịch sử', 1),");
push("  ('unit_count_after', 'Tổng số đơn vị sau sắp xếp', 'đơn vị', 'Tổng xã + phường + đặc khu + chưa áp dụng', 2),");
push("  ('commune_count_before', 'Số xã trước sắp xếp', 'xã', 'Số xã trước khi thực hiện sắp xếp', 3),");
push("  ('commune_count', 'Số xã sau sắp xếp', 'xã', 'Số xã sau khi thực hiện sắp xếp', 4),");
push("  ('ward_count', 'Số phường sau sắp xếp', 'phường', 'Số phường sau khi thực hiện sắp xếp', 5),");
push("  ('special_zone_count', 'Số đặc khu sau sắp xếp', 'đặc khu', 'Số đặc khu sau khi thực hiện sắp xếp', 6),");
push("  ('not_applied_count', 'Số đơn vị không áp dụng sắp xếp', 'đơn vị', 'Đơn vị không thực hiện sắp xếp trong kỳ', 7)");
push("on conflict (code) do update");
push("  set name = excluded.name, unit_label = excluded.unit_label,");
push("      description = excluded.description, sort_order = excluded.sort_order;");
push();
push("insert into public.geo_event_types (code, name, description, sort_order) values");
push("  ('merge', 'Sáp nhập', 'Hai hoặc nhiều đơn vị nhập thành một đơn vị mới', 1),");
push("  ('split', 'Tách', 'Một đơn vị được chia thành nhiều đơn vị', 2),");
push("  ('adjust', 'Điều chỉnh', 'Điều chỉnh địa giới, loại đơn vị hoặc cơ cấu đơn vị', 3),");
push("  ('keep', 'Giữ nguyên', 'Không sáp nhập, giữ nguyên đơn vị', 4),");
push("  ('rename', 'Đổi tên', 'Chỉ đổi tên, không đổi địa giới', 5),");
push("  ('establish', 'Thành lập', 'Thành lập đơn vị mới', 6),");
push("  ('abolish', 'Bãi bỏ', 'Bãi bỏ đơn vị', 7)");
push("on conflict (code) do update");
push("  set name = excluded.name, description = excluded.description, sort_order = excluded.sort_order;");
push();

push("-- ── 4. Văn bản pháp lý ───────────────────────────────────────────────────────");
push("insert into public.geo_documents");
push("  (document_number, document_type, title, issuer, issued_date, effective_from, metadata)");
push("values");
const documentValues = [...documents.values()].map((document) => {
  return `  (${sqlText(document.number)}, ${sqlText(document.type)}, ${sqlText(document.title)}, ${sqlText(document.issuer)}, ${sqlText(document.issued)}, ${sqlText(document.effective)}, ${sqlJson(document.metadata)})`;
});
push(documentValues.join(",\n"));
push("on conflict (document_number) do update");
push("  set document_type = excluded.document_type,");
push("      title = excluded.title,");
push("      issuer = excluded.issuer,");
push("      issued_date = excluded.issued_date,");
push("      effective_from = excluded.effective_from,");
push("      metadata = excluded.metadata;");
push();

push("-- ── 5. Đơn vị hành chính cấp tỉnh ───────────────────────────────────────────");
push("insert into public.geo_units");
push("  (dataset_id, level_code, type_code, code, name, slug, sort_order, effective_from, metadata)");
push("select d.id, v.level_code, v.type_code, v.code, v.name, v.slug,");
push("       v.sort_order, v.effective_from::date, v.metadata");
push("from (values");
const unitValues = provinces.map((province) => {
  return `  (${sqlText("province")}, ${sqlText(province.typeCode)}, ${sqlText(province.ma)}, ${sqlText(province.ten)}, ${sqlText(province.slug)}, ${sqlNumber(province.sortOrder)}, ${sqlText(province.effectiveFrom)}, ${sqlJson({
    source_type: province.loai,
    source_effective_date: province.xac_thuc_dong ?? null,
    source_resolution: province.resolution?.so_quyet ?? null,
    source_label: province.resolution?.loai ?? null,
    source_counts: {
      so_don_vi_moi: province.so_don_vi_moi ?? null,
      so_xa_truoc: province.so_xa_truoc ?? null,
      so_xa_moi: province.so_xa_moi ?? null,
      so_phuong_moi: province.so_phuong_moi ?? null,
      so_dac_ku_moi: province.so_dac_ku_moi ?? null,
      so_not_applied: province.so_not_applied ?? null,
    },
  })})`;
});
push(unitValues.join(",\n"));
push(") as v(level_code, type_code, code, name, slug, sort_order, effective_from, metadata)");
push(`join public.geo_datasets d on d.code = ${sqlText(DATASET_CODE)};`);
push();

if (communeUnits.length) {
  push("-- ── 6. Xã / phường / đặc khu (cấp xã) ────────────────────────────────────────");
  push("insert into public.geo_units");
  push("  (dataset_id, parent_id, level_code, type_code, code, name, slug, sort_order, effective_from, metadata)");
  push("select d.id, parent.id, 'commune', v.type_code, v.code, v.name, v.slug,");
  push("       v.sort_order, v.effective_from::date, v.metadata");
  push("from (values");
  const communeValues = communeUnits.map((commune) => {
    return `  (${sqlText(commune.parentSlug)}, ${sqlText(commune.typeCode)}, ${sqlText(commune.code)}, ${sqlText(commune.name)}, ${sqlText(commune.slug)}, ${sqlNumber(commune.sortOrder)}, ${sqlText(commune.effectiveFrom)}, ${sqlJson(commune.metadata)})`;
  });
  push(communeValues.join(",\n"));
  push(") as v(parent_slug, type_code, code, name, slug, sort_order, effective_from, metadata)");
  push(`join public.geo_datasets d on d.code = ${sqlText(DATASET_CODE)}`);
  push("join public.geo_units parent on parent.dataset_id = d.id");
  push("  and parent.level_code = 'province' and parent.slug = v.parent_slug;");
  push();
}

push("-- ── 7. Chỉ số theo đơn vị ────────────────────────────────────────────────────");
push("insert into public.geo_unit_metrics (unit_id, metric_code, value, source_document_id)");
push("select u.id, v.metric_code, v.value, doc.id");
push("from (values");
const metricValues = metrics.map((metric) => {
  return `  (${sqlText(metric.unitSlug)}, ${sqlText(metric.code)}, ${sqlNumber(metric.value)}, ${sqlText(metric.documentNumber)})`;
});
push(metricValues.join(",\n"));
push(") as v(unit_slug, metric_code, value, document_number)");
push(`join public.geo_datasets d on d.code = ${sqlText(DATASET_CODE)}`);
push("join public.geo_units u on u.dataset_id = d.id and u.slug = v.unit_slug");
push("left join public.geo_documents doc on doc.document_number = v.document_number;");
push();

push("-- ── 8. Sự kiện sắp xếp ───────────────────────────────────────────────────────");
push("insert into public.geo_events");
push("  (dataset_id, document_id, event_type, status, title, description, effective_from, metadata)");
push("select d.id, doc.id, v.event_type, 'effective', v.title, v.description,");
push("       v.effective_from::date, v.metadata");
push("from (values");
const eventValues = events.map((event) => {
  return `  (${sqlText(event.provinceSlug)}, ${sqlText(event.eventType)}, ${sqlText(event.title)}, ${sqlText(event.description)}, ${sqlText(event.effectiveFrom)}, ${sqlText(event.documentNumber)}, ${sqlJson(event.metadata)})`;
});
push(eventValues.join(",\n"));
push(") as v(province_slug, event_type, title, description, effective_from, document_number, metadata)");
push(`join public.geo_datasets d on d.code = ${sqlText(DATASET_CODE)}`);
push("left join public.geo_documents doc on doc.document_number = v.document_number;");
push();

push("-- ── 9. Liên kết sự kiện ↔ đơn vị (nguồn / đích) ─────────────────────────────");
push("insert into public.geo_event_units (event_id, unit_id, source_name, role)");
push("select e.id,");
push("       case when v.role = 'target' then u.id end,");
push("       v.source_name,");
push("       v.role");
push("from (values");
const eventUnitValues = eventUnits.map((eventUnit) => {
  const sourceName = eventUnit.sourceName === null ? "null::text" : sqlText(eventUnit.sourceName);
  return `  (${sqlText(eventUnit.provinceSlug)}, ${sqlText(eventUnit.role)}, ${sourceName})`;
});
push(eventUnitValues.join(",\n"));
push(") as v(province_slug, role, source_name)");
push(`join public.geo_datasets d on d.code = ${sqlText(DATASET_CODE)}`);
push("join public.geo_units u on u.dataset_id = d.id and u.slug = v.province_slug");
push("join public.geo_events e on e.dataset_id = d.id and e.metadata->>'province_slug' = v.province_slug;");
push();

push("-- ── 10. Nguồn tham chiếu ─────────────────────────────────────────────────────");
push("insert into public.geo_sources (dataset_id, title, publisher, url, accessed_at, sort_order)");
push("select d.id, v.title, v.publisher, v.url, v.accessed_at::date, v.sort_order");
push("from (values");
const sourcePublishers = [
  "Quốc hội",
  "Ủy ban Thường vụ Quốc hội",
  "Thủ tướng Chính phủ",
  "Chính phủ",
];
const sourceValues = (Array.isArray(meta.source) ? meta.source : []).map((source, index) => {
  const isGovernmentPortal = /xaydungchinhsach\.chinhphu\.vn/i.test(source);
  return `  (${sqlText(source)}, ${sqlText(sourcePublishers[index] ?? null)}, ${sqlText(isGovernmentPortal ? "https://xaydungchinhsach.chinhphu.vn" : null)}, null::date, ${index + 1})`;
});

if (communeUnits.length && communesRaw?.meta?.sourceUrl) {
  sourceValues.push(
    `  (${sqlText("provinces.open-api.vn — API v2, depth=2")}, ${sqlText("Open API Vietnam")}, ${sqlText(communesRaw.meta.sourceUrl)}, ${sqlText(communesRaw.meta.generated)}, ${sourceValues.length + 1})`,
  );
}

if (sourceValues.length) {
  push(sourceValues.join(",\n"));
  push(") as v(title, publisher, url, accessed_at, sort_order)");
  push(`join public.geo_datasets d on d.code = ${sqlText(DATASET_CODE)};`);
} else {
  push("  (null, null, null, null, 0)");
  push(") as v(title, publisher, url, accessed_at, sort_order)");
  push("where false;");
}
push();
push("commit;");
push();
push("-- Kiểm tra nhanh sau khi chạy:");
push("-- select count(*) from public.geo_units;                 -- 34 tỉnh + 3321 xã/phường");
push("-- select level_code, count(*) from public.geo_units group by level_code;");
push("-- select count(*) from public.geo_unit_metrics;         -- 204");
push("-- select count(*) from public.geo_events;               -- 34");
push("-- select count(*) from public.geo_event_units;          -- 79");
push("-- select count(*) from public.geo_documents;            -- 36");
push("-- select count(*) from public.geo_sources;              -- 5");
push("-- select * from public.geo_data_quality;                -- cảnh báo mã trùng (nếu có)");
push();

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, `${lines.join("\n")}\n`, "utf8");

console.log(`Đã ghi ${OUT}`);
console.log(
  `Tỉnh/thành: ${provinces.length}, xã/phường: ${communeUnits.length}, ` +
  `chỉ số: ${metrics.length}, sự kiện: ${events.length}, văn bản: ${documents.size}, ` +
  `nguồn: ${(meta.source ?? []).length + (communeUnits.length ? 1 : 0)}`,
);
if (warnings.length) {
  console.log(`\nCảnh báo (${warnings.length}):`);
  for (const warning of warnings) console.log(`- ${warning}`);
}
