# NotDore

Bộ công cụ chạy trực tiếp trên trình duyệt, phục vụ công việc kế toán – thuế – nhân sự hằng ngày.

Site: <https://www.notdore.io.vn>

---

## Công cụ

| Công cụ | Trang |
|---|---|
| Tra cứu địa giới hành chính (63 → 34) | `tools/dia-gioi-hanh-chinh.html` |
| Công thức Excel | `tools/excel-cong-thuc.html` |
| Sửa tên file hàng loạt | `tools/sua-ten-file.html` |
| Di chuyển file hàng loạt | `tools/di-chuyen-file.html` |
| Sinh mật khẩu PDF | `tools/sinh-mat-khau-pdf.html` |
| Tính phân bổ tiền bảo hiểm | `tools/tinh-phan-bo-bhxh.html` |
| Tra cứu hóa đơn điện tử | `tools/tra-cuu-hoa-don.html` |

Danh mục công cụ nội bộ lưu ở bảng `tools` trên Supabase; danh mục link ngoài lưu ở `tool_categories`.
Công cụ mới được thêm trực tiếp vào `assets/js/tools.js` (mảng `localTools`) khi chưa có trong Supabase.

---

## Kiến trúc

```
index.html                     Trang chủ: lưới công cụ + panel danh mục + Tarot
thu-vien.html                  Thư viện link ngoài theo nhóm
about.html / privacy.html      Trang tĩnh
contact.html                   Form liên hệ (gửi qua Resend)
tools/<slug>.html              Mỗi công cụ một trang riêng
assets/css/notdore.css         Token màu, layout khung trang, nút bấm
assets/css/tools.css           Thành phần trang chủ + trang công cụ (.nd-)
assets/js/config.js            Cấu hình công khai + nạp /api/config
assets/js/db.js                Lớp dữ liệu duy nhất (Supabase)
assets/js/tools.js             Render lưới công cụ, tìm kiếm, panel danh mục
assets/js/library.js           Render thư viện theo nhóm
assets/js/<slug>.js            Logic từng công cụ (IIFE)
api/config.js                  Vercel Function: trả SUPABASE_URL + ANON_KEY
api/contact.js                 Vercel Function: form liên hệ qua Resend
api/report.js                  Vercel Function: báo sai thông tin qua Resend
admin/                         Công cụ admin local (Node, key chỉ ở server)
scripts/dev-server.mjs         Server tĩnh local
scripts/check-links.mjs        Kiểm tra link/asset nội bộ
scripts/make-brain3d.mjs       Sinh bản đồ code 3D từ graphify-out
```

**Không có build step.** HTML/CSS/JS thuần, deploy tĩnh trên Vercel.
`api/*.js` là Vercel Serverless Functions nhỏ, đọc Environment Variables.

### Luồng dữ liệu

```
Trình duyệt → assets/js/config.js
                 ├─ URL/key điền trực tiếp trong file
                 └─ hoặc GET /api/config (Vercel Environment Variables)
             → NotDoreDB.getCatalog() / getCommunes() / getAgencyData()
                 └─ supabase-js với anon key (RLS chỉ đọc)
```

Bảng đang dùng:

| Bảng | Nội dung |
|---|---|
| `communes` | 3.321 xã/phường/đặc khu + tên trước sáp nhập |
| `agency_management` | Cơ quan BHXH/thuế/hải quan theo đơn vị |
| `tools`, `tool_categories` | Danh mục công cụ |
| `invoice_links` | Link tra cứu hóa đơn |
| `online_visitors` | Đếm số ngườời đang trực tuyến |

---

## Chạy local

```bash
npm run dev          # http://localhost:5173
npm run check:links  # kiểm tra link/asset nội bộ
```

Không cần `npm install` — dự án không có dependency runtime.

## Admin local

```powershell
Copy-Item admin/supabase.example.txt admin/supabase.txt
# điền SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (và PAT nếu muốn chạy SQL)
npm run admin
```

Mở <http://127.0.0.1:8787>. Chi tiết: [`admin/README.md`](admin/README.md).

> `service_role`/secret key và PAT chỉ dùng ở server admin. Không đặt các key này trong
> `assets/js/config.js`, `/api/*` hay bất kỳ file tĩnh nào.

## Bản đồ code 3D

Graphify sinh `graphify-out/graph.json` (AST, không cần API key), rồi:

```bash
npm run brain:3d      # -> graphify-out/graph-3d.html
```

Mở file đó trong trình duyệt: xoay 360°, zoom, pan, tìm theo tên hàm/file/community.

---

## Cấu hình Supabase

1. Tạo project tại <https://supabase.com>.
2. Chạy các file SQL trong `db/`:
   - `db/create_online_visitors.sql`
   - `db/import_invoice_links.sql`
3. Cấu hình frontend — chọn **một** trong hai cách:

   **Cách A — Vercel Environment Variables (khuyến nghị khi deploy):**
   Vào Vercel → Project → Settings → Environment Variables, thêm:

   - `SUPABASE_URL` = Project URL
   - `SUPABASE_ANON_KEY` = anon/publishable key

   `api/config.js` sẽ trả hai giá trị này qua `/api/config`. Chọn đúng môi trường
   (Production/Preview) khi tạo biến; sau khi thêm/sửa, redeploy project.

   **Cách B — điền trực tiếp `assets/js/config.js`:**

   ```js
   window.NOTDORE_CONFIG = {
     supabaseUrl: "https://xxxx.supabase.co",
     supabaseAnonKey: "eyJhbGciOi...",
     siteName: "NotDore",
   };
   ```

> Chỉ dùng **anon/publishable key**. Tuyệt đối không đặt `service_role` key trong file này
> hoặc trong bất kỳ biến nào mà `/api/config` trả về.

### Trang không tải được dữ liệu

1. Mở trực tiếp `/api/config` trên domain đã deploy. Kết quả mong đợi:
   `{"configured":true,"supabaseUrl":"https://...","supabaseAnonKey":"..."}`.
2. Nếu `configured:false`, kiểm tra tên biến trong Vercel (mục `missing`) và **redeploy**.
3. Nếu `configured:true` nhưng trang vẫn lỗi, mở DevTools → Console để xem lỗi Supabase.
4. Kiểm tra nhanh trong SQL Editor:
   `select count(*) from public.communes;` (kỳ vọng 3321).

### Lỗi 401 `permission denied for table ...`

Thiếu quyền `SELECT` ở cấp bảng. Chạy trong SQL Editor:

```sql
grant select on public.communes to anon;
grant select on public.tools to anon;
grant select on public.tool_categories to anon;
grant select on public.agency_management to anon;
grant select on public.invoice_links to anon;
```

## Thêm một công cụ mới

1. Tạo `tools/<slug>.html`, dùng lại header/footer của các trang công cụ khác.
2. Tạo `assets/js/<slug>.js` (IIFE, đọc dữ liệu qua `NotDoreDB` nếu cần).
3. Thêm mục vào mảng `localTools` trong `assets/js/tools.js`.
4. Thêm URL vào `sitemap.xml`.

---

## Quy ước

- Không thêm bundler, framework JS hay bước build.
- Class CSS mới dùng tiền tố `nd-`; chỉnh style trong `assets/css/`, không inline.
- Logic từng công cụ tách riêng trong `assets/js/<slug>.js`, không ghièm vào HTML.
- Chú thích trong code và nội dung hiển thị bằng tiếng Việt.
- Không commit key bí mật; key admin nằm trong `admin/supabase.txt` (đã ignore).

## Giấy phép & ghi công

Xem `CREDITS.md`. Giao diện tự thiết kế, không dùng template bên ngoài.
