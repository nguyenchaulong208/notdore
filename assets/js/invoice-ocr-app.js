/**
 * invoice-ocr-app.js
 * UI orchestration for the Invoice OCR tool: upload -> render (PDF pages to
 * canvas) -> OCR via backend (POST /api/ocr, Python + bundled Tesseract on
 * Vercel) -> editable preview -> export to Excel (SheetJS).
 *
 * Depends on globals: pdfjsLib, XLSX. Field parsing happens server-side
 * (api/ocr.py); the client just renders whatever `fields` the API returns.
 */
(function (global) {
  'use strict';

  const ns = (global.IOCR = global.IOCR || {});

  const FIELD_DEFS = [
    { key: 'ngay', label: 'Ngày' },
    { key: 'soHoaDon', label: 'Số hóa đơn' },
    { key: 'maTraCuu', label: 'Mã tra cứu' },
    { key: 'soTien', label: 'Số tiền' },
    { key: 'maSoThue', label: 'Mã số thuế' },
    { key: 'khachHang', label: 'Khách hàng' },
    { key: 'diaChi', label: 'Địa chỉ' },
    { key: 'link', label: 'Link tra cứu' },
  ];

  const OCR_ENDPOINT = '/api/ocr';

  let rows = []; // { id, fileName, thumbUrl, fields: {...}, status }
  let rowSeq = 0;

  // ---- DOM refs (resolved on init) ----
  let el = {};

  function qs(id) {
    return document.getElementById(id);
  }

  function initDom() {
    el = {
      fileInput: qs('iocrFileInput'),
      dropZone: qs('iocrDropZone'),
      processBtn: qs('iocrProcessBtn'),
      exportBtn: qs('iocrExportBtn'),
      clearBtn: qs('iocrClearBtn'),
      queueList: qs('iocrQueueList'),
      progressWrap: qs('iocrProgressWrap'),
      progressBar: qs('iocrProgressBar'),
      progressLabel: qs('iocrProgressLabel'),
      previewSection: qs('iocrPreviewSection'),
      previewTableBody: qs('iocrPreviewTableBody'),
      emptyState: qs('iocrEmptyState'),
    };
  }

  // ---- backend OCR call ----

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result); // data:...;base64,XXXX
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  async function callOcrApi(blob) {
    const dataUrl = await blobToBase64(blob);
    const res = await fetch(OCR_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: dataUrl }),
    });
    let json;
    try {
      json = await res.json();
    } catch {
      throw new Error(`Phản hồi không hợp lệ từ máy chủ (HTTP ${res.status})`);
    }
    if (!res.ok) {
      throw new Error(json.error || `Lỗi máy chủ (HTTP ${res.status})`);
    }
    return json; // { text, fields }
  }

  function updateProgress(fraction, label) {
    if (!el.progressBar) return;
    const pct = Math.round(fraction * 100);
    el.progressBar.style.width = pct + '%';
    el.progressBar.setAttribute('aria-valuenow', String(pct));
    if (label) el.progressLabel.textContent = label;
  }

  // ---- file -> image(s) ----

  async function fileToImages(file) {
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
      return pdfToImages(file);
    }
    return [{ blob: file, pageLabel: file.name }];
  }

  async function pdfToImages(file) {
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const images = [];
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.5 }); // higher scale = better OCR
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
      images.push({
        blob,
        pageLabel: pdf.numPages > 1 ? `${file.name} (trang ${pageNum})` : file.name,
      });
    }
    return images;
  }

  // ---- row management ----

  function addQueueEntry(fileName) {
    const li = document.createElement('li');
    li.className = 'list-group-item d-flex justify-content-between align-items-center';
    li.id = 'iocr-queue-' + (++rowSeq);
    li.innerHTML = `<span>${escapeHtml(fileName)}</span><span class="badge bg-secondary">Chờ xử lý</span>`;
    el.queueList.appendChild(li);
    return li;
  }

  function setQueueStatus(li, text, cls) {
    const badge = li.querySelector('.badge');
    badge.textContent = text;
    badge.className = 'badge ' + cls;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  async function processFile(file) {
    const li = addQueueEntry(file.name);
    try {
      setQueueStatus(li, 'Đang chuyển đổi...', 'bg-info');
      const images = await fileToImages(file);

      setQueueStatus(li, `OCR (0/${images.length})...`, 'bg-info');

      for (let i = 0; i < images.length; i++) {
        const { blob, pageLabel } = images[i];
        setQueueStatus(li, `OCR (${i + 1}/${images.length})...`, 'bg-info');
        updateProgress(i / images.length, `${pageLabel}: đang OCR trên máy chủ...`);
        const { fields, text, version } = await callOcrApi(blob);
        if (version && !ns._loggedVersion) {
          console.info('[IOCR] api/ocr.py version:', version);
          ns._loggedVersion = true;
        }
        const thumbUrl = URL.createObjectURL(blob);
        rows.push({
          id: 'row-' + (++rowSeq),
          fileName: pageLabel,
          thumbUrl,
          fields,
          rawText: text || '',
          status: 'ok',
        });
        renderPreviewRow(rows[rows.length - 1]);
      }
      setQueueStatus(li, 'Hoàn tất', 'bg-success');
    } catch (err) {
      console.error('OCR error for', file.name, err);
      setQueueStatus(li, 'Lỗi', 'bg-danger');
    }
  }

  async function processAll(files) {
    if (!files.length) return;
    el.processBtn.disabled = true;
    el.progressWrap.classList.remove('d-none');
    el.previewSection.classList.remove('d-none');
    el.emptyState.classList.add('d-none');

    for (let i = 0; i < files.length; i++) {
      updateProgress(0, `File ${i + 1}/${files.length}: ${files[i].name}`);
      await processFile(files[i]);
    }

    updateProgress(1, 'Hoàn tất tất cả');
    el.processBtn.disabled = false;
    el.exportBtn.disabled = rows.length === 0;
  }

  // ---- preview table ----

  function renderPreviewRow(row) {
    const tr = document.createElement('tr');
    tr.id = row.id;

    const thumbTd = document.createElement('td');
    thumbTd.innerHTML = `<img src="${row.thumbUrl}" alt="" style="width:56px;height:auto;border:1px solid #ddd;cursor:pointer" data-full="${row.thumbUrl}">`;
    tr.appendChild(thumbTd);

    FIELD_DEFS.forEach(({ key }) => {
      const td = document.createElement('td');
      td.contentEditable = 'true';
      td.className = 'iocr-editable-cell';
      td.dataset.key = key;
      td.textContent = row.fields[key] ?? '';
      td.addEventListener('input', () => {
        row.fields[key] = td.textContent.trim();
      });
      tr.appendChild(td);
    });

    const actionTd = document.createElement('td');
    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-sm btn-outline-danger';
    delBtn.innerHTML = '<i class="fa fa-trash"></i>';
    delBtn.title = 'Xóa dòng';
    delBtn.addEventListener('click', () => removeRow(row.id));
    actionTd.appendChild(delBtn);

    if (row.rawText) {
      const rawBtn = document.createElement('button');
      rawBtn.className = 'btn btn-sm btn-outline-secondary ms-1';
      rawBtn.innerHTML = '<i class="fa fa-file-lines"></i>';
      rawBtn.title = 'Xem text OCR gốc (để đối chiếu khi kết quả sai)';
      rawBtn.addEventListener('click', () => alert(row.rawText));
      actionTd.appendChild(rawBtn);
    }
    tr.appendChild(actionTd);

    el.previewTableBody.appendChild(tr);
  }

  function removeRow(id) {
    rows = rows.filter((r) => r.id !== id);
    const tr = qs(id);
    if (tr) tr.remove();
    el.exportBtn.disabled = rows.length === 0;
  }

  // ---- export ----

  function exportToExcel() {
    if (!rows.length) return;
    const header = FIELD_DEFS.map((f) => f.label);
    const data = rows.map((r) => FIELD_DEFS.map((f) => r.fields[f.key] ?? ''));

    const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
    ws['!cols'] = FIELD_DEFS.map((f) =>
      f.key === 'diaChi' || f.key === 'khachHang' ? { wch: 40 } : { wch: 16 }
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bảng kê hóa đơn');

    const ts = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `bang-ke-hoa-don-${ts}.xlsx`);
  }

  // ---- clear ----

  function clearAll() {
    rows.forEach((r) => URL.revokeObjectURL(r.thumbUrl));
    rows = [];
    el.queueList.innerHTML = '';
    el.previewTableBody.innerHTML = '';
    el.previewSection.classList.add('d-none');
    el.emptyState.classList.remove('d-none');
    el.exportBtn.disabled = true;
    el.progressWrap.classList.add('d-none');
    el.fileInput.value = '';
  }

  // ---- init / wiring ----

  function init() {
    initDom();
    if (!el.fileInput) return; // page doesn't have this widget

    el.fileInput.addEventListener('change', () => {
      const files = Array.from(el.fileInput.files || []);
      if (files.length) processAll(files);
    });

    ['dragover', 'dragenter'].forEach((evt) =>
      el.dropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        el.dropZone.classList.add('iocr-drop-active');
      })
    );
    ['dragleave', 'drop'].forEach((evt) =>
      el.dropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        el.dropZone.classList.remove('iocr-drop-active');
      })
    );
    el.dropZone.addEventListener('drop', (e) => {
      const files = Array.from(e.dataTransfer.files || []).filter(
        (f) => f.type.startsWith('image/') || /\.pdf$/i.test(f.name)
      );
      if (files.length) processAll(files);
    });
    el.dropZone.addEventListener('click', (e) => {
      // fileInput is nested inside dropZone, so the click() call below
      // dispatches an event that bubbles back up to dropZone. Guard
      // against that to avoid infinite recursion.
      if (e.target === el.fileInput) return;
      el.fileInput.click();
    });

    el.exportBtn.addEventListener('click', exportToExcel);
    el.clearBtn.addEventListener('click', clearAll);

    // lightbox for thumbnails
    el.previewTableBody.addEventListener('click', (e) => {
      const img = e.target.closest('img[data-full]');
      if (img) window.open(img.dataset.full, '_blank');
    });

    if (typeof pdfjsLib !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
    }
  }

  document.addEventListener('DOMContentLoaded', init);

  ns.App = { processAll, exportToExcel, clearAll };
})(window);
