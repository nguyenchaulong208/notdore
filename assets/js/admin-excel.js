/**
 * assets/js/admin-excel.js
 * Đọc/ghi file Excel (.xlsx): import hàng loạt, sinh file template, và bảng
 * preview dùng chung cho panel "single" + "bulk".
 * Cần: admin-constants.js (TAGS, STATUS_LABEL, TEMPLATE_COLUMNS),
 *      admin-parsers.js (normalizeDriveType, resolveDriveFileId, normalizeMime).
 * Cần thư viện ngoài SheetJS (biến global XLSX) load trước file này.
 */

// ── Excel (.xlsx) ─────────────────────────────────────────────────────────────
function parseXlsxWorkbook(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  // defval: '' → ô trống vẫn có key với giá trị rỗng thay vì bị bỏ qua
  // raw: false → ngày tháng/số được convert về string hiển thị thay vì serial number
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
  return rows;
}

/** Chuẩn hoá 1 dòng dữ liệu (đến từ Excel) thành object dùng để sinh SQL */
function normalizeRow(row) {
  const tagStr = String(row.tags ?? '').trim();
  const tagKeys = tagStr ? tagStr.split(';').map(t => t.trim()).filter(Boolean) : [];
  const viewUrl = String(row.drive_view_url ?? '').trim();
  const downloadUrl = String(row.drive_download_url ?? '').trim();

  return {
    title:              String(row.title ?? '').trim(),
    code:               String(row.code ?? '').trim(),
    description:        String(row.description ?? '').trim(),
    issued_date:        String(row.issued_date ?? '').trim(),
    expiry_date:        String(row.expiry_date ?? '').trim(),
    status:             String(row.status ?? '').trim() || 'hieu_luc',
    tagKeys,
    drive_type:         normalizeDriveType(row.drive_type),
    drive_file_id:      resolveDriveFileId(row.drive_file_id, viewUrl, downloadUrl),
    drive_view_url:     viewUrl,
    drive_download_url: downloadUrl,
    mime_type:          normalizeMime(row.mime_type),
    file_size:          String(row.file_size ?? '').trim(),
    content:            String(row.content ?? '').trim(),
  };
}

function rowToTagNames(tagKeys) {
  return tagKeys.map(k => {
    const found = TAGS.find(t => t.key === k || t.name === k);
    return found ? found.name : k;
  });
}

/**
 * Render bảng preview dùng chung cho cả panel "bulk" và panel "single".
 * @param {Array} rows - danh sách record (đã normalize, có tagKeys)
 * @param {string} tbodyId - id của <tbody> để render vào
 * @param {Function} [onRemove] - callback(index) khi bấm nút xoá dòng
 */
function renderPreview(rows, tbodyId, onRemove) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;

  tbody.innerHTML = rows.map((r, i) => {
    const statusCls = `status-${r.status}`;
    const tagBadges = r.tagKeys.map(k => {
      const t = TAGS.find(x => x.key === k || x.name === k);
      return `<span class="badge bg-secondary me-1" style="font-size:10px">${t?.label || k}</span>`;
    }).join('');
    const fileInfo = r.drive_file_id
      ? `<span class="badge bg-info text-dark" style="font-size:10px">${r.drive_type}</span>`
      : '—';
    const textInfo = r.content ? '📝' : '—';
    const removeBtn = onRemove
      ? `<button type="button" class="btn btn-sm btn-outline-danger" data-remove-idx="${i}">✕</button>`
      : '';

    return `<tr>
      <td class="text-muted">${i + 1}</td>
      <td><strong>${r.code || '—'}</strong></td>
      <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${r.title}">${r.title}</td>
      <td>${r.issued_date || '—'}</td>
      <td>${r.expiry_date || '—'}</td>
      <td><span class="status-badge ${statusCls}">${STATUS_LABEL[r.status] || r.status}</span></td>
      <td>${tagBadges || '—'}</td>
      <td class="text-center">${fileInfo}</td>
      <td class="text-center">${textInfo}</td>
      <td class="text-center">${removeBtn}</td>
    </tr>`;
  }).join('');

  if (onRemove) {
    tbody.querySelectorAll('[data-remove-idx]').forEach(btn => {
      btn.addEventListener('click', () => onRemove(parseInt(btn.dataset.removeIdx, 10)));
    });
  }
}

// ── Template Excel (download) ──────────────────────────────────────────────────
function buildTemplateWorkbook(withSample) {
  const wb = XLSX.utils.book_new();

  const sampleRows = withSample ? [
    {
      title: 'Nghị định 163/2017/NĐ-CP Quy định về kinh doanh dịch vụ Logistics',
      code: '163/2017/NĐ-CP',
      description: 'Quy định điều kiện kinh doanh dịch vụ logistics',
      issued_date: '2017-12-19',
      expiry_date: '',
      status: 'hieu_luc',
      tags: 'vat',
      drive_type: 'google',
      drive_file_id: '1abcExampleFileId',
      drive_view_url: 'https://drive.google.com/file/d/1abcExampleFileId/view',
      drive_download_url: 'https://drive.google.com/uc?id=1abcExampleFileId&export=download',
      mime_type: 'pdf',
      file_size: '',
      content: '',
    },
    {
      title: 'Thông tư 32/2017/TT-BTC hướng dẫn về hóa đơn điện tử',
      code: '32/2017/TT-BTC',
      description: 'Hướng dẫn thực hiện hóa đơn điện tử',
      issued_date: '2017-04-06',
      expiry_date: '',
      status: 'hieu_luc',
      tags: 'vat;ke-toan',
      drive_type: '', drive_file_id: '', drive_view_url: '', drive_download_url: '',
      mime_type: 'pdf', file_size: '', content: '',
    },
  ] : [];

  // Luôn có ít nhất 1 dòng để sheet có header đúng thứ tự cột;
  // nếu không có sample, tạo sheet chỉ với header rỗng.
  const sheet = sampleRows.length
    ? XLSX.utils.json_to_sheet(sampleRows, { header: TEMPLATE_COLUMNS })
    : XLSX.utils.aoa_to_sheet([TEMPLATE_COLUMNS]);

  XLSX.utils.book_append_sheet(wb, sheet, 'Template');
  return wb;
}

function downloadTemplateXlsx(withSample) {
  const wb = buildTemplateWorkbook(withSample);
  const filename = withSample ? 'notdore_sample.xlsx' : 'notdore_template.xlsx';
  XLSX.writeFile(wb, filename);
}
