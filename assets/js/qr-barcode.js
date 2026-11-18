/**
 * Đọc mã QR & Barcode — giải mã ảnh (upload / kéo-thả / dán) và camera thành text.
 * Thư viện: ZXing core (@zxing/library UMD, global window.ZXing).
 * Cách đọc: vẽ ảnh/video frame lên canvas → HTMLCanvasElementLuminanceSource
 *           → HybridBinarizer → MultiFormatReader.
 * Toàn bộ xử lý phía client, không gửi ảnh lên máy chủ.
 */
(() => {
  const $ = (id) => document.getElementById(id);

  const els = {
    dropzone: $('dropzone'),
    fileInput: $('file-input'),
    fileStatus: $('file-status'),
    cameraBtn: $('camera-btn'),
    deviceSelect: $('device-select'),
    pasteBtn: $('paste-btn'),
    pasteBox: $('paste-box'),
    pasteCatch: $('paste-catch'),
    pasteAutoBtn: $('paste-auto-btn'),
    scanWrap: $('scan-wrap'),
    scanVideo: $('scan-video'),
    scanStatus: $('scan-status'),
    stopCameraBtn: $('stop-camera-btn'),
    resultsWrap: $('results-wrap'),
    resultList: $('result-list'),
    copyAllBtn: $('copy-all-btn'),
    exportTxtBtn: $('export-txt-btn'),
    clearBtn: $('clear-btn'),
    genText: $('gen-text'),
    genFormat: $('gen-format'),
    genSize: $('gen-size'),
    genEccWrap: $('gen-ecc-wrap'),
    genEcc: $('gen-ecc'),
    genShowValue: $('gen-show-value'),
    genError: $('gen-error'),
    genBtn: $('gen-btn'),
    genOut: $('gen-out'),
    genCanvas: $('gen-canvas'),
    genDownloadBtn: $('gen-download-btn'),
  };

  const MAX_DIM = 1600;

  let results = [];        // { source, format, text }
  let scanTimer = null;
  let mediaStream = null;
  let scanning = false;

  /* ---------- ZXing core ---------- */

  function ensureLib() {
    if (!window.ZXing || !ZXing.MultiFormatReader) {
      throw new Error('Thư viện đọc mã chưa tải xong. Kiểm tra lại kết nối mạng rồi tải lại trang.');
    }
  }

  function makeReader() {
    const reader = new ZXing.MultiFormatReader();
    const hints = new Map();
    hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
    reader.setHints(hints);
    return reader;
  }

  /**
   * Vẽ ảnh ra canvas ở mức phóng `factor` (giữ pixel cứng), tùy chọn tăng tương phản.
   * Ảnh chụp/nén thường cần phóng lớn hoặc co mức xám mới giải mã được.
   */
  function drawToCanvas(img, factor, gray, maxDim) {
    let w = img.naturalWidth || img.width || 0;
    let h = img.naturalHeight || img.height || 0;
    if (!w || !h) throw new Error('Không đọc được kích thước ảnh.');
    let k = factor;
    if (Math.max(w, h) * k > maxDim) k = maxDim / Math.max(w, h);
    const cw = Math.max(1, Math.round(w * k));
    const ch = Math.max(1, Math.round(h * k));
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, cw, ch);
    if (gray) {
      const d = ctx.getImageData(0, 0, cw, ch);
      const px = d.data;
      for (let i = 0; i < px.length; i += 4) {
        const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        const v = Math.min(255, Math.max(0, (lum - 128) * 2.2 + 128));
        px[i] = px[i + 1] = px[i + 2] = v;
      }
      ctx.putImageData(d, 0, 0);
    }
    return canvas;
  }

  /** Trả về { text, format } hoặc null nếu không tìm thấy mã. */
  function decodeCanvas(canvas) {
    ensureLib();
    const source = new ZXing.HTMLCanvasElementLuminanceSource(canvas);
    const bitmap = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(source));
    try {
      const res = makeReader().decode(bitmap);
      return { text: res.getText(), format: formatName(res.getBarcodeFormat()) };
    } catch (e) {
      return null;
    }
  }

  /**
   * Thử lần lượt các mức phóng/tương phản rồi mới bỏ cuộc.
   * factors: mảng [factor, gray]
   */
  function decodeWithRetries(img, factors) {
    ensureLib();
    for (let i = 0; i < factors.length; i++) {
      const f = factors[i];
      let canvas;
      try {
        canvas = drawToCanvas(img, f[0], !!f[1], MAX_DIM);
      } catch (e) {
        return null;
      }
      const out = decodeCanvas(canvas);
      if (out) return out;
    }
    return null;
  }

  const DECODE_FACTORS = [[1], [2, true], [3], [4, true]];

  async function decodeImageEl(img) {
    return decodeWithRetries(img, DECODE_FACTORS);
  }

  let formatMap = null;

  function formatName(fmt) {
    if (!formatMap && window.ZXing && ZXing.BarcodeFormat) {
      formatMap = {};
      for (const key of Object.keys(ZXing.BarcodeFormat)) {
        formatMap[ZXing.BarcodeFormat[key]] = key;
      }
    }
    const name = formatMap ? formatMap[fmt] : '';
    return String(name || fmt || '').replace(/_/g, ' ');
  }

  /* ---------- Kết quả ---------- */

  function addResult(item) {
    // Trùng lặp (cùng nguồn + cùng text) thì bỏ qua — tránh camera spam
    if (results.some(r => r.source === item.source && r.text === item.text)) return;
    results.push(item);
    renderResults();
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderResults() {
    els.resultsWrap.classList.toggle('is-hidden', results.length === 0);
    els.resultList.innerHTML = results.map((r, i) => `
      <div class="nd-result">
        <div class="nd-result-top">
          <span class="nd-result-source"><i class="fas fa-file-image me-1" aria-hidden="true"></i>${esc(r.source)}</span>
          <span class="nd-tool-badge">${esc(formatName(r.format))}</span>
        </div>
        <div class="nd-result-text">${esc(r.text)}</div>
        <button type="button" class="btn-outline-nd nd-btn-xs nd-result-copy" data-index="${i}">
          <i class="fas fa-copy me-1"></i> Copy
        </button>
      </div>
    `).join('');
  }

  async function copyText(text, btn) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    if (btn) {
      const old = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-check me-1"></i> Đã copy';
      setTimeout(() => { btn.innerHTML = old; }, 1200);
    }
  }

  /* ---------- Đọc từ file ảnh ---------- */

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => resolve({ img, url });
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Không đọc được ảnh ' + file.name)); };
      img.src = url;
    });
  }

  async function decodeFiles(files) {
    if (!files.length) return;
    ensureLib();

    let ok = 0;
    for (const file of files) {
      els.fileStatus.textContent = `Đang đọc ${file.name}…`;
      let url = null;
      try {
        const loaded = await readFile(file);
        url = loaded.url;
        const out = await decodeImageEl(loaded.img);
        if (out) {
          addResult({ source: file.name, format: out.format, text: out.text });
          ok += 1;
        }
      } catch (e) {
        console.info('Không đọc được', file.name, e);
      } finally {
        if (url) URL.revokeObjectURL(url);
      }
    }
    els.fileStatus.textContent = `Đã đọc được ${ok}/${files.length} ảnh.`;
  }

  /* ---------- Camera ---------- */

  function stopStream() {
    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop());
      mediaStream = null;
    }
    els.scanVideo.srcObject = null;
  }

  async function fillDevices() {
    try {
      const devs = await navigator.mediaDevices.enumerateDevices();
      const vids = devs.filter(d => d.kind === 'videoinput');
      els.deviceSelect.innerHTML = vids.map((d, i) =>
        `<option value="${esc(d.deviceId)}">${esc(d.label || ('Camera ' + (i + 1)))}</option>`).join('');
      els.deviceSelect.classList.toggle('is-hidden', vids.length < 2);
    } catch (e) { /* bỏ qua */ }
  }

  async function startScan() {
    if (scanning) return;
    ensureLib();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      els.fileStatus.textContent = 'Trình duyệt không hỗ trợ camera (cần HTTPS hoặc localhost).';
      return;
    }
    els.cameraBtn.disabled = true;
    els.scanStatus.textContent = 'Đang yêu cầu quyền camera…';
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      els.scanVideo.srcObject = mediaStream;
      await els.scanVideo.play();
      await fillDevices();
      els.scanWrap.classList.remove('is-hidden');
      els.cameraBtn.classList.add('is-hidden');
      scanning = true;
      els.scanStatus.textContent = 'Đang quét…';
      scanTimer = setInterval(scanFrame, 300);
    } catch (e) {
      els.scanStatus.textContent = '';
      stopStream();
      alert('Không mở được camera: ' + (e && e.message ? e.message : e));
    } finally {
      els.cameraBtn.disabled = false;
    }
  }

  async function switchDevice() {
    if (!scanning) return;
    stopStream();
    els.scanStatus.textContent = 'Đang chuyển camera…';
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: els.deviceSelect.value } },
        audio: false,
      });
      els.scanVideo.srcObject = mediaStream;
      await els.scanVideo.play();
      els.scanStatus.textContent = 'Đang quét…';
    } catch (e) {
      alert('Không mở được camera: ' + (e && e.message ? e.message : e));
    }
  }

  function scanFrame() {
    const v = els.scanVideo;
    if (!v || v.readyState < 2 || !v.videoWidth) return;
    try {
      const out = decodeWithRetries(v, [[1], [2, true], [3]]);
      if (out) {
        addResult({ source: 'Camera', format: out.format, text: out.text });
        const short = out.text.slice(0, 40);
        els.scanStatus.textContent = `Đọc được: ${short}${out.text.length > 40 ? '…' : ''}`;
      }
    } catch (e) { /* chưa thấy mã trong frame này */ }
  }

  function stopScan() {
    if (scanTimer) { clearInterval(scanTimer); scanTimer = null; }
    scanning = false;
    stopStream();
    els.scanWrap.classList.add('is-hidden');
    els.cameraBtn.classList.remove('is-hidden');
    els.scanStatus.textContent = '';
  }

  /* ---------- Tạo mã từ text ---------- */

  const GEN_FORMATS = [
    { value: 'QR_CODE', label: 'QR Code', engine: 'zxing' },
    { value: 'DATA_MATRIX', label: 'Data Matrix', engine: 'zxing' },
    { value: 'CODE_128', label: 'Code 128', engine: 'jsbarcode', js: 'CODE128' },
    { value: 'CODE_39', label: 'Code 39', engine: 'jsbarcode', js: 'CODE39' },
    { value: 'EAN_13', label: 'EAN-13', engine: 'jsbarcode', js: 'EAN13' },
    { value: 'EAN_8', label: 'EAN-8', engine: 'jsbarcode', js: 'EAN8' },
    { value: 'UPC_A', label: 'UPC-A', engine: 'jsbarcode', js: 'UPC' },
    { value: 'ITF', label: 'ITF', engine: 'jsbarcode', js: 'ITF' },
    { value: 'CODABAR', label: 'Codabar', engine: 'jsbarcode', js: 'CODABAR' },
  ];

  function genFormatInfo(fmt) {
    return GEN_FORMATS.find(x => x.value === fmt);
  }

  /** Chữ số kiểm tra cho EAN/UPC (áp dụng khi nhập thiếu 1 chữ số cuối). */
  function checkDigit(digits) {
    let sum = 0;
    const n = digits.length;
    for (let i = 0; i < n; i++) {
      const w = (n % 2 === 0) ? (i % 2 === 0 ? 1 : 3) : (i % 2 === 0 ? 3 : 1);
      sum += Number(digits[i]) * w;
    }
    return String((10 - (sum % 10)) % 10);
  }

  /** Trả về chuỗi lỗi, hoặc null nếu hợp lệ. */
  function validatePayload(fmt, text) {
    const digits = /^\d+$/.test(text);
    if (fmt === 'EAN_13' && (!digits || (text.length !== 12 && text.length !== 13))) {
      return 'EAN-13 cần đúng 12 hoặc 13 chữ số (thiếu thì tự bổ sung chữ số kiểm tra).';
    }
    if (fmt === 'EAN_8' && (!digits || (text.length !== 7 && text.length !== 8))) {
      return 'EAN-8 cần đúng 7 hoặc 8 chữ số.';
    }
    if (fmt === 'UPC_A' && (!digits || (text.length !== 11 && text.length !== 12))) {
      return 'UPC-A cần đúng 11 hoặc 12 chữ số.';
    }
    if (fmt === 'CODE_39' && !/^[0-9A-Z \-\.\$\/\+\%]+$/.test(text)) {
      return 'Code 39 chỉ hỗ trợ chữ hoa, số và ký tự - . $ / + %';
    }
    if (fmt === 'ITF' && (!digits || text.length % 2 !== 0)) {
      return 'ITF cần số lượng chữ số chẵn (thường là 14 cho mã vạch hàng hóa).';
    }
    if (fmt === 'CODABAR' && !/^[0-9\-\$\:\/\.\+ABCD]+$/.test(text.toUpperCase())) {
      return 'Codabar chỉ hỗ trợ số và ký tự - $ : / . + (có thể kèm A/B/C/D đầu–cuối).';
    }
    if (text.length > 1500) {
      return 'Nội dung quá dài (tối đa 1500 ký tự).';
    }
    return null;
  }

  function genShowError(msg) {
    els.genError.textContent = msg || '';
    els.genError.style.display = msg ? 'block' : 'none';
  }

  function renderMatrix(matrix) {
    const mw = matrix.getWidth();
    const mh = matrix.getHeight();
    let scale = Math.max(1, Math.floor(640 / mw));
    scale = Math.min(scale, 12);
    while (mh * scale > 600 && scale > 1) scale -= 1;
    const pad = 8;
    const canvas = els.genCanvas;
    canvas.width = mw * scale + pad * 2;
    canvas.height = mh * scale + pad * 2;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000000';
    for (let y = 0; y < mh; y++) {
      for (let x = 0; x < mw; x++) {
        if (matrix.get(x, y)) ctx.fillRect(pad + x * scale, pad + y * scale, scale, scale);
      }
    }
    els.genOut.classList.remove('is-hidden');
  }

  /** Vẽ barcode 1D bằng JsBarcode vào canvas xem trước. */
  function renderWithJsBarcode(info, payload, size) {
    if (!window.JsBarcode) throw new Error('Thư viện JsBarcode chưa tải xong.');
    // Xóa canvas cũ bằng cách thay kích thước (JsBarcode vẽ đè lên)
    els.genCanvas.width = 1;
    els.genCanvas.height = 1;
    window.JsBarcode(els.genCanvas, payload, {
      format: info.js,
      width: 2,
      height: Math.max(50, Math.round(size * 0.24)),
      margin: 10,
      displayValue: els.genShowValue.value === '1',
      fontSize: 16,
      lineColor: '#000000',
      background: '#ffffff',
      textMargin: 4,
    });
    els.genOut.classList.remove('is-hidden');
  }

  function generateCode() {
    genShowError('');
    const text = els.genText.value.trim();
    if (!text) {
      genShowError('Nhập nội dung cần tạo mã.');
      els.genOut.classList.add('is-hidden');
      return;
    }
    const fmt = els.genFormat.value;
    const info = genFormatInfo(fmt);
    if (!info) return;

    const err = validatePayload(fmt, text);
    if (err) {
      genShowError(err);
      els.genOut.classList.add('is-hidden');
      return;
    }
    ensureLib();

    const size = Math.min(1200, Math.max(120, parseInt(els.genSize.value, 10) || 320));
    let payload = text;
    if (fmt === 'EAN_13' && text.length === 12) payload = text + checkDigit(text);
    else if (fmt === 'EAN_8' && text.length === 7) payload = text + checkDigit(text);
    else if (fmt === 'UPC_A' && text.length === 11) payload = text + checkDigit(text);

    try {
      if (info.engine === 'jsbarcode') {
        renderWithJsBarcode(info, payload, size);
        return;
      }
      // Mã 2D bằng ZXing (QRCodeWriter / DataMatrixWriter)
      const hints = new Map();
      hints.set(ZXing.EncodeHintType.MARGIN, 2);
      if (fmt === 'QR_CODE') hints.set(ZXing.EncodeHintType.ERROR_CORRECTION, els.genEcc.value);
      const Writer = fmt === 'DATA_MATRIX' ? ZXing.DataMatrixWriter : ZXing.QRCodeWriter;
      const matrix = new Writer().encode(payload, ZXing.BarcodeFormat[fmt], size, size, hints);
      renderMatrix(matrix);
    } catch (e) {
      genShowError('Không tạo được mã: ' + (e && e.message ? e.message : e));
      els.genOut.classList.add('is-hidden');
    }
  }

  function updateGenMeta() {
    els.genEccWrap.classList.toggle('is-hidden', els.genFormat.value !== 'QR_CODE');
    els.genOut.classList.add('is-hidden');
    genShowError('');
  }

  function initGen() {
    els.genFormat.innerHTML = GEN_FORMATS.map(f => `<option value="${f.value}">${f.label}</option>`).join('');
    updateGenMeta();
  }

  els.genBtn.addEventListener('click', generateCode);
  els.genFormat.addEventListener('change', updateGenMeta);
  els.genDownloadBtn.addEventListener('click', () => {
    els.genCanvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = els.genFormat.value.toLowerCase() + '.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, 'image/png');
  });

  initGen();

  /* ---------- Sự kiện ---------- */

  els.dropzone.addEventListener('click', () => els.fileInput.click());
  els.dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); els.fileInput.click(); }
  });
  ['dragenter', 'dragover'].forEach(ev => els.dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    els.dropzone.classList.add('is-drag');
  }));
  ['dragleave', 'drop'].forEach(ev => els.dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    els.dropzone.classList.remove('is-drag');
  }));
  els.dropzone.addEventListener('drop', (e) => {
    runDecode(Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/')));
  });
  els.fileInput.addEventListener('change', () => {
    runDecode(Array.from(els.fileInput.files || []));
    els.fileInput.value = '';
  });

  /* ---------- Dán từ clipboard ---------- */

  function showPasteCatcher() {
    els.pasteBox.classList.remove('is-hidden');
    els.fileStatus.textContent = 'Nhấn Ctrl+V (Cmd+V) tại ô đã hiện…';
    els.pasteCatch.focus();
  }

  function hidePasteCatcher() {
    els.pasteBox.classList.add('is-hidden');
    els.pasteCatch.value = '';
  }

  /** Đọc ảnh trong clipboard. Ném lỗi nếu trình duyệt chặn/từ chối. */
  async function readClipboardImages() {
    if (!(navigator.clipboard && navigator.clipboard.read)) {
      throw new Error('Trình duyệt không hỗ trợ đọc clipboard.');
    }
    const items = await navigator.clipboard.read();
    const files = [];
    for (const item of items) {
      const type = (item.types || []).find(t => t.startsWith('image/'));
      if (!type) continue;
      const blob = await item.getType(type);
      const ext = type.split('/')[1] || 'png';
      files.push(new File([blob], `clipboard-${Date.now()}.${ext}`, { type }));
    }
    return files;
  }

  async function pasteFromClipboard() {
    // Luôn mở ô dán trước: người dùng có đường dùng ngay, không phụ thuộc quyền clipboard.
    showPasteCatcher();
    try {
      let state = 'unknown';
      try {
        if (navigator.permissions && navigator.permissions.query) {
          state = (await navigator.permissions.query({ name: 'clipboard-read' })).state;
        }
      } catch (e) { /* trình duyệt không hỗ trợ query */ }

      if (state === 'denied') {
        els.fileStatus.textContent = 'Trình duyệt đang chặn đọc clipboard — hãy dán thủ công vào ô.';
        return;
      }
      if (state !== 'granted') {
        els.fileStatus.textContent = 'Nhấn Ctrl+V vào ô, hoặc bấm “Đọc clipboard tự động” để cấp quyền.';
        return;
      }
      const files = await readClipboardImages();
      if (files.length) {
        hidePasteCatcher();
        runDecode(files);
      } else {
        els.fileStatus.textContent = 'Clipboard không có ảnh — hãy dán thủ công vào ô.';
      }
    } catch (e) {
      els.fileStatus.textContent = 'Không đọc được clipboard — hãy dán thủ công vào ô.';
    }
  }

  async function pasteAutoRead() {
    els.fileStatus.textContent = 'Đang đọc clipboard…';
    try {
      const files = await readClipboardImages();
      if (files.length) {
        hidePasteCatcher();
        runDecode(files);
      } else {
        els.fileStatus.textContent = 'Clipboard không có ảnh.';
      }
    } catch (e) {
      els.fileStatus.textContent = 'Không đọc được clipboard: ' + (e && e.message ? e.message : e);
    }
  }

  function runDecode(files) {
    decodeFiles(files).catch(err => {
      console.error('Lỗi khi xử lý ảnh:', err);
      els.fileStatus.textContent = 'Lỗi khi xử lý ảnh: ' + (err && err.message ? err.message : err);
    });
  }

  els.pasteBtn.addEventListener('click', pasteFromClipboard);
  els.pasteAutoBtn.addEventListener('click', pasteAutoRead);

  els.pasteCatch.addEventListener('paste', (e) => {
    const files = Array.from((e.clipboardData || {}).items || [])
      .filter(i => i.type.startsWith('image/'))
      .map(i => i.getAsFile())
      .filter(Boolean);
    if (files.length) {
      e.preventDefault();
      hidePasteCatcher();
      runDecode(files);
    }
  });

  els.pasteCatch.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { hidePasteCatcher(); els.fileStatus.textContent = ''; }
  });

  document.addEventListener('paste', (e) => {
    const items = Array.from((e.clipboardData || {}).items || []).filter(i => i.type.startsWith('image/'));
    if (!items.length) return;
    e.preventDefault();
    runDecode(items.map(i => i.getAsFile()).filter(Boolean));
  });

  els.cameraBtn.addEventListener('click', startScan);
  els.stopCameraBtn.addEventListener('click', stopScan);
  els.deviceSelect.addEventListener('change', switchDevice);

  els.copyAllBtn.addEventListener('click', () => copyText(results.map(r => r.text).join('\n'), els.copyAllBtn));
  els.exportTxtBtn.addEventListener('click', () => {
    const content = results.map(r => `${r.source}\t${formatName(r.format)}\t${r.text}`).join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'qr-barcode.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  els.clearBtn.addEventListener('click', () => { results = []; renderResults(); els.fileStatus.textContent = ''; });
  els.resultList.addEventListener('click', (e) => {
    const btn = e.target.closest('.nd-result-copy');
    if (!btn) return;
    const item = results[Number(btn.dataset.index)];
    if (item) copyText(item.text, btn);
  });

  window.addEventListener('beforeunload', stopStream);

  if (!window.ZXing) {
    els.fileStatus.textContent = 'Thư viện đọc mã chưa tải xong — hãy kiểm tra mạng và tải lại trang.';
  }
})();
