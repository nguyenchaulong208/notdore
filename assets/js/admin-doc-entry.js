/**
 * assets/js/admin-doc-entry.js
 * Logic cho 1 bản ghi "văn bản": đọc form, validate, sinh SQL INSERT, và
 * render bảng preview cho panel "single" (nhập nhiều dòng thủ công).
 * Cần: admin-constants.js, admin-sql-utils.js, admin-parsers.js,
 *      admin-ui-utils.js (showToast), admin-excel.js (renderPreview).
 */

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
