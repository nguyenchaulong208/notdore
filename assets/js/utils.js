// assets/js/utils.js — Tiện ích dùng chung, load trước các script trang.

/** Escape HTML để chống XSS */
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Format ngày theo vi-VN, trả về '' nếu không có */
const formatDate = (d) => d ? new Date(d).toLocaleDateString('vi-VN') : '';

/** Lấy năm ban hành từ record văn bản */
const detectYear = (doc) => {
  if (doc.issued_date) return new Date(doc.issued_date).getFullYear();
  if (doc.created_at)  return new Date(doc.created_at).getFullYear();
  const m = (doc.code || '').match(/\/(\d{4})\//);
  return m ? parseInt(m[1]) : null;
};

/** Kiểm tra URL có dùng http/https */
const isHttp = (u) => { try { return ['http:', 'https:'].includes(new URL(u).protocol); } catch { return false; } };

/** Kiểm tra link có phải YouTube embed */
const isYouTube = (l) => {
  if (l.source?.source_type !== 'video' || !isHttp(l.url)) return false;
  const u = new URL(l.url);
  return ['www.youtube.com', 'youtube.com', 'www.youtube-nocookie.com'].includes(u.hostname)
    && u.pathname.startsWith('/embed/');
};

/** Render badge trạng thái hiệu lực */
const renderStatusBadge = (status) => {
  const map = {
    hieu_luc:      ['badge-status--active',   'Còn hiệu lực'],
    het_hieu_luc:  ['badge-status--inactive', 'Hết hiệu lực'],
    chua_hieu_luc: ['badge-status--amended',  'Chưa có hiệu lực'],
  };
  if (!status || !map[status]) return '';
  const [cls, label] = map[status];
  return `<span class="badge-status ${cls}">${label}</span>`;
};

/** Điền dropdown năm ban hành từ danh sách văn bản */
const populateYearFilter = (docs) => {
  const years = [...new Set(docs.map(detectYear).filter(Boolean))].sort((a, b) => b - a);
  const sel = document.getElementById('filter-year');
  years.forEach(y => {
    const opt = document.createElement('option');
    opt.value = opt.textContent = String(y);
    sel.appendChild(opt);
  });
};

/**
 * Gắn carousel Bootstrap (hoặc list tĩnh nếu < 3 phần tử) vào `container` (Element).
 * @param {Element} container     - Element chứa nội dung sidebar
 * @param {Array}   items         - Danh sách văn bản cần hiển thị
 * @param {string}  scrollTarget  - ID element sẽ được scroll đến khi click
 * @param {Function} getBadge     - Hàm nhận doc, trả về HTML badge (mặc định rỗng)
 */
const mountCarousel = (container, items, scrollTarget, getBadge = () => '') => {
  const onclick = `document.getElementById('${scrollTarget}').scrollIntoView({behavior:'smooth'})`;

  if (items.length < 3) {
    container.innerHTML = `<ul class="sb-static-list">${items.map(d => `
      <li class="sb-static-item" onclick="${onclick}" style="cursor:pointer" title="${esc(d.title)}">
        <i class="fas fa-file-alt sb-static-item__icon"></i>
        <span class="sb-static-item__code">${esc(d.code)}</span>
        <span class="sb-static-item__title">${esc(d.title)}</span>
        ${getBadge(d)}
      </li>`).join('')}</ul>`;
    return;
  }

  const slides = items.map((d, i) => `
    <div class="carousel-item ${i === 0 ? 'active' : ''}" onclick="${onclick}" title="${esc(d.title)}">
      <div class="sb-slide">
        <div class="sb-slide__code">${esc(d.code)} ${getBadge(d)}</div>
        <div class="sb-slide__title">${esc(d.title)}</div>
        <div class="sb-slide__date"><i class="fas fa-calendar-alt me-1"></i>Ban hành: ${esc(formatDate(d.issued_date))}</div>
      </div>
    </div>`).join('');

  const indicators = items.map((_, i) => `
    <button type="button" data-bs-target="#sidebar-carousel" data-bs-slide-to="${i}"
      ${i === 0 ? 'class="active" aria-current="true"' : ''} aria-label="Văn bản ${i + 1}"></button>`).join('');

  container.innerHTML = `
    <div id="sidebar-carousel" class="carousel slide" data-bs-ride="carousel" data-bs-interval="4000">
      <div class="carousel-inner">${slides}</div>
      <div class="carousel-indicators">${indicators}</div>
    </div>`;

  const el = document.getElementById('sidebar-carousel');
  const bs = bootstrap.Carousel.getOrCreateInstance(el);
  el.addEventListener('mouseenter', () => bs.pause());
  el.addEventListener('focusin',    () => bs.pause());
  el.addEventListener('mouseleave', () => bs.cycle());
  el.addEventListener('focusout',   () => bs.cycle());
};
