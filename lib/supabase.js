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

// Client supabase — không dùng ws (Vercel đã có fetch natives)
// Chuẩn bị để mở rộng realtime khi cần
function buildClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Thiếu biến môi trường: SUPABASE_URL hoặc SUPABASE_ANON_KEY.');
  }
  const options = { global: { fetch } };
  // Không dùng ws để tránh lỗi compatibility với Vercel
  // Khách dùng có thể bật realtime ở client-side nếu cần
  return createClient(url, key, options);
}

export const supabase = buildClient();
