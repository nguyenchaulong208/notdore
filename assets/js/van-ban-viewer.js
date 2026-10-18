// assets/js/van-ban-viewer.js — Trang xem văn bản nhúng (xem-van-ban.html)
// Hiển thị PDF trong trang con của NotDore thay vì chuyển hướng sang Google Drive.
// Dùng: xem-van-ban.html?id=<document_id>
//   hoặc: xem-van-ban.html?url=<đường_dẫn_tài_liệu>

const viewerEls = () => ({
  state:   document.getElementById('doc-viewer-state'),
  box:     document.getElementById('doc-viewer'),
  title:   document.getElementById('doc-viewer-title'),
  meta:    document.getElementById('doc-viewer-meta'),
  toolbar: document.getElementById('doc-viewer-toolbar'),
  frame:   document.getElementById('doc-viewer-frame'),
});

function showViewerError(message) {
  const { state } = viewerEls();
  if (!state) return;
  state.innerHTML = `<div class="alert alert-danger mb-0" role="alert">
    <i class="fas fa-exclamation-triangle me-2"></i>${esc(message)}</div>`;
}

function renderViewer(doc, directUrl) {
  const { state, box, title, meta, toolbar, frame } = viewerEls();

  const viewUrl     = directUrl || doc?.file?.drive_view_url || '';
  const embedUrl    = toDrivePreviewUrl(viewUrl);
  const downloadUrl = doc?.file?.drive_download_url || '';

  const heading = directUrl ? 'Tài liệu' : (doc?.title || 'Văn bản');
  document.title = `${heading} - NotDore`;
  title.textContent = heading;

  const metaParts = [];
  if (doc?.code)          metaParts.push(`<span class="doc-viewer-code">${esc(doc.code)}</span>`);
  if (doc?.loai_van_ban)  metaParts.push(`<span>${esc(doc.loai_van_ban)}</span>`);
  if (doc?.issued_date)   metaParts.push(`<span>Ban hành: ${esc(formatDate(doc.issued_date))}</span>`);
  const status = doc ? renderStatusBadge(doc.status) : '';
  if (status)             metaParts.push(status);
  meta.innerHTML = metaParts.join('<span>•</span>');

  const actions = [];
  if (viewUrl)     actions.push(`<a class="btn btn-secondary btn-sm" href="${esc(viewUrl)}" target="_blank" rel="noopener"><i class="fas fa-external-link-alt me-1"></i>Mở trong Google Drive</a>`);
  if (downloadUrl) actions.push(`<a class="btn btn-primary btn-sm" href="${esc(downloadUrl)}" target="_blank" rel="noopener"><i class="fas fa-download me-1"></i>Tải xuống</a>`);
  if (actions.length) {
    toolbar.innerHTML = actions.join('');
  } else {
    toolbar.remove();
  }

  frame.innerHTML = isHttp(embedUrl)
    ? `<iframe src="${esc(embedUrl)}" title="${esc(heading)}" loading="lazy" allowfullscreen></iframe>`
    : '<p class="text-muted p-4 mb-0">Không có tệp để hiển thị.</p>';

  state?.classList.add('d-none');
  box?.classList.remove('d-none');
}

document.addEventListener('DOMContentLoaded', async () => {
  const params    = new URLSearchParams(location.search);
  const id        = params.get('id');
  const directUrl = params.get('url');

  // Ưu tiên URL trực tiếp (nếu có) — không cần gọi API
  if (directUrl) {
    if (!isHttp(directUrl)) {
      showViewerError('Đường dẫn tài liệu không hợp lệ.');
      return;
    }
    renderViewer(null, directUrl);
    return;
  }

  if (!id) {
    showViewerError('Thiếu thông tin văn bản cần xem.');
    return;
  }

  try {
    const res  = await fetch('/api/documents');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lỗi không xác định từ máy chủ.');

    const doc = (data.docs || []).find(d => String(d.id) === String(id));
    if (!doc) {
      showViewerError('Không tìm thấy văn bản này.');
      return;
    }
    if (!doc.file?.drive_view_url) {
      showViewerError('Văn bản này chưa có tệp để xem.');
      return;
    }
    renderViewer(doc);
  } catch (err) {
    console.error('[viewer] Fetch error:', err);
    showViewerError('Không thể tải văn bản. Vui lòng thử lại sau.');
  }
});
