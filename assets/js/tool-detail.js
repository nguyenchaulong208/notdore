const API_URL = '/api/tools';
const $ = (id) => document.getElementById(id);

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isHttp = (u) => { try { return ['http:', 'https:'].includes(new URL(u).protocol); } catch { return false; } };
const isYouTube = (l) => {
  if (l.source?.source_type !== 'video' || !isHttp(l.url)) return false;
  const u = new URL(l.url);
  return ['www.youtube.com', 'youtube.com', 'www.youtube-nocookie.com'].includes(u.hostname) && u.pathname.startsWith('/embed/');
};
const linkBtn = (l) => isHttp(l.url)
  ? `<a class="btn btn-secondary btn-sm me-2 mb-2" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.display_name || `Mở ${l.source.source_name}`)}</a>`
  : '';

// Bài viết Markdown được lưu công khai trên GitHub (tool.article_url = raw URL), fetch + render client-side để tối ưu chi phí lưu trữ.
async function fetchArticle(url) {
  if (!url) return '';
  try {
    const md = await (await fetch(url)).text();
    return DOMPurify.sanitize(marked.parse(md));
  } catch {
    return '<p class="text-muted">Không thể tải nội dung bài viết.</p>';
  }
}

function renderSidePanel(category, related) {
  $('tool-side-panel').innerHTML = `
    <div class="panel-block">
      <h4>Danh mục</h4>
      <span class="badge bg-primary">${esc(category?.category_name || 'Không xác định')}</span>
    </div>
    ${related.length ? `
    <div class="panel-block">
      <h4>Công cụ liên quan</h4>
      <ul class="list-unstyled mb-0">
        ${related.map((t) => `<li class="related-tool-item"><a href="tool-detail.html?id=${encodeURIComponent(t.id)}">${esc(t.name)}</a></li>`).join('')}
      </ul>
    </div>` : ''}`;
}

async function renderMainPanel(tool, category) {
  const video = tool.links.find(isYouTube);
  const links = tool.links.filter((l) => l !== video).map(linkBtn).join('');
  const article = await fetchArticle(tool.article_url);

  $('tool-main-panel').innerHTML = `
    <span class="badge bg-primary badge-cat mb-3">${esc(category?.category_name || '')}</span>
    <h1 class="h3 mb-3">${esc(tool.name)}</h1>
    ${tool.description ? `<p class="lead">${esc(tool.description)}</p>` : ''}
    ${video ? `<div class="youtube-embed my-4"><iframe src="${esc(video.url)}" title="${esc(tool.name)}" loading="lazy" allowfullscreen></iframe></div>` : ''}
    ${article ? `<div class="tool-article">${article}</div>` : ''}
    ${links ? `<div class="tool-actions mt-4">${links}</div>` : ''}
  `;
}

function renderState(message, cls = 'alert-warning') {
  $('tool-detail-state').innerHTML = `
    <div class="alert ${cls}" role="alert">
      <i class="fas fa-triangle-exclamation me-2"></i>${message}
      <div class="mt-3"><a href="tools.html" class="btn btn-primary btn-sm">Quay lại danh sách công cụ</a></div>
    </div>`;
}

document.addEventListener('DOMContentLoaded', async () => {
  const toolId = new URLSearchParams(location.search).get('id');
  if (!toolId) return renderState('Thiếu mã công cụ trong đường dẫn.');

  try {
    const { categories = [], tools = [] } = await (await fetch(API_URL)).json();
    const tool = tools.find((t) => String(t.id) === toolId);
    if (!tool) return renderState('Không tìm thấy công cụ này. Có thể đường dẫn đã cũ hoặc công cụ đã bị xoá.');

    const category = categories.find((c) => c.category_id === tool.category_id) || null;
    const related = tools.filter((t) => t.category_id === tool.category_id && t.id !== tool.id).slice(0, 6);

    document.title = `${tool.name} - NotDore`;
    renderSidePanel(category, related);
    await renderMainPanel(tool, category);

    $('tool-detail-state').classList.add('d-none');
    $('tool-detail-layout').classList.remove('d-none');
  } catch (err) {
    console.error('[tool-detail]', err);
    renderState('Không thể tải thông tin công cụ. Vui lòng thử lại sau.', 'alert-danger');
  }
});