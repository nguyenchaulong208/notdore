-- =============================================================================
-- NotDore - seed geo_* cấp xã: Lạng Sơn (65 đơn vị).
-- Chạy SAU db/seed-geo-1-core.sql. Có thể chạy song song với các tỉnh khác.
-- =============================================================================
begin;

insert into public.geo_units
  (dataset_id, parent_id, level_code, type_code, code, name, slug, sort_order, effective_from, metadata)
select d.id, parent.id, 'commune', v.type_code, v.code, v.name, v.slug,
       v.sort_order, v.effective_from::date, v.metadata
from (values
  ('55-lang-son', 'phuong', '5977', 'Phường Đông Kinh', '5977-phuong-dong-kinh', 1, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'phuong', '5983', 'Phường Lương Văn Tri', '5983-phuong-luong-van-tri', 2, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'phuong', '5986', 'Phường Tam Thanh', '5986-phuong-tam-thanh', 3, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6001', 'Xã Đoàn Kết', '6001-xa-doan-ket', 4, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6004', 'Xã Quốc Khánh', '6004-xa-quoc-khanh', 5, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6019', 'Xã Tân Tiến', '6019-xa-tan-tien', 6, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6037', 'Xã Kháng Chiến', '6037-xa-khang-chien', 7, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6040', 'Xã Thất Khê', '6040-xa-that-khe', 8, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6046', 'Xã Tràng Định', '6046-xa-trang-dinh', 9, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6058', 'Xã Quốc Việt', '6058-xa-quoc-viet', 10, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6073', 'Xã Hoa Thám', '6073-xa-hoa-tham', 11, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6076', 'Xã Quý Hòa', '6076-xa-quy-hoa', 12, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6079', 'Xã Hồng Phong', '6079-xa-hong-phong', 13, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6085', 'Xã Thiện Hòa', '6085-xa-thien-hoa', 14, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6091', 'Xã Thiện Thuật', '6091-xa-thien-thuat', 15, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6103', 'Xã Thiện Long', '6103-xa-thien-long', 16, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6112', 'Xã Bình Gia', '6112-xa-binh-gia', 17, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6115', 'Xã Tân Văn', '6115-xa-tan-van', 18, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6124', 'Xã Na Sầm', '6124-xa-na-sam', 19, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6148', 'Xã Thụy Hùng', '6148-xa-thuy-hung', 20, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6151', 'Xã Hội Hoan', '6151-xa-hoi-hoan', 21, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6154', 'Xã Văn Lãng', '6154-xa-van-lang', 22, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6172', 'Xã Hoàng Văn Thụ', '6172-xa-hoang-van-thu', 23, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6184', 'Xã Đồng Đăng', '6184-xa-dong-dang', 24, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'phuong', '6187', 'Phường Kỳ Lừa', '6187-phuong-ky-lua', 25, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6196', 'Xã Ba Sơn', '6196-xa-ba-son', 26, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6211', 'Xã Cao Lộc', '6211-xa-cao-loc', 27, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6220', 'Xã Công Sơn', '6220-xa-cong-son', 28, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6253', 'Xã Văn Quan', '6253-xa-van-quan', 29, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6280', 'Xã Điềm He', '6280-xa-diem-he', 30, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6286', 'Xã Khánh Khê', '6286-xa-khanh-khe', 31, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6298', 'Xã Yên Phúc', '6298-xa-yen-phuc', 32, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6313', 'Xã Tri Lễ', '6313-xa-tri-le', 33, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6316', 'Xã Tân Đoàn', '6316-xa-tan-doan', 34, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6325', 'xã Bắc Sơn', '6325-xa-bac-son', 35, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6337', 'Xã Tân Tri', '6337-xa-tan-tri', 36, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6349', 'Xã Hưng Vũ', '6349-xa-hung-vu', 37, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6364', 'Xã Vũ Lễ', '6364-xa-vu-le', 38, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6367', 'Xã Vũ Lăng', '6367-xa-vu-lang', 39, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6376', 'Xã Nhất Hòa', '6376-xa-nhat-hoa', 40, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6385', 'Xã Hữu Lũng', '6385-xa-huu-lung', 41, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6391', 'Xã Yên Bình', '6391-xa-yen-binh', 42, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6400', 'Xã Hữu Liên', '6400-xa-huu-lien', 43, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6415', 'Xã Vân Nham', '6415-xa-van-nham', 44, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6427', 'Xã Cai Kinh', '6427-xa-cai-kinh', 45, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6436', 'Xã Thiện Tân', '6436-xa-thien-tan', 46, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6445', 'Xã Tân Thành', '6445-xa-tan-thanh', 47, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6457', 'Xã Tuấn Sơn', '6457-xa-tuan-son', 48, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6463', 'Xã Chi Lăng', '6463-xa-chi-lang', 49, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6475', 'Xã Bằng Mạc', '6475-xa-bang-mac', 50, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6481', 'Xã Chiến Thắng', '6481-xa-chien-thang', 51, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6496', 'Xã Nhân Lý', '6496-xa-nhan-ly', 52, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6505', 'Xã Vạn Linh', '6505-xa-van-linh', 53, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6517', 'Xã Quan Sơn', '6517-xa-quan-son', 54, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6526', 'Xã Na Dương', '6526-xa-na-duong', 55, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6529', 'Xã Lộc Bình', '6529-xa-loc-binh', 56, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6541', 'Xã Mẫu Sơn', '6541-xa-mau-son', 57, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6565', 'Xã Khuất Xá', '6565-xa-khuat-xa', 58, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6577', 'Xã Thống Nhất', '6577-xa-thong-nhat', 59, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6601', 'Xã Lợi Bác', '6601-xa-loi-bac', 60, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6607', 'Xã Xuân Dương', '6607-xa-xuan-duong', 61, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6613', 'Xã Đình Lập', '6613-xa-dinh-lap', 62, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6616', 'Xã Thái Bình', '6616-xa-thai-binh', 63, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6625', 'Xã Kiên Mộc', '6625-xa-kien-moc', 64, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb),
  ('55-lang-son', 'xa', '6637', 'Xã Châu Sơn', '6637-xa-chau-son', 65, '2025-07-01', '{"province_code":"20","province_name":"Tỉnh Lạng Sơn"}'::jsonb)
) as v(parent_slug, type_code, code, name, slug, sort_order, effective_from, metadata)
join public.geo_datasets d on d.code = 'vn-admin-2025-07-01'
join public.geo_units parent on parent.dataset_id = d.id
  and parent.level_code = 'province' and parent.slug = v.parent_slug;

commit;
