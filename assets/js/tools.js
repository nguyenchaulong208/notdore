const API_URL = '/api/tools';

const state = {
  categories: [],
  tools: [],
  activeCategoryId: null,
};

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

function isReferenceCategory(category) {
  return category.category_name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .includes('tai lieu tham khao');
}

function renderTabs() {
  const tabs = document.getElementById('tool-tabs');
  const items = [
    { id: null, name: 'Tất cả' },
    ...state.categories.map(category => ({ id: category.category_id, name: category.category_name })),
  ];

  tabs.innerHTML = items.map(item => `
    <li class="nav-item">
      <button class="nav-link ${state.activeCategoryId === item.id ? 'active' : ''}"
        type="button" data-category-id="${item.id ?? ''}"
        ${state.activeCategoryId === item.id ? 'aria-current="page"' : ''}>
        ${esc(item.name)}
      </button>
    </li>`).join('');
}

function renderLink(link) {
  if (!isSafeHttpUrl(link.url)) return '';
  const label = link.display_name || `Mở ${link.source.source_name}`;
  return `<a class="btn btn-secondary btn-sm" href="${esc(link.url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
}

function renderToolCard(tool, category) {
  const video = tool.links.find(isYouTubeEmbed);
  const links = tool.links.filter(link => link !== video).map(renderLink).filter(Boolean).join('');
  const tags = tool.tags.map(tag => `<span class="badge badge-cat">${esc(tag.tag_name)}</span>`).join('');

  return `
    <div class="col-12 col-md-6 col-lg-4">
      <article class="card tool-card h-100">
        <div class="card-body d-flex flex-column">
          <span class="badge bg-primary badge-cat align-self-start mb-3">${esc(category.category_name)}</span>
          <h3 class="card-title h5">${esc(tool.name)}</h3>
          ${tool.description ? `<p class="card-text">${esc(tool.description)}</p>` : ''}
          ${tags ? `<div class="tool-tags mb-3">${tags}</div>` : ''}
          ${video ? `<div class="youtube-embed mb-3"><iframe src="${esc(video.url)}" title="${esc(tool.name)}" loading="lazy" allowfullscreen></iframe></div>` : ''}
          ${links ? `<div class="tool-actions mt-auto">${links}</div>` : ''}
        </div>
      </article>
    </div>`;
}

function renderReferenceItem(tool) {
  const links = tool.links.map(renderLink).filter(Boolean).join('');
  return `
    <li class="list-group-item d-flex justify-content-between align-items-center gap-3 p-3 p-lg-4">
      <div>
        <strong>${esc(tool.name)}</strong>
        ${tool.description ? `<br><small>${esc(tool.description)}</small>` : ''}
      </div>
      ${links ? `<div class="tool-actions flex-shrink-0">${links}</div>` : ''}
    </li>`;
}

function renderContent() {
  const container = document.getElementById('tools-content');
  const categories = state.activeCategoryId === null
    ? state.categories
    : state.categories.filter(category => category.category_id === state.activeCategoryId);

  const sections = categories.map(category => {
    const tools = state.tools.filter(tool => tool.category_id === category.category_id);
    if (!tools.length) return '';

    if (isReferenceCategory(category)) {
      return `
        <section id="category-${category.category_id}" class="tool-category mb-5">
          <h2 class="section-heading text-center mb-4">${esc(category.category_name)}</h2>
          <div class="resource-list"><ul class="list-group list-group-flush mb-0">${tools.map(renderReferenceItem).join('')}</ul></div>
        </section>`;
    }

    return `
      <section id="category-${category.category_id}" class="tool-category mb-5">
        <h2 class="section-heading text-center mb-4">${esc(category.category_name)}</h2>
        <div class="row g-4 justify-content-center">${tools.map(tool => renderToolCard(tool, category)).join('')}</div>
      </section>`;
  }).filter(Boolean).join('');

  container.innerHTML = sections || '<p class="tool-state text-center">Chưa có công cụ phù hợp trong danh mục này.</p>';
}

function renderError() {
  document.getElementById('tools-content').innerHTML = `
    <div class="alert alert-danger single-col-max mx-auto mb-0" role="alert">
      <i class="fas fa-exclamation-triangle me-2"></i>Không thể tải danh sách công cụ. Vui lòng thử lại sau.
    </div>`;
}

document.addEventListener('DOMContentLoaded', async () => {
  const tabs = document.getElementById('tool-tabs');
  tabs.addEventListener('click', (event) => {
    const button = event.target.closest('[data-category-id]');
    if (!button) return;
    state.activeCategoryId = button.dataset.categoryId === '' ? null : Number(button.dataset.categoryId);
    renderTabs();
    renderContent();
  });

  try {
    const response = await fetch(API_URL);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Request failed');

    state.categories = data.categories || [];
    state.tools = data.tools || [];
    renderTabs();
    renderContent();
  } catch (error) {
    console.error('[tools] Fetch error:', error);
    renderError();
  }
});
