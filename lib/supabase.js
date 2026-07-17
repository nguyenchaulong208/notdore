/**
 * lib/supabase.js — Supabase client dùng chung cho toàn bộ API
 *
 * - Trên Vercel (serverless): ws không cần thiết vì fetch native đã có sẵn.
 * - Trên Replit (Node.js 20): ws được nạp để Supabase realtime hoạt động đúng.
 *
 * Dùng top-level await (hợp lệ trong ES module) để import ws một cách an toàn.
 * Client là singleton — khởi tạo một lần khi module được load.
 */
import { createClient } from '@supabase/supabase-js';

// Thử import ws; nếu không có (Vercel --ignore-scripts) thì bỏ qua
let wsTransport;
try {
  const { default: ws } = await import('ws');
  wsTransport = ws;
} catch {
  // ws không khả dụng — Supabase dùng transport mặc định
}

function buildClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Thiếu biến môi trường: SUPABASE_URL hoặc SUPABASE_ANON_KEY.');
  }
  const options = { global: { fetch } };
  if (wsTransport) options.realtime = { transport: wsTransport };
  return createClient(url, key, options);
}

export const supabase = buildClient();
