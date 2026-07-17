# Yêu cầu: Tách vai trò 2 khối "Văn bản" đang trùng lặp nội dung

## Bối cảnh

Trang danh mục (`category.html` hoặc tương đương) hiện có **2 khối hiển thị văn bản** dùng chung 1 nguồn dữ liệu (`category.js`), khiến chúng hiển thị **y hệt nhau**:

1. **Sidebar "Văn bản mới nhất"** — nằm trong hero section, góc phải màn hình.
2. **Section "VĂN BẢN" (`#documents-section`)** — danh sách đầy đủ, nằm giữa trang.

Cần tách rõ vai trò của 2 khối này để không bị lặp nội dung.

---

## Vai trò sau khi sửa

| Khối | Vai trò mới | Số lượng hiển thị | Có filter/search? | Có nút thao tác? |
|---|---|---|---|---|
| Sidebar "Văn bản mới nhất" | Widget preview nhanh, dạng carousel | 3 văn bản mới nhất | Không | Không (click cả item để điều hướng) |
| `#documents-section` "VĂN BẢN" | Trang danh sách đầy đủ | Tất cả văn bản | Có | Có ("Xem online", "Tải xuống") |

---

## Task 1 — Sidebar "Văn bản mới nhất" → chuyển thành carousel preview

**Vị trí trong code:** khối `<div class="col-12 col-md-5 mb-5 align-self-center"> ... <div class="sidebar-box">`

### Yêu cầu nội dung mỗi slide
- Số hiệu văn bản (ví dụ: `163/2017/NĐ-CP`)
- Tên rút gọn (1 dòng, `text-overflow: ellipsis` nếu dài)
- Ngày ban hành/cập nhật
- Badge "Mới" nếu văn bản được cập nhật trong vòng 30 ngày gần nhất

### Yêu cầu hành vi
- Lấy **3 văn bản mới nhất** (sort theo ngày, giảm dần) từ cùng nguồn dữ liệu đang dùng cho `#documents-grid`.
- Auto-play chuyển slide mỗi 4 giây, dừng khi hover/focus.
- Có dot indicator để chuyển slide thủ công.
- Click vào slide → điều hướng đến trang chi tiết văn bản đó (nếu có) hoặc scroll xuống `#documents-section`.
- Nếu dữ liệu có **dưới 3 văn bản**: hiển thị dạng list tĩnh (không cần carousel) với các văn bản hiện có.
- Nếu **không có văn bản nào**: giữ nguyên trạng thái loading/empty như hiện tại.
- Cuối khối, thêm link nhỏ: `Xem tất cả văn bản →` trỏ tới `#documents-section`.

### Không cần
- Không hiển thị mô tả dài của văn bản.
- Không hiển thị nút "Xem online" / "Tải xuống" ở đây.

---

## Task 2 — `#documents-section` "VĂN BẢN" → giữ vai trò danh sách đầy đủ, bổ sung filter

**Vị trí trong code:** `<section id="documents-section" class="benefits-section theme-bg-light-gradient py-5">`

### Yêu cầu bổ sung
- Hiển thị **toàn bộ** văn bản trong dữ liệu (không giới hạn số lượng như sidebar).
- Thêm thanh công cụ lọc phía trên `#documents-grid`:
  - Dropdown lọc theo **loại văn bản** (Luật / Nghị định / Thông tư / Quyết định / Công văn...)
  - Dropdown lọc theo **năm ban hành**
  - Dropdown/toggle lọc theo **trạng thái hiệu lực** (Còn hiệu lực / Hết hiệu lực / Sửa đổi bổ sung)
  - Ô tìm kiếm theo số hiệu hoặc từ khóa trong tên văn bản
- Mặc định sắp xếp theo ngày ban hành: mới nhất → cũ nhất.
- Mỗi card văn bản hiển thị thêm (nếu dữ liệu có):
  - Ngày ban hành
  - Cơ quan ban hành
  - Badge trạng thái hiệu lực (màu xanh = còn hiệu lực, màu đỏ/xám = hết hiệu lực)
- Nếu danh sách dài (> 12 văn bản): thêm phân trang hoặc nút "Xem thêm" (load thêm theo lô).
- Giữ nguyên 2 nút hành động hiện có: **Xem online**, **Tải xuống**.

---

## Ghi chú kỹ thuật
- Cả 2 khối nên dùng chung 1 API/data source để tránh lệch dữ liệu — chỉ khác cách xử lý hiển thị (limit 3 + carousel vs. full list + filter).
- Cần đảm bảo responsive: sidebar carousel không vỡ layout trên mobile (`col-12 col-md-5`), filter bar ở `#documents-section` nên wrap xuống dòng trên màn hình nhỏ.
- Giữ nguyên class/id hiện có (`sidebar-list`, `documents-grid`, `docs-loading`) nếu có thể, để không phải sửa lại các phần JS khác đang tham chiếu tới chúng — chỉ mở rộng thêm class/thuộc tính mới khi cần.
