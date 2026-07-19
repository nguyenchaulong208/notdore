import { supabase } from '../lib/supabase.js';

/**
 * GET /api/tools
 * Trả về catalog công cụ, danh mục, tag và các liên kết đang hoạt động.
 * Tất cả join được thực hiện trong code để không phụ thuộc vào tên foreign-key
 * relationship do Supabase tự sinh.
 */
export default async function handler(_req, res) {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');

  try {
    const [categoriesResult, toolsResult, linksResult, sourcesResult, tagsResult, tagMapResult] = await Promise.all([
      supabase.from('categories').select('category_id, category_name, description').order('category_id'),
      supabase.from('tools').select('tool_id, tool_name, category_id, description, created_at, updated_at').order('created_at', { ascending: false }),
      supabase.from('tool_links').select('link_id, tool_id, source_id, embed_url, display_name, is_active, created_at').eq('is_active', true).order('created_at'),
      supabase.from('external_sources').select('source_id, source_name, source_type, base_url, icon_url'),
      supabase.from('tags').select('tag_id, tag_name').order('tag_name'),
      supabase.from('tool_tags').select('tool_id, tag_id'),
    ]);

    for (const result of [categoriesResult, toolsResult, linksResult, sourcesResult, tagsResult, tagMapResult]) {
      if (result.error) throw result.error;
    }

    const sourceById = Object.fromEntries((sourcesResult.data || []).map(source => [source.source_id, source]));
    const tagById = Object.fromEntries((tagsResult.data || []).map(tag => [tag.tag_id, tag]));
    const linksByToolId = new Map();
    const tagsByToolId = new Map();

    for (const link of linksResult.data || []) {
      if (!sourceById[link.source_id]) continue;
      const links = linksByToolId.get(link.tool_id) || [];
      links.push({
        id: link.link_id,
        url: link.embed_url,
        display_name: link.display_name,
        source: sourceById[link.source_id],
      });
      linksByToolId.set(link.tool_id, links);
    }

    for (const map of tagMapResult.data || []) {
      if (!tagById[map.tag_id]) continue;
      const tags = tagsByToolId.get(map.tool_id) || [];
      tags.push(tagById[map.tag_id]);
      tagsByToolId.set(map.tool_id, tags);
    }

    const tools = (toolsResult.data || []).map(tool => ({
      id: tool.tool_id,
      name: tool.tool_name,
      category_id: tool.category_id,
      description: tool.description,
      created_at: tool.created_at,
      updated_at: tool.updated_at,
      links: linksByToolId.get(tool.tool_id) || [],
      tags: tagsByToolId.get(tool.tool_id) || [],
    }));

    res.json({
      categories: categoriesResult.data || [],
      tools,
      total: tools.length,
    });
  } catch (error) {
    console.error('[tools] Supabase error:', error.message);
    res.status(500).json({ error: 'Không thể tải danh sách công cụ. Vui lòng thử lại sau.' });
  }
}
