# NotDore

Website công cụ chạy trực tiếp trên trình duyệt. Không cần cài đặt, không gửi dữ liệu lên server.

Công cụ đầu tiên: **tra cứu địa giới hành chính Việt Nam** — đối chiếu 63 tỉnh thành trước sáp nhập
sang 34 đơn vị hiện tại (hiệu lực 01/07/2025).

Site: <https://www.notdore.io.vn>

---

## Công cụ

| Công cụ | Trang | Trạng thái |
|---|---|---|
| Tra cứu địa giới hành chính (63 → 34) | `tools/dia-gioi-hanh-chinh.html` | Hoạt động |

Danh mục lưu ở `assets/data/tools.json` (fallback) và bảng `tools` trên Supabase.
Các công cụ khác sẽ được thêm khi hoàn thiện, không đưa mục "sắp có" lên giao diện.

---

## Kiến trúc

```
index.html                     Trang chủ: lưới công cụ 4 cột + panel danh mục bên phải
thu-vien.html                  Trang thư viện: link ngoài theo nhóm (chỉ danh mục)
tools/<slug>.html              Mỗi công cụ một trang riêng
assets/css/notdore.css         Theme chung (tông sáng, tím–hồng, hiệu ứng sakura)
assets/css/tools.css           Thành phần trang chủ, thư viện + trang công cụ (.nd-)
assets/js/config.js            Cấu hình công khai (Supabase URL/anon key, email liên hệ)
assets/js/db.js                Lớp dữ liệu duy nhất: Supabase → fallback JSON
assets/js/tools.js             Render lưới công cụ, tìm kiếm, panel danh mục + câu nói hay
assets/js/library.js           Render thư viện theo nhóm; cuộn tới anchor #lib-cat-N
assets/js/dia-gioi.js          Logic công cụ địa giới
assets/data/*.json             Dữ liệu tĩnh (fallback + nguồn seed)
db/schema.sql                  Bảng + RLS
db/seed-tools.sql              Seed danh mục công cụ
db/seed-admin.sql              Seed địa giới (tự sinh)
scripts/build-admin-data.mjs   Chuẩn hoá dữ liệu crawl → JSON + SQL
scripts/dev-server.mjs         Server tĩnh local
scripts/check-links.mjs        Kiểm tra link/asset nội bộ
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

---

## Dữ liệu địa giới

Nguồn gốc: `vietnam-admin-merger.json` (file crawl, cấp tỉnh).

```bash
npm run build:data
```

Script đối chiếu dữ liệu crawl với bảng 63 → 34 viết trong `scripts/build-admin-data.mjs`,
rồi ghi ra:

- `assets/data/admin-merger.json`
- `db/seed-admin.sql`

Nếu hai nguồn lệch nhau, script in cảnh báo — sửa trước khi deploy.
Chạy lại `db/seed-admin.sql` trong Supabase sau mỗi lần build.

Phạm vi hiện tại: **cấp tỉnh/thành phố trực thuộc Trung ương**. Chưa có cấp xã/phường.

---

## Giao diện trang chủ

- Body: lưới 4 cột block, tối đa 20 block; 3 cột ≤1023px, 2 cột ≤767px, 1 cột ≤599px.
  Card vuông ở 1024–1599px; từ 1600px, card cao tối đa 280px để không quá trống.
- Panel phải: "Công cụ" (danh mục nội bộ) + "Thư viện" (nhóm link ngoài) + "Câu nói hay".
  Chip viền đậm kèm số lượng; chip nội bộ mở trang công cụ, chip thư viện mở
  `thu-vien.html#lib-cat-N`.
- "Câu nói hay": 12 câu tĩnh trong `tools.js`, hiển thị theo ngày và đổi bằng nút ↻;
  không gọi API, không phụ thuộc catalog.
- Panel ở bên phải từ 1360px; 1024–1359px panel xuống dưới lưới (2 panel cạnh nhau,
  panel câu nói chiếm cả 2 cột); ≤767px panel 1 cột. Container tối đa 1800px.
- Tìm kiếm chỉ lọc lưới body; panel danh mục là điều hướng, không lọc.

---

## Thêm một công cụ mới

1. Tạo `tools/<slug>.html`, dùng lại header/footer của trang địa giới.
2. Tạo `assets/js/<slug>.js` (IIFE, đọc dữ liệu qua `NotDoreDB` nếu cần).
3. Thêm mục vào `assets/data/tools.json` **và** `db/seed-tools.sql`:
   ```json
   { "id": "<slug>", "categoryId": "dia-gioi", "name": "...", "url": "tools/<slug>.html",
     "status": "ready", "icon": "fa-map-location-dot", "tags": ["..."] }
   ```
4. Thêm URL vào `sitemap.xml`.

Trang chủ tự render lưới từ catalog (tối đa 20 block, 4x5) và panel danh mục bên phải.
Panel lấy danh mục nội bộ từ `catalog.tools` + nhóm link ngoài từ `catalog.external`;
không trộn nhãn danh mục vào từng block.

---

## Quy ước

- Không thêm bundler, framework JS hay bước build.
- Class CSS mới dùng tiền tố `nd-`.
- Chú thích trong code và nội dung hiển thị bằng tiếng Việt.
- Không commit key bí mật; `config.js` chỉ chứa thông tin công khai.

## Giấy phép & ghi công

Xem `license.txt` và `CREDITS.md`. Giao diện dựa trên template DevBook của Xiaoying Riley (3rd Wave Media).
