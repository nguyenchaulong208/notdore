// assets/js/index.js — Logic trang chủ
// Fetch /api/documents → sort issued_date DESC → sidebar (30 ngày gần đây) + grid + filter

const API_URL    = '/api/documents';
const PAGE_SIZE  = 12;
const RECENT_DAYS = 30;
const BADGE_NEW  = '<span class="badge-new">MỚI</span>';

// ── Helpers trang chủ ─────────────────────────────────────────────────────────

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

// ── Sidebar "Văn bản mới nhất" ────────────────────────────────────────────────

function renderSidebar(allDocs) {
  const container = document.getElementById('sidebar-content');
  const recent = allDocs.filter(d => isRecentByIssuedDate(d.issued_date));

  if (!recent.length) {
    container.innerHTML = `<p class="sb-state">Không có văn bản mới trong ${RECENT_DAYS} ngày qua.</p>`;
    return;
  }

  mountCarousel(container, recent, 'documents-section', () => BADGE_NEW);
}

// ── Grid văn bản + Filter + Phân trang ────────────────────────────────────────

const state = { allDocs: [], filtered: [], page: 1 };

const getFilters = () => ({
  type:   document.getElementById('filter-type').value,
  year:   document.getElementById('filter-year').value,
  status: document.getElementById('filter-status').value,
  search: document.getElementById('filter-search').value.trim().toLowerCase(),
});

function applyFilters() {
  const f = getFilters();
  state.filtered = state.allDocs.filter(d => {
    if (f.type   && (d.loai_van_ban || 'Khác') !== f.type)                        return false;
    if (f.year   && String(detectYear(d)) !== f.year)                             return false;
    if (f.status && d.status && d.status !== f.status)                            return false;
    if (f.search && !`${d.code} ${d.title}`.toLowerCase().includes(f.search))    return false;
    return true;
  });
  state.page = 1;
  renderGridPage();
  updateFilterCount();
}

function renderCodeCell(d) {
  const code = esc(d.code || '—');
  return d.file?.drive_view_url
    ? `<a class="doc-table__code doc-table__code--link" href="${esc(d.file.drive_view_url)}" target="_blank" rel="noopener" title="Xem văn bản ${code}">${code}</a>`
    : `<span class="doc-table__code">${code}</span>`;
}

function renderFileButtons(file) {
  if (!file?.drive_view_url) return '—';
  const view = `<a href="${esc(file.drive_view_url)}" target="_blank" rel="noopener"><i class="fas fa-eye me-1"></i>Xem online</a>`;
  const dl   = file.drive_download_url
    ? `<a href="${esc(file.drive_download_url)}" class="text-secondary" target="_blank" rel="noopener"><i class="fas fa-download me-1"></i>Tải xuống</a>`
    : '';
  return `<div class="doc-table__actions">${view}${dl}</div>`;
}

function renderGridPage() {
  const grid    = document.getElementById('documents-grid');
  const loadMore = document.getElementById('load-more-wrap');
  const visible = state.filtered.slice(0, state.page * PAGE_SIZE);

  if (!state.filtered.length) {
    grid.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Không tìm thấy văn bản phù hợp.</td></tr>';
    loadMore.style.display = 'none';
    return;
  }

  grid.innerHTML = visible.map(d => `
    <tr>
      <td>${renderCodeCell(d)}</td>
      <td><span class="doc-table__title">${esc(d.title)}</span></td>
      <td><span class="doc-table__type">${esc(d.loai_van_ban || 'Khác')}</span></td>
      <td><span class="doc-table__date">${esc(formatDate(d.issued_date) || '—')}</span></td>
      <td>${renderStatusBadge(d.status) || '—'}</td>
      <td>${renderFileButtons(d.file)}</td>
    </tr>`).join('');

  loadMore.style.display = visible.length < state.filtered.length ? 'block' : 'none';
}

function updateFilterCount() {
  const total = state.allDocs.length, shown = state.filtered.length;
  document.getElementById('filter-count').textContent =
    shown < total ? `Hiển thị ${shown} / ${total} văn bản` : `${total} văn bản`;
}

function renderError(message) {
  document.getElementById('sidebar-content').innerHTML =
    `<p class="sb-state sb-state--error"><i class="fas fa-exclamation-circle me-1"></i>Không thể tải dữ liệu.</p>`;
  document.getElementById('documents-grid').innerHTML = `
    <tr><td colspan="6"><div class="alert alert-danger mb-0" role="alert">
      <i class="fas fa-exclamation-triangle me-2"></i>
      <strong>Không thể tải danh sách văn bản.</strong> ${esc(message)} Vui lòng thử lại sau.
    </div></td></tr>`;
}

// ── Khởi chạy ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const res  = await fetch(API_URL);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lỗi không xác định từ máy chủ.');

    const docs = (data.docs || []).sort(compareByIssuedDateDesc);
    document.getElementById('docs-loading')?.remove();

    renderSidebar(docs);

    state.allDocs  = docs;
    state.filtered = docs;
    state.page     = 1;
    populateYearFilter(docs);
    document.getElementById('filter-bar').style.display = 'block';
    renderGridPage();
    updateFilterCount();

    ['filter-type', 'filter-year', 'filter-status'].forEach(id =>
      document.getElementById(id).addEventListener('change', applyFilters));
    document.getElementById('filter-search').addEventListener('input', applyFilters);

    document.getElementById('filter-reset').addEventListener('click', () => {
      ['filter-type', 'filter-year', 'filter-status', 'filter-search'].forEach(id =>
        (document.getElementById(id).value = ''));
      applyFilters();
    });

    document.getElementById('load-more-btn').addEventListener('click', () => {
      state.page++;
      renderGridPage();
    });

  } catch (err) {
    console.error('[NotDore] Fetch error:', err);
    renderError(err.message);
  }
});
