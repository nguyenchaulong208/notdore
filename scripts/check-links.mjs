/**
 * check-links.mjs — kiểm tra nhanh link nội bộ và asset bị thiếu.
 * Chạy: node scripts/check-links.mjs
 */
import { readdir, readFile, access } from "node:fs/promises";
import { dirname, resolve, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Trang cũ đã bị thay thế bởi kiến trúc mới (gọi /api/tools không còn tồn tại).
// Giữ file để tham chiếu nội dung nhưng không tính vào kiểm tra.
const IGNORE = new Set(["tool-detail.html"]);

const walk = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    if (e.name === "node_modules" || e.name === ".git" || e.name === "assets") continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) files.push(...await walk(full));
    else if (e.name.endsWith(".html")) files.push(full);
  }
  return files;
};

const exists = async (p) => {
  try { await access(p); return true; } catch { return false; }
};

const pages = await walk(ROOT);
let problems = 0;
let checked = 0;

for (const page of pages) {
  const rel = relative(ROOT, page).replace(/\\/g, "/");
  if (IGNORE.has(rel)) {
    console.log(`… bỏ qua ${rel} (trang cũ)`);
    continue;
  }
  const html = await readFile(page, "utf8");
  const refs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]);

  for (const ref of refs) {
    if (/^(https?:|mailto:|tel:|#|data:)/.test(ref)) continue;
    const clean = ref.split("#")[0].split("?")[0];
    if (!clean) continue;
    checked++;
    const target = resolve(dirname(page), clean);
    if (!await exists(target)) {
      problems++;
      console.log(`✗ ${relative(ROOT, page)} → ${ref}`);
    }
  }
}

console.log(`\nĐã kiểm tra ${checked} tham chiếu trong ${pages.length} trang, ${problems} lỗi.`);
process.exit(problems ? 1 : 0);
