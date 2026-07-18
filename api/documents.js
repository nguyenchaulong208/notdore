/**
 * api/documents.js — Trả về toàn bộ danh sách văn bản (không lọc theo danh mục)
 *
 * Dùng cho trang chủ (index.html): sidebar "Văn bản mới nhất" + grid "VĂN BẢN".
 *
 * Response:
 *   { docs: Doc[], total: number }
 *
 * Mỗi Doc: { id, code, title, description, issued_date, expiry_date, status, created_at, file }
 * file:    { drive_view_url, drive_download_url, mime_type } | null
 */
import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');

  try {
    // Lấy toàn bộ documents + files song song
    const [docsResult, filesResult] = await Promise.all([
      supabase
        .from('documents')
        .select('id, code, title, description, issued_date, expiry_date, status, created_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('document_files')
        .select('document_id, drive_view_url, drive_download_url, mime_type'),
    ]);

    if (docsResult.error) throw docsResult.error;
    if (filesResult.error) throw filesResult.error;

    // Gộp file vào document theo document_id (mỗi doc lấy file đầu tiên)
    const fileByDocId = Object.fromEntries(
      (filesResult.data || []).map(f => [f.document_id, f])
    );

    const docs = (docsResult.data || []).map(d => ({
      id:          d.id,
      code:        d.code,
      title:       d.title,
      description: d.description,
      issued_date: d.issued_date,
      expiry_date: d.expiry_date,
      status:      d.status,
      created_at:  d.created_at,
      file:        fileByDocId[d.id] ?? null,
    }));

    res.json({ docs, total: docs.length });

  } catch (err) {
    console.error('[documents] Supabase error:', err.message);
    res.status(500).json({ error: 'Không thể tải dữ liệu. Vui lòng thử lại sau.' });
  }
}