/**
 * merge-wizard-step5-export.js
 * Ghi file cuối qua worker.exportWorkbook (ExcelJS, giữ style template), theo dõi progress,
 * gợi ý chuyển server nếu quá chậm (>4-5s, xem mục 2 kế hoạch), rồi tải file kết quả về máy.
 */
(function (global) {
  'use strict';

  const { state, util } = global.MW;
  const summaryEl = document.getElementById('mw-export-summary');
  const progressWrap = document.getElementById('mw-export-progress-wrap');
  const progressBar = document.getElementById('mw-export-progress-bar');
  const progressMsg = document.getElementById('mw-export-progress-msg');
  const serverHint = document.getElementById('mw-server-fallback-hint');
  const exportBtn = document.getElementById('mw-btn-export');

  if (!exportBtn) return;

  const SLOW_EXPORT_MS = 4500;

  const renderSummary = () => {
    const data = state.get();
    const templateFile = state.getFile(data.templateFileId);
    summaryEl.innerHTML = `
      <dt class="col-6">File đích</dt><dd class="col-6">${util.escapeHtml(templateFile?.fileName || '—')}</dd>
      <dt class="col-6">Sheet</dt><dd class="col-6">${util.escapeHtml(data.targetSchema?.sheetName || '—')}</dd>
      <dt class="col-6">Số dòng ghép</dt><dd class="col-6">${data.mergedRows.length}</dd>
      <dt class="col-6">Giữ dữ liệu gốc</dt><dd class="col-6">${data.targetSchema?.keepExistingData ? 'Có' : 'Không'}</dd>`;
  };

  const downloadBlob = (arrayBuffer, fileName) => {
    const blob = new Blob([arrayBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.replace(/\.xlsx?$/i, '') + '-da-ghep.xlsx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const resetProgressUi = () => {
    progressWrap.classList.remove('d-none');
    serverHint.classList.add('d-none');
    progressBar.style.width = '0%';
    progressBar.textContent = '0%';
    progressMsg.textContent = '';
  };

  const handleExport = async () => {
    const data = state.get();
    const templateFile = state.getFile(data.templateFileId);
    if (!templateFile) {
      alert('Chưa chọn file template ở Bước 2.');
      return;
    }

    exportBtn.disabled = true;
    resetProgressUi();

    const slowTimer = setTimeout(() => serverHint.classList.remove('d-none'), SLOW_EXPORT_MS);

    try {
      const templateArrayBuffer = await util.readFileAsArrayBuffer(templateFile.rawFile);
      const arrayBuffer = await state.callWorker(
        'exportWorkbook',
        { targetSchema: data.targetSchema, mergedRows: data.mergedRows, templateArrayBuffer },
        ({ percent, message }) => {
          progressBar.style.width = `${percent}%`;
          progressBar.textContent = `${percent}%`;
          progressMsg.textContent = message || '';
        }
      );

      clearTimeout(slowTimer);
      progressBar.style.width = '100%';
      progressBar.textContent = '100%';
      progressMsg.textContent = 'Hoàn tất — đang tải file...';

      state.set({ exportResult: { arrayBuffer, fileName: templateFile.fileName } });
      downloadBlob(arrayBuffer, templateFile.fileName);
    } catch (err) {
      clearTimeout(slowTimer);
      progressMsg.textContent = `Lỗi: ${err.message}`;
    } finally {
      exportBtn.disabled = false;
    }
  };

  // Người dùng có quyền ghi đè lựa chọn mặc định và chuyển sang chế độ server (mục 2, điểm 4).
  // Bản MVP client-side hiện tại chưa nối backend thật — nút này chỉ đánh dấu ý định trong state,
  // Phase 2 (Supabase Storage + Vercel function) sẽ nối logic thật vào đây.
  const useServerBtn = document.getElementById('mw-btn-use-server');
  if (useServerBtn) {
    useServerBtn.addEventListener('click', () => {
      state.set({ useServerFallback: true });
      alert('Chế độ hỗ trợ máy chủ sẽ có ở Phase 2 — hiện tại tiếp tục xử lý trên trình duyệt.');
    });
  }

  exportBtn.addEventListener('click', handleExport);
  state.on('step-change', (step) => { if (step === 5) renderSummary(); });
})(window);
