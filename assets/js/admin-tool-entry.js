/**
 * assets/js/admin-tool-entry.js
 * Logic cho 1 bản ghi "công cụ": đọc form, validate, render preview, và
 * sinh SQL INSERT (idempotent, tự tạo category/source/tag nếu chưa có).
 * Cần: admin-constants.js, admin-sql-utils.js (escSql), admin-parsers.js
 *      (isHttpUrl), admin-ui-utils.js (showToast, escHtml).
 */

// ── Catalog tools (panel "tools") ───────────────────────────────────────────
function readToolForm() {
  const v = id => document.getElementById(id).value.trim();
  return {
    name: v('tool-name'),
    category: v('tool-category'),
    description: v('tool-description'),
    tags: v('tool-tags').split(';').map(tag => tag.trim()).filter(Boolean),
    articleUrl: v('tool-article-url'),
    sourceName: v('tool-source-name'),
    sourceType: document.getElementById('tool-source-type').value,
    displayName: v('tool-display-name'),
    url: v('tool-url'),
  };
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
  if (entry.articleUrl && !isHttpUrl(entry.articleUrl)) {
    showToast('⚠ URL bài viết (Markdown) phải bắt đầu bằng http:// hoặc https://');
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
      <td class="text-center" title="${escHtml(entry.articleUrl)}">${entry.articleUrl ? '📄' : '—'}</td>
      <td><button type="button" class="btn btn-sm btn-outline-danger" data-remove-tool="${index}">✕</button></td>
    </tr>`).join('');

  document.querySelectorAll('[data-remove-tool]').forEach(button => {
    button.addEventListener('click', () => {
      toolEntries.splice(Number(button.dataset.removeTool), 1);
      renderToolEntriesPreview();
    });
  });
}

// Sinh SQL idempotent: category/source/tags "select-hoặc-tạo-mới" qua WITH ... NOT EXISTS,
// tool + link theo cùng pattern để chạy lại nhiều lần không tạo trùng bản ghi.
// escSql() đã tự trả 'NULL' cho chuỗi rỗng nên không cần ternary bọc ngoài.
function generateSqlForTool(entry) {
  const tags = entry.tags.map(escSql).join(', ') || 'NULL';
  const commentName = entry.name.replace(/[\r\n]+/g, ' ');
  const commentCategory = entry.category.replace(/[\r\n]+/g, ' ');

  return `-- Công cụ: ${commentName} (${commentCategory})
WITH
category_existing AS (
  SELECT category_id FROM categories WHERE category_name = ${escSql(entry.category)} LIMIT 1
),
category_inserted AS (
  INSERT INTO categories (category_name)
  SELECT ${escSql(entry.category)} WHERE NOT EXISTS (SELECT 1 FROM category_existing)
  RETURNING category_id
),
category_row AS (
  SELECT category_id FROM category_existing UNION ALL SELECT category_id FROM category_inserted
),
source_existing AS (
  SELECT source_id FROM external_sources
  WHERE source_name = ${escSql(entry.sourceName)} AND source_type = ${escSql(entry.sourceType)}
  LIMIT 1
),
source_inserted AS (
  INSERT INTO external_sources (source_name, source_type)
  SELECT ${escSql(entry.sourceName)}, ${escSql(entry.sourceType)}
  WHERE NOT EXISTS (SELECT 1 FROM source_existing)
  RETURNING source_id
),
source_row AS (
  SELECT source_id FROM source_existing UNION ALL SELECT source_id FROM source_inserted
),
tool_existing AS (
  SELECT t.tool_id FROM tools t JOIN category_row c ON c.category_id = t.category_id
  WHERE t.tool_name = ${escSql(entry.name)} LIMIT 1
),
tool_inserted AS (
  INSERT INTO tools (tool_name, category_id, description, article_url)
  SELECT ${escSql(entry.name)}, category_id, ${escSql(entry.description)}, ${escSql(entry.articleUrl)} FROM category_row
  WHERE NOT EXISTS (SELECT 1 FROM tool_existing)
  RETURNING tool_id
),
tool_row AS (
  SELECT tool_id FROM tool_existing UNION ALL SELECT tool_id FROM tool_inserted
),
link_inserted AS (
  INSERT INTO tool_links (tool_id, source_id, embed_url, display_name)
  SELECT t.tool_id, s.source_id, ${escSql(entry.url)}, ${escSql(entry.displayName)}
  FROM tool_row t CROSS JOIN source_row s
  WHERE NOT EXISTS (
    SELECT 1 FROM tool_links l WHERE l.tool_id = t.tool_id AND l.source_id = s.source_id AND l.embed_url = ${escSql(entry.url)}
  )
  RETURNING link_id
),
tags_inserted AS (
  INSERT INTO tags (tag_name)
  SELECT DISTINCT tv.tag_name
  FROM unnest(ARRAY[${tags}]::text[]) AS tv(tag_name)
  WHERE tv.tag_name IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM tags tg WHERE tg.tag_name = tv.tag_name)
  RETURNING tag_id, tag_name
),
tag_ids AS (
  SELECT tag_id FROM tags WHERE tag_name = ANY(ARRAY[${tags}]::text[])
  UNION
  SELECT tag_id FROM tags_inserted
),
tag_map_inserted AS (
  INSERT INTO tool_tags (tool_id, tag_id)
  SELECT t.tool_id, ti.tag_id FROM tool_row t
  CROSS JOIN tag_ids ti
  WHERE NOT EXISTS (
    SELECT 1 FROM tool_tags tt WHERE tt.tool_id = t.tool_id AND tt.tag_id = ti.tag_id
  )
  RETURNING tool_id
)
SELECT 'OK: ${entry.name}' AS result;
`;
}