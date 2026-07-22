/**
 * assets/js/admin-constants.js
 * Hằng số cấu hình + state dùng chung toàn app (KHÔNG chứa logic).
 * Phải load ĐẦU TIÊN, trước mọi file admin-*.js khác.
 */

const TAGS = [
  { key: 'vat',      name: 'thue-gtgt',      label: 'Thuế GTGT' },
  { key: 'tncn',     name: 'thue-tncn',      label: 'Thuế TNCN' },
  { key: 'tndn',     name: 'thue-tndn',      label: 'Thuế TNDN' },
  { key: 'bhxh',     name: 'bhxh',           label: 'BHXH' },
  { key: 'ke-toan',  name: 'ke-toan',        label: 'Kế toán' },
  { key: 'hai-quan', name: 'hai-quan',       label: 'Hải quan' },
  { key: 'xnk',      name: 'xuat-nhap-khau', label: 'Xuất nhập khẩu' },
];

const STATUS_LABEL = {
  hieu_luc:      'Còn hiệu lực',
  het_hieu_luc:  'Hết hiệu lực',
  chua_hieu_luc: 'Chưa có hiệu lực',
};

const MIME_SHORT = {
  pdf:  'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  doc:  'application/msword',
};

// Mỗi phần tử ứng với đúng 1 cột trong file Excel import/template.
// Thứ tự này quyết định thứ tự cột khi sinh file template.
const TEMPLATE_COLUMNS = [
  'title', 'code', 'description', 'issued_date', 'expiry_date', 'status', 'tags',
  'drive_type', 'drive_file_id', 'drive_view_url', 'drive_download_url',
  'mime_type', 'file_size', 'content',
];

let parsedRows = [];   // dữ liệu từ file xlsx import hàng loạt (panel "bulk")
let singleEntries = []; // danh sách record được thêm thủ công (panel "single")
let toolEntries = [];   // catalog tools chờ sinh SQL (panel "tools")

const PANEL_TITLES = {
  single:   'Nhập văn bản (nhiều dòng)',
  bulk:     'Import hàng loạt (Excel)',
  schema:   'Sơ đồ Database',
  template: 'Excel Template',
  tools:    'Nhập công cụ (nhiều dòng)',
  query:    'Query & Sửa dữ liệu (Supabase)',
};
