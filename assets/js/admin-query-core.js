/**
 * assets/js/admin-query-core.js
 * Hạ tầng dùng chung cho panel "Query & Sửa dữ liệu": kết nối Supabase (đọc
 * key từ file .txt, KHÔNG dùng service_role key), modal xem trước & xác
 * nhận ghi thẳng vào Supabase, và chuyển tab con (Theo văn bản / Theo công
 * cụ / các bảng raw).
 * Phải load ĐẦU TIÊN trong nhóm admin-query-*.js (các file khác đều gọi
 * requireClient/openApplyPreview/pendingApply định nghĩa ở đây).
 * Cần: admin-ui-utils.js (showToast), thư viện Supabase JS + Bootstrap.
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
