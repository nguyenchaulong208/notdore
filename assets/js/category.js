/**
 * assets/js/category.js — Logic trang danh mục văn bản
 *
 * Luồng:
 *  1. Đọc ?cat= → validate → render metadata tĩnh
 *  2. Fetch /api/category → nhận toàn bộ docs (đã sort created_at DESC)
 *  3. Sidebar: hiển thị 3 docs mới nhất dạng carousel (hoặc static list nếu < 3)
 *  4. Grid:    hiển thị đầy đủ với filter + tìm kiếm + phân trang "Xem thêm"
 */

// ── Hằng số ───────────────────────────────────────────────────────────────────

const PAGE_SIZE = 12; // Số văn bản hiển thị mỗi lần trong grid

const ICONS = [
  'file-alt', 'gavel', 'book', 'file-invoice', 'exchange-alt', 'percent',
  'file-contract', 'envelope', 'chart-line', 'hand-holding-heart', 'star', 'calculator',
];

/** Metadata tĩnh của từng danh mục */
const CATEGORY_INFO = {
  vat: {
    title:       'Thuế Giá Trị Gia Tăng',
    short:       'Thuế VAT',
    description: 'Tổng hợp các văn bản pháp luật về thuế giá trị gia tăng (VAT), bao gồm Luật, Nghị định, Thông tư hướng dẫn và các tài liệu liên quan.',
    overview: [
      'Thuế giá trị gia tăng (VAT) là thuế tính trên giá trị tăng thêm của hàng hóa, dịch vụ.',
      'Đối tượng chịu thuế: hàng hóa, dịch vụ sản xuất, kinh doanh và nhập khẩu.',
      'Các mức thuế suất: 0%, 5%, 10% (thuế suất cơ bản).',
      'Phương pháp tính: khấu trừ thuế và tính trực tiếp.',
      'Đối tượng không chịu thuế: 26 nhóm hàng hóa, dịch vụ theo quy định.',
      'Văn bản hiện hành: Luật số 13/2008/QH12 và các văn bản sửa đổi, bổ sung.',
    ],
    audience: [
      { icon: 'building', title: 'Doanh nghiệp sản xuất, kinh doanh',  desc: 'Áp dụng cho tất cả doanh nghiệp có hoạt động sản xuất, kinh doanh hàng hóa, dịch vụ chịu thuế GTGT.' },
      { icon: 'user-tie', title: 'Hộ kinh doanh cá thể',               desc: 'Hộ kinh doanh có doanh thu từ 100 triệu đồng/năm trở lên phải nộp thuế GTGT.' },
      { icon: 'ship',     title: 'Tổ chức, cá nhân nhập khẩu',         desc: 'Tổ chức, cá nhân nhập khẩu hàng hóa chịu thuế GTGT phải kê khai và nộp thuế GTGT hàng nhập khẩu.' },
    ],
  },
  tncn: {
    title:       'Thuế Thu Nhập Cá Nhân',
    short:       'Thuế TNCN',
    description: 'Tổng hợp các văn bản pháp luật về thuế thu nhập cá nhân (TNCN), bao gồm Luật, Nghị định, Thông tư và các hướng dẫn liên quan.',
    overview: [
      'Thuế thu nhập cá nhân là thuế đánh vào thu nhập của cá nhân phát sinh trong kỳ tính thuế.',
      'Đối tượng nộp thuế: cá nhân cư trú và cá nhân không cư trú có thu nhập chịu thuế.',
      'Biểu thuế lũy tiến từng phần: 7 bậc thuế từ 5% đến 35%.',
      'Mức giảm trừ gia cảnh: 11 triệu đồng/tháng đối với người nộp thuế.',
      'Các khoản thu nhập được miễn thuế theo quy định của pháp luật.',
      'Văn bản hiện hành: Luật số 04/2007/QH12 và các văn bản sửa đổi, bổ sung.',
    ],
    audience: [
      { icon: 'user-tie',  title: 'Người lao động làm công hưởng lương',          desc: 'Thu nhập từ tiền lương, tiền công và các khoản thu nhập tương tự phải kê khai và nộp thuế TNCN.' },
      { icon: 'chart-pie', title: 'Cá nhân kinh doanh',                            desc: 'Cá nhân sản xuất, kinh doanh hàng hóa, dịch vụ thuộc đối tượng nộp thuế TNCN theo quy định.' },
      { icon: 'home',      title: 'Cá nhân có thu nhập từ đầu tư, chuyển nhượng', desc: 'Thu nhập từ đầu tư vốn, chuyển nhượng bất động sản, chuyển nhượng vốn và các khoản thu nhập khác.' },
    ],
  },
  tndn: {
    title:       'Thuế Thu Nhập Doanh Nghiệp',
    short:       'Thuế TNDN',
    description: 'Tổng hợp các văn bản pháp luật về thuế thu nhập doanh nghiệp (TNDN), bao gồm Luật, Nghị định, Thông tư và các hướng dẫn liên quan.',
    overview: [
      'Thuế thu nhập doanh nghiệp là thuế đánh trên thu nhập chịu thuế của doanh nghiệp.',
      'Thu nhập chịu thuế bao gồm thu nhập từ hoạt động sản xuất, kinh doanh và thu nhập khác.',
      'Thuế suất phổ thông: 20% (áp dụng cho hầu hết doanh nghiệp).',
      'Ưu đãi thuế TNDN cho doanh nghiệp trong các lĩnh vực, địa bàn ưu đãi đầu tư.',
      'Các khoản chi phí được trừ và không được trừ khi tính thuế.',
      'Văn bản hiện hành: Luật số 14/2008/QH12 và các văn bản sửa đổi, bổ sung.',
    ],
    audience: [
      { icon: 'building', title: 'Doanh nghiệp trong nước',                         desc: 'Mọi doanh nghiệp Việt Nam thuộc mọi thành phần kinh tế đều thuộc đối tượng nộp thuế TNDN.' },
      { icon: 'globe',    title: 'Doanh nghiệp có vốn đầu tư nước ngoài',           desc: 'Doanh nghiệp FDI hoạt động tại Việt Nam chịu thuế TNDN theo quy định, bao gồm cả các ưu đãi đầu tư.' },
      { icon: 'landmark', title: 'Tổ chức khác có hoạt động sản xuất, kinh doanh', desc: 'Các tổ chức khác ngoài doanh nghiệp có hoạt động sản xuất, kinh doanh hàng hóa, dịch vụ chịu thuế TNDN.' },
    ],
  },
  bhxh: {
    title:       'Bảo Hiểm Xã Hội',
    short:       'BHXH',
    description: 'Tổng hợp các văn bản pháp luật về bảo hiểm xã hội (BHXH), bảo hiểm y tế (BHYT) và bảo hiểm thất nghiệp (BHTN).',
    overview: [
      'Bảo hiểm xã hội là sự bảo đảm thay thế hoặc bù đắp một phần thu nhập cho người lao động.',
      'Các chế độ BHXH bắt buộc: ốm đau, thai sản, tai nạn lao động, hưu trí, tử tuất.',
      'Mức đóng BHXH bắt buộc: 32% (21.5% từ người sử dụng lao động, 10.5% từ người lao động).',
      'Bảo hiểm y tế: mức đóng 4.5% (3% từ người sử dụng lao động, 1.5% từ người lao động).',
      'Bảo hiểm thất nghiệp: mức đóng 2% (1% từ người sử dụng lao động, 1% từ người lao động).',
      'Văn bản hiện hành: Luật BHXH số 58/2014/QH13 và Luật sửa đổi số 28/2024/QH15.',
    ],
    audience: [
      { icon: 'users',              title: 'Người lao động',                  desc: 'Người lao động làm việc theo hợp đồng lao động từ đủ 01 tháng trở lên thuộc đối tượng tham gia BHXH bắt buộc.' },
      { icon: 'building',           title: 'Người sử dụng lao động',          desc: 'Doanh nghiệp, cơ quan, tổ chức, hợp tác xã, hộ kinh doanh có thuê mướn lao động.' },
      { icon: 'hand-holding-heart', title: 'Người tham gia BHXH tự nguyện',  desc: 'Công dân Việt Nam từ đủ 15 tuổi trở lên không thuộc đối tượng tham gia BHXH bắt buộc có thể tham gia BHXH tự nguyện.' },
    ],
  },
};

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

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

/**
 * Phát hiện loại văn bản từ số hiệu.
 * Ví dụ: "163/2017/NĐ-CP" → "Nghị định", "13/2008/QH12" → "Luật"
 */
function detectDocType(code) {
  if (!code) return 'Khác';
  if (/\/NĐ-|\/ND-/i.test(code))          return 'Nghị định';
  if (/\/TT-|\/TT$/i.test(code))           return 'Thông tư';
  if (/\/QH\d+$/i.test(code))              return 'Luật';
  if (/\/QĐ-|\/QD-/i.test(code))          return 'Quyết định';
  if (/\/CT-/i.test(code))                 return 'Chỉ thị';
  // Công văn thường có dạng "1234/BTC-CST" (không có năm ở giữa)
  if (/^\d+\/[A-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠƯẠ-]+/i.test(code)) return 'Công văn';
  return 'Khác';
}

/**
 * Lấy năm ban hành: ưu tiên từ created_at, fallback từ số hiệu.
 */
function detectYear(doc) {
  if (doc.created_at) return new Date(doc.created_at).getFullYear();
  const m = (doc.code || '').match(/\/(\d{4})\//);
  return m ? parseInt(m[1]) : null;
}

/** Trả về true nếu văn bản được cập nhật trong vòng 30 ngày. */
function isNew(created_at) {
  if (!created_at) return false;
  return Date.now() - new Date(created_at).getTime() < 30 * 24 * 60 * 60 * 1000;
}

/** Format ngày theo vi-VN, trả về '' nếu không có. */
function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('vi-VN');
}

// ── Sidebar carousel ─────────────────────────────────────────────────────────

/**
 * Render sidebar: carousel nếu ≥ 3 docs, list tĩnh nếu 1-2, empty nếu 0.
 * Dùng 3 docs mới nhất (API đã sort created_at DESC nên lấy slice(0,3)).
 */
function renderSidebar(docs) {
  const container = document.getElementById('sidebar-content');

  if (!docs.length) {
    container.innerHTML = '<p class="sb-state">Chưa có văn bản.</p>';
    return;
  }

  const recent = docs.slice(0, 3);

  if (recent.length < 3) {
    // Static list
    const items = recent.map(d => `
      <li class="sb-static-item" onclick="document.getElementById('documents-section').scrollIntoView({behavior:'smooth'})"
          style="cursor:pointer" title="${esc(d.title)}">
        <i class="fas fa-file-alt sb-static-item__icon"></i>
        <span class="sb-static-item__code">${esc(d.code)}</span>
        <span class="sb-static-item__title">${esc(d.title)}</span>
        ${isNew(d.created_at) ? '<span class="badge-new">MỚI</span>' : ''}
      </li>`).join('');
    container.innerHTML = `<ul class="sb-static-list">${items}</ul>`;
    return;
  }

  // Carousel với 3 slides
  const slides = recent.map((d, i) => `
    <div class="carousel-item ${i === 0 ? 'active' : ''}"
         onclick="document.getElementById('documents-section').scrollIntoView({behavior:'smooth'})"
         title="${esc(d.title)}">
      <div class="sb-slide">
        <div class="sb-slide__code">
          ${esc(d.code)}
          ${isNew(d.created_at) ? '<span class="badge-new">MỚI</span>' : ''}
        </div>
        <div class="sb-slide__title">${esc(d.title)}</div>
        ${d.created_at ? `<div class="sb-slide__date"><i class="fas fa-calendar-alt me-1"></i>${esc(formatDate(d.created_at))}</div>` : ''}
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

  // Dừng auto-play khi hover/focus
  const carouselEl = document.getElementById('sidebar-carousel');
  const bsCarousel = bootstrap.Carousel.getOrCreateInstance(carouselEl);
  carouselEl.addEventListener('mouseenter', () => bsCarousel.pause());
  carouselEl.addEventListener('focusin',    () => bsCarousel.pause());
  carouselEl.addEventListener('mouseleave', () => bsCarousel.cycle());
  carouselEl.addEventListener('focusout',   () => bsCarousel.cycle());
}

// ── Grid + Filter + Pagination ────────────────────────────────────────────────

/** Trạng thái bộ lọc & phân trang (module-level state). */
const state = {
  allDocs:    [],   // toàn bộ docs từ API
  filtered:   [],   // docs sau khi lọc
  page:       1,    // trang hiện tại (mỗi trang PAGE_SIZE docs)
};

/** Đọc giá trị hiện tại của các bộ lọc. */
function getFilters() {
  return {
    type:   document.getElementById('filter-type').value,
    year:   document.getElementById('filter-year').value,
    status: document.getElementById('filter-status').value,
    search: document.getElementById('filter-search').value.trim().toLowerCase(),
  };
}

/** Áp dụng bộ lọc lên allDocs, cập nhật state.filtered và re-render grid. */
function applyFilters() {
  const f = getFilters();

  state.filtered = state.allDocs.filter(d => {
    if (f.type   && detectDocType(d.code) !== f.type)              return false;
    if (f.year   && String(detectYear(d)) !== f.year)              return false;
    // Status: chỉ lọc nếu doc có trường status; nếu không có thì hiện tất cả
    if (f.status && d.status && d.status !== f.status)             return false;
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

/** Hiển thị PAGE_SIZE * page đầu tiên của state.filtered. */
function renderGridPage() {
  const grid     = document.getElementById('documents-grid');
  const loadMore = document.getElementById('load-more-wrap');
  const visible  = state.filtered.slice(0, state.page * PAGE_SIZE);

  if (!state.filtered.length) {
    grid.innerHTML = '<div class="col-12"><p class="text-muted text-center py-4">Không tìm thấy văn bản phù hợp.</p></div>';
    loadMore.style.display = 'none';
    return;
  }

  grid.innerHTML = visible.map((d, i) => {
    const type      = detectDocType(d.code);
    const dateStr   = formatDate(d.created_at);
    const statusBadge = renderStatusBadge(d.status);

    return `
      <div class="item col-12 col-md-6 col-lg-4">
        <div class="item-inner p-3 p-lg-4">
          <div class="item-header mb-3">
            <div class="item-icon"><i class="fas fa-${ICONS[i % ICONS.length]}"></i></div>
            <h3 class="item-heading">${esc(d.code || '—')}</h3>
          </div>
          <div class="item-desc">${esc(d.title)}</div>
          <div class="doc-card__meta">
            ${type     ? `<span><i class="fas fa-tag me-1"></i>${esc(type)}</span>` : ''}
            ${dateStr  ? `<span class="ms-2"><i class="fas fa-calendar-alt me-1"></i>${esc(dateStr)}</span>` : ''}
            ${statusBadge ? `<div class="mt-1">${statusBadge}</div>` : ''}
          </div>
          ${renderFileButtons(d.file)}
        </div>
      </div>`;
  }).join('');

  // Hiện/ẩn nút "Xem thêm"
  loadMore.style.display = visible.length < state.filtered.length ? 'block' : 'none';
}

/** Badge trạng thái hiệu lực (chỉ render khi doc có trường status). */
function renderStatusBadge(status) {
  const map = {
    active:   ['badge-status--active',   'Còn hiệu lực'],
    inactive: ['badge-status--inactive', 'Hết hiệu lực'],
    amended:  ['badge-status--amended',  'Sửa đổi bổ sung'],
  };
  if (!status || !map[status]) return '';
  const [cls, label] = map[status];
  return `<span class="badge-status ${cls}">${label}</span>`;
}

/** Nút "Xem online" / "Tải xuống". */
function renderFileButtons(file) {
  if (!file?.drive_view_url) return '';
  const viewBtn = `
    <a href="${esc(file.drive_view_url)}" class="btn btn-sm btn-outline-primary"
       target="_blank" rel="noopener">
      <i class="fas fa-eye me-1"></i>Xem online
    </a>`;
  const downloadBtn = file.drive_download_url ? `
    <a href="${esc(file.drive_download_url)}" class="btn btn-sm btn-outline-secondary"
       target="_blank" rel="noopener">
      <i class="fas fa-download me-1"></i>Tải xuống
    </a>` : '';
  return `<div class="doc-card__actions">${viewBtn}${downloadBtn}</div>`;
}

/** Cập nhật dòng đếm kết quả lọc. */
function updateFilterCount() {
  const el    = document.getElementById('filter-count');
  const total = state.allDocs.length;
  const shown = state.filtered.length;
  el.textContent = shown < total
    ? `Hiển thị ${shown} / ${total} văn bản`
    : `${total} văn bản`;
}

/** Populate dropdown năm ban hành từ dữ liệu thực. */
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

// ── Metadata tĩnh ─────────────────────────────────────────────────────────────

function renderCategoryMeta(info) {
  document.title = `NotDore – ${info.short}`;
  document.querySelector('meta[name="description"]')
    .setAttribute('content', `Danh mục ${info.short}: ${info.description}`);

  document.getElementById('category-title').textContent    = info.title;
  document.getElementById('category-desc').textContent     = info.description;
  document.getElementById('documents-heading').textContent = `VĂN BẢN ${info.short.toUpperCase()}`;

  document.getElementById('overview-list').innerHTML = info.overview
    .map(p => `<li><i class="fas fa-check-circle me-2"></i>${esc(p)}</li>`)
    .join('');

  document.getElementById('audience-intro').textContent =
    `${info.title} áp dụng cho các đối tượng theo quy định của pháp luật.`;

  document.getElementById('audience-list').innerHTML = info.audience.map(a => `
    <div class="item row gx-3">
      <div class="col-auto item-icon"><i class="fas fa-${esc(a.icon)}"></i></div>
      <div class="col">
        <h4 class="item-title">${esc(a.title)}</h4>
        <div class="item-desc">${esc(a.desc)}</div>
      </div>
    </div>`).join('');
}

function renderError(message) {
  document.getElementById('sidebar-content').innerHTML =
    `<p class="sb-state sb-state--error"><i class="fas fa-exclamation-circle me-1"></i>Không thể tải dữ liệu.</p>`;

  const loadingEl = document.getElementById('docs-loading');
  if (loadingEl) loadingEl.remove();

  document.getElementById('documents-grid').innerHTML = `
    <div class="col-12">
      <div class="alert alert-danger" role="alert">
        <i class="fas fa-exclamation-triangle me-2"></i>
        <strong>Không thể tải danh sách văn bản.</strong>
        ${esc(message)}
        Vui lòng thử lại sau hoặc <a href="index.html">quay về trang chủ</a>.
      </div>
    </div>`;
}

// ── Khởi chạy ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  const cat = getQueryParam('cat');
  if (!cat || !CATEGORY_INFO[cat]) {
    window.location.href = 'index.html';
    return;
  }

  renderCategoryMeta(CATEGORY_INFO[cat]);

  try {
    const res  = await fetch(`/api/category?cat=${encodeURIComponent(cat)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lỗi không xác định từ máy chủ.');

    const docs = data.docs || [];

    // Xóa loading indicator
    const loadingEl = document.getElementById('docs-loading');
    if (loadingEl) loadingEl.remove();

    // ── Sidebar ───────────────────────────────────────────────────
    renderSidebar(docs);

    // ── Grid ──────────────────────────────────────────────────────
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
