/**
 * server.js — Express server cho NotDore chạy trên Replit
 *
 * - Phục vụ static files (HTML, CSS, JS, ảnh)
 * - Mount API handlers từ /api/
 *
 * Trên Vercel: file này không được dùng — Vercel tự gọi các
 * handler trong /api/ trực tiếp theo quy ước serverless function.
 */
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import categoryHandler from './api/category.js';
import { listDocs, updateDoc } from './api/admin/docs.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 5000;

const app = express();
app.use(express.json());

// ── Middleware: chỉ cho phép admin từ localhost ────────────────────────────────
function localOnly(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || '';
  const isLocal =
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === '::ffff:127.0.0.1' ||
    ip.startsWith('10.') ||
    ip.startsWith('172.') ||
    ip.startsWith('192.168.');
  if (!isLocal) {
    return res.status(403).send('Admin chỉ khả dụng khi chạy local.');
  }
  next();
}

// ── API routes ────────────────────────────────────────────────────────────────
app.get('/api/category', categoryHandler);

// ── Admin (local only) ────────────────────────────────────────────────────────
app.get('/admin', localOnly, (_req, res) => {
  res.sendFile(join(__dirname, 'admin.html'));
});
app.get('/api/admin/docs',        localOnly, listDocs);
app.patch('/api/admin/docs/:id',  localOnly, updateDoc);

// ── Static files ──────────────────────────────────────────────────────────────
app.use(express.static(__dirname, {
  index: 'index.html',
  extensions: ['html'],
  setHeaders(res, filePath) {
    // Không cache HTML để trình duyệt luôn lấy bản mới nhất
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
}));

// ── Fallback ──────────────────────────────────────────────────────────────────
app.get('*', (_req, res) => res.sendFile('index.html', { root: __dirname }));

// ── Khởi động ─────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  const env = (key) => process.env[key] ? '✅ Đã cấu hình' : '❌ Chưa cấu hình';
  console.log(`✅ NotDore đang chạy tại http://0.0.0.0:${PORT}`);
  console.log(`   SUPABASE_URL:      ${env('SUPABASE_URL')}`);
  console.log(`   SUPABASE_ANON_KEY: ${env('SUPABASE_ANON_KEY')}`);
  console.log(`   Admin UI:          http://localhost:${PORT}/admin`);
});
