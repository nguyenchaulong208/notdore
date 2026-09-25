// assets/js/index.js — Logic trang chủ & trang văn bản
// Fetch /api/documents → sort issued_date DESC → sidebar giới hạn 8 mới nhất + bảng cuộn + filter
// Được dùng bởi: index.html (chỉ grid công cụ) và van-ban.html (sidebar + bảng)
// Phân biệt theo ID: trang có #sidebar-content → chạy phần văn bản

const API_URL    = '/api/documents';
const PAGE_SIZE  = 12;
const RECENT_DAYS = 30;
const MAX_SIDEBAR_ITEMS = 8; // Giới hạn sidebar "Văn bản mới nhất"
const BADGE_NEW  = '<span class="badge-new">MỚI</span>';

// ── Helpers ──────────────────────────────────────────────────────────────────────

const isRecentByIssuedDate = (issued_date) => {
  if (!issued_date) return false;
  const t = new Date(issued_date).getTime();
  if (isNaN(t)) return false;
  const now = Date.now();
  return t >= now - RECENT_DAYS * 86400000 && t <= now;
};

const compareByIssuedDateDesc = (a, b) => {
  const aT = a.issued_date ? new Date(a.issued_date).getTime() : NaN;
  const bT = b.issued_date ? new Date(b.issued_date).getTime() : NaN;
  if (!isNaN(aT) && !isNaN(bT)) return bT - aT;
  if (!isNaN(aT)) return -1;
  if (!isNaN(bT)) return  1;
  return 0;
};

// ── Page detection ──────────────────────────────────────────────────────────────

const isDocumentsPage = () => !!document.getElementById('sidebar-content');
const isToolsPage = () => !!document.getElementById('tools-content') || !!document.getElementById('tools-grid');

// ── Sidebar "Văn bản mới nhất" (chỉ trang van-ban.html) ─────────────────────────

function renderSidebar(allDocs) {
  const container = document.getElementById('sidebar-content');
  const recent = allDocs
    .filter(d => isRecentByIssuedDate(d.issued_date))
    .slice(0, MAX_SIDEBAR_ITEMS); // Giới hạn 8 item mới nhất trong 30 ngày

  if (!recent.length) {
    container.innerHTML = `<p class="sb-state">Không có văn bản mới trong ${RECENT_DAYS} ngày qua.</p>`;
    return;
  }

  mountCarousel(container, recent, 'documents-section', () => BADGE_NEW);
}

// ── Trang chủ: chỉ render grid công cụ (dùng khi isToolsPage) ──────────────────

const toolsState = { categories: [], tools: [], activeCategoryId: null };

const toolsAPICategoryId = (c) => c.category_name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes('tai lieu tham khao');

function renderToolsTabs() {
  const items = [{ id: null, name: 'Tất cả' }, ...toolsState.categories.map(c => ({ id: c.category_id, name: c.category_name }))];
  document.getElementById('tool-tabs').innerHTML = items.map(i => `
    <li class="nav-item">
      <button class="nav-link ${toolsState.activeCategoryId === i.id ? 'active' : ''}" type="button"
        data-category-id="${i.id ?? ''}" ${toolsState.activeCategoryId === i.id ? 'aria-current="page"':''}>${esc(i.name)}</button>
    </li>`).join('');
}

function toolsLinkBtn(l) {
  return l.url && l.url.startsWith('http')
    ? `<a class="btn btn-secondary btn-sm" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.display_name || `Mở ${l.source.source_name}`)}</a>`
    : '';
}

function renderToolCard(tool, category) {
  const video = tool.links.find(l => l.url && l.url.includes('youtube.com/embed'));
  const links = tool.links.filter(l => l !== video).map(toolsLinkBtn).join('');
  return `
    <div class="col-12 col-md-6 col-lg-4">
      <article class="card tool-card h-100">
        <div class="card-body d-flex flex-column">
          <span class="badge bg-primary badge-cat align-self-start mb-3">${esc(category.category_name)}</span>
          <h3 class="card-title h5"><a href="tool-detail.html?id=${encodeURIComponent(tool.id)}" class="tool-title-link">${esc(tool.name)}</a></h3>
          ${tool.description ? `<p class="card-text">${esc(tool.description)}</p>` : ''}
          ${video ? `<div class="youtube-embed mb-3"><iframe src="${esc(video.url)}" title="${esc(tool.name)}" loading="lazy" allowfullscreen></iframe></div>` : ''}
          <div class="tool-actions mt-auto">
            <a href="tool-detail.html?id=${encodeURIComponent(tool.id)}" class="btn btn-primary btn-sm"><i class="fas fa-circle-info me-1"></i>Xem chi tiết</a>
            ${links}
          </div>
        </div>
      </article>
    </div>`;
}

function renderReferenceItem(tool) {
  const links = tool.links.map(toolsLinkBtn).join('');
  return `
    <li class="list-group-item d-flex justify-content-between align-items-center gap-3 p-3 p-lg-4">
      <div>
        <strong><a href="tool-detail.html?id=${encodeURIComponent(tool.id)}" class="tool-title-link">${esc(tool.name)}</a></strong>
        ${tool.description ? `<br><small>${esc(tool.description)}</small>` : ''}
      </div>
      ${links ? `<div class="tool-actions flex-shrink-0">${links}</div>` : ''}
    </li>`;
}

function renderToolsContent() {
  const categories = toolsState.activeCategoryId === null
    ? toolsState.categories
    : toolsState.categories.filter(c => c.category_id === toolsState.activeCategoryId);

  const sections = categories.map(category => {
    const tools = toolsState.tools.filter(t => t.category_id === category.category_id);
    if (!tools.length) return '';
    const body = toolsAPICategoryId(category)
      ? `<div class="resource-list"><ul class="list-group list-group-flush mb-0">${tools.map(renderReferenceItem).join('')}</ul></div>`
      : `<div class="row g-4 justify-content-center">${tools.map(t => renderToolCard(t, category)).join('')}</div>`;
    return `<section id="category-${category.category_id}" class="tool-category mb-5"><h2 class="section-heading text-center mb-4">${esc(category.category_name)}</h2>${body}</section>`;
  }).filter(Boolean).join('');

  document.getElementById('tools-content').innerHTML = sections || '<p class="tool-state text-center">Chưa có công cụ phù hợp trong danh mục này.</p>';
}

// ── Văn bản: renderGrid cuộn không phân trang (chỉ trang van-ban.html) ─────────

const docState = { allDocs: [], filtered: [], page: 1 };

const getDocFilters = () => ({
  type:   document.getElementById('filter-type')?.value   ?? '',
  year:   document.getElementById('filter-year')?.value   ?? '',
  status: document.getElementById('filter-status')?.value ?? '',
  search: (document.getElementById('filter-search')?.value ?? '').trim().toLowerCase(),
});

function applyDocFilters() {
  const f = getDocFilters();
  docState.filtered = docState.allDocs.filter(d => {
    if (f.type   && (d.loai_van_ban || 'Khác') !== f.type)                        return false;
    if (f.year   && String(detectYear(d)) !== f.year)                             return false;
    if (f.status && d.status && d.status !== f.status)                            return false;
    if (f.search && !`${d.code} ${d.title}`.toLowerCase().includes(f.search))    return false;
    return true;
  });
  renderDocGrid();
  updateDocFilterCount();
}

function docCodeCell(d) {
  const code = esc(d.code || '—');
  return d.file?.drive_view_url
    ? `<a class="doc-table__code doc-table__code--link" href="${esc(d.file.drive_view_url)}" target="_blank" rel="noopener" title="Xem văn bản ${code}">${code}</a>`
    : `<span class="doc-table__code">${code}</span>`;
}

function docFileButtons(file) {
  if (!file?.drive_view_url) return '<span class="text-muted">—</span>';
  const view = `<a href="${esc(file.drive_view_url)}" target="_blank" rel="noopener"><i class="fas fa-eye me-1"></i>Xem online</a>`;
  const dl   = file.drive_download_url
    ? `<a href="${esc(file.drive_download_url)}" class="text-secondary" target="_blank" rel="noopener"><i class="fas fa-download me-1"></i>Tải xuống</a>`
    : '';
  return `<div class="doc-table__actions">${view}${dl}</div>`;
}

function renderDocGrid() {
  const grid    = document.getElementById('documents-grid');
  const visible = docState.filtered; // Hiển thị toàn bộ đã lọc, không phân trang

  if (!visible.length) {
    grid.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Không tìm thấy văn bản phù hợp.</td></tr>';
    return;
  }

  grid.innerHTML = visible.map(d => `
    <tr>
      <td>${docCodeCell(d)}</td>
      <td><span class="doc-table__title">${esc(d.title)}</span></td>
      <td><span class="doc-table__type">${esc(d.loai_van_ban || 'Khác')}</span></td>
      <td><span class="doc-table__date">${esc(formatDate(d.issued_date) || '—')}</span></td>
      <td>${renderStatusBadge(d.status) || '—'}</td>
      <td>${docFileButtons(d.file)}</td>
    </tr>`).join('');
}

function updateDocFilterCount() {
  const el    = document.getElementById('filter-count');
  const total = docState.allDocs.length;
  const shown = docState.filtered.length;
  if (el) el.textContent = shown < total ? `Hiển thị ${shown} / ${total} văn bản` : `${total} văn bản`;
}

function renderDocError(message) {
  const sb = document.getElementById('sidebar-content');
  if (sb) sb.innerHTML = `<p class="sb-state sb-state--error"><i class="fas fa-exclamation-circle me-1"></i>Không thể tải dữ liệu.</p>`;
  const grid = document.getElementById('documents-grid');
  if (grid) grid.innerHTML = `
    <tr><td colspan="6"><div class="alert alert-danger mb-0" role="alert">
      <i class="fas fa-exclamation-triangle me-2"></i>
      <strong>Không thể tải danh sách văn bản.</strong> ${esc(message)} Vui lòng thử lại sau.
    </div></td></tr>`;
}

// ── Khởi chạy — phân nhánh theo trang ─────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  if (isDocumentsPage()) {
    // ── Trang van-ban.html: sidebar + bảng văn bản ───────────────────────────
    try {
      const res  = await fetch(API_URL);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi không xác định từ máy chủ.');
      const docs = (data.docs || []).sort(compareByIssuedDateDesc);
      document.getElementById('docs-loading')?.remove();

      renderSidebar(docs);

      docState.allDocs  = docs;
      docState.filtered = docs;
      populateYearFilter(docs);
      document.getElementById('filter-bar').style.display = 'block';
      renderDocGrid();
      updateDocFilterCount();

      ['filter-type', 'filter-year', 'filter-status'].forEach(id =>
        document.getElementById(id)?.addEventListener('change', applyDocFilters));
      document.getElementById('filter-search')?.addEventListener('input', applyDocFilters);
      document.getElementById('filter-reset')?.addEventListener('click', () => {
        ['filter-type', 'filter-year', 'filter-status', 'filter-search'].forEach(id =>
          (document.getElementById(id).value = ''));
        applyDocFilters();
      });
    } catch (err) {
      console.error('[NotDore] Fetch error:', err);
      renderDocError(err.message);
    }
  } else if (isToolsPage()) {
    // ── Trang tools.html / index.html: grid công cụ ──────────────────────────
    try {
      const res  = await fetch('/api/tools');
      const data = await res.json();
      toolsState.categories = data.categories || [];
      toolsState.tools      = data.tools      || [];
      renderToolsTabs();
      renderToolsContent();

      document.getElementById('tool-tabs').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-category-id]');
        if (!btn) return;
        toolsState.activeCategoryId = btn.dataset.categoryId === '' ? null : Number(btn.dataset.categoryId);
        renderToolsTabs();
        renderToolsContent();
      });
    } catch (err) {
      console.error('[tools] Fetch error:', err);
      document.getElementById('tools-content').innerHTML =
        '<div class="alert alert-danger single-col-max mx-auto mb-0" role="alert"><i class="fas fa-exclamation-triangle me-2"></i>Không thể tải danh sách công cụ. Vui lòng thử lại sau.</div>';
    }
  }
});
