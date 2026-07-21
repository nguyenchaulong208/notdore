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

function initMergedTabButtons() {
  document.getElementById('btn-load-merged').addEventListener('click', loadMergedData);
  document.getElementById('merged-search').addEventListener('input', renderMergedTable);

  document.getElementById('btn-gen-merged-sql').addEventListener('click', () => {
    const changes = diffMergedChanges();
    if (!changes.length) { showToast('⚠ Chưa có thay đổi nào'); return; }

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

    const sql = buildMergedUpdateSql(changes);
    pendingApply = { type: 'merged', changes };
    openApplyPreview(
      `${changes.length} văn bản sẽ bị thay đổi (bao gồm cả xoá nếu có). Kiểm tra kỹ trước khi ghi — thao tác này KHÔNG thể tự động hoàn tác.`,
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
      if (!col.editable || isDeleted) return `<td>${escHtml(val)}</td>`;
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
      state.rows[idx][col] = el.type === 'number' ? (el.value === '' ? null : Number(el.value)) : el.value;
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
    const setClause = changedCols.map(c => `${c.key} = ${c.type === 'number' ? intOrNull(ch.row[c.key]) : escSql(ch.row[c.key])}`).join(', ');
    parts.push(`UPDATE ${tableKey} SET ${setClause} WHERE ${whereForPk(cfg, ch.row)};`);
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
  Object.keys(RAW_TABLES).forEach(renderRawTabShell);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initQueryPanel);
} else {
  initQueryPanel();
}
