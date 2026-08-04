/**
 * lib/supabase.js — Supabase client singleton (lazy init)
 *
 * - Trên Vercel (serverless): ws không cần thiết, fetch native đã có sẵn.
 * - Trên Replit (Node.js): ws được nạp để Supabase realtime hoạt động đúng.
 *
 * Client được khởi tạo khi gọi `getSupabase()` lần đầu — server vẫn boot được
 * khi chưa có credentials, API endpoint sẽ trả 500 có message rõ ràng.
 */
import { createClient } from '@supabase/supabase-js';

let wsTransport;
try {
  const { default: ws } = await import('ws');
  wsTransport = ws;
} catch { /* ws không khả dụng — dùng transport mặc định */ }

let _client = null;

export function getSupabase() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Thiếu biến môi trường: SUPABASE_URL hoặc SUPABASE_ANON_KEY.');
  const options = { global: { fetch } };
  if (wsTransport) options.realtime = { transport: wsTransport };
  _client = createClient(url, key, options);
  return _client;
}
