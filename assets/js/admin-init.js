/**
 * assets/js/admin-init.js
 * Khởi tạo toàn bộ trang: wiring nav, tag checkboxes, và event listener cho
 * 4 panel "single" / "bulk" / "tools" / "template".
 * PHẢI load SAU tất cả file admin-*.js khác (trừ admin-query.js, độc lập).
 */

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
