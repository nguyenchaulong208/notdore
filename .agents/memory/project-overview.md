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
| Giao diện | Tông sáng + sakura (`notdore.css`), class mới tiền tố `nd-` |
| Trang chủ | Lưới công cụ 4 cột (block 4x4, tối đa 20 block/4x5) + panel danh mục bên phải; body chỉ công cụ, danh mục tách riêng |
| Thư viện | Trang riêng `thu-vien.html`; **chỉ danh mục/link ngoài**, không quảng bá công cụ |

## Kiến trúc
```
index.html                     # lưới công cụ 4 cột + panel danh mục phải
thu-vien.html                  # thư viện link ngoài theo nhóm (chỉ danh mục)
tools/dia-gioi-hanh-chinh.html # công cụ địa giới
assets/js/config.js            # Supabase URL/anon key + email (điền tay)
assets/js/db.js                # NotDoreDB: nguồn dữ liệu duy nhất
assets/js/tools.js             # render lưới + tìm kiếm + panel danh mục + câu nói
assets/js/library.js           # render thư viện theo nhóm; cuộn tới #lib-cat-N
assets/js/dia-gioi.js          # logic tra cứu
assets/css/tools.css           # component .nd-*
assets/data/tools.json         # catalog fallback
assets/data/admin-merger.json  # dữ liệu địa giới đã chuẩn hoá (tự sinh)
db/schema.sql                  # bảng + RLS
db/seed-tools.sql              # seed catalog
db/seed-admin.sql              # seed địa giới (tự sinh)
scripts/build-admin-data.mjs   # chuẩn hoá dữ liệu crawl -> JSON + SQL
scripts/check-links.mjs        # kiểm tra link/asset nội bộ
scripts/dev-server.mjs         # server tĩnh local (npm run dev)
```

Quy ước quan trọng: `NotDoreDB.getCatalog()` / `getAdminDivisions()` trả **cùng shape**
dù dữ liệu từ Supabase hay JSON, nên render không cần rẽ nhánh theo nguồn.

## Dữ liệu địa giới
- Nguồn gốc: `vietnam-admin-merger.json` (file crawl, chỉ có 34 đơn vị cấp tỉnh).
- Bổ sung **bảng đối chiếu 63 → 34 viết tay** trong `scripts/build-admin-data.mjs`,
  đối chiếu chéo với `predecessors` của file crawl. Kết quả: 63 cũ / 34 mới,
  11 giữ nguyên, 23 đơn vị sáp nhập.
- `Thừa Thiên Huế` xử lý riêng: không sáp nhập, chỉ đổi tên thành `Thành phố Huế`
  (`changed = false`, `renamedFrom = "Thừa Thiên Huế"`).
- Cấp huyện không còn trong bộ máy từ 01/07/2025 (chính quyền 2 cấp tỉnh – xã).
  Công cụ hiện chỉ tra **cấp tỉnh**, chưa có cấp xã/phường.

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

## Lệnh
```bash
npm run dev          # http://localhost:5173 (không cần npm install)
npm run build:data   # sinh lại JSON + seed SQL từ file crawl
node scripts/check-links.mjs
```

## Việc tiếp theo (gợi ý)
1. Chủ dự án tạo Supabase project → điền `config.js` → chạy 3 file SQL.
2. Hoàn thiện công cụ địa giới: bổ sung cấp xã/phường nếu có nguồn dữ liệu.
3. Cân nhắc bản đồ (cần GeoJSON) — hiện chưa có dữ liệu hình học.
4. Chỉ thêm công cụ mới khi đã hoàn thiện công cụ hiện tại.
