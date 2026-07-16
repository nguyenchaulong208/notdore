import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const TAG_MAP = {
  vat:  'thue-gtgt',
  tncn: 'thue-tncn',
  tndn: 'thue-tndn',
  bhxh: 'bhxh',
};

function createSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL hoặc SUPABASE_ANON_KEY chưa được cấu hình.');
  return createClient(url, key, {
    global: { fetch },
    realtime: { transport: ws },
  });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');

  const { cat } = req.query;
  if (!cat || !TAG_MAP[cat]) {
    return res.status(400).json({ error: 'Category không hợp lệ.' });
  }

  try {
    const supabase = createSupabaseClient();
    const tagName  = TAG_MAP[cat];

    // Bước 1: Lấy tag ID theo tên
    const { data: tag, error: tagError } = await supabase
      .from('document_tags')
      .select('id')
      .eq('name', tagName)
      .single();

    if (tagError || !tag) {
      return res.json({ docs: [], total: 0 });
    }

    // Bước 2: Lấy danh sách document_id được gán tag này
    const { data: mapping, error: mapError } = await supabase
      .from('document_tag_map')
      .select('document_id')
      .eq('tag_id', tag.id);

    if (mapError || !mapping?.length) {
      return res.json({ docs: [], total: 0 });
    }

    const ids = mapping.map(m => m.document_id);

    // Bước 3 & 4: Lấy thông tin documents + files song song
    const [docsResult, filesResult] = await Promise.all([
      supabase
        .from('documents')
        .select('id, code, title, description, created_at')
        .in('id', ids)
        .order('code', { ascending: true }),

      supabase
        .from('document_files')
        .select('document_id, drive_type, drive_view_url, drive_download_url, mime_type')
        .in('document_id', ids),
    ]);

    if (docsResult.error) throw docsResult.error;

    // Gộp file vào document (mỗi document lấy file đầu tiên)
    const fileMap = {};
    for (const f of filesResult.data || []) {
      if (!fileMap[f.document_id]) fileMap[f.document_id] = f;
    }

    const docs = (docsResult.data || []).map(d => ({
      id:            d.id,
      code:          d.code,
      title:         d.title,
      description:   d.description,
      created_at:    d.created_at,
      file:          fileMap[d.id] ?? null,
    }));

    res.json({ docs, total: docs.length });

  } catch (err) {
    console.error('[NotDore] Supabase query error:', err.message);
    res.status(500).json({ error: 'Không thể tải dữ liệu. Vui lòng thử lại sau.' });
  }
}
