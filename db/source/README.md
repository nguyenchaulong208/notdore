# Nguồn dữ liệu `geo_*`

`database_vietnam_merger.json` là bản gốc dùng để sinh `db/seed-geo.sql`.

- Nội dung: 34 tỉnh/thành sau sắp xếp 01/07/2025, đánh giá cấp xã/phường/đặc khu,
  và 34 nghị quyết của UBTVQH.
- Không sửa trực tiếp file này nếu vẫn muốn tái tạo seed từ nguồn gốc.
- Sinh lại seed:

```bash
npm run build:geo
```

`communes-open-api.json` là nguồn 3.321 đơn vị cấp xã/phường/đặc khu sau sắp xếp,
sinh bằng `npm run fetch:communes`.

`danh_sach_xa_phuong_truoc_sau_sap_xep.json` là nguồn 34 tỉnh/thành và tên 127 đơn vị
không thực hiện sắp xếp. File này không có tên của 3.194 đơn vị còn lại. Dùng để tái tạo
dữ liệu tổng hợp và đánh dấu `geo_units`:

```bash
npm run build:reform
```

Script sẽ báo cảnh báo nếu số liệu tổng lệch `meta` hoặc có mã đơn vị trùng.
Riêng mã `43` đang được dùng cho cả Điện Biên và Đồng Nai; schema `geo_*`
không đặt unique trên `code`, mà dùng `slug`/`id` làm khoá ổn định.
