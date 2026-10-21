# NotDore

Bộ công cụ làm việc chạy trực tiếp trên trình duyệt, dành cho người làm kế toán – thuế – nhân sự Việt Nam.
Không cần đăng nhập, không gửi file lên server: mọi phép tính và xử lý dữ liệu diễn ra tại máy người dùng.

Site: <https://www.notdore.io.vn>

---

## Công cụ hiện có

| Công cụ | Trang | Trạng thái |
|---|---|---|
| Tra cứu địa giới hành chính (63 → 34, sáp nhập 2025) | `tools/dia-gioi-hanh-chinh.html` | Hoạt động |
| Tính lương Gross ↔ Net | — | Sắp có |
| Đọc số tiền thành chữ | — | Sắp có |
| Lịch trả nợ vay | — | Sắp có |

Danh mục công cụ lưu ở `assets/data/tools.json` (fallback) và bảng `tools` trên Supabase.

---

## Kiến trúc

```
index.html                     Trang chủ: tìm kiếm + danh mục công cụ + thư viện link
tools/<slug>.html              Mỗi công cụ một trang riêng
assets/css/notdore.css         Theme chung (tông sáng, tím–hồng, hiệu ứng sakura)
assets/css/tools.css           Thành phần riêng của trang công cụ (tiền tố .nd-)
assets/js/config.js            Cấu hình công khai (Supabase URL/anon key, email liên hệ)
assets/js/db.js                Lớp dữ liệu duy nhất: Supabase → fallback JSON
assets/js/tools.js             Render trang chủ
assets/js/dia-gioi.js          Logic công cụ địa giới
assets/data/*.json             Dữ liệu tĩnh (fallback + nguồn seed)
db/schema.sql                  Bảng + RLS
db/seed-tools.sql              Seed danh mục công cụ
db/seed-admin.sql              Seed địa giới (tự sinh)
scripts/build-admin-data.mjs   Chuẩn hoá dữ liệu crawl → JSON + SQL
scripts/dev-server.mjs         Server tĩnh local
```

**Không có build step.** HTML/CSS/JS thuần, deploy tĩnh trên Vercel.

### Luồng dữ liệu

```
Trình duyệt → NotDoreDB.getCatalog() / getAdminDivisions()
                 ├─ có config Supabase  → supabase-js (anon key, RLS chỉ đọc)
                 └─ không có / lỗi      → fetch assets/data/*.json
```

Cả hai nguồn trả về **cùng một cấu trúc**, nên phần render không cần biết dữ liệu đến từ đâu.
Site vì vậy luôn chạy được ngay cả khi chưa tạo Supabase project.

---

## Chạy local

```bash
npm run dev          # http://localhost:5173
```

Không cần `npm install` — dự án không có dependency runtime.

## Cấu hình Supabase

1. Tạo project tại <https://supabase.com>.
2. Mở SQL Editor, chạy lần lượt:
   - `db/schema.sql`
   - `db/seed-tools.sql`
   - `db/seed-admin.sql`
3. Điền vào `assets/js/config.js`:

```js
window.NOTDORE_CONFIG = {
  supabaseUrl: "https://xxxx.supabase.co",
  supabaseAnonKey: "eyJhbGciOi...",
  email: "nguyenchaulong.data208@gmail.com",
  siteName: "NotDore",
};
```

> Chỉ dùng **anon key**. Tuyệt đối không đặt `service_role` key trong file này.
> RLS đã bật và chỉ cho phép `select` với `anon`.

Để trống hai trường trên → site tự đọc JSON tĩnh.

## Cập nhật dữ liệu địa giới

```bash
npm run build:data
```

Script đọc `vietnam-admin-merger.json` (file crawl gốc), đối chiếu với bảng 63 → 34
viết trong `scripts/build-admin-data.mjs`, rồi ghi ra:

- `assets/data/admin-merger.json`
- `db/seed-admin.sql`

Nếu bảng đối chiếu và file crawl lệch nhau, script in cảnh báo — sửa trước khi deploy.
Chạy lại `db/seed-admin.sql` trong Supabase sau mỗi lần build.

## Thêm một công cụ mới

1. Tạo `tools/<slug>.html`, dùng lại header/footer của trang địa giới.
2. Tạo `assets/js/<slug>.js` (IIFE, đọc dữ liệu qua `NotDoreDB` nếu cần).
3. Thêm mục vào `assets/data/tools.json` **và** `db/seed-tools.sql`:
   ```json
   { "id": "<slug>", "categoryId": "tai-chinh", "name": "...", "url": "tools/<slug>.html",
     "status": "ready", "icon": "fa-calculator", "tags": ["..."] }
   ```
4. Thêm URL vào `sitemap.xml`.

Không cần sửa `index.html` — trang chủ tự render từ catalog.

---

## Quy ước

- Không thêm bundler, framework JS hay bước build.
- Class CSS mới dùng tiền tố `nd-`.
- Comment và nội dung hiển thị bằng tiếng Việt.
- Không commit key bí mật; `config.js` chỉ chứa thông tin công khai.

## Giấy phép & ghi công

Xem `license.txt` và `CREDITS.md`. Giao diện dựa trên template DevBook của Xiaoying Riley (3rd Wave Media).
