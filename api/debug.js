/**
 * /api/debug — Endpoint chẩn đoán kết nối Supabase
 * Chỉ dùng để debug, xoá file này sau khi xác định được vấn đề.
 *
 * Truy cập: https://<your-vercel-domain>/api/debug?cat=vat
 */
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const TAG_MAP = {
  vat:  'thue-gtgt',
  tncn: 'thue-tncn',
  tndn: 'thue-tndn',
  bhxh: 'bhxh',
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');

  const report = { steps: [] };

  // ── Bước 0: Kiểm tra biến môi trường ────────────────────────────────────
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  report.steps.push({
    step: '0 – Env vars',
    SUPABASE_URL:      url  ? `✅ Có (${url.slice(0, 30)}...)` : '❌ THIẾU',
    SUPABASE_ANON_KEY: key  ? `✅ Có (${key.slice(0, 20)}...)` : '❌ THIẾU',
  });

  if (!url || !key) {
    return res.status(200).json({ ...report, conclusion: '❌ Thiếu env vars – dừng tại đây.' });
  }

  const supabase = createClient(url, key, {
    global: { fetch },
    realtime: { transport: ws },
  });

  // ── Bước 1: Ping đơn giản – đọc 1 dòng từ bảng documents ────────────────
  const { data: pingData, error: pingError } = await supabase
    .from('documents')
    .select('id, code, title')
    .limit(1);

  report.steps.push({
    step: '1 – Ping bảng documents (limit 1)',
    ok:    !pingError,
    data:  pingData,
    error: pingError ? { code: pingError.code, message: pingError.message } : null,
  });

  if (pingError) {
    return res.status(200).json({
      ...report,
      conclusion: '❌ Không đọc được bảng documents. Kiểm tra tên bảng và RLS.',
    });
  }

  // ── Bước 2: Kiểm tra bảng document_tags ─────────────────────────────────
  const { data: allTags, error: tagsError } = await supabase
    .from('document_tags')
    .select('id, name')
    .limit(20);

  report.steps.push({
    step: '2 – Bảng document_tags (tất cả tags)',
    ok:    !tagsError,
    data:  allTags,
    error: tagsError ? { code: tagsError.code, message: tagsError.message } : null,
  });

  // ── Bước 3: Tìm tag theo ?cat ────────────────────────────────────────────
  const cat     = req.query.cat || 'vat';
  const tagName = TAG_MAP[cat] || 'thue-gtgt';

  const { data: tag, error: tagError } = await supabase
    .from('document_tags')
    .select('id, name')
    .eq('name', tagName)
    .single();

  report.steps.push({
    step:    `3 – Tìm tag name="${tagName}" cho cat="${cat}"`,
    ok:      !tagError && !!tag,
    data:    tag,
    error:   tagError ? { code: tagError.code, message: tagError.message } : null,
    hint:    !tag ? `Không tìm thấy tag "${tagName}". Các tag hiện có ở bước 2.` : null,
  });

  if (tagError || !tag) {
    return res.status(200).json({
      ...report,
      conclusion: `❌ Không tìm được tag "${tagName}" trong bảng document_tags. Xem bước 2 để biết các tag thực tế.`,
    });
  }

  // ── Bước 4: Lấy mapping ──────────────────────────────────────────────────
  const { data: mapping, error: mapError } = await supabase
    .from('document_tag_map')
    .select('document_id')
    .eq('tag_id', tag.id);

  report.steps.push({
    step:  `4 – Bảng document_tag_map với tag_id=${tag.id}`,
    ok:    !mapError,
    count: mapping?.length ?? 0,
    data:  mapping?.slice(0, 5),
    error: mapError ? { code: mapError.code, message: mapError.message } : null,
  });

  if (mapError || !mapping?.length) {
    return res.status(200).json({
      ...report,
      conclusion: `❌ Bảng document_tag_map không có dòng nào với tag_id=${tag.id}. Kiểm tra tên bảng hoặc tên cột.`,
    });
  }

  // ── Bước 5: Lấy documents (chỉ cột cơ bản) ──────────────────────────────
  const ids = mapping.map(m => m.document_id);

  const { data: docs, error: docsError } = await supabase
    .from('documents')
    .select('id, code, title')
    .in('id', ids)
    .order('code', { ascending: true });

  report.steps.push({
    step:  `5 – Lấy documents (${ids.length} IDs)`,
    ok:    !docsError,
    count: docs?.length ?? 0,
    data:  docs?.slice(0, 3),
    error: docsError ? { code: docsError.code, message: docsError.message } : null,
  });

  // ── Kết luận ─────────────────────────────────────────────────────────────
  const ok = !docsError && docs?.length > 0;
  report.conclusion = ok
    ? `✅ Toàn bộ pipeline hoạt động. Tìm được ${docs.length} văn bản cho cat="${cat}".`
    : docsError
      ? '❌ Lỗi khi lấy documents. Xem chi tiết ở bước 5.'
      : `⚠️ Pipeline đúng nhưng không có văn bản nào trả về cho cat="${cat}".`;

  return res.status(200).json(report);
}
