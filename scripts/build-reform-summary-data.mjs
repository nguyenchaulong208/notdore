/**
 * Chuẩn hoá dữ liệu sắp xếp cấp xã 2025 và bổ sung 127 đơn vị "không thực hiện
 * sắp xếp" vào dữ liệu tổng hợp.
 *
 * Chạy:
 *   node scripts/build-reform-summary-data.mjs
 *
 * Đầu vào:
 *   - db/source/danh_sach_xa_phuong_truoc_sau_sap_xep.json
 *   - db/source/communes-open-api.json
 *   - db/data/commune-reform-summary.json (số liệu tổng hợp đã chuẩn hoá)
 *
 * Đầu ra:
 *   - db/data/commune-reform-summary.json (thêm not_applied_units)
 *   - assets/data/admin-communes.json (fallback tĩnh có trạng thái giữ nguyên)
 *
 * Lưu ý: nguồn mới chỉ có tên 127 đơn vị không thực hiện sắp xếp. Các đơn vị
 * hình thành sau sắp xếp vẫn chỉ có số liệu tổng hợp, không có danh sách tên cũ.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const RAW_PATH = resolve(ROOT, "db/source/danh_sach_xa_phuong_truoc_sau_sap_xep.json");
const COMMUNES_PATH = resolve(ROOT, "db/source/communes-open-api.json");
const SUMMARY_PATH = resolve(ROOT, "db/data/commune-reform-summary.json");
const ADMIN_PATH = resolve(ROOT, "assets/data/admin-communes.json");
const SEED_DIR = resolve(ROOT, "db/seed-geo-2-communes");

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

const slugify = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

// Slug thực tế của geo_units cấp xã do build-geo-sql.mjs sinh từ code + tên.
const seedSlugs = new Set();
try {
  for (const file of readdirSync(SEED_DIR)) {
    if (!file.endsWith(".sql")) continue;
    const text = readFileSync(resolve(SEED_DIR, file), "utf8");
    for (const match of text.matchAll(/'(\d+-(?:xa|phuong|dac_ku)-[^']+)'/g)) {
      seedSlugs.add(match[1]);
    }
  }
} catch {
  // Không có seed cấp xã thì bỏ qua kiểm tra slug; SQL vẫn dùng đúng quy ước.
}

const nfc = (value) =>
  String(value ?? "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const loose = (value) =>
  nfc(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");

const stripType = (value) =>
  String(value ?? "").replace(/^(xã|phường|đặc khu|thị trấn)\s+/iu, "").trim();

const stripParenthetical = (value) =>
  String(value ?? "").replace(/\s*\([^)]*\)\s*$/u, "").trim();

const baseName = (value) => nfc(stripParenthetical(stripType(value)));

const displayName = (value) => stripParenthetical(stripType(value));

const fail = (message) => {
  throw new Error(message);
};

const raw = readJson(RAW_PATH);
const source = readJson(COMMUNES_PATH);
const summary = readJson(SUMMARY_PATH);
const admin = readJson(ADMIN_PATH);

if (!Array.isArray(raw.provinces) || raw.provinces.length !== 34) {
  fail(`Số tỉnh trong nguồn mới = ${raw.provinces?.length}, cần 34`);
}
if (!Array.isArray(summary.rows) || summary.rows.length !== 34) {
  fail(`Số dòng tổng hợp = ${summary.rows?.length}, cần 34`);
}
if (!Array.isArray(source.communes) || source.communes.length !== 3321) {
  fail(`Số đơn vị trong communes-open-api.json = ${source.communes?.length}, cần 3321`);
}

const summaryByProvince = new Map();
for (const row of summary.rows) {
  const key = loose(row.ten_tinh);
  if (summaryByProvince.has(key)) fail(`Trùng tỉnh trong dữ liệu tổng hợp: ${row.ten_tinh}`);
  summaryByProvince.set(key, row);
}

const sourceProvinceBySlug = new Map(source.provinces.map((province) => [province.parentSlug, province]));

const sourceIndex = {
  exact: new Map(),
  loose: new Map(),
};
for (const commune of source.communes) {
  if (!commune.shortCodename) fail(`Thiếu shortCodename: ${commune.name}`);
  for (const [index, field] of [
    [sourceIndex.exact, nfc(baseName(commune.name))],
    [sourceIndex.loose, loose(baseName(commune.name))],
  ]) {
    const mapKey = `${commune.parentSlug}|${field}`;
    if (!index.has(mapKey)) index.set(mapKey, []);
    index.get(mapKey).push(commune);
  }
}

const seenSlugs = new Set();
const matchedRows = [];
const unmatched = [];

for (const rawProvince of raw.provinces) {
  const row = summaryByProvince.get(loose(rawProvince.ten_tinh));
  if (!row) fail(`Không tìm thấy dòng tổng hợp cho tỉnh: ${rawProvince.ten_tinh}`);

  if (String(rawProvince.ma_tinh) !== String(row.ma_tinh)) {
    fail(`${rawProvince.ten_tinh}: mã tỉnh nguồn ${rawProvince.ma_tinh} khác ${row.ma_tinh}`);
  }
  if (String(rawProvince.stt_nx) !== String(row.stt_nx)) {
    fail(`${rawProvince.ten_tinh}: số nghị quyết ${rawProvince.stt_nx} khác ${row.stt_nx}`);
  }
  const status = rawProvince.tinh_trang ?? row.tinh_trang;
  if (String(status) !== String(row.tinh_trang)) {
    fail(`${rawProvince.ten_tinh}: tình trạng ${status} khác ${row.tinh_trang}`);
  }
  if (Number(rawProvince.tong_don_vi) !== Number(row.unit_count_after)) {
    fail(`${rawProvince.ten_tinh}: tổng đơn vị ${rawProvince.tong_don_vi} khác ${row.unit_count_after}`);
  }
  for (const [rawField, rowField] of [
    ["xa_sau", "xa_sau"],
    ["phuong_sau", "phuong_sau"],
    ["dac_ku_sau", "dac_ku_sau"],
  ]) {
    if (Number(rawProvince[rawField]) !== Number(row[rowField])) {
      fail(`${rawProvince.ten_tinh}: ${rawField} ${rawProvince[rawField]} khác ${row[rowField]}`);
    }
  }

  const notApplied = rawProvince.khong_thuc_hien ?? {};
  const names = Array.isArray(notApplied.danh_sach) ? notApplied.danh_sach : [];
  if (Number(notApplied.so_don_vi) !== names.length) {
    fail(
      `${rawProvince.ten_tinh}: so_don_vi=${notApplied.so_don_vi} nhưng danh_sach có ${names.length} tên`,
    );
  }
  if (Number(row.khong_thuc_hien) !== names.length) {
    fail(`${rawProvince.ten_tinh}: khong_thuc_hien=${row.khong_thuc_hien} nhưng có ${names.length} tên`);
  }
  row.not_applied_type = notApplied.loai ?? null;
  row.not_applied_units = [];

  const sourceProvince = sourceProvinceBySlug.get(row.province_slug);
  if (!sourceProvince) fail(`Không tìm thấy tỉnh ${row.province_slug} trong communes-open-api.json`);

  for (const sourceName of names) {
    const normalizedName = nfc(baseName(sourceName));
    const looseName = loose(baseName(sourceName));
    const exactMatches = sourceIndex.exact.get(`${row.province_slug}|${normalizedName}`) ?? [];
    const candidates = exactMatches.length
      ? exactMatches
      : sourceIndex.loose.get(`${row.province_slug}|${looseName}`) ?? [];
    const matchKind = exactMatches.length ? "exact" : "normalized";

    if (candidates.length !== 1) {
      unmatched.push({
        province: row.ten_tinh,
        sourceName,
        matchKind,
        candidates: candidates.map((unit) => unit.name),
      });
      continue;
    }

    const unit = candidates[0];
    const unitSlug = `${unit.code}-${slugify(unit.name)}`;
    if (seenSlugs.has(unitSlug)) fail(`Trùng unit_slug: ${unitSlug}`);
    seenSlugs.add(unitSlug);
    if (seedSlugs.size && !seedSlugs.has(unitSlug)) {
      fail(`Slug ${unitSlug} không có trong seed geo_units cấp xã`);
    }

    const sourceTypeMatch = String(sourceName).match(/^(xã|phường|đặc khu|thị trấn)\s+/iu);
    const nameVariant = nfc(baseName(sourceName)) !== nfc(baseName(unit.name));

    row.not_applied_units.push({
      source_name: sourceName,
      source_short_name: displayName(sourceName),
      source_type: sourceTypeMatch ? sourceTypeMatch[1].toLowerCase() : null,
      source_has_type_prefix: Boolean(sourceTypeMatch),
      unit_slug: unitSlug,
      unit_name: unit.name,
      unit_type: unit.type,
      unit_type_label: unit.typeLabel,
      match: matchKind,
      name_variant: nameVariant,
    });
  }

  matchedRows.push(row);
}

if (unmatched.length) {
  fail(
    `Không đối chiếu được ${unmatched.length} đơn vị:\n${unmatched
      .map(
        (item) =>
          `- ${item.province}: "${item.sourceName}" (${item.matchKind}) -> ${
            item.candidates.join(" / ") || "không có"
          }`,
      )
      .join("\n")}`,
  );
}

const notAppliedUnits = matchedRows.flatMap((row) =>
  row.not_applied_units.map((unit) => ({ ...unit, province_slug: row.province_slug, resolution_number: row.stt_nx })),
);
if (notAppliedUnits.length !== 127) {
  fail(`Số đơn vị không sắp xếp đã đối chiếu = ${notAppliedUnits.length}, cần 127`);
}

const totalNotApplied = matchedRows.reduce((total, row) => total + row.not_applied_units.length, 0);
const totalUnitCountAfter = matchedRows.reduce((total, row) => total + Number(row.unit_count_after), 0);
if (totalNotApplied !== Number(raw.tong_quan?.tong_khong_thuc_hien ?? 127)) {
  fail(`Tổng không thực hiện = ${totalNotApplied}, nguồn ghi ${raw.tong_quan?.tong_khong_thuc_hien}`);
}
if (totalUnitCountAfter !== Number(raw.tong_quan?.tong_don_vi_sau ?? 3321)) {
  fail(`Tổng đơn vị sau = ${totalUnitCountAfter}, nguồn ghi ${raw.tong_quan?.tong_don_vi_sau}`);
}

const exactCount = notAppliedUnits.filter((unit) => unit.match === "exact").length;
const normalizedCount = notAppliedUnits.filter((unit) => unit.match === "normalized").length;
const variantCount = notAppliedUnits.filter((unit) => unit.name_variant).length;

summary.meta = {
  ...summary.meta,
  title: "Tổng hợp xã/phường/đặc khu trước và sau sắp xếp 2025",
  source_files: [
    ...new Set([
      ...(summary.meta.source_files ?? []),
      "db/source/danh_sach_xa_phuong_truoc_sau_sap_xep.json",
      "db/source/communes-open-api.json",
    ]),
  ],
  source_documents: raw.meta?.source ?? summary.meta.source_documents,
  effective_date: "2025-07-01",
  note:
    "Dữ liệu gồm số liệu tổng hợp theo 34 tỉnh/thành và tên 127 đơn vị không thực hiện sắp xếp. " +
    "3.194 đơn vị hình thành sau sắp xếp chỉ có số liệu tổng hợp, chưa có danh sách tên trước sắp xếp. " +
    "xa_truoc là số xã ghi nhận trước sắp xếp theo nguồn; khong_thuc_hien là số đơn vị giữ nguyên; " +
    "unit_count_after = xa_sau + phuong_sau + dac_ku_sau + khong_thuc_hien.",
  not_applied: {
    total: notAppliedUnits.length,
    exact: exactCount,
    normalized: normalizedCount,
    name_variants: variantCount,
    source_file: "db/source/danh_sach_xa_phuong_truoc_sau_sap_xep.json",
    source_generated_by: raw.meta?.generated_by ?? null,
    source_note: raw.meta?.note ?? null,
    match_note:
      "Đối chiếu theo tỉnh + tên đã bỏ tiền tố loại đơn vị và phần ghi chú trong ngoặc; " +
      "khớp chính xác trước, sau đó mới khớp không dấu. Tên gốc được giữ trong source_name.",
  },
};

writeFileSync(SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

// Cập nhật fallback tĩnh để giao diện hiển thị đúng ngay cả khi chưa nạp Supabase.
const adminBySlug = new Map();
for (const commune of admin.communes ?? []) {
  const slug = `${commune.code}-${slugify(commune.name)}`;
  adminBySlug.set(slug, commune);
}

// Xoá phần đã đánh dấu ở lần chạy trước để script có thể chạy lại (idempotent).
for (const commune of admin.communes ?? []) {
  if (/^Không thực hiện sắp xếp theo /.test(commune.note ?? "")) {
    delete commune.beforeNames;
    delete commune.changed;
    delete commune.note;
  }
  delete commune.reformStatus;
  delete commune.notApplied;
  delete commune.sourceName;
  delete commune.sourceResolution;
}

let adminUpdated = 0;
for (const unit of notAppliedUnits) {
  const commune = adminBySlug.get(unit.unit_slug);
  if (!commune) fail(`Không tìm thấy ${unit.unit_slug} trong assets/data/admin-communes.json`);

  const beforeName = displayName(unit.unit_name);
  const variantNote = unit.name_variant
    ? ` Nguồn ghi "${unit.source_name}", đơn vị hiện hành là "${unit.unit_name}".`
    : "";
  commune.beforeNames = [beforeName];
  commune.changed = false;
  commune.note = `Không thực hiện sắp xếp theo ${unit.resolution_number}.${variantNote}`;
  commune.reformStatus = "not_applied";
  commune.notApplied = true;
  commune.sourceName = unit.source_name;
  commune.sourceResolution = unit.resolution_number;
  adminUpdated += 1;
}

admin.meta = {
  ...admin.meta,
  notApplied: notAppliedUnits.length,
  notAppliedNote:
    "Tên 127 đơn vị không thực hiện sắp xếp được lấy từ 34 nghị quyết UBTVQH15; " +
    "các đơn vị còn lại chỉ có số liệu tổng hợp.",
};
writeFileSync(ADMIN_PATH, `${JSON.stringify(admin)}\n`, "utf8");

console.log(`Đã ghi ${SUMMARY_PATH}`);
console.log(`Đã cập nhật ${adminUpdated} đơn vị trong ${ADMIN_PATH}`);
console.log(`- 127 đơn vị không thực hiện sắp xếp: ${exactCount} khớp chính xác, ${normalizedCount} khớp không dấu`);
console.log(`- ${variantCount} tên có khác biệt chính tả so với geo_units`);
