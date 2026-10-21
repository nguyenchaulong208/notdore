-- =============================================================================
-- NotDore - seed geo_* cấp xã: Thành phố Huế (40 đơn vị).
-- Chạy SAU db/seed-geo-1-core.sql. Có thể chạy song song với các tỉnh khác.
-- =============================================================================
begin;

insert into public.geo_units
  (dataset_id, parent_id, level_code, type_code, code, name, slug, sort_order, effective_from, metadata)
select d.id, parent.id, 'commune', v.type_code, v.code, v.name, v.slug,
       v.sort_order, v.effective_from::date, v.metadata
from (values
  ('51-thanh-pho-hue', 'phuong', '19753', 'Phường Phú Xuân', '19753-phuong-phu-xuan', 1, '2025-07-01', '{"province_code":"46","province_name":"Thành phố Huế"}'::jsonb),
  ('51-thanh-pho-hue', 'phuong', '19774', 'Phường Kim Long', '19774-phuong-kim-long', 2, '2025-07-01', '{"province_code":"46","province_name":"Thành phố Huế"}'::jsonb),
  ('51-thanh-pho-hue', 'phuong', '19777', 'Phường Vỹ Dạ', '19777-phuong-vy-da', 3, '2025-07-01', '{"province_code":"46","province_name":"Thành phố Huế"}'::jsonb),
  ('51-thanh-pho-hue', 'phuong', '19789', 'Phường Thuận Hóa', '19789-phuong-thuan-hoa', 4, '2025-07-01', '{"province_code":"46","province_name":"Thành phố Huế"}'::jsonb),
  ('51-thanh-pho-hue', 'phuong', '19804', 'Phường Hương An', '19804-phuong-huong-an', 5, '2025-07-01', '{"province_code":"46","province_name":"Thành phố Huế"}'::jsonb),
  ('51-thanh-pho-hue', 'phuong', '19813', 'Phường Thủy Xuân', '19813-phuong-thuy-xuan', 6, '2025-07-01', '{"province_code":"46","province_name":"Thành phố Huế"}'::jsonb),
  ('51-thanh-pho-hue', 'phuong', '19815', 'Phường An Cựu', '19815-phuong-an-cuu', 7, '2025-07-01', '{"province_code":"46","province_name":"Thành phố Huế"}'::jsonb),
  ('51-thanh-pho-hue', 'phuong', '19819', 'Phường Phong Điền', '19819-phuong-phong-dien', 8, '2025-07-01', '{"province_code":"46","province_name":"Thành phố Huế"}'::jsonb),
  ('51-thanh-pho-hue', 'phuong', '19828', 'Phường Phong Phú', '19828-phuong-phong-phu', 9, '2025-07-01', '{"province_code":"46","province_name":"Thành phố Huế"}'::jsonb),
  ('51-thanh-pho-hue', 'phuong', '19831', 'Phường Phong Dinh', '19831-phuong-phong-dinh', 10, '2025-07-01', '{"province_code":"46","province_name":"Thành phố Huế"}'::jsonb),
  ('51-thanh-pho-hue', 'phuong', '19858', 'Phường Phong Thái', '19858-phuong-phong-thai', 11, '2025-07-01', '{"province_code":"46","province_name":"Thành phố Huế"}'::jsonb),
  ('51-thanh-pho-hue', 'xa', '19867', 'Xã Quảng Điền', '19867-xa-quang-dien', 12, '2025-07-01', '{"province_code":"46","province_name":"Thành phố Huế"}'::jsonb),
  ('51-thanh-pho-hue', 'phuong', '19873', 'Phường Phong Quảng', '19873-phuong-phong-quang', 13, '2025-07-01', '{"province_code":"46","province_name":"Thành phố Huế"}'::jsonb),
  ('51-thanh-pho-hue', 'xa', '19885', 'Xã Đan Điền', '19885-xa-dan-dien', 14, '2025-07-01', '{"province_code":"46","province_name":"Thành phố Huế"}'::jsonb),
  ('51-thanh-pho-hue', 'phuong', '19900', 'Phường Thuận An', '19900-phuong-thuan-an', 15, '2025-07-01', '{"province_code":"46","province_name":"Thành phố Huế"}'::jsonb),
  ('51-thanh-pho-hue', 'phuong', '19909', 'Phường Dương Nỗ', '19909-phuong-duong-no', 16, '2025-07-01', '{"province_code":"46","province_name":"Thành phố Huế"}'::jsonb),
  ('51-thanh-pho-hue', 'xa', '19918', 'Xã Phú Hồ', '19918-xa-phu-ho', 17, '2025-07-01', '{"province_code":"46","province_name":"Thành phố Huế"}'::jsonb),
  ('51-thanh-pho-hue', 'phuong', '19930', 'Phường Mỹ Thượng', '19930-phuong-my-thuong', 18, '2025-07-01', '{"province_code":"46","province_name":"Thành phố Huế"}'::jsonb),
  ('51-thanh-pho-hue', 'xa', '19942', 'Xã Phú Vang', '19942-xa-phu-vang', 19, '2025-07-01', '{"province_code":"46","province_name":"Thành phố Huế"}'::jsonb),
  ('51-thanh-pho-hue', 'xa', '19945', 'Xã Phú Vinh', '19945-xa-phu-vinh', 20, '2025-07-01', '{"province_code":"46","province_name":"Thành phố Huế"}'::jsonb),
  ('51-thanh-pho-hue', 'phuong', '19960', 'Phường Phú Bài', '19960-phuong-phu-bai', 21, '2025-07-01', '{"province_code":"46","province_name":"Thành phố Huế"}'::jsonb),
  ('51-thanh-pho-hue', 'phuong', '19969', 'Phường Thanh Thủy', '19969-phuong-thanh-thuy', 22, '2025-07-01', '{"province_code":"46","province_name":"Thành phố Huế"}'::jsonb),
  ('51-thanh-pho-hue', 'phuong', '19975', 'Phường Hương Thủy', '19975-phuong-huong-thuy', 23, '2025-07-01', '{"province_code":"46","province_name":"Thành phố Huế"}'::jsonb),
  ('51-thanh-pho-hue', 'phuong', '19996', 'Phường Hương Trà', '19996-phuong-huong-tra', 24, '2025-07-01', '{"province_code":"46","province_name":"Thành phố Huế"}'::jsonb),
  ('51-thanh-pho-hue', 'phuong', '20014', 'Phường Hóa Châu', '20014-phuong-hoa-chau', 25, '2025-07-01', '{"province_code":"46","province_name":"Thành phố Huế"}'::jsonb),
  ('51-thanh-pho-hue', 'phuong', '20017', 'Phường Kim Trà', '20017-phuong-kim-tra', 26, '2025-07-01', '{"province_code":"46","province_name":"Thành phố Huế"}'::jsonb),
  ('51-thanh-pho-hue', 'xa', '20035', 'Xã Bình Điền', '20035-xa-binh-dien', 27, '2025-07-01', '{"province_code":"46","province_name":"Thành phố Huế"}'::jsonb),
  ('51-thanh-pho-hue', 'xa', '20044', 'Xã A Lưới 2', '20044-xa-a-luoi-2', 28, '2025-07-01', '{"province_code":"46","province_name":"Thành phố Huế"}'::jsonb),
  ('51-thanh-pho-hue', 'xa', '20050', 'Xã A Lưới 5', '20050-xa-a-luoi-5', 29, '2025-07-01', '{"province_code":"46","province_name":"Thành phố Huế"}'::jsonb),
  ('51-thanh-pho-hue', 'xa', '20056', 'Xã A Lưới 1', '20056-xa-a-luoi-1', 30, '2025-07-01', '{"province_code":"46","province_name":"Thành phố Huế"}'::jsonb),
  ('51-thanh-pho-hue', 'xa', '20071', 'Xã A Lưới 3', '20071-xa-a-luoi-3', 31, '2025-07-01', '{"province_code":"46","province_name":"Thành phố Huế"}'::jsonb),
  ('51-thanh-pho-hue', 'xa', '20101', 'Xã A Lưới 4', '20101-xa-a-luoi-4', 32, '2025-07-01', '{"province_code":"46","province_name":"Thành phố Huế"}'::jsonb),
  ('51-thanh-pho-hue', 'xa', '20107', 'Xã Phú Lộc', '20107-xa-phu-loc', 33, '2025-07-01', '{"province_code":"46","province_name":"Thành phố Huế"}'::jsonb),
  ('51-thanh-pho-hue', 'xa', '20122', 'Xã Vinh Lộc', '20122-xa-vinh-loc', 34, '2025-07-01', '{"province_code":"46","province_name":"Thành phố Huế"}'::jsonb),
  ('51-thanh-pho-hue', 'xa', '20131', 'Xã Hưng Lộc', '20131-xa-hung-loc', 35, '2025-07-01', '{"province_code":"46","province_name":"Thành phố Huế"}'::jsonb),
  ('51-thanh-pho-hue', 'xa', '20137', 'Xã Chân Mây - Lăng Cô', '20137-xa-chan-may-lang-co', 36, '2025-07-01', '{"province_code":"46","province_name":"Thành phố Huế"}'::jsonb),
  ('51-thanh-pho-hue', 'xa', '20140', 'Xã Lộc An', '20140-xa-loc-an', 37, '2025-07-01', '{"province_code":"46","province_name":"Thành phố Huế"}'::jsonb),
  ('51-thanh-pho-hue', 'xa', '20161', 'Xã Khe Tre', '20161-xa-khe-tre', 38, '2025-07-01', '{"province_code":"46","province_name":"Thành phố Huế"}'::jsonb),
  ('51-thanh-pho-hue', 'xa', '20179', 'Xã Nam Đông', '20179-xa-nam-dong', 39, '2025-07-01', '{"province_code":"46","province_name":"Thành phố Huế"}'::jsonb),
  ('51-thanh-pho-hue', 'xa', '20182', 'Xã Long Quảng', '20182-xa-long-quang', 40, '2025-07-01', '{"province_code":"46","province_name":"Thành phố Huế"}'::jsonb)
) as v(parent_slug, type_code, code, name, slug, sort_order, effective_from, metadata)
join public.geo_datasets d on d.code = 'vn-admin-2025-07-01'
join public.geo_units parent on parent.dataset_id = d.id
  and parent.level_code = 'province' and parent.slug = v.parent_slug;

commit;
