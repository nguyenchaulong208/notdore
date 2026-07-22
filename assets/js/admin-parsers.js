/**
 * assets/js/admin-parsers.js
 * Chuẩn hoá/parse giá trị input: Drive file id, mime type, drive type, URL.
 * Không phụ thuộc file admin-*.js nào khác.
 */

/** Trích drive_file_id từ Google Drive URL hoặc trả về chuỗi gốc nếu đã là ID */
function parseDriveFileId(urlOrId) {
  const s = (urlOrId || '').trim();
  if (!s) return '';
  const fromPath = s.match(/\/file\/d\/([^/?#]+)/);
  if (fromPath) return fromPath[1];
  const fromQuery = s.match(/[?&]id=([^&#]+)/);
  if (fromQuery) return fromQuery[1];
  if (!s.includes('://') && /^[\w-]{10,}$/.test(s)) return s;
  return s;
}

function resolveDriveFileId(explicit, viewUrl, downloadUrl) {
  const id = (explicit || '').trim();
  if (id) return id;
  return parseDriveFileId(viewUrl) || parseDriveFileId(downloadUrl) || '';
}

function normalizeMime(raw) {
  const short = (raw || 'pdf').toLowerCase().trim();
  return MIME_SHORT[short] || short;
}

function normalizeDriveType(raw) {
  const t = (raw || 'google').toLowerCase().trim();
  return t === 'onedrive' ? 'onedrive' : 'google';
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}
