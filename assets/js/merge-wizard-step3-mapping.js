/**
 * merge-wizard-step3-mapping.js
 * Bước phức tạp nhất: khớp cột nguồn -> cột đích cho từng file. Gọi worker.suggestMapping
 * để auto-fill lần đầu vào bước này, người dùng chỉnh tay qua dropdown.
 */
(function (global) {
  'use strict';

  const { state, util } = global.MW;
  const schemaListEl = document.getElementById('mw-target-schema-list');
  const mappingListEl = document.getElementById('mw-source-mapping-list');
  const nextBtn = document.getElementById('mw-btn-next');
  const saveProfileBtn = document.getElementById('mw-btn-save-profile');

  if (!schemaListEl) return;

  const renderTargetSchema = () => {
    const cols = state.get().targetSchema?.columns || [];
    schemaListEl.innerHTML =
      cols
        .map(
          (c) => `<div class="d-flex align-items-center gap-2 py-1 border-bottom small">
        <span class="badge bg-light text-dark">${c.order + 1}</span>${util.escapeHtml(c.label)}
      </div>`
        )
        .join('') ||
      '<p class="text-muted small mb-0">Chưa có Target Schema — quay lại Bước 2 để chọn template.</p>';
  };

  const optionsHtml = (mapping) => {
    const cols = state.get().targetSchema?.columns || [];
    const opts = cols
      .map(
        (c) =>
          `<option value="${c.key}" ${mapping.targetKey === c.key ? 'selected' : ''}>${util.escapeHtml(
            c.label
          )}</option>`
      )
      .join('');
    return `<option value="" ${!mapping.targetKey ? 'selected' : ''}>— Bỏ qua —</option>${opts}`;
  };

  const renderMappingTable = (file) => {
    const mapping = file.columnMapping || [];
    const rows = mapping
      .map(
        (m, idx) => `
      <tr>
        <td>${util.escapeHtml(m.sourceHeader)}</td>
        <td>
          <select class="form-select form-select-sm" data-file-id="${file.id}" data-row-idx="${idx}">
            ${optionsHtml(m)}
          </select>
        </td>
        <td>${
          m.autoMatched
            ? '<span class="mw-badge-auto"><i class="fa-solid fa-bolt"></i>Tự động</span>'
            : ''
        }</td>
      </tr>`
      )
      .join('');

    return `
    <div class="mw-card mb-3">
      <h3 class="h6 fw-bold mb-2">${util.escapeHtml(file.fileName)}</h3>
      <div class="mw-table-scroll">
        <table class="table table-sm align-middle mb-0">
          <thead><tr><th>Cột nguồn</th><th>Cột đích</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
  };

  const renderWarning = () => {
    const target = state.get().targetSchema;
    if (!target) return '';
    const mappedKeys = new Set();
    state
      .getSourceFiles()
      .forEach((f) => (f.columnMapping || []).forEach((m) => m.targetKey && mappedKeys.add(m.targetKey)));
    const unmapped = target.columns.filter((c) => !mappedKeys.has(c.key));
    if (!unmapped.length) return '';
    return `<div class="mw-mapping-warning mb-3">
      <i class="fa-solid fa-triangle-exclamation me-1"></i>
      ${unmapped.length} cột đích chưa có nguồn nào map vào: ${unmapped
      .map((c) => util.escapeHtml(c.label))
      .join(', ')}
    </div>`;
  };

  const render = () => {
    renderTargetSchema();
    const sourceFiles = state.getSourceFiles();
    mappingListEl.innerHTML =
      renderWarning() +
      (sourceFiles.length
        ? sourceFiles.map(renderMappingTable).join('')
        : '<p class="text-muted small">Không có file nguồn nào để khớp cột (chỉ có file template).</p>');
    nextBtn.disabled = !state.canProceed(3);
  };

  /** Gọi worker gợi ý mapping cho các file nguồn chưa có columnMapping (lần đầu vào Step 3). */
  const ensureAutoSuggested = async () => {
    const target = state.get().targetSchema;
    if (!target) { render(); return; }

    const targetColumns = target.columns.map((c) => ({ key: c.key, label: c.label }));
    for (const f of state.getSourceFiles()) {
      if (f.columnMapping) continue; // đã có mapping (tự tay hoặc từ profile) -> không ghi đè
      const sheet = state.getSelectedSheet(f);
      const mapping = await state.callWorker('suggestMapping', {
        targetColumns,
        sourceHeaders: sheet.headers,
      });
      state.setColumnMapping(f.id, mapping);
    }
    render();
  };

  mappingListEl.addEventListener('change', (e) => {
    const select = e.target.closest('select[data-file-id]');
    if (!select) return;
    const file = state.getFile(select.dataset.fileId);
    const idx = Number(select.dataset.rowIdx);
    const mapping = [...(file.columnMapping || [])];
    mapping[idx] = { ...mapping[idx], targetKey: select.value || null, autoMatched: false };
    state.setColumnMapping(file.id, mapping);
    render();
  });

  saveProfileBtn.addEventListener('click', () => {
    try {
      global.MW.profile.saveProfileToFile();
    } catch (err) {
      alert(err.message);
    }
  });

  state.on('step-change', (step) => { if (step === 3) ensureAutoSuggested(); });
  state.on('template-change', render);
})(window);
