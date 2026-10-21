# Nguồn dữ liệu `geo_*`

`database_vietnam_merger.json` là bản gốc dùng để sinh `db/seed-geo.sql`.

- Nội dung: 34 tỉnh/thành sau sắp xếp 01/07/2025, đánh giá cấp xã/phường/đặc khu,
  và 34 nghị quyết của UBTVQH.
- Không sửa trực tiếp file này nếu vẫn muốn tái tạo seed từ nguồn gốc.
- Sinh lại seed:

```bash
npm run build:geo
```

Script sẽ báo cảnh báo nếu số liệu tổng lệch `meta` hoặc có mã đơn vị trùng.
Riêng mã `43` đang được dùng cho cả Điện Biên và Đồng Nai; schema `geo_*`
không đặt unique trên `code`, mà dùng `slug`/`id` làm khoá ổn định.
