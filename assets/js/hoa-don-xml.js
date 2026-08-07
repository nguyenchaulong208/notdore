// hoa-don-xml.js - extracted from inline script in hoa-don-xml.html
// Note: this file is a direct extraction of the page script. Keep in sync when refactoring.
//
// CHANGELOG (bản sửa):
// - Bổ sung trích xuất thông tin người mua (Tên/MST/Địa chỉ) — trước đây chưa từng được đọc.
// - Bổ sung "Mẫu số" (KHMSHDon), "Tiền phí", "Tiền thuế (dòng)" (tính từ Thành tiền × Thuế suất).
// - Tách rõ "Mã cơ quan thuế" (MCCQT) và "Mã tra cứu/Mã bí mật" (dò trong DLQRCode).
// - Đổi tên "Loại dòng" -> "Loại hàng hóa dịch vụ" cho đúng ngữ nghĩa hiển thị.
// - "Trạng thái hóa đơn" / "Biển kiểm soát": các trường này KHÔNG có vị trí cố định trong
//   mọi phần mềm hóa đơn điện tử (tùy nhà cung cấp phần mềm), nên dò best-effort theo vài
//   tên thẻ phổ biến và/hoặc qua cơ chế trường mở rộng (TTKhac) sẵn có — có thể để trống
//   nếu phần mềm xuất hóa đơn không khai báo các trường này.
// - Cập nhật lại danh sách cột mặc định hiển thị theo đúng bố cục bảng kê hóa đơn chuẩn.

// ════════════════════════════════════════════════════════════
//  STATE
// ════════════════════════════════════════════════════════════
let selectedFiles = [];
let allRows = [];
let errorLog = [];

// ── Danh sách cột mặc định HIỂN THỊ (đúng bố cục bảng kê hóa đơn) ─────────────
// Thứ tự trong mảng này cũng chính là thứ tự cột hiển thị/kết xuất.
const DEFAULT_VISIBLE_ORDER = [
    "File",
    "Ký hiệu hóa đơn", "Mẫu số", "Số hóa đơn", "Ngày hóa đơn",
    "Tên người mua", "Mã số thuế người mua", "Địa chỉ người mua",
    "Loại hàng hóa dịch vụ", "Tên hàng hóa dịch vụ", "Đơn vị tính", "Số lượng", "Đơn giá",
    "Thành tiền (dòng)", "Tiền phí", "Thuế suất", "Tiền thuế (dòng)",
    "Tỷ lệ % chiết khấu", "Số tiền chiết khấu",
    "Biển kiểm soát", "Trạng thái hóa đơn", "Mã cơ quan thuế", "Mã tra cứu/Mã bí mật",
];
const DEFAULT_VISIBLE = new Set(DEFAULT_VISIBLE_ORDER);

// Ghi đè của người dùng: col -> true (bật) hoặc false (tắt)
// Nếu key không có trong object => dùng DEFAULT_VISIBLE để quyết định
const userOverride = {};

function isColVisible(col) {
    if (col in userOverride) return userOverride[col];
    return DEFAULT_VISIBLE.has(col);
}

function getVisibleCols() {
    return COLUMNS.filter(c => isColVisible(c));
}

// Các cột tùy chọn khác (không mặc định hiện) — thông tin người bán, tổng hóa đơn, dữ liệu kỹ thuật...
const OPTIONAL_FIXED_COLUMNS = [
    "Đơn vị bán hàng", "Mã số thuế người bán", "Địa chỉ người bán", "Hình thức thanh toán",
    "Tổng tiền (trước thuế)", "Tổng giảm trừ không chịu thuế", "Tổng tiền chiết khấu thương mại",
    "Tổng giảm trừ khác", "Tiền thuế GTGT (tổng)", "Tổng tiền thanh toán", "Tổng tiền thanh toán bằng chữ",
    "Số thứ tự", "Mã hàng hóa dịch vụ", "Đường dẫn/Dữ liệu QR tra cứu",
];

// Cột cố định — đúng theo Quy định kỹ thuật định dạng hoá đơn điện tử
const FIXED_COLUMNS = [...DEFAULT_VISIBLE_ORDER, ...OPTIONAL_FIXED_COLUMNS];

// Các cột LUÔN xuất hiện trong bảng (kể cả khi rỗng ở mọi dòng) — các trường cấu trúc
// gần như chắc chắn có mặt trong mọi hóa đơn hợp lệ. Các trường tùy phần mềm/tùy loại
// hóa đơn (phí, chiết khấu, biển kiểm soát, trạng thái, mã CQT...) chỉ hiện khi có dữ liệu.
const ALWAYS_COLUMNS = new Set([
    "File", "Ký hiệu hóa đơn", "Mẫu số", "Số hóa đơn", "Ngày hóa đơn",
    "Tên người mua", "Mã số thuế người mua", "Địa chỉ người mua",
    "Loại hàng hóa dịch vụ", "Tên hàng hóa dịch vụ", "Đơn vị tính", "Số lượng", "Đơn giá",
    "Thành tiền (dòng)", "Thuế suất",
]);

const NUMERIC_COLUMNS = new Set([
    "Tổng tiền (trước thuế)", "Tổng giảm trừ không chịu thuế", "Tổng tiền chiết khấu thương mại",
    "Tổng giảm trừ khác", "Tiền thuế GTGT (tổng)", "Tổng tiền thanh toán",
    "Đơn giá", "Số tiền chiết khấu", "Thành tiền (dòng)", "Tiền phí", "Tiền thuế (dòng)"
]);

let COLUMNS = [...FIXED_COLUMNS];

const INTEGER_COLUMNS = new Set(["Số thứ tự", "Số lượng"]);
const PERCENT_COLUMNS = new Set(["Tỷ lệ % chiết khấu", "Thuế suất"]);

// Các cột là MÃ/ĐỊNH DANH (toàn chữ số nhưng không phải giá trị số học) — LUÔN giữ
// định dạng văn bản (text), không bao giờ được coi là số. Nếu không chặn riêng,
// detectNumericColumns() có thể dò nhầm các cột này là số (vì giá trị toàn chữ số),
// dẫn tới mất số 0 đứng đầu, thêm dấu phẩy/số thập phân sai khi xuất Excel.
const FORCE_TEXT_COLUMNS = new Set([
    "Số hóa đơn", "Ký hiệu hóa đơn", "Mẫu số",
    "Mã số thuế người mua", "Mã số thuế người bán",
    "Mã cơ quan thuế", "Mã tra cứu/Mã bí mật", "Mã hàng hóa dịch vụ",
]);

const TCHAT_LABELS = {
    '1': 'Hàng hóa, dịch vụ',
    '2': 'Chiết khấu thương mại',
    '3': 'Khuyến mãi không thu tiền',
    '4': 'Ghi chú / diễn giải',
    '5': 'Hàng hóa đặc trưng',
};

const DYNAMIC_NUMERIC = new Set();
function isNumericCol(col) {
    if (FORCE_TEXT_COLUMNS.has(col)) return false;
    return NUMERIC_COLUMNS.has(col) || INTEGER_COLUMNS.has(col) || PERCENT_COLUMNS.has(col) || DYNAMIC_NUMERIC.has(col);
}

function toNumberOrNull(value) {
    if (value === '' || value == null) return null;
    const cleaned = String(value).replace(/,/g, '').replace(/%/g, '').trim();
    if (cleaned === '' || Number.isNaN(Number(cleaned))) return null;
    return Number(cleaned);
}

function formatNumberVN(value, colName) {
    const num = toNumberOrNull(value);
    if (num === null) return esc(value);

    if (INTEGER_COLUMNS.has(colName)) {
        return num.toLocaleString('vi-VN', { maximumFractionDigits: 0 });
    }
    if (PERCENT_COLUMNS.has(colName)) {
        const displayNum = num <= 1 ? (num * 100) : num;
        return displayNum.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
    }
    return num.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function $id(id) { return document.getElementById(id); }

function findAllDeep(root, localName) {
    const result = [];
    const walk = (node) => {
        for (const child of node.children || []) {
            const name = child.localName || child.tagName || '';
            const local = name.includes(':') ? name.split(':').pop() : name;
            if (local === localName) result.push(child);
            walk(child);
        }
    };
    walk(root);
    return result;
}

function findFirst(root, localName) { return findAllDeep(root, localName)[0] || null; }

function directChildren(node, localName) {
    const out = [];
    for (const child of node.children || []) {
        const name = child.localName || child.tagName || '';
        const local = name.includes(':') ? name.split(':').pop() : name;
        if (local === localName) out.push(child);
    }
    return out;
}

function getTextByTag(root, tag) {
    if (!root) return '';
    const node = findFirst(root, tag);
    return node ? (node.textContent || '').trim() : '';
}

// Dò lần lượt theo danh sách tên thẻ khả dĩ, trả về giá trị đầu tiên khác rỗng.
// Dùng cho các trường không có tên thẻ cố định giữa các phần mềm hóa đơn điện tử.
function getTextByAnyTag(root, tags) {
    for (const tag of tags) {
        const val = getTextByTag(root, tag);
        if (val) return val;
    }
    return '';
}

function collectFieldPairs(container, prefix = '') {
    const result = {};
    for (const ttin of directChildren(container, 'TTin')) {
        const truong = findFirst(ttin, 'TTruong');
        const dlieu = findFirst(ttin, 'DLieu');
        const key = truong ? (truong.textContent || '').trim() : '';
        if (!key) continue;
        result[prefix ? `${prefix}: ${key}` : key] = dlieu ? (dlieu.textContent || '').trim() : '';
    }
    return result;
}

function collectAllTTKhac(node, prefix = '') {
    if (!node) return {};
    let result = {};
    for (const ttkhac of directChildren(node, 'TTKhac')) {
        Object.assign(result, collectFieldPairs(ttkhac, prefix));
    }
    return result;
}

// Trạng thái hóa đơn thường KHÔNG nằm trong XML gốc của hóa đơn (nó là kết quả tra cứu
// trên cổng CQT), nhưng một số phần mềm có nhúng thêm thẻ riêng — dò best-effort.
function detectInvoiceStatus(root, ttchung) {
    return getTextByAnyTag(ttchung, ['TTHDon', 'TrangThai', 'TThai'])
        || getTextByAnyTag(root, ['TrangThaiHDon', 'TrangThai']);
}

// Mã tra cứu / mã bí mật: ưu tiên thẻ riêng nếu phần mềm xuất hóa đơn khai báo,
// nếu không thì thử đọc từ tham số truy vấn trong dữ liệu QR (khi đó là dạng URL).
// Định dạng DLQRCode khác nhau tùy nhà cung cấp phần mềm nên đây là dò best-effort.
function extractLookupCode(qrCode, ttchung) {
    const direct = getTextByAnyTag(ttchung, ['MTBaoMat', 'MaBiMat', 'MTraCuu']);
    if (direct) return direct;
    if (!qrCode) return '';
    try {
        const url = new URL(qrCode);
        const candidates = ['mtc', 'matc', 'matracuu', 'ma_tra_cuu', 'bimat', 'mabimat', 'secure', 'code'];
        for (const key of url.searchParams.keys()) {
            if (candidates.includes(key.toLowerCase())) return url.searchParams.get(key);
        }
    } catch (_) { /* DLQRCode không phải URL — không dò được tham số cụ thể */ }
    return '';
}

function parseInvoice(xmlString, fileName) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');
    const parseErr = doc.querySelector('parsererror');
    if (parseErr) throw new Error('XML không hợp lệ: ' + parseErr.textContent.slice(0, 120));

    const root = doc.documentElement;
    const dlhdon = findFirst(root, 'DLHDon') || root;
    const ttchung = findFirst(dlhdon, 'TTChung') || dlhdon;
    const ndhdon = findFirst(dlhdon, 'NDHDon') || dlhdon;
    const nban = findFirst(ndhdon, 'NBan');
    const nmua = findFirst(ndhdon, 'NMua');
    const ttoan = findFirst(ndhdon, 'TToan');

    const commonExtra = {
        ...collectAllTTKhac(dlhdon),
        ...collectAllTTKhac(ttchung),
        ...collectAllTTKhac(nban, 'Người bán'),
        ...collectAllTTKhac(nmua, 'Người mua'),
        ...collectAllTTKhac(ttoan),
    };

    const maCQThue = getTextByTag(root, 'MCCQT');
    const qrCode = getTextByTag(root, 'DLQRCode');
    const maBiMat = extractLookupCode(qrCode, ttchung);
    const trangThai = detectInvoiceStatus(root, ttchung);

    const common = {
        "File":                              fileName,
        "Ký hiệu hóa đơn":                  getTextByTag(ttchung, 'KHHDon'),
        "Mẫu số":                            getTextByTag(ttchung, 'KHMSHDon'),
        "Số hóa đơn":                        getTextByTag(ttchung, 'SHDon'),
        "Ngày hóa đơn":                      getTextByTag(ttchung, 'NLap'),
        "Tên người mua":                     nmua ? getTextByTag(nmua, 'Ten')  : '',
        "Mã số thuế người mua":              nmua ? getTextByTag(nmua, 'MST')  : '',
        "Địa chỉ người mua":                 nmua ? getTextByTag(nmua, 'DChi') : '',
        "Tiền phí":                          ttoan ? getTextByAnyTag(ttoan, ['TPhi', 'TTPhi', 'Phi']) : '',
        "Trạng thái hóa đơn":                trangThai,
        "Mã cơ quan thuế":                   maCQThue,
        "Mã tra cứu/Mã bí mật":              maBiMat,
        "Đơn vị bán hàng":                   nban ? getTextByTag(nban, 'Ten')  : '',
        "Mã số thuế người bán":               nban ? getTextByTag(nban, 'MST')  : '',
        "Địa chỉ người bán":                 nban ? getTextByTag(nban, 'DChi') : '',
        "Hình thức thanh toán":              getTextByTag(ttchung, 'HTTToan'),
        "Tổng tiền (trước thuế)":            ttoan ? getTextByTag(ttoan, 'TgTCThue')  : '',
        "Tổng giảm trừ không chịu thuế":     ttoan ? getTextByTag(ttoan, 'TGTKCThue') : '',
        "Tổng tiền chiết khấu thương mại":   ttoan ? getTextByTag(ttoan, 'TTCKTMai')  : '',
        "Tổng giảm trừ khác":                ttoan ? getTextByTag(ttoan, 'TGTKhac')   : '',
        "Tiền thuế GTGT (tổng)":             ttoan ? getTextByTag(ttoan, 'TgTThue')   : '',
        "Tổng tiền thanh toán":              ttoan ? getTextByTag(ttoan, 'TgTTTBSo')  : '',
        "Tổng tiền thanh toán bằng chữ":     ttoan ? getTextByTag(ttoan, 'TgTTTBChu') : '',
        "Đường dẫn/Dữ liệu QR tra cứu":      qrCode,
        ...commonExtra,
    };

    const items = findAllDeep(ndhdon, 'HHDVu');
    if (!items.length) return [{ ...common }];

    return items.map(item => {
        const tchat = getTextByTag(item, 'TChat');
        const ttHDTrung = findFirst(item, 'TTHHDTrung');
        const itemExtra = {
            ...collectAllTTKhac(item),
            ...(ttHDTrung ? collectFieldPairs(ttHDTrung, 'Đặc trưng') : {}),
        };

        // Tiền thuế theo dòng = Thành tiền × Thuế suất (%). Bỏ qua khi thuế suất
        // không phải là số (VD: "KCT" - không chịu thuế, "KKKNT"...).
        const thTienRaw = getTextByTag(item, 'ThTien');
        const tsuatRaw = getTextByTag(item, 'TSuat');
        const thanhTienNum = toNumberOrNull(thTienRaw);
        const tsuatNum = toNumberOrNull(tsuatRaw);
        let tienThueDong = '';
        if (thanhTienNum !== null && tsuatNum !== null) {
            const percent = tsuatNum <= 1 ? tsuatNum * 100 : tsuatNum;
            tienThueDong = Math.round(thanhTienNum * percent) / 100;
        }

        return {
            ...common,
            "Loại hàng hóa dịch vụ":  TCHAT_LABELS[tchat] || (tchat ? `Khác (${tchat})` : ''),
            "Số thứ tự":               getTextByTag(item, 'STT'),
            "Mã hàng hóa dịch vụ":     getTextByTag(item, 'MHHDVu'),
            "Tên hàng hóa dịch vụ":    getTextByTag(item, 'THHDVu'),
            "Đơn vị tính":             getTextByTag(item, 'DVTinh'),
            "Số lượng":                getTextByTag(item, 'SLuong'),
            "Đơn giá":                 getTextByTag(item, 'DGia'),
            "Thành tiền (dòng)":       thTienRaw,
            "Thuế suất":               tsuatRaw,
            "Tiền thuế (dòng)":        tienThueDong,
            "Tỷ lệ % chiết khấu":      getTextByTag(item, 'TLCKhau'),
            "Số tiền chiết khấu":      getTextByTag(item, 'STCKhau'),
            ...itemExtra,
        };
    });
}

function esc(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatBytes(b) {
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b/1024).toFixed(1) + ' KB';
    return (b/1048576).toFixed(1) + ' MB';
}

function log(msg, type = 'info') {
    const box = $id('log-box');
    box.style.display = 'block';
    const div = document.createElement('div');
    div.className = type === 'err' ? 'log-err' : 'log-info';
    div.textContent = msg;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
    $id('btn-toggle-log').style.display = '';
}

function clearLog() {
    const box = $id('log-box');
    box.innerHTML = '';
    box.style.display = 'none';
}

function updateFileList() {
    const wrap = $id('file-list-wrap');
    if (!selectedFiles.length) { wrap.classList.add('d-none'); return; }
    wrap.classList.remove('d-none');
    $id('file-count-label').textContent = `${selectedFiles.length} file đã chọn`;
    $id('file-list').innerHTML = selectedFiles.map((f, i) => `
        <li>
            <i class="fas fa-file-code" style="color:#ed6524;flex-shrink:0"></i>
            <span class="fi-name" title="${esc(f.name)}">${esc(f.name)}</span>
            <span class="fi-badge bg-primary text-white">${formatBytes(f.size)}</span>
            <button class="btn btn-sm p-0 ms-1" style="line-height:1;color:#999" data-idx="${i}" title="Xóa file này">
                <i class="fas fa-times-circle"></i>
            </button>
        </li>`).join('');
    $id('btn-run').disabled = false;
}

function addFiles(files) {
    const existing = new Set(selectedFiles.map(f => `${f.name}|${f.size}|${f.lastModified}`));
    for (const f of files) {
        const key = `${f.name}|${f.size}|${f.lastModified}`;
        if (!existing.has(key)) {
            selectedFiles.push(f);
            existing.add(key);
        }
    }
    selectedFiles.sort((a, b) => a.name.localeCompare(b.name));
    updateFileList();
}

function buildColPanel() {
    const grid = $id('col-grid');
    grid.innerHTML = '';
    COLUMNS.forEach(col => {
        const isExtra = !DEFAULT_VISIBLE.has(col);
        const visible  = isColVisible(col);

        const label = document.createElement('label');
        label.className = 'col-check-label' + (isExtra ? ' is-extra' : '');
        label.title = isExtra ? 'Thông tin bổ sung (ẩn mặc định)' : 'Cột thường dùng';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = visible;
        cb.addEventListener('change', () => {
            userOverride[col] = cb.checked;
            try { localStorage.setItem('hdxml_userCols', JSON.stringify(userOverride)); } catch (e) { /* ignore */ }
            renderPreview();
        });

        const icon = document.createElement('i');
        icon.className = isExtra ? 'fas fa-eye-slash fa-xs me-1' : 'fas fa-check fa-xs me-1';

        label.append(cb, icon, document.createTextNode(col));
        grid.appendChild(label);
    });
}

function renderPreview() {
    const MAX  = 200;
    const cols = getVisibleCols();
    const rows = allRows.slice(0, MAX);

    $id('preview-thead').innerHTML = `<tr>${cols.map(c => {
        const cls = [isNumericCol(c) ? 'num' : '', !DEFAULT_VISIBLE.has(c) ? 'th-extra' : ''].filter(Boolean).join(' ');
        return `<th class="${cls}">${esc(c)}</th>`;
    }).join('')}</tr>`;

    $id('preview-tbody').innerHTML = rows.map(r =>
        `<tr>${cols.map(c => {
            const isNum   = isNumericCol(c);
            const isExtra = !DEFAULT_VISIBLE.has(c);
            const display = isNum ? formatNumberVN(r[c], c) : esc(r[c]);
            const cls = [isNum ? 'num' : '', isExtra ? 'td-extra' : ''].filter(Boolean).join(' ');
            return `<td class="${cls}">${display}</td>`;
        }).join('')}</tr>`
    ).join('');

    $id('preview-note').textContent = allRows.length > MAX
        ? `(hiển thị ${MAX}/${allRows.length} dòng — xuất Excel để xem tất cả)`
        : '';
    $id('preview-outer').style.display = 'block';
    buildColPanel();
}

async function processFiles() {
    allRows = [];
    errorLog = [];
    clearLog();
    $id('stats-section').classList.add('d-none');
    $id('preview-outer').style.display = 'none';
    $id('btn-export').disabled = true;

    const btn = $id('btn-run');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Đang xử lý...';

    const invoiceSet = new Set();

    for (const file of selectedFiles) {
        try {
            const text = await file.text();
            const rows = parseInvoice(text, file.name);
            allRows.push(...rows);
            if (rows.length) invoiceSet.add(rows[0]["Số hóa đơn"] || file.name);
            log(`✓ ${file.name} — ${rows.length} dòng hàng`, 'info');
        } catch (e) {
            errorLog.push({ file: file.name, msg: e.message });
            log(`✗ ${file.name} — ${e.message}`, 'err');
        }
    }

    recomputeColumns();
    detectNumericColumns();

    $id('stat-files').textContent    = selectedFiles.length;
    $id('stat-invoices').textContent = invoiceSet.size;
    $id('stat-rows').textContent     = allRows.length;
    $id('stat-errors').textContent   = errorLog.length;
    $id('stats-section').classList.remove('d-none');

    if (allRows.length) {
        renderPreview();
        $id('btn-export').disabled = false;
        $id('btn-cols').style.display = '';
    }

    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-play me-2"></i>Xử lý &amp; Xem kết quả';
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src; s.onload = resolve;
        s.onerror = () => reject(new Error('Không tải được: ' + src));
        document.head.appendChild(s);
    });
}

const THIN_BORDER = { style: 'thin', color: { argb: 'FFE0E0E8' } };
const CELL_BORDER = { top: THIN_BORDER, left: THIN_BORDER, bottom: THIN_BORDER, right: THIN_BORDER };

function colLetter(idx) {
    let n = idx + 1, s = '';
    while (n > 0) {
        const rem = (n - 1) % 26;
        s = String.fromCharCode(65 + rem) + s;
        n = Math.floor((n - 1) / 26);
    }
    return s;
}

async function exportExcel() {
    if (!allRows.length) return;
    const btn = $id('btn-export');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Đang tạo file...';
    try {
        if (!window.ExcelJS) await loadScript('https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js');
        const ExcelJS = window.ExcelJS;

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'NotDore';
        workbook.created = new Date();

        const sheet = workbook.addWorksheet('Hóa đơn', {
            views: [{ state: 'frozen', ySplit: 1 }],
        });

        const VISIBLE = getVisibleCols();
        sheet.columns = VISIBLE.map(c => {
            const sample = allRows.slice(0, 80).map(r => String(r[c] ?? '').length);
            const width = Math.min(Math.max(c.length, ...sample) + 3, 42);
            return { header: c, key: c, width };
        });

        const headerRow = sheet.getRow(1);
        headerRow.height = 26;
        headerRow.eachCell(cell => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFED6524' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cell.border = CELL_BORDER;
        });

        allRows.forEach((r, idx) => {
            const rowValues = {};
            VISIBLE.forEach(c => {
                const raw = r[c] ?? '';
                if (FORCE_TEXT_COLUMNS.has(c)) {
                    rowValues[c] = String(raw);
                } else if (PERCENT_COLUMNS.has(c)) {
                    const num = toNumberOrNull(raw);
                    rowValues[c] = num !== null ? (num <= 1 ? num : num / 100) : raw;
                } else if (INTEGER_COLUMNS.has(c)) {
                    const num = toNumberOrNull(raw);
                    rowValues[c] = num !== null ? Math.round(num) : raw;
                } else if (NUMERIC_COLUMNS.has(c) || DYNAMIC_NUMERIC.has(c)) {
                    const num = toNumberOrNull(raw);
                    rowValues[c] = num !== null ? num : raw;
                } else {
                    rowValues[c] = raw;
                }
            });
            const row = sheet.addRow(rowValues);
            row.eachCell((cell, colNumber) => {
                const colName = VISIBLE[colNumber - 1];
                cell.border = CELL_BORDER;
                cell.font = { size: 10.5, name: 'Calibri' };
                if (FORCE_TEXT_COLUMNS.has(colName)) {
                    cell.numFmt = '@';
                    cell.alignment = { horizontal: 'left', vertical: 'middle' };
                } else if (PERCENT_COLUMNS.has(colName)) {
                    cell.numFmt = '0.00%';
                    cell.alignment = { horizontal: 'right', vertical: 'middle' };
                } else if (INTEGER_COLUMNS.has(colName)) {
                    cell.numFmt = '#,##0';
                    cell.alignment = { horizontal: 'right', vertical: 'middle' };
                } else if (NUMERIC_COLUMNS.has(colName) || DYNAMIC_NUMERIC.has(colName)) {
                    cell.numFmt = '#,##0.00';
                    cell.alignment = { horizontal: 'right', vertical: 'middle' };
                } else {
                    cell.alignment = { vertical: 'middle' };
                }
                if (idx % 2 === 1) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F7FB' } };
                }
            });
        });

        sheet.autoFilter = { from: 'A1', to: `${colLetter(VISIBLE.length - 1)}1` };
        sheet.properties.defaultRowHeight = 20;

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const date = new Date().toISOString().slice(0, 10);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tong_hop_hoa_don_${date}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    } catch (e) {
        alert('Không thể xuất Excel: ' + e.message);
    }
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-file-excel me-2"></i>Xuất file Excel';
}

function recomputeColumns() {
    const hasValue = new Set();
    for (const row of allRows) {
        for (const [key, val] of Object.entries(row)) {
            if (val !== '' && val != null) hasValue.add(key);
        }
    }

    const seen = new Set();
    const cols = [];

    for (const c of FIXED_COLUMNS) {
        if (ALWAYS_COLUMNS.has(c)) { cols.push(c); seen.add(c); }
    }
    for (const c of FIXED_COLUMNS) {
        if (!seen.has(c) && hasValue.has(c)) { cols.push(c); seen.add(c); }
    }
    for (const row of allRows) {
        for (const key of Object.keys(row)) {
            if (!seen.has(key) && hasValue.has(key)) { seen.add(key); cols.push(key); }
        }
    }

    COLUMNS = cols;
}

function detectNumericColumns() {
    DYNAMIC_NUMERIC.clear();
    const SAMPLE = 80;
    for (const col of COLUMNS) {
        if (NUMERIC_COLUMNS.has(col) || INTEGER_COLUMNS.has(col) || PERCENT_COLUMNS.has(col) || FORCE_TEXT_COLUMNS.has(col)) continue;
        let numericCount = 0, total = 0;
        for (let i = 0; i < Math.min(allRows.length, SAMPLE); i++) {
            const v = allRows[i][col];
            if (v === undefined || v === null || v === '') continue;
            total++;
            if (toNumberOrNull(v) !== null) numericCount++;
        }
        if (total > 0 && numericCount / total >= 0.6) {
            DYNAMIC_NUMERIC.add(col);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const dropZone  = $id('drop-zone');
    const fileInput = $id('file-input');
    try {
        const saved = localStorage.getItem('hdxml_userCols');
        if (saved) Object.assign(userOverride, JSON.parse(saved));
    } catch (e) { }

    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') fileInput.click(); });
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        addFiles([...e.dataTransfer.files].filter(f => f.name.toLowerCase().endsWith('.xml')));
    });

    fileInput.addEventListener('change', () => { addFiles([...fileInput.files]); fileInput.value = ''; });

    $id('file-list').addEventListener('click', e => {
        const btn = e.target.closest('[data-idx]');
        if (!btn) return;
        selectedFiles.splice(Number(btn.dataset.idx), 1);
        updateFileList();
        if (!selectedFiles.length) $id('btn-run').disabled = true;
    });

    $id('btn-clear').addEventListener('click', () => {
        selectedFiles = []; allRows = []; errorLog = [];
        updateFileList();
        $id('btn-run').disabled = true;
        $id('btn-export').disabled = true;
        $id('btn-cols').style.display = 'none';
        $id('col-panel').style.display = 'none';
        $id('stats-section').classList.add('d-none');
        $id('preview-outer').style.display = 'none';
        clearLog();
    });

    $id('btn-cols').addEventListener('click', () => {
        const panel = $id('col-panel');
        const open  = panel.style.display === 'block';
        panel.style.display = open ? 'none' : 'block';
        $id('btn-cols').innerHTML = open
            ? '<i class="fas fa-columns me-1"></i>Chọn cột'
            : '<i class="fas fa-times me-1"></i>Đóng bộ chọn';
    });

    $id('btn-run').addEventListener('click', processFiles);
    $id('btn-export').addEventListener('click', exportExcel);
    $id('btn-toggle-log').addEventListener('click', () => {
        const box = $id('log-box');
        box.style.display = box.style.display === 'none' ? 'block' : 'none';
    });
});