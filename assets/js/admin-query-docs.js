/**
 * assets/js/admin-query-docs.js
 * Tab "Theo văn bản" trong panel Query & Sửa dữ liệu: query gộp
 * documents + document_files + document_texts + document_tag_map, sửa
 * trực tiếp / qua modal chi tiết, sinh SQL UPDATE hoặc ghi thẳng Supabase.
 * Cần: admin-query-core.js (requireClient, openApplyPreview, pendingApply),
 *      admin-constants.js (TAGS, STATUS_LABEL), admin-sql-utils.js,
 *      admin-ui-utils.js, admin-parsers.js (parseDriveFileId).
 */

// ── Tab "Theo văn bản" (gộp documents + document_files + document_texts + tags) ──
let mergedRows = [];             // working state
let mergedOriginal = new Map();  // id -> JSON string snapshot lúc mới tải

function docStateFromApi(d) {
  const file = (d.document_files && d.document_files[0]) || null;
  const text = (d.document_texts && d.document_texts[0]) || null;
  const tagNames = (d.document_tag_map || [])
    .map(m => m.document_tags?.name)
    .filter(Boolean);

  return {
    id: d.id,
    title: d.title || '',
    code: d.code || '',
    description: d.description || '',
    issued_date: d.issued_date || '',
    expiry_date: d.expiry_date || '',
    status: d.status || 'hieu_luc',
    tagNames,
    file: file ? {
      id: file.id,
      drive_type: file.drive_type || 'google',
      drive_file_id: file.drive_file_id || '',
      drive_view_url: file.drive_view_url || '',
      drive_download_url: file.drive_download_url || '',
      mime_type: file.mime_type || '',
      size: file.size ?? '',
    } : null,
    text: text ? { id: text.id, content: text.content || '' } : null,
    _deleted: false,
  };
}

async function loadMergedData() {
  if (!requireClient()) return;
  const tbody = document.getElementById('merged-tbody');
  tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted py-4">Đang tải…</td></tr>`;

  const { data, error } = await sbClient
    .from('documents')
    .select(`
      id, title, code, description, issued_date, expiry_date, status,
      document_files(id, drive_type, drive_file_id, drive_view_url, drive_download_url, mime_type, size),
      document_texts(id, content),
      document_tag_map(document_tags(id, name, label))
    `)
    .order('id', { ascending: true });

  if (error) {
    console.error(error);
    tbody.innerHTML = `<tr><td colspan="10" class="text-center text-danger py-4">Lỗi: ${escHtml(error.message)}</td></tr>`;
    showToast('⚠ Lỗi khi tải dữ liệu — kiểm tra RLS/policy cho anon key');
    return;
  }

  mergedRows = data.map(docStateFromApi);
  mergedOriginal = new Map(mergedRows.map(r => [r.id, JSON.stringify(r)]));
  document.getElementById('merged-summary').textContent = `Đã tải ${mergedRows.length} văn bản.`;
  document.getElementById('sql-output-merged').style.display = 'none';
  renderMergedTable();
  showToast(`✅ Đã tải ${mergedRows.length} văn bản từ Supabase`);
}

function isDocDirty(row) {
  const orig = mergedOriginal.get(row.id);
  if (orig === undefined) return true;
  return orig !== JSON.stringify(row);
}

function renderMergedTable() {
  const tbody = document.getElementById('merged-tbody');
  const q = (document.getElementById('merged-search').value || '').toLowerCase().trim();
  const rows = mergedRows.filter(r => !q || r.title.toLowerCase().includes(q) || r.code.toLowerCase().includes(q));

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted py-4">${mergedRows.length ? 'Không có dòng phù hợp' : 'Chưa có dữ liệu — bấm "Tải dữ liệu"'}</td></tr>`;
    updateMergedDirtyCount();
    return;
  }

  tbody.innerHTML = rows.map(r => {
    const dirty = isDocDirty(r);
    const rowCls = r._deleted ? 'text-decoration-line-through text-muted' : (dirty ? 'table-warning' : '');
    const tagBadges = r.tagNames.map(n => {
      const t = TAGS.find(x => x.name === n);
      return `<span class="badge bg-secondary me-1" style="font-size:10px">${escHtml(t?.label || n)}</span>`;
    }).join('') || '—';

    return `<tr class="${rowCls}" data-doc-id="${r.id}">
      <td class="text-muted">${r.id}</td>
      <td><input class="form-control form-control-sm" data-field="code" value="${escHtml(r.code)}" style="min-width:90px" ${r._deleted ? 'disabled' : ''}></td>
      <td><input class="form-control form-control-sm" data-field="title" value="${escHtml(r.title)}" style="min-width:220px" ${r._deleted ? 'disabled' : ''}></td>
      <td><input type="date" class="form-control form-control-sm" data-field="issued_date" value="${escHtml(r.issued_date)}" ${r._deleted ? 'disabled' : ''}></td>
      <td><input type="date" class="form-control form-control-sm" data-field="expiry_date" value="${escHtml(r.expiry_date)}" ${r._deleted ? 'disabled' : ''}></td>
      <td>
        <select class="form-select form-select-sm" data-field="status" ${r._deleted ? 'disabled' : ''}>
          ${Object.entries(STATUS_LABEL).map(([v, l]) => `<option value="${v}" ${r.status === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
      </td>
      <td>${tagBadges}</td>
      <td class="text-center">${r.file ? `<span class="badge bg-info text-dark">${escHtml(r.file.drive_type)}</span>` : '—'}</td>
      <td class="text-center">${r.text?.content ? '📝' : '—'}</td>
      <td class="text-nowrap">
        <button class="btn btn-sm btn-outline-secondary" data-detail-id="${r.id}" title="Sửa chi tiết"><i class="bi bi-pencil-square"></i></button>
        <button class="btn btn-sm btn-outline-danger" data-toggledelete-id="${r.id}" title="${r._deleted ? 'Khôi phục' : 'Đánh dấu xoá'}"><i class="bi bi-${r._deleted ? 'arrow-counterclockwise' : 'trash'}"></i></button>
      </td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('[data-field]').forEach(el => {
    el.addEventListener('change', () => {
      const tr = el.closest('tr');
      const id = Number(tr.dataset.docId);
      const row = mergedRows.find(x => x.id === id);
      if (!row) return;
      row[el.dataset.field] = el.value;
      renderMergedTable();
    });
  });

  tbody.querySelectorAll('[data-detail-id]').forEach(btn => {
    btn.addEventListener('click', () => openDocEditModal(Number(btn.dataset.detailId)));
  });

  tbody.querySelectorAll('[data-toggledelete-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.toggledeleteId);
      const row = mergedRows.find(x => x.id === id);
      if (!row) return;
      row._deleted = !row._deleted;
      renderMergedTable();
    });
  });

  updateMergedDirtyCount();
}

function updateMergedDirtyCount() {
  const count = mergedRows.filter(r => r._deleted || isDocDirty(r)).length;
  document.getElementById('merged-dirty-count').textContent = count;
}

// ── Modal sửa chi tiết 1 văn bản ─────────────────────────────────────────────
let editingDocId = null;

function openDocEditModal(id) {
  const row = mergedRows.find(x => x.id === id);
  if (!row) return;
  editingDocId = id;

  document.getElementById('edit-doc-id-label').textContent = `#${id}`;
  document.getElementById('edit-title').value = row.title;
  document.getElementById('edit-code').value = row.code;
  document.getElementById('edit-description').value = row.description;
  document.getElementById('edit-issued-date').value = row.issued_date;
  document.getElementById('edit-expiry-date').value = row.expiry_date;
  document.getElementById('edit-status').value = row.status;

  const tagWrap = document.getElementById('edit-tag-checkboxes');
  tagWrap.innerHTML = TAGS.map(t => `
    <label class="tag-check">
      <input type="checkbox" value="${t.name}" ${row.tagNames.includes(t.name) ? 'checked' : ''}>
      <span>${escHtml(t.label)}</span>
    </label>`).join('');

  const f = row.file || {};
  document.getElementById('edit-drive-type').value = f.drive_type || 'google';
  document.getElementById('edit-drive-file-id').value = f.drive_file_id || '';
  document.getElementById('edit-mime').value = f.mime_type || 'application/pdf';
  document.getElementById('edit-view-url').value = f.drive_view_url || '';
  document.getElementById('edit-download-url').value = f.drive_download_url || '';
  document.getElementById('edit-file-size').value = f.size ?? '';

  document.getElementById('edit-content').value = row.text?.content || '';

  bootstrap.Modal.getOrCreateInstance(document.getElementById('doc-edit-modal')).show();
}

function initDocEditModal() {
  document.getElementById('btn-edit-remove-file').addEventListener('click', () => {
    ['edit-drive-file-id', 'edit-view-url', 'edit-download-url', 'edit-file-size'].forEach(id => {
      document.getElementById(id).value = '';
    });
    showToast('Đã xoá thông tin file khỏi form — nhớ bấm "Lưu thay đổi"');
  });

  document.getElementById('btn-edit-save').addEventListener('click', () => {
    const row = mergedRows.find(x => x.id === editingDocId);
    if (!row) return;

    row.title = document.getElementById('edit-title').value.trim();
    row.code = document.getElementById('edit-code').value.trim();
    row.description = document.getElementById('edit-description').value.trim();
    row.issued_date = document.getElementById('edit-issued-date').value;
    row.expiry_date = document.getElementById('edit-expiry-date').value;
    row.status = document.getElementById('edit-status').value;
    row.tagNames = [...document.querySelectorAll('#edit-tag-checkboxes input:checked')].map(cb => cb.value);

    const driveFileId = document.getElementById('edit-drive-file-id').value.trim();
    const viewUrl = document.getElementById('edit-view-url').value.trim();
    const downloadUrl = document.getElementById('edit-download-url').value.trim();
    const size = document.getElementById('edit-file-size').value.trim();
    const mime = document.getElementById('edit-mime').value;
    const driveType = document.getElementById('edit-drive-type').value;

    if (driveFileId || viewUrl || downloadUrl) {
      row.file = {
        id: row.file?.id ?? null,
        drive_type: driveType,
        drive_file_id: driveFileId || parseDriveFileId(viewUrl) || parseDriveFileId(downloadUrl),
        drive_view_url: viewUrl,
        drive_download_url: downloadUrl,
        mime_type: mime,
        size,
      };
    } else {
      row.file = null;
    }

    const content = document.getElementById('edit-content').value.trim();
    row.text = content ? { id: row.text?.id ?? null, content } : null;

    bootstrap.Modal.getInstance(document.getElementById('doc-edit-modal'))?.hide();
    renderMergedTable();
    showToast('✅ Đã cập nhật tạm — bấm "Sinh SQL" hoặc "Ghi vào Supabase" để lưu thật');
  });

  document.getElementById('btn-edit-delete-doc').addEventListener('click', () => {
    const row = mergedRows.find(x => x.id === editingDocId);
    if (!row) return;
    row._deleted = true;
    bootstrap.Modal.getInstance(document.getElementById('doc-edit-modal'))?.hide();
    renderMergedTable();
  });
}

// ── Diff + sinh SQL cho tab "Theo văn bản" ───────────────────────────────────
function diffMergedChanges() {
  const changes = [];
  mergedRows.forEach(row => {
    const origStr = mergedOriginal.get(row.id);
    if (origStr === undefined) return;
    const orig = JSON.parse(origStr);
    if (row._deleted) {
      changes.push({ id: row.id, type: 'delete', orig });
      return;
    }
    if (!isDocDirty(row)) return;
    changes.push({ id: row.id, type: 'update', row, orig });
  });
  return changes;
}

function fileSetClause(f) {
  return [
    `drive_type = ${escSql(f.drive_type)}`,
    `drive_file_id = ${escSql(f.drive_file_id)}`,
    `drive_view_url = ${f.drive_view_url ? escSql(f.drive_view_url) : 'NULL'}`,
    `drive_download_url = ${f.drive_download_url ? escSql(f.drive_download_url) : 'NULL'}`,
    `mime_type = ${f.mime_type ? escSql(f.mime_type) : 'NULL'}`,
    `size = ${intOrNull(f.size)}`,
  ].join(', ');
}

function buildMergedUpdateSql(changes) {
  const parts = [];

  changes.forEach(ch => {
    if (ch.type === 'delete') {
      parts.push(`-- Xoá văn bản #${ch.id}: ${ch.orig.title}`);
      parts.push(`DELETE FROM document_tag_map WHERE document_id = ${ch.id};`);
      parts.push(`DELETE FROM document_files WHERE document_id = ${ch.id};`);
      parts.push(`DELETE FROM document_texts WHERE document_id = ${ch.id};`);
      parts.push(`DELETE FROM documents WHERE id = ${ch.id};`);
      parts.push('');
      return;
    }

    const { row, orig } = ch;
    parts.push(`-- Cập nhật văn bản #${row.id}: ${row.title}`);

    const docFieldsChanged = ['title', 'code', 'description', 'issued_date', 'expiry_date', 'status']
      .filter(f => (row[f] || '') !== (orig[f] || ''));
    if (docFieldsChanged.length) {
      const setClauses = docFieldsChanged.map(f => {
        if (f === 'issued_date' || f === 'expiry_date') return `${f} = ${dateOrNull(row[f])}`;
        return `${f} = ${escSql(row[f])}`;
      });
      setClauses.push('updated_at = now()');
      parts.push(`UPDATE documents SET ${setClauses.join(', ')} WHERE id = ${row.id};`);
    }

    const origFile = orig.file;
    const newFile = row.file;
    if (!origFile && newFile) {
      parts.push(`INSERT INTO document_files (document_id, drive_type, drive_file_id, drive_view_url, drive_download_url, mime_type, size)`);
      parts.push(`VALUES (${row.id}, ${escSql(newFile.drive_type)}, ${escSql(newFile.drive_file_id)}, ${newFile.drive_view_url ? escSql(newFile.drive_view_url) : 'NULL'}, ${newFile.drive_download_url ? escSql(newFile.drive_download_url) : 'NULL'}, ${newFile.mime_type ? escSql(newFile.mime_type) : 'NULL'}, ${intOrNull(newFile.size)});`);
    } else if (origFile && !newFile) {
      parts.push(`DELETE FROM document_files WHERE id = ${origFile.id};`);
    } else if (origFile && newFile && JSON.stringify(origFile) !== JSON.stringify(newFile)) {
      parts.push(`UPDATE document_files SET ${fileSetClause(newFile)} WHERE id = ${origFile.id};`);
    }

    const origText = orig.text;
    const newText = row.text;
    if (!origText && newText) {
      parts.push(`INSERT INTO document_texts (document_id, content) VALUES (${row.id}, ${escSql(newText.content)});`);
    } else if (origText && !newText) {
      parts.push(`DELETE FROM document_texts WHERE id = ${origText.id};`);
    } else if (origText && newText && origText.content !== newText.content) {
      parts.push(`UPDATE document_texts SET content = ${escSql(newText.content)} WHERE id = ${origText.id};`);
    }

    const origTags = new Set(orig.tagNames);
    const newTags = new Set(row.tagNames);
    const added = [...newTags].filter(t => !origTags.has(t));
    const removed = [...origTags].filter(t => !newTags.has(t));

    added.forEach(name => {
      parts.push(`INSERT INTO document_tag_map (document_id, tag_id) SELECT ${row.id}, id FROM document_tags WHERE name = ${escSql(name)} ON CONFLICT DO NOTHING;`);
    });
    if (removed.length) {
      const list = removed.map(escSql).join(', ');
      parts.push(`DELETE FROM document_tag_map WHERE document_id = ${row.id} AND tag_id IN (SELECT id FROM document_tags WHERE name IN (${list}));`);
    }

    parts.push('');
  });

  return parts.join('\n');
}

async function applyMergedChanges(changes) {
  const results = [];

  for (const ch of changes) {
    try {
      if (ch.type === 'delete') {
        await sbClient.from('document_tag_map').delete().eq('document_id', ch.id);
        await sbClient.from('document_files').delete().eq('document_id', ch.id);
        await sbClient.from('document_texts').delete().eq('document_id', ch.id);
        const { error } = await sbClient.from('documents').delete().eq('id', ch.id);
        if (error) throw error;
        results.push({ id: ch.id, ok: true, msg: 'Đã xoá' });
        continue;
      }

      const { row, orig } = ch;

      const docFieldsChanged = ['title', 'code', 'description', 'issued_date', 'expiry_date', 'status']
        .filter(f => (row[f] || '') !== (orig[f] || ''));
      if (docFieldsChanged.length) {
        const payload = {};
        docFieldsChanged.forEach(f => { payload[f] = row[f] || null; });
        const { error } = await sbClient.from('documents').update(payload).eq('id', row.id);
        if (error) throw error;
      }

      const origFile = orig.file;
      const newFile = row.file;
      if (!origFile && newFile) {
        const { error } = await sbClient.from('document_files').insert({
          document_id: row.id,
          drive_type: newFile.drive_type,
          drive_file_id: newFile.drive_file_id,
          drive_view_url: newFile.drive_view_url || null,
          drive_download_url: newFile.drive_download_url || null,
          mime_type: newFile.mime_type || null,
          size: newFile.size ? Number(newFile.size) : null,
        });
        if (error) throw error;
      } else if (origFile && !newFile) {
        const { error } = await sbClient.from('document_files').delete().eq('id', origFile.id);
        if (error) throw error;
      } else if (origFile && newFile && JSON.stringify(origFile) !== JSON.stringify(newFile)) {
        const { error } = await sbClient.from('document_files').update({
          drive_type: newFile.drive_type,
          drive_file_id: newFile.drive_file_id,
          drive_view_url: newFile.drive_view_url || null,
          drive_download_url: newFile.drive_download_url || null,
          mime_type: newFile.mime_type || null,
          size: newFile.size ? Number(newFile.size) : null,
        }).eq('id', origFile.id);
        if (error) throw error;
      }

      const origText = orig.text;
      const newText = row.text;
      if (!origText && newText) {
        const { error } = await sbClient.from('document_texts').insert({ document_id: row.id, content: newText.content });
        if (error) throw error;
      } else if (origText && !newText) {
        const { error } = await sbClient.from('document_texts').delete().eq('id', origText.id);
        if (error) throw error;
      } else if (origText && newText && origText.content !== newText.content) {
        const { error } = await sbClient.from('document_texts').update({ content: newText.content }).eq('id', origText.id);
        if (error) throw error;
      }

      const origTags = new Set(orig.tagNames);
      const newTags = new Set(row.tagNames);
      const added = [...newTags].filter(t => !origTags.has(t));
      const removed = [...origTags].filter(t => !newTags.has(t));

      for (const name of added) {
        const { data: tagRow } = await sbClient.from('document_tags').select('id').eq('name', name).single();
        if (tagRow) await sbClient.from('document_tag_map').insert({ document_id: row.id, tag_id: tagRow.id });
      }
      if (removed.length) {
        const { data: tagRows } = await sbClient.from('document_tags').select('id').in('name', removed);
        const ids = (tagRows || []).map(t => t.id);
        if (ids.length) await sbClient.from('document_tag_map').delete().eq('document_id', row.id).in('tag_id', ids);
      }

      results.push({ id: row.id, ok: true, msg: 'Đã cập nhật' });
    } catch (err) {
      console.error(err);
      results.push({ id: ch.id, ok: false, msg: err.message || String(err) });
    }
  }

  return results;
}

let lastSqlMerged = '';

function findInvalidMergedRow(changes) {
  // documents.title NOT NULL, document_files.drive_file_id NOT NULL (theo schema thật)
  const noTitle = changes.find(ch => ch.type === 'update' && !ch.row.title.trim());
  if (noTitle) return `Văn bản #${noTitle.row.id} thiếu "Tên văn bản" (bắt buộc)`;
  const badFile = changes.find(ch => ch.type === 'update' && ch.row.file && !ch.row.file.drive_file_id);
  if (badFile) return `Văn bản #${badFile.row.id} có thông tin file nhưng thiếu Drive File ID`;
  return null;
}

function initMergedTabButtons() {
  document.getElementById('btn-load-merged').addEventListener('click', loadMergedData);
  document.getElementById('merged-search').addEventListener('input', renderMergedTable);

  document.getElementById('btn-gen-merged-sql').addEventListener('click', () => {
    const changes = diffMergedChanges();
    if (!changes.length) { showToast('⚠ Chưa có thay đổi nào'); return; }
    const invalidMsg = findInvalidMergedRow(changes);
    if (invalidMsg) { showToast(`⚠ ${invalidMsg}`); return; }

    const body = buildMergedUpdateSql(changes);
    lastSqlMerged = buildSqlHeader(changes.length) + wrapInTransaction(body);

    const el = document.getElementById('sql-code-merged');
    renderSqlHighlight(el, lastSqlMerged);
    document.getElementById('sql-output-merged').style.display = 'block';
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    showToast(`✅ Đã tạo SQL cho ${changes.length} thay đổi`);
  });

  document.getElementById('btn-copy-merged').addEventListener('click', () => copyToClipboard(lastSqlMerged));
  document.getElementById('btn-download-merged').addEventListener('click', () => {
    downloadFile(lastSqlMerged, `update_documents_${new Date().toISOString().slice(0, 10)}.sql`);
  });

  document.getElementById('btn-apply-merged').addEventListener('click', () => {
    if (!requireClient()) return;
    const changes = diffMergedChanges();
    if (!changes.length) { showToast('⚠ Chưa có thay đổi nào'); return; }
    const invalidMsg = findInvalidMergedRow(changes);
    if (invalidMsg) { showToast(`⚠ ${invalidMsg}`); return; }

    const sql = buildMergedUpdateSql(changes);
    pendingApply = { type: 'merged', changes };
    openApplyPreview(
      `${changes.length} văn bản sẽ bị thay đổi (bao gồm cả xoá nếu có). Kiểm tra kỹ trước khi ghi — thao tác này KHÔNG thể tự động hoàn tác.`,
      sql,
    );
  });
}
