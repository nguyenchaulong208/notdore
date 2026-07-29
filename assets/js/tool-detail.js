const API_URL = '/api/tools';

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isSafeHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function isYouTubeEmbed(link) {
  if (link.source?.source_type !== 'video' || !isSafeHttpUrl(link.url)) return false;
  const url = new URL(link.url);
  return ['www.youtube.com', 'youtube.com', 'www.youtube-nocookie.com'].includes(url.hostname)
    && url.pathname.startsWith('/embed/');
}

function getToolId() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  return id === null ? null : id;
}

function renderLink(link) {
  if (!isSafeHttpUrl(link.url)) return '';
  const label = link.display_name || `Mở ${link.source.source_name}`;
  return `<a class="btn btn-secondary btn-sm me-2 mb-2" href="${esc(link.url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
}

/**
 * Panel trái - mặc định hiển thị danh mục + công cụ liên quan.
 * Đây là khối tách riêng để dễ tùy biến sau này (VD: đổi thành mục lục, bộ lọc tag...).
 */
function renderSidePanel(tool, category, relatedTools) {
  const panel = document.getElementById('tool-side-panel');

  const categoryBlock = `
    <div class="panel-block">
      <h4>Danh mục</h4>
      <span class="badge bg-primary">${esc(category ? category.category_name : 'Không xác định')}</span>
    </div>`;

  const relatedBlock = relatedTools.length ? `
    <div class="panel-block">
      <h4>Công cụ liên quan</h4>
      <ul class="list-unstyled mb-0">
        ${relatedTools.map(t => `
          <li class="related-tool-item">
            <a href="tool-detail.html?id=${encodeURIComponent(t.id)}">${esc(t.name)}</a>
          </li>`).join('')}
      </ul>
    </div>` : '';

  panel.innerHTML = categoryBlock + relatedBlock;
}

function renderMainPanel(tool, category) {
  const main = document.getElementById('tool-main-panel');
  const video = tool.links.find(isYouTubeEmbed);
  const links = tool.links.filter(link => link !== video).map(renderLink).filter(Boolean).join('');

  main.innerHTML = `
    <span class="badge bg-primary badge-cat mb-3">${esc(category ? category.category_name : '')}</span>
    <h1 class="h3 mb-3">${esc(tool.name)}</h1>
    ${tool.description ? `<p class="tool-description">${esc(tool.description)}</p>` : ''}
    ${video ? `<div class="youtube-embed my-4"><iframe src="${esc(video.url)}" title="${esc(tool.name)}" loading="lazy" allowfullscreen></iframe></div>` : ''}
    ${links ? `<div class="tool-actions mt-4">${links}</div>` : ''}
  `;
}

function renderNotFound() {
  document.getElementById('tool-detail-state').innerHTML = `
    <div class="alert alert-warning" role="alert">
      <i class="fas fa-triangle-exclamation me-2"></i>Không tìm thấy công cụ này. Có thể đường dẫn đã cũ hoặc công cụ đã bị xoá.
      <div class="mt-3"><a href="tools.html" class="btn btn-primary btn-sm">Quay lại danh sách công cụ</a></div>
    </div>`;
}

function renderError() {
  document.getElementById('tool-detail-state').innerHTML = `
    <div class="alert alert-danger" role="alert">
      <i class="fas fa-exclamation-triangle me-2"></i>Không thể tải thông tin công cụ. Vui lòng thử lại sau.
    </div>`;
}

document.addEventListener('DOMContentLoaded', async () => {
  const toolId = getToolId();
  if (toolId === null) {
    renderNotFound();
    return;
  }

  try {
    const response = await fetch(API_URL);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Request failed');

    const categories = data.categories || [];
    const tools = data.tools || [];

    const tool = tools.find(t => String(t.id) === String(toolId));
    if (!tool) {
      renderNotFound();
      return;
    }

    const category = categories.find(c => c.category_id === tool.category_id) || null;
    const relatedTools = tools.filter(t => t.category_id === tool.category_id && String(t.id) !== String(tool.id)).slice(0, 6);

    document.title = `${tool.name} - NotDore`;

    renderSidePanel(tool, category, relatedTools);
    renderMainPanel(tool, category);

    document.getElementById('tool-detail-state').classList.add('d-none');
    document.getElementById('tool-detail-layout').classList.remove('d-none');
  } catch (error) {
    console.error('[tool-detail] Fetch error:', error);
    renderError();
  }
});
