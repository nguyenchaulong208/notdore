/**
 * split-geo-seed.mjs
 * Cắt db/seed-geo.sql thành 3 phần để chạy được trong Supabase SQL Editor:
 *   db/seed-geo-1-core.sql         dataset, cấp/loại, văn bản, 34 tỉnh
 *   db/seed-geo-2-communes-all.sql 3.321 xã/phường/đặc khu (psql/CLI; SQL Editor dùng thư mục con)
 *   db/seed-geo-3-relations.sql    chỉ số, sự kiện, liên kết, nguồn
 *
 * Chạy: npm run split:geo
 * Thứ tự chạy: 1 -> 2 (hoặc các file db/seed-geo-2-communes/) -> 3, sau db/schema-geo.sql.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = resolve(ROOT, "db/seed-geo.sql");
const OUT_DIR = resolve(ROOT, "db");

const HEADER = {
  core: `-- =============================================================================
-- NotDore - seed geo_* phần 1/3: dataset, cấp/loại, văn bản, 34 tỉnh/thành.
-- Chạy SAU db/schema-geo.sql. Tiếp theo: db/seed-geo-2-communes/ hoặc
-- db/seed-geo-2-communes-all.sql (psql/CLI).
-- =============================================================================
`,
  communes: `-- =============================================================================
-- NotDore - seed geo_* phần 2/3: 3.321 xã / phường / đặc khu.
-- File này cho psql/CLI. SQL Editor hãy chạy các file nhỏ trong
-- db/seed-geo-2-communes/ sau db/seed-geo-1-core.sql.
-- =============================================================================
`,
  relations: `-- =============================================================================
-- NotDore - seed geo_* phần 3/3: chỉ số, sự kiện, liên kết, nguồn.
-- Chạy SAU các file cấp xã.
-- =============================================================================
`,
};

const main = async () => {
  const sql = await readFile(SOURCE, "utf8");

  const positions = [];
  let index = -1;
  while ((index = sql.indexOf("insert into public.geo_units", index + 1)) !== -1) {
    positions.push(index);
  }
  if (positions.length < 2) {
    throw new Error("db/seed-geo.sql không có đủ 2 lệnh insert geo_units (tỉnh + xã).");
  }

  const communeStart = positions[1];
  const relationsStart = sql.indexOf("insert into public.geo_unit_metrics");
  if (relationsStart < 0) {
    throw new Error("db/seed-geo.sql không tìm thấy insert geo_unit_metrics.");
  }

  const core = sql.slice(0, communeStart);
  const communes = sql.slice(communeStart, relationsStart);
  const relations = sql.slice(relationsStart);

  const coreSql = `${HEADER.core}${core.trim()}\ncommit;\n`;
  const communesSql = `${HEADER.communes}begin;\n${communes.trim()}\ncommit;\n`;
  const relationsSql = `${HEADER.relations}begin;\n${relations.trim()}\n`;

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(resolve(OUT_DIR, "seed-geo-1-core.sql"), coreSql, "utf8");
  await writeFile(resolve(OUT_DIR, "seed-geo-2-communes-all.sql"), communesSql, "utf8");
  await writeFile(resolve(OUT_DIR, "seed-geo-3-relations.sql"), relationsSql, "utf8");

  console.log(`Đã cắt ${SOURCE}`);
  console.log(`- seed-geo-1-core.sql            ${coreSql.length} bytes`);
  console.log(`- seed-geo-2-communes-all.sql    ${communesSql.length} bytes (psql/CLI)`);
  console.log(`- seed-geo-3-relations.sql       ${relationsSql.length} bytes`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
