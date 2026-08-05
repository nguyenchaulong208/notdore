/**
 * assets/js/admin-ui-utils.js
 * Helper UI dùng chung: toast, copy/download file, escape HTML, chuyển panel.
 * Cần admin-constants.js (PANEL_TITLES) load trước.
 */

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => showToast('Đã copy vào clipboard!'));
}

function downloadFile(content, filename) {
  const a = document.createElement('a');
  a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(content);
  a.download = filename;
  a.click();
}

function showToast(msg) {
  const t = document.createElement('div');
  t.style.cssText = `
    position:fixed;bottom:24px;right:24px;z-index:9999;
    background:#0f172a;color:#e2e8f0;padding:10px 18px;
    border-radius:8px;font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,.3);
  `;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

function escHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Điều hướng panel ──────────────────────────────────────────────────────────
function switchPanel(panelId) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item-link').forEach(l => l.classList.remove('active'));
  document.getElementById(`panel-${panelId}`)?.classList.add('active');
  document.querySelector(`[data-panel="${panelId}"]`)?.classList.add('active');
  document.getElementById('panel-title').textContent = PANEL_TITLES[panelId] || '';
}
