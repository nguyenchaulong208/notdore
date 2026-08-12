/**
 * merge-wizard-state.js
 * State trung tâm cho wizard Ghép File Excel — không phụ thuộc DOM.
 * Các file step*.js chỉ đọc/ghi qua MW.state, không tự giữ state riêng.
 * MW.util chứa helper thuần dùng chung giữa các step (tránh lặp code).
 */
(function (global) {
  'use strict';

  const WORKER_URL = '/js/merge-wizard-worker.js';

  // =====================================================================
  // Worker RPC client — bọc postMessage/onmessage id-based thành Promise
  // =====================================================================
  let worker = null;
  let requestId = 0;
  const pending = new Map(); // id -> { resolve, reject, onProgress }

  const ensureWorker = () => {
    if (worker) return worker;
    worker = new Worker(WORKER_URL);
    worker.onmessage = (event) => {
      const { id, type, payload } = event.data || {};
      const entry = pending.get(id);
      if (!entry) return;

      if (type === 'progress') {
        entry.onProgress && entry.onProgress(payload);
        return;
      }
      pending.delete(id);
      if (type === 'error') {
        entry.reject(new Error(payload?.message || 'Lỗi không xác định từ Worker'));
      } else {
        entry.resolve(payload);
      }
    };
    worker.onerror = (err) => {
      // Lỗi nạp/chạy script trong worker (vd thiếu file vendor, JS lỗi cú pháp...).
      // Một số trình duyệt phát ra Event trơn (không có .message) khi lỗi xảy ra lúc
      // importScripts — nên phải tự dựng message rõ ràng thay vì trông chờ err.message.
      const detail = err?.message || `${err?.filename || ''}${err?.lineno ? `:${err.lineno}` : ''}`.trim();
      const message = detail
        ? `Worker gặp lỗi: ${detail}`
        : 'Worker không khởi tạo được — kiểm tra file /js/merge-wizard-worker.js và /js/vendor/*.js đã upload đúng chỗ chưa.';
      pending.forEach(({ reject }) => reject(new Error(message)));
      pending.clear();
    };
    return worker;
  };

  /** callWorker('parseFile', {...}, onProgress) -> Promise<payload> */
  const callWorker = (type, payload, onProgress) => {
    const w = ensureWorker();
    const id = ++requestId;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject, onProgress });
      w.postMessage({ id, type, payload });
    });
  };

  // ===== Pub/sub đơn giản =====
  const listeners = new Map();
  const on = (event, fn) => {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(fn);
    return () => listeners.get(event).delete(fn);
  };
  const emit = (event, payload) => {
    (listeners.get(event) || new Set()).forEach((fn) => fn(payload));
  };

  // =====================================================================
  // State data
  // =====================================================================
  const data = {
    currentStep: 1,
    files: [],            // xem shape trong addFile()
    templateFileId: null,
    targetSchema: null,   // { sourceType, sheetName, keepExistingData, columns: [{key,label,order}] }
    mergedRows: [],
    mergedDirty: true,    // true nếu mapping/target đổi sau lần merge gần nhất -> Step4 cần merge lại
    profile: null,        // Merge Profile JSON đang áp dụng (nếu người dùng tải lên)
    exportResult: null,   // { arrayBuffer, fileName } sau khi xuất file thành công
    useServerFallback: false,
  };

  const get = () => data;
  const set = (patch) => {
    Object.assign(data, patch);
    emit('change', data);
  };

  // ===== Helpers nội bộ =====
  let fileSeq = 0;
  const nextFileId = () => `f${++fileSeq}`;

  const removeDiacritics = (str) =>
    String(str)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D');

  /** Sinh key nội bộ ổn định từ header — chỉ dùng làm id, KHÔNG hiển thị cho người dùng (dùng label). */
  const slugifyKey = (header, index) => {
    const base = removeDiacritics(String(header || ''))
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return `col_${base || 'x'}_${index}`;
  };

  // =====================================================================
  // File management
  // =====================================================================

  /**
   * meta: kết quả worker.parseFile { fileName, sheets, totalEstimatedCells }
   * rawFile: đối tượng File gốc — giữ lại để đọc arrayBuffer khi merge/export
   */
  const addFile = (meta, rawFile) => {
    const file = {
      id: nextFileId(),
      fileName: meta.fileName,
      size: rawFile.size,
      rawFile,
      sheets: meta.sheets, // [{sheetName, headerRowIndex, headers, rowCount, colCount, previewRows, signature, estimatedCells}]
      selectedSheetName: meta.sheets[0]?.sheetName || null,
      totalEstimatedCells: meta.totalEstimatedCells,
      columnMapping: null, // set ở Step 3: [{sourceHeader, targetKey, autoMatched, confidence}]
      profileMatch: null,  // set nếu có Merge Profile đang áp: {action, similarity, ...}
      isTemplate: false,
    };
    data.files.push(file);
    set({ mergedDirty: true });
    emit('files-change', data.files);
    return file;
  };

  const removeFile = (fileId) => {
    data.files = data.files.filter((f) => f.id !== fileId);
    if (data.templateFileId === fileId) {
      data.templateFileId = null;
      data.targetSchema = null;
    }
    set({ mergedDirty: true });
    emit('files-change', data.files);
  };

  const getFile = (fileId) => data.files.find((f) => f.id === fileId);

  const getSelectedSheet = (file) =>
    file.sheets.find((s) => s.sheetName === file.selectedSheetName) || file.sheets[0];

  /** Nguồn để merge = mọi file trừ file đang là template (dữ liệu template xử lý riêng qua keepExistingData). */
  const getSourceFiles = () => data.files.filter((f) => f.id !== data.templateFileId);

  /** Chọn file làm template + sheet -> dựng Target Schema cố định từ header của sheet đó. */
  const setTemplate = (fileId, sheetName) => {
    data.files.forEach((f) => { f.isTemplate = f.id === fileId; });
    const file = getFile(fileId);
    if (!file) return;

    if (sheetName) file.selectedSheetName = sheetName;
    const sheet = getSelectedSheet(file);

    const columns = sheet.headers
      .map((label, index) => ({ key: slugifyKey(label, index), label: label || `Cột ${index + 1}`, order: index }))
      .filter((c) => c.label.trim() !== '');

    data.templateFileId = fileId;
    data.targetSchema = {
      sourceType: 'template',
      sheetName: sheet.sheetName,
      keepExistingData: data.targetSchema?.keepExistingData ?? false,
      columns,
    };
    set({ mergedDirty: true });
    emit('template-change', data.targetSchema);
  };

  const setKeepExistingData = (keep) => {
    if (!data.targetSchema) return;
    data.targetSchema = { ...data.targetSchema, keepExistingData: !!keep };
    set({ mergedDirty: true });
  };

  const setFileSheet = (fileId, sheetName) => {
    const file = getFile(fileId);
    if (!file) return;
    file.selectedSheetName = sheetName;
    file.columnMapping = null; // đổi sheet -> mapping cũ không còn hợp lệ, Step3 sẽ gợi ý lại
    if (fileId === data.templateFileId) setTemplate(fileId, sheetName);
    set({ mergedDirty: true });
  };

  const setColumnMapping = (fileId, mapping) => {
    const file = getFile(fileId);
    if (!file) return;
    file.columnMapping = mapping;
    set({ mergedDirty: true });
  };

  const setMergedRows = (rows) => set({ mergedRows: rows, mergedDirty: false });

  // =====================================================================
  // Điều kiện chuyển bước
  // =====================================================================
  const canProceed = (step) => {
    switch (step) {
      case 1:
        return data.files.length > 0;
      case 2:
        return !!data.templateFileId && !!data.targetSchema;
      case 3: {
        const sourceFiles = getSourceFiles();
        return sourceFiles.length > 0 && sourceFiles.some((f) => (f.columnMapping || []).some((m) => m.targetKey));
      }
      case 4:
        return data.mergedRows.length > 0;
      case 5:
        return !!data.exportResult;
      default:
        return false;
    }
  };

  const goToStep = (step) => {
    if (step > data.currentStep && !canProceed(data.currentStep)) return false;
    set({ currentStep: step });
    emit('step-change', step);
    return true;
  };

  // =====================================================================
  // Util thuần dùng chung giữa các step (tránh lặp code escapeHtml/formatFileSize)
  // =====================================================================
  const escapeHtml = (v) =>
    String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  /** Đọc File -> ArrayBuffer. rawFile chỉ giữ tham chiếu File (nhẹ), đọc lại khi cần (parse/merge/export). */
  const readFileAsArrayBuffer = (rawFile) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(rawFile);
    });

  global.MW = global.MW || {};
  global.MW.util = { escapeHtml, formatFileSize, readFileAsArrayBuffer };
  global.MW.state = {
    get, set, on, emit,
    callWorker,
    addFile, removeFile, getFile, getSelectedSheet, getSourceFiles,
    setTemplate, setKeepExistingData, setFileSheet,
    setColumnMapping, setMergedRows,
    canProceed, goToStep,
    slugifyKey,
  };
})(window);