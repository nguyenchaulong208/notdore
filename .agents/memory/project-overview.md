# NotDore — bối cảnh dự án (v2, rebuild 2026-10)

## Định hướng
Website nhiều công cụ chạy hoàn toàn phía trình duyệt. **Không** gắn với định vị cũ
(kế toán – thuế – nhân sự); đó là project trước, đã bỏ. Các mảng đó có thể thêm lại sau,
nhưng hiện tại **chỉ tập trung vào công cụ địa giới hành chính**.

## Quyết định đã chốt
| Vấn đề | Lựa chọn |
|---|---|
| Kiến trúc | HTML/CSS/JS thuần, **không build step**, deploy tĩnh Vercel |
| Dữ liệu | **Supabase** (anon key + RLS chỉ đọc), tự động fallback `assets/data/*.json` |
| Danh mục | Chỉ công cụ đang chạy; **không hiển thị mục "sắp có"** |
| Dữ liệu địa giới | Legacy `admin_units` cho tra cứu 63 → 34; lớp `geo_*` mới độc lập, sẵn sàng cho cấp xã và nhiều phiên bản dữ liệu |
| Giao diện | Tông sáng + sakura (`notdore.css`), class mới tiền tố `nd-` |
| Trang chủ | Lưới công cụ 4 cột (block 4x4, tối đa 20 block/4x5) + panel danh mục bên phải; body chỉ công cụ, danh mục tách riêng |
| Thư viện | Trang riêng `thu-vien.html`; **chỉ danh mục/link ngoài**, không quảng bá công cụ |

## Kiến trúc
```
index.html                     # lưới công cụ 4 cột + panel danh mục phải
thu-vien.html                  # thư viện link ngoài theo nhóm (chỉ danh mục)
tools/dia-gioi-hanh-chinh.html # công cụ địa giới
assets/js/config.js            # cấu hình công khai + nạp /api/config
assets/js/db.js                # NotDoreDB: nguồn dữ liệu duy nhất
api/config.js                  # Vercel Function: trả URL + anon key từ env
assets/js/tools.js             # render lưới + tìm kiếm + panel danh mục + câu nói
assets/js/library.js           # render thư viện theo nhóm; cuộn tới #lib-cat-N
assets/js/dia-gioi.js          # logic tra cứu
assets/css/tools.css           # component .nd-*
assets/data/tools.json         # catalog fallback
assets/data/admin-merger.json  # dữ liệu cấp tỉnh đã chuẩn hoá (tự sinh)
assets/data/admin-communes.json # dữ liệu 3.321 xã/phường/đặc khu (fallback)
db/schema.sql                  # bảng + RLS (catalog, admin_units legacy)
db/schema-geo.sql              # schema geo_*: dataset, cây đơn vị, sự kiện, view
db/seed-tools.sql              # seed catalog
db/seed-admin.sql              # seed địa giới legacy (tự sinh)
db/seed-geo.sql                # seed geo_* (tự sinh, gồm cấp xã)
db/source/database_vietnam_merger.json  # JSON nguồn cấp tỉnh của geo_*
db/source/communes-open-api.json        # JSON nguồn cấp xã đã đối chiếu
scripts/build-admin-data.mjs   # chuẩn hoá dữ liệu crawl -> JSON + SQL legacy
scripts/build-geo-sql.mjs      # sinh db/seed-geo.sql từ JSON nguồn
scripts/fetch-communes.mjs     # tải cấp xã từ provinces.open-api.vn
scripts/check-links.mjs        # kiểm tra link/asset nội bộ
scripts/dev-server.mjs         # server tĩnh local (npm run dev)
```

Quy ước quan trọng: `NotDoreDB.getCatalog()` / `getAdminDivisions()` / `getCommunes()`
trả **cùng shape** dù dữ liệu từ Supabase hay JSON, nên render không cần rẽ nhánh theo nguồn.

## Dữ liệu địa giới
- Nguồn gốc: `vietnam-admin-merger.json` (file crawl, chỉ có 34 đơn vị cấp tỉnh).
- Bổ sung **bảng đối chiếu 63 → 34 viết tay** trong `scripts/build-admin-data.mjs`,
  đối chiếu chéo với `predecessors` của file crawl. Kết quả: 63 cũ / 34 mới,
  11 giữ nguyên, 23 đơn vị sáp nhập.
- `Thừa Thiên Huế` xử lý riêng: không sáp nhập, chỉ đổi tên thành `Thành phố Huế`
  (`changed = false`, `renamedFrom = "Thừa Thiên Huế"`).
- Cấp huyện không còn trong bộ máy từ 01/07/2025 (chính quyền 2 cấp tỉnh – xã).
  Công cụ tra cả **cấp tỉnh** và **cấp xã/phường/đặc khu**; không có cấp huyện.

## Lớp dữ liệu `geo_*` (thêm 2026-10-21)
- Quyết định: **không thay** `admin_units` / `admin_unit_history` để công cụ tra cứu
  hiện tại không bị ảnh hưởng. Hai lớp cùng tồn tại trong một Supabase project.
- Nguồn: `db/source/database_vietnam_merger.json` (34 tỉnh, 34 nghị quyết cấp xã,
  số liệu xã/phường/đặc khu, văn bản pháp lý). Sinh seed bằng `npm run build:geo`.
- Dataset hiện tại: `vn-admin-2025-07-01`, hiệu lực `2025-07-01`.
- Seed: 34 `geo_units`, 204 `geo_unit_metrics`, 34 `geo_events`, 36 `geo_documents`,
  4 `geo_sources`, 79 `geo_event_units` (34 target + 45 source).
- Mô hình: `geo_datasets` (version + `is_current`), `geo_levels`, `geo_unit_types`,
  `geo_units` (cây qua `parent_id`), `geo_unit_metrics` (long-format),
  `geo_documents`, `geo_events` + `geo_event_units`, `geo_sources`,
  `geo_unit_aliases`. View: `geo_current_units`, `geo_unit_summary`,
  `geo_data_quality`.
- **Không unique trên `code`**: nguồn có mã `43` cho cả Điện Biên và Đồng Nai.
  Khoá ổn định là `id` (UUID) + `slug` trong từng dataset; view `geo_data_quality`
  phát hiện mã trùng.
- `geo_event_units.unit_id` dùng `on delete cascade` (không phải `set null`) để
  xoá dataset/unit không làm dòng target vi phạm check `unit_id` hoặc `source_name`.
- `geo_units` có FK ghép `(type_code, level_code) -> geo_unit_types(code, level_code)`
  để không thể gắn type `xa` vào level `province`.
- Dữ liệu hiện có **34 cấp tỉnh + 3.321 cấp xã** (2.621 xã, 687 phường, 13 đặc khu);
  `parent_id` gắn xã vào tỉnh. Đã nối vào `assets/js/db.js` qua `getCommunes()`.

## Kết nối frontend với Supabase (2026-10-21)
- Các trang `index.html`, `thu-vien.html`, `tools/dia-gioi-hanh-chinh.html` đã nạp
  `@supabase/supabase-js@2` từ jsDelivr trước `config.js`/`db.js`.
- `NotDoreDB.getAdminDivisions()` ưu tiên Supabase; chỉ fallback JSON khi chưa cấu hình
  hoặc truy vấn lỗi. `getCommunes()` cũng vậy: đọc `geo_units` level `commune` (phân trang)
  rồi fallback `assets/data/admin-communes.json`. `meta` tĩnh được đọc từ JSON nếu có.
- Công cụ tra cứu vẫn dùng legacy `admin_units` + `admin_unit_history` (cần 63 → 34,
  region/capital/population/area). Không chuyển sang `geo_*` vì lớp mới chưa có
  lịch sử 63 → 34 và các trường đó.
- `assets/js/config.js` để trống URL/anon key và gọi `/api/config`; `api/config.js`
  đọc `SUPABASE_URL` + `SUPABASE_ANON_KEY` (hoặc các biến `NEXT_PUBLIC_*`/`VITE_*`).
  `window.NOTDORE_CONFIG_READY` cho phép `db.js` chờ config trước khi truy vấn.
- Dev server local cũng giả lập `/api/config` từ biến môi trường. Nếu không có config,
  trang vẫn dùng JSON tĩnh và badge hiển thị "JSON tĩnh".
- Không đưa `service_role` vào frontend; API chỉ trả anon/publishable key.
- Lỗi thực tế trên production (2026-10-21): `/api/config` OK, SDK OK, nhưng REST trả
  401 `permission denied for table admin_units`. Nguyên nhân: thiếu GRANT select cấp bảng;
  RLS policy không thay thế được GRANT. Đã thêm GRANT vào `db/schema.sql` và tạo
  `db/fix-grants.sql` để chạy trên project hiện hữu.

## Dữ liệu cấp xã/phường/đặc khu (2026-10-21)
- Nguồn tên/mã: `provinces.open-api.vn` (v2, depth=2), sinh bằng
  `scripts/fetch-communes.mjs` vào `db/source/communes-open-api.json` và
  `assets/data/admin-communes.json`.
- Đối chiếu: 34 tỉnh, tổng 3.321 đơn vị khớp 34 Nghị quyết UBTVQH15; số lượng từng tỉnh
  khớp `so_don_vi_moi` trong `database_vietnam_merger.json`.
- Chênh 2.499 xã / 682 phường của nguồn cũ là do nguồn đó chỉ đếm đơn vị **hình thành sau
  sáp nhập**, chưa cộng 127 đơn vị không áp dụng. Số hiện hành: 2.621 xã, 687 phường, 13 đặc khu.
- Cấp huyện không còn từ 01/07/2025; không nạp dữ liệu huyện.
- `db/seed-geo.sql` đã bao gồm cả 3.321 dòng cấp xã (chạy `npm run build:geo`).
- Frontend: tab "Xã / phường" + nút "Xem xã/phường" trong modal tỉnh; `getCommunes()` phân
  trang Supabase (mặc định 1.000 dòng/request) rồi fallback JSON tĩnh.
- Trạng thái production (2026-10-21): `geo_units` hiện chỉ có 34 cấp tỉnh, chưa có `commune`;
  tab cấp xã vẫn hiển thị qua `assets/data/admin-communes.json`. Cần chạy `db/seed-geo.sql`
  để đổi sang Supabase.

## Điểm cần kiểm chứng (đừng tự tin tuyệt đối)
- File crawl ghi Đồng Nai lên thành phố 29/04/2026, Quảng Ninh 01/09/2026, Bắc Ninh 20/09/2026.
  Dữ liệu vẫn để `type` như file gốc + `note` cảnh báo. **Không tự sửa nếu chưa có văn bản gốc.**
- Trường `capital` trong file crawl có giá trị "giữ nguyên" → đã chuẩn hoá thành `null`,
  UI hiển thị "Giữ nguyên".
- Tên file crawl: `vietnam-admin-merger.json` (số ít), đặt ở root.

## Dọn dẹp (2026-10-21)
- Đã xoá: `tool-detail.html`, 35 file JS v1 (`admin-*`, `invoice-*`, `merge-wizard-*`,
  `article-detail`, `hoa-don-xml`, `van-ban-*`, `mail`, `main`, `utils`, `index`),
  `anime.css` / `cybercore.css` / `pages.css`, `Techsoft.jpg`, các bản Bootstrap /
  Popper / smoothscroll không dùng, toàn bộ Font Awesome trừ `js/all.min.js`,
  và các thư mục rỗng `api/`, `lib/`, `state/`.
- Còn lại: 6 file JS (`config`, `db`, `tools`, `library`, `dia-gioi`, `oneko`), 2 file CSS
  (`notdore`, `tools`), Bootstrap (`bootstrap.min.css` + `bootstrap.bundle.min.js`),
  Font Awesome `all.min.js` + LICENSE, `oneko.gif`.
- Font Awesome render bằng JS (`all.min.js` tự chứa, không cần `webfonts/` hay `svgs/`).
  Trang gọi `FontAwesome.dom.watch()` sau sự kiện `load` để icon được sinh ra động
  (thẻ công cụ, bảng, modal) cũng được thay bằng `<svg>`.
- `CREDITS.md` đã cập nhật đúng thư viện còn dùng. License DevBook yêu cầu giữ dòng
  ghi nguồn footer — đã thêm "Theme by Xiaoying Riley" (link 3rdwavemedia.com) ở cả 3 trang.

## Trang chủ & thư viện (thiết kế 2026-10-21)
- Tách hai khái niệm: trang chủ **body chỉ công cụ** (lưới phẳng); `thu-vien.html` **chỉ danh mục/link ngoài**.
- Trang chủ: lưới 4 cột, block (4x4), tối đa 20 block (4x5). Mỗi block: icon, tên, mô tả,
  badge "Nội bộ"/"Bên ngoài", domain/tag, link. Không nhãn nhóm trong từng block.
- Panel phải là **category index**, không phải filter: "Công cụ" (danh mục nội bộ, 1 chip
  "Địa giới & Hành chính") + "Thư viện" (6 nhóm link ngoài) + "Câu nói hay". Chip viền đậm
  + số lượng, heading + link "Mở công cụ"/"Tất cả"; style tham chiếu panel "Trending Topics".
  Chip nội bộ → trang công cụ; chip thư viện → `thu-vien.html#lib-cat-N`.
- "Câu nói hay": 12 câu tĩnh (tục ngữ, danh ngôn, câu của NotDore) trong `tools.js`;
  chọn theo ngày, nút ↻ đổi ngẫu nhiên; không phụ thuộc catalog/API.
- Breakpoint: panel phải ≥1360px; 1024–1359px panel xuống dưới lưới (2 panel cạnh nhau,
  `align-items:start`, panel câu nói span 2 cột); ≤767px panel 1 cột. Lưới 4 cột ≥1024,
  3 cột ≤1023, 2 cột ≤767, 1 cột ≤599. Card vuông 1024–1599px; ≥1600px cao tối đa 280px.
- Dữ liệu: `catalog.tools` (nội bộ) + `catalog.external` (link ngoài); tìm kiếm lọc theo
  tên/mô tả/tag/nhóm, tối đa 20 kết quả; **chỉ lọc lưới body**, panel là điều hướng.
- Trang thư viện: 3 cột block theo nhóm ở màn rộng, 2 cột ≤1199px, 1 cột ≤799px;
  không có công cụ nội bộ. H2 id `lib-cat-N`; `library.js` cuộn tới hash sau khi render
  (anchor do JS sinh nên trình duyệt không tự cuộn).
- Container rộng tối đa 1800px, padding 2rem; header tràn theo container (margin -2rem).
- Nav mobile: logo + 3 link trên một hàng, nav co vừa 390px; link active có pill;
  không tràn ngang. (CSS có `flex-wrap` nhưng nav co vừa nên thực tế 1 hàng ở 390.)
- Mèo oneko mặc định góc dưới phải, chỉ hiện sau lần di chuột đầu; ẩn hẳn dưới 768px.

## Lỗi thường gặp
- `column "id" of relation "tools" does not exist`: `public.tools` đã tồn tại từ schema cũ;
  `create table if not exists` không sửa cấu trúc bảng. Chạy `db/reset-tools.sql`
  (sao lưu bảng cũ) rồi chạy lại `db/schema.sql` + `db/seed-tools.sql`.

## Lệnh
```bash
npm run dev          # http://localhost:5173 (không cần npm install)
npm run build:data   # sinh lại JSON + seed SQL legacy từ file crawl
npm run build:geo    # sinh lại db/seed-geo.sql từ db/source/*.json
node scripts/check-links.mjs
```

## Việc tiếp theo (gợi ý)
1. Đã chạy 5 file SQL trên Supabase. Kiểm tra Vercel có `SUPABASE_URL` +
   `SUPABASE_ANON_KEY`, redeploy, rồi xác nhận badge trang tra cứu hiện "Supabase".
2. Hoàn thiện công cụ địa giới: bổ sung cấp xã/phường nếu có nguồn dữ liệu;
   dùng `geo_units.parent_id` + type `xa`/`phuong`/`dac_ku`.
3. Cân nhắc bản đồ (cần GeoJSON) — hiện chưa có dữ liệu hình học.
4. Chỉ thêm công cụ mới khi đã hoàn thiện công cụ hiện tại.
