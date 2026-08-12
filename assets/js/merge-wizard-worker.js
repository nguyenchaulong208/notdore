/**
 * merge-wizard-worker.js
 * Web Worker cho công cụ "Ghép File Excel" (NotDore).
 * Toàn bộ logic parse/merge/export nằm ở đây — 100% độc lập DOM, dễ test riêng.
 * Các file merge-wizard-step*.js chỉ postMessage vào/ra worker này.
 *
 * Message API (main thread -> worker), mỗi message có {id, type, payload}:
 *   parseFile      { arrayBuffer, fileName }                         -> fileMeta
 *   suggestMapping { targetColumns, sourceHeaders }                  -> columnMapping[]
 *   matchProfile   { profile, newHeaderList }                        -> matchResult
 *   mergeSources   { targetSchema, sources: [{ arrayBuffer, sheetName, headerRowIndex, columnMapping }] } -> mergedRows[]
 *   exportWorkbook { targetSchema, mergedRows, templateArrayBuffer, templateSheetName }                  -> ArrayBuffer (transferable)
 *
 * Message API (worker -> main thread):
 *   { id, type: 'result', payload }
 *   { id, type: 'progress', payload: { step, percent, message } }
 *   { id, type: 'error', payload: { message, stack } }
 */

// importScripts chỉ tồn tại trong môi trường Worker thật; khi chạy test qua Node
// (xem test-worker-logic.js) ta inject sẵn global.XLSX/global.ExcelJS nên bỏ qua bước này.
if (typeof importScripts === 'function') {
  importScripts(
    'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js'
  );
}

// =====================================================================
// 1. Helpers thuần — không đụng DOM/Worker API, có thể unit test riêng
//    (export qua module.exports ở cuối file nếu chạy trong Node để test)
// =====================================================================

/** Chuẩn hoá header: trim, lowercase, gộp khoảng trắng thừa. Giữ dấu tiếng Việt. */
const normalizeHeader = (raw) =>
  String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

/** Levenshtein distance thuần, O(n*m), đủ dùng cho header ngắn (<100 ký tự). */
const levenshteinDistance = (a, b) => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prevRow = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const currRow = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currRow.push(Math.min(prevRow[j] + 1, currRow[j - 1] + 1, prevRow[j - 1] + cost));
    }
    prevRow = currRow;
  }
  return prevRow[b.length];
};

/** Similarity 0..1 dựa trên Levenshtein ratio. */
const similarityRatio = (a, b) => {
  const na = normalizeHeader(a);
  const nb = normalizeHeader(b);
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(na, nb) / maxLen;
};

/** Jaccard similarity giữa 2 danh sách header (sau chuẩn hoá, coi như set). */
const jaccardSimilarity = (listA, listB) => {
  const setA = new Set(listA.map(normalizeHeader));
  const setB = new Set(listB.map(normalizeHeader));
  if (setA.size === 0 && setB.size === 0) return 1;
  let intersection = 0;
  for (const v of setA) if (setB.has(v)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 1 : intersection / union;
};

/** djb2 hash -> hex string, dùng làm headerHash để short-circuit so khớp profile. */
const djb2Hash = (str) => {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
};

/** Sinh signature {headerList, headerHash} từ danh sách header thô (đã chuẩn hoá thứ tự gốc). */
const buildHeaderSignature = (headerList) => {
  const normalized = headerList.map(normalizeHeader);
  return {
    headerList: [...headerList],
    headerHash: djb2Hash(normalized.join('|')),
  };
};

// =====================================================================
// 2. Parse file (SheetJS) — đọc metadata + preview, không merge
// =====================================================================

const MAX_HEADER_SCAN_ROWS = 10;
const PREVIEW_ROW_COUNT = 20;

/** Dò dòng header: chọn dòng có nhiều ô chuỗi khác rỗng & không trùng nhau nhất trong N dòng đầu. */
const detectHeaderRowIndex = (rows) => {
  let bestIdx = 0;
  let bestScore = -1;
  const scanLimit = Math.min(rows.length, MAX_HEADER_SCAN_ROWS);

  for (let i = 0; i < scanLimit; i++) {
    const row = rows[i] || [];
    const cells = row.filter((c) => typeof c === 'string' && c.trim() !== '');
    const distinct = new Set(cells.map(normalizeHeader)).size;
    // Ưu tiên dòng có nhiều ô chuỗi khác nhau, phạt nếu có nhiều số (thường là data, không phải header)
    const numericPenalty = row.filter((c) => typeof c === 'number').length;
    const score = distinct * 2 - numericPenalty;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx;
};

/** Đọc 1 workbook (ArrayBuffer) -> metadata cho tất cả sheet, không giữ toàn bộ data trong worker. */
const parseWorkbookMeta = (arrayBuffer, fileName) => {
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });

  const sheets = workbook.SheetNames.map((sheetName) => {
    const ws = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
    const headerRowIndex = detectHeaderRowIndex(rows);
    const headerRow = (rows[headerRowIndex] || []).map((h) => String(h ?? '').trim());
    const dataRows = rows.slice(headerRowIndex + 1);
    const colCount = headerRow.length;
    const rowCount = dataRows.length;

    return {
      sheetName,
      headerRowIndex,
      headers: headerRow,
      rowCount,
      colCount,
      estimatedCells: rowCount * colCount,
      previewRows: dataRows.slice(0, PREVIEW_ROW_COUNT),
      signature: buildHeaderSignature(headerRow),
    };
  });

  const totalEstimatedCells = sheets.reduce((sum, s) => sum + s.estimatedCells, 0);

  return { fileName, sheets, totalEstimatedCells };
};

// =====================================================================
// 3. Auto-suggest column mapping (Step 3) — greedy theo điểm giảm dần
// =====================================================================

const AUTO_SUGGEST_THRESHOLD = 0.75;

/**
 * targetColumns: [{ key, label }]
 * sourceHeaders: string[]
 * -> [{ sourceHeader, targetKey, autoMatched, confidence }]
 */
const suggestColumnMapping = (targetColumns, sourceHeaders) => {
  const pairs = [];

  for (const header of sourceHeaders) {
    for (const col of targetColumns) {
      const normHeader = normalizeHeader(header);
      const normLabel = normalizeHeader(col.label);
      const exact = normHeader === normLabel;
      const score = exact ? 1 : similarityRatio(header, col.label);
      if (exact || score >= AUTO_SUGGEST_THRESHOLD) {
        pairs.push({ header, targetKey: col.key, score, exact });
      }
    }
  }

  // Gán tham lam: điểm cao nhất trước, mỗi bên chỉ được gán 1 lần
  pairs.sort((a, b) => b.score - a.score);
  const usedHeaders = new Set();
  const usedTargets = new Set();
  const assigned = new Map(); // header -> {targetKey, score, exact}

  for (const pair of pairs) {
    if (usedHeaders.has(pair.header) || usedTargets.has(pair.targetKey)) continue;
    usedHeaders.add(pair.header);
    usedTargets.add(pair.targetKey);
    assigned.set(pair.header, pair);
  }

  return sourceHeaders.map((header) => {
    const match = assigned.get(header);
    return {
      sourceHeader: header,
      targetKey: match ? match.targetKey : null,
      autoMatched: !!match,
      confidence: match ? Math.round(match.score * 100) / 100 : 0,
    };
  });
};

// =====================================================================
// 4. Nhận diện file khi import Merge Profile (Step 1) — Jaccard similarity
// =====================================================================

const PROFILE_AUTO_APPLY_THRESHOLD = 0.9;
const PROFILE_CONFIRM_THRESHOLD = 0.6;

/**
 * profile: Merge Profile JSON (xem mục 5 kế hoạch)
 * newHeaderList: string[] header của file mới upload
 * -> { action: 'auto' | 'confirm' | 'new', profileIndex, similarity, sourceProfile }
 */
const matchSourceProfile = (profile, newHeaderList) => {
  const newSig = buildHeaderSignature(newHeaderList);
  let best = { profileIndex: -1, similarity: 0, sourceProfile: null };

  (profile?.sourceProfiles || []).forEach((sp, idx) => {
    // short-circuit: hash trùng tuyệt đối -> similarity = 1 luôn, khỏi tính Jaccard
    if (sp.signature?.headerHash === newSig.headerHash) {
      best = { profileIndex: idx, similarity: 1, sourceProfile: sp };
      return;
    }
    const sim = jaccardSimilarity(sp.signature?.headerList || [], newHeaderList);
    if (sim > best.similarity) {
      best = { profileIndex: idx, similarity: sim, sourceProfile: sp };
    }
  });

  let action = 'new';
  if (best.similarity >= PROFILE_AUTO_APPLY_THRESHOLD) action = 'auto';
  else if (best.similarity >= PROFILE_CONFIRM_THRESHOLD) action = 'confirm';

  return { ...best, action, similarity: Math.round(best.similarity * 100) / 100 };
};

// =====================================================================
// 5. Merge (Step 3 -> Step 4 data) — layout luôn theo Target Schema cố định
// =====================================================================

/**
 * targetSchema.columns: [{ key, label, order }]
 * sources: [{ fileName, arrayBuffer, sheetName, headerRowIndex, columnMapping }]
 * onProgress: (percent, message) => void
 * -> mergedRows: [{ [targetKey]: value, ... }]
 */
const mergeSources = (targetSchema, sources, onProgress) => {
  const targetKeys = [...targetSchema.columns].sort((a, b) => a.order - b.order).map((c) => c.key);
  const mergedRows = [];

  sources.forEach((source, sIdx) => {
    const workbook = XLSX.read(source.arrayBuffer, { type: 'array', cellDates: true });
    const ws = workbook.Sheets[source.sheetName || workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });

    const headerRowIndex = source.headerRowIndex ?? 0;
    const headerRow = (rows[headerRowIndex] || []).map((h) => String(h ?? '').trim());
    const dataRows = rows.slice(headerRowIndex + 1);

    // sourceHeader -> targetKey (bỏ qua các mapping targetKey === null)
    const headerToTarget = new Map(
      (source.columnMapping || [])
        .filter((m) => m.targetKey)
        .map((m) => [m.sourceHeader, m.targetKey])
    );
    // vị trí cột trong file nguồn theo tên header
    const headerColIndex = new Map(headerRow.map((h, i) => [h, i]));

    dataRows.forEach((row) => {
      // bỏ qua dòng hoàn toàn trống
      if (row.every((cell) => cell === '' || cell === null || cell === undefined)) return;

      const outRow = {};
      for (const key of targetKeys) outRow[key] = '';

      for (const [sourceHeader, targetKey] of headerToTarget.entries()) {
        const colIdx = headerColIndex.get(sourceHeader);
        if (colIdx === undefined) continue;
        outRow[targetKey] = row[colIdx] ?? '';
      }
      mergedRows.push(outRow);
    });

    if (onProgress) {
      onProgress(Math.round(((sIdx + 1) / sources.length) * 90), `Đã ghép: ${source.fileName}`);
    }
  });

  return mergedRows;
};

// =====================================================================
// 6. Export (ExcelJS) — ghi vào file template, giữ style/merged cells/border
// =====================================================================

/**
 * targetSchema: { sheetName, keepExistingData, columns: [{key, label, order}] }
 * mergedRows: [{ [key]: value }]
 * templateArrayBuffer: ArrayBuffer của file template gốc
 * -> Promise<ArrayBuffer>
 */
const exportMergedWorkbook = async (targetSchema, mergedRows, templateArrayBuffer, onProgress) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(templateArrayBuffer);

  const sheetName = targetSchema.sheetName || workbook.worksheets[0].name;
  const sheet = workbook.getWorksheet(sheetName) || workbook.worksheets[0];

  const sortedCols = [...targetSchema.columns].sort((a, b) => a.order - b.order);
  const headerRowNumber = 1; // giả định header luôn ở dòng 1 của template (khớp targetSchema.columns)

  if (onProgress) onProgress(92, 'Đang xoá dữ liệu cũ (nếu có)...');

  if (!targetSchema.keepExistingData) {
    // Xoá toàn bộ dòng dữ liệu cũ (giữ header + style dòng header), giữ format cột
    const lastRow = sheet.rowCount;
    if (lastRow > headerRowNumber) {
      sheet.spliceRows(headerRowNumber + 1, lastRow - headerRowNumber);
    }
  }

  const startRow = targetSchema.keepExistingData ? sheet.rowCount + 1 : headerRowNumber + 1;

  if (onProgress) onProgress(95, 'Đang ghi dữ liệu đã ghép...');

  mergedRows.forEach((rowData, i) => {
    const excelRow = sheet.getRow(startRow + i);
    sortedCols.forEach((col, colIdx) => {
      excelRow.getCell(colIdx + 1).value = rowData[col.key] ?? '';
    });
    excelRow.commit();
  });

  if (onProgress) onProgress(98, 'Đang xuất file...');

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
};

// =====================================================================
// 7. Message router
// =====================================================================

const handlers = {
  parseFile: ({ arrayBuffer, fileName }) => parseWorkbookMeta(arrayBuffer, fileName),

  suggestMapping: ({ targetColumns, sourceHeaders }) =>
    suggestColumnMapping(targetColumns, sourceHeaders),

  matchProfile: ({ profile, newHeaderList }) => matchSourceProfile(profile, newHeaderList),

  mergeSources: ({ targetSchema, sources }, id) =>
    mergeSources(targetSchema, sources, (percent, message) =>
      self.postMessage({ id, type: 'progress', payload: { step: 'merge', percent, message } })
    ),

  exportWorkbook: async ({ targetSchema, mergedRows, templateArrayBuffer }, id) =>
    exportMergedWorkbook(targetSchema, mergedRows, templateArrayBuffer, (percent, message) =>
      self.postMessage({ id, type: 'progress', payload: { step: 'export', percent, message } })
    ),
};

if (typeof self !== 'undefined' && typeof self.onmessage !== 'undefined') {
self.onmessage = async (event) => {
  const { id, type, payload } = event.data || {};
  const handler = handlers[type];

  if (!handler) {
    self.postMessage({ id, type: 'error', payload: { message: `Unknown message type: ${type}` } });
    return;
  }

  try {
    const result = await handler(payload, id);
    // exportWorkbook trả về ArrayBuffer -> transfer thay vì clone để nhanh hơn
    if (type === 'exportWorkbook') {
      self.postMessage({ id, type: 'result', payload: result }, [result]);
    } else {
      self.postMessage({ id, type: 'result', payload: result });
    }
  } catch (err) {
    self.postMessage({
      id,
      type: 'error',
      payload: { message: err?.message || String(err), stack: err?.stack },
    });
  }
};
}

// =====================================================================
// 8. Export cho test (Node) — importScripts/self không tồn tại ngoài Worker,
//    nhưng các hàm thuần (helpers, mapping, matching) test được độc lập.
// =====================================================================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    normalizeHeader,
    levenshteinDistance,
    similarityRatio,
    jaccardSimilarity,
    djb2Hash,
    buildHeaderSignature,
    detectHeaderRowIndex,
    suggestColumnMapping,
    matchSourceProfile,
    mergeSources,
  };
}