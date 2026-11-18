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
    pasteCatch: $('paste-catch'),
    scanWrap: $('scan-wrap'),
    scanVideo: $('scan-video'),
    scanStatus: $('scan-status'),
    stopCameraBtn: $('stop-camera-btn'),
    resultsWrap: $('results-wrap'),
    resultList: $('result-list'),
    copyAllBtn: $('copy-all-btn'),
    exportTxtBtn: $('export-txt-btn'),
    clearBtn: $('clear-btn'),
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

  function drawToCanvas(img, maxDim) {
    const canvas = document.createElement('canvas');
    let w = img.naturalWidth || img.width || 0;
    let h = img.naturalHeight || img.height || 0;
    if (!w || !h) throw new Error('Không đọc được kích thước ảnh.');
    const k = Math.min(1, maxDim / Math.max(w, h));
    w = Math.max(1, Math.round(w * k));
    h = Math.max(1, Math.round(h * k));
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0, w, h);
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

  async function decodeImageEl(img) {
    return decodeCanvas(drawToCanvas(img, MAX_DIM));
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
      const out = decodeCanvas(drawToCanvas(v, 1200));
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
    decodeFiles(Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/')));
  });
  els.fileInput.addEventListener('change', () => {
    decodeFiles(Array.from(els.fileInput.files || []));
    els.fileInput.value = '';
  });

  /* ---------- Dán từ clipboard ---------- */

  function showPasteCatcher() {
    els.pasteCatch.classList.remove('is-hidden');
    els.fileStatus.textContent = 'Nhấn Ctrl+V (Cmd+V) tại ô đã hiện…';
    els.pasteCatch.focus();
  }

  function hidePasteCatcher() {
    els.pasteCatch.classList.add('is-hidden');
    els.pasteCatch.value = '';
  }

  async function pasteFromClipboard() {
    ensureLib();
    // Đường 1: đọc clipboard trực tiếp (cần quyền, Chrome/Edge)
    if (navigator.clipboard && navigator.clipboard.read) {
      try {
        const items = await navigator.clipboard.read();
        const files = [];
        for (const item of items) {
          const type = (item.types || []).find(t => t.startsWith('image/'));
          if (!type) continue;
          const blob = await item.getType(type);
          const ext = type.split('/')[1] || 'png';
          files.push(new File([blob], `clipboard-${Date.now()}.${ext}`, { type }));
        }
        if (files.length) {
          decodeFiles(files);
          return;
        }
        els.fileStatus.textContent = 'Clipboard không có ảnh — thử dán thủ công.';
      } catch (e) {
        els.fileStatus.textContent = 'Không đọc được clipboard tự động — dán thủ công.';
      }
    } else {
      els.fileStatus.textContent = 'Trình duyệt không hỗ trợ đọc clipboard — dán thủ công.';
    }
    // Đường 2: ô dán dự phòng
    showPasteCatcher();
  }

  els.pasteBtn.addEventListener('click', pasteFromClipboard);

  els.pasteCatch.addEventListener('paste', (e) => {
    const files = Array.from((e.clipboardData || {}).items || [])
      .filter(i => i.type.startsWith('image/'))
      .map(i => i.getAsFile())
      .filter(Boolean);
    if (files.length) {
      e.preventDefault();
      hidePasteCatcher();
      decodeFiles(files);
    }
  });

  els.pasteCatch.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { hidePasteCatcher(); els.fileStatus.textContent = ''; }
  });

  document.addEventListener('paste', (e) => {
    const items = Array.from((e.clipboardData || {}).items || []).filter(i => i.type.startsWith('image/'));
    if (!items.length) return;
    e.preventDefault();
    decodeFiles(items.map(i => i.getAsFile()).filter(Boolean));
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
