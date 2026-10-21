/**
 * build-admin-data.mjs
 * Chuẩn hoá dữ liệu sáp nhập đơn vị hành chính (cấp tỉnh) từ file crawl
 * `vietnam-admin-merger.json` thành:
 *   - assets/data/admin-merger.json   (frontend đọc)
 *   - db/seed-admin.sql               (seed Supabase)
 *
 * Chạy: node scripts/build-admin-data.mjs
 *
 * Nguồn pháp lý: Nghị quyết 202/2025/QH15 + 34 Nghị quyết UBTVQH ngày 16/6/2025,
 * hiệu lực 01/07/2025. Danh sách 63 -> 34 dưới đây là bảng đối chiếu chuẩn dùng
 * để kiểm tra chéo với phần `predecessors` do công cụ crawl sinh ra.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/* ── Bảng đối chiếu 63 đơn vị cũ -> 34 đơn vị mới ───────────────────────── */
const OLD_UNITS = [
  ["Hà Nội", "Thành phố", "01"],
  ["Hà Giang", "Tỉnh", "08"],
  ["Cao Bằng", "Tỉnh", "04"],
  ["Bắc Kạn", "Tỉnh", "19"],
  ["Tuyên Quang", "Tỉnh", "08"],
  ["Lào Cai", "Tỉnh", "15"],
  ["Điện Biên", "Tỉnh", "11"],
  ["Lai Châu", "Tỉnh", "12"],
  ["Sơn La", "Tỉnh", "14"],
  ["Yên Bái", "Tỉnh", "15"],
  ["Hòa Bình", "Tỉnh", "25"],
  ["Thái Nguyên", "Tỉnh", "19"],
  ["Lạng Sơn", "Tỉnh", "20"],
  ["Quảng Ninh", "Tỉnh", "22"],
  ["Bắc Giang", "Tỉnh", "24"],
  ["Phú Thọ", "Tỉnh", "25"],
  ["Vĩnh Phúc", "Tỉnh", "25"],
  ["Bắc Ninh", "Tỉnh", "24"],
  ["Hải Dương", "Tỉnh", "31"],
  ["Hải Phòng", "Thành phố", "31"],
  ["Hưng Yên", "Tỉnh", "33"],
  ["Thái Bình", "Tỉnh", "33"],
  ["Hà Nam", "Tỉnh", "37"],
  ["Nam Định", "Tỉnh", "37"],
  ["Ninh Bình", "Tỉnh", "37"],
  ["Thanh Hóa", "Tỉnh", "38"],
  ["Nghệ An", "Tỉnh", "40"],
  ["Hà Tĩnh", "Tỉnh", "42"],
  ["Quảng Bình", "Tỉnh", "44"],
  ["Quảng Trị", "Tỉnh", "44"],
  ["Thừa Thiên Huế", "Tỉnh", "46"],
  ["Đà Nẵng", "Thành phố", "48"],
  ["Quảng Nam", "Tỉnh", "48"],
  ["Quảng Ngãi", "Tỉnh", "51"],
  ["Kon Tum", "Tỉnh", "51"],
  ["Bình Định", "Tỉnh", "52"],
  ["Gia Lai", "Tỉnh", "52"],
  ["Phú Yên", "Tỉnh", "66"],
  ["Khánh Hòa", "Tỉnh", "56"],
  ["Ninh Thuận", "Tỉnh", "56"],
  ["Bình Thuận", "Tỉnh", "68"],
  ["Đắk Lắk", "Tỉnh", "66"],
  ["Đắk Nông", "Tỉnh", "68"],
  ["Lâm Đồng", "Tỉnh", "68"],
  ["Bình Phước", "Tỉnh", "75"],
  ["Tây Ninh", "Tỉnh", "80"],
  ["Bình Dương", "Tỉnh", "79"],
  ["Đồng Nai", "Tỉnh", "75"],
  ["Bà Rịa - Vũng Tàu", "Tỉnh", "79"],
  ["Hồ Chí Minh", "Thành phố", "79"],
  ["Long An", "Tỉnh", "80"],
  ["Tiền Giang", "Tỉnh", "82"],
  ["Bến Tre", "Tỉnh", "86"],
  ["Trà Vinh", "Tỉnh", "86"],
  ["Vĩnh Long", "Tỉnh", "86"],
  ["Đồng Tháp", "Tỉnh", "82"],
  ["An Giang", "Tỉnh", "91"],
  ["Kiên Giang", "Tỉnh", "91"],
  ["Cần Thơ", "Thành phố", "92"],
  ["Hậu Giang", "Tỉnh", "92"],
  ["Sóc Trăng", "Tỉnh", "92"],
  ["Bạc Liêu", "Tỉnh", "96"],
  ["Cà Mau", "Tỉnh", "96"],
];

/* ── Vùng (3 miền) theo mã đơn vị mới ──────────────────────────────────── */
const REGION = {
  "01": "Bắc Bộ", "22": "Bắc Bộ", "31": "Bắc Bộ", "24": "Bắc Bộ", "04": "Bắc Bộ",
  "11": "Bắc Bộ", "33": "Bắc Bộ", "12": "Bắc Bộ", "20": "Bắc Bộ", "15": "Bắc Bộ",
  "37": "Bắc Bộ", "25": "Bắc Bộ", "14": "Bắc Bộ", "19": "Bắc Bộ", "38": "Bắc Bộ",
  "08": "Bắc Bộ",
  "46": "Trung Bộ", "48": "Trung Bộ", "66": "Trung Bộ", "52": "Trung Bộ",
  "42": "Trung Bộ", "56": "Trung Bộ", "68": "Trung Bộ", "40": "Trung Bộ",
  "51": "Trung Bộ", "44": "Trung Bộ",
  "79": "Nam Bộ", "92": "Nam Bộ", "91": "Nam Bộ", "96": "Nam Bộ",
  "75": "Nam Bộ", "82": "Nam Bộ", "80": "Nam Bộ", "86": "Nam Bộ",
};

/* ── Ghi chú riêng cho từng đơn vị (điểm cần kiểm chứng) ───────────────── */
const UNIT_NOTES = {
  "46": "Tỉnh Thừa Thiên Huế chuyển thành Thành phố Huế trực thuộc Trung ương từ 01/01/2025 (trước khi sáp nhập cấp tỉnh).",
  "75": "Theo dữ liệu crawl: từ 29/04/2026 Đồng Nai chuyển thành thành phố trực thuộc Trung ương.",
  "22": "Theo dữ liệu crawl: Quảng Ninh dự kiến thành thành phố từ 01/09/2026 — cần kiểm chứng lại.",
  "24": "Theo dữ liệu crawl: Bắc Ninh dự kiến thành thành phố từ 20/09/2026 — cần kiểm chứng lại.",
};

/* Tên viết tắt / tên cũ khác với tên chuẩn, dùng khi đối chiếu text crawl */
const ALIAS = {
  "79": ["tphcm", "tp hcm", "ho chi minh"],
  "46": ["thua thien hue", "hue"],
};

const norm = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const sqlStr = (v) => (v === null || v === undefined || v === "" ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const sqlNum = (v) => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? "null" : Number(v));

const main = async () => {
  const raw = JSON.parse(await readFile(resolve(ROOT, "vietnam-admin-merger.json"), "utf8"));
  const units = raw.units ?? [];

  /* ── 1. Kiểm tra chéo ─────────────────────────────────────────────── */
  const problems = [];
  const byCode = new Map(units.map((u) => [String(u.ma).padStart(2, "0"), u]));

  for (const [oldName, , newCode] of OLD_UNITS) {
    if (!byCode.has(newCode)) problems.push(`Thiếu đơn vị mới có mã ${newCode} (dùng cho ${oldName})`);
  }
  if (units.length !== 34) problems.push(`Số đơn vị mới = ${units.length}, kỳ vọng 34`);
  if (OLD_UNITS.length !== 63) problems.push(`Số đơn vị cũ = ${OLD_UNITS.length}, kỳ vọng 63`);

  // Đối chiếu tên cũ xuất hiện trong `predecessors` của file crawl.
  // Bỏ qua các đơn vị ghi "giữ nguyên" (không liệt kê tên chính nó).
  for (const unit of units) {
    const code = String(unit.ma).padStart(2, "0");
    const text = norm(unit.predecessors);
    if (text.includes("giu nguyen")) continue;

    const expected = OLD_UNITS.filter(([, , c]) => c === code).map(([n]) => norm(n));
    const aliases = ALIAS[code] ?? [];
    const missing = expected.filter((n) => !text.includes(n) && !aliases.some((a) => text.includes(a)));
    if (missing.length) {
      problems.push(`[${code}] predecessors không nhắc: ${missing.join(", ")}`);
    }
  }

  /* ── 2. Dựng danh sách đơn vị mới ─────────────────────────────────── */
  const mergedCount = new Map();
  for (const [, , code] of OLD_UNITS) mergedCount.set(code, (mergedCount.get(code) ?? 0) + 1);

  const provinces = units
    .map((u) => {
      const code = String(u.ma).padStart(2, "0");
      const mergedFrom = OLD_UNITS.filter(([, , c]) => c === code).map(([n]) => n);
      const isMerged = mergedFrom.length > 1;
      // Trường hợp chỉ đổi tên / lên cấp (không sáp nhập): vd Thừa Thiên Huế -> TP Huế
      const renamedFrom = !isMerged && mergedFrom[0] && norm(u.ten.replace(/^(Thành phố|Tỉnh|Thủ đô)\s+/, "")) !== norm(mergedFrom[0])
        ? mergedFrom[0]
        : null;

      return {
        code,
        name: u.ten,
        type: u.type,
        region: REGION[code] ?? "Khác",
        centrallyRun: Boolean(u.thuoc_trung_uong) || u.type === "Thủ đô",
        capital: !u.capital || u.capital === "giữ nguyên" ? null : u.capital,
        population: u.population ?? null,
        areaKm2: u.area_km2 ?? null,
        mergedFrom,
        changed: isMerged,
        renamedFrom,
        note: UNIT_NOTES[code] ?? null,
        predecessorsRaw: u.predecessors ?? null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "vi"));

  /* ── 3. Lịch sử 63 -> 34 ──────────────────────────────────────────── */
  const history = OLD_UNITS.map(([oldName, oldType, newCode]) => {
    const target = provinces.find((p) => p.code === newCode);
    const changed = Boolean(target?.changed);
    let note = "Giữ nguyên đơn vị hành chính";

    if (changed) {
      const others = (target.mergedFrom || []).filter((n) => n !== oldName);
      note = others.length
        ? `Sáp nhập cùng ${others.join(", ")}`
        : `Sáp nhập vào ${target.name}`;
    } else if (target?.renamedFrom === oldName) {
      note = `Đổi tên thành ${target.name}`;
    }

    return { oldName, oldType, newCode, newName: target?.name ?? null, changed, note };
  }).sort((a, b) => a.oldName.localeCompare(b.oldName, "vi"));

  const unchanged = history.filter((h) => !h.changed).length;

  const dataset = {
    meta: {
      title: "Đối chiếu địa giới hành chính Việt Nam sau sáp nhập 2025",
      version: "1.0",
      generated: new Date().toISOString().slice(0, 10),
      effectiveFrom: "2025-07-01",
      level: "province",
      stats: {
        before: history.length,
        after: provinces.length,
        unchanged,
        merged: history.length - unchanged,
        mergedUnits: provinces.filter((p) => p.changed).length,
      },
      sources: raw.source?.legal ?? [],
      notes: [
        "Dữ liệu cấp tỉnh/thành phố trực thuộc Trung ương. Chưa bao gồm cấp xã/phường sau sáp nhập.",
        "Bảng 63 → 34 được đối chiếu thủ công theo Nghị quyết 202/2025/QH15; phần mô tả predecessors lấy từ file crawl gốc.",
        ...Object.entries(UNIT_NOTES).map(([code, note]) => `${code}: ${note}`),
      ],
    },
    provinces: provinces.map(({ predecessorsRaw, ...p }) => ({ ...p, predecessorsRaw })),
    history,
  };

  /* ── 4. Ghi file ──────────────────────────────────────────────────── */
  await mkdir(resolve(ROOT, "assets/data"), { recursive: true });
  await writeFile(resolve(ROOT, "assets/data/admin-merger.json"), JSON.stringify(dataset, null, 2) + "\n", "utf8");

  const lines = [
    "-- Auto-generated by scripts/build-admin-data.mjs — đừng sửa tay.",
    "-- Dữ liệu: 34 đơn vị cấp tỉnh + bảng đối chiếu 63 -> 34 (hiệu lực 01/07/2025).",
    "",
    "truncate table public.admin_unit_history;",
    "truncate table public.admin_units;",
    "",
    "insert into public.admin_units (code, name, type, region, centrally_run, capital, population, area_km2, merged_from, note) values",
    provinces
      .map(
        (p) =>
          `  (${sqlStr(p.code)}, ${sqlStr(p.name)}, ${sqlStr(p.type)}, ${sqlStr(p.region)}, ${p.centrallyRun}, ` +
          `${sqlStr(p.capital)}, ${sqlNum(p.population)}, ${sqlNum(p.areaKm2)}, ${sqlStr(p.mergedFrom.join(", "))}, ${sqlStr(p.note)})`
      )
      .join(",\n") + ";",
    "",
    "insert into public.admin_unit_history (old_name, old_type, new_code, changed, note) values",
    history
      .map((h) => `  (${sqlStr(h.oldName)}, ${sqlStr(h.oldType)}, ${sqlStr(h.newCode)}, ${h.changed}, ${sqlStr(h.note)})`)
      .join(",\n") + ";",
    "",
  ];
  await writeFile(resolve(ROOT, "db/seed-admin.sql"), lines.join("\n"), "utf8");

  /* ── 5. Báo cáo ───────────────────────────────────────────────────── */
  console.log(`✔ ${provinces.length} đơn vị mới, ${history.length} đơn vị cũ, ${unchanged} giữ nguyên.`);
  if (problems.length) {
    console.log(`\n⚠ ${problems.length} điểm cần xem lại:`);
    for (const p of problems) console.log("  - " + p);
  } else {
    console.log("✔ Không phát hiện lệch giữa bảng đối chiếu và file crawl.");
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
