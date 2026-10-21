-- =============================================================================
-- NotDore - seed geo_* cấp xã: Cà Mau (64 đơn vị).
-- Chạy SAU db/seed-geo-1-core.sql. Có thể chạy song song với các tỉnh khác.
-- =============================================================================
begin;

insert into public.geo_units
  (dataset_id, parent_id, level_code, type_code, code, name, slug, sort_order, effective_from, metadata)
select d.id, parent.id, 'commune', v.type_code, v.code, v.name, v.slug,
       v.sort_order, v.effective_from::date, v.metadata
from (values
  ('34-ca-mau', 'phuong', '31825', 'Phường Bạc Liêu', '31825-phuong-bac-lieu', 1, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'phuong', '31834', 'Phường Vĩnh Trạch', '31834-phuong-vinh-trach', 2, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'phuong', '31840', 'Phường Hiệp Thành', '31840-phuong-hiep-thanh', 3, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'xa', '31843', 'Xã Hồng Dân', '31843-xa-hong-dan', 4, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'xa', '31849', 'Xã Ninh Quới', '31849-xa-ninh-quoi', 5, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'xa', '31858', 'Xã Vĩnh Lộc', '31858-xa-vinh-loc', 6, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'xa', '31864', 'Xã Ninh Thạnh Lợi', '31864-xa-ninh-thanh-loi', 7, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'xa', '31867', 'Xã Phước Long', '31867-xa-phuoc-long', 8, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'xa', '31876', 'Xã Vĩnh Phước', '31876-xa-vinh-phuoc', 9, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'xa', '31882', 'Xã Vĩnh Thanh', '31882-xa-vinh-thanh', 10, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'xa', '31885', 'Xã Phong Hiệp', '31885-xa-phong-hiep', 11, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'xa', '31891', 'Xã Hòa Bình', '31891-xa-hoa-binh', 12, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'xa', '31894', 'Xã Châu Thới', '31894-xa-chau-thoi', 13, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'xa', '31900', 'Xã Vĩnh Lợi', '31900-xa-vinh-loi', 14, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'xa', '31906', 'Xã Hưng Hội', '31906-xa-hung-hoi', 15, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'xa', '31918', 'Xã Vĩnh Mỹ', '31918-xa-vinh-my', 16, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'xa', '31927', 'Xã Vĩnh Hậu', '31927-xa-vinh-hau', 17, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'phuong', '31942', 'Phường Giá Rai', '31942-phuong-gia-rai', 18, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'phuong', '31951', 'Phường Láng Tròn', '31951-phuong-lang-tron', 19, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'xa', '31957', 'Xã Phong Thạnh', '31957-xa-phong-thanh', 20, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'xa', '31972', 'Xã Gành Hào', '31972-xa-ganh-hao', 21, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'xa', '31975', 'Xã Đông Hải', '31975-xa-dong-hai', 22, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'xa', '31985', 'Xã Long Điền', '31985-xa-long-dien', 23, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'xa', '31988', 'Xã An Trạch', '31988-xa-an-trach', 24, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'xa', '31993', 'Xã Định Thành', '31993-xa-dinh-thanh', 25, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'phuong', '32002', 'Phường An Xuyên', '32002-phuong-an-xuyen', 26, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'phuong', '32014', 'Phường Lý Văn Lâm', '32014-phuong-ly-van-lam', 27, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'phuong', '32025', 'Phường Tân Thành', '32025-phuong-tan-thanh', 28, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'phuong', '32041', 'Phường Hòa Thành', '32041-phuong-hoa-thanh', 29, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'xa', '32044', 'Xã Nguyễn Phích', '32044-xa-nguyen-phich', 30, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'xa', '32047', 'Xã U Minh', '32047-xa-u-minh', 31, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'xa', '32059', 'Xã Khánh An', '32059-xa-khanh-an', 32, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'xa', '32062', 'Xã Khánh Lâm', '32062-xa-khanh-lam', 33, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'xa', '32065', 'Xã Thới Bình', '32065-xa-thoi-binh', 34, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'xa', '32069', 'Xã Biển Bạch', '32069-xa-bien-bach', 35, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'xa', '32071', 'Xã Trí Phải', '32071-xa-tri-phai', 36, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'xa', '32083', 'Xã Tân Lộc', '32083-xa-tan-loc', 37, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'xa', '32092', 'Xã Hồ Thị Kỷ', '32092-xa-ho-thi-ky', 38, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'xa', '32095', 'Xã Trần Văn Thời', '32095-xa-tran-van-thoi', 39, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'xa', '32098', 'Xã Sông Đốc', '32098-xa-song-doc', 40, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'xa', '32104', 'Xã Đá Bạc', '32104-xa-da-bac', 41, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'xa', '32110', 'Xã Khánh Bình', '32110-xa-khanh-binh', 42, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'xa', '32119', 'Xã Khánh Hưng', '32119-xa-khanh-hung', 43, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'xa', '32128', 'Xã Cái Nước', '32128-xa-cai-nuoc', 44, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'xa', '32134', 'Xã Lương Thế Trân', '32134-xa-luong-the-tran', 45, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'xa', '32137', 'Xã Tân Hưng', '32137-xa-tan-hung', 46, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'xa', '32140', 'Xã Hưng Mỹ', '32140-xa-hung-my', 47, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'xa', '32152', 'Xã Đầm Dơi', '32152-xa-dam-doi', 48, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'xa', '32155', 'Xã Tạ An Khương', '32155-xa-ta-an-khuong', 49, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'xa', '32161', 'Xã Trần Phán', '32161-xa-tran-phan', 50, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'xa', '32167', 'Xã Tân Thuận', '32167-xa-tan-thuan', 51, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'xa', '32182', 'Xã Quách Phẩm', '32182-xa-quach-pham', 52, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'xa', '32185', 'Xã Thanh Tùng', '32185-xa-thanh-tung', 53, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'xa', '32188', 'Xã Tân Tiến', '32188-xa-tan-tien', 54, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'xa', '32191', 'Xã Năm Căn', '32191-xa-nam-can', 55, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'xa', '32201', 'Xã Đất Mới', '32201-xa-dat-moi', 56, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'xa', '32206', 'Xã Tam Giang', '32206-xa-tam-giang', 57, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'xa', '32212', 'Xã Cái Đôi Vàm', '32212-xa-cai-doi-vam', 58, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'xa', '32214', 'Xã Phú Mỹ', '32214-xa-phu-my', 59, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'xa', '32218', 'Xã Phú Tân', '32218-xa-phu-tan', 60, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'xa', '32227', 'Xã Nguyễn Việt Khái', '32227-xa-nguyen-viet-khai', 61, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'xa', '32236', 'Xã Tân Ân', '32236-xa-tan-an', 62, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'xa', '32244', 'Xã Phan Ngọc Hiển', '32244-xa-phan-ngoc-hien', 63, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb),
  ('34-ca-mau', 'xa', '32248', 'Xã Đất Mũi', '32248-xa-dat-mui', 64, '2025-07-01', '{"province_code":"96","province_name":"Tỉnh Cà Mau"}'::jsonb)
) as v(parent_slug, type_code, code, name, slug, sort_order, effective_from, metadata)
join public.geo_datasets d on d.code = 'vn-admin-2025-07-01'
join public.geo_units parent on parent.dataset_id = d.id
  and parent.level_code = 'province' and parent.slug = v.parent_slug;

commit;
