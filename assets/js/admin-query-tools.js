/**
 * assets/js/admin-query-tools.js
 * Tab "Theo công cụ" trong panel Query & Sửa dữ liệu: query gộp
 * tools + categories + tool_links + external_sources + tool_tags, sửa
 * trực tiếp trên bảng, sinh SQL UPDATE hoặc ghi thẳng Supabase (tự resolve
 * category_id/source_id/tag_id qua select-hoặc-tạo-mới).
 * Cần: admin-query-core.js (requireClient, openApplyPreview, pendingApply),
 *      admin-sql-utils.js, admin-ui-utils.js, admin-parsers.js (isHttpUrl).
 */

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
