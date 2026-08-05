/**
 * assets/js/admin-sql-utils.js
 * Helper sinh/escape SQL và hiển thị syntax-highlight — dùng chung cho mọi
 * panel sinh SQL (single/bulk/tools/query).
 */

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

// ── Hiển thị SQL (syntax highlight) ─────────────────────────────────────────
// ── UI helpers ────────────────────────────────────────────────────────────────
function renderSqlHighlight(el, sql) {
  const escaped = sql.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  el.innerHTML = escaped
    .replace(/\b(BEGIN|COMMIT|WITH|INSERT|INTO|VALUES|SELECT|FROM|JOIN|ON|WHERE|RETURNING|AS|ON CONFLICT DO NOTHING)\b/g,
      '<span class="kw">$1</span>')
    .replace(/'([^']*)'/g, '<span class="str">\'$1\'</span>')
    .replace(/(--[^\n]*)/g, '<span class="cm">$1</span>');
}
