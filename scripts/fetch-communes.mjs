/**
 * fetch-communes.mjs
 * Tải danh sách xã / phường / đặc khu sau sắp xếp 01/07/2025 từ
 * provinces.open-api.vn (v2, depth=2), đối chiếu với 34 Nghị quyết
 * UBTVQH15 và sinh:
 *   - db/source/communes-open-api.json   (nguồn chuẩn hoá, để build SQL)
 *   - assets/data/admin-communes.json    (fallback tĩnh cho frontend)
 *
 * Chạy: node scripts/fetch-communes.mjs
 *
 * Lưu ý: API dùng mã tỉnh khác lớp legacy/geo_*. Script map theo TÊN đã
 * chuẩn hoá, không map theo mã. Mỗi bản ghi lưu cả:
 *   provinceCode     mã 2 ký tự của admin_units (legacy)
 *   geoProvinceCode  mã trong database_vietnam_merger.json (có thể trùng)
 *   parentSlug       slug của geo_units cấp tỉnh
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_URL = "https://provinces.open-api.vn/api/v2/?depth=2";
const LEGACY_PATH = resolve(ROOT, "assets/data/admin-merger.json");
const GEO_SOURCE_PATH = resolve(ROOT, "db/source/database_vietnam_merger.json");
const OUT_SOURCE = resolve(ROOT, "db/source/communes-open-api.json");
const OUT_WEB = resolve(ROOT, "assets/data/admin-communes.json");

const EFFECTIVE_FROM = "2025-07-01";
const EXPECTED = {
  provinces: 34,
  total: 3321,
  xa: 2621,
  phuong: 687,
  dac_ku: 13,
  notApplied: 127,
};

const TYPE_MAP = {
  "xã": { code: "xa", label: "Xã" },
  "phường": { code: "phuong", label: "Phường" },
  "đặc khu": { code: "dac_ku", label: "Đặc khu" },
};

const normalizeName = (value) => String(value ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/\u0111/gi, "d")
  .replace(/^(thanh pho|tinh|thu do)\s+/i, "")
  .replace(/\s+/g, " ")
  .trim()
  .toLowerCase();

const slugify = (value) => String(value ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/\u0111/gi, "d")
  .replace(/[^a-zA-Z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .toLowerCase();

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

const main = async () => {
  const legacy = await readJson(LEGACY_PATH);
  const geo = await readJson(GEO_SOURCE_PATH);

  const legacyByKey = new Map();
  for (const province of legacy.provinces ?? []) {
    const key = normalizeName(province.name);
    if (legacyByKey.has(key)) throw new Error(`Legacy trùng tên tỉnh: ${province.name}`);
    legacyByKey.set(key, province);
  }

  const geoByKey = new Map();
  for (const province of geo.tinh ?? []) {
    const key = normalizeName(province.ten);
    if (geoByKey.has(key)) throw new Error(`Nguồn geo trùng tên tỉnh: ${province.ten}`);
    geoByKey.set(key, province);
  }

  const response = await fetch(SOURCE_URL, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Không tải được ${SOURCE_URL} (HTTP ${response.status})`);
  const api = await response.json();

  if (!Array.isArray(api) || api.length !== EXPECTED.provinces) {
    throw new Error(`Số tỉnh từ API = ${api?.length}, kỳ vọng ${EXPECTED.provinces}`);
  }

  const provinces = [];
  const communes = [];
  const problems = [];
  const usedCodes = new Set();
  const usedParentSlugs = new Set();

  let totalXa = 0;
  let totalPhuong = 0;
  let totalDacKu = 0;

  for (const apiProvince of api) {
    const apiName = String(apiProvince.name ?? "").trim();
    const key = normalizeName(apiName);
    const legacyProvince = legacyByKey.get(key);
    const geoProvince = geoByKey.get(key);

    if (!legacyProvince) problems.push(`Không map được legacy: ${apiName}`);
    if (!geoProvince) problems.push(`Không map được geo: ${apiName}`);
    if (!legacyProvince || !geoProvince) continue;

    const parentSlug = `${geoProvince.ma}-${slugify(geoProvince.ten)}`;
    if (usedParentSlugs.has(parentSlug)) problems.push(`Trùng parentSlug: ${parentSlug}`);
    usedParentSlugs.add(parentSlug);

    const wards = Array.isArray(apiProvince.wards) ? apiProvince.wards : [];
    if (!wards.length) problems.push(`API không có xã/phường: ${apiName}`);
    if (wards.length !== Number(geoProvince.so_don_vi_moi)) {
      problems.push(
        `${apiName}: API ${wards.length} đơn vị, nguồn geo ${geoProvince.so_don_vi_moi}`,
      );
    }

    const counts = { xa: 0, phuong: 0, dac_ku: 0 };
    for (const [index, ward] of wards.entries()) {
      const type = TYPE_MAP[ward.division_type];
      if (!type) {
        problems.push(`${apiName}: loại không hỗ trợ "${ward.division_type}" (${ward.name})`);
        continue;
      }

      const code = String(ward.code ?? "").trim();
      const name = String(ward.name ?? "").trim();
      if (!code || !name) {
        problems.push(`${apiName}: bản ghi thiếu mã/tên`);
        continue;
      }
      if (usedCodes.has(code)) problems.push(`Trùng mã xã/phường: ${code} (${name})`);
      usedCodes.add(code);

      counts[type.code] += 1;
      communes.push({
        code,
        name,
        type: type.code,
        typeLabel: type.label,
        provinceCode: legacyProvince.code,
        provinceName: legacyProvince.name,
        geoProvinceCode: geoProvince.ma,
        parentSlug,
        apiProvinceCode: String(apiProvince.code),
        shortCodename: ward.short_codename ?? null,
        sortOrder: index + 1,
        effectiveFrom: EFFECTIVE_FROM,
      });
    }

    totalXa += counts.xa;
    totalPhuong += counts.phuong;
    totalDacKu += counts.dac_ku;

    provinces.push({
      code: legacyProvince.code,
      name: legacyProvince.name,
      geoCode: geoProvince.ma,
      parentSlug,
      apiCode: String(apiProvince.code),
      apiName,
      counts: {
        total: wards.length,
        ...counts,
      },
    });
  }

  if (provinces.length !== EXPECTED.provinces) {
    problems.push(`Số tỉnh map được = ${provinces.length}, kỳ vọng ${EXPECTED.provinces}`);
  }
  if (communes.length !== EXPECTED.total) {
    problems.push(`Tổng xã/phường = ${communes.length}, kỳ vọng ${EXPECTED.total}`);
  }
  if (totalXa !== EXPECTED.xa) problems.push(`Tổng xã = ${totalXa}, kỳ vọng ${EXPECTED.xa}`);
  if (totalPhuong !== EXPECTED.phuong) {
    problems.push(`Tổng phường = ${totalPhuong}, kỳ vọng ${EXPECTED.phuong}`);
  }
  if (totalDacKu !== EXPECTED.dac_ku) {
    problems.push(`Tổng đặc khu = ${totalDacKu}, kỳ vọng ${EXPECTED.dac_ku}`);
  }

  if (problems.length) {
    console.error(`Không thể tạo dữ liệu (${problems.length} lỗi):`);
    for (const problem of problems) console.error(`- ${problem}`);
    process.exit(1);
  }

  const meta = {
    title: "Danh sách xã, phường, đặc khu sau sắp xếp 01/07/2025",
    version: "1.0",
    generated: new Date().toISOString().slice(0, 10),
    effectiveFrom: EFFECTIVE_FROM,
    level: "commune",
    source: "provinces.open-api.vn (v2, depth=2)",
    sourceUrl: SOURCE_URL,
    stats: {
      provinces: provinces.length,
      total: communes.length,
      xa: totalXa,
      phuong: totalPhuong,
      dac_ku: totalDacKu,
    },
    validation: {
      perProvinceTotalsMatch: true,
      expected: EXPECTED,
      note:
        "Tổng 3.321 đơn vị và số lượng từng tỉnh khớp với 34 Nghị quyết UBTVQH15. " +
        "Chênh lệch 2.499 xã / 682 phường trong nguồn cũ là do nguồn đó chỉ đếm đơn vị " +
        "hình thành sau sắp xếp, chưa cộng 127 đơn vị không thực hiện sắp xếp.",
    },
    notes: [
      "Cấp huyện không còn trong bộ máy hành chính 2 cấp từ 01/07/2025.",
      "Dữ liệu gồm xã, phường và đặc khu; không có thị trấn sau sắp xếp.",
      "Mã xã/phường lấy theo API; mã tỉnh trong geo_* có thể khác mã trong admin_units legacy.",
      "Đối chiếu tổng số và số lượng từng tỉnh với 34 Nghị quyết UBTVQH15 trước khi dùng cho hồ sơ chính thức.",
    ],
    sources: [
      "provinces.open-api.vn — API v2, depth=2",
      "34 Nghị quyết của UBTVQH15 về sắp xếp đơn vị hành chính cấp xã (1654–1687/NQ-UBTVQH15)",
      "Bộ Nội vụ — tổng hợp 3.321 xã, phường, đặc khu sau sắp xếp",
    ],
  };

  const payload = { meta, provinces, communes };

  await mkdir(dirname(OUT_SOURCE), { recursive: true });
  await mkdir(dirname(OUT_WEB), { recursive: true });
  await writeFile(OUT_SOURCE, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await writeFile(OUT_WEB, `${JSON.stringify(payload)}\n`, "utf8");

  console.log(`Đã ghi ${OUT_SOURCE}`);
  console.log(`Đã ghi ${OUT_WEB}`);
  console.log(
    `Tỉnh: ${provinces.length}, xã: ${totalXa}, phường: ${totalPhuong}, ` +
    `đặc khu: ${totalDacKu}, tổng: ${communes.length}`,
  );
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
