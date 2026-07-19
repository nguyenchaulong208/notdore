/**
 * assets/js/admin.js
 * Admin Tool — sinh SQL INSERT offline (không cần server/Supabase)
 *
 * Schema: integer SERIAL id, document_files (drive_type, drive_file_id),
 *         document_texts (content), document_tag_map (composite PK)
 *
 * ⚠ THAY ĐỔI SO VỚI BẢN CŨ:
 *   1. File import giờ là .xlsx (không còn CSV phân cách bằng dấu phẩy).
 *      → Cần thêm SheetJS vào HTML trước file này:
 *        <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
 *   2. Panel "Nhập văn bản đơn lẻ" giờ cho phép thêm NHIỀU record vào một
 *      danh sách tạm (giống bảng preview), rồi mới bấm "Xác nhận & Sinh SQL"
 *      một lần cho tất cả. Cần thêm các phần tử HTML mới (xem mục
 *      "HTML CẦN THÊM" ở cuối file này).
 *   3. input file / drop-zone giờ nhận .xlsx thay vì .csv, và không còn ô
 *      "paste CSV" (vì file xlsx là nhị phân, không thể paste dạng text).
 */

const TAGS = [
  { key: 'vat',      name: 'thue-gtgt',      label: 'Thuế GTGT' },
  { key: 'tncn',     name: 'thue-tncn',      label: 'Thuế TNCN' },
  { key: 'tndn',     name: 'thue-tndn',      label: 'Thuế TNDN' },
  { key: 'bhxh',     name: 'bhxh',           label: 'BHXH' },
  { key: 'ke-toan',  name: 'ke-toan',        label: 'Kế toán' },
  { key: 'hai-quan', name: 'hai-quan',       label: 'Hải quan' },
  { key: 'xnk',      name: 'xuat-nhap-khau', label: 'Xuất nhập khẩu' },
];

const STATUS_LABEL = {
  hieu_luc:      'Còn hiệu lực',
  het_hieu_luc:  'Hết hiệu lực',
  chua_hieu_luc: 'Chưa có hiệu lực',
};

const MIME_SHORT = {
  pdf:  'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  doc:  'application/msword',
};

// Mỗi phần tử ứng với đúng 1 cột trong file Excel import/template.
// Thứ tự này quyết định thứ tự cột khi sinh file template.
const TEMPLATE_COLUMNS = [
  'title', 'code', 'description', 'issued_date', 'expiry_date', 'status', 'tags',
  'drive_type', 'drive_file_id', 'drive_view_url', 'drive_download_url',
  'mime_type', 'file_size', 'content',
];

let parsedRows = [];   // dữ liệu từ file xlsx import hàng loạt (panel "bulk")
let singleEntries = []; // danh sách record được thêm thủ công (panel "single")
let toolEntries = [];   // catalog tools chờ sinh SQL (panel "tools")

// ── SQL helpers ───────────────────────────────────────────────────────────────
function escSql(str) {
  if (str === null || str === undefined || str === '') return 'NULL';
  return `'${String(str).replace(/'/g, "''")}'`;
}

function dateOrNull(val) {
  if (!val || String(val).trim() === '') return 'NULL';
  return escSql(String(val).trim());
}

function intOrNull(val) {
  if (val === null || val === undefined || String(val).trim() === '') return 'NULL';
  const n = parseInt(String(val).trim(), 10);
  return Number.isFinite(n) ? String(n) : 'NULL';
}

/** Trích drive_file_id từ Google Drive URL hoặc trả về chuỗi gốc nếu đã là ID */
function parseDriveFileId(urlOrId) {
  const s = (urlOrId || '').trim();
  if (!s) return '';
  const fromPath = s.match(/\/file\/d\/([^/?#]+)/);
  if (fromPath) return fromPath[1];
  const fromQuery = s.match(/[?&]id=([^&#]+)/);
  if (fromQuery) return fromQuery[1];
  if (!s.includes('://') && /^[\w-]{10,}$/.test(s)) return s;
  return s;
}

function resolveDriveFileId(explicit, viewUrl, downloadUrl) {
  const id = (explicit || '').trim();
  if (id) return id;
  return parseDriveFileId(viewUrl) || parseDriveFileId(downloadUrl) || '';
}

function normalizeMime(raw) {
  const short = (raw || 'pdf').toLowerCase().trim();
  return MIME_SHORT[short] || short;
}

function normalizeDriveType(raw) {
  const t = (raw || 'google').toLowerCase().trim();
  return t === 'onedrive' ? 'onedrive' : 'google';
}

/**
 * Sinh SQL INSERT cho một văn bản (dùng SERIAL id + RETURNING).
 */
function generateSqlForDoc(doc, tagNames) {
  const lines = [];
  const label = doc.code || doc.title;

  lines.push(`-- ───────────────────────────────────────────────────────────`);
  lines.push(`-- Văn bản: ${label}`);
  lines.push(`-- ───────────────────────────────────────────────────────────`);

  lines.push(`WITH ins_doc AS (`);
  lines.push(`  INSERT INTO documents`);
  lines.push(`    (title, code, description, issued_date, expiry_date, status)`);
  lines.push(`  VALUES (`);
  lines.push(`    ${escSql(doc.title)},`);
  lines.push(`    ${doc.code ? escSql(doc.code) : 'NULL'},`);
  lines.push(`    ${doc.description ? escSql(doc.description) : 'NULL'},`);
  lines.push(`    ${dateOrNull(doc.issued_date)},`);
  lines.push(`    ${dateOrNull(doc.expiry_date)},`);
  lines.push(`    ${escSql(doc.status || 'hieu_luc')}`);
  lines.push(`  )`);
  lines.push(`  RETURNING id`);
  lines.push(`)`);

  const driveFileId = resolveDriveFileId(doc.drive_file_id, doc.drive_view_url, doc.drive_download_url);
  const hasFile = !!driveFileId;

  if (hasFile) {
    lines.push(`, ins_file AS (`);
    lines.push(`  INSERT INTO document_files`);
    lines.push(`    (document_id, drive_type, drive_file_id, drive_view_url, drive_download_url, mime_type, size)`);
    lines.push(`  SELECT`);
    lines.push(`    id,`);
    lines.push(`    ${escSql(normalizeDriveType(doc.drive_type))},`);
    lines.push(`    ${escSql(driveFileId)},`);
    lines.push(`    ${doc.drive_view_url ? escSql(doc.drive_view_url) : 'NULL'},`);
    lines.push(`    ${doc.drive_download_url ? escSql(doc.drive_download_url) : 'NULL'},`);
    lines.push(`    ${doc.mime_type ? escSql(doc.mime_type) : 'NULL'},`);
    lines.push(`    ${intOrNull(doc.file_size)}`);
    lines.push(`  FROM ins_doc`);
    lines.push(`)`);
  }

  const hasText = doc.content && String(doc.content).trim();
  if (hasText) {
    lines.push(`, ins_text AS (`);
    lines.push(`  INSERT INTO document_texts (document_id, content)`);
    lines.push(`  SELECT id, ${escSql(doc.content.trim())} FROM ins_doc`);
    lines.push(`)`);
  }

  tagNames.forEach((tagName, i) => {
    lines.push(`, ins_tag_${i} AS (`);
    lines.push(`  INSERT INTO document_tag_map (document_id, tag_id)`);
    lines.push(`  SELECT d.id, t.id`);
    lines.push(`  FROM ins_doc d`);
    lines.push(`  JOIN document_tags t ON t.name = ${escSql(tagName)}`);
    lines.push(`  ON CONFLICT DO NOTHING`);
    lines.push(`)`);
  });

  lines.push(`SELECT 'OK: id=' || id AS result FROM ins_doc;`);
  lines.push('');

  return lines.join('\n');
}

function wrapInTransaction(body) {
  return `BEGIN;\n\n${body}\nCOMMIT;\n`;
}

function buildSqlHeader(count) {
  return [
    `-- =============================================================`,
    `-- NotDore — SQL Script (Admin Tool)`,
    `-- Ngày tạo: ${new Date().toLocaleString('vi-VN')}`,
    `-- Số văn bản: ${count}`,
    `-- Chạy trong: Supabase → SQL Editor`,
    `-- Lưu ý: tag phải tồn tại trong document_tags trước khi chạy`,
    `-- =============================================================`,
    ``,
  ].join('\n');
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function renderSqlHighlight(el, sql) {
  const escaped = sql.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  el.innerHTML = escaped
    .replace(/\b(BEGIN|COMMIT|WITH|INSERT|INTO|VALUES|SELECT|FROM|JOIN|ON|WHERE|RETURNING|AS|ON CONFLICT DO NOTHING)\b/g,
      '<span class="kw">$1</span>')
    .replace(/'([^']*)'/g, '<span class="str">\'$1\'</span>')
    .replace(/(--[^\n]*)/g, '<span class="cm">$1</span>');
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => showToast('Đã copy vào clipboard!'));
}

function downloadFile(content, filename) {
  const a = document.createElement('a');
  a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(content);
  a.download = filename;
  a.click();
}

function showToast(msg) {
  const t = document.createElement('div');
  t.style.cssText = `
    position:fixed;bottom:24px;right:24px;z-index:9999;
    background:#0f172a;color:#e2e8f0;padding:10px 18px;
    border-radius:8px;font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,.3);
  `;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

const PANEL_TITLES = {
  single:   'Nhập văn bản (nhiều dòng)',
  bulk:     'Import hàng loạt (Excel)',
  schema:   'Sơ đồ Database',
  template: 'Excel Template',
  tools:    'Nhập công cụ (nhiều dòng)',
};

function switchPanel(panelId) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item-link').forEach(l => l.classList.remove('active'));
  document.getElementById(`panel-${panelId}`)?.classList.add('active');
  document.querySelector(`[data-panel="${panelId}"]`)?.classList.add('active');
  document.getElementById('panel-title').textContent = PANEL_TITLES[panelId] || '';
}

// ── Excel (.xlsx) ─────────────────────────────────────────────────────────────
/**
 * Đọc workbook xlsx (ArrayBuffer) → mảng object, mỗi object là 1 dòng,
 * key = tên cột (đúng theo header dòng đầu tiên của sheet).
 */
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
/** Sinh workbook chỉ có header (1 sheet, mỗi cột = 1 property trong DB) */
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

// ── Form (panel "single" — nhập nhiều dòng) ───────────────────────────────────
function readFormDoc() {
  const viewUrl = document.getElementById('f-view-url').value.trim();
  const downloadUrl = document.getElementById('f-download-url').value.trim();
  const driveFileId = resolveDriveFileId(
    document.getElementById('f-drive-file-id').value.trim(),
    viewUrl,
    downloadUrl,
  );
  const tagKeys = [...document.querySelectorAll('input[name="tags"]:checked')].map(cb => cb.value);

  return {
    title:              document.getElementById('f-title').value.trim(),
    code:               document.getElementById('f-code').value.trim(),
    description:        document.getElementById('f-description').value.trim(),
    issued_date:        document.getElementById('f-issued-date').value,
    expiry_date:        document.getElementById('f-expiry-date').value,
    status:             document.getElementById('f-status').value,
    tagKeys,
    drive_type:         document.getElementById('f-drive-type').value,
    drive_file_id:      driveFileId,
    drive_view_url:     viewUrl,
    drive_download_url: downloadUrl,
    mime_type:          document.getElementById('f-mime').value,
    file_size:          document.getElementById('f-file-size').value.trim(),
    content:            document.getElementById('f-content').value.trim(),
  };
}

function validateDoc(doc) {
  if (!doc.title) {
    showToast('⚠ Vui lòng điền Tên văn bản (title)');
    return false;
  }
  const hasFileHint = doc.drive_file_id || doc.drive_view_url || doc.drive_download_url;
  if (hasFileHint && !doc.drive_file_id) {
    showToast('⚠ Cần Drive File ID (hoặc URL có chứa ID) khi đính kèm file');
    return false;
  }
  return true;
}

function autoFillDriveFileId() {
  const input = document.getElementById('f-drive-file-id');
  if (input.value.trim()) return;
  const id = resolveDriveFileId(
    '',
    document.getElementById('f-view-url').value,
    document.getElementById('f-download-url').value,
  );
  if (id) input.value = id;
}

function renderSingleEntriesPreview() {
  const wrap = document.getElementById('single-preview');
  if (wrap) wrap.style.display = singleEntries.length ? 'block' : 'none';

  const countEl = document.getElementById('single-preview-count');
  if (countEl) countEl.textContent = `${singleEntries.length} văn bản`;

  const genCountEl = document.getElementById('single-gen-count');
  if (genCountEl) genCountEl.textContent = singleEntries.length;

  renderPreview(singleEntries, 'single-preview-tbody', idx => {
    singleEntries.splice(idx, 1);
    renderSingleEntriesPreview();
  });
}

// ── Catalog tools (panel "tools") ───────────────────────────────────────────
function readToolForm() {
  return {
    name: document.getElementById('tool-name').value.trim(),
    category: document.getElementById('tool-category').value.trim(),
    description: document.getElementById('tool-description').value.trim(),
    tags: document.getElementById('tool-tags').value.split(';').map(tag => tag.trim()).filter(Boolean),
    sourceName: document.getElementById('tool-source-name').value.trim(),
    sourceType: document.getElementById('tool-source-type').value,
    displayName: document.getElementById('tool-display-name').value.trim(),
    url: document.getElementById('tool-url').value.trim(),
  };
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function validateTool(entry) {
  if (!entry.name || !entry.category || !entry.sourceName || !entry.url) {
    showToast('⚠ Vui lòng điền tên công cụ, danh mục, nguồn và URL');
    return false;
  }
  if (!isHttpUrl(entry.url)) {
    showToast('⚠ URL phải bắt đầu bằng http:// hoặc https://');
    return false;
  }
  if (entry.sourceType === 'video' && !/^(https?:\/\/)(www\.)?(youtube\.com|youtube-nocookie\.com)\/embed\//i.test(entry.url)) {
    showToast('⚠ Video YouTube cần dùng URL dạng https://www.youtube.com/embed/VIDEO_ID');
    return false;
  }
  return true;
}

function renderToolEntriesPreview() {
  const preview = document.getElementById('tool-preview');
  preview.style.display = toolEntries.length ? 'block' : 'none';
  document.getElementById('tool-preview-count').textContent = `${toolEntries.length} mục`;
  document.getElementById('tool-gen-count').textContent = toolEntries.length;

  document.getElementById('tool-preview-tbody').innerHTML = toolEntries.map((entry, index) => `
    <tr>
      <td class="text-muted">${index + 1}</td>
      <td><strong>${escHtml(entry.name)}</strong></td>
      <td>${escHtml(entry.category)}</td>
      <td>${escHtml(entry.tags.join('; ') || '—')}</td>
      <td>${escHtml(entry.sourceName)} <span class="badge bg-secondary">${escHtml(entry.sourceType)}</span></td>
      <td title="${escHtml(entry.url)}">${escHtml(entry.url)}</td>
      <td><button type="button" class="btn btn-sm btn-outline-danger" data-remove-tool="${index}">✕</button></td>
    </tr>`).join('');

  document.querySelectorAll('[data-remove-tool]').forEach(button => {
    button.addEventListener('click', () => {
      toolEntries.splice(Number(button.dataset.removeTool), 1);
      renderToolEntriesPreview();
    });
  });
}

function escHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function generateSqlForTool(entry) {
  const tags = entry.tags.map(escSql).join(', ') || 'NULL';
  const description = entry.description ? escSql(entry.description) : 'NULL';
  const displayName = entry.displayName ? escSql(entry.displayName) : 'NULL';
  const commentName = entry.name.replace(/[\r\n]+/g, ' ');

  return [
    `-- Công cụ: ${commentName} (${entry.category.replace(/[\r\n]+/g, ' ')})`,
    `WITH`,
    `category_existing AS (`,
    `  SELECT category_id FROM categories WHERE category_name = ${escSql(entry.category)} LIMIT 1`,
    `),`,
    `category_inserted AS (`,
    `  INSERT INTO categories (category_name)`,
    `  SELECT ${escSql(entry.category)} WHERE NOT EXISTS (SELECT 1 FROM category_existing)`,
    `  RETURNING category_id`,
    `),`,
    `category_row AS (`,
    `  SELECT category_id FROM category_existing UNION ALL SELECT category_id FROM category_inserted`,
    `),`,
    `source_existing AS (`,
    `  SELECT source_id FROM external_sources`,
    `  WHERE source_name = ${escSql(entry.sourceName)} AND source_type = ${escSql(entry.sourceType)}`,
    `  LIMIT 1`,
    `),`,
    `source_inserted AS (`,
    `  INSERT INTO external_sources (source_name, source_type)`,
    `  SELECT ${escSql(entry.sourceName)}, ${escSql(entry.sourceType)}`,
    `  WHERE NOT EXISTS (SELECT 1 FROM source_existing)`,
    `  RETURNING source_id`,
    `),`,
    `source_row AS (`,
    `  SELECT source_id FROM source_existing UNION ALL SELECT source_id FROM source_inserted`,
    `),`,
    `tool_existing AS (`,
    `  SELECT t.tool_id FROM tools t JOIN category_row c ON c.category_id = t.category_id`,
    `  WHERE t.tool_name = ${escSql(entry.name)} LIMIT 1`,
    `),`,
    `tool_inserted AS (`,
    `  INSERT INTO tools (tool_name, category_id, description)`,
    `  SELECT ${escSql(entry.name)}, category_id, ${description} FROM category_row`,
    `  WHERE NOT EXISTS (SELECT 1 FROM tool_existing)`,
    `  RETURNING tool_id`,
    `),`,
    `tool_row AS (`,
    `  SELECT tool_id FROM tool_existing UNION ALL SELECT tool_id FROM tool_inserted`,
    `),`,
    `link_inserted AS (`,
    `  INSERT INTO tool_links (tool_id, source_id, embed_url, display_name)`,
    `  SELECT t.tool_id, s.source_id, ${escSql(entry.url)}, ${displayName}`,
    `  FROM tool_row t CROSS JOIN source_row s`,
    `  WHERE NOT EXISTS (`,
    `    SELECT 1 FROM tool_links l WHERE l.tool_id = t.tool_id AND l.source_id = s.source_id AND l.embed_url = ${escSql(entry.url)}`,
    `  )`,
    `  RETURNING link_id`,
    `),`,
    `tags_inserted AS (`,
    `  INSERT INTO tags (tag_name)`,
    `  SELECT tag_name FROM unnest(ARRAY[${tags}]::text[]) AS tag_values(tag_name)`,
    `  WHERE tag_name IS NOT NULL`,
    `  ON CONFLICT (tag_name) DO NOTHING`,
    `  RETURNING tag_id`,
    `),`,
    `tag_map_inserted AS (`,
    `  INSERT INTO tool_tags (tool_id, tag_id)`,
    `  SELECT t.tool_id, g.tag_id FROM tool_row t`,
    `  CROSS JOIN tags g WHERE g.tag_name = ANY(ARRAY[${tags}]::text[])`,
    `  ON CONFLICT DO NOTHING`,
    `  RETURNING tool_id`,
    `)`,
    `SELECT 'OK: ${entry.name}' AS result;`,
    ``,
  ].join('\n');
}

// ── Init ──────────────────────────────────────────────────────────────────────
function initAdmin() {
  document.querySelectorAll('[data-panel]').forEach(btn => {
    btn.addEventListener('click', () => switchPanel(btn.dataset.panel));
  });

  const tagContainer = document.getElementById('tag-checkboxes');
  TAGS.forEach(tag => {
    const div = document.createElement('label');
    div.className = 'tag-check';
    div.innerHTML = `
      <input type="checkbox" name="tags" value="${tag.key}" />
      <span>${tag.label}</span>
    `;
    tagContainer.appendChild(div);
  });

  ['f-view-url', 'f-download-url'].forEach(id => {
    document.getElementById(id).addEventListener('blur', autoFillDriveFileId);
  });
  document.getElementById('btn-extract-id').addEventListener('click', () => {
    autoFillDriveFileId();
    showToast('Đã trích xuất Drive File ID');
  });

  // ── Panel "single": thêm nhiều record vào danh sách tạm ──────────────────
  let lastSqlSingle = '';

  // Submit form = "Thêm vào danh sách" (không sinh SQL ngay)
  document.getElementById('form-single').addEventListener('submit', e => {
    e.preventDefault();
    autoFillDriveFileId();

    const doc = readFormDoc();
    if (!validateDoc(doc)) return;

    singleEntries.push(doc);
    renderSingleEntriesPreview();
    showToast(`✅ Đã thêm "${doc.title}" (${singleEntries.length} văn bản trong danh sách)`);

    document.getElementById('form-single').reset();
    tagContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => (cb.checked = false));
    document.getElementById('sql-output-single').style.display = 'none';
  });

  document.getElementById('btn-clear-single').addEventListener('click', () => {
    document.getElementById('form-single').reset();
    document.getElementById('sql-output-single').style.display = 'none';
    lastSqlSingle = '';
  });

  // Xoá toàn bộ danh sách đã thêm
  document.getElementById('btn-clear-single-list')?.addEventListener('click', () => {
    singleEntries = [];
    renderSingleEntriesPreview();
    document.getElementById('sql-output-single').style.display = 'none';
    lastSqlSingle = '';
  });

  // Xác nhận nhập hoàn tất → sinh SQL cho toàn bộ danh sách
  document.getElementById('btn-generate-single')?.addEventListener('click', () => {
    if (!singleEntries.length) {
      showToast('⚠ Danh sách đang trống, hãy thêm ít nhất 1 văn bản');
      return;
    }

    const invalid = singleEntries.find(r => {
      const hasFile = r.drive_file_id || r.drive_view_url || r.drive_download_url;
      return hasFile && !r.drive_file_id;
    });
    if (invalid) {
      showToast(`⚠ Văn bản "${invalid.title}" thiếu drive_file_id`);
      return;
    }

    const body = singleEntries
      .map(r => generateSqlForDoc(r, rowToTagNames(r.tagKeys)))
      .join('\n');
    lastSqlSingle = buildSqlHeader(singleEntries.length) + wrapInTransaction(body);

    const el = document.getElementById('sql-code-single');
    renderSqlHighlight(el, lastSqlSingle);
    document.getElementById('sql-output-single').style.display = 'block';
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    showToast(`✅ Đã tạo SQL cho ${singleEntries.length} văn bản`);
  });

  document.getElementById('btn-copy-single').addEventListener('click', () => copyToClipboard(lastSqlSingle));
  document.getElementById('btn-download-single').addEventListener('click', () => {
    downloadFile(lastSqlSingle, `insert_${new Date().toISOString().slice(0, 10)}.sql`);
  });

  // ── Panel "bulk": import từ file Excel (.xlsx) ────────────────────────────
  let lastSqlBulk = '';
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');

  document.getElementById('click-upload').addEventListener('click', e => {
    e.stopPropagation();
    fileInput.click();
  });
  dropZone.addEventListener('click', e => {
    if (e.target === fileInput) return;
    fileInput.click();
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) readXlsxFile(fileInput.files[0]);
  });

  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files[0]) readXlsxFile(e.dataTransfer.files[0]);
  });

  function readXlsxFile(file) {
    const okExt = /\.(xlsx|xls)$/i.test(file.name);
    if (!okExt) {
      showToast('⚠ Vui lòng chọn file Excel (.xlsx hoặc .xls)');
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const rows = parseXlsxWorkbook(ev.target.result);
        processRows(rows);
      } catch (err) {
        console.error(err);
        showToast('⚠ Không đọc được file Excel, kiểm tra lại định dạng');
      }
    };
    reader.onerror = () => showToast('⚠ Lỗi khi đọc file');
    reader.readAsArrayBuffer(file);
  }

  function processRows(rows) {
    if (!rows.length) { showToast('⚠ Không tìm thấy dữ liệu trong file Excel'); return; }
    parsedRows = rows.map(normalizeRow).filter(r => r.title);
    if (!parsedRows.length) { showToast('⚠ Không có dòng hợp lệ (cần có cột title)'); return; }
    renderPreview(parsedRows, 'preview-tbody');
    document.getElementById('preview-count').textContent = `${parsedRows.length} văn bản`;
    document.getElementById('gen-count').textContent = parsedRows.length;
    document.getElementById('bulk-preview').style.display = 'block';
    document.getElementById('sql-output-bulk').style.display = 'none';
    showToast(`✅ Đã tải ${parsedRows.length} văn bản từ Excel`);
  }

  document.getElementById('btn-clear-bulk').addEventListener('click', () => {
    parsedRows = [];
    fileInput.value = '';
    document.getElementById('bulk-preview').style.display = 'none';
    document.getElementById('sql-output-bulk').style.display = 'none';
    document.getElementById('preview-tbody').innerHTML = '';
    lastSqlBulk = '';
  });

  document.getElementById('btn-generate-bulk').addEventListener('click', () => {
    if (!parsedRows.length) { showToast('⚠ Chưa có dữ liệu'); return; }

    const invalid = parsedRows.find(r => {
      const hasFile = r.drive_file_id || r.drive_view_url || r.drive_download_url;
      return hasFile && !r.drive_file_id;
    });
    if (invalid) {
      showToast(`⚠ Dòng "${invalid.title}" thiếu drive_file_id`);
      return;
    }

    const body = parsedRows.map(r => generateSqlForDoc(r, rowToTagNames(r.tagKeys))).join('\n');
    lastSqlBulk = buildSqlHeader(parsedRows.length) + wrapInTransaction(body);

    const el = document.getElementById('sql-code-bulk');
    renderSqlHighlight(el, lastSqlBulk);
    document.getElementById('sql-output-bulk').style.display = 'block';
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    showToast(`✅ Đã tạo SQL cho ${parsedRows.length} văn bản`);
  });

  document.getElementById('btn-copy-bulk').addEventListener('click', () => copyToClipboard(lastSqlBulk));
  document.getElementById('btn-download-bulk').addEventListener('click', () => {
    downloadFile(lastSqlBulk, `bulk_insert_${new Date().toISOString().slice(0, 10)}.sql`);
  });

  // ── Panel "tools": nhập nhiều công cụ và sinh SQL ───────────────────────
  let lastSqlTools = '';
  const toolForm = document.getElementById('form-tool');

  toolForm?.addEventListener('submit', event => {
    event.preventDefault();
    const entry = readToolForm();
    if (!validateTool(entry)) return;

    toolEntries.push(entry);
    renderToolEntriesPreview();
    toolForm.reset();
    document.getElementById('tool-source-type').value = 'cloud';
    document.getElementById('sql-output-tools').style.display = 'none';
    lastSqlTools = '';
    showToast(`✅ Đã thêm "${entry.name}" (${toolEntries.length} mục trong danh sách)`);
  });

  document.getElementById('btn-clear-tool')?.addEventListener('click', () => {
    toolForm.reset();
    document.getElementById('tool-source-type').value = 'cloud';
  });

  document.getElementById('btn-clear-tool-list')?.addEventListener('click', () => {
    toolEntries = [];
    renderToolEntriesPreview();
    document.getElementById('sql-output-tools').style.display = 'none';
    lastSqlTools = '';
  });

  document.getElementById('btn-generate-tools')?.addEventListener('click', () => {
    if (!toolEntries.length) {
      showToast('⚠ Danh sách đang trống, hãy thêm ít nhất 1 công cụ');
      return;
    }

    const body = toolEntries.map(generateSqlForTool).join('\n');
    lastSqlTools = [
      '-- =============================================================',
      '-- NotDore — Tools catalog SQL Script',
      `-- Ngày tạo: ${new Date().toLocaleString('vi-VN')}`,
      `-- Số mục: ${toolEntries.length}`,
      '-- Chạy sau db/migration_add_tools.sql trong Supabase SQL Editor',
      '-- =============================================================',
      '',
      wrapInTransaction(body),
    ].join('\n');

    const output = document.getElementById('sql-code-tools');
    renderSqlHighlight(output, lastSqlTools);
    document.getElementById('sql-output-tools').style.display = 'block';
    output.scrollIntoView({ behavior: 'smooth', block: 'start' });
    showToast(`✅ Đã tạo SQL cho ${toolEntries.length} mục`);
  });

  document.getElementById('btn-copy-tools')?.addEventListener('click', () => copyToClipboard(lastSqlTools));
  document.getElementById('btn-download-tools')?.addEventListener('click', () => {
    downloadFile(lastSqlTools, `tools_${new Date().toISOString().slice(0, 10)}.sql`);
  });

  // ── Panel "template": tải file mẫu Excel ──────────────────────────────────
  document.getElementById('btn-dl-template').addEventListener('click', () => {
    downloadTemplateXlsx(false);
  });
  document.getElementById('btn-dl-template-sample').addEventListener('click', () => {
    downloadTemplateXlsx(true);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdmin);
} else {
  initAdmin();
}

/**
 * ── HTML CẦN THÊM ────────────────────────────────────────────────────────────
 * 1. Trước thẻ <script src="assets/js/admin.js">, thêm SheetJS:
 *    <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
 *
 * 2. panel "bulk": đổi input file:
 *    <input type="file" id="file-input" accept=".xlsx,.xls" hidden />
 *    → Có thể bỏ ô "csv-paste" (textarea) vì xlsx là file nhị phân, không paste được.
 *
 * 3. panel "single": thêm bên dưới form-single (giữ nguyên form/nút hiện có,
 *    nút submit form đổi label thành "Thêm vào danh sách"):
 *
 *    <div id="single-preview" style="display:none">
 *      <div class="d-flex justify-content-between align-items-center mb-2">
 *        <span id="single-preview-count">0 văn bản</span>
 *        <button type="button" id="btn-clear-single-list" class="btn btn-sm btn-outline-secondary">
 *          Xoá danh sách
 *        </button>
 *      </div>
 *      <table class="table table-sm">
 *        <thead>
 *          <tr>
 *            <th>#</th><th>Code</th><th>Title</th><th>Issued</th><th>Expiry</th>
 *            <th>Status</th><th>Tags</th><th>File</th><th>Text</th><th></th>
 *          </tr>
 *        </thead>
 *        <tbody id="single-preview-tbody"></tbody>
 *      </table>
 *      <button type="button" id="btn-generate-single" class="btn btn-primary">
 *        Xác nhận & Sinh SQL (<span id="single-gen-count">0</span> văn bản)
 *      </button>
 *    </div>
 *
 * 4. panel "template": nút tải template giữ nguyên id (btn-dl-template,
 *    btn-dl-template-sample) nhưng giờ tải về file .xlsx thay vì .csv.
 */
