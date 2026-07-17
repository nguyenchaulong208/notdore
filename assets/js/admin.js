/**
 * assets/js/admin.js
 * Toàn bộ logic cho trang Admin — NotDore
 *
 * Chức năng:
 *  1. Nhập đơn lẻ → sinh SQL INSERT
 *  2. Import hàng loạt qua CSV → preview → sinh SQL bulk INSERT
 *  3. Download CSV template
 *  4. Không ghi trực tiếp vào database
 */

// ─────────────────────────────────────────────────────────────────────────────
// Mapping dữ liệu
// ─────────────────────────────────────────────────────────────────────────────
const TAGS = [
  { key: 'vat',           name: 'thue-gtgt',       label: 'Thuế GTGT' },
  { key: 'tncn',          name: 'thue-tncn',        label: 'Thuế TNCN' },
  { key: 'tndn',          name: 'thue-tndn',        label: 'Thuế TNDN' },
  { key: 'bhxh',          name: 'bhxh',             label: 'BHXH' },
  { key: 'ke-toan',       name: 'ke-toan',          label: 'Kế toán' },
  { key: 'hai-quan',      name: 'hai-quan',         label: 'Hải quan' },
  { key: 'xnk',          name: 'xuat-nhap-khau',   label: 'Xuất nhập khẩu' },
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

// Dữ liệu parse từ CSV (state toàn cục)
let parsedRows = [];

// ─────────────────────────────────────────────────────────────────────────────
// UUID v4 (không cần lib bên ngoài)
// ─────────────────────────────────────────────────────────────────────────────
function uuid4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SQL Generator
// ─────────────────────────────────────────────────────────────────────────────
function escSql(str) {
  if (!str && str !== 0) return 'NULL';
  return `'${String(str).replace(/'/g, "''")}'`;
}

function dateOrNull(val) {
  if (!val || val.trim() === '') return 'NULL';
  return escSql(val.trim());
}

/**
 * Sinh SQL cho một văn bản.
 * @param {object} doc
 * @param {string[]} tagNames  — mảng tag name (thue-gtgt, bhxh…)
 */
function generateSqlForDoc(doc, tagNames) {
  const docId  = uuid4();
  const fileId = uuid4();
  const hasFile = doc.drive_view_url || doc.drive_download_url;
  const mime = doc.mime_type || 'application/pdf';

  const lines = [];

  lines.push(`-- ───────────────────────────────────────────────────────────`);
  lines.push(`-- Văn bản: ${doc.code}`);
  lines.push(`-- ───────────────────────────────────────────────────────────`);

  lines.push(`WITH doc_${docId.slice(0,8)} AS (`);
  lines.push(`  INSERT INTO documents`);
  lines.push(`    (id, code, title, description, issued_date, expiry_date, status)`);
  lines.push(`  VALUES (`);
  lines.push(`    '${docId}',`);
  lines.push(`    ${escSql(doc.code)},`);
  lines.push(`    ${escSql(doc.title)},`);
  lines.push(`    ${escSql(doc.description || null)},`);
  lines.push(`    ${dateOrNull(doc.issued_date)},`);
  lines.push(`    ${dateOrNull(doc.expiry_date)},`);
  lines.push(`    ${escSql(doc.status || 'hieu_luc')}`);
  lines.push(`  )`);
  lines.push(`  RETURNING id`);
  lines.push(`)`);

  if (hasFile) {
    lines.push(`, file_${fileId.slice(0,8)} AS (`);
    lines.push(`  INSERT INTO document_files`);
    lines.push(`    (id, document_id, drive_view_url, drive_download_url, mime_type)`);
    lines.push(`  SELECT`);
    lines.push(`    '${fileId}',`);
    lines.push(`    id,`);
    lines.push(`    ${escSql(doc.drive_view_url || null)},`);
    lines.push(`    ${escSql(doc.drive_download_url || null)},`);
    lines.push(`    ${escSql(mime)}`);
    lines.push(`  FROM doc_${docId.slice(0,8)}`);
    lines.push(`)`);
  }

  tagNames.forEach((tagName, i) => {
    const alias = `tag_${i}_${docId.slice(0,4)}`;
    const prevCte = i === 0 && !hasFile
      ? `doc_${docId.slice(0,8)}`
      : i === 0 && hasFile
        ? `file_${fileId.slice(0,8)}`
        : `tag_${i-1}_${docId.slice(0,4)}`;
    lines.push(`, ${alias} AS (`);
    lines.push(`  INSERT INTO document_tag_map (document_id, tag_id)`);
    lines.push(`  SELECT d.id, t.id`);
    lines.push(`  FROM doc_${docId.slice(0,8)} d`);
    lines.push(`  JOIN document_tags t ON t.name = ${escSql(tagName)}`);
    lines.push(`  ON CONFLICT DO NOTHING`);
    lines.push(`)`);
  });

  lines.push(`SELECT 'OK: ' || id AS result FROM doc_${docId.slice(0,8)};`);
  lines.push('');

  return lines.join('\n');
}

function wrapInTransaction(body) {
  return `BEGIN;\n\n${body}\nCOMMIT;\n`;
}

function buildSqlHeader(count) {
  return [
    `-- =============================================================`,
    `-- NotDore — SQL Script tự động sinh bởi Admin Tool`,
    `-- Ngày tạo: ${new Date().toLocaleString('vi-VN')}`,
    `-- Số văn bản: ${count}`,
    `-- Chạy trong: Supabase → SQL Editor`,
    `-- =============================================================`,
    ``,
  ].join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// UI Helpers
// ─────────────────────────────────────────────────────────────────────────────
function renderSqlHighlight(el, sql) {
  // Đơn giản: wrap keywords
  const escaped = sql
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;');

  const highlighted = escaped
    .replace(/\b(BEGIN|COMMIT|WITH|INSERT|INTO|VALUES|SELECT|FROM|JOIN|ON|WHERE|RETURNING|AS|ON CONFLICT DO NOTHING)\b/g,
      '<span class="kw">$1</span>')
    .replace(/'([^']*)'/g, '<span class="str">\'$1\'</span>')
    .replace(/(--[^\n]*)/g, '<span class="cm">$1</span>');

  el.innerHTML = highlighted;
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
    animation:fadein .2s ease;
  `;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

// ─────────────────────────────────────────────────────────────────────────────
// Nav routing
// ─────────────────────────────────────────────────────────────────────────────
const PANEL_TITLES = {
  manage:   'Quản lý văn bản',
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

// ─────────────────────────────────────────────────────────────────────────────
// CSV Parser
// ─────────────────────────────────────────────────────────────────────────────
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
        if (inQuotes && line[i+1] === '"') { current += '"'; i++; }
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
  const rows = lines.slice(1)
    .filter(l => l.trim())
    .map(l => {
      const vals = parseLine(l);
      const row = {};
      headers.forEach((h, i) => row[h.trim()] = vals[i] ?? '');
      return row;
    });

  return { headers, rows };
}

function normalizeRow(row) {
  // Chuẩn hoá các trường từ CSV
  const mimeShort = (row.mime_type || 'pdf').toLowerCase().trim();
  const mime = MIME_SHORT[mimeShort] || mimeShort;

  const tagStr = (row.tags || '').trim();
  const tagKeys = tagStr ? tagStr.split(';').map(t => t.trim()).filter(Boolean) : [];

  return {
    code:               row.code?.trim()               || '',
    title:              row.title?.trim()              || '',
    description:        row.description?.trim()        || '',
    issued_date:        row.issued_date?.trim()        || '',
    expiry_date:        row.expiry_date?.trim()        || '',
    status:             row.status?.trim()             || 'hieu_luc',
    tagKeys,
    drive_view_url:     row.drive_view_url?.trim()     || '',
    drive_download_url: row.drive_download_url?.trim() || '',
    mime_type:          mime,
  };
}

function rowToTagNames(tagKeys) {
  return tagKeys.map(k => {
    const found = TAGS.find(t => t.key === k || t.name === k);
    return found ? found.name : k;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Render preview table
// ─────────────────────────────────────────────────────────────────────────────
function renderPreview(rows) {
  const tbody = document.getElementById('preview-tbody');
  tbody.innerHTML = rows.map((r, i) => {
    const statusCls = `status-${r.status}`;
    const tagBadges = r.tagKeys.map(k => {
      const t = TAGS.find(x => x.key === k || x.name === k);
      return `<span class="badge bg-secondary me-1" style="font-size:10px">${t?.label || k}</span>`;
    }).join('');
    const hasFile = r.drive_view_url || r.drive_download_url ? '✅' : '—';

    return `<tr>
      <td class="text-muted">${i+1}</td>
      <td><strong>${r.code}</strong></td>
      <td style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${r.title}">${r.title}</td>
      <td>${r.issued_date || '—'}</td>
      <td>${r.expiry_date || '—'}</td>
      <td><span class="status-badge ${statusCls}">${STATUS_LABEL[r.status] || r.status}</span></td>
      <td>${tagBadges || '—'}</td>
      <td class="text-center">${hasFile}</td>
    </tr>`;
  }).join('');

  document.getElementById('preview-count').textContent = `${rows.length} văn bản`;
  document.getElementById('gen-count').textContent = rows.length;
  document.getElementById('bulk-preview').style.display = 'block';
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV Template
// ─────────────────────────────────────────────────────────────────────────────
const CSV_HEADERS = 'code,title,description,issued_date,expiry_date,status,tags,drive_view_url,drive_download_url,mime_type';

const CSV_SAMPLE = `${CSV_HEADERS}
163/2017/NĐ-CP,"Nghị định 163/2017/NĐ-CP Quy định về kinh doanh dịch vụ Logistics","Quy định điều kiện kinh doanh dịch vụ logistics",2017-12-19,,hieu_luc,vat,https://drive.google.com/file/d/example/view,https://drive.google.com/uc?id=example&export=download,pdf
32/2017/TT-BTC,"Thông tư 32/2017/TT-BTC hướng dẫn về hóa đơn điện tử","Hướng dẫn thực hiện hóa đơn điện tử",2017-04-06,,hieu_luc,vat;ke-toan,,,pdf
105/2020/NĐ-CP,"Nghị định 105/2020/NĐ-CP quy định điều kiện đầu tư kinh doanh","",2020-09-09,,hieu_luc,tncn,,,pdf`;

// ─────────────────────────────────────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // ── Nav ─────────────────────────────────────────────────────────────────────
  document.querySelectorAll('[data-panel]').forEach(btn => {
    btn.addEventListener('click', () => {
      const panelId = btn.dataset.panel;
      if (panelId === 'template') {
        switchPanel('template');
      } else {
        switchPanel(panelId);
      }
    });
  });

  // ── Render tag checkboxes ────────────────────────────────────────────────────
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

  // ── Form: Nhập đơn lẻ ───────────────────────────────────────────────────────
  let lastSqlSingle = '';

  document.getElementById('form-single').addEventListener('submit', e => {
    e.preventDefault();

    const code  = document.getElementById('f-code').value.trim();
    const title = document.getElementById('f-title').value.trim();

    if (!code || !title) {
      showToast('⚠ Vui lòng điền Số hiệu và Tên văn bản');
      return;
    }

    const checkedTags = [...document.querySelectorAll('input[name="tags"]:checked')]
      .map(cb => cb.value);
    const tagNames = rowToTagNames(checkedTags);

    const doc = {
      code,
      title,
      description:        document.getElementById('f-description').value.trim(),
      issued_date:        document.getElementById('f-issued-date').value,
      expiry_date:        document.getElementById('f-expiry-date').value,
      status:             document.getElementById('f-status').value,
      drive_view_url:     document.getElementById('f-view-url').value.trim(),
      drive_download_url: document.getElementById('f-download-url').value.trim(),
      mime_type:          document.getElementById('f-mime').value,
    };

    const body = generateSqlForDoc(doc, tagNames);
    lastSqlSingle = buildSqlHeader(1) + wrapInTransaction(body);

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

  // ── Bulk: Upload / Paste ─────────────────────────────────────────────────────
  let lastSqlBulk = '';

  const dropZone  = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');

  document.getElementById('click-upload').addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) readFile(fileInput.files[0]);
  });

  dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });
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
    parsedRows = rows.map(normalizeRow).filter(r => r.code && r.title);
    if (!parsedRows.length) { showToast('⚠ Không có dòng hợp lệ (cần có code và title)'); return; }
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

  // ── Bulk: Generate SQL ───────────────────────────────────────────────────────
  document.getElementById('btn-generate-bulk').addEventListener('click', () => {
    if (!parsedRows.length) { showToast('⚠ Chưa có dữ liệu'); return; }

    const body = parsedRows.map(r => {
      const tagNames = rowToTagNames(r.tagKeys);
      return generateSqlForDoc(r, tagNames);
    }).join('\n');

    lastSqlBulk = buildSqlHeader(parsedRows.length) + wrapInTransaction(body);

    const el = document.getElementById('sql-code-bulk');
    renderSqlHighlight(el, lastSqlBulk);
    document.getElementById('sql-output-bulk').style.display = 'block';
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    showToast(`✅ Đã tạo SQL cho ${parsedRows.length} văn bản`);
  });

  document.getElementById('btn-copy-bulk').addEventListener('click', () => copyToClipboard(lastSqlBulk));
  document.getElementById('btn-download-bulk').addEventListener('click', () => {
    const ts = new Date().toISOString().slice(0,10);
    downloadFile(lastSqlBulk, `bulk_insert_${ts}.sql`);
  });

  // ── Template download ────────────────────────────────────────────────────────
  document.getElementById('btn-dl-template').addEventListener('click', () => {
    downloadFile(CSV_HEADERS + '\n', 'notdore_template.csv');
  });
  document.getElementById('btn-dl-template-sample').addEventListener('click', () => {
    downloadFile(CSV_SAMPLE, 'notdore_sample.csv');
  });

  // ── Quản lý văn bản ─────────────────────────────────────────────────────────
  let allDocsCache = [];
  let allTagsCache = [];
  let hasNewCols   = false;
  let editingId    = null;

  async function loadAllDocs() {
    document.getElementById('manage-loading').style.display = 'block';
    document.getElementById('manage-table-wrap').style.display = 'none';
    closeDrawer();

    try {
      const res  = await fetch('/api/admin/docs');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi tải dữ liệu');

      allDocsCache = data.docs || [];
      allTagsCache = data.allTags || [];
      hasNewCols   = !!data.hasNewColumns;

      document.getElementById('schema-warning').style.display = hasNewCols ? 'none' : 'block';
      renderManageTable(allDocsCache);
    } catch (err) {
      showToast('❌ ' + err.message);
    } finally {
      document.getElementById('manage-loading').style.display = 'none';
    }
  }

  function renderManageTable(docs) {
    const tbody = document.getElementById('manage-tbody');
    tbody.innerHTML = docs.map(d => {
      const issued  = d.issued_date  ? formatDateShort(d.issued_date)  : '<span class="text-muted">—</span>';
      const expiry  = d.expiry_date  ? `<span class="text-danger">${formatDateShort(d.expiry_date)}</span>` : '<span class="text-muted">—</span>';
      const status  = d.status ? statusChip(d.status) : '<span class="text-muted">—</span>';
      const tagList = (d.tags || []).map(t => `<span class="badge bg-secondary me-1" style="font-size:10px">${esc(t.label || t.name)}</span>`).join('') || '<span class="text-muted">—</span>';
      return `<tr data-id="${d.id}" class="manage-row">
        <td><strong style="font-size:12px">${esc(d.code)}</strong></td>
        <td style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px" title="${esc(d.title)}">${esc(d.title)}</td>
        <td style="font-size:12px">${issued}</td>
        <td style="font-size:12px">${expiry}</td>
        <td>${status}</td>
        <td>${tagList}</td>
        <td>
          <button class="btn btn-sm btn-outline-primary btn-edit-doc py-0 px-2" data-id="${d.id}" style="font-size:12px">
            <i class="bi bi-pencil me-1"></i>Sửa
          </button>
        </td>
      </tr>`;
    }).join('');

    document.getElementById('manage-count').textContent = `${docs.length} văn bản trong database`;
    document.getElementById('manage-table-wrap').style.display = 'block';

    // Bind edit buttons
    document.querySelectorAll('.btn-edit-doc').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        openDrawer(Number(btn.dataset.id));
      });
    });
  }

  function statusChip(status) {
    const map = {
      hieu_luc:      ['status-hieu_luc',      'Còn hiệu lực'],
      het_hieu_luc:  ['status-het_hieu_luc',  'Hết hiệu lực'],
      chua_hieu_luc: ['status-chua_hieu_luc', 'Chưa có hiệu lực'],
    };
    const [cls, label] = map[status] || ['', status];
    return `<span class="status-badge ${cls}">${label}</span>`;
  }

  function formatDateShort(s) {
    if (!s) return '';
    const d = new Date(s);
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  }

  function esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function openDrawer(id) {
    const doc = allDocsCache.find(d => d.id === id);
    if (!doc) return;
    editingId = id;

    document.getElementById('edit-doc-code').textContent  = doc.code;
    document.getElementById('edit-doc-title').textContent = doc.title;
    document.getElementById('edit-issued-date').value     = doc.issued_date  || '';
    document.getElementById('edit-expiry-date').value     = doc.expiry_date  || '';
    document.getElementById('edit-status').value          = doc.status       || 'hieu_luc';
    document.getElementById('edit-view-url').value        = doc.file?.drive_view_url     || '';
    document.getElementById('edit-download-url').value   = doc.file?.drive_download_url || '';

    // Ẩn fields chưa có trong schema
    ['edit-issued-wrap','edit-expiry-wrap','edit-status-wrap'].forEach(id => {
      document.getElementById(id).style.display = hasNewCols ? '' : 'none';
    });

    // Render tag checkboxes
    const currentTagNames = (doc.tags || []).map(t => t.name);
    const tagGrid = document.getElementById('edit-tag-grid');
    tagGrid.innerHTML = allTagsCache.map(tag => `
      <label class="tag-check">
        <input type="checkbox" name="edit-tag" value="${tag.name}" ${currentTagNames.includes(tag.name) ? 'checked' : ''} />
        <span>${esc(tag.label || tag.name)}</span>
      </label>`).join('');

    document.getElementById('save-status').textContent = '';
    document.getElementById('edit-drawer').style.display = 'block';

    // Highlight row
    document.querySelectorAll('.manage-row').forEach(r => r.classList.remove('table-primary'));
    const row = document.querySelector(`.manage-row[data-id="${id}"]`);
    if (row) {
      row.classList.add('table-primary');
      row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    document.getElementById('edit-drawer').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function closeDrawer() {
    editingId = null;
    document.getElementById('edit-drawer').style.display = 'none';
    document.querySelectorAll('.manage-row').forEach(r => r.classList.remove('table-primary'));
  }

  document.getElementById('btn-close-drawer').addEventListener('click', closeDrawer);
  document.getElementById('btn-cancel-edit').addEventListener('click', closeDrawer);

  document.getElementById('btn-save-doc').addEventListener('click', async () => {
    if (!editingId) return;
    const statusEl = document.getElementById('save-status');
    const btn      = document.getElementById('btn-save-doc');

    const selectedTags = [...document.querySelectorAll('input[name="edit-tag"]:checked')].map(cb => cb.value);

    const payload = {
      tags:               selectedTags,
      drive_view_url:     document.getElementById('edit-view-url').value.trim(),
      drive_download_url: document.getElementById('edit-download-url').value.trim(),
    };

    if (hasNewCols) {
      payload.issued_date = document.getElementById('edit-issued-date').value || null;
      payload.expiry_date = document.getElementById('edit-expiry-date').value || null;
      payload.status      = document.getElementById('edit-status').value;
    }

    btn.disabled = true;
    statusEl.innerHTML = '<span class="text-muted"><span class="spinner-border spinner-border-sm me-1"></span>Đang lưu…</span>';

    try {
      const res = await fetch(`/api/admin/docs/${editingId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi lưu dữ liệu');

      // Cập nhật cache cục bộ
      const idx = allDocsCache.findIndex(d => d.id === editingId);
      if (idx !== -1) {
        if (hasNewCols) {
          allDocsCache[idx].issued_date = payload.issued_date;
          allDocsCache[idx].expiry_date = payload.expiry_date;
          allDocsCache[idx].status      = payload.status;
        }
        allDocsCache[idx].tags = allTagsCache.filter(t => selectedTags.includes(t.name));
        if (payload.drive_view_url || payload.drive_download_url) {
          allDocsCache[idx].file = {
            drive_view_url:     payload.drive_view_url,
            drive_download_url: payload.drive_download_url,
          };
        }
        renderManageTable(allDocsCache);
      }

      statusEl.innerHTML = '<span class="text-success"><i class="bi bi-check-circle me-1"></i>Đã lưu!</span>';
      setTimeout(() => closeDrawer(), 1000);
      showToast('✅ Đã lưu thay đổi');
    } catch (err) {
      statusEl.innerHTML = `<span class="text-danger"><i class="bi bi-x-circle me-1"></i>${err.message}</span>`;
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('btn-reload-docs').addEventListener('click', loadAllDocs);

  // Auto-load khi chuyển sang panel manage lần đầu
  let managePanelLoaded = false;
  const _origNavButtons = document.querySelectorAll('[data-panel]');
  _origNavButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.panel === 'manage' && !managePanelLoaded) {
        managePanelLoaded = true;
        loadAllDocs();
      }
    });
  });

});
