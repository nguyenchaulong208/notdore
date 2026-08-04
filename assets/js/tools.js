// assets/js/tools.js — Logic trang công cụ
// esc, isHttp, isYouTube được cung cấp bởi utils.js (load trước)

const API_URL = '/api/tools';
const $ = (id) => document.getElementById(id);
const state = { categories: [], tools: [], activeCategoryId: null };

const isReferenceCategory = (c) => c.category_name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes('tai lieu tham khao');
const detailUrl = (t) => `tool-detail.html?id=${encodeURIComponent(t.id)}`;
const linkBtn = (l) => isHttp(l.url)
  ? `<a class="btn btn-secondary btn-sm" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.display_name || `Mở ${l.source.source_name}`)}</a>`
  : '';

function renderTabs() {
  const items = [{ id: null, name: 'Tất cả' }, ...state.categories.map(c => ({ id: c.category_id, name: c.category_name }))];
  $('tool-tabs').innerHTML = items.map(i => `
    <li class="nav-item">
      <button class="nav-link ${state.activeCategoryId === i.id ? 'active' : ''}" type="button"
        data-category-id="${i.id ?? ''}" ${state.activeCategoryId === i.id ? 'aria-current="page"' : ''}>${esc(i.name)}</button>
    </li>`).join('');
}

function renderToolCard(tool, category) {
  const video = tool.links.find(isYouTube);
  const links = tool.links.filter(l => l !== video).map(linkBtn).join('');
  return `
    <div class="col-12 col-md-6 col-lg-4">
      <article class="card tool-card h-100">
        <div class="card-body d-flex flex-column">
          <span class="badge bg-primary badge-cat align-self-start mb-3">${esc(category.category_name)}</span>
          <h3 class="card-title h5"><a href="${detailUrl(tool)}" class="tool-title-link">${esc(tool.name)}</a></h3>
          ${tool.description ? `<p class="card-text">${esc(tool.description)}</p>` : ''}
          ${video ? `<div class="youtube-embed mb-3"><iframe src="${esc(video.url)}" title="${esc(tool.name)}" loading="lazy" allowfullscreen></iframe></div>` : ''}
          <div class="tool-actions mt-auto">
            <a href="${detailUrl(tool)}" class="btn btn-primary btn-sm"><i class="fas fa-circle-info me-1"></i>Xem chi tiết</a>
            ${links}
          </div>
        </div>
      </article>
    </div>`;
}

function renderReferenceItem(tool) {
  const links = tool.links.map(linkBtn).join('');
  return `
    <li class="list-group-item d-flex justify-content-between align-items-center gap-3 p-3 p-lg-4">
      <div>
        <strong><a href="${detailUrl(tool)}" class="tool-title-link">${esc(tool.name)}</a></strong>
        ${tool.description ? `<br><small>${esc(tool.description)}</small>` : ''}
      </div>
      ${links ? `<div class="tool-actions flex-shrink-0">${links}</div>` : ''}
    </li>`;
}

function renderContent() {
  const categories = state.activeCategoryId === null
    ? state.categories
    : state.categories.filter(c => c.category_id === state.activeCategoryId);

  const sections = categories.map(category => {
    const tools = state.tools.filter(t => t.category_id === category.category_id);
    if (!tools.length) return '';
    const body = isReferenceCategory(category)
      ? `<div class="resource-list"><ul class="list-group list-group-flush mb-0">${tools.map(renderReferenceItem).join('')}</ul></div>`
      : `<div class="row g-4 justify-content-center">${tools.map(t => renderToolCard(t, category)).join('')}</div>`;
    return `<section id="category-${category.category_id}" class="tool-category mb-5"><h2 class="section-heading text-center mb-4">${esc(category.category_name)}</h2>${body}</section>`;
  }).filter(Boolean).join('');

  $('tools-content').innerHTML = sections || '<p class="tool-state text-center">Chưa có công cụ phù hợp trong danh mục này.</p>';
}

document.addEventListener('DOMContentLoaded', async () => {
  $('tool-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-category-id]');
    if (!btn) return;
    state.activeCategoryId = btn.dataset.categoryId === '' ? null : Number(btn.dataset.categoryId);
    renderTabs();
    renderContent();
  });

  try {
    const data = await (await fetch(API_URL)).json();
    state.categories = data.categories || [];
    state.tools = data.tools || [];
    renderTabs();
    renderContent();
  } catch (err) {
    console.error('[tools] Fetch error:', err);
    $('tools-content').innerHTML = '<div class="alert alert-danger single-col-max mx-auto mb-0" role="alert"><i class="fas fa-exclamation-triangle me-2"></i>Không thể tải danh sách công cụ. Vui lòng thử lại sau.</div>';
  }
});
