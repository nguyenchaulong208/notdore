/**
 * invoice-ocr-app.js
 * UI orchestration cho công cụ OCR hóa đơn
 * Tối ưu cho độ chính xác cao
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

  let rows = [];
  let rowSeq = 0;
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

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  async function callOcrApi(blob) {
    // Nén ảnh để giảm kích thước
    const compressedBlob = await compressImage(blob);
    const dataUrl = await blobToBase64(compressedBlob);
    
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
    return json;
  }

  // Nén ảnh để tối ưu
  async function compressImage(blob) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = function() {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Giới hạn kích thước
        const MAX_SIZE = 2000;
        if (width > MAX_SIZE || height > MAX_SIZE) {
          const ratio = Math.min(MAX_SIZE / width, MAX_SIZE / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        // Vẽ ảnh với chất lượng cao
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob((b) => {
          resolve(b);
        }, 'image/png', 1.0);
      };
      img.src = URL.createObjectURL(blob);
    });
  }

  function updateProgress(fraction, label) {
    if (!el.progressBar) return;
    const pct = Math.round(fraction * 100);
    el.progressBar.style.width = pct + '%';
    el.progressBar.setAttribute('aria-valuenow', String(pct));
    if (label) el.progressLabel.textContent = label;
  }

  // Chuyển đổi file sang ảnh với chất lượng cao
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
      // Scale cao để OCR tốt hơn
      const viewport = page.getViewport({ scale: 3.5 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      
      // Render với chất lượng cao
      await page.render({ 
        canvasContext: ctx, 
        viewport,
        background: 'white'
      }).promise;
      
      // Tăng cường ảnh
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const enhanced = enhanceImageForOCR(imageData);
      ctx.putImageData(enhanced, 0, 0);
      
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/png', 1.0));
      images.push({
        blob,
        pageLabel: pdf.numPages > 1 ? `${file.name} (trang ${pageNum})` : file.name,
      });
    }
    return images;
  }

  // Tăng cường ảnh cho OCR
  function enhanceImageForOCR(imageData) {
    const data = imageData.data;
    const enhanced = new Uint8ClampedArray(data);
    
    // Tăng độ tương phản và làm sắc nét
    for (let i = 0; i < enhanced.length; i += 4) {
      // Chuyển sang grayscale với trọng số
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      
      // Tăng độ tương phản
      let enhancedGray = ((gray / 255 - 0.5) * 1.5 + 0.5) * 255;
      enhancedGray = Math.max(0, Math.min(255, enhancedGray));
      
      // Làm sắc nét bằng cách tăng contrast ở vùng tối/sáng
      if (enhancedGray < 128) {
        enhancedGray = Math.max(0, enhancedGray * 0.8);
      } else {
        enhancedGray = Math.min(255, enhancedGray * 1.2);
      }
      
      enhanced[i] = enhancedGray;
      enhanced[i + 1] = enhancedGray;
      enhanced[i + 2] = enhancedGray;
    }
    
    return new ImageData(enhanced, imageData.width, imageData.height);
  }

  // Row management
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
        updateProgress(i / images.length, `${pageLabel}: đang OCR...`);
        
        // Gọi API với retry
        let ocrResult = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            ocrResult = await callOcrApi(blob);
            break;
          } catch (err) {
            console.warn(`Attempt ${attempt + 1} failed:`, err);
            if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          }
        }
        
        if (!ocrResult) {
          throw new Error('OCR failed after retries');
        }
        
        const { fields } = ocrResult;
        const thumbUrl = URL.createObjectURL(blob);
        rows.push({
          id: 'row-' + (++rowSeq),
          fileName: pageLabel,
          thumbUrl,
          fields,
          status: 'ok',
        });
        renderPreviewRow(rows[rows.length - 1]);
      }
      setQueueStatus(li, 'Hoàn tất', 'bg-success');
    } catch (err) {
      console.error('OCR error for', file.name, err);
      setQueueStatus(li, 'Lỗi: ' + err.message, 'bg-danger');
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
    delBtn.addEventListener('click', () => removeRow(row.id));
    actionTd.appendChild(delBtn);
    tr.appendChild(actionTd);

    el.previewTableBody.appendChild(tr);
  }

  function removeRow(id) {
    rows = rows.filter((r) => r.id !== id);
    const tr = qs(id);
    if (tr) tr.remove();
    el.exportBtn.disabled = rows.length === 0;
  }

  function exportToExcel() {
    if (!rows.length) return;
    const header = FIELD_DEFS.map((f) => f.label);
    const data = rows.map((r) => FIELD_DEFS.map((f) => r.fields[f.key] ?? ''));

    const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
    ws['!cols'] = FIELD_DEFS.map((f) =>
      f.key === 'diaChi' || f.key === 'khachHang' ? { wch: 50 } : { wch: 20 }
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bảng kê hóa đơn');

    const ts = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `bang-ke-hoa-don-${ts}.xlsx`);
  }

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

  function init() {
    initDom();
    if (!el.fileInput) return;

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
      if (e.target === el.fileInput) return;
      el.fileInput.click();
    });

    el.exportBtn.addEventListener('click', exportToExcel);
    el.clearBtn.addEventListener('click', clearAll);

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
