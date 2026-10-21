-- =============================================================================
-- NotDore - seed geo_* cấp xã: Cao Bằng (56 đơn vị).
-- Chạy SAU db/seed-geo-1-core.sql. Có thể chạy song song với các tỉnh khác.
-- =============================================================================
begin;

insert into public.geo_units
  (dataset_id, parent_id, level_code, type_code, code, name, slug, sort_order, effective_from, metadata)
select d.id, parent.id, 'commune', v.type_code, v.code, v.name, v.slug,
       v.sort_order, v.effective_from::date, v.metadata
from (values
  ('39-cao-bang', 'phuong', '1273', 'Phường Thục Phán', '1273-phuong-thuc-phan', 1, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb),
  ('39-cao-bang', 'phuong', '1279', 'Phường Nùng Trí Cao', '1279-phuong-nung-tri-cao', 2, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb),
  ('39-cao-bang', 'phuong', '1288', 'Phường Tân Giang', '1288-phuong-tan-giang', 3, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb),
  ('39-cao-bang', 'xa', '1290', 'Xã Bảo Lâm', '1290-xa-bao-lam', 4, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb),
  ('39-cao-bang', 'xa', '1294', 'Xã Lý Bôn', '1294-xa-ly-bon', 5, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb),
  ('39-cao-bang', 'xa', '1297', 'Xã Nam Quang', '1297-xa-nam-quang', 6, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb),
  ('39-cao-bang', 'xa', '1304', 'Xã Quảng Lâm', '1304-xa-quang-lam', 7, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb),
  ('39-cao-bang', 'xa', '1318', 'Xã Yên Thổ', '1318-xa-yen-tho', 8, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb),
  ('39-cao-bang', 'xa', '1321', 'Xã Bảo Lạc', '1321-xa-bao-lac', 9, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb),
  ('39-cao-bang', 'xa', '1324', 'Xã Cốc Pàng', '1324-xa-coc-pang', 10, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb),
  ('39-cao-bang', 'xa', '1327', 'Xã Cô Ba', '1327-xa-co-ba', 11, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb),
  ('39-cao-bang', 'xa', '1336', 'Xã Khánh Xuân', '1336-xa-khanh-xuan', 12, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb),
  ('39-cao-bang', 'xa', '1339', 'Xã Xuân Trường', '1339-xa-xuan-truong', 13, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb),
  ('39-cao-bang', 'xa', '1351', 'Xã Hưng Đạo', '1351-xa-hung-dao', 14, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb),
  ('39-cao-bang', 'xa', '1354', 'Xã Huy Giáp', '1354-xa-huy-giap', 15, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb),
  ('39-cao-bang', 'xa', '1360', 'Xã Sơn Lộ', '1360-xa-son-lo', 16, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb),
  ('39-cao-bang', 'xa', '1363', 'Xã Thông Nông', '1363-xa-thong-nong', 17, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb),
  ('39-cao-bang', 'xa', '1366', 'Xã Cần Yên', '1366-xa-can-yen', 18, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb),
  ('39-cao-bang', 'xa', '1387', 'Xã Thanh Long', '1387-xa-thanh-long', 19, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb),
  ('39-cao-bang', 'xa', '1392', 'Xã Trường Hà', '1392-xa-truong-ha', 20, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb),
  ('39-cao-bang', 'xa', '1393', 'Xã Lũng Nặm', '1393-xa-lung-nam', 21, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb),
  ('39-cao-bang', 'xa', '1414', 'Xã Tổng Cọt', '1414-xa-tong-cot', 22, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb),
  ('39-cao-bang', 'xa', '1438', 'Xã Hà Quảng', '1438-xa-ha-quang', 23, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb),
  ('39-cao-bang', 'xa', '1447', 'Xã Trà Lĩnh', '1447-xa-tra-linh', 24, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb),
  ('39-cao-bang', 'xa', '1456', 'Xã Quang Hán', '1456-xa-quang-han', 25, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb),
  ('39-cao-bang', 'xa', '1465', 'Xã Quang Trung', '1465-xa-quang-trung', 26, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb),
  ('39-cao-bang', 'xa', '1477', 'Xã Trùng Khánh', '1477-xa-trung-khanh', 27, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb),
  ('39-cao-bang', 'xa', '1489', 'Xã Đình Phong', '1489-xa-dinh-phong', 28, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb),
  ('39-cao-bang', 'xa', '1501', 'Xã Đàm Thủy', '1501-xa-dam-thuy', 29, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb),
  ('39-cao-bang', 'xa', '1525', 'Xã Đoài Dương', '1525-xa-doai-duong', 30, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb),
  ('39-cao-bang', 'xa', '1537', 'Xã Lý Quốc', '1537-xa-ly-quoc', 31, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb),
  ('39-cao-bang', 'xa', '1552', 'Xã Quang Long', '1552-xa-quang-long', 32, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb),
  ('39-cao-bang', 'xa', '1558', 'Xã Hạ Lang', '1558-xa-ha-lang', 33, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb),
  ('39-cao-bang', 'xa', '1561', 'Xã Vinh Quý', '1561-xa-vinh-quy', 34, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb),
  ('39-cao-bang', 'xa', '1576', 'Xã Quảng Uyên', '1576-xa-quang-uyen', 35, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb),
  ('39-cao-bang', 'xa', '1594', 'Xã Độc Lập', '1594-xa-doc-lap', 36, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb),
  ('39-cao-bang', 'xa', '1618', 'Xã Hạnh Phúc', '1618-xa-hanh-phuc', 37, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb),
  ('39-cao-bang', 'xa', '1636', 'Xã Bế Văn Đàn', '1636-xa-be-van-dan', 38, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb),
  ('39-cao-bang', 'xa', '1648', 'Xã Phục Hòa', '1648-xa-phuc-hoa', 39, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb),
  ('39-cao-bang', 'xa', '1654', 'Xã Hòa An', '1654-xa-hoa-an', 40, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb),
  ('39-cao-bang', 'xa', '1660', 'Xã Nam Tuấn', '1660-xa-nam-tuan', 41, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb),
  ('39-cao-bang', 'xa', '1699', 'Xã Nguyễn Huệ', '1699-xa-nguyen-hue', 42, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb),
  ('39-cao-bang', 'xa', '1708', 'Xã Bạch Đằng', '1708-xa-bach-dang', 43, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb),
  ('39-cao-bang', 'xa', '1726', 'Xã Nguyên Bình', '1726-xa-nguyen-binh', 44, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb),
  ('39-cao-bang', 'xa', '1729', 'Xã Tĩnh Túc', '1729-xa-tinh-tuc', 45, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb),
  ('39-cao-bang', 'xa', '1738', 'Xã Ca Thành', '1738-xa-ca-thanh', 46, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb),
  ('39-cao-bang', 'xa', '1747', 'Xã Minh Tâm', '1747-xa-minh-tam', 47, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb),
  ('39-cao-bang', 'xa', '1768', 'Xã Phan Thanh', '1768-xa-phan-thanh', 48, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb),
  ('39-cao-bang', 'xa', '1774', 'Xã Tam Kim', '1774-xa-tam-kim', 49, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb),
  ('39-cao-bang', 'xa', '1777', 'Xã Thành Công', '1777-xa-thanh-cong', 50, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb),
  ('39-cao-bang', 'xa', '1786', 'Xã Đông Khê', '1786-xa-dong-khe', 51, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb),
  ('39-cao-bang', 'xa', '1789', 'Xã Canh Tân', '1789-xa-canh-tan', 52, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb),
  ('39-cao-bang', 'xa', '1792', 'Xã Kim Đồng', '1792-xa-kim-dong', 53, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb),
  ('39-cao-bang', 'xa', '1795', 'Xã Minh Khai', '1795-xa-minh-khai', 54, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb),
  ('39-cao-bang', 'xa', '1807', 'Xã Thạch An', '1807-xa-thach-an', 55, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb),
  ('39-cao-bang', 'xa', '1822', 'Xã Đức Long', '1822-xa-duc-long', 56, '2025-07-01', '{"province_code":"04","province_name":"Tỉnh Cao Bằng"}'::jsonb)
) as v(parent_slug, type_code, code, name, slug, sort_order, effective_from, metadata)
join public.geo_datasets d on d.code = 'vn-admin-2025-07-01'
join public.geo_units parent on parent.dataset_id = d.id
  and parent.level_code = 'province' and parent.slug = v.parent_slug;

commit;
