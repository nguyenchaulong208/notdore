/**
 * assets/js/admin-query.js
 * Panel "Query & Sửa dữ liệu" — kết nối trực tiếp tới Supabase (anon key) để:
 *   1. Query toàn bộ dữ liệu về (theo văn bản gộp, hoặc từng bảng raw)
 *   2. Cho phép sửa/xoá ngay trên bảng
 *   3. Sinh SQL UPDATE/DELETE để chạy tay trong Supabase SQL Editor, HOẶC
 *      ghi thẳng vào Supabase qua client (có xem trước trước khi xác nhận)
 *
 * ⚠ BẢO MẬT:
 *   - Chỉ dùng anon key ở đây. KHÔNG dùng service_role key trong file chạy
 *     trên trình duyệt vì bất kỳ ai mở được admin.html + file key đều có
 *     toàn quyền trên database.
 *   - Anon key + URL được đọc từ 1 file .txt do người dùng tự chọn (không
 *     hard-code trong source), và chỉ được lưu vào localStorage nếu người
 *     dùng chủ động tick "Ghi nhớ".
 *   - Đảm bảo đã cấu hình Row Level Security (RLS) phù hợp cho các bảng
 *     documents, document_files, document_texts, document_tags,
 *     document_tag_map trước khi dùng tính năng ghi thẳng vào Supabase.
 *
 * File này phụ thuộc vào các hàm/hằng số dùng chung khai báo trong admin.js
 * (đã load trước file này): escSql, dateOrNull, intOrNull, escHtml, showToast,
 * copyToClipboard, downloadFile, renderSqlHighlight, buildSqlHeader,
 * wrapInTransaction, TAGS, STATUS_LABEL, parseDriveFileId.
 */

// ── Supabase connection ─────────────────────────────────────────────────────
let sbClient = null;
let sbConfig = null; // { url, key }

const SB_STORAGE_KEY = 'notdore_admin_sb_config';

function parseKeyFile(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let url = '';
  let key = '';

  lines.forEach(line => {
    const mUrl = line.match(/^(SUPABASE_URL|URL)\s*=\s*(.+)$/i);
    const mKey = line.match(/^(SUPABASE_ANON_KEY|ANON_KEY|KEY)\s*=\s*(.+)$/i);
    if (mUrl) url = mUrl[2].trim().replace(/^["']|["']$/g, '');
    else if (mKey) key = mKey[2].trim().replace(/^["']|["']$/g, '');
  });

  // Fallback: không theo định dạng KEY=VALUE → coi dòng 1 là URL, dòng 2 là key
  if (!url && !key && lines.length >= 2) {
    url = lines[0];
    key = lines[1];
  }
  return { url, key };
}

function requireClient() {
  if (!sbClient) {
    showToast('⚠ Hãy kết nối Supabase trước (mục "Kết nối Supabase")');
    return false;
  }
  return true;
}

function connectSupabaseClient() {
  const statusEl = document.getElementById('sb-status');
  try {
    sbClient = window.supabase.createClient(sbConfig.url, sbConfig.key);
    const ref = (sbConfig.url.match(/^https?:\/\/([^.]+)\./) || [])[1] || sbConfig.url;
    statusEl.innerHTML = `<span class="badge bg-success">Đã kết nối</span> project: <code>${escHtml(ref)}</code>`;
    showToast('✅ Đã kết nối Supabase');
  } catch (err) {
    console.error(err);
    sbClient = null;
    statusEl.innerHTML = `<span class="badge bg-danger">Lỗi kết nối</span>`;
    showToast('⚠ Không thể khởi tạo Supabase client — kiểm tra URL/KEY');
  }
}

function disconnectSupabaseClient() {
  sbClient = null;
  sbConfig = null;
  localStorage.removeItem(SB_STORAGE_KEY);
  document.getElementById('sb-status').innerHTML = 'Chưa kết nối.';
  document.getElementById('sb-remember').checked = false;
  showToast('Đã ngắt kết nối và xoá key khỏi bộ nhớ trình duyệt');
}

function initSupabaseConnection() {
  const fileInput = document.getElementById('sb-key-file');
  const connectBtn = document.getElementById('btn-sb-connect');
  const disconnectBtn = document.getElementById('btn-sb-disconnect');
  const rememberChk = document.getElementById('sb-remember');

  if (!window.supabase || !window.supabase.createClient) {
    document.getElementById('sb-status').innerHTML =
      '<span class="badge bg-danger">Chưa tải được thư viện Supabase JS</span> — kiểm tra kết nối mạng / CDN.';
  }

  // Khôi phục kết nối đã lưu (nếu người dùng từng tick "Ghi nhớ")
  try {
    const saved = localStorage.getItem(SB_STORAGE_KEY);
    if (saved) {
      sbConfig = JSON.parse(saved);
      if (sbConfig?.url && sbConfig?.key) {
        connectSupabaseClient();
        rememberChk.checked = true;
      }
    }
  } catch {
    /* ignore, coi như chưa có key lưu sẵn */
  }

  connectBtn.addEventListener('click', async () => {
    const file = fileInput.files[0];
    if (!file) {
      showToast('⚠ Hãy chọn file .txt chứa Supabase URL + anon key');
      return;
    }
    let text;
    try {
      text = await file.text();
    } catch {
      showToast('⚠ Không đọc được file');
      return;
    }
    const cfg = parseKeyFile(text);
    if (!cfg.url || !cfg.key) {
      showToast('⚠ Không tìm thấy URL/KEY hợp lệ trong file — kiểm tra định dạng');
      return;
    }
    sbConfig = cfg;
    connectSupabaseClient();
    if (rememberChk.checked) {
      localStorage.setItem(SB_STORAGE_KEY, JSON.stringify(sbConfig));
    } else {
      localStorage.removeItem(SB_STORAGE_KEY);
    }
  });

  disconnectBtn.addEventListener('click', disconnectSupabaseClient);
}

// ── Xác nhận trước khi ghi thẳng vào Supabase ───────────────────────────────
let pendingApply = null; // { type: 'merged', changes } | { type: 'raw', tableKey, changes }

function openApplyPreview(summaryText, sql) {
  document.getElementById('apply-preview-summary').textContent = summaryText;
  renderSqlHighlight(document.getElementById('apply-preview-sql'), sql);
  bootstrap.Modal.getOrCreateInstance(document.getElementById('apply-preview-modal')).show();
}

function initApplyConfirm() {
  document.getElementById('btn-apply-confirm').addEventListener('click', async () => {
    if (!pendingApply) return;
    const btn = document.getElementById('btn-apply-confirm');
    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = 'Đang ghi...';

    let results = [];
    try {
      if (pendingApply.type === 'merged') {
        results = await applyMergedChanges(pendingApply.changes);
      } else if (pendingApply.type === 'tools') {
        results = await applyMtChanges(pendingApply.changes);
      } else if (pendingApply.type === 'raw') {
        results = await applyRawChanges(pendingApply.tableKey, pendingApply.changes);
      }
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }

    bootstrap.Modal.getInstance(document.getElementById('apply-preview-modal'))?.hide();

    const okCount = results.filter(r => r.ok).length;
    const failCount = results.length - okCount;
    if (failCount) {
      console.table(results);
      showToast(`⚠ ${okCount} thành công, ${failCount} lỗi — xem console để biết chi tiết`);
    } else {
      showToast(`✅ Đã ghi ${okCount} thay đổi vào Supabase`);
    }

    if (pendingApply.type === 'merged') {
      await loadMergedData();
    } else if (pendingApply.type === 'tools') {
      await loadMtData();
    } else {
      await loadRawTable(pendingApply.tableKey);
    }
    pendingApply = null;
  });
}

// ── Tab switching (Theo văn bản / raw tables) ───────────────────────────────
function initQueryTabs() {
  document.querySelectorAll('#query-tabs [data-qtab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#query-tabs [data-qtab]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.qtab-panel').forEach(p => { p.style.display = 'none'; });
      const target = document.querySelector(`[data-qtab-panel="${btn.dataset.qtab}"]`);
      if (target) target.style.display = 'block';
    });
  });
}

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

// ── Tab "Theo công cụ" (gộp tools + categories + tool_links + external_sources + tags) ──
// Mỗi dòng làm việc = 1 (tool, link) — công cụ có nhiều link sẽ ra nhiều dòng cùng tool_id;
// công cụ chưa có link nào vẫn ra 1 dòng với link_id = null.
let mtRows = [];
let mtOriginal = new Map();  // rowKey -> JSON string snapshot
let mtDeletedLinks = new Set();  // rowKey các dòng bị đánh dấu "xoá liên kết"
let mtDeletedTools = new Set();  // tool_id bị đánh dấu "xoá cả công cụ"

function mtRowKey(toolId, linkId) {
  return `${toolId}::${linkId ?? 'null'}`;
}

function toolStateFromApi(t) {
  const tagNames = (t.tool_tags || []).map(x => x.tags?.tag_name).filter(Boolean);
  const links = (t.tool_links && t.tool_links.length) ? t.tool_links : [null];

  return links.map(link => ({
    key: mtRowKey(t.tool_id, link?.link_id ?? null),
    tool_id: t.tool_id,
    link_id: link?.link_id ?? null,
    tool_name: t.tool_name || '',
    category_name: t.categories?.category_name || '',
    description: t.description || '',
    tags: tagNames.join('; '),
    source_name: link?.external_sources?.source_name || '',
    source_type: link?.external_sources?.source_type || 'cloud',
    embed_url: link?.embed_url || '',
    display_name: link?.display_name || '',
  }));
}

async function loadMtData() {
  if (!requireClient()) return;
  const tbody = document.getElementById('mt-tbody');
  tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted py-4">Đang tải…</td></tr>`;

  const { data, error } = await sbClient
    .from('tools')
    .select(`
      tool_id, tool_name, description,
      categories(category_id, category_name),
      tool_links(link_id, embed_url, display_name, external_sources(source_id, source_name, source_type)),
      tool_tags(tags(tag_id, tag_name))
    `)
    .order('tool_id', { ascending: true });

  if (error) {
    console.error(error);
    tbody.innerHTML = `<tr><td colspan="10" class="text-center text-danger py-4">Lỗi: ${escHtml(error.message)}</td></tr>`;
    showToast('⚠ Lỗi khi tải dữ liệu công cụ — kiểm tra RLS/policy cho anon key');
    return;
  }

  mtRows = (data || []).flatMap(toolStateFromApi);
  mtOriginal = new Map(mtRows.map(r => [r.key, JSON.stringify(r)]));
  mtDeletedLinks = new Set();
  mtDeletedTools = new Set();

  document.getElementById('mt-summary').textContent = `Đã tải ${data.length} công cụ (${mtRows.length} liên kết).`;
  document.getElementById('sql-output-mt').style.display = 'none';
  renderMtTable();
  showToast(`✅ Đã tải ${data.length} công cụ từ Supabase`);
}

function isMtRowDirty(row) {
  if (mtDeletedTools.has(row.tool_id) || mtDeletedLinks.has(row.key)) return false; // hiển thị riêng qua trạng thái xoá
  const orig = mtOriginal.get(row.key);
  if (orig === undefined) return true;
  return orig !== JSON.stringify(row);
}

function renderMtTable() {
  const tbody = document.getElementById('mt-tbody');
  const q = (document.getElementById('mt-search').value || '').toLowerCase().trim();
  const rows = mtRows.filter(r => !q || r.tool_name.toLowerCase().includes(q));

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted py-4">${mtRows.length ? 'Không có dòng phù hợp' : 'Chưa có dữ liệu — bấm "Tải dữ liệu"'}</td></tr>`;
    updateMtDirtyCount();
    return;
  }

  tbody.innerHTML = rows.map(r => {
    const toolDeleted = mtDeletedTools.has(r.tool_id);
    const linkDeleted = mtDeletedLinks.has(r.key);
    const isDeleted = toolDeleted || linkDeleted;
    const dirty = !isDeleted && isMtRowDirty(r);
    const rowCls = isDeleted ? 'text-decoration-line-through text-muted' : (dirty ? 'table-warning' : '');
    const disabled = isDeleted ? 'disabled' : '';

    return `<tr class="${rowCls}" data-row-key="${escHtml(r.key)}">
      <td class="text-muted">${r.tool_id}${r.link_id ? `<br><span class="text-muted" style="font-size:10px">link ${r.link_id}</span>` : ''}</td>
      <td><input class="form-control form-control-sm" data-field="tool_name" value="${escHtml(r.tool_name)}" style="min-width:200px" ${disabled}></td>
      <td><input class="form-control form-control-sm" data-field="category_name" value="${escHtml(r.category_name)}" style="min-width:120px" ${disabled}></td>
      <td><textarea class="form-control form-control-sm" data-field="description" rows="1" style="min-width:200px" ${disabled}>${escHtml(r.description)}</textarea></td>
      <td><input class="form-control form-control-sm" data-field="tags" value="${escHtml(r.tags)}" style="min-width:140px" ${disabled}></td>
      <td><input class="form-control form-control-sm" data-field="source_name" value="${escHtml(r.source_name)}" style="min-width:120px" ${disabled}></td>
      <td>
        <select class="form-select form-select-sm" data-field="source_type" ${disabled}>
          ${['file', 'video', 'repo', 'cloud', 'social'].map(v => `<option value="${v}" ${r.source_type === v ? 'selected' : ''}>${v}</option>`).join('')}
        </select>
      </td>
      <td><input class="form-control form-control-sm" data-field="embed_url" value="${escHtml(r.embed_url)}" style="min-width:200px" ${disabled}></td>
      <td><input class="form-control form-control-sm" data-field="display_name" value="${escHtml(r.display_name)}" style="min-width:120px" ${disabled}></td>
      <td class="text-nowrap">
        <button class="btn btn-sm btn-outline-secondary" data-toggle-link-delete="${escHtml(r.key)}" title="${linkDeleted ? 'Khôi phục liên kết' : 'Xoá liên kết này'}" ${toolDeleted ? 'disabled' : ''}><i class="bi bi-${linkDeleted ? 'arrow-counterclockwise' : 'link-45deg'}"></i></button>
        <button class="btn btn-sm btn-outline-danger" data-toggle-tool-delete="${r.tool_id}" title="${toolDeleted ? 'Khôi phục công cụ' : 'Xoá cả công cụ'}"><i class="bi bi-${toolDeleted ? 'arrow-counterclockwise' : 'trash3'}"></i></button>
      </td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('[data-field]').forEach(el => {
    el.addEventListener('change', () => {
      const tr = el.closest('tr');
      const key = tr.dataset.rowKey;
      const row = mtRows.find(x => x.key === key);
      if (!row) return;
      row[el.dataset.field] = el.value;
      renderMtTable();
    });
  });

  tbody.querySelectorAll('[data-toggle-link-delete]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.toggleLinkDelete;
      if (mtDeletedLinks.has(key)) mtDeletedLinks.delete(key); else mtDeletedLinks.add(key);
      renderMtTable();
    });
  });

  tbody.querySelectorAll('[data-toggle-tool-delete]').forEach(btn => {
    btn.addEventListener('click', () => {
      const toolId = Number(btn.dataset.toggleToolDelete);
      if (mtDeletedTools.has(toolId)) mtDeletedTools.delete(toolId); else mtDeletedTools.add(toolId);
      renderMtTable();
    });
  });

  updateMtDirtyCount();
}

function updateMtDirtyCount() {
  const toolKeys = new Set(mtRows.map(r => r.tool_id));
  const deletedToolCount = [...mtDeletedTools].filter(id => toolKeys.has(id)).length;
  const deletedLinkCount = mtDeletedLinks.size;
  const dirtyCount = mtRows.filter(r => isMtRowDirty(r)).length;
  document.getElementById('mt-dirty-count').textContent = deletedToolCount + deletedLinkCount + dirtyCount;
}

// ── Diff + sinh SQL cho tab "Theo công cụ" ──────────────────────────────────
function diffMtChanges() {
  const changes = [];
  const processedTools = new Set();

  mtRows.forEach(row => {
    if (mtDeletedTools.has(row.tool_id)) {
      if (!processedTools.has(row.tool_id)) {
        changes.push({ type: 'delete_tool', tool_id: row.tool_id, tool_name: row.tool_name });
        processedTools.add(row.tool_id);
      }
      return;
    }
    if (mtDeletedLinks.has(row.key)) {
      if (row.link_id) changes.push({ type: 'delete_link', link_id: row.link_id, row });
      return;
    }
    if (isMtRowDirty(row)) {
      const orig = JSON.parse(mtOriginal.get(row.key));
      changes.push({ type: 'update', row, orig });
    }
  });

  return changes;
}

function splitSemicolon(str) {
  return String(str || '').split(';').map(s => s.trim()).filter(Boolean);
}

function buildMtUpdateSql(changes) {
  const parts = [];

  changes.forEach(ch => {
    if (ch.type === 'delete_tool') {
      parts.push(`-- Xoá cả công cụ #${ch.tool_id}: ${ch.tool_name}`);
      parts.push(`DELETE FROM tool_tags WHERE tool_id = ${ch.tool_id};`);
      parts.push(`DELETE FROM tool_links WHERE tool_id = ${ch.tool_id};`);
      parts.push(`DELETE FROM tools WHERE tool_id = ${ch.tool_id};`);
      parts.push('');
      return;
    }
    if (ch.type === 'delete_link') {
      parts.push(`-- Xoá liên kết #${ch.link_id} của công cụ "${ch.row.tool_name}"`);
      parts.push(`DELETE FROM tool_links WHERE link_id = ${ch.link_id};`);
      parts.push('');
      return;
    }

    const { row, orig } = ch;
    parts.push(`-- Cập nhật công cụ #${row.tool_id}: ${row.tool_name}`);

    if (row.tool_name !== orig.tool_name || row.description !== orig.description || row.category_name !== orig.category_name) {
      parts.push(`WITH`);
      parts.push(`category_existing AS (`);
      parts.push(`  SELECT category_id FROM categories WHERE category_name = ${escSql(row.category_name)} LIMIT 1`);
      parts.push(`),`);
      parts.push(`category_inserted AS (`);
      parts.push(`  INSERT INTO categories (category_name)`);
      parts.push(`  SELECT ${escSql(row.category_name)} WHERE NOT EXISTS (SELECT 1 FROM category_existing)`);
      parts.push(`  RETURNING category_id`);
      parts.push(`),`);
      parts.push(`category_row AS (`);
      parts.push(`  SELECT category_id FROM category_existing UNION ALL SELECT category_id FROM category_inserted`);
      parts.push(`)`);
      parts.push(`UPDATE tools SET`);
      parts.push(`  tool_name = ${escSql(row.tool_name)},`);
      parts.push(`  description = ${row.description ? escSql(row.description) : 'NULL'},`);
      parts.push(`  category_id = (SELECT category_id FROM category_row),`);
      parts.push(`  updated_at = CURRENT_TIMESTAMP`);
      parts.push(`WHERE tool_id = ${row.tool_id};`);
    }

    const linkChanged = row.link_id
      ? (row.embed_url !== orig.embed_url || row.display_name !== orig.display_name ||
         row.source_name !== orig.source_name || row.source_type !== orig.source_type)
      : (row.embed_url && row.source_name); // dòng chưa có link nhưng vừa điền → coi như thêm link mới

    if (linkChanged) {
      parts.push(`WITH`);
      parts.push(`source_existing AS (`);
      parts.push(`  SELECT source_id FROM external_sources WHERE source_name = ${escSql(row.source_name)} AND source_type = ${escSql(row.source_type)} LIMIT 1`);
      parts.push(`),`);
      parts.push(`source_inserted AS (`);
      parts.push(`  INSERT INTO external_sources (source_name, source_type)`);
      parts.push(`  SELECT ${escSql(row.source_name)}, ${escSql(row.source_type)} WHERE NOT EXISTS (SELECT 1 FROM source_existing)`);
      parts.push(`  RETURNING source_id`);
      parts.push(`),`);
      parts.push(`source_row AS (`);
      parts.push(`  SELECT source_id FROM source_existing UNION ALL SELECT source_id FROM source_inserted`);
      parts.push(`)`);
      if (row.link_id) {
        parts.push(`UPDATE tool_links SET`);
        parts.push(`  source_id = (SELECT source_id FROM source_row),`);
        parts.push(`  embed_url = ${escSql(row.embed_url)},`);
        parts.push(`  display_name = ${row.display_name ? escSql(row.display_name) : 'NULL'}`);
        parts.push(`WHERE link_id = ${row.link_id};`);
      } else {
        parts.push(`INSERT INTO tool_links (tool_id, source_id, embed_url, display_name)`);
        parts.push(`SELECT ${row.tool_id}, source_id, ${escSql(row.embed_url)}, ${row.display_name ? escSql(row.display_name) : 'NULL'} FROM source_row`);
        parts.push(`WHERE NOT EXISTS (SELECT 1 FROM tool_links l WHERE l.tool_id = ${row.tool_id} AND l.embed_url = ${escSql(row.embed_url)});`);
      }
    }

    const origTags = new Set(splitSemicolon(orig.tags));
    const newTags = new Set(splitSemicolon(row.tags));
    const added = [...newTags].filter(t => !origTags.has(t));
    const removed = [...origTags].filter(t => !newTags.has(t));

    added.forEach(name => {
      parts.push(`INSERT INTO tags (tag_name) SELECT ${escSql(name)} WHERE NOT EXISTS (SELECT 1 FROM tags WHERE tag_name = ${escSql(name)});`);
      parts.push(`INSERT INTO tool_tags (tool_id, tag_id) SELECT ${row.tool_id}, tag_id FROM tags WHERE tag_name = ${escSql(name)} AND NOT EXISTS (SELECT 1 FROM tool_tags WHERE tool_id = ${row.tool_id} AND tag_id = tags.tag_id);`);
    });
    if (removed.length) {
      const list = removed.map(escSql).join(', ');
      parts.push(`DELETE FROM tool_tags WHERE tool_id = ${row.tool_id} AND tag_id IN (SELECT tag_id FROM tags WHERE tag_name IN (${list}));`);
    }

    parts.push('');
  });

  return parts.join('\n');
}

async function resolveCategoryId(name) {
  const { data } = await sbClient.from('categories').select('category_id').eq('category_name', name).maybeSingle();
  if (data) return data.category_id;
  const { data: inserted, error } = await sbClient.from('categories').insert({ category_name: name }).select('category_id').single();
  if (error) throw error;
  return inserted.category_id;
}

async function resolveSourceId(name, type) {
  const { data } = await sbClient.from('external_sources').select('source_id').eq('source_name', name).eq('source_type', type).maybeSingle();
  if (data) return data.source_id;
  const { data: inserted, error } = await sbClient.from('external_sources').insert({ source_name: name, source_type: type }).select('source_id').single();
  if (error) throw error;
  return inserted.source_id;
}

async function resolveTagId(name) {
  const { data } = await sbClient.from('tags').select('tag_id').eq('tag_name', name).maybeSingle();
  if (data) return data.tag_id;
  const { data: inserted, error } = await sbClient.from('tags').insert({ tag_name: name }).select('tag_id').single();
  if (error) throw error;
  return inserted.tag_id;
}

async function applyMtChanges(changes) {
  const results = [];

  for (const ch of changes) {
    try {
      if (ch.type === 'delete_tool') {
        await sbClient.from('tool_tags').delete().eq('tool_id', ch.tool_id);
        await sbClient.from('tool_links').delete().eq('tool_id', ch.tool_id);
        const { error } = await sbClient.from('tools').delete().eq('tool_id', ch.tool_id);
        if (error) throw error;
        results.push({ ok: true, msg: `Đã xoá công cụ #${ch.tool_id}` });
        continue;
      }
      if (ch.type === 'delete_link') {
        const { error } = await sbClient.from('tool_links').delete().eq('link_id', ch.link_id);
        if (error) throw error;
        results.push({ ok: true, msg: `Đã xoá liên kết #${ch.link_id}` });
        continue;
      }

      const { row, orig } = ch;

      if (row.tool_name !== orig.tool_name || row.description !== orig.description || row.category_name !== orig.category_name) {
        const categoryId = await resolveCategoryId(row.category_name);
        const { error } = await sbClient.from('tools').update({
          tool_name: row.tool_name,
          description: row.description || null,
          category_id: categoryId,
          updated_at: new Date().toISOString(),
        }).eq('tool_id', row.tool_id);
        if (error) throw error;
      }

      const linkChanged = row.link_id
        ? (row.embed_url !== orig.embed_url || row.display_name !== orig.display_name ||
           row.source_name !== orig.source_name || row.source_type !== orig.source_type)
        : (row.embed_url && row.source_name);

      if (linkChanged) {
        const sourceId = await resolveSourceId(row.source_name, row.source_type);
        if (row.link_id) {
          const { error } = await sbClient.from('tool_links').update({
            source_id: sourceId,
            embed_url: row.embed_url,
            display_name: row.display_name || null,
          }).eq('link_id', row.link_id);
          if (error) throw error;
        } else {
          const { error } = await sbClient.from('tool_links').insert({
            tool_id: row.tool_id,
            source_id: sourceId,
            embed_url: row.embed_url,
            display_name: row.display_name || null,
          });
          if (error) throw error;
        }
      }

      const origTags = new Set(splitSemicolon(orig.tags));
      const newTags = new Set(splitSemicolon(row.tags));
      const added = [...newTags].filter(t => !origTags.has(t));
      const removed = [...origTags].filter(t => !newTags.has(t));

      for (const name of added) {
        const tagId = await resolveTagId(name);
        const { data: existingMap } = await sbClient.from('tool_tags').select('tool_id').eq('tool_id', row.tool_id).eq('tag_id', tagId).maybeSingle();
        if (!existingMap) await sbClient.from('tool_tags').insert({ tool_id: row.tool_id, tag_id: tagId });
      }
      if (removed.length) {
        const { data: tagRows } = await sbClient.from('tags').select('tag_id').in('tag_name', removed);
        const ids = (tagRows || []).map(t => t.tag_id);
        if (ids.length) await sbClient.from('tool_tags').delete().eq('tool_id', row.tool_id).in('tag_id', ids);
      }

      results.push({ ok: true, msg: `Đã cập nhật công cụ #${row.tool_id}` });
    } catch (err) {
      console.error(err);
      results.push({ ok: false, msg: err.message || String(err) });
    }
  }

  return results;
}

let lastSqlMt = '';

function findInvalidMtUrl(changes) {
  // tool_links.embed_url có CHECK constraint bắt buộc bắt đầu http:// hoặc https://
  return changes.find(ch => ch.type === 'update' && ch.row.embed_url && !isHttpUrl(ch.row.embed_url));
}

function findInvalidMtRow(changes) {
  // tools.tool_name NOT NULL, categories.category_name NOT NULL (theo schema thật)
  const bad = changes.find(ch => ch.type === 'update' && (!ch.row.tool_name.trim() || !ch.row.category_name.trim()));
  if (!bad) return null;
  return `Công cụ #${bad.row.tool_id} thiếu "Tên công cụ" hoặc "Danh mục" (bắt buộc)`;
}

function initMtTabButtons() {
  document.getElementById('btn-load-mt').addEventListener('click', loadMtData);
  document.getElementById('mt-search').addEventListener('input', renderMtTable);

  document.getElementById('btn-gen-mt-sql').addEventListener('click', () => {
    const changes = diffMtChanges();
    if (!changes.length) { showToast('⚠ Chưa có thay đổi nào'); return; }
    const invalidRow = findInvalidMtRow(changes);
    if (invalidRow) { showToast(`⚠ ${invalidRow}`); return; }
    const invalid = findInvalidMtUrl(changes);
    if (invalid) { showToast(`⚠ URL "${invalid.row.embed_url}" phải bắt đầu bằng http:// hoặc https://`); return; }

    const body = buildMtUpdateSql(changes);
    lastSqlMt = buildSqlHeader(changes.length) + wrapInTransaction(body);

    const el = document.getElementById('sql-code-mt');
    renderSqlHighlight(el, lastSqlMt);
    document.getElementById('sql-output-mt').style.display = 'block';
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    showToast(`✅ Đã tạo SQL cho ${changes.length} thay đổi`);
  });

  document.getElementById('btn-copy-mt').addEventListener('click', () => copyToClipboard(lastSqlMt));
  document.getElementById('btn-download-mt').addEventListener('click', () => {
    downloadFile(lastSqlMt, `update_tools_${new Date().toISOString().slice(0, 10)}.sql`);
  });

  document.getElementById('btn-apply-mt').addEventListener('click', () => {
    if (!requireClient()) return;
    const changes = diffMtChanges();
    if (!changes.length) { showToast('⚠ Chưa có thay đổi nào'); return; }
    const invalidRow = findInvalidMtRow(changes);
    if (invalidRow) { showToast(`⚠ ${invalidRow}`); return; }
    const invalid = findInvalidMtUrl(changes);
    if (invalid) { showToast(`⚠ URL "${invalid.row.embed_url}" phải bắt đầu bằng http:// hoặc https://`); return; }

    const sql = buildMtUpdateSql(changes);
    pendingApply = { type: 'tools', changes };
    openApplyPreview(
      `${changes.length} công cụ/liên kết sẽ bị thay đổi (bao gồm cả xoá nếu có). Kiểm tra kỹ trước khi ghi — thao tác này KHÔNG thể tự động hoàn tác.`,
      sql,
    );
  });
}

// ── Các bảng raw: document_files, document_tags, document_tag_map, document_texts ──
const RAW_TABLES = {
  document_files: {
    columns: [
      { key: 'id', label: 'ID', editable: false, type: 'number' },
      { key: 'document_id', label: 'document_id', editable: true, type: 'number' },
      { key: 'drive_type', label: 'drive_type', editable: true, type: 'text' },
      { key: 'drive_file_id', label: 'drive_file_id', editable: true, type: 'text' },
      { key: 'drive_view_url', label: 'view_url', editable: true, type: 'text' },
      { key: 'drive_download_url', label: 'download_url', editable: true, type: 'text' },
      { key: 'mime_type', label: 'mime_type', editable: true, type: 'text' },
      { key: 'size', label: 'size', editable: true, type: 'number' },
    ],
    pk: 'id',
  },
  document_tags: {
    columns: [
      { key: 'id', label: 'ID', editable: false, type: 'number' },
      { key: 'name', label: 'name', editable: true, type: 'text' },
      { key: 'label', label: 'label', editable: true, type: 'text' },
    ],
    pk: 'id',
  },
  document_tag_map: {
    columns: [
      { key: 'document_id', label: 'document_id', editable: false, type: 'number' },
      { key: 'tag_id', label: 'tag_id', editable: false, type: 'number' },
    ],
    pk: ['document_id', 'tag_id'],
  },
  document_texts: {
    columns: [
      { key: 'id', label: 'ID', editable: false, type: 'number' },
      { key: 'document_id', label: 'document_id', editable: true, type: 'number' },
      { key: 'content', label: 'content', editable: true, type: 'textarea' },
    ],
    pk: 'id',
  },
  categories: {
    columns: [
      { key: 'category_id', label: 'category_id', editable: false, type: 'number' },
      { key: 'category_name', label: 'category_name', editable: true, type: 'text' },
      { key: 'description', label: 'description', editable: true, type: 'textarea' },
    ],
    pk: 'category_id',
  },
  tools: {
    columns: [
      { key: 'tool_id', label: 'tool_id', editable: false, type: 'number' },
      { key: 'tool_name', label: 'tool_name', editable: true, type: 'text' },
      { key: 'category_id', label: 'category_id', editable: true, type: 'number' },
      { key: 'description', label: 'description', editable: true, type: 'textarea' },
      { key: 'created_at', label: 'created_at', editable: false, type: 'text' },
      { key: 'updated_at', label: 'updated_at', editable: false, type: 'text' },
    ],
    pk: 'tool_id',
    touchUpdatedAt: 'updated_at',
  },
  external_sources: {
    columns: [
      { key: 'source_id', label: 'source_id', editable: false, type: 'number' },
      { key: 'source_name', label: 'source_name', editable: true, type: 'text' },
      { key: 'source_type', label: 'source_type', editable: true, type: 'text' },
      { key: 'base_url', label: 'base_url', editable: true, type: 'text' },
      { key: 'icon_url', label: 'icon_url', editable: true, type: 'text' },
    ],
    pk: 'source_id',
  },
  tool_links: {
    columns: [
      { key: 'link_id', label: 'link_id', editable: false, type: 'number' },
      { key: 'tool_id', label: 'tool_id', editable: true, type: 'number' },
      { key: 'source_id', label: 'source_id', editable: true, type: 'number' },
      { key: 'embed_url', label: 'embed_url', editable: true, type: 'text' },
      { key: 'display_name', label: 'display_name', editable: true, type: 'text' },
      { key: 'is_active', label: 'is_active', editable: true, type: 'boolean' },
      { key: 'created_at', label: 'created_at', editable: false, type: 'text' },
    ],
    pk: 'link_id',
  },
  tags: {
    columns: [
      { key: 'tag_id', label: 'tag_id', editable: false, type: 'number' },
      { key: 'tag_name', label: 'tag_name', editable: true, type: 'text' },
    ],
    pk: 'tag_id',
  },
  tool_tags: {
    columns: [
      { key: 'tool_id', label: 'tool_id', editable: false, type: 'number' },
      { key: 'tag_id', label: 'tag_id', editable: false, type: 'number' },
    ],
    pk: ['tool_id', 'tag_id'],
  },
};

const rawState = {};  // tableKey -> { rows, original: Map(pk -> jsonStr), deleted: Set(pk) }
const lastSqlRaw = {}; // tableKey -> sql string (cho copy/download)

function pkValue(cfg, row) {
  if (Array.isArray(cfg.pk)) return cfg.pk.map(k => row[k]).join('::');
  return String(row[cfg.pk]);
}

function whereForPk(cfg, row) {
  if (Array.isArray(cfg.pk)) {
    return cfg.pk.map(k => `${k} = ${typeof row[k] === 'number' ? row[k] : escSql(row[k])}`).join(' AND ');
  }
  return `${cfg.pk} = ${typeof row[cfg.pk] === 'number' ? row[cfg.pk] : escSql(row[cfg.pk])}`;
}

async function loadRawTable(tableKey) {
  if (!requireClient()) return;
  const cfg = RAW_TABLES[tableKey];
  const wrap = document.getElementById(`qtab-${tableKey}`);
  const tbody = wrap?.querySelector('tbody');
  if (tbody) tbody.innerHTML = `<tr><td colspan="${cfg.columns.length + 1}" class="text-center text-muted py-4">Đang tải…</td></tr>`;

  const orderCol = Array.isArray(cfg.pk) ? cfg.pk[0] : cfg.pk;
  const { data, error } = await sbClient.from(tableKey).select('*').order(orderCol, { ascending: true });

  if (error) {
    console.error(error);
    showToast(`⚠ Lỗi tải ${tableKey}: ${error.message}`);
    if (tbody) tbody.innerHTML = `<tr><td colspan="${cfg.columns.length + 1}" class="text-center text-danger py-4">${escHtml(error.message)}</td></tr>`;
    return;
  }

  rawState[tableKey] = {
    rows: data.map(r => ({ ...r })),
    original: new Map(data.map(r => [pkValue(cfg, r), JSON.stringify(r)])),
    deleted: new Set(),
  };
  renderRawTable(tableKey);
  showToast(`✅ Đã tải ${data.length} dòng từ ${tableKey}`);
}

function renderRawTable(tableKey) {
  const cfg = RAW_TABLES[tableKey];
  const state = rawState[tableKey];
  const tbody = document.querySelector(`#qtab-${tableKey} tbody`);
  if (!tbody) return;

  if (!state || !state.rows.length) {
    tbody.innerHTML = `<tr><td colspan="${cfg.columns.length + 1}" class="text-center text-muted py-4">Chưa có dữ liệu — bấm "Tải dữ liệu"</td></tr>`;
    updateRawDirtyCount(tableKey);
    return;
  }

  tbody.innerHTML = state.rows.map((row, idx) => {
    const pk = pkValue(cfg, row);
    const isDeleted = state.deleted.has(pk);
    const isDirty = !isDeleted && JSON.stringify(row) !== state.original.get(pk);

    const cells = cfg.columns.map(col => {
      const val = row[col.key] ?? '';
      if (!col.editable || isDeleted) {
        const display = col.type === 'boolean' ? (row[col.key] ? 'true' : 'false') : val;
        return `<td>${escHtml(display)}</td>`;
      }
      if (col.type === 'boolean') {
        const boolVal = row[col.key] ? 'true' : 'false';
        return `<td><select class="form-select form-select-sm" data-row="${idx}" data-col="${col.key}" style="min-width:90px">
          <option value="true" ${boolVal === 'true' ? 'selected' : ''}>true</option>
          <option value="false" ${boolVal === 'false' ? 'selected' : ''}>false</option>
        </select></td>`;
      }
      if (col.type === 'textarea') {
        return `<td><textarea class="form-control form-control-sm" rows="1" data-row="${idx}" data-col="${col.key}" style="min-width:220px">${escHtml(val)}</textarea></td>`;
      }
      return `<td><input type="${col.type === 'number' ? 'number' : 'text'}" class="form-control form-control-sm" data-row="${idx}" data-col="${col.key}" value="${escHtml(val)}" style="min-width:120px"></td>`;
    }).join('');

    return `<tr class="${isDeleted ? 'text-decoration-line-through text-muted' : (isDirty ? 'table-warning' : '')}">
      ${cells}
      <td class="text-nowrap"><button class="btn btn-sm btn-outline-danger" data-rawdelete="${idx}" title="${isDeleted ? 'Khôi phục' : 'Đánh dấu xoá'}"><i class="bi bi-${isDeleted ? 'arrow-counterclockwise' : 'trash'}"></i></button></td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('[data-row]').forEach(el => {
    el.addEventListener('change', () => {
      const idx = Number(el.dataset.row);
      const col = el.dataset.col;
      const colCfg = cfg.columns.find(c => c.key === col);
      if (colCfg?.type === 'boolean') {
        state.rows[idx][col] = el.value === 'true';
      } else if (colCfg?.type === 'number') {
        state.rows[idx][col] = el.value === '' ? null : Number(el.value);
      } else {
        state.rows[idx][col] = el.value;
      }
      renderRawTable(tableKey);
    });
  });

  tbody.querySelectorAll('[data-rawdelete]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.rawdelete);
      const pk = pkValue(cfg, state.rows[idx]);
      if (state.deleted.has(pk)) state.deleted.delete(pk); else state.deleted.add(pk);
      renderRawTable(tableKey);
    });
  });

  updateRawDirtyCount(tableKey);
}

function updateRawDirtyCount(tableKey) {
  const cfg = RAW_TABLES[tableKey];
  const state = rawState[tableKey];
  const countEl = document.querySelector(`#qtab-${tableKey} [data-dirty-count]`);
  if (!countEl) return;
  if (!state) { countEl.textContent = '0'; return; }
  const n = state.rows.filter(r => {
    const pk = pkValue(cfg, r);
    return state.deleted.has(pk) || JSON.stringify(r) !== state.original.get(pk);
  }).length;
  countEl.textContent = n;
}

function diffRawChanges(tableKey) {
  const cfg = RAW_TABLES[tableKey];
  const state = rawState[tableKey];
  const changes = [];
  if (!state) return changes;

  state.rows.forEach(row => {
    const pk = pkValue(cfg, row);
    if (state.deleted.has(pk)) {
      changes.push({ type: 'delete', row });
      return;
    }
    if (JSON.stringify(row) !== state.original.get(pk)) {
      changes.push({ type: 'update', row, orig: JSON.parse(state.original.get(pk)) });
    }
  });
  return changes;
}

function buildRawUpdateSql(tableKey, changes) {
  const cfg = RAW_TABLES[tableKey];
  const parts = [];

  changes.forEach(ch => {
    if (ch.type === 'delete') {
      parts.push(`DELETE FROM ${tableKey} WHERE ${whereForPk(cfg, ch.row)};`);
      return;
    }
    const changedCols = cfg.columns.filter(c => c.editable && JSON.stringify(ch.row[c.key]) !== JSON.stringify(ch.orig[c.key]));
    if (!changedCols.length) return;
    const setClause = changedCols.map(c => {
      if (c.type === 'boolean') return `${c.key} = ${ch.row[c.key] ? 'TRUE' : 'FALSE'}`;
      if (c.type === 'number') return `${c.key} = ${intOrNull(ch.row[c.key])}`;
      return `${c.key} = ${escSql(ch.row[c.key])}`;
    });
    if (cfg.touchUpdatedAt) setClause.push(`${cfg.touchUpdatedAt} = CURRENT_TIMESTAMP`);
    parts.push(`UPDATE ${tableKey} SET ${setClause.join(', ')} WHERE ${whereForPk(cfg, ch.row)};`);
  });

  return parts.join('\n');
}

async function applyRawChanges(tableKey, changes) {
  const cfg = RAW_TABLES[tableKey];
  const results = [];

  for (const ch of changes) {
    try {
      if (ch.type === 'delete') {
        let q = sbClient.from(tableKey).delete();
        if (Array.isArray(cfg.pk)) cfg.pk.forEach(k => { q = q.eq(k, ch.row[k]); });
        else q = q.eq(cfg.pk, ch.row[cfg.pk]);
        const { error } = await q;
        if (error) throw error;
        results.push({ ok: true, msg: `Đã xoá ${whereForPk(cfg, ch.row)}` });
        continue;
      }

      const payload = {};
      cfg.columns.filter(c => c.editable).forEach(c => { payload[c.key] = ch.row[c.key]; });
      if (cfg.touchUpdatedAt) payload[cfg.touchUpdatedAt] = new Date().toISOString();
      let q = sbClient.from(tableKey).update(payload);
      if (Array.isArray(cfg.pk)) cfg.pk.forEach(k => { q = q.eq(k, ch.row[k]); });
      else q = q.eq(cfg.pk, ch.row[cfg.pk]);
      const { error } = await q;
      if (error) throw error;
      results.push({ ok: true, msg: `Đã cập nhật ${whereForPk(cfg, ch.row)}` });
    } catch (err) {
      console.error(err);
      results.push({ ok: false, msg: err.message || String(err) });
    }
  }

  return results;
}

function renderRawTabShell(tableKey) {
  const cfg = RAW_TABLES[tableKey];
  const wrap = document.getElementById(`qtab-${tableKey}`);
  if (!wrap) return;

  const headerCells = cfg.columns.map(c => `<th>${escHtml(c.label)}</th>`).join('') + '<th></th>';

  wrap.innerHTML = `
    <div class="form-card">
      <div class="d-flex flex-wrap gap-2 justify-content-between align-items-center mb-2">
        <h5 class="mb-0"><i class="bi bi-table me-2"></i>${tableKey}</h5>
        <button class="btn btn-sm btn-brand" data-load-raw><i class="bi bi-cloud-download me-1"></i>Tải dữ liệu</button>
      </div>
      <div style="overflow-x:auto; max-height:480px; overflow-y:auto">
        <table class="preview-table">
          <thead><tr>${headerCells}</tr></thead>
          <tbody><tr><td colspan="${cfg.columns.length + 1}" class="text-center text-muted py-4">Chưa có dữ liệu — bấm "Tải dữ liệu"</td></tr></tbody>
        </table>
      </div>
      <div class="d-flex flex-wrap gap-2 mt-3">
        <button class="btn btn-brand" data-gen-raw-sql><i class="bi bi-code-slash me-2"></i>Sinh SQL (<span data-dirty-count>0</span> thay đổi)</button>
        <button class="btn btn-outline-danger" data-apply-raw><i class="bi bi-cloud-upload me-2"></i>Xem trước &amp; Ghi vào Supabase</button>
      </div>
      <div class="sql-output-wrap" style="display:none; margin-top:16px">
        <div class="sql-panel">
          <div class="sql-toolbar">
            <span><i class="bi bi-terminal me-2"></i>SQL — ${tableKey}</span>
            <div class="actions">
              <button class="btn btn-sm btn-outline-secondary text-white border-secondary" data-copy-raw><i class="bi bi-clipboard me-1"></i>Copy</button>
              <button class="btn btn-sm btn-outline-secondary text-white border-secondary" data-download-raw><i class="bi bi-download me-1"></i>Tải .sql</button>
            </div>
          </div>
          <div class="sql-output" data-sql-code></div>
        </div>
      </div>
    </div>`;

  wrap.querySelector('[data-load-raw]').addEventListener('click', () => loadRawTable(tableKey));

  wrap.querySelector('[data-gen-raw-sql]').addEventListener('click', () => {
    const changes = diffRawChanges(tableKey);
    if (!changes.length) { showToast('⚠ Chưa có thay đổi nào'); return; }

    const sql = buildSqlHeader(changes.length) + wrapInTransaction(buildRawUpdateSql(tableKey, changes));
    lastSqlRaw[tableKey] = sql;

    const outWrap = wrap.querySelector('.sql-output-wrap');
    renderSqlHighlight(wrap.querySelector('[data-sql-code]'), sql);
    outWrap.style.display = 'block';
    outWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
    showToast(`✅ Đã tạo SQL cho ${changes.length} thay đổi`);
  });

  wrap.querySelector('[data-apply-raw]').addEventListener('click', () => {
    if (!requireClient()) return;
    const changes = diffRawChanges(tableKey);
    if (!changes.length) { showToast('⚠ Chưa có thay đổi nào'); return; }

    const sql = buildRawUpdateSql(tableKey, changes);
    pendingApply = { type: 'raw', tableKey, changes };
    openApplyPreview(
      `${changes.length} dòng trong "${tableKey}" sẽ bị thay đổi. Kiểm tra kỹ trước khi ghi.`,
      sql,
    );
  });

  wrap.querySelector('[data-copy-raw]').addEventListener('click', () => copyToClipboard(lastSqlRaw[tableKey] || ''));
  wrap.querySelector('[data-download-raw]').addEventListener('click', () => {
    downloadFile(lastSqlRaw[tableKey] || '', `${tableKey}_update_${new Date().toISOString().slice(0, 10)}.sql`);
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────
function initQueryPanel() {
  if (!document.getElementById('panel-query')) return; // an toàn nếu HTML chưa cập nhật

  initSupabaseConnection();
  initQueryTabs();
  initApplyConfirm();
  initMergedTabButtons();
  initDocEditModal();
  initMtTabButtons();
  Object.keys(RAW_TABLES).forEach(renderRawTabShell);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initQueryPanel);
} else {
  initQueryPanel();
}
