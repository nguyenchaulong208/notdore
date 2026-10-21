/**
 * dev-server.mjs — server tĩnh tối giản, không phụ thuộc package ngoài.
 * Chạy: npm run dev   (mặc định http://localhost:5173)
 *
 * Chỉ dùng để phát triển local; production deploy tĩnh trên Vercel.
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const PORT = Number(process.env.PORT) || 5173;

// Giữ đồng bộ với api/config.js.
const SUPABASE_URL_KEYS = [
  "SUPABASE_URL",
  "SUPABASE_PROJECT_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "VITE_SUPABASE_URL",
  "PUBLIC_SUPABASE_URL",
  "NUXT_PUBLIC_SUPABASE_URL",
  "REACT_APP_SUPABASE_URL",
];

const SUPABASE_ANON_KEYS = [
  "SUPABASE_ANON_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "VITE_SUPABASE_ANON_KEY",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "PUBLIC_SUPABASE_ANON_KEY",
  "NUXT_PUBLIC_SUPABASE_ANON_KEY",
  "REACT_APP_SUPABASE_ANON_KEY",
];

const firstEnv = (keys) => {
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.trim()) return value.trim();
  }
  return "";
};

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith("/")) pathname += "index.html";

    // Giả lập /api/config của Vercel để test Supabase ở local.
    if (pathname === "/api/config") {
      const supabaseUrl = firstEnv(SUPABASE_URL_KEYS).replace(/\/+$/, "");
      const supabaseAnonKey = firstEnv(SUPABASE_ANON_KEYS);
      const configured = Boolean(supabaseUrl && supabaseAnonKey);
      const missing = [];
      if (!supabaseUrl) missing.push("SUPABASE_URL");
      if (!supabaseAnonKey) missing.push("SUPABASE_ANON_KEY");
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(configured
        ? { configured, supabaseUrl, supabaseAnonKey }
        : { configured: false, missing }));
      return;
    }

    const filePath = normalize(join(ROOT, pathname));
    if (!filePath.startsWith(ROOT + sep) && filePath !== ROOT) {
      res.writeHead(403).end("Forbidden");
      return;
    }

    let target = filePath;
    try {
      const info = await stat(target);
      if (info.isDirectory()) target = join(target, "index.html");
    } catch {
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      res.end("<h1>404</h1><p>Không tìm thấy trang.</p>");
      return;
    }

    const body = await readFile(target);
    res.writeHead(200, {
      "Content-Type": MIME[extname(target).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(body);
  } catch (err) {
    console.error(err);
    res.writeHead(500).end("Internal Server Error");
  }
});

server.listen(PORT, () => {
  console.log(`▸ NotDore dev server: http://localhost:${PORT}`);
});
