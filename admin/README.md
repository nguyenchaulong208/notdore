# NotDore Admin

Công cụ admin chạy **local** để xem, thêm, sửa, xoá dữ liệu Supabase và chạy SQL/import file `.sql` cho tất cả bảng mà project cho phép.

Toàn bộ công cụ nằm trong thư mục `admin/`. Key Supabase chỉ được đọc ở server Node và **không bao giờ gửi xuống trình duyệt**.

## 1. Cài đặt

Yêu cầu: Node.js 20+ (repo đang dùng Node 24.x; Node 26 cũng chạy được).

Từ thư mục gốc repo:

```bash
npm run admin
```

Hoặc chạy trực tiếp:

```bash
node admin/server.mjs
```

Trên Windows có thể bấm đúp `admin/start.cmd`.

Mặc định admin mở tại:

```text
http://127.0.0.1:8787
```

## 2. Cấu hình

Sao chép file mẫu:

```text
admin/supabase.example.txt  →  admin/supabase.txt
```

Điền tối thiểu:

```txt
SUPABASE_URL=https://thmvaufuaxfoflyndrcq.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
```

- `SUPABASE_URL`: URL project Supabase.
- `SUPABASE_SERVICE_ROLE_KEY`: service role key hoặc secret key mới của Supabase. **Không dùng anon key** nếu muốn sửa/xoá dữ liệu; anon key sẽ bị RLS giới hạn.
- `SUPABASE_ACCESS_TOKEN`: PAT dạng `sbp_...`, dùng để chạy SQL và import file `.sql` trực tiếp trong admin. Lấy tại <https://supabase.com/dashboard/account/tokens>.
- `DATABASE_URL` (tuỳ chọn): connection string PostgreSQL nếu muốn dùng `psql` thay cho PAT. Máy phải có `psql` trong `PATH`.

Có thể chạy **chỉ SQL** mà không cần service role key: dùng `SUPABASE_URL` +
`SUPABASE_ACCESS_TOKEN`, hoặc chỉ `DATABASE_URL` (khi đó admin không duyệt/sửa bảng).
Muốn CRUD qua PostgREST vẫn cần `SUPABASE_URL` + service role/secret key.

Admin cũng chấp nhận các tên biến phổ biến khác như `SUPABASE_KEY`, `SERVICE_ROLE_KEY`, `SUPABASE_PROJECT_REF`, `POSTGRES_URL` và file cấu hình dạng mỗi dòng một giá trị.

Sau khi sửa file, bấm **Tải lại cấu hình** trong giao diện.

## 3. Chức năng

### Duyệt và sửa dữ liệu

- Danh sách bảng được nhóm theo schema, có tìm kiếm và lọc schema.
- Xem dữ liệu có phân trang, tìm kiếm trên các cột text, sắp xếp theo cột.
- Bấm vào dòng hoặc nút **Sửa** để mở form.
- Thêm dòng mới, sửa từng trường, xoá dòng.
- Hỗ trợ NULL, JSONB/array, boolean, số, ngày giờ, uuid.
- Cột identity/generated và khoá chính được bảo vệ khi sửa.
- Nếu bảng không có khoá chính, admin sẽ cảnh báo và dùng toàn bộ cột của dòng làm điều kiện.

### SQL & Import

- Dán SQL trực tiếp vào editor.
- Nạp file `.sql` bằng nút chọn file hoặc kéo-thả vào editor.
- Chạy bằng `Ctrl+Enter` hoặc nút **Chạy SQL**.
- Có tuỳ chọn **Chỉ đọc** khi backend hỗ trợ (Management API).
- Kết quả dạng bảng, có thể tải JSON.
- Nút **Sao chép** để dán SQL sang Supabase SQL Editor nếu chưa cấu hình PAT.

> **Quan trọng:** service_role key **không đủ** để chạy SQL tuỳ ý qua admin. Cần thêm PAT (`SUPABASE_ACCESS_TOKEN`) hoặc `DATABASE_URL` + `psql`. Nếu không có, hãy dùng Supabase Dashboard → SQL Editor với file SQL được tạo sẵn.

## 4. Bảo mật

- Server chỉ bind `127.0.0.1` mặc định.
- Key chỉ nằm trong `admin/supabase.txt`, file này đã được `.gitignore`.
- API yêu cầu header `X-Admin-Request`, kiểm tra same-origin và chỉ chấp nhận Host
  loopback (`127.0.0.1`, `localhost`, `[::1]`) để hạn chế CSRF/DNS rebinding.
  Nếu đổi `ADMIN_HOST`, hostname tương ứng cũng phải được dùng để mở admin.
- Không bật CORS.
- Không trả key/token về client.
- SQL chạy với quyền quản trị, có thể thay đổi hoặc xoá dữ liệu. Hãy sao lưu trước khi import file lớn.

Không deploy thư mục này lên Internet. Đây là công cụ local.

## 5. Biến môi trường

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `ADMIN_HOST` | `127.0.0.1` | Địa chỉ bind. Chỉ đổi nếu thật sự cần. |
| `ADMIN_PORT` | `8787` | Cổng chạy admin. |
| `ADMIN_CONFIG` | `admin/supabase.txt` | Đường dẫn file cấu hình. |
| `PORT` | `8787` | Fallback nếu không có `ADMIN_PORT`. |

Ví dụ đổi cổng:

```powershell
$env:ADMIN_PORT=8790; npm run admin
```

## 6. Lưu ý về dữ liệu sắp xếp 2025

File `db/seed-commune-reform-summary.sql` tạo bảng `public.geo_reform_summaries`, đồng bộ số liệu vào `geo_unit_metrics`, và đánh dấu 127 đơn vị không thực hiện sắp xếp trên `geo_units`.

Dữ liệu nguồn có **số liệu tổng hợp theo 34 tỉnh/thành** và **tên 127 đơn vị giữ nguyên**. 3.194 đơn vị hình thành sau sắp xếp vẫn chưa có tên trước sắp xếp, nên admin không thể tạo danh sách đầy đủ từ file này.

Sau khi chạy SQL:

- Mở `public.geo_reform_summaries` để xem 34 dòng; metadata có `not_applied_units` và chi tiết từng đơn vị.
- Mở `public.geo_units`, lọc `metadata->>'reform_status' = 'not_applied'` để xem 127 đơn vị “Giữ nguyên”.

Tái tạo dữ liệu/SQL: `npm run build:reform`.

## 7. Xử lý sự cố

**Không thấy bảng / lỗi 401, 403**
- Kiểm tra `SUPABASE_SERVICE_ROLE_KEY` là service_role/secret key, không phải anon key.
- Kiểm tra `SUPABASE_URL` đúng project.
- Một số bảng thuộc schema chưa được expose trên PostgREST. Thêm PAT để admin đọc schema đầy đủ hơn, nhưng thao tác ghi vẫn phụ thuộc cấu hình Exposed schemas của Supabase.

**Nút Chạy SQL bị tắt**
- Thêm `SUPABASE_ACCESS_TOKEN=sbp_...` vào `admin/supabase.txt`.
- Hoặc cấu hình `DATABASE_URL` và cài `psql`.
- Hoặc dùng Supabase Dashboard → SQL Editor.

**Cổng 8787 đang bận**
```powershell
$env:ADMIN_PORT=8790; npm run admin
```

**Không thấy `psql`**
- Cài PostgreSQL client và thêm vào `PATH`, hoặc dùng PAT (khuyến nghị).
