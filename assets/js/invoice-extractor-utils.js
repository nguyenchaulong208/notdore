/**
 * invoice-extractor-utils.js
 * Hàm hỗ trợ khái quát (không phụ thuộc DOM cụ thể của invoice-extractor.html).
 * Bao gồm: đọc PDF, render PDF page thành ảnh, chia batch, chạy pool,
 * parse JSON model, update progress bar.
 */
(function (global) {
  'use strict';

  // ---- PDF text extraction ----
  async function extractPdfText(file) {
    const buf = await file.arrayBuffer();
    const pdf = await global.pdfjsLib.getDocument({ data: buf }).promise;
    let fullText = '';
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const items = content.items
        .map(it => ({ str: it.str, x: it.transform[4], y: it.transform[5] }))
        .filter(it => it.str.trim() !== '');
      // Sắp xếp theo thứ tự đọc: trên->dưới, trái->phải
      items.sort((a, b) => b.y - a.y || a.x - b.x);
      const TOL = 3; // dung sai gộp cùng 1 dòng (pt)
      const lines = [];
      let curLine = [], curY = null;
      items.forEach(it => {
        if (curY === null || Math.abs(it.y - curY) <= TOL) {
          curLine.push(it);
          if (curY === null) curY = it.y;
        } else {
          lines.push(curLine.sort((a, b) => a.x - b.x));
          curLine = [it]; curY = it.y;
        }
      });
      if (curLine.length) lines.push(curLine.sort((a, b) => a.x - b.x));
      fullText += lines.map(line => line.map(w => w.str).join(' ')).join('\n') + '\n';
    }
    return fullText.trim();
  }

  // Kiểm tra text layer có đủ dùng không
  function hasUsableTextLayer(text, minChars) {
    if (minChars === undefined) minChars = 80;
    return text && text.replace(/\s/g, '').length >= minChars;
  }

  // Render 1 page PDF → data URL PNG base64 (dùng cho PDF scan không có text)
  // FIX: thêm try/catch để tránh crash khi render lỗi
  async function renderPdfPageAsDataUrl(file, pageNum, scale) {
    if (scale === undefined) scale = 2;
    const buf = await file.arrayBuffer();
    const pdf = await global.pdfjsLib.getDocument({ data: buf }).promise;
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    try {
      await page.render({ canvasContext: ctx, viewport }).promise;
    } catch (err) {
      canvas.width = 0; canvas.height = 0;
      canvas.toBlob = () => null;
      console.warn('renderPdfPageAsDataUrl: render error', err);
    }
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) { reject(new Error('Không render được page (lỗi canvas)')); return; }
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      }, 'image/png');
    });
  }

  // Read 1 image file trực tiếp → data URL (không qua canvas)
  async function renderImageFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  // FIX: tăng maxChars lên 8000, giữ nguyên maxCount=8 để không vượt token limit
  function buildDynamicBatches(items, maxCount, maxChars) {
    const batches = [];
    let cur = [], curChars = 0;
    items.forEach(sf => {
      const len = sf.imageDataUrl ? 2000 : (sf.text ? sf.text.length : 0);
      if (cur.length > 0 && (cur.length >= maxCount || curChars + len > maxChars)) {
        batches.push(cur); cur = []; curChars = 0;
      }
      cur.push(sf); curChars += len;
    });
    if (cur.length) batches.push(cur);
    return batches;
  }

  async function runPool(items, limit, worker) {
    let idx = 0;
    const runners = new Array(Math.min(limit, items.length) || 1).fill(0).map(async () => {
      while (idx < items.length) {
        const cur = items[idx++];
        await worker(cur);
      }
    });
    await Promise.all(runners);
  }

  function chunk(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  // ---- JSON parsing ----
  // FIX: parseModelJson ưu tiên dùng schema để tránh parse sai
  function parseModelJson(raw, schema) {
    let cleaned = raw.trim()
      .replace(/^```json/i, '')
      .replace(/^```/i, '')
      .replace(/```$/, '')
      .trim();

    // Nếu có schema, cố gắng extract từng phần tử JSON trong mảng
    if (schema) {
      try {
        return parseModelJsonWithSchema(cleaned, schema);
      } catch (e) {
        console.warn('parseModelJson: schema parse fail, fallback.', e);
      }
    }

    try { return JSON.parse(cleaned); } catch (e) {}

    // Thử tìm mảng JSON trong text
    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');
    if (start !== -1 && end !== -1) {
      try { return JSON.parse(cleaned.slice(start, end + 1)); } catch (e) {}
    }

    // Fallback: extract JSON bằng regex
    const jsonStr = cleaned.match(/\{[\s\S]*\}/g);
    if (jsonStr) {
      try { return JSON.parse(jsonStr[0]); } catch (e) {}
    }

    throw new Error('Không phân tích được JSON trả về từ model. Kiểm tra lại output của model.');
  }

  // Helper: parse mảng JSON theo schema
  function parseModelJsonWithSchema(raw, schema) {
    const start = raw.indexOf('[');
    const end = raw.lastIndexOf(']');
    if (start === -1 || end === -1) {
      // Có thể là object không phải mảng
      try { return [JSON.parse(raw)]; } catch (e) { throw e; }
    }
    const jsonStr = raw.slice(start, end + 1);
    const arr = JSON.parse(jsonStr);
    if (!Array.isArray(arr)) return [arr];
    return arr;
  }

  // ---- progress ----
  function updateProgress(progressWrap, progressBar, progressText, done, total, msg) {
    progressWrap.classList.remove('d-none');
    const pct = total ? Math.round((done / total) * 100) : 0;
    progressBar.style.width = pct + '%';
    progressBar.textContent = pct + '%';
    progressText.textContent = msg || '';
  }

  // ---- library check ----
  function checkLibs(libWarningEl) {
    const missingLibs = [];
    if (typeof global.pdfjsLib === 'undefined') missingLibs.push('pdf.js (đọc PDF)');
    if (typeof global.XLSX === 'undefined') missingLibs.push('SheetJS (xuất Excel)');
    if (missingLibs.length) {
      libWarningEl.classList.remove('d-none');
      libWarningEl.innerHTML =
        `<i class="fa-solid fa-triangle-exclamation"></i> Không tải được thư viện: <b>${missingLibs.join(', ')}</b>. ` +
        `Nguyên nhân thường gặp: mạng đang chặn CDN (cdnjs.cloudflare.com / cdn.jsdelivr.net) — do proxy công ty, tường lửa, hoặc không có internet lúc mở file. ` +
        `Hãy kiểm tra kết nối internet rồi tải lại trang (F5). Các nút bấm sẽ không hoạt động cho tới khi thư viện tải được.`;
      return false;
    }
    try {
      global.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
    } catch (e) { console.error('pdfjsLib worker setup failed:', e); }
    return true;
  }

  global.InvoiceExtractorUtils = {
    extractPdfText,
    hasUsableTextLayer,
    renderPdfPageAsDataUrl,
    renderImageFileAsDataUrl,
    buildDynamicBatches,
    runPool,
    chunk,
    parseModelJson,
    updateProgress,
    checkLibs,
  };
})(window);
