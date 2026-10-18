// assets/js/article-detail.js — Logic trang chi tiết bài viết (article-detail.html)
// Phụ thuộc: utils.js (esc, isHttp, formatDate), marked + DOMPurify (CDN).

const ARTICLES_API = '/api/articles';
const $ = (id) => document.getElementById(id);

const articleHref = (a) => `article-detail.html?slug=${encodeURIComponent(a.slug || a.id)}`;

// ── Nội dung markdown ──────────────────────────────────────────────────────────

// Phân tích URL raw.githubusercontent.com để resolve ảnh/link tương đối.
function parseGithubRawUrl(url) {
  const m = String(url || '').match(/^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/(?:refs\/heads\/)?([^/]+)\/(.+)$/);
  if (!m) return null;
  const [, owner, repo, branch, path] = m;
  return { owner, repo, branch, path, base: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}` };
}

function resolveRelativeAsset(value, sourceUrl) {
  if (!value || /^([a-z]+:)?\/\//i.test(value) || value.startsWith('#') || value.startsWith('data:')) return value;
  const p = parseGithubRawUrl(sourceUrl);
  if (!p) return value;
  if (value.startsWith('/')) return `${p.base}${value}`;
  const dir = p.path.includes('/') ? p.path.slice(0, p.path.lastIndexOf('/')) : '';
  return new URL(value, dir ? `${p.base}/${dir}/` : `${p.base}/`).href;
}

function markdownToHtml(md, sourceUrl) {
  if (typeof marked === 'undefined' || typeof DOMPurify === 'undefined') return '';
  const html = DOMPurify.sanitize(marked.parse(md || ''));
  if (!sourceUrl) return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.body.querySelector('h1')?.remove(); // tránh lặp tiêu đề (đã hiển thị riêng)
  doc.body.querySelectorAll('img[src]').forEach(img => img.setAttribute('src', resolveRelativeAsset(img.getAttribute('src'), sourceUrl)));
  doc.body.querySelectorAll('a[href]').forEach(a   => a.setAttribute('href',  resolveRelativeAsset(a.getAttribute('href'),  sourceUrl)));
  return doc.body.innerHTML;
}

async function renderArticleBody(article) {
  if (article.content) return markdownToHtml(article.content, null);
  if (article.content_url) {
    try {
      const md = await (await fetch(article.content_url)).text();
      return markdownToHtml(md, article.content_url);
    } catch {
      return '<p class="text-muted">Không thể tải nội dung bài viết.</p>';
    }
  }
  return '';
}

// ── Render ─────────────────────────────────────────────────────────────────────

function renderSidePanel(category, related) {
  $('article-side-panel').innerHTML = `
    <div class="panel-block">
      <h4>Danh mục</h4>
      <span class="badge bg-primary">${esc(category?.category_name || 'Không xác định')}</span>
    </div>
    ${related.length ? `
    <div class="panel-block">
      <h4>Bài viết liên quan</h4>
      <ul class="list-unstyled mb-0">
        ${related.map(a => `<li class="related-tool-item"><a href="${articleHref(a)}">${esc(a.title)}</a></li>`).join('')}
      </ul>
    </div>` : ''}`;
}

async function renderMainPanel(article, category) {
  const body = await renderArticleBody(article);
  const sourceBtn = isHttp(article.original_url)
    ? `<a class="btn btn-primary" href="${esc(article.original_url)}" target="_blank" rel="noopener noreferrer">
         <i class="fas fa-up-right-from-square me-2"></i>Xem bài gốc
       </a>`
    : '';

  $('article-main-panel').innerHTML = `
    <span class="badge bg-primary badge-cat mb-3">${esc(category?.category_name || '')}</span>
    <h1 class="h3 mb-3">${esc(article.title)}</h1>
    ${article.published_at ? `<p class="text-muted small mb-3"><i class="far fa-calendar me-1"></i>${esc(formatDate(article.published_at))}${article.original_source ? ` · ${esc(article.original_source)}` : ''}</p>` : ''}
    ${article.summary ? `<p class="lead">${esc(article.summary)}</p>` : ''}
    ${article.thumbnail_url ? `<img class="article-hero-img" src="${esc(article.thumbnail_url)}" alt="${esc(article.title)}" loading="lazy">` : ''}
    ${body ? `<div class="article-content">${body}</div>` : ''}
    ${sourceBtn ? `<div class="article-source-btn mt-4">${sourceBtn}</div>` : ''}
    ${article.original_url ? `<p class="article-source-note">Nguồn: <a href="${esc(article.original_url)}" target="_blank" rel="noopener noreferrer">${esc(article.original_source || article.original_url)}</a></p>` : ''}`;
}

function renderState(message, cls = 'alert-warning') {
  $('article-detail-state').innerHTML = `
    <div class="alert ${cls}" role="alert">
      <i class="fas fa-triangle-exclamation me-2"></i>${message}
      <div class="mt-3"><a href="van-ban.html" class="btn btn-primary btn-sm">Quay lại danh sách bài viết</a></div>
    </div>`;
}

// ── Khởi chạy ──────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(location.search);
  const slug = params.get('slug');
  const id   = params.get('id');
  if (!slug && !id) return renderState('Thiếu thông tin bài viết trong đường dẫn.');

  try {
    const query = slug ? `?slug=${encodeURIComponent(slug)}` : `?id=${encodeURIComponent(id)}`;
    const res  = await fetch(ARTICLES_API + query);
    const data = await res.json();
    if (!res.ok || !data.article) throw new Error(data.error || 'Không tìm thấy bài viết.');

    const { article, category = null, related = [] } = data;

    document.title = `${article.title} - NotDore`;
    renderSidePanel(category, related);
    await renderMainPanel(article, category);

    $('article-detail-state').classList.add('d-none');
    $('article-detail-layout').classList.remove('d-none');
  } catch (err) {
    console.error('[article-detail]', err);
    renderState('Không thể tải bài viết này. Có thể đường dẫn đã cũ hoặc bài viết đã bị xoá.', 'alert-danger');
  }
});
