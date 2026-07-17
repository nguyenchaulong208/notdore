/**
 * assets/js/category.js — Logic trang danh mục văn bản
 *
 * Đọc ?cat= từ URL, tải dữ liệu từ /api/category, rồi render
 * sidebar và grid. Nội dung tĩnh của từng danh mục (tiêu đề,
 * tổng quan, đối tượng) được định nghĩa trong CATEGORY_INFO.
 */

// ── Hằng số ───────────────────────────────────────────────────────────────────

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

/** Escape HTML để chống XSS khi inject dữ liệu vào innerHTML */
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Đọc query parameter từ URL hiện tại */
function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

// ── Render functions ──────────────────────────────────────────────────────────

/** Hiển thị danh sách rút gọn trong sidebar (tối đa 6 mục) */
function renderSidebar(docs) {
  const el = document.getElementById('sidebar-list');
  if (!docs.length) {
    el.innerHTML = '<li class="sidebar-item sidebar-item--empty">Chưa có văn bản.</li>';
    return;
  }
  el.innerHTML = docs.slice(0, 6).map(d => `
    <li class="sidebar-item">
      <i class="fas fa-file-alt sidebar-item__icon"></i>
      <span class="sidebar-item__code">${esc(d.code)}</span>
      <span class="sidebar-item__title">${esc(d.title)}</span>
    </li>
  `).join('');
}

/** Tạo nút "Xem online" và "Tải xuống" nếu có file */
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
  return `<div class="doc-card__actions mt-2">${viewBtn}${downloadBtn}</div>`;
}

/** Hiển thị lưới văn bản */
function renderGrid(docs) {
  const el = document.getElementById('documents-grid');
  if (!docs.length) {
    el.innerHTML = '<div class="col-12"><p class="text-muted text-center py-4">Chưa có văn bản nào trong danh mục này.</p></div>';
    return;
  }
  el.innerHTML = docs.map((d, i) => `
    <div class="item col-12 col-md-6 col-lg-4">
      <div class="item-inner p-3 p-lg-4">
        <div class="item-header mb-3">
          <div class="item-icon"><i class="fas fa-${ICONS[i % ICONS.length]}"></i></div>
          <h3 class="item-heading">${esc(d.code || '—')}</h3>
        </div>
        <div class="item-desc">${esc(d.title)}</div>
        ${d.created_at ? `<div class="doc-card__date">${esc(new Date(d.created_at).toLocaleDateString('vi-VN'))}</div>` : ''}
        ${renderFileButtons(d.file)}
      </div>
    </div>
  `).join('');
}

/** Hiển thị thông báo lỗi khi không tải được dữ liệu */
function renderError(message) {
  document.getElementById('sidebar-list').innerHTML = `
    <li class="sidebar-item sidebar-item--error">
      <i class="fas fa-exclamation-circle me-1"></i>Không thể tải dữ liệu.
    </li>`;

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

/** Điền nội dung tĩnh của danh mục vào trang */
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
    </div>
  `).join('');
}

// ── Khởi chạy ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  const cat = getQueryParam('cat');

  // Redirect về trang chủ nếu cat không hợp lệ
  if (!cat || !CATEGORY_INFO[cat]) {
    window.location.href = 'index.html';
    return;
  }

  const info = CATEGORY_INFO[cat];
  renderCategoryMeta(info);

  try {
    const res  = await fetch(`/api/category?cat=${encodeURIComponent(cat)}`);
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Lỗi không xác định từ máy chủ.');

    const loadingEl = document.getElementById('docs-loading');
    if (loadingEl) loadingEl.remove();

    renderSidebar(data.docs || []);
    renderGrid(data.docs || []);

  } catch (err) {
    console.error('[NotDore] Fetch error:', err);
    renderError(err.message);
  }
});
