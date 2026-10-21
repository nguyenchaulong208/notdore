-- =============================================================================
-- NotDore - seed geo_* cấp xã: Lai Châu (38 đơn vị).
-- Chạy SAU db/seed-geo-1-core.sql. Có thể chạy song song với các tỉnh khác.
-- =============================================================================
begin;

insert into public.geo_units
  (dataset_id, parent_id, level_code, type_code, code, name, slug, sort_order, effective_from, metadata)
select d.id, parent.id, 'commune', v.type_code, v.code, v.name, v.slug,
       v.sort_order, v.effective_from::date, v.metadata
from (values
  ('53-lai-chau', 'phuong', '3388', 'Phường Đoàn Kết', '3388-phuong-doan-ket', 1, '2025-07-01', '{"province_code":"12","province_name":"Tỉnh Lai Châu"}'::jsonb),
  ('53-lai-chau', 'xa', '3390', 'Xã Bình Lư', '3390-xa-binh-lu', 2, '2025-07-01', '{"province_code":"12","province_name":"Tỉnh Lai Châu"}'::jsonb),
  ('53-lai-chau', 'xa', '3394', 'Xã Sin Suối Hồ', '3394-xa-sin-suoi-ho', 3, '2025-07-01', '{"province_code":"12","province_name":"Tỉnh Lai Châu"}'::jsonb),
  ('53-lai-chau', 'xa', '3405', 'Xã Tả Lèng', '3405-xa-ta-leng', 4, '2025-07-01', '{"province_code":"12","province_name":"Tỉnh Lai Châu"}'::jsonb),
  ('53-lai-chau', 'phuong', '3408', 'Phường Tân Phong', '3408-phuong-tan-phong', 5, '2025-07-01', '{"province_code":"12","province_name":"Tỉnh Lai Châu"}'::jsonb),
  ('53-lai-chau', 'xa', '3424', 'Xã Bản Bo', '3424-xa-ban-bo', 6, '2025-07-01', '{"province_code":"12","province_name":"Tỉnh Lai Châu"}'::jsonb),
  ('53-lai-chau', 'xa', '3430', 'Xã Khun Há', '3430-xa-khun-ha', 7, '2025-07-01', '{"province_code":"12","province_name":"Tỉnh Lai Châu"}'::jsonb),
  ('53-lai-chau', 'xa', '3433', 'Xã Bum Tở', '3433-xa-bum-to', 8, '2025-07-01', '{"province_code":"12","province_name":"Tỉnh Lai Châu"}'::jsonb),
  ('53-lai-chau', 'xa', '3434', 'Xã Nậm Hàng', '3434-xa-nam-hang', 9, '2025-07-01', '{"province_code":"12","province_name":"Tỉnh Lai Châu"}'::jsonb),
  ('53-lai-chau', 'xa', '3439', 'Xã Thu Lũm', '3439-xa-thu-lum', 10, '2025-07-01', '{"province_code":"12","province_name":"Tỉnh Lai Châu"}'::jsonb),
  ('53-lai-chau', 'xa', '3442', 'Xã Pa Ủ', '3442-xa-pa-u', 11, '2025-07-01', '{"province_code":"12","province_name":"Tỉnh Lai Châu"}'::jsonb),
  ('53-lai-chau', 'xa', '3445', 'Xã Mường Tè', '3445-xa-muong-te', 12, '2025-07-01', '{"province_code":"12","province_name":"Tỉnh Lai Châu"}'::jsonb),
  ('53-lai-chau', 'xa', '3451', 'Xã Mù Cả', '3451-xa-mu-ca', 13, '2025-07-01', '{"province_code":"12","province_name":"Tỉnh Lai Châu"}'::jsonb),
  ('53-lai-chau', 'xa', '3460', 'Xã Hua Bum', '3460-xa-hua-bum', 14, '2025-07-01', '{"province_code":"12","province_name":"Tỉnh Lai Châu"}'::jsonb),
  ('53-lai-chau', 'xa', '3463', 'Xã Tà Tổng', '3463-xa-ta-tong', 15, '2025-07-01', '{"province_code":"12","province_name":"Tỉnh Lai Châu"}'::jsonb),
  ('53-lai-chau', 'xa', '3466', 'Xã Bum Nưa', '3466-xa-bum-nua', 16, '2025-07-01', '{"province_code":"12","province_name":"Tỉnh Lai Châu"}'::jsonb),
  ('53-lai-chau', 'xa', '3472', 'Xã Mường Mô', '3472-xa-muong-mo', 17, '2025-07-01', '{"province_code":"12","province_name":"Tỉnh Lai Châu"}'::jsonb),
  ('53-lai-chau', 'xa', '3478', 'Xã Sìn Hồ', '3478-xa-sin-ho', 18, '2025-07-01', '{"province_code":"12","province_name":"Tỉnh Lai Châu"}'::jsonb),
  ('53-lai-chau', 'xa', '3487', 'Xã Lê Lợi', '3487-xa-le-loi', 19, '2025-07-01', '{"province_code":"12","province_name":"Tỉnh Lai Châu"}'::jsonb),
  ('53-lai-chau', 'xa', '3503', 'Xã Pa Tần', '3503-xa-pa-tan', 20, '2025-07-01', '{"province_code":"12","province_name":"Tỉnh Lai Châu"}'::jsonb),
  ('53-lai-chau', 'xa', '3508', 'Xã Hồng Thu', '3508-xa-hong-thu', 21, '2025-07-01', '{"province_code":"12","province_name":"Tỉnh Lai Châu"}'::jsonb),
  ('53-lai-chau', 'xa', '3517', 'Xã Nậm Tăm', '3517-xa-nam-tam', 22, '2025-07-01', '{"province_code":"12","province_name":"Tỉnh Lai Châu"}'::jsonb),
  ('53-lai-chau', 'xa', '3529', 'Xã Tủa Sín Chải', '3529-xa-tua-sin-chai', 23, '2025-07-01', '{"province_code":"12","province_name":"Tỉnh Lai Châu"}'::jsonb),
  ('53-lai-chau', 'xa', '3532', 'Xã Pu Sam Cáp', '3532-xa-pu-sam-cap', 24, '2025-07-01', '{"province_code":"12","province_name":"Tỉnh Lai Châu"}'::jsonb),
  ('53-lai-chau', 'xa', '3538', 'Xã Nậm Mạ', '3538-xa-nam-ma', 25, '2025-07-01', '{"province_code":"12","province_name":"Tỉnh Lai Châu"}'::jsonb),
  ('53-lai-chau', 'xa', '3544', 'Xã Nậm Cuổi', '3544-xa-nam-cuoi', 26, '2025-07-01', '{"province_code":"12","province_name":"Tỉnh Lai Châu"}'::jsonb),
  ('53-lai-chau', 'xa', '3549', 'Xã Phong Thổ', '3549-xa-phong-tho', 27, '2025-07-01', '{"province_code":"12","province_name":"Tỉnh Lai Châu"}'::jsonb),
  ('53-lai-chau', 'xa', '3562', 'Xã Sì Lở Lầu', '3562-xa-si-lo-lau', 28, '2025-07-01', '{"province_code":"12","province_name":"Tỉnh Lai Châu"}'::jsonb),
  ('53-lai-chau', 'xa', '3571', 'Xã Dào San', '3571-xa-dao-san', 29, '2025-07-01', '{"province_code":"12","province_name":"Tỉnh Lai Châu"}'::jsonb),
  ('53-lai-chau', 'xa', '3583', 'Xã Khổng Lào', '3583-xa-khong-lao', 30, '2025-07-01', '{"province_code":"12","province_name":"Tỉnh Lai Châu"}'::jsonb),
  ('53-lai-chau', 'xa', '3595', 'Xã Than Uyên', '3595-xa-than-uyen', 31, '2025-07-01', '{"province_code":"12","province_name":"Tỉnh Lai Châu"}'::jsonb),
  ('53-lai-chau', 'xa', '3598', 'Xã Tân Uyên', '3598-xa-tan-uyen', 32, '2025-07-01', '{"province_code":"12","province_name":"Tỉnh Lai Châu"}'::jsonb),
  ('53-lai-chau', 'xa', '3601', 'Xã Mường Khoa', '3601-xa-muong-khoa', 33, '2025-07-01', '{"province_code":"12","province_name":"Tỉnh Lai Châu"}'::jsonb),
  ('53-lai-chau', 'xa', '3613', 'Xã Nậm Sỏ', '3613-xa-nam-so', 34, '2025-07-01', '{"province_code":"12","province_name":"Tỉnh Lai Châu"}'::jsonb),
  ('53-lai-chau', 'xa', '3616', 'Xã Pắc Ta', '3616-xa-pac-ta', 35, '2025-07-01', '{"province_code":"12","province_name":"Tỉnh Lai Châu"}'::jsonb),
  ('53-lai-chau', 'xa', '3618', 'Xã Mường Than', '3618-xa-muong-than', 36, '2025-07-01', '{"province_code":"12","province_name":"Tỉnh Lai Châu"}'::jsonb),
  ('53-lai-chau', 'xa', '3637', 'Xã Mường Kim', '3637-xa-muong-kim', 37, '2025-07-01', '{"province_code":"12","province_name":"Tỉnh Lai Châu"}'::jsonb),
  ('53-lai-chau', 'xa', '3640', 'Xã Khoen On', '3640-xa-khoen-on', 38, '2025-07-01', '{"province_code":"12","province_name":"Tỉnh Lai Châu"}'::jsonb)
) as v(parent_slug, type_code, code, name, slug, sort_order, effective_from, metadata)
join public.geo_datasets d on d.code = 'vn-admin-2025-07-01'
join public.geo_units parent on parent.dataset_id = d.id
  and parent.level_code = 'province' and parent.slug = v.parent_slug;

commit;
