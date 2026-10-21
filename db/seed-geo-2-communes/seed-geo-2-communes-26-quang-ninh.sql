-- =============================================================================
-- NotDore - seed geo_* cấp xã: Quảng Ninh (54 đơn vị).
-- Chạy SAU db/seed-geo-1-core.sql. Có thể chạy song song với các tỉnh khác.
-- =============================================================================
begin;

insert into public.geo_units
  (dataset_id, parent_id, level_code, type_code, code, name, slug, sort_order, effective_from, metadata)
select d.id, parent.id, 'commune', v.type_code, v.code, v.name, v.slug,
       v.sort_order, v.effective_from::date, v.metadata
from (values
  ('61-quang-ninh', 'phuong', '6652', 'Phường Hà Tu', '6652-phuong-ha-tu', 1, '2025-07-01', '{"province_code":"22","province_name":"Tỉnh Quảng Ninh"}'::jsonb),
  ('61-quang-ninh', 'phuong', '6658', 'Phường Cao Xanh', '6658-phuong-cao-xanh', 2, '2025-07-01', '{"province_code":"22","province_name":"Tỉnh Quảng Ninh"}'::jsonb),
  ('61-quang-ninh', 'phuong', '6661', 'Phường Việt Hưng', '6661-phuong-viet-hung', 3, '2025-07-01', '{"province_code":"22","province_name":"Tỉnh Quảng Ninh"}'::jsonb),
  ('61-quang-ninh', 'phuong', '6673', 'Phường Bãi Cháy', '6673-phuong-bai-chay', 4, '2025-07-01', '{"province_code":"22","province_name":"Tỉnh Quảng Ninh"}'::jsonb),
  ('61-quang-ninh', 'phuong', '6676', 'Phường Hà Lầm', '6676-phuong-ha-lam', 5, '2025-07-01', '{"province_code":"22","province_name":"Tỉnh Quảng Ninh"}'::jsonb),
  ('61-quang-ninh', 'phuong', '6685', 'Phường Hồng Gai', '6685-phuong-hong-gai', 6, '2025-07-01', '{"province_code":"22","province_name":"Tỉnh Quảng Ninh"}'::jsonb),
  ('61-quang-ninh', 'phuong', '6688', 'Phường Hạ Long', '6688-phuong-ha-long', 7, '2025-07-01', '{"province_code":"22","province_name":"Tỉnh Quảng Ninh"}'::jsonb),
  ('61-quang-ninh', 'phuong', '6706', 'Phường Tuần Châu', '6706-phuong-tuan-chau', 8, '2025-07-01', '{"province_code":"22","province_name":"Tỉnh Quảng Ninh"}'::jsonb),
  ('61-quang-ninh', 'phuong', '6709', 'Phường Móng Cái 2', '6709-phuong-mong-cai-2', 9, '2025-07-01', '{"province_code":"22","province_name":"Tỉnh Quảng Ninh"}'::jsonb),
  ('61-quang-ninh', 'phuong', '6712', 'Phường Móng Cái 1', '6712-phuong-mong-cai-1', 10, '2025-07-01', '{"province_code":"22","province_name":"Tỉnh Quảng Ninh"}'::jsonb),
  ('61-quang-ninh', 'xa', '6724', 'Xã Hải Sơn', '6724-xa-hai-son', 11, '2025-07-01', '{"province_code":"22","province_name":"Tỉnh Quảng Ninh"}'::jsonb),
  ('61-quang-ninh', 'xa', '6733', 'Xã Hải Ninh', '6733-xa-hai-ninh', 12, '2025-07-01', '{"province_code":"22","province_name":"Tỉnh Quảng Ninh"}'::jsonb),
  ('61-quang-ninh', 'phuong', '6736', 'Phường Móng Cái 3', '6736-phuong-mong-cai-3', 13, '2025-07-01', '{"province_code":"22","province_name":"Tỉnh Quảng Ninh"}'::jsonb),
  ('61-quang-ninh', 'xa', '6757', 'Xã Vĩnh Thực', '6757-xa-vinh-thuc', 14, '2025-07-01', '{"province_code":"22","province_name":"Tỉnh Quảng Ninh"}'::jsonb),
  ('61-quang-ninh', 'phuong', '6760', 'Phường Mông Dương', '6760-phuong-mong-duong', 15, '2025-07-01', '{"province_code":"22","province_name":"Tỉnh Quảng Ninh"}'::jsonb),
  ('61-quang-ninh', 'phuong', '6778', 'Phường Quang Hanh', '6778-phuong-quang-hanh', 16, '2025-07-01', '{"province_code":"22","province_name":"Tỉnh Quảng Ninh"}'::jsonb),
  ('61-quang-ninh', 'phuong', '6781', 'Phường Cửa Ông', '6781-phuong-cua-ong', 17, '2025-07-01', '{"province_code":"22","province_name":"Tỉnh Quảng Ninh"}'::jsonb),
  ('61-quang-ninh', 'phuong', '6793', 'Phường Cẩm Phả', '6793-phuong-cam-pha', 18, '2025-07-01', '{"province_code":"22","province_name":"Tỉnh Quảng Ninh"}'::jsonb),
  ('61-quang-ninh', 'xa', '6799', 'Xã Hải Hòa', '6799-xa-hai-hoa', 19, '2025-07-01', '{"province_code":"22","province_name":"Tỉnh Quảng Ninh"}'::jsonb),
  ('61-quang-ninh', 'phuong', '6811', 'Phường Uông Bí', '6811-phuong-uong-bi', 20, '2025-07-01', '{"province_code":"22","province_name":"Tỉnh Quảng Ninh"}'::jsonb),
  ('61-quang-ninh', 'phuong', '6820', 'Phường Vàng Danh', '6820-phuong-vang-danh', 21, '2025-07-01', '{"province_code":"22","province_name":"Tỉnh Quảng Ninh"}'::jsonb),
  ('61-quang-ninh', 'phuong', '6832', 'Phường Yên Tử', '6832-phuong-yen-tu', 22, '2025-07-01', '{"province_code":"22","province_name":"Tỉnh Quảng Ninh"}'::jsonb),
  ('61-quang-ninh', 'xa', '6838', 'Xã Bình Liêu', '6838-xa-binh-lieu', 23, '2025-07-01', '{"province_code":"22","province_name":"Tỉnh Quảng Ninh"}'::jsonb),
  ('61-quang-ninh', 'xa', '6841', 'Xã Hoành Mô', '6841-xa-hoanh-mo', 24, '2025-07-01', '{"province_code":"22","province_name":"Tỉnh Quảng Ninh"}'::jsonb),
  ('61-quang-ninh', 'xa', '6856', 'Xã Lục Hồn', '6856-xa-luc-hon', 25, '2025-07-01', '{"province_code":"22","province_name":"Tỉnh Quảng Ninh"}'::jsonb),
  ('61-quang-ninh', 'xa', '6862', 'Xã Tiên Yên', '6862-xa-tien-yen', 26, '2025-07-01', '{"province_code":"22","province_name":"Tỉnh Quảng Ninh"}'::jsonb),
  ('61-quang-ninh', 'xa', '6874', 'Xã Điền Xá', '6874-xa-dien-xa', 27, '2025-07-01', '{"province_code":"22","province_name":"Tỉnh Quảng Ninh"}'::jsonb),
  ('61-quang-ninh', 'xa', '6877', 'Xã Đông Ngũ', '6877-xa-dong-ngu', 28, '2025-07-01', '{"province_code":"22","province_name":"Tỉnh Quảng Ninh"}'::jsonb),
  ('61-quang-ninh', 'xa', '6886', 'Xã Hải Lạng', '6886-xa-hai-lang', 29, '2025-07-01', '{"province_code":"22","province_name":"Tỉnh Quảng Ninh"}'::jsonb),
  ('61-quang-ninh', 'xa', '6895', 'Xã Đầm Hà', '6895-xa-dam-ha', 30, '2025-07-01', '{"province_code":"22","province_name":"Tỉnh Quảng Ninh"}'::jsonb),
  ('61-quang-ninh', 'xa', '6913', 'Xã Quảng Tân', '6913-xa-quang-tan', 31, '2025-07-01', '{"province_code":"22","province_name":"Tỉnh Quảng Ninh"}'::jsonb),
  ('61-quang-ninh', 'xa', '6922', 'Xã Quảng Hà', '6922-xa-quang-ha', 32, '2025-07-01', '{"province_code":"22","province_name":"Tỉnh Quảng Ninh"}'::jsonb),
  ('61-quang-ninh', 'xa', '6931', 'Xã Quảng Đức', '6931-xa-quang-duc', 33, '2025-07-01', '{"province_code":"22","province_name":"Tỉnh Quảng Ninh"}'::jsonb),
  ('61-quang-ninh', 'xa', '6946', 'Xã Đường Hoa', '6946-xa-duong-hoa', 34, '2025-07-01', '{"province_code":"22","province_name":"Tỉnh Quảng Ninh"}'::jsonb),
  ('61-quang-ninh', 'xa', '6967', 'Xã Cái Chiên', '6967-xa-cai-chien', 35, '2025-07-01', '{"province_code":"22","province_name":"Tỉnh Quảng Ninh"}'::jsonb),
  ('61-quang-ninh', 'xa', '6970', 'Xã Ba Chẽ', '6970-xa-ba-che', 36, '2025-07-01', '{"province_code":"22","province_name":"Tỉnh Quảng Ninh"}'::jsonb),
  ('61-quang-ninh', 'xa', '6979', 'Xã Kỳ Thượng', '6979-xa-ky-thuong', 37, '2025-07-01', '{"province_code":"22","province_name":"Tỉnh Quảng Ninh"}'::jsonb),
  ('61-quang-ninh', 'xa', '6985', 'Xã Lương Minh', '6985-xa-luong-minh', 38, '2025-07-01', '{"province_code":"22","province_name":"Tỉnh Quảng Ninh"}'::jsonb),
  ('61-quang-ninh', 'dac_ku', '6994', 'Đặc khu Vân Đồn', '6994-dac-khu-van-don', 39, '2025-07-01', '{"province_code":"22","province_name":"Tỉnh Quảng Ninh"}'::jsonb),
  ('61-quang-ninh', 'phuong', '7030', 'Phường Hoành Bồ', '7030-phuong-hoanh-bo', 40, '2025-07-01', '{"province_code":"22","province_name":"Tỉnh Quảng Ninh"}'::jsonb),
  ('61-quang-ninh', 'xa', '7054', 'Xã Quảng La', '7054-xa-quang-la', 41, '2025-07-01', '{"province_code":"22","province_name":"Tỉnh Quảng Ninh"}'::jsonb),
  ('61-quang-ninh', 'xa', '7060', 'Xã Thống Nhất', '7060-xa-thong-nhat', 42, '2025-07-01', '{"province_code":"22","province_name":"Tỉnh Quảng Ninh"}'::jsonb),
  ('61-quang-ninh', 'phuong', '7069', 'Phường Mạo Khê', '7069-phuong-mao-khe', 43, '2025-07-01', '{"province_code":"22","province_name":"Tỉnh Quảng Ninh"}'::jsonb),
  ('61-quang-ninh', 'phuong', '7081', 'Phường Bình Khê', '7081-phuong-binh-khe', 44, '2025-07-01', '{"province_code":"22","province_name":"Tỉnh Quảng Ninh"}'::jsonb),
  ('61-quang-ninh', 'phuong', '7090', 'Phường An Sinh', '7090-phuong-an-sinh', 45, '2025-07-01', '{"province_code":"22","province_name":"Tỉnh Quảng Ninh"}'::jsonb),
  ('61-quang-ninh', 'phuong', '7093', 'Phường Đông Triều', '7093-phuong-dong-trieu', 46, '2025-07-01', '{"province_code":"22","province_name":"Tỉnh Quảng Ninh"}'::jsonb),
  ('61-quang-ninh', 'phuong', '7114', 'Phường Hoàng Quế', '7114-phuong-hoang-que', 47, '2025-07-01', '{"province_code":"22","province_name":"Tỉnh Quảng Ninh"}'::jsonb),
  ('61-quang-ninh', 'phuong', '7132', 'Phường Quảng Yên', '7132-phuong-quang-yen', 48, '2025-07-01', '{"province_code":"22","province_name":"Tỉnh Quảng Ninh"}'::jsonb),
  ('61-quang-ninh', 'phuong', '7135', 'Phường Đông Mai', '7135-phuong-dong-mai', 49, '2025-07-01', '{"province_code":"22","province_name":"Tỉnh Quảng Ninh"}'::jsonb),
  ('61-quang-ninh', 'phuong', '7147', 'Phường Hiệp Hòa', '7147-phuong-hiep-hoa', 50, '2025-07-01', '{"province_code":"22","province_name":"Tỉnh Quảng Ninh"}'::jsonb),
  ('61-quang-ninh', 'phuong', '7168', 'Phường Hà An', '7168-phuong-ha-an', 51, '2025-07-01', '{"province_code":"22","province_name":"Tỉnh Quảng Ninh"}'::jsonb),
  ('61-quang-ninh', 'phuong', '7180', 'Phường Liên Hòa', '7180-phuong-lien-hoa', 52, '2025-07-01', '{"province_code":"22","province_name":"Tỉnh Quảng Ninh"}'::jsonb),
  ('61-quang-ninh', 'phuong', '7183', 'Phường Phong Cốc', '7183-phuong-phong-coc', 53, '2025-07-01', '{"province_code":"22","province_name":"Tỉnh Quảng Ninh"}'::jsonb),
  ('61-quang-ninh', 'dac_ku', '7192', 'Đặc khu Cô Tô', '7192-dac-khu-co-to', 54, '2025-07-01', '{"province_code":"22","province_name":"Tỉnh Quảng Ninh"}'::jsonb)
) as v(parent_slug, type_code, code, name, slug, sort_order, effective_from, metadata)
join public.geo_datasets d on d.code = 'vn-admin-2025-07-01'
join public.geo_units parent on parent.dataset_id = d.id
  and parent.level_code = 'province' and parent.slug = v.parent_slug;

commit;
