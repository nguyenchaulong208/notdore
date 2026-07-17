/**
 * assets/js/admin.js
 * Admin Tool — sinh SQL INSERT offline (không cần server/Supabase)
 *
 * Schema: integer SERIAL id, document_files (drive_type, drive_file_id),
 *         document_texts (content), document_tag_map (composite PK)
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

let parsedRows = [];

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
  single:   'Nhập văn bản đơn lẻ',
  bulk:     'Import hàng loạt',
  schema:   'Sơ đồ Database',
  template: 'CSV Template',
};

function switchPanel(panelId) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item-link').forEach(l => l.classList.remove('active'));
  document.getElementById(`panel-${panelId}`)?.classList.add('active');
  document.querySelector(`[data-panel="${panelId}"]`)?.classList.add('active');
  document.getElementById('panel-title').textContent = PANEL_TITLES[panelId] || '';
}

// ── CSV ───────────────────────────────────────────────────────────────────────
function parseCsv(text) {
  const lines = text.trim().split('\n').map(l => l.trimEnd());
  if (lines.length < 2) return { headers: [], rows: [] };

  function parseLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  }

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).filter(l => l.trim()).map(l => {
    const vals = parseLine(l);
    const row = {};
    headers.forEach((h, i) => { row[h.trim()] = vals[i] ?? ''; });
    return row;
  });

  return { headers, rows };
}

function normalizeRow(row) {
  const tagStr = (row.tags || '').trim();
  const tagKeys = tagStr ? tagStr.split(';').map(t => t.trim()).filter(Boolean) : [];
  const viewUrl = row.drive_view_url?.trim() || '';
  const downloadUrl = row.drive_download_url?.trim() || '';

  return {
    title:              row.title?.trim()              || '',
    code:               row.code?.trim()               || '',
    description:        row.description?.trim()        || '',
    issued_date:        row.issued_date?.trim()        || '',
    expiry_date:        row.expiry_date?.trim()        || '',
    status:             row.status?.trim()             || 'hieu_luc',
    tagKeys,
    drive_type:         normalizeDriveType(row.drive_type),
    drive_file_id:      resolveDriveFileId(row.drive_file_id, viewUrl, downloadUrl),
    drive_view_url:     viewUrl,
    drive_download_url: downloadUrl,
    mime_type:          normalizeMime(row.mime_type),
    file_size:          row.file_size?.trim()          || '',
    content:            row.content?.trim()            || '',
  };
}

function rowToTagNames(tagKeys) {
  return tagKeys.map(k => {
    const found = TAGS.find(t => t.key === k || t.name === k);
    return found ? found.name : k;
  });
}

function renderPreview(rows) {
  const tbody = document.getElementById('preview-tbody');
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
    </tr>`;
  }).join('');

  document.getElementById('preview-count').textContent = `${rows.length} văn bản`;
  document.getElementById('gen-count').textContent = rows.length;
  document.getElementById('bulk-preview').style.display = 'block';
}

const CSV_HEADERS = [
  'title', 'code', 'description', 'issued_date', 'expiry_date', 'status', 'tags',
  'drive_type', 'drive_file_id', 'drive_view_url', 'drive_download_url', 'mime_type', 'file_size', 'content',
].join(',');

const CSV_SAMPLE = `${CSV_HEADERS}
"Nghị định 163/2017/NĐ-CP Quy định về kinh doanh dịch vụ Logistics",163/2017/NĐ-CP,"Quy định điều kiện kinh doanh dịch vụ logistics",2017-12-19,,hieu_luc,vat,google,1abcExampleFileId,https://drive.google.com/file/d/1abcExampleFileId/view,https://drive.google.com/uc?id=1abcExampleFileId&export=download,pdf,,
"Thông tư 32/2017/TT-BTC hướng dẫn về hóa đơn điện tử",32/2017/TT-BTC,"Hướng dẫn thực hiện hóa đơn điện tử",2017-04-06,,hieu_luc,vat;ke-toan,,,,,pdf,,
"Nghị định 105/2020/NĐ-CP",105/2020/NĐ-CP,"",2020-09-09,,hieu_luc,tncn,,,,,pdf,,"`;

function readFormDoc() {
  const viewUrl = document.getElementById('f-view-url').value.trim();
  const downloadUrl = document.getElementById('f-download-url').value.trim();
  const driveFileId = resolveDriveFileId(
    document.getElementById('f-drive-file-id').value.trim(),
    viewUrl,
    downloadUrl,
  );

  return {
    title:              document.getElementById('f-title').value.trim(),
    code:               document.getElementById('f-code').value.trim(),
    description:        document.getElementById('f-description').value.trim(),
    issued_date:        document.getElementById('f-issued-date').value,
    expiry_date:        document.getElementById('f-expiry-date').value,
    status:             document.getElementById('f-status').value,
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

  let lastSqlSingle = '';

  document.getElementById('form-single').addEventListener('submit', e => {
    e.preventDefault();
    autoFillDriveFileId();

    const doc = readFormDoc();
    if (!validateDoc(doc)) return;

    const tagNames = rowToTagNames(
      [...document.querySelectorAll('input[name="tags"]:checked')].map(cb => cb.value),
    );

    lastSqlSingle = buildSqlHeader(1) + wrapInTransaction(generateSqlForDoc(doc, tagNames));

    const el = document.getElementById('sql-code-single');
    renderSqlHighlight(el, lastSqlSingle);
    document.getElementById('sql-output-single').style.display = 'block';
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  document.getElementById('btn-clear-single').addEventListener('click', () => {
    document.getElementById('form-single').reset();
    document.getElementById('sql-output-single').style.display = 'none';
    lastSqlSingle = '';
  });

  document.getElementById('btn-copy-single').addEventListener('click', () => copyToClipboard(lastSqlSingle));
  document.getElementById('btn-download-single').addEventListener('click', () => {
    const code = document.getElementById('f-code').value.replace(/\//g, '-') || 'document';
    downloadFile(lastSqlSingle, `insert_${code}.sql`);
  });

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
    if (fileInput.files[0]) readFile(fileInput.files[0]);
  });

  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]);
  });

  function readFile(file) {
    const reader = new FileReader();
    reader.onload = ev => {
      document.getElementById('csv-paste').value = ev.target.result;
      processCsv(ev.target.result);
    };
    reader.readAsText(file, 'UTF-8');
  }

  document.getElementById('btn-parse-csv').addEventListener('click', () => {
    const text = document.getElementById('csv-paste').value.trim();
    if (!text) { showToast('⚠ Vui lòng paste CSV hoặc upload file'); return; }
    processCsv(text);
  });

  function processCsv(text) {
    const { rows } = parseCsv(text);
    if (!rows.length) { showToast('⚠ Không tìm thấy dữ liệu trong CSV'); return; }
    parsedRows = rows.map(normalizeRow).filter(r => r.title);
    if (!parsedRows.length) { showToast('⚠ Không có dòng hợp lệ (cần có title)'); return; }
    renderPreview(parsedRows);
    document.getElementById('sql-output-bulk').style.display = 'none';
    showToast(`✅ Đã tải ${parsedRows.length} văn bản`);
  }

  document.getElementById('btn-clear-bulk').addEventListener('click', () => {
    parsedRows = [];
    document.getElementById('csv-paste').value = '';
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

  document.getElementById('btn-dl-template').addEventListener('click', () => {
    downloadFile(CSV_HEADERS + '\n', 'notdore_template.csv');
  });
  document.getElementById('btn-dl-template-sample').addEventListener('click', () => {
    downloadFile(CSV_SAMPLE, 'notdore_sample.csv');
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdmin);
} else {
  initAdmin();
}
