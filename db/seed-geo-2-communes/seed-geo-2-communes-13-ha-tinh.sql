-- =============================================================================
-- NotDore - seed geo_* cấp xã: Hà Tĩnh (69 đơn vị).
-- Chạy SAU db/seed-geo-1-core.sql. Có thể chạy song song với các tỉnh khác.
-- =============================================================================
begin;

insert into public.geo_units
  (dataset_id, parent_id, level_code, type_code, code, name, slug, sort_order, effective_from, metadata)
select d.id, parent.id, 'commune', v.type_code, v.code, v.name, v.slug,
       v.sort_order, v.effective_from::date, v.metadata
from (values
  ('47-ha-tinh', 'phuong', '18073', 'Phường Thành Sen', '18073-phuong-thanh-sen', 1, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'phuong', '18100', 'Phường Trần Phú', '18100-phuong-tran-phu', 2, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'phuong', '18115', 'Phường Bắc Hồng Lĩnh', '18115-phuong-bac-hong-linh', 3, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'phuong', '18118', 'Phường Nam Hồng Lĩnh', '18118-phuong-nam-hong-linh', 4, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18133', 'Xã Hương Sơn', '18133-xa-huong-son', 5, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18160', 'Xã Sơn Hồng', '18160-xa-son-hong', 6, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18163', 'Xã Sơn Tiến', '18163-xa-son-tien', 7, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18172', 'Xã Sơn Tây', '18172-xa-son-tay', 8, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18184', 'Xã Sơn Giang', '18184-xa-son-giang', 9, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18196', 'Xã Sơn Kim 1', '18196-xa-son-kim-1', 10, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18199', 'Xã Sơn Kim 2', '18199-xa-son-kim-2', 11, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18202', 'Xã Tứ Mỹ', '18202-xa-tu-my', 12, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18223', 'Xã Kim Hoa', '18223-xa-kim-hoa', 13, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18229', 'Xã Đức Thọ', '18229-xa-duc-tho', 14, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18244', 'Xã Đức Minh', '18244-xa-duc-minh', 15, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18262', 'Xã Đức Quang', '18262-xa-duc-quang', 16, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18277', 'Xã Đức Thịnh', '18277-xa-duc-thinh', 17, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18304', 'Xã Đức Đồng', '18304-xa-duc-dong', 18, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18313', 'Xã Vũ Quang', '18313-xa-vu-quang', 19, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18322', 'Xã Mai Hoa', '18322-xa-mai-hoa', 20, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18328', 'Xã Thượng Đức', '18328-xa-thuong-duc', 21, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18352', 'Xã Nghi Xuân', '18352-xa-nghi-xuan', 22, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18364', 'Xã Đan Hải', '18364-xa-dan-hai', 23, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18373', 'Xã Tiên Điền', '18373-xa-tien-dien', 24, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18394', 'Xã Cổ Đạm', '18394-xa-co-dam', 25, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18406', 'Xã Can Lộc', '18406-xa-can-loc', 26, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18409', 'Xã Hồng Lộc', '18409-xa-hong-loc', 27, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18418', 'Xã Tùng Lộc', '18418-xa-tung-loc', 28, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18436', 'Xã Trường Lưu', '18436-xa-truong-luu', 29, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18466', 'Xã Gia Hanh', '18466-xa-gia-hanh', 30, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18481', 'Xã Xuân Lộc', '18481-xa-xuan-loc', 31, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18484', 'Xã Đồng Lộc', '18484-xa-dong-loc', 32, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18496', 'Xã Hương Khê', '18496-xa-huong-khe', 33, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18502', 'Xã Hà Linh', '18502-xa-ha-linh', 34, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18523', 'Xã Hương Bình', '18523-xa-huong-binh', 35, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18532', 'Xã Hương Phố', '18532-xa-huong-pho', 36, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18544', 'Xã Hương Xuân', '18544-xa-huong-xuan', 37, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18547', 'Xã Phúc Trạch', '18547-xa-phuc-trach', 38, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18550', 'Xã Hương Đô', '18550-xa-huong-do', 39, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18562', 'Xã Thạch Hà', '18562-xa-thach-ha', 40, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18568', 'Xã Lộc Hà', '18568-xa-loc-ha', 41, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18583', 'Xã Mai Phụ', '18583-xa-mai-phu', 42, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18586', 'Xã Đông Kinh', '18586-xa-dong-kinh', 43, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18601', 'Xã Việt Xuyên', '18601-xa-viet-xuyen', 44, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18604', 'Xã Thạch Khê', '18604-xa-thach-khe', 45, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18619', 'Xã Đồng Tiến', '18619-xa-dong-tien', 46, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18628', 'Xã Thạch Lạc', '18628-xa-thach-lac', 47, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18634', 'Xã Toàn Lưu', '18634-xa-toan-luu', 48, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'phuong', '18652', 'Phường Hà Huy Tập', '18652-phuong-ha-huy-tap', 49, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18667', 'Xã Thạch Xuân', '18667-xa-thach-xuan', 50, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18673', 'Xã Cẩm Xuyên', '18673-xa-cam-xuyen', 51, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18676', 'Xã Thiên Cầm', '18676-xa-thien-cam', 52, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18682', 'Xã Yên Hòa', '18682-xa-yen-hoa', 53, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18685', 'Xã Cẩm Bình', '18685-xa-cam-binh', 54, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18736', 'Xã Cẩm Hưng', '18736-xa-cam-hung', 55, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18739', 'Xã Cẩm Duệ', '18739-xa-cam-due', 56, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18742', 'Xã Cẩm Trung', '18742-xa-cam-trung', 57, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18748', 'Xã Cẩm Lạc', '18748-xa-cam-lac', 58, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'phuong', '18754', 'Phường Sông Trí', '18754-phuong-song-tri', 59, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18766', 'Xã Kỳ Xuân', '18766-xa-ky-xuan', 60, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18775', 'Xã Kỳ Anh', '18775-xa-ky-anh', 61, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'phuong', '18781', 'Phường Hải Ninh', '18781-phuong-hai-ninh', 62, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18787', 'Xã Kỳ Văn', '18787-xa-ky-van', 63, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18790', 'Xã Kỳ Khang', '18790-xa-ky-khang', 64, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18814', 'Xã Kỳ Hoa', '18814-xa-ky-hoa', 65, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'phuong', '18823', 'Phường Vũng Áng', '18823-phuong-vung-ang', 66, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'phuong', '18832', 'Phường Hoành Sơn', '18832-phuong-hoanh-son', 67, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18838', 'Xã Kỳ Lạc', '18838-xa-ky-lac', 68, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb),
  ('47-ha-tinh', 'xa', '18844', 'Xã Kỳ Thượng', '18844-xa-ky-thuong', 69, '2025-07-01', '{"province_code":"42","province_name":"Tỉnh Hà Tĩnh"}'::jsonb)
) as v(parent_slug, type_code, code, name, slug, sort_order, effective_from, metadata)
join public.geo_datasets d on d.code = 'vn-admin-2025-07-01'
join public.geo_units parent on parent.dataset_id = d.id
  and parent.level_code = 'province' and parent.slug = v.parent_slug;

commit;
