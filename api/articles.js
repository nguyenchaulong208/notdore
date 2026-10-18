/**
 * api/articles.js — Bài viết pháp luật (bài sưu tầm + văn bản luật)
 *
 * GET /api/articles              → { categories, articles, total }
 * GET /api/articles?slug=<slug>  → { article, category, related }
 * GET /api/articles?id=<id>      → { article, category, related }
 *
 * Mô hình dữ liệu giống `tools`:
 *   article_categories (category_id, category_name, description)
 *   articles           (article_id, title, slug, category_id, summary, thumbnail_url,
 *                       content, content_url, original_url, original_source,
 *                       published_at, is_published, created_at, updated_at)
 *
 * `original_url` là link truy cập bài viết gốc (nguồn sưu tầm).
 * `content` là nội dung markdown/HTML nhập tay; `content_url` trỏ tới markdown raw
 * (dùng khi `content` trống). Các join được thực hiện trong code để không phụ thuộc
 * vào tên foreign-key relationship do Supabase tự sinh.
 */
import { supabase } from '../lib/supabase.js';

const LIST_COLUMNS =
  'article_id, title, slug, category_id, summary, thumbnail_url, content_url, ' +
  'original_url, original_source, published_at, created_at, updated_at';

const toArticle = (row) => ({
  id:              row.article_id,
  title:           row.title,
  slug:            row.slug,
  category_id:     row.category_id,
  summary:         row.summary,
  thumbnail_url:   row.thumbnail_url,
  content:         row.content ?? null,
  content_url:     row.content_url,
  original_url:    row.original_url,
  original_source: row.original_source,
  published_at:    row.published_at,
  created_at:      row.created_at,
  updated_at:      row.updated_at,
});

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');

  const { slug, id } = req.query || {};

  try {
    // ── Chi tiết 1 bài viết ────────────────────────────────────────────────────
    if (slug || id) {
      let query = supabase.from('articles').select(`*, article_categories(category_id, category_name, description)`);
      query = slug ? query.eq('slug', slug) : query.eq('article_id', id);

      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ error: 'Không tìm thấy bài viết này.' });

      const article  = toArticle(data);
      const category = data.article_categories || null;

      const { data: relRows, error: relError } = await supabase
        .from('articles')
        .select('article_id, title, slug, category_id, summary, thumbnail_url, published_at')
        .eq('is_published', true)
        .eq('category_id', article.category_id)
        .neq('article_id', article.id)
        .order('published_at', { ascending: false, nullsFirst: false })
        .limit(6);
      if (relError) throw relError;

      const related = (relRows || []).map(toArticle);
      return res.json({ article, category, related });
    }

    // ── Danh sách bài viết ─────────────────────────────────────────────────────
    const [categoriesResult, articlesResult] = await Promise.all([
      supabase.from('article_categories').select('category_id, category_name, description').order('category_id'),
      supabase
        .from('articles')
        .select(LIST_COLUMNS)
        .eq('is_published', true)
        .order('published_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false }),
    ]);

    if (categoriesResult.error) throw categoriesResult.error;
    if (articlesResult.error) throw articlesResult.error;

    const articles = (articlesResult.data || []).map(toArticle);
    res.json({
      categories: categoriesResult.data || [],
      articles,
      total: articles.length,
    });
  } catch (error) {
    console.error('[articles] Supabase error:', error.message);
    res.status(500).json({ error: 'Không thể tải dữ liệu bài viết. Vui lòng thử lại sau.' });
  }
}
