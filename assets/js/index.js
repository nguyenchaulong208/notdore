/**
 * assets/js/home.js — Logic trang chủ (index.html)
 *
 * Dữ liệu lấy từ endpoint api/documents.js — trả về toàn bộ bảng `documents`
 * trong Supabase (không lọc theo danh mục/tag).
 *
 * Luồng:
 *  1. Fetch toàn bộ văn bản từ /api/documents.
 *  2. Sidebar "Văn bản mới nhất": lọc theo issued_date trong vòng 30 ngày
 *     gần đây so với thời điểm hiện tại (không dùng created_at).
 *  3. Grid "VĂN BẢN": hiển thị toàn bộ văn bản với filter (loại, năm,
 *     trạng thái, tìm kiếm) + phân trang "Xem thêm".
 */

// ── Cấu hình ──────────────────────────────────────────────────────────────────

const API_URL = '/api/documents';

const PAGE_SIZE    = 12; // Số văn bản mỗi lần hiển thị trong grid
const RECENT_DAYS  = 30; // "Mới nhất" = issued_date trong N ngày qua

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Escape HTML để chống XSS */
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Phát hiện loại văn bản từ số hiệu.
 * Ví dụ: "163/2017/NĐ-CP" → "Nghị định", "13/2008/QH12" → "Luật"
 */
function detectDocType(code, title = '') {
  if (!code) return 'Khác';

  // Trường hợp code bị trộn title
  if (/Nghị quyết/i.test(code)) return 'Nghị quyết';

  if (/\/NĐ-|\/ND-/i.test(code)) return 'Nghị định';
  if (/\/TT-|\/TT$/i.test(code)) return 'Thông tư';
  if (/\/QĐ-|\/QD-/i.test(code)) return 'Quyết định';
  if (/\/CT-/i.test(code)) return 'Công văn';

  // Văn bản của Quốc hội
  if (/\/QH\d+$/i.test(code)) {
    if (/Nghị quyết/i.test(title)) return 'Nghị quyết';
    if (/Luật/i.test(title)) return 'Luật';
    return 'Chưa nhận diện được loại văn bản';
  }

  return 'Khác';
}



/**
 * Lấy năm ban hành: ưu tiên issued_date, rồi created_at, fallback từ số hiệu.
 */
function detectYear(doc) {
  if (doc.issued_date) return new Date(doc.issued_date).getFullYear();
  if (doc.created_at)  return new Date(doc.created_at).getFullYear();
  const m = (doc.code || '').match(/\/(\d{4})\//);
  return m ? parseInt(m[1]) : null;
}

/** Format ngày theo vi-VN, trả về '' nếu không có. */
function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('vi-VN');
}

/** true nếu issued_date nằm trong RECENT_DAYS ngày gần đây so với hiện tại. */
function isRecentByIssuedDate(issued_date) {
  if (!issued_date) return false;
  const issued = new Date(issued_date).getTime();
  if (Number.isNaN(issued)) return false;
  const cutoff = Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000;
  return issued >= cutoff && issued <= Date.now();
}

// ── Sidebar "Văn bản mới nhất" ──────────────────────────────────────────────

/**
 * Render sidebar dựa trên các văn bản có issued_date trong vòng RECENT_DAYS
 * ngày gần đây (sắp xếp mới nhất trước).
 *  - 0 văn bản  → empty state
 *  - 1-2 văn bản → list tĩnh
 *  - ≥3 văn bản → carousel
 */
function renderSidebar(allDocs) {
  const container = document.getElementById('sidebar-content');

  const recent = allDocs
    .filter(d => isRecentByIssuedDate(d.issued_date))
    .sort((a, b) => new Date(b.issued_date) - new Date(a.issued_date));

  if (!recent.length) {
    container.innerHTML = `<p class="sb-state">Không có văn bản mới trong ${RECENT_DAYS} ngày qua.</p>`;
    return;
  }

  if (recent.length < 3) {
    const items = recent.map(d => `
      <li class="sb-static-item" onclick="document.getElementById('documents-section').scrollIntoView({behavior:'smooth'})"
          style="cursor:pointer" title="${esc(d.title)}">
        <i class="fas fa-file-alt sb-static-item__icon"></i>
        <span class="sb-static-item__code">${esc(d.code)}</span>
        <span class="sb-static-item__title">${esc(d.title)}</span>
        <span class="badge-new">MỚI</span>
      </li>`).join('');
    container.innerHTML = `<ul class="sb-static-list">${items}</ul>`;
    return;
  }

  const slides = recent.map((d, i) => `
    <div class="carousel-item ${i === 0 ? 'active' : ''}"
         onclick="document.getElementById('documents-section').scrollIntoView({behavior:'smooth'})"
         title="${esc(d.title)}">
      <div class="sb-slide">
        <div class="sb-slide__code">
          ${esc(d.code)}
          <span class="badge-new">MỚI</span>
        </div>
        <div class="sb-slide__title">${esc(d.title)}</div>
        <div class="sb-slide__date"><i class="fas fa-calendar-alt me-1"></i>Ban hành: ${esc(formatDate(d.issued_date))}</div>
      </div>
    </div>`).join('');

  const indicators = recent.map((_, i) => `
    <button type="button" data-bs-target="#sidebar-carousel"
            data-bs-slide-to="${i}" ${i === 0 ? 'class="active" aria-current="true"' : ''}
            aria-label="Văn bản ${i + 1}"></button>`).join('');

  container.innerHTML = `
    <div id="sidebar-carousel" class="carousel slide"
         data-bs-ride="carousel" data-bs-interval="4000">
      <div class="carousel-inner">${slides}</div>
      <div class="carousel-indicators">${indicators}</div>
    </div>`;

  const carouselEl = document.getElementById('sidebar-carousel');
  const bsCarousel = bootstrap.Carousel.getOrCreateInstance(carouselEl);
  carouselEl.addEventListener('mouseenter', () => bsCarousel.pause());
  carouselEl.addEventListener('focusin',    () => bsCarousel.pause());
  carouselEl.addEventListener('mouseleave', () => bsCarousel.cycle());
  carouselEl.addEventListener('focusout',   () => bsCarousel.cycle());
}

// ── Grid "VĂN BẢN" + Filter + Pagination ────────────────────────────────────

const state = {
  allDocs:  [],
  filtered: [],
  page:     1,
};

function getFilters() {
  return {
    type:   document.getElementById('filter-type').value,
    year:   document.getElementById('filter-year').value,
    status: document.getElementById('filter-status').value,
    search: document.getElementById('filter-search').value.trim().toLowerCase(),
  };
}

function applyFilters() {
  const f = getFilters();

  state.filtered = state.allDocs.filter(d => {
    if (f.type   && detectDocType(d.code) !== f.type)   return false;
    if (f.year   && String(detectYear(d)) !== f.year)   return false;
    if (f.status && d.status && d.status !== f.status)  return false;
    if (f.search) {
      const haystack = `${d.code} ${d.title}`.toLowerCase();
      if (!haystack.includes(f.search)) return false;
    }
    return true;
  });

  state.page = 1;
  renderGridPage();
  updateFilterCount();
}

function renderGridPage() {
  const grid     = document.getElementById('documents-grid');
  const loadMore = document.getElementById('load-more-wrap');
  const visible  = state.filtered.slice(0, state.page * PAGE_SIZE);

  if (!state.filtered.length) {
    grid.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Không tìm thấy văn bản phù hợp.</td></tr>';
    loadMore.style.display = 'none';
    return;
  }

  grid.innerHTML = visible.map(d => {
    const type        = detectDocType(d.code);
    const issuedStr   = formatDate(d.issued_date) || '—';
    const statusBadge = renderStatusBadge(d.status);
    const codeCell     = renderCodeCell(d);

    return `
      <tr>
        <td>${codeCell}</td>
        <td><span class="doc-table__title">${esc(d.title)}</span></td>
        <td><span class="doc-table__type">${esc(type)}</span></td>
        <td><span class="doc-table__date">${esc(issuedStr)}</span></td>
        <td>${statusBadge || '—'}</td>
        <td>${renderFileButtons(d.file)}</td>
      </tr>`;
  }).join('');

  loadMore.style.display = visible.length < state.filtered.length ? 'block' : 'none';
}

/** Số hiệu clickable nếu có link xem online, ngược lại chỉ hiện text. */
function renderCodeCell(d) {
  const codeText = esc(d.code || '—');
  if (d.file?.drive_view_url) {
    return `<a class="doc-table__code doc-table__code--link" href="${esc(d.file.drive_view_url)}"
      target="_blank" rel="noopener" title="Xem văn bản ${codeText}">${codeText}</a>`;
  }
  return `<span class="doc-table__code">${codeText}</span>`;
}

function renderStatusBadge(status) {
  const map = {
    hieu_luc:      ['badge-status--active',   'Còn hiệu lực'],
    het_hieu_luc:  ['badge-status--inactive', 'Hết hiệu lực'],
    chua_hieu_luc: ['badge-status--amended',  'Chưa có hiệu lực'],
  };
  if (!status || !map[status]) return '';
  const [cls, label] = map[status];
  return `<span class="badge-status ${cls}">${label}</span>`;
}

function renderFileButtons(file) {
  if (!file?.drive_view_url) return '—';
  const viewBtn = `
    <a href="${esc(file.drive_view_url)}" target="_blank" rel="noopener">
      <i class="fas fa-eye me-1"></i>Xem online
    </a>`;
  const downloadBtn = file.drive_download_url ? `
    <a href="${esc(file.drive_download_url)}" class="text-secondary" target="_blank" rel="noopener">
      <i class="fas fa-download me-1"></i>Tải xuống
    </a>` : '';
  return `<div class="doc-table__actions">${viewBtn}${downloadBtn}</div>`;
}

function updateFilterCount() {
  const el    = document.getElementById('filter-count');
  const total = state.allDocs.length;
  const shown = state.filtered.length;
  el.textContent = shown < total
    ? `Hiển thị ${shown} / ${total} văn bản`
    : `${total} văn bản`;
}

function populateYearFilter(docs) {
  const years = [...new Set(docs.map(detectYear).filter(Boolean))].sort((a, b) => b - a);
  const sel   = document.getElementById('filter-year');
  years.forEach(y => {
    const opt = document.createElement('option');
    opt.value = String(y);
    opt.textContent = String(y);
    sel.appendChild(opt);
  });
}

function renderError(message) {
  document.getElementById('sidebar-content').innerHTML =
    `<p class="sb-state sb-state--error"><i class="fas fa-exclamation-circle me-1"></i>Không thể tải dữ liệu.</p>`;

  document.getElementById('documents-grid').innerHTML = `
    <tr>
      <td colspan="6">
        <div class="alert alert-danger mb-0" role="alert">
          <i class="fas fa-exclamation-triangle me-2"></i>
          <strong>Không thể tải danh sách văn bản.</strong>
          ${esc(message)}
          Vui lòng thử lại sau.
        </div>
      </td>
    </tr>`;
}

// ── Khởi chạy ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const res  = await fetch(API_URL);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lỗi không xác định từ máy chủ.');

    const docs = data.docs || [];

    const loadingEl = document.getElementById('docs-loading');
    if (loadingEl) loadingEl.remove();

    // ── Sidebar: "Văn bản mới nhất" theo issued_date trong 30 ngày ──
    renderSidebar(docs);

    // ── Grid: toàn bộ văn bản ─────────────────────────────────────
    state.allDocs  = docs;
    state.filtered = docs;
    state.page     = 1;

    populateYearFilter(docs);
    document.getElementById('filter-bar').style.display = 'block';
    renderGridPage();
    updateFilterCount();

    // ── Event listeners: filter ───────────────────────────────────
    ['filter-type', 'filter-year', 'filter-status'].forEach(id =>
      document.getElementById(id).addEventListener('change', applyFilters)
    );
    document.getElementById('filter-search').addEventListener('input', applyFilters);

    document.getElementById('filter-reset').addEventListener('click', () => {
      document.getElementById('filter-type').value   = '';
      document.getElementById('filter-year').value   = '';
      document.getElementById('filter-status').value = '';
      document.getElementById('filter-search').value = '';
      applyFilters();
    });

    // ── Event listener: "Xem thêm" ───────────────────────────────
    document.getElementById('load-more-btn').addEventListener('click', () => {
      state.page++;
      renderGridPage();
    });

  } catch (err) {
    console.error('[NotDore] Fetch error:', err);
    renderError(err.message);
  }
});
