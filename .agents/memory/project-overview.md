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
| Trang chủ | Không có hero; vào thẳng tiêu đề "Công cụ" + ô tìm kiếm + danh sách |

## Kiến trúc
```
index.html                     # hub: search + catalog + thư viện link ngoài
tools/dia-gioi-hanh-chinh.html # công cụ địa giới
assets/js/config.js            # Supabase URL/anon key + email (điền tay)
assets/js/db.js                # NotDoreDB: nguồn dữ liệu duy nhất
assets/js/tools.js             # render hub
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
- Còn lại: 5 file JS (`config`, `db`, `tools`, `dia-gioi`, `oneko`), 2 file CSS
  (`notdore`, `tools`), Bootstrap (`bootstrap.min.css` + `bootstrap.bundle.min.js`),
  Font Awesome `all.min.js` + LICENSE, `oneko.gif`.
- Font Awesome render bằng JS (`all.min.js` tự chứa, không cần `webfonts/` hay `svgs/`).
  Trang gọi `FontAwesome.dom.watch()` sau sự kiện `load` để icon được sinh ra động
  (thẻ công cụ, bảng, modal) cũng được thay bằng `<svg>`.
- `CREDITS.md` đã cập nhật đúng thư viện còn dùng. Lưu ý: license DevBook yêu cầu
  giữ dòng ghi nguồn footer — hiện footer chỉ ghi "Made with ❤️ by Theodore".

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
