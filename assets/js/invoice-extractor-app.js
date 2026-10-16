/**
 * invoice-extractor-app.js
 * Điểm nối chính giữa HTML invoice-extractor.html và các module
 * invoice-extractor-utils.js + invoice-extractor-engine.js.
 * Khai báo biến global, wiring DOM, orchestration theo processBtn.
 */
(function (global, utils, engine) {
  'use strict';

  if (!utils || !engine) {
    console.error('invoice-extractor-app: thiếu module. Đảm bảo đã loadinvoice-extractor-utils.js và invoice-extractor-engine.js trước file này.');
    return;
  }

  const {
    extractPdfText,
    hasUsableTextLayer,
    renderPdfPageAsDataUrl,
    renderImageFileAsDataUrl,
    buildDynamicBatches,
    runPool,
    checkLibs,
    updateProgress,
  } = utils;

  const {
    loadModels,
    processFileGroup,
    processSingleImageFile,
    getConfig,
  } = engine;

  // ---- DOM refs ----
  let el = {};

  function initDom() {
    el = {
      fileInput: document.getElementById('fileInput'),
      addFilesBtn: document.getElementById('addFilesBtn'),
      clearFilesBtn: document.getElementById('clearFilesBtn'),
      fileListEl: document.getElementById('fileList'),
      fileCountEl: document.getElementById('fileCount'),
      processBtn: document.getElementById('processBtn'),
      exportBtn: document.getElementById('exportBtn'),
      progressWrap: document.getElementById('progressWrap'),
      progressBar: document.getElementById('progressBar'),
      progressText: document.getElementById('progressText'),
      resultsBody: document.getElementById('resultsBody'),
      resultCountEl: document.getElementById('resultCount'),
      loadModelsBtn: document.getElementById('loadModelsBtn'),
      modelSelect: document.getElementById('modelSelect'),
      modelInput: document.getElementById('modelInput'),
      modelStatus: document.getElementById('modelStatus'),
      baseUrl: document.getElementById('baseUrl'),
      libWarning: document.getElementById('libWarning'),
    };
  }

  // ---- state ----
  let selectedFiles = []; // {file, id, status, note, text?, imageDataUrl?}
  let results = [];
  let resultsMap = new Map();
  let fileIdCounter = 0;

  // ---- render file list ----
  function renderFileList() {
    el.fileListEl.innerHTML = '';
    selectedFiles.forEach(sf => {
      const row = document.createElement('div');
      row.className = 'file-row ' + sf.status;
      const icon = sf.status === 'ok' ? 'fa-check' : sf.status === 'err' ? 'fa-xmark' : sf.status === 'busy' ? 'fa-spinner fa-spin' : 'fa-clock';
      row.innerHTML =
        `<span><i class="fa-solid ${icon}"></i> ${sf.file.name} <small class="text-muted">(${(sf.file.size / 1024).toFixed(0)} KB)</small></span>` +
        `<span>${sf.note ? '<small>' + sf.note + '</small> ' : ''}<button class="btn btn-sm btn-link text-danger p-0 remove-btn" data-id="${sf.id}"><i class="fa-solid fa-trash-can"></i></button></span>`;
      el.fileListEl.appendChild(row);
    });
    el.fileListEl.querySelectorAll('.remove-btn').forEach(btn => {
      btn.onclick = () => {
        selectedFiles = selectedFiles.filter(sf => sf.id != btn.dataset.id);
        renderFileList();
      };
    });
    el.fileCountEl.textContent = `${selectedFiles.length} file đã chọn`;
    el.processBtn.disabled = selectedFiles.length === 0;
  }

  // ---- set result ----
  function setResult(sf, rec, errorMsg) {
    resultsMap.set(sf.id, { file_name: sf.file.name, ...rec, _error: errorMsg || '' });
  }

  // ---- refresh results ----
  function refreshResultsFromMap() {
    results = selectedFiles.filter(sf => resultsMap.has(sf.id)).map(sf => resultsMap.get(sf.id));
    renderResults();
  }

  // ---- render results table ----
  function renderResults() {
    el.resultsBody.innerHTML = '';
    results.forEach((r, i) => {
      const tr = document.createElement('tr');
      if (r._error) tr.classList.add('table-danger');
      tr.innerHTML =
        `<td>${i + 1}</td><td>${r.file_name || ''}</td><td>${r.loai_chung_tu || ''}</td>` +
        `<td>${r.ky_hieu || ''}</td><td>${r.so || ''}</td><td>${r.ngay || ''}</td>` +
        `<td>${r.don_vi_ban || ''}</td><td>${r.mst_ban || ''}</td>` +
        `<td>${r.don_vi_mua || ''}</td><td>${r.mst_mua || ''}</td>` +
        `<td>${r.noi_dung || ''}</td>` +
        `<td>${r.tien_truoc_thue ?? ''}</td><td>${r.thue_suat || ''}</td>` +
        `<td>${r.tien_thue ?? ''}</td><td>${r.tong_tien ?? ''}</td><td>${r.hinh_thuc_tt || ''}</td>` +
        `<td class="text-danger">${r._error || ''}</td>`;
      el.resultsBody.appendChild(tr);
    });
    el.resultCountEl.textContent = results.length;
  }

  // ---- export Excel ----
  function exportToExcel() {
    const headers = ['File nguồn', 'Loại chứng từ', 'Ký hiệu', 'Số', 'Ngày', 'Đơn vị bán', 'MST bán', 'Đơn vị mua', 'MST mua', 'Nội dung', 'Tiền trước thuế', 'Thuế suất', 'Tiền thuế', 'Tổng tiền', 'Hình thức TT', 'Lỗi'];
    const rows = results.map(r => [
      r.file_name || '', r.loai_chung_tu || '', r.ky_hieu || '', r.so || '', r.ngay || '',
      r.don_vi_ban || '', r.mst_ban || '', r.don_vi_mua || '', r.mst_mua || '',
      r.noi_dung || '', r.tien_truoc_thue ?? '', r.thue_suat || '', r.tien_thue ?? '', r.tong_tien ?? '', r.hinh_thuc_tt || '', r._error || '',
    ]);
    const ws = global.XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = headers.map(() => ({ wch: 18 }));
    const wb = global.XLSX.utils.book_new();
    global.XLSX.utils.book_append_sheet(wb, ws, 'Bang ke');
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    global.XLSX.writeFile(wb, `bang-ke-hoa-don-${stamp}.xlsx`);
  }

  // ---- Process button ----
  async function onProcess() {
    el.processBtn.disabled = true;
    el.exportBtn.disabled = true;
    resultsMap = new Map();
    results = [];
    el.resultsBody.innerHTML = '';
    selectedFiles.forEach(sf => { sf.status = 'pending'; sf.note = ''; sf.text = ''; sf.imageDataUrl = ''; });
    renderFileList();

    const cfg = getConfig();
    const batchSizeMax = cfg.batchSize;
    const maxChars = cfg.maxChars;
    const concurrency = cfg.concurrency;

    // Bước 1: đọc text tất cả PDF có text layer, đánh dấu file cần vision
    let readDone = 0;
    updateProgress(el.progressWrap, el.progressBar, el.progressText, 0, selectedFiles.length, 'Đang đọc nội dung PDF...');
    await runPool(selectedFiles, Math.max(concurrency, 3), async (sf) => {
      try {
        if (sf.file.type === 'application/pdf' || /\.pdf$/i.test(sf.file.name)) {
          sf.text = await extractPdfText(sf.file);
          sf.needsVision = !hasUsableTextLayer(sf.text);
          if (sf.needsVision) {
            // Render tất cả page thành ảnh (giới hạn 20 page để tránh quá tải)
            const pdfBuf = await sf.file.arrayBuffer();
            const pdf = await global.pdfjsLib.getDocument({ data: pdfBuf }).promise;
            const numPages = Math.min(pdf.numPages, 20);
            const imageUrls = [];
            for (let p = 1; p <= numPages; p++) {
              imageUrls.push(await renderPdfPageAsDataUrl(sf.file, p, 2));
            }
            sf.imageDataUrls = imageUrls;
          }
        } else if (sf.file.type.startsWith('image/')) {
          // File ảnh đơn lẻ
          sf.imageDataUrls = [await renderImageFileAsDataUrl(sf.file)];
          sf.needsVision = true;
        }
      } catch (err) {
        sf.status = 'err';
        sf.note = 'Lỗi đọc file: ' + err.message;
        setResult(sf, {}, sf.note);
      }
      readDone++;
      updateProgress(el.progressWrap, el.progressBar, el.progressText, readDone, selectedFiles.length,
        `Đang đọc PDF... ${readDone}/${selectedFiles.length}`);
      renderFileList();
    });
    refreshResultsFromMap();

    // Bước 2: xử lý file cần vision (render ảnh rồi gửi)
    await runPool(selectedFiles.filter(sf => sf.needsVision && sf.status === 'pending'), concurrency, async (sf) => {
      sf.status = 'busy';
      renderFileList();
      // Gửi từng ảnh/page riêng để tránh vượt token limit
      // FIX: giới hạn 10 page thay vì 20 để tránh token overload
      const numPages = Math.min(sf.imageDataUrls.length, 10);
      for (let p = 0; p < numPages; p++) {
        const batch = [{ sf, text: sf.text, imageDataUrl: sf.imageDataUrls[p] }];
        await processFileGroup(batch, engine.callLMStudio);
      }
    });

    // Bước 3: chia lô động theo cả số file lẫn tổng ký tự, gửi song song tới LM Studio
    const toProcess = selectedFiles.filter(sf => sf.status !== 'err' && !sf.needsVision);
    const batches = buildDynamicBatches(toProcess.map(sf => ({ sf, text: sf.text, imageDataUrl: null })), batchSizeMax, maxChars);
    updateProgress(el.progressWrap, el.progressBar, el.progressText, readDone - toProcess.length, selectedFiles.length,
      `Đang gửi ${batches.length} lô tới LM Studio (song song ${concurrency})...`);

    await runPool(batches, concurrency, async (batch) => {
      batch.forEach(item => { item.sf.status = 'busy'; });
      renderFileList();
      await processFileGroup(batch, engine.callLMStudio);
      const done = selectedFiles.filter(sf => sf.status === 'ok' || sf.status === 'err').length;
      updateProgress(el.progressWrap, el.progressBar, el.progressText, done, selectedFiles.length,
        `Đã xử lý ${done}/${selectedFiles.length} file`);
    });

    updateProgress(el.progressWrap, el.progressBar, el.progressText, selectedFiles.length, selectedFiles.length, 'Hoàn tất.');
    el.processBtn.disabled = false;
    el.exportBtn.disabled = resultsMap.size === 0;
  }

  // ---- Wiring ----
  function init() {
    initDom();

    // Library check
    if (!checkLibs(el.libWarning)) return;

    // File input
    el.addFilesBtn.onclick = () => el.fileInput.click();
    el.fileInput.onchange = (e) => {
      const incoming = Array.from(e.target.files);
      incoming.forEach(f => {
        const dup = selectedFiles.some(sf => sf.file.name === f.name && sf.file.size === f.size);
        if (!dup) selectedFiles.push({ file: f, id: ++fileIdCounter, status: 'pending', note: '', text: '', imageDataUrl: '', needsVision: false });
      });
      el.fileInput.value = '';
      renderFileList();
    };
    el.clearFilesBtn.onclick = () => { selectedFiles = []; renderFileList(); };

    // Model load
    el.loadModelsBtn.onclick = () => loadModels(el.modelSelect, el.modelStatus);

    // Process
    el.processBtn.onclick = onProcess;

    // Export
    el.exportBtn.onclick = exportToExcel;
  }

  document.addEventListener('DOMContentLoaded', init);

  // Public interface đơn giản
  global.InvoiceExtractorApp = { renderFileList, refreshResultsFromMap, setResult };
})(window, window.InvoiceExtractorUtils, window.InvoiceExtractorEngine);
