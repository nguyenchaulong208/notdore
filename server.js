/**
 * server.js — Express server cho NotDore chạy trên Replit
 * Phục vụ static HTML + mount các API handlers từ /api/
 */
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app  = express();
const PORT = process.env.PORT || 5000;

// ── Middleware cơ bản ────────────────────────────────────────
app.use(express.json());

// ── API routes ───────────────────────────────────────────────
// Adapter: chuyển Express req/res sang định dạng Vercel handler
async function mountApiHandler(handlerPath, req, res) {
  try {
    const mod     = await import(handlerPath + '?t=' + Date.now());
    const handler = mod.default;
    await handler(req, res);
  } catch (err) {
    console.error('API error:', err);
    res.status(500).json({ error: err.message });
  }
}

app.get('/api/category', (req, res) =>
  mountApiHandler(new URL('./api/category.js', import.meta.url).pathname, req, res)
);

app.get('/api/debug', (req, res) =>
  mountApiHandler(new URL('./api/debug.js', import.meta.url).pathname, req, res)
);

// ── Static files (HTML, CSS, JS, images) ────────────────────
app.use(express.static(__dirname, {
  index: 'index.html',
  extensions: ['html'],
  setHeaders(res, path) {
    // Không cache HTML để luôn nhận bản mới nhất
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// ── Fallback: trả về index.html cho các route không khớp ────
app.get('*', (req, res) => {
  res.sendFile('index.html', { root: __dirname });
});

// ── Khởi động ────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ NotDore đang chạy tại http://0.0.0.0:${PORT}`);
  console.log(`   SUPABASE_URL:      ${process.env.SUPABASE_URL      ? '✅ Đã cấu hình' : '❌ Chưa cấu hình'}`);
  console.log(`   SUPABASE_ANON_KEY: ${process.env.SUPABASE_ANON_KEY ? '✅ Đã cấu hình' : '❌ Chưa cấu hình'}`);
});
