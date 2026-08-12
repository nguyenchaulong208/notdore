/**
 * merge-wizard-step2-template.js
 * Preview từng file (bảng scroll ngang), chọn 1 file làm template, chọn sheet, toggle giữ/xoá dữ liệu gốc.
 */
(function (global) {
  'use strict';

  const { state, util } = global.MW;
  const container = document.getElementById('mw-template-selector');
  const nextBtn = document.getElementById('mw-btn-next');

  if (!container) return;

  const renderPreviewTable = (sheet) => {
    const headerHtml = `<tr>${sheet.headers
      .map((h) => `<th>${util.escapeHtml(h) || '&nbsp;'}</th>`)
      .join('')}</tr>`;
    const bodyHtml = sheet.previewRows
      .map(
        (row) =>
          `<tr>${sheet.headers.map((_, i) => `<td>${util.escapeHtml(row[i] ?? '')}</td>`).join('')}</tr>`
      )
      .join('');
    return `<div class="mw-table-scroll"><table class="table table-sm table-bordered mb-0">
      <thead>${headerHtml}</thead><tbody>${bodyHtml}</tbody></table></div>`;
  };

  const render = () => {
    const data = state.get();
    container.innerHTML = data.files
      .map((f) => {
        const isTemplate = f.id === data.templateFileId;
        const sheet = state.getSelectedSheet(f);
        const sheetOptions =
          f.sheets.length > 1
            ? `<select class="form-select form-select-sm w-auto" data-sheet-select="${f.id}">
                ${f.sheets
                  .map(
                    (s) =>
                      `<option value="${util.escapeHtml(s.sheetName)}" ${
                        s.sheetName === f.selectedSheetName ? 'selected' : ''
                      }>${util.escapeHtml(s.sheetName)}</option>`
                  )
                  .join('')}
              </select>`
            : '';

        return `
        <div class="mw-card mb-3" data-file-id="${f.id}">
          <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
            <label class="form-check d-flex align-items-center gap-2 mb-0">
              <input class="form-check-input mt-0" type="radio" name="mw-template-radio" value="${f.id}" ${
          isTemplate ? 'checked' : ''
        }>
              <span class="fw-semibold">${util.escapeHtml(f.fileName)}</span>
              ${isTemplate ? '<span class="badge bg-success">Template</span>' : ''}
            </label>
            ${sheetOptions}
          </div>
          ${renderPreviewTable(sheet)}
          ${
            isTemplate
              ? `
            <div class="form-check form-switch mt-3">
              <input class="form-check-input" type="checkbox" id="mw-keep-data-${f.id}" data-keep-data ${
                  data.targetSchema?.keepExistingData ? 'checked' : ''
                }>
              <label class="form-check-label small" for="mw-keep-data-${f.id}">
                Giữ dữ liệu gốc của template (nối tiếp phía dưới) — bỏ chọn để xoá và ghi đè
              </label>
            </div>`
              : ''
          }
        </div>`;
      })
      .join('');

    nextBtn.disabled = !state.canProceed(2);
  };

  container.addEventListener('change', (e) => {
    const radio = e.target.closest('input[name="mw-template-radio"]');
    if (radio) {
      state.setTemplate(radio.value);
      render();
      return;
    }
    const sheetSelect = e.target.closest('[data-sheet-select]');
    if (sheetSelect) {
      state.setFileSheet(sheetSelect.dataset.sheetSelect, sheetSelect.value);
      render();
      return;
    }
    const keepToggle = e.target.closest('[data-keep-data]');
    if (keepToggle) state.setKeepExistingData(keepToggle.checked);
  });

  state.on('files-change', render);
  state.on('step-change', (step) => { if (step === 2) render(); });
  render();
})(window);
