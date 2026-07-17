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
import { dirname } from 'path';
import categoryHandler from './api/category.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 5000;

const app = express();
app.use(express.json());

// ── API routes ────────────────────────────────────────────────────────────────
app.get('/api/category', categoryHandler);

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
});
