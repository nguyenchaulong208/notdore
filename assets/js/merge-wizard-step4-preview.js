/**
 * merge-wizard-step4-preview.js
 * Vào Step 4 -> nếu mergedDirty thì gọi worker.mergeSources rồi cache vào state.mergedRows.
 * Bảng kết quả cho sửa trực tiếp (contenteditable) trước khi ghi file thật ở Step 5.
 */
(function (global) {
  'use strict';

  const { state, util } = global.MW;
  const thead = document.getElementById('mw-result-thead');
  const tbody = document.getElementById('mw-result-tbody');
  const pagination = document.getElementById('mw-result-pagination');
  const nextBtn = document.getElementById('mw-btn-next');

  if (!thead) return;

  const PAGE_SIZE = 50;
  let currentPage = 1;

  const columns = () => state.get().targetSchema?.columns || [];

  const renderHead = () => {
    thead.innerHTML = `<tr>${columns()
      .map((c) => `<th>${util.escapeHtml(c.label)}</th>`)
      .join('')}<th></th></tr>`;
  };

  const renderBody = () => {
    const rows = state.get().mergedRows;
    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    currentPage = Math.min(currentPage, totalPages);
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageRows = rows.slice(start, start + PAGE_SIZE);

    tbody.innerHTML = pageRows.length
      ? pageRows
          .map(
            (row, i) => `
      <tr data-row-idx="${start + i}">
        ${columns()
          .map((c) => `<td contenteditable="true" data-key="${c.key}">${util.escapeHtml(row[c.key] ?? '')}</td>`)
          .join('')}
        <td><button type="button" class="btn btn-sm btn-outline-danger" data-delete-row aria-label="Xoá dòng"><i class="fa-solid fa-trash"></i></button></td>
      </tr>`
          )
          .join('')
      : `<tr><td colspan="99" class="text-center text-muted py-4">Không có dòng dữ liệu nào sau khi ghép.</td></tr>`;

    pagination.innerHTML = `
      <span class="text-muted small">${rows.length} dòng — Trang ${currentPage}/${totalPages}</span>
      <div class="btn-group btn-group-sm">
        <button type="button" class="btn btn-outline-secondary" data-page="prev" ${currentPage <= 1 ? 'disabled' : ''}>Trước</button>
        <button type="button" class="btn btn-outline-secondary" data-page="next" ${currentPage >= totalPages ? 'disabled' : ''}>Sau</button>
      </div>`;
  };

  const showLoading = () => {
    thead.innerHTML = '';
    tbody.innerHTML = `<tr><td class="text-center text-muted py-4">
      <i class="fa-solid fa-spinner fa-spin me-1"></i>Đang ghép dữ liệu...</td></tr>`;
    pagination.innerHTML = '';
  };

  const showError = (message) => {
    tbody.innerHTML = `<tr><td class="text-danger text-center py-4">Lỗi khi ghép: ${util.escapeHtml(message)}</td></tr>`;
  };

  /** Đọc arrayBuffer của các file nguồn (không phải template) để gửi cho worker.mergeSources. */
  const buildSourcesPayload = async () => {
    const sourceFiles = state.getSourceFiles();
    const payload = [];
    for (const f of sourceFiles) {
      const sheet = state.getSelectedSheet(f);
      const arrayBuffer = await util.readFileAsArrayBuffer(f.rawFile);
      payload.push({
        fileName: f.fileName,
        arrayBuffer,
        sheetName: sheet.sheetName,
        headerRowIndex: sheet.headerRowIndex,
        columnMapping: f.columnMapping || [],
      });
    }
    return payload;
  };

  const runMergeIfNeeded = async () => {
    const data = state.get();
    if (!data.mergedDirty) {
      // Đã ghép từ lần trước và chưa có gì thay đổi (mapping/template) -> dùng lại cache, khỏi gọi worker lại.
      currentPage = 1;
      renderHead();
      renderBody();
      nextBtn.disabled = false;
      return;
    }
    if (!data.targetSchema) {
      showError('Chưa có Target Schema — quay lại Bước 2.');
      return;
    }

    showLoading();
    try {
      const sources = await buildSourcesPayload();
      const rows = await state.callWorker('mergeSources', { targetSchema: data.targetSchema, sources });
      state.setMergedRows(rows);
      currentPage = 1;
      renderHead();
      renderBody();
      nextBtn.disabled = false;
    } catch (err) {
      showError(err.message);
    }
  };

  tbody.addEventListener('input', (e) => {
    const td = e.target.closest('td[contenteditable]');
    if (!td) return;
    const rowIdx = Number(td.closest('tr').dataset.rowIdx);
    state.get().mergedRows[rowIdx][td.dataset.key] = td.textContent;
  });

  tbody.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-delete-row]');
    if (!btn) return;
    const rowIdx = Number(btn.closest('tr').dataset.rowIdx);
    state.get().mergedRows.splice(rowIdx, 1);
    renderBody();
  });

  pagination.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-page]');
    if (!btn) return;
    currentPage += btn.dataset.page === 'next' ? 1 : -1;
    renderBody();
  });

  state.on('step-change', (step) => { if (step === 4) runMergeIfNeeded(); });
})(window);
