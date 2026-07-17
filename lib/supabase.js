/**
 * lib/supabase.js — Supabase client dùng chung cho toàn bộ API
 *
 * Client được khởi tạo một lần (singleton) khi module được load lần đầu.
 * Sử dụng ws transport để tương thích với Node.js 20+.
 */
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

function buildClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Thiếu biến môi trường: SUPABASE_URL hoặc SUPABASE_ANON_KEY.');
  }
  return createClient(url, key, {
    global:   { fetch },
    realtime: { transport: ws },
  });
}

// Singleton — khởi tạo khi module được import lần đầu
export const supabase = buildClient();
