// assets/js/van-ban-articles.js — Render block "Bài viết pháp luật" (van-ban.html)
// Tách riêng khỏi index.js: file này CHỈ lo phần bài viết (fetch /api/articles,
// lọc theo danh mục, dựng card). Phụ thuộc: utils.js (esc, formatDate, isHttp).
// Sẽ được chỉnh sửa nhiều → giữ các hàm nhỏ, rõ ràng, tên có tiền tố `article`.

const ARTICLES_API = '/api/articles';

const articlesState = { categories: [], articles: [], activeCategoryId: null };

const byId = (id) => document.getElementById(id);

// ── Helpers ──────────────────────────────────────────────────────────────────

const articleHref = (a) => `article-detail.html?slug=${encodeURIComponent(a.slug || a.id)}`;

const articleCategoryName = (categoryId) =>
  articlesState.categories.find(c => c.category_id === categoryId)?.category_name || '';

// ── Render ───────────────────────────────────────────────────────────────────

function renderArticleCard(a) {
  const cat = articleCategoryName(a.category_id);
  const thumb = a.thumbnail_url
    ? `<a class="article-card__thumb" href="${articleHref(a)}"><img src="${esc(a.thumbnail_url)}" alt="${esc(a.title)}" loading="lazy"></a>`
    : '';
  const source = isHttp(a.original_url)
    ? `<a class="article-card__source" href="${esc(a.original_url)}" target="_blank" rel="noopener noreferrer">
         <i class="fas fa-up-right-from-square me-1"></i>${esc(a.original_source || 'Bài gốc')}
       </a>`
    : '';
  return `
    <article class="article-card">
      ${thumb}
      <div class="article-card__body">
        ${cat ? `<span class="article-card__cat">${esc(cat)}</span>` : ''}
        <h3 class="article-card__title"><a href="${articleHref(a)}">${esc(a.title)}</a></h3>
        ${a.summary ? `<p class="article-card__summary">${esc(a.summary)}</p>` : ''}
        <div class="article-card__meta">
          ${a.published_at ? `<span class="article-card__date"><i class="far fa-calendar me-1"></i>${esc(formatDate(a.published_at))}</span>` : ''}
          ${source}
        </div>
      </div>
    </article>`;
}

function renderArticleFilters() {
  const bar = byId('articles-filter');
  if (!bar) return;
  if (articlesState.categories.length <= 1) {
    bar.innerHTML = '';
    bar.style.display = 'none';
    return;
  }
  const items = [{ id: null, name: 'Tất cả' }, ...articlesState.categories];
  bar.innerHTML = items.map(c => `
    <button type="button" class="article-pill${articlesState.activeCategoryId === c.category_id ? ' is-active' : ''}"
      data-category-id="${c.category_id ?? ''}">${esc(c.name || c.category_name)}</button>`).join('');
  bar.style.display = 'flex';
}

function renderArticleGrid() {
  const grid = byId('articles-grid');
  if (!grid) return;

  const list = articlesState.activeCategoryId === null
    ? articlesState.articles
    : articlesState.articles.filter(a => a.category_id === articlesState.activeCategoryId);

  grid.innerHTML = list.length
    ? list.map(renderArticleCard).join('')
    : '<p class="article-state">Chưa có bài viết trong danh mục này.</p>';
}

function renderArticleState(html) {
  const grid = byId('articles-grid');
  if (grid) grid.innerHTML = html;
}

// ── Khởi chạy ────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  if (!byId('articles-content')) return;

  try {
    const res  = await fetch(ARTICLES_API);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lỗi không xác định từ máy chủ.');

    articlesState.categories = data.categories || [];
    articlesState.articles   = data.articles   || [];

    if (!articlesState.articles.length) {
      renderArticleState('<p class="article-state">Chưa có bài viết nào. Quay lại sau nhé!</p>');
      return;
    }

    renderArticleFilters();
    renderArticleGrid();

    byId('articles-filter')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-category-id]');
      if (!btn) return;
      articlesState.activeCategoryId = btn.dataset.categoryId === '' ? null : Number(btn.dataset.categoryId);
      renderArticleFilters();
      renderArticleGrid();
    });
  } catch (err) {
    console.error('[articles] Fetch error:', err);
    renderArticleState(
      '<div class="alert alert-danger mb-0" role="alert"><i class="fas fa-exclamation-triangle me-2"></i>Không thể tải danh sách bài viết. Vui lòng thử lại sau.</div>'
    );
  }
});
