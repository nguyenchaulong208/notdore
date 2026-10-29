/**
 * config.js — cấu hình công khai của site.
 *
 * Có 2 cách cấu hình Supabase:
 *   1. Dán trực tiếp supabaseUrl + supabaseAnonKey bên dưới.
 *   2. Để trống và khai báo biến môi trường trên Vercel; /api/config sẽ trả về.
 *
 * Anon/publishable key là khóa công khai (chỉ đọc theo RLS) — KHÔNG dùng service_role.
 * Nếu cả hai trống => site sẽ không tải được dữ liệu (cần cấu hình Supabase).
 */
window.NOTDORE_CONFIG = {
  supabaseUrl: "",
  supabaseAnonKey: "",

  // Hiển thị ở phần liên hệ
  email: "nguyenchaulong.data208@gmail.com",
  siteName: "NotDore",
};

/**
 * Nạp cấu hình từ /api/config (Vercel Environment Variables).
 * db.js chờ promise này trước khi quyết định dùng Supabase.
 */
window.NOTDORE_CONFIG_READY = (async () => {
  const cfg = window.NOTDORE_CONFIG;
  if (cfg.supabaseUrl && cfg.supabaseAnonKey) return cfg;

  try {
    const res = await fetch('/api/config', {
      cache: 'no-store',
      headers: { accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.supabaseUrl) cfg.supabaseUrl = data.supabaseUrl;
    if (data.supabaseAnonKey) cfg.supabaseAnonKey = data.supabaseAnonKey;
    if (data.configured === false) {
      console.info('[config] /api/config chưa có cấu hình:', (data.missing || []).join(', '));
    }
  } catch (err) {
    // Local static server / file:// không có /api/config — dùng JSON tĩnh.
    console.info('[config] Không đọc được /api/config, dùng JSON tĩnh:', err.message || err);
  }
  return cfg;
})();
