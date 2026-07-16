import { createClient } from '@supabase/supabase-js';

const TAG_MAP = {
  vat: 'thue-gtgt',
  tncn: 'thue-tncn',
  tndn: 'thue-tndn',
  bhxh: 'bhxh',
};

function createSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase env vars missing');
  return createClient(url, key);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-cache');
  
  const { cat } = req.query;
  if (!cat || !TAG_MAP[cat]) {
    return res.status(400).json({ error: 'Invalid category' });
  }

  try {
    const supabase = createSupabaseClient();
    const tagName = TAG_MAP[cat];

    const { data: tag, error: tagError } = await supabase
      .from('document_tags')
      .select('id')
      .eq('name', tagName)
      .single();

    if (tagError || !tag) {
      return res.json({ docs: [], tag: null });
    }

    const { data: mapping, error: mapError } = await supabase
      .from('document_tag_map')
      .select('document_id')
      .eq('tag_id', tag.id);

    if (mapError || !mapping?.length) {
      return res.json({ docs: [], tag: tag.id });
    }

    const ids = mapping.map(m => m.document_id);

    const { data: docs, error: docsError } = await supabase
      .from('documents')
      .select('id, code, title')
      .in('id', ids);

    if (docsError) throw docsError;

    res.json({ docs: docs || [], tag: tag.id });
  } catch (err) {
    console.error('Supabase query error:', err);
    res.status(500).json({ error: 'Database query failed' });
  }
}