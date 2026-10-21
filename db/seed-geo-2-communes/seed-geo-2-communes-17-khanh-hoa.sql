-- =============================================================================
-- NotDore - seed geo_* cấp xã: Khánh Hòa (65 đơn vị).
-- Chạy SAU db/seed-geo-1-core.sql. Có thể chạy song song với các tỉnh khác.
-- =============================================================================
begin;

insert into public.geo_units
  (dataset_id, parent_id, level_code, type_code, code, name, slug, sort_order, effective_from, metadata)
select d.id, parent.id, 'commune', v.type_code, v.code, v.name, v.slug,
       v.sort_order, v.effective_from::date, v.metadata
from (values
  ('52-khanh-hoa', 'phuong', '22333', 'Phường Bắc Nha Trang', '22333-phuong-bac-nha-trang', 1, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'phuong', '22366', 'Phường Nha Trang', '22366-phuong-nha-trang', 2, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'phuong', '22390', 'Phường Tây Nha Trang', '22390-phuong-tay-nha-trang', 3, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'phuong', '22402', 'Phường Nam Nha Trang', '22402-phuong-nam-nha-trang', 4, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'phuong', '22411', 'Phường Bắc Cam Ranh', '22411-phuong-bac-cam-ranh', 5, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'phuong', '22420', 'Phường Cam Ranh', '22420-phuong-cam-ranh', 6, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'phuong', '22423', 'Phường Ba Ngòi', '22423-phuong-ba-ngoi', 7, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'phuong', '22432', 'Phường Cam Linh', '22432-phuong-cam-linh', 8, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'xa', '22435', 'Xã Cam Hiệp', '22435-xa-cam-hiep', 9, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'xa', '22453', 'Xã Cam Lâm', '22453-xa-cam-lam', 10, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'xa', '22465', 'Xã Cam An', '22465-xa-cam-an', 11, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'xa', '22480', 'Xã Nam Cam Ranh', '22480-xa-nam-cam-ranh', 12, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'xa', '22489', 'Xã Vạn Ninh', '22489-xa-van-ninh', 13, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'xa', '22498', 'Xã Tu Bông', '22498-xa-tu-bong', 14, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'xa', '22504', 'Xã Đại Lãnh', '22504-xa-dai-lanh', 15, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'xa', '22516', 'Xã Vạn Thắng', '22516-xa-van-thang', 16, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'xa', '22525', 'Xã Vạn Hưng', '22525-xa-van-hung', 17, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'phuong', '22528', 'Phường Ninh Hòa', '22528-phuong-ninh-hoa', 18, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'xa', '22546', 'Xã Bắc Ninh Hòa', '22546-xa-bac-ninh-hoa', 19, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'xa', '22552', 'Xã Tây Ninh Hòa', '22552-xa-tay-ninh-hoa', 20, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'xa', '22558', 'Xã Hòa Trí', '22558-xa-hoa-tri', 21, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'phuong', '22561', 'Phường Đông Ninh Hòa', '22561-phuong-dong-ninh-hoa', 22, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'xa', '22576', 'Xã Tân Định', '22576-xa-tan-dinh', 23, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'phuong', '22591', 'Phường Hòa Thắng', '22591-phuong-hoa-thang', 24, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'xa', '22597', 'Xã Nam Ninh Hòa', '22597-xa-nam-ninh-hoa', 25, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'xa', '22609', 'Xã Khánh Vĩnh', '22609-xa-khanh-vinh', 26, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'xa', '22612', 'Xã Trung Khánh Vĩnh', '22612-xa-trung-khanh-vinh', 27, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'xa', '22615', 'Xã Bắc Khánh Vĩnh', '22615-xa-bac-khanh-vinh', 28, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'xa', '22624', 'Xã Tây Khánh Vĩnh', '22624-xa-tay-khanh-vinh', 29, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'xa', '22648', 'Xã Nam Khánh Vĩnh', '22648-xa-nam-khanh-vinh', 30, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'xa', '22651', 'Xã Diên Khánh', '22651-xa-dien-khanh', 31, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'xa', '22657', 'Xã Diên Điền', '22657-xa-dien-dien', 32, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'xa', '22660', 'Xã Diên Lâm', '22660-xa-dien-lam', 33, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'xa', '22672', 'Xã Diên Thọ', '22672-xa-dien-tho', 34, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'xa', '22678', 'Xã Diên Lạc', '22678-xa-dien-lac', 35, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'xa', '22702', 'Xã Suối Hiệp', '22702-xa-suoi-hiep', 36, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'xa', '22708', 'Xã Suối Dầu', '22708-xa-suoi-dau', 37, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'xa', '22714', 'Xã Khánh Sơn', '22714-xa-khanh-son', 38, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'xa', '22720', 'Xã Tây Khánh Sơn', '22720-xa-tay-khanh-son', 39, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'xa', '22732', 'Xã Đông Khánh Sơn', '22732-xa-dong-khanh-son', 40, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'dac_ku', '22736', 'Đặc khu Trường Sa', '22736-dac-khu-truong-sa', 41, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'phuong', '22738', 'Phường Đô Vinh', '22738-phuong-do-vinh', 42, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'phuong', '22741', 'Phường Bảo An', '22741-phuong-bao-an', 43, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'phuong', '22759', 'Phường Phan Rang', '22759-phuong-phan-rang', 44, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'phuong', '22780', 'Phường Đông Hải', '22780-phuong-dong-hai', 45, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'xa', '22786', 'Xã Bác Ái Tây', '22786-xa-bac-ai-tay', 46, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'xa', '22795', 'Xã Bác Ái', '22795-xa-bac-ai', 47, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'xa', '22801', 'Xã Bác Ái Đông', '22801-xa-bac-ai-dong', 48, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'xa', '22810', 'Xã Ninh Sơn', '22810-xa-ninh-son', 49, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'xa', '22813', 'Xã Lâm Sơn', '22813-xa-lam-son', 50, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'xa', '22822', 'Xã Mỹ Sơn', '22822-xa-my-son', 51, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'xa', '22828', 'Xã Anh Dũng', '22828-xa-anh-dung', 52, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'phuong', '22834', 'Phường Ninh Chử', '22834-phuong-ninh-chu', 53, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'xa', '22840', 'Xã Công Hải', '22840-xa-cong-hai', 54, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'xa', '22846', 'Xã Vĩnh Hải', '22846-xa-vinh-hai', 55, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'xa', '22849', 'Xã Thuận Bắc', '22849-xa-thuan-bac', 56, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'xa', '22852', 'Xã Ninh Hải', '22852-xa-ninh-hai', 57, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'xa', '22861', 'Xã Xuân Hải', '22861-xa-xuan-hai', 58, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'xa', '22870', 'Xã Ninh Phước', '22870-xa-ninh-phuoc', 59, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'xa', '22873', 'Xã Phước Hậu', '22873-xa-phuoc-hau', 60, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'xa', '22888', 'Xã Phước Dinh', '22888-xa-phuoc-dinh', 61, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'xa', '22891', 'Xã Phước Hữu', '22891-xa-phuoc-huu', 62, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'xa', '22897', 'Xã Thuận Nam', '22897-xa-thuan-nam', 63, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'xa', '22900', 'Xã Phước Hà', '22900-xa-phuoc-ha', 64, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb),
  ('52-khanh-hoa', 'xa', '22909', 'Xã Cà Ná', '22909-xa-ca-na', 65, '2025-07-01', '{"province_code":"56","province_name":"Tỉnh Khánh Hòa"}'::jsonb)
) as v(parent_slug, type_code, code, name, slug, sort_order, effective_from, metadata)
join public.geo_datasets d on d.code = 'vn-admin-2025-07-01'
join public.geo_units parent on parent.dataset_id = d.id
  and parent.level_code = 'province' and parent.slug = v.parent_slug;

commit;
