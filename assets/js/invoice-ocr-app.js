/**
 * invoice-ocr-app.js
 * UI orchestration for the Invoice OCR tool. Fully client-side, no backend:
 *   - PDF with a real text layer -> IOCR.VatParser (regex, no AI call)
 *   - Photos / scanned PDFs      -> IOCR.Vision (Gemini or DeepSeek,
 *                                   called directly from the browser using
 *                                   the user's OWN API key — image and key
 *                                   never touch NotDore's server)
 * Depends on globals: pdfjsLib, XLSX, window.IOCR.Vision, window.IOCR.VatParser.
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

  let rows = []; // { id, fileName, thumbUrl, fields: {...}, rawText, status }
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
      settingsBtn: qs('iocrSettingsBtn'),
      settingsModalBackdrop: qs('iocrSettingsBackdrop'),
      settingsProvider: qs('iocrSettingsProvider'),
      settingsApiKey: qs('iocrSettingsApiKey'),
      settingsSaveBtn: qs('iocrSettingsSaveBtn'),
      settingsClearBtn: qs('iocrSettingsClearBtn'),
      settingsCloseBtn: qs('iocrSettingsCloseBtn'),
      settingsHelpLink: qs('iocrSettingsHelpLink'),
      settingsStatus: qs('iocrSettingsStatus'),
    };
  }

  function updateProgress(fraction, label) {
    if (!el.progressBar) return;
    const pct = Math.round(fraction * 100);
    el.progressBar.style.width = pct + '%';
    el.progressBar.setAttribute('aria-valuenow', String(pct));
    if (label) el.progressLabel.textContent = label;
  }

  // ---- Settings modal (API key + provider) ----

  const PROVIDER_HELP_URLS = {
    gemini: 'https://aistudio.google.com/apikey',
    deepseek: 'https://platform.deepseek.com/api_keys',
  };

  function refreshSettingsUi() {
    const s = ns.Vision.getSettings();
    if (el.settingsProvider) el.settingsProvider.value = (s && s.provider) || 'gemini';
    if (el.settingsApiKey) el.settingsApiKey.value = (s && s.apiKey) || '';
    updateSettingsHelpLink();
    updateSettingsButtonBadge();
  }

  function updateSettingsHelpLink() {
    if (!el.settingsHelpLink || !el.settingsProvider) return;
    el.settingsHelpLink.href = PROVIDER_HELP_URLS[el.settingsProvider.value] || '#';
  }

  function updateSettingsButtonBadge() {
    if (!el.settingsBtn) return;
    const s = ns.Vision.getSettings();
    const configured = !!(s && s.apiKey);
    el.settingsBtn.classList.toggle('btn-outline-secondary', configured);
    el.settingsBtn.classList.toggle('btn-warning', !configured);
    el.settingsBtn.title = configured
      ? `Đã cấu hình ${s.provider === 'deepseek' ? 'DeepSeek' : 'Gemini'}`
      : 'Chưa cấu hình API key AI — bấm để thiết lập';
  }

  function openSettings() {
    refreshSettingsUi();
    if (el.settingsModalBackdrop) el.settingsModalBackdrop.classList.remove('d-none');
  }

  function closeSettings() {
    if (el.settingsModalBackdrop) el.settingsModalBackdrop.classList.add('d-none');
  }

  function saveSettingsFromForm() {
    const provider = el.settingsProvider.value;
    const apiKey = el.settingsApiKey.value.trim();
    if (!apiKey) {
      if (el.settingsStatus) el.settingsStatus.textContent = 'Vui lòng nhập API key.';
      return;
    }
    ns.Vision.saveSettings({ provider, apiKey });
    updateSettingsButtonBadge();
    if (el.settingsStatus) el.settingsStatus.textContent = 'Đã lưu — chỉ lưu trong trình duyệt này.';
    setTimeout(closeSettings, 600);
  }

  function clearSettingsFromForm() {
    ns.Vision.clearSettings();
    refreshSettingsUi();
    if (el.settingsStatus) el.settingsStatus.textContent = 'Đã xóa API key khỏi trình duyệt.';
  }

  // ---- file -> item(s) ----
  // Each item is EITHER { text, thumbBlob, pageLabel } for a real digital
  // PDF page (text layer read directly via pdf.js — no AI call needed,
  // instant and 100% accurate) OR { blob, pageLabel } for anything that
  // needs AI vision (plain images, or a scanned/photographed PDF page).

  const MIN_TEXT_LAYER_CHARS = 40; // below this, treat as a scanned image

  async function fileToItems(file) {
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
      return pdfToItems(file);
    }
    return [{ blob: file, pageLabel: file.name }];
  }

  async function renderPageToBlob(page, scale) {
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    return new Promise((res) => canvas.toBlob(res, 'image/png'));
  }

  async function extractPdfPageText(page) {
    const content = await page.getTextContent();
    let text = '';
    for (const item of content.items) {
      text += item.str;
      text += item.hasEOL ? '\n' : ' ';
    }
    return text.trim();
  }

  async function pdfToItems(file) {
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const items = [];
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const pageLabel = pdf.numPages > 1 ? `${file.name} (trang ${pageNum})` : file.name;
      const text = await extractPdfPageText(page);

      if (text.replace(/\s/g, '').length >= MIN_TEXT_LAYER_CHARS) {
        const thumbBlob = await renderPageToBlob(page, 0.5); // cheap thumbnail only
        items.push({ text, thumbBlob, pageLabel });
      } else {
        const blob = await renderPageToBlob(page, 2.5); // full res for AI vision
        items.push({ blob, pageLabel });
      }
    }
    return items;
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

  function parseVatInvoiceText(text) {
    // client-side only, no AI call — real PDF text layer, always accurate
    return { fields: ns.VatParser.parseVatInvoice(text), text };
  }

  async function processFile(file) {
    const li = addQueueEntry(file.name);
    try {
      setQueueStatus(li, 'Đang chuyển đổi...', 'bg-info');
      const items = await fileToItems(file);

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        let result;

        if (item.text) {
          setQueueStatus(li, `Đọc PDF (${i + 1}/${items.length})...`, 'bg-info');
          updateProgress(i / items.length, `${item.pageLabel}: đọc trực tiếp từ PDF...`);
          result = parseVatInvoiceText(item.text);
        } else {
          const settings = ns.Vision.getSettings();
          if (!settings || !settings.apiKey) {
            setQueueStatus(li, 'Chưa cấu hình AI', 'bg-warning text-dark');
            openSettings();
            return;
          }
          setQueueStatus(li, `Đang nhận diện AI (${i + 1}/${items.length})...`, 'bg-info');
          updateProgress(i / items.length, `${item.pageLabel}: đang gửi cho ${settings.provider === 'deepseek' ? 'DeepSeek' : 'Gemini'}...`);
          result = await ns.Vision.recognizeImage(item.blob);
        }

        const thumbUrl = item.thumbBlob
          ? URL.createObjectURL(item.thumbBlob)
          : (item.blob ? URL.createObjectURL(item.blob) : '');

        rows.push({
          id: 'row-' + (++rowSeq),
          fileName: item.pageLabel,
          thumbUrl,
          fields: result.fields,
          rawText: result.text || '',
          status: 'ok',
        });
        renderPreviewRow(rows[rows.length - 1]);
      }
      setQueueStatus(li, 'Hoàn tất', 'bg-success');
    } catch (err) {
      console.error('Lỗi xử lý', file.name, err);
      setQueueStatus(li, err.code === 'NO_API_KEY' ? 'Chưa cấu hình AI' : 'Lỗi', 'bg-danger');
      if (err.code === 'NO_API_KEY') openSettings();
    }
  }

  async function processAll(files) {
    if (!files.length) return;
    el.processBtn && (el.processBtn.disabled = true);
    el.progressWrap.classList.remove('d-none');
    el.previewSection.classList.remove('d-none');
    el.emptyState.classList.add('d-none');

    for (let i = 0; i < files.length; i++) {
      updateProgress(0, `File ${i + 1}/${files.length}: ${files[i].name}`);
      await processFile(files[i]);
    }

    updateProgress(1, 'Hoàn tất tất cả');
    el.processBtn && (el.processBtn.disabled = false);
    el.exportBtn.disabled = rows.length === 0;
  }

  // ---- preview table ----

  function renderPreviewRow(row) {
    const tr = document.createElement('tr');
    tr.id = row.id;

    const thumbTd = document.createElement('td');
    thumbTd.innerHTML = row.thumbUrl
      ? `<img src="${row.thumbUrl}" alt="" style="width:56px;height:auto;border:1px solid #ddd;cursor:pointer" data-full="${row.thumbUrl}">`
      : `<i class="fa fa-file-pdf text-muted" title="PDF (đọc trực tiếp, không cần AI)"></i>`;
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
      rawBtn.title = 'Xem text gốc (để đối chiếu khi kết quả sai)';
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
    rows.forEach((r) => r.thumbUrl && URL.revokeObjectURL(r.thumbUrl));
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

    // settings modal
    if (el.settingsBtn) el.settingsBtn.addEventListener('click', openSettings);
    if (el.settingsCloseBtn) el.settingsCloseBtn.addEventListener('click', closeSettings);
    if (el.settingsSaveBtn) el.settingsSaveBtn.addEventListener('click', saveSettingsFromForm);
    if (el.settingsClearBtn) el.settingsClearBtn.addEventListener('click', clearSettingsFromForm);
    if (el.settingsProvider) el.settingsProvider.addEventListener('change', updateSettingsHelpLink);
    if (el.settingsModalBackdrop) {
      el.settingsModalBackdrop.addEventListener('click', (e) => {
        if (e.target === el.settingsModalBackdrop) closeSettings();
      });
    }
    updateSettingsButtonBadge();

    if (typeof pdfjsLib !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
    }
  }

  document.addEventListener('DOMContentLoaded', init);

  ns.App = { processAll, exportToExcel, clearAll };
})(window);
