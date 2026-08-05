/**
 * assets/js/admin-query-init.js
 * Khởi tạo panel "Query & Sửa dữ liệu": gọi init của core + docs + tools,
 * và dựng khung 10 tab bảng raw từ RAW_TABLES.
 * PHẢI load SAU tất cả file admin-query-*.js khác.
 */

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
