# NotDore — Tóm tắt tri thức toàn dự án

> Tài liệu này là bản đồ tổng thể để phiên làm việc sau nắm nhanh cấu trúc, quy ước và
> logic nghiệp vụ. Các ghi chú chuyên sâu vẫn nằm ở các file riêng trong `.agents/memory/`
> (xem mục cuối). Cập nhật lần cuối: 2026-10-21.

---

## 1. Dự án là gì

NotDore là website tra cứu văn bản pháp luật (thuế GTGT / TNCN / TNDN / BHXH) kèm bộ
**công cụ xử lý Excel – PDF – XML** chạy hoàn toàn phía trình duyệt:

| Nhóm | Trang | Chức năng |
|---|---|---|
| Văn bản | `index.html`, `van-ban.html`, `xem-van-ban.html` | Danh sách, lọc theo loại/thuế, xem chi tiết |
| Công cụ | `tool-detail.html` | Giới thiệu từng công cụ, link sang trang chạy |
| Bài viết | `article-detail.html` | Bài viết pháp luật (nội dung nội bộ hoặc link gốc) |
| Tool 1 | `merge-excel.html` | Ghép nhiều file Excel theo template (wizard 5 bước) |
| Tool 2 | `invoice-ocr.html` | OCR hoá đơn PDF/ảnh → bảng + Excel |
| Tool 3 | `invoice-extractor.html` | Trích xuất dữ liệu hoá đơn theo mẫu cấu hình |
| Tool 4 | `hoa-don-xml.html` | Đọc XML hoá đơn điện tử, giải mã QR, xuất Excel |
| Tool 5 | `allocate-import-cost.html` | Phân bổ chi phí nhập khẩu theo lô hàng |
| Nội bộ | `admin.html` (`/admin`) | Sinh SQL nhập liệu + truy vấn Supabase (chỉ chạy local) |

Điểm cốt lõi: **không có bundler, không framework**. Mọi trang là HTML tĩnh + JS thuần
gắn global object theo từng nhóm chức năng. Chỉ serverless `api/` mới chạm Supabase.

---

## 2. Stack & ràng buộc

- **Frontend**: HTML tĩnh, Bootstrap 5 (local `assets/plugins/bootstrap/`), FontAwesome /
  Bootstrap Icons, Google Fonts (Inter + Quicksand). JS ES5/ES6 thuần, IIFE + global namespace.
- **Backend**: Vercel Serverless Functions (Node 24, ESM — `"type": "module"` trong `package.json`).
- **DB**: Supabase Postgres, truy cập qua `@supabase/supabase-js`.
- **Email**: Resend API (form liên hệ).
- **AI**: NVIDIA NIM (`integrate.api.nvidia.com/v1/chat/completions`) cho OCR ảnh.
- **Deploy**: Vercel; `vercel.json` giữ cấu hình route/rewrite. `.replit` chỉ để mở nhanh.

Ràng buộc từ `replit.md` (ưu tiên của chủ dự án):
1. **Không** thêm bundler / build step / framework JS.
2. Giữ nguyên cấu trúc thư mục hiện có; file mới đặt đúng chỗ theo loại.
3. Code ngắn gọn, tránh trừu tượng hoá thừa; ưu tiên hàm thuần, dễ đọc.
4. Tài liệu và comment viết bằng tiếng Việt.

---

## 3. Bản đồ thư mục

```
/
├─ index.html                  # Trang chủ: hero, văn bản mới, slider công cụ, bài viết, liên hệ
├─ van-ban.html                # Danh sách văn bản + bộ lọc + tab bài viết
├─ xem-van-ban.html            # Xem 1 văn bản (reader + file đính kèm)
├─ tool-detail.html            # Chi tiết công cụ (đọc ?slug=)
├─ article-detail.html         # Chi tiết bài viết (đọc ?slug=)
├─ merge-excel.html            # Tool: ghép Excel (wizard)
├─ invoice-ocr.html            # Tool: OCR hoá đơn
├─ invoice-extractor.html      # Tool: trích xuất hoá đơn theo mẫu
├─ hoa-don-xml.html            # Tool: XML hoá đơn điện tử
├─ allocate-import-cost.html   # Tool: phân bổ chi phí nhập khẩu (logic nằm inline)
├─ admin.html                  # /admin — bảng điều khiển nội bộ
│
├─ api/                        # Vercel serverless (ESM)
│  ├─ documents.js             # GET danh sách văn bản + files
│  ├─ category.js              # GET văn bản theo ?cat=vat|tncn|tndn|bhxh
│  ├─ tools.js                 # GET danh sách công cụ (+ danh mục, link)
│  ├─ articles.js              # GET bài viết (?slug= | ?id= | danh sách)
│  ├─ contact.js               # POST form liên hệ → Resend
│  ├─ nvidia-proxy.js          # Proxy gọi NVIDIA NIM (giấu key phía server)
│  └─ admin/docs.js            # GET/PATCH văn bản cho admin (ghi DB)
│
├─ lib/supabase.js             # Khởi tạo client từ env (dùng chung cho api/)
├─ db/                         # SQL chạy tay trong Supabase SQL Editor
│  ├─ schema_v2.sql
│  ├─ migration_v1_to_v2.sql
│  ├─ migration_add_tools.sql
│  └─ migration_add_articles.sql
│
├─ assets/
│  ├─ css/   notdore.css | pages.css | anime.css | cybercore.css
│  ├─ js/    (xem mục 6)
│  ├─ images/, assets/plugins/ (bootstrap, fontawesome, …)
│
├─ README.md, replit.md, CREDITS.md, vercel.json, package.json, .replit
└─ .agents/memory/             # Ghi chú tri thức cho các phiên sau
```

---

## 4. Kiến trúc & luồng dữ liệu

```
Trình duyệt ──fetch──> /api/*  ──supabase-js──> Supabase Postgres
     │                   │
     │                   └─ Resend (contact) / NVIDIA NIM (proxy)
     └─ Tool chạy 100% client-side: File API, SheetJS, ExcelJS, pdf.js,
        Web Worker (merge), Canvas → PNG (OCR ảnh)
```

Nguyên tắc:
- **Đọc** dữ liệu công khai → `api/documents.js`, `api/category.js`, `api/tools.js`,
  `api/articles.js` (anon key, RLS chỉ cho SELECT).
- **Ghi** dữ liệu → chỉ `api/admin/docs.js` (admin local), không lộ key service-role
  ra client. Admin panel mặc định **chỉ sinh SQL**, không ghi trực tiếp.
- **Tool** không gửi file lên server (trừ ảnh hoá đơn khi dùng đường AI vision, và
  ảnh đó đi qua `api/nvidia-proxy.js` hoặc gọi trực tiếp bằng key người dùng nhập).

---

## 5. Mô hình dữ liệu

### 5.1 Nhóm văn bản (schema v2)

| Bảng | Cột chính | Ghi chú |
|---|---|---|
| `documents` | `id` (uuid), `code`, `title`, `description`, `issued_date`, `expiry_date`, `status`, `loai_van_ban`, `created_at`, `updated_at` | `status ∈ hieu_luc / het_hieu_luc / chua_hieu_luc`; trigger `set_updated_at()` |
| `document_files` | `id`, `document_id` (FK cascade), `drive_type`, `drive_file_id`, `drive_view_url`, `drive_download_url`, `mime_type`, `size`, `uploaded_at` | 1 văn bản ↔ nhiều file |
| `document_tags` | `id`, `name` (unique), `label` | Seed: `thue-gtgt`, `thue-tncn`, `thue-tndn`, `bhxh` |
| `document_tag_map` | `document_id`, `tag_id` (PK kép) | N–N văn bản ↔ nhãn |
| `document_texts` | nội dung text trích từ PDF | Có trong DB thực tế, không có trong `schema_v2.sql` |

> ⚠️ `schema_v2.sql` viết bằng cột tiếng Anh (`code`, `title`), nhưng code chạy thật
> dùng thêm `loai_van_ban` (tiếng Việt). Khi sinh SQL/đọc DB phải theo **DB thực tế**,
> không chỉ theo file schema.

### 5.2 Nhóm công cụ (`migration_add_tools.sql`)

| Bảng | Cột chính |
|---|---|
| `categories` | `category_id` (identity), `category_name` (unique), `description` |
| `tools` | `tool_id`, `tool_name`, `slug` (unique), `category_id` (FK set null), `description`, `thumbnail_url`, `tool_url`, `article_url`, `is_active`, `created_at`, `updated_at` |
| `external_sources` | `source_id`, `source_name`, `base_url`, `description` |
| `tool_links` | `link_id`, `tool_id` (FK), `source_id` (FK), `url`, `label` |
| `tags` | `tag_id`, `tag_name` (unique) |
| `tool_tags` | `tool_id`, `tag_id` (PK kép) |

> Ghi chú mâu thuẫn: comment trong `api/tools.js` nói `tags`/`tool_tags` đã bị bỏ, nhưng
> migration và admin (query tab `tool_tags`) vẫn dùng. Trước khi xoá phải kiểm tra DB thật.

### 5.3 Nhóm bài viết (`migration_add_articles.sql`)

| Bảng | Cột chính |
|---|---|
| `article_categories` | `category_id`, `category_name` (unique), `description` |
| `articles` | `article_id`, `title`, `slug` (unique), `category_id`, `summary`, `thumbnail_url`, `content`, `content_url`, `original_url` (**NOT NULL**), `original_source`, `published_at`, `is_published`, `created_at`, `updated_at` |

Ràng buộc CHECK: `original_url`, `content_url`, `thumbnail_url` phải khớp `^https?://`.
Bài viết luôn có link gốc; `content` (nhập tay) và `content_url` (markdown raw) là tuỳ chọn.

### 5.4 RLS

Mỗi migration đều bật RLS và tạo policy `SELECT` cho `anon` trên bảng public.
Bảng văn bản/admin không có policy ghi cho `anon` → mọi thao tác ghi phải qua server
hoặc SQL Editor.

---

## 6. Trang ↔ script ↔ global object

| Trang | Script (theo thứ tự load) | Global |
|---|---|---|
| `index.html` | `main.js` → `utils.js` → `index.js` → `mail.js` → `oneko.js` | `NotDore` (utils), `IndexPage` |
| `van-ban.html` | `main.js` → `utils.js` → `index.js` → `van-ban-articles.js` → `mail.js` | dùng lại `IndexPage` cho danh sách/lọc |
| `xem-van-ban.html` | `main.js` → `utils.js` → `van-ban-viewer.js` → `mail.js` | `VanBanViewer` |
| `tool-detail.html` | `main.js` → `utils.js` → `tool-detail.js` → `mail.js` | `ToolDetail` |
| `article-detail.html` | `main.js` → `utils.js` → `article-detail.js` → `mail.js` | `ArticleDetail` |
| `merge-excel.html` | `merge-wizard-state.js` → `profile` → `step1..step5` → `worker` | `MW` (`MW.state`, `MW.util`, `MW.profile`) |
| `invoice-ocr.html` | `invoice-ocr-vat-parser.js` → `invoice-ocr-vision.js` → `invoice-ocr-app.js` | `IOCR` (`VatParser`, `Vision`, `App`) |
| `invoice-extractor.html` | `invoice-extractor-utils.js` → `engine.js` → `app.js` | `IEX` |
| `hoa-don-xml.html` | `hoa-don-xml.js` → `mail.js` | `HDXML` |
| `allocate-import-cost.html` | inline `<script type="module">` + `mail.js` | không có global, logic nằm trong trang |
| `admin.html` | 12 file `admin-*.js` (defer, đúng thứ tự) | `AdminConst`, `AdminSql`, `AdminUI`, `AdminParsers`, `AdminExcel`, `AdminDocEntry`, `AdminToolEntry`, `AdminQuery` |

Quy ước chung:
- Mọi trang public đều có `mail.js` (form liên hệ) và `oneko.js` (hiệu ứng mèo chạy theo chuột).
- `utils.js` cung cấp helper dùng chung: `escapeHtml`, format ngày, debounce, `fetchJSON`, v.v.
- CSS: `notdore.css` = layout/theme/component gốc dùng cho **mọi** trang; `pages.css` =
  style riêng trang con (trừ `index.html`); `anime.css` = hiệu ứng/trang trí (admin + trang
  công cụ); `cybercore.css` = biến thể giao diện, hiện ít/không được tham chiếu.

---

## 7. Hợp đồng API

Tất cả handler là default export `async function handler(req, res)`, trả JSON, có CORS
mở (`Access-Control-Allow-Origin: *`) và xử lý `OPTIONS`.

| Endpoint | Method | Input | Output |
|---|---|---|---|
| `/api/documents` | GET | — | `{ documents: [...], files: [...] }` (join thủ công theo `document_id`) |
| `/api/category` | GET | `?cat=vat\|tncn\|tndn\|bhxh` | Danh sách văn bản thuộc nhãn tương ứng |
| `/api/tools` | GET | — | `{ tools, categories, links, sources }` (hoặc mảng tools) |
| `/api/articles` | GET | `?slug=` hoặc `?id=` hoặc không | 1 bài viết / danh sách đã publish |
| `/api/admin/docs` | GET | — | Toàn bộ văn bản + files + tags (dùng cho admin) |
| `/api/admin/docs` | PATCH | body `{ id, patch, tags, file }` | Cập nhật ngày hiệu lực/trạng thái, thay tag, thêm file |
| `/api/contact` | POST | `{ email, message }` | Gửi mail qua Resend tới `nguyenchaulong.data208@gmail.com` |
| `/api/nvidia-proxy` | POST | `{ model, messages, ... }` | Chuyển tiếp tới NVIDIA NIM, trả nguyên response |

Biến môi trường bắt buộc: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `RESEND_API_KEY`
(và key NVIDIA nếu dùng proxy phía server). Không commit `.env`.

---

## 8. Logic các công cụ (phần dễ quên nhất)

### 8.1 Ghép Excel — `merge-wizard-*`

- Wizard 5 bước: Upload → Template → Mapping → Preview → Export. State **chỉ** nằm trong
  `MW.state`; các `step*.js` không tự giữ state riêng.
- `MW.util` chứa helper thuần (chuẩn hoá tên cột, so khớp mờ, đọc header…).
- Worker RPC: `MW.state` bọc `postMessage` thành Promise theo `id` (`pending: Map`),
  có `onProgress` để cập nhật tiến độ. Worker thật nằm ở `assets/js/merge-wizard-worker.js`.
- Profile JSON: `toolName: 'notdore-excel-merge'`, ngưỡng so khớp **0.9 auto / 0.6 cần
  xác nhận**. Profile lưu/khôi phục được để tái sử dụng cấu hình.
- Worker nạp SheetJS + ExcelJS bằng `importScripts` từ CDN; khi chạy Node (test) thì
  khối `importScripts` bị bỏ qua và module export qua `module.exports`.
- Xuất file: dựng `ArrayBuffer` từ ExcelJS → `Blob` → tải xuống; có chế độ xuất giữ
  nguyên template gốc (điền vào file mẫu) hoặc xuất file mới.

### 8.2 OCR hoá đơn — `invoice-ocr-*`

Hai đường xử lý, chọn theo nội dung PDF:
1. **PDF có text layer** → `IOCR.VatParser` parse bằng regex (số hoá đơn, ngày, MST,
   tiền hàng, VAT, tổng…). Nhanh, miễn phí, không gọi mạng.
2. **PDF scan / ảnh** → render trang bằng pdf.js ra canvas → PNG (scale 2 cho AI, 0.5 cho
   thumbnail) → gửi AI vision (NVIDIA NIM) để bóc field.

Cơ chế phụ:
- Key AI do người dùng nhập, lưu `localStorage` khoá `iocr_ai_settings_v1`.
- Giãn cách **12 giây** giữa các file để tránh rate limit.
- Retry backoff luỹ thừa khi gặp `429 / 502 / 503 / 504`.
- Kết quả hiển thị bảng có thể sửa, xuất Excel.

### 8.3 Trích xuất hoá đơn — `invoice-extractor-*`

- `IEX.utils`: đọc file, chuẩn hoá, render ảnh/PDF.
- `IEX.engine`: luật trích xuất theo mẫu (pattern/neo văn bản), chấm điểm ứng viên.
- `IEX.app`: UI chọn mẫu, chạy, review, xuất.
- Khác `invoice-ocr`: công cụ này **rule-based theo mẫu cấu hình**, không gọi AI.

### 8.4 XML hoá đơn điện tử — `hoa-don-xml.js`

- Parse XML hoá đơn (namespace biến thể giữa các nhà cung cấp), map sang bảng phẳng.
- Cột hiển thị điều khiển bởi: `DEFAULT_VISIBLE_ORDER`, `ALWAYS_COLUMNS`,
  `FORCE_TEXT_COLUMNS` (buộc giữ dạng text để không mất số 0 đầu / số hoá đơn dài).
- **Giải mã QR** theo chuẩn QĐ 1450/QĐ-TCT: chuỗi TLV, đọc thẻ, có heuristic tìm token
  định danh; dùng để bổ sung field thiếu hoặc đối chiếu.
- Xuất Excel bằng ExcelJS nạp từ CDN **khi cần** (lazy) rồi tạo `Blob` tải về.

### 8.5 Phân bổ chi phí nhập khẩu — `allocate-import-cost.html`

- Toàn bộ logic nằm inline trong trang (`<script type="module">`), không tách file.
- Nhập danh sách hàng (số lượng/trị giá) + các khoản chi phí (vận chuyển, bảo hiểm,
  thuế…) → phân bổ theo tiêu thức chọn (giá trị / số lượng / trọng lượng).
- Xuất Excel phía client. Khi sửa, nhớ đây là chỗ duy nhất chứa logic này.

---

## 9. Admin panel (`/admin`)

- **Chỉ dùng local**, không public. Mở `admin.html` trực tiếp hoặc qua dev server.
- 6 panel: `single` (nhập 1 văn bản), `bulk` (nhiều dòng), `tools` (công cụ),
  `query` (truy vấn Supabase), `schema` (xem cấu trúc), `template` (mẫu Excel).
- Panel `single`/`bulk`/`tools` **sinh SQL** để dán vào Supabase SQL Editor — không tự ghi DB.
- Panel `query`:
  - Nhập URL + anon key từ file `.txt` (không lưu cứng trong repo).
  - Tab: `merged` (văn bản gộp), `document_files`, `document_tags`, `document_tag_map`,
    `document_texts`, `merged_tools`, `categories`, `tools`, `external_sources`,
    `tool_links`, `tags`, `tool_tags`.
  - Sửa ô → tính **diff** → sinh SQL hoặc **Apply trực tiếp** (có modal xác nhận).
- `RAW_TABLES` trong `admin-query-raw.js` là nguồn sự thật về danh sách bảng khi thêm
  bảng mới: cập nhật ở đây + thêm tab trong `admin.html` + handler trong `admin-query-*.js`.
- Thứ tự load 12 script là quan trọng (constants → sql-utils → ui-utils → parsers →
  excel → doc-entry → tool-entry → init → query-core → query-docs → query-tools →
  query-raw → query-init).

---

## 10. Deploy & vận hành

- `vercel.json`: cấu hình rewrite/route; thêm trang mới dạng file tĩnh thì không cần sửa.
- `package.json`: ESM, Node 24, dependency duy nhất đáng kể là `@supabase/supabase-js`
  (frontend dùng CDN, không import từ npm).
- `replit.md` có nhắc `server.js` nhưng **file này không tồn tại** — chạy local bằng
  static server bất kỳ (`python -m http.server`, `npx serve`) hoặc `vercel dev` nếu cần API.
- Thay đổi schema: viết file mới trong `db/` (không sửa file migration cũ đã chạy),
  chạy tay trong Supabase SQL Editor, rồi cập nhật ghi chú trong `.agents/memory/`.

---

## 11. Vấn đề đã biết / điểm cần cẩn thận

| Vấn đề | Chi tiết |
|---|---|
| `api/category.js` import sai độ sâu | Đang là `'../../lib/supabase.js'`, đúng phải là `'../lib/supabase.js'` (file nằm trong `api/`). |
| `api/admin/docs.js` dựng select bằng `\|` | Chuỗi kiểu `'id\| name'` chỉ đúng khi Supabase nhận dạng OR‑select đặc biệt; dễ lỗi cột. Nên dùng dấu phẩy. |
| Worker URL | `merge-wizard-state.js` dùng `/js/merge-wizard-worker.js` nhưng file thật ở `assets/js/`. Chạy được chỉ khi có rewrite hoặc khi worker được load như script thường. |
| `merge-wizard-main.js` | HTML comment nhắc tới file này nhưng **không tồn tại**. |
| `invoice-ocr-app.js` | Có chỗ gọi `setResult` chưa khai báo (phải qua `ns.App`/callback engine). Ngoài ra `MAX_RETRIES` bị shadow trong hàm lồng. |
| Trùng lặp schema | `tags`/`tool_tags` bị comment là "đã bỏ" nhưng vẫn tồn tại trong DB & admin. |
| `loai_van_ban` | Có trong DB thực tế, không có trong `schema_v2.sql`. |
| `hoa-don-xml.html` | Một comment bị lỗi encoding (mojibake) — không ảnh hưởng chức năng. |
| `allocate-import-cost.html` | Logic nằm inline trong trang, không tách module → sửa ở đây là duy nhất. |

---

## 12. Việc thường gặp — làm ở đâu

- **Thêm trang tĩnh mới**: tạo `.html` ở root, link `assets/css/notdore.css` (+ `pages.css`),
  load `main.js`/`utils.js` nếu cần header/footer, thêm `mail.js` + `oneko.js` cho đồng bộ.
- **Thêm endpoint**: tạo `api/<ten>.js` export default handler, dùng `lib/supabase.js`,
  luôn xử lý `OPTIONS` và lỗi 500 kèm `console.error`.
- **Thêm bảng**: `db/migration_add_<ten>.sql` (bật RLS + policy SELECT cho anon) →
  cập nhật `RAW_TABLES` + tab admin → cập nhật API đọc tương ứng.
- **Thêm công cụ mới**: thêm record ở `tools` (admin panel `tools`), tạo trang chạy,
  thêm vào slider ở `index.js` (dữ liệu lấy từ API nên thường không phải sửa code).
- **Sửa style chung**: `assets/css/notdore.css`; style riêng một trang: `pages.css`
  (dùng selector theo `body.page-*` hoặc id trang để tránh ảnh hưởng toàn cục).

---

## 13. Ghi chú liên quan

- [DB Schema v2](db-schema-v2.md) — chi tiết cột `documents` và migration v1→v2.
- [Admin Tool](admin-tool.md) — luồng admin, nguyên tắc chỉ sinh SQL.
- [GitHub push authentication](github-push-auth.md) — xử lý xác thực khi push.
