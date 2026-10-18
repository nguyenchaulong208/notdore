/**
 * assets/js/admin-query-raw.js
 * Cơ chế generic để query/sửa/xoá trực tiếp từng bảng "thô": document_files,
 * document_tags, document_tag_map, document_texts, categories, tools,
 * external_sources, tool_links, tags, tool_tags — cấu hình 1 lần trong
 * RAW_TABLES, dùng chung 1 bộ hàm render/diff/sinh SQL/ghi Supabase.
 * Cần: admin-query-core.js (requireClient, openApplyPreview, pendingApply),
 *      admin-sql-utils.js, admin-ui-utils.js.
 */

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
