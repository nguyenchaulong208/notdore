# NotDore — bối cảnh dự án (v2, rebuild 2026-10)

## Chủ dự án muốn gì
Website nhiều công cụ, chạy hoàn toàn phía trình duyệt, cho người làm kế toán – thuế – nhân sự Việt Nam.
Công cụ đầu tiên và đang là trọng tâm: **tra cứu địa giới hành chính trước/sau sáp nhập 2025**.

## Quyết định đã chốt
| Vấn đề | Lựa chọn |
|---|---|
| Kiến trúc | HTML/CSS/JS thuần, **không build step**, deploy tĩnh Vercel |
| Dữ liệu | **Supabase** (anon key + RLS chỉ đọc), tự động fallback `assets/data/*.json` |
| Tool V1 | Bộ mới, bắt đầu bằng địa giới; 3 tool sau đang ở trạng thái "sắp có" |
| Giao diện | Giữ tông sáng + hiệu ứng sakura hiện có (`notdore.css`), class mới tiền tố `nd-` |

## Kiến trúc
```
index.html                     # hub: search + catalog + thư viện link ngoài
tools/<slug>.html              # mỗi công cụ một trang
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
- Nguồn gốc: `vietnam-admin-merger.json` (file crawl của chủ dự án, chỉ có 34 đơn vị cấp tỉnh).
- Đã bổ sung **bảng đối chiếu 63 → 34 viết tay** trong `scripts/build-admin-data.mjs`,
  đối chiếu chéo với `predecessors` của file crawl. Kết quả: 63 cũ / 34 mới, 11 giữ nguyên,
  23 đơn vị sáp nhập; script in cảnh báo nếu hai nguồn lệch nhau.
- `Thừa Thiên Huế` xử lý riêng: không sáp nhập, chỉ đổi tên thành `Thành phố Huế` (`changed = false`).
- Chưa có cấp xã/phường — đây là bước tiếp theo nếu chủ dự án cung cấp dữ liệu (10k+ đơn vị).

## Điểm cần kiểm chứng (đừng tự tin tuyệt đối)
- File crawl ghi Đồng Nai lên thành phố 29/04/2026, Quảng Ninh 01/09/2026, Bắc Ninh 20/09/2026.
  Dữ liệu vẫn để `type` như file gốc + `note` cảnh báo. **Không tự sửa nếu chưa có văn bản gốc.**
- Trường `capital` trong file crawl có giá trị "giữ nguyên" → đã chuẩn hoá thành `null`,
  UI hiển thị "Giữ nguyên".

## Trạng thái file cũ
- `tool-detail.html` + toàn bộ `assets/js/{merge-wizard,invoice-*,hoa-don-xml,admin-*,van-ban-*}.js`
  là **di sản v1**, hiện không được trang nào dùng. `tool-detail.html` gọi `/api/tools` đã bị xoá
  nên hỏng; `scripts/check-links.mjs` bỏ qua file này. Giữ lại để tham chiếu engine, xoá khi chủ dự án đồng ý.
- `api/`, `db/` cũ, `lib/` đã bị dọn sạch trong lần reset.

## Lệnh
```bash
npm run dev          # http://localhost:5173 (không cần npm install)
npm run build:data   # sinh lại JSON + seed SQL từ file crawl
node scripts/check-links.mjs
```

## Việc tiếp theo (gợi ý)
1. Chủ dự án tạo Supabase project → điền `config.js` → chạy 3 file SQL.
2. Bổ sung dữ liệu cấp xã/phường (bảng `admin_units` đã có cột `level` chờ mở rộng).
3. Làm tool tiếp theo (tính lương gross/net) theo đúng khuôn: trang + `assets/js/<slug>.js` + mục catalog.
