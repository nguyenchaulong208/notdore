import { createClient } from '@supabase/supabase-js';

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
  return createClient(url, key);
}

export default async function handler(req, res) {
  // Cache 5 phút ở CDN (Vercel Edge), stale-while-revalidate 60 phút
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');

  const { cat } = req.query;
  if (!cat || !TAG_MAP[cat]) {
    return res.status(400).json({ error: 'Category không hợp lệ.' });
  }

  try {
    const supabase = createSupabaseClient();
    const tagName  = TAG_MAP[cat];

    // Bước 1: Lấy tag ID
    const { data: tag, error: tagError } = await supabase
      .from('document_tags')
      .select('id')
      .eq('name', tagName)
      .single();

    if (tagError || !tag) {
      return res.json({ docs: [], total: 0 });
    }

    // Bước 2: Lấy document IDs qua bảng mapping
    const { data: mapping, error: mapError } = await supabase
      .from('document_tag_map')
      .select('document_id')
      .eq('tag_id', tag.id);

    if (mapError || !mapping?.length) {
      return res.json({ docs: [], total: 0 });
    }

    const ids = mapping.map(m => m.document_id);

    // Bước 3: Lấy thông tin văn bản, sắp xếp theo mã văn bản
    const { data: docs, error: docsError } = await supabase
      .from('documents')
      .select('id, code, title')
      .in('id', ids)
      .order('code', { ascending: true });

    if (docsError) throw docsError;

    res.json({ docs: docs || [], total: (docs || []).length });
  } catch (err) {
    console.error('[NotDore] Supabase query error:', err.message);
    res.status(500).json({ error: 'Không thể tải dữ liệu. Vui lòng thử lại sau.' });
  }
}
