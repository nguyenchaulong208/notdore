/**
 * Vercel Serverless Function: /api/config
 *
 * Trả Project URL + anon/publishable key cho browser.
 * Tuyệt đối không trả service_role key.
 *
 * Hỗ trợ nhiều tên biến môi trường để dùng được với các preset khác nhau.
 * Danh sách này được giữ đồng bộ với scripts/dev-server.mjs.
 */
const URL_KEYS = [
  'SUPABASE_URL',
  'SUPABASE_PROJECT_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'VITE_SUPABASE_URL',
  'PUBLIC_SUPABASE_URL',
  'NUXT_PUBLIC_SUPABASE_URL',
  'REACT_APP_SUPABASE_URL',
];

const ANON_KEYS = [
  'SUPABASE_ANON_KEY',
  'SUPABASE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'PUBLIC_SUPABASE_ANON_KEY',
  'NUXT_PUBLIC_SUPABASE_ANON_KEY',
  'REACT_APP_SUPABASE_ANON_KEY',
];

const firstEnv = (keys) => {
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.trim()) return value.trim();
  }
  return '';
};

/** Chặn trường hợp dán nhầm service_role JWT vào biến anon. */
const isServiceRoleJwt = (key) => {
  const parts = String(key || '').split('.');
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return payload.role === 'service_role';
  } catch {
    return false;
  }
};

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const supabaseUrl = firstEnv(URL_KEYS).replace(/\/+$/, '');
  const supabaseAnonKey = firstEnv(ANON_KEYS);
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (!supabaseUrl || !supabaseAnonKey) {
    // Không cấu hình cũng không phải lỗi: frontend sẽ dùng JSON tĩnh.
    const missing = [];
    if (!supabaseUrl) missing.push('SUPABASE_URL');
    if (!supabaseAnonKey) missing.push('SUPABASE_ANON_KEY');
    console.warn('[api/config] Thiếu biến môi trường:', missing.join(', '));
    res.status(200).json({ configured: false, missing });
    return;
  }

  if ((serviceRoleKey && supabaseAnonKey === serviceRoleKey) || isServiceRoleJwt(supabaseAnonKey)) {
    res.status(500).json({
      error: 'Biến anon đang chứa service_role key. Hãy dùng anon/publishable key.',
    });
    return;
  }

  res.status(200).json({
    configured: true,
    supabaseUrl,
    supabaseAnonKey,
  });
}
