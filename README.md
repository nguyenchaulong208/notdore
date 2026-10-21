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
assets/js/config.js            Cấu hình công khai + nạp /api/config (Supabase, email liên hệ)
assets/js/db.js                Lớp dữ liệu duy nhất: Supabase → fallback JSON
api/config.js                  Vercel Function trả URL + anon key từ Environment Variables
assets/js/tools.js             Render lưới công cụ, tìm kiếm, panel danh mục + câu nói hay
assets/js/library.js           Render thư viện theo nhóm; cuộn tới anchor #lib-cat-N
assets/js/dia-gioi.js          Logic công cụ địa giới
assets/data/*.json             Dữ liệu tĩnh (fallback + nguồn seed)
db/schema.sql                  Bảng + RLS (catalog, admin_units legacy)
db/schema-geo.sql              Schema geo_* mở rộng: dataset, cây đơn vị, sự kiện
db/seed-tools.sql              Seed danh mục công cụ
db/reset-tools.sql             Sao lưu + xoá tools cũ nếu khác schema v3
db/fix-grants.sql              Cấp SELECT cho anon khi gặp lỗi 401 permission denied
db/seed-admin.sql              Seed địa giới legacy (tự sinh)
db/seed-geo.sql                Seed geo_* gộp (dùng psql/CLI; quá lớn cho SQL Editor)
db/seed-geo-1-core.sql         Seed phần 1/3: dataset, cấp/loại, văn bản, 34 tỉnh
db/seed-geo-2-communes/        Seed phần 2/3: 34 file xã/phường theo tỉnh (mỗi file ≤34KB)
db/seed-geo-2-communes-all.sql Seed phần 2/3 gộp (psql/CLI; quá lớn cho SQL Editor)
db/seed-geo-3-relations.sql    Seed phần 3/3: chỉ số, sự kiện, liên kết, nguồn
db/source/database_vietnam_merger.json  Nguồn JSON cấp tỉnh của lớp geo_*
db/source/communes-open-api.json        Nguồn chuẩn hoá 3.321 xã/phường/đặc khu
assets/data/admin-communes.json        Fallback tĩnh cho cấp xã/phường/đặc khu
scripts/build-admin-data.mjs   Chuẩn hoá dữ liệu crawl → JSON + SQL legacy
scripts/build-geo-sql.mjs      Chuẩn hoá JSON → db/seed-geo.sql + file theo tỉnh
scripts/split-geo-seed.mjs     Cắt seed-geo.sql thành 3 phần
scripts/fetch-communes.mjs     Tải cấp xã từ provinces.open-api.vn + đối chiếu số liệu
scripts/dev-server.mjs         Server tĩnh local
scripts/check-links.mjs        Kiểm tra link/asset nội bộ
```

**Không có build step.** HTML/CSS/JS thuần, deploy tĩnh trên Vercel.
`api/config.js` là Vercel Serverless Function nhỏ (không cần bundler) để đọc Environment Variables.

### Luồng dữ liệu

```
Trình duyệt → assets/js/config.js
                 ├─ URL/key điền trực tiếp trong file
                 └─ hoặc GET /api/config (Vercel Environment Variables)
             → NotDoreDB.getCatalog() / getAdminDivisions() / getCommunes()
                 ├─ có config Supabase  → supabase-js (anon key, RLS chỉ đọc)
                 └─ không có / lỗi      → fetch assets/data/*.json
```

Cả hai nguồn trả về **cùng một cấu trúc**, nên phần render không cần biết dữ liệu đến từ đâu.
Site vì vậy luôn chạy được ngay cả khi chưa tạo Supabase project.

Các trang đã nạp `supabase-js` từ CDN. Khi `config.js` có `supabaseUrl` + `supabaseAnonKey`,
`NotDoreDB` truy vấn Supabase **trước**; chỉ khi lỗi mới fallback sang JSON tĩnh.
Trang công cụ hiển thị nguồn đang dùng ở cuối trang ("Supabase", "JSON tĩnh",
hoặc "JSON tĩnh (Supabase lỗi)" khi đã cấu hình nhưng truy vấn thất bại).

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
   - `db/schema-geo.sql`
   - `db/seed-tools.sql`
   - `db/seed-admin.sql`
   - `db/seed-geo-1-core.sql`
   - `db/seed-geo-2-communes/*.sql` (34 file theo tỉnh, chạy theo thứ tự bất kỳ)
   - `db/seed-geo-3-relations.sql`

> `db/seed-geo.sql` là bản gộp cho `psql`/CLI; **không dùng trong SQL Editor** vì quá lớn.
> Nếu project đã có `geo_*` từ trước, chỉ cần chạy lại 3 file trên để nạp thêm 3.321 đơn vị
> cấp xã; frontend vẫn hiển thị ngay qua `assets/data/admin-communes.json` nếu chưa seed.

3. Cấu hình frontend — chọn **một** trong hai cách:

   **Cách A — Vercel Environment Variables (khuyến nghị khi deploy):**
   Vào Vercel → Project → Settings → Environment Variables, thêm:

   - `SUPABASE_URL` = Project URL
   - `SUPABASE_ANON_KEY` = anon/publishable key

   `api/config.js` sẽ trả hai giá trị này qua `/api/config`; `assets/js/config.js`
   tự nạp trước khi `db.js` truy vấn. Chọn đúng môi trường (Production/Preview) khi tạo biến;
   sau khi thêm/sửa biến, redeploy project.
   Có thể dùng các tên quen thuộc khác như `NEXT_PUBLIC_SUPABASE_URL` /
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`…

   **Cách B — điền trực tiếp `assets/js/config.js`:**

```js
window.NOTDORE_CONFIG = {
  supabaseUrl: "https://xxxx.supabase.co",
  supabaseAnonKey: "eyJhbGciOi...",
  email: "nguyenchaulong.data208@gmail.com",
  siteName: "NotDore",
};
```

> Chỉ dùng **anon/publishable key**. Tuyệt đối không đặt `service_role` key trong file này
> hoặc trong bất kỳ biến nào mà `/api/config` trả về. RLS đã bật và chỉ cho phép `select` với `anon`.

Để trống cả hai nguồn → site tự đọc JSON tĩnh.

Khi chạy local, dev server cũng giả lập `/api/config` từ biến môi trường:

```powershell
$env:SUPABASE_URL="https://xxxx.supabase.co"
$env:SUPABASE_ANON_KEY="eyJhbGciOi..."
npm run dev
```

> `schema-geo.sql` + `seed-geo-1-core.sql` + `seed-geo-2-communes/` +
> `seed-geo-3-relations.sql` là lớp dữ liệu mới, **không thay thế** hai bảng
> `admin_units` / `admin_unit_history`. Công cụ tra cứu cấp tỉnh vẫn đọc lớp legacy;
> hai lớp có thể cùng tồn tại trong một project Supabase.

### Trang tra cứu vẫn báo "JSON tĩnh"

1. Mở trực tiếp `/api/config` trên domain đã deploy. Kết quả mong đợi:
   `{"configured":true,"supabaseUrl":"https://...","supabaseAnonKey":"..."}`.
2. Nếu `configured:false`, kiểm tra tên biến trong Vercel (mục `missing`) và **redeploy**
   sau khi thêm/sửa Environment Variables.
3. Nếu `configured:true` nhưng trang vẫn fallback, mở DevTools → Console để xem lỗi
   Supabase (thường do thiếu GRANT, RLS chặn `select`, sai URL, hoặc bảng chưa có dữ liệu).
4. Kiểm tra nhanh trong SQL Editor:
   `select count(*) from public.admin_units;` (kỳ vọng 34),
   `select count(*) from public.admin_unit_history;` (kỳ vọng 63),
   `select level_code, count(*) from public.geo_units group by level_code;`
   (kỳ vọng `province` = 34 và `commune` = 3321).

### Lỗi 401 `permission denied for table admin_units`

Đây là lỗi **thiếu quyền SELECT ở cấp bảng**, không phải sai anon key. Policy RLS chỉ
lọc dòng sau khi role đã có quyền truy cập bảng. Chạy `db/fix-grants.sql` trong SQL Editor;
file này cấp `select` cho `anon` / `authenticated` trên các bảng catalog + địa giới
legacy; nếu bảng `geo_*` tồn tại thì cũng cấp quyền đọc cho lớp cấp xã.
Sau đó tải lại trang, badge phải chuyển thành **Supabase**.

`db/schema.sql` đã được bổ sung phần GRANT tương tự, nên project tạo mới không gặp lỗi này.

### Tab "Xã / phường" trống hoặc báo "JSON tĩnh (Supabase lỗi)"

Frontend ưu tiên đọc `geo_units` (`level_code = 'commune'`). Nếu bảng `geo_*` chưa tồn tại
hoặc chưa có dữ liệu, `db.js` tự fallback sang `assets/data/admin-communes.json`; badge sẽ
ghi "JSON tĩnh (Supabase lỗi)" hoặc "JSON tĩnh". Để có dữ liệu Supabase:

```text
1. Chạy db/schema-geo.sql
2. Chạy db/seed-geo-1-core.sql
3. Chạy các file db/seed-geo-2-communes/*.sql (34 file theo tỉnh)
4. Chạy db/seed-geo-3-relations.sql
5. Tải lại trang; kiểm tra:
   select level_code, count(*) from public.geo_units group by level_code;
```

`db/seed-geo.sql` là bản gộp, chỉ dùng với `psql`/CLI khi SQL Editor báo quá lớn.

Nếu `assets/data/admin-communes.json` bị thiếu, chạy `npm run fetch:communes` để tạo lại.

### Lỗi `column "id" of relation "tools" does not exist`

Bảng `public.tools` đã tồn tại từ một schema cũ. `create table if not exists` trong
`db/schema.sql` **không thêm/sửa cột** của bảng đã có, nên seed không chạy được.

Cách xử lý nếu dữ liệu cũ không còn cần:

```text
1. Chạy db/reset-tools.sql   (sao lưu tools cũ -> tools_backup_<timestamp>, rồi xoá)
2. Chạy lại db/schema.sql
3. Chạy lại db/seed-tools.sql
```

Nếu cần giữ dữ liệu cũ, xem cấu trúc hiện tại trước khi migrate:

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'tools'
order by ordinal_position;
```

---

## Dữ liệu địa giới

Có hai lớp dữ liệu, phục vụ hai mục đích khác nhau:

| Lớp | Nguồn | Bảng | Dùng bởi |
|---|---|---|---|
| Legacy | `vietnam-admin-merger.json` | `admin_units`, `admin_unit_history` | Tra cứu 63 → 34 cấp tỉnh (Supabase hoặc JSON) |
| `geo_*` | `db/source/database_vietnam_merger.json` + `communes-open-api.json` | `geo_*` | Cây đơn vị + 3.321 xã/phường/đặc khu; `db.js` đọc `geo_units` |

Công cụ tra cứu cấp tỉnh vẫn dùng **legacy** vì cần bảng đối chiếu 63 → 34 và các trường
`region`, `capital`, `population`, `area_km2`. Cấp xã/phường/đặc khu đã được nạp vào
`geo_units` (34 tỉnh + 3.321 đơn vị cấp xã) và frontend đọc qua `getCommunes()`.

### Lớp legacy

```bash
npm run build:data
```

Script đối chiếu dữ liệu crawl với bảng 63 → 34 viết trong `scripts/build-admin-data.mjs`,
rồi ghi ra:

- `assets/data/admin-merger.json`
- `db/seed-admin.sql`

Nếu hai nguồn lệch nhau, script in cảnh báo — sửa trước khi deploy.
Chạy lại `db/seed-admin.sql` trong Supabase sau mỗi lần build.

Phạm vi: **cấp tỉnh/thành phố trực thuộc Trung ương**. Cấp xã/phường nằm ở lớp `geo_*`.

### Lớp `geo_*` mở rộng

Nguồn cấp tỉnh: `db/source/database_vietnam_merger.json` — 34 tỉnh/thành, 34 nghị quyết
sắp xếp cấp xã, số liệu xã/phường/đặc khu và văn bản pháp lý.

Nguồn cấp xã: `db/source/communes-open-api.json` — sinh bằng
`node scripts/fetch-communes.mjs` từ `provinces.open-api.vn` (v2, depth=2). Script đối chiếu
tổng **3.321 đơn vị** và số lượng từng tỉnh với 34 Nghị quyết UBTVQH15 trước khi ghi
`assets/data/admin-communes.json` (fallback tĩnh) và nguồn cho seed.

```bash
npm run fetch:communes   # tải cấp xã từ API (có kiểm tra số liệu)
npm run build:geo        # sinh db/seed-geo.sql + 34 file xã theo tỉnh + 3 file phần
```

Script ghi:

- `db/seed-geo.sql` — bản gộp cho `psql`/CLI (không dùng trong SQL Editor).
- `db/seed-geo-1-core.sql`, `db/seed-geo-3-relations.sql` — hai phần nhỏ.
- `db/seed-geo-2-communes/seed-geo-2-communes-*.sql` — 34 file theo tỉnh, mỗi file ≤34KB.

Seed hiện tại:

- dataset `vn-admin-2025-07-01`, hiệu lực `2025-07-01`
- 34 đơn vị cấp tỉnh
- 3.321 đơn vị cấp xã: 2.621 xã, 687 phường, 13 đặc khu
- 204 chỉ số (tổng đơn vị, xã trước/sau, phường, đặc khu, chưa áp dụng)
- 34 sự kiện, 36 văn bản, 5 nguồn tham chiếu

Mô hình chính:

- `geo_datasets`: phiên bản dữ liệu; `is_current` + `effective_from/to`
- `geo_units`: cây đơn vị; đã có 34 tỉnh + 3.321 xã/phường/đặc khu;
  FK ghép `(type_code, level_code)` bảo đảm loại đơn vị đúng cấp
- `geo_unit_metrics`: chỉ số long-format, thêm chỉ số mới không cần đổi schema
- `geo_events` + `geo_event_units`: sự kiện và liên kết nguồn/đích
- `geo_documents`, `geo_sources`, `geo_unit_aliases`: văn bản, nguồn, tên thay thế
- View: `geo_current_units`, `geo_unit_summary`, `geo_data_quality`

Không dùng `code` làm khoá duy nhất: nguồn 2025 dùng mã `43` cho cả Điện Biên và
Đồng Nai. Khoá ổn định là `id` (UUID) và `slug` trong từng dataset; view
`geo_data_quality` liệt kê mã trùng.

Ví dụ:

```sql
select name, unit_count_after, commune_count, ward_count,
       special_zone_count, not_applied_count
from public.geo_unit_summary
where dataset_code = 'vn-admin-2025-07-01' and is_current
order by name;
```

```sql
select e.title, e.event_type, eu.role,
       coalesce(u.name, eu.source_name) as don_vi
from public.geo_events e
join public.geo_event_units eu on eu.event_id = e.id
left join public.geo_units u on u.id = eu.unit_id
where e.dataset_id = (select id from public.geo_datasets where is_current)
order by e.title, eu.role;
```

Lớp `geo_*` đã được nối vào frontend qua `NotDoreDB.getCommunes()`: ưu tiên đọc
`geo_units` (phân trang để lấy đủ 3.321 dòng), fallback sang
`assets/data/admin-communes.json` khi chưa seed hoặc truy vấn lỗi. Bảng cấp tỉnh vẫn
đọc legacy; cấp xã có thể tra cũng qua `geo_current_units` / `geo_unit_summary`.

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
- Dữ liệu `geo_*` sinh bằng script, không sửa tay `db/seed-geo.sql`.
- Class CSS mới dùng tiền tố `nd-`.
- Chú thích trong code và nội dung hiển thị bằng tiếng Việt.
- Không commit key bí mật; `config.js` chỉ chứa thông tin công khai.

## Giấy phép & ghi công

Xem `license.txt` và `CREDITS.md`. Giao diện dựa trên template DevBook của Xiaoying Riley (3rd Wave Media).
