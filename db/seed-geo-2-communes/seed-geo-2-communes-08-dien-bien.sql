-- =============================================================================
-- NotDore - seed geo_* cấp xã: Điện Biên (45 đơn vị).
-- Chạy SAU db/seed-geo-1-core.sql. Có thể chạy song song với các tỉnh khác.
-- =============================================================================
begin;

insert into public.geo_units
  (dataset_id, parent_id, level_code, type_code, code, name, slug, sort_order, effective_from, metadata)
select d.id, parent.id, 'commune', v.type_code, v.code, v.name, v.slug,
       v.sort_order, v.effective_from::date, v.metadata
from (values
  ('43-dien-bien', 'phuong', '3127', 'Phường Điện Biên Phủ', '3127-phuong-dien-bien-phu', 1, '2025-07-01', '{"province_code":"11","province_name":"Tỉnh Điện Biên"}'::jsonb),
  ('43-dien-bien', 'phuong', '3151', 'Phường Mường Lay', '3151-phuong-muong-lay', 2, '2025-07-01', '{"province_code":"11","province_name":"Tỉnh Điện Biên"}'::jsonb),
  ('43-dien-bien', 'xa', '3158', 'Xã Sín Thầu', '3158-xa-sin-thau', 3, '2025-07-01', '{"province_code":"11","province_name":"Tỉnh Điện Biên"}'::jsonb),
  ('43-dien-bien', 'xa', '3160', 'Xã Mường Nhé', '3160-xa-muong-nhe', 4, '2025-07-01', '{"province_code":"11","province_name":"Tỉnh Điện Biên"}'::jsonb),
  ('43-dien-bien', 'xa', '3162', 'Xã Nậm Kè', '3162-xa-nam-ke', 5, '2025-07-01', '{"province_code":"11","province_name":"Tỉnh Điện Biên"}'::jsonb),
  ('43-dien-bien', 'xa', '3163', 'Xã Mường Toong', '3163-xa-muong-toong', 6, '2025-07-01', '{"province_code":"11","province_name":"Tỉnh Điện Biên"}'::jsonb),
  ('43-dien-bien', 'xa', '3164', 'Xã Quảng Lâm', '3164-xa-quang-lam', 7, '2025-07-01', '{"province_code":"11","province_name":"Tỉnh Điện Biên"}'::jsonb),
  ('43-dien-bien', 'xa', '3166', 'Xã Mường Chà', '3166-xa-muong-cha', 8, '2025-07-01', '{"province_code":"11","province_name":"Tỉnh Điện Biên"}'::jsonb),
  ('43-dien-bien', 'xa', '3169', 'Xã Nà Hỳ', '3169-xa-na-hy', 9, '2025-07-01', '{"province_code":"11","province_name":"Tỉnh Điện Biên"}'::jsonb),
  ('43-dien-bien', 'xa', '3172', 'Xã Na Sang', '3172-xa-na-sang', 10, '2025-07-01', '{"province_code":"11","province_name":"Tỉnh Điện Biên"}'::jsonb),
  ('43-dien-bien', 'xa', '3175', 'Xã Chà Tở', '3175-xa-cha-to', 11, '2025-07-01', '{"province_code":"11","province_name":"Tỉnh Điện Biên"}'::jsonb),
  ('43-dien-bien', 'xa', '3176', 'Xã Nà Bủng', '3176-xa-na-bung', 12, '2025-07-01', '{"province_code":"11","province_name":"Tỉnh Điện Biên"}'::jsonb),
  ('43-dien-bien', 'xa', '3181', 'Xã Mường Tùng', '3181-xa-muong-tung', 13, '2025-07-01', '{"province_code":"11","province_name":"Tỉnh Điện Biên"}'::jsonb),
  ('43-dien-bien', 'xa', '3193', 'Xã Pa Ham', '3193-xa-pa-ham', 14, '2025-07-01', '{"province_code":"11","province_name":"Tỉnh Điện Biên"}'::jsonb),
  ('43-dien-bien', 'xa', '3194', 'Xã Nậm Nèn', '3194-xa-nam-nen', 15, '2025-07-01', '{"province_code":"11","province_name":"Tỉnh Điện Biên"}'::jsonb),
  ('43-dien-bien', 'xa', '3199', 'Xã Si Pa Phìn', '3199-xa-si-pa-phin', 16, '2025-07-01', '{"province_code":"11","province_name":"Tỉnh Điện Biên"}'::jsonb),
  ('43-dien-bien', 'xa', '3202', 'Xã Mường Pồn', '3202-xa-muong-pon', 17, '2025-07-01', '{"province_code":"11","province_name":"Tỉnh Điện Biên"}'::jsonb),
  ('43-dien-bien', 'xa', '3203', 'Xã Na Son', '3203-xa-na-son', 18, '2025-07-01', '{"province_code":"11","province_name":"Tỉnh Điện Biên"}'::jsonb),
  ('43-dien-bien', 'xa', '3208', 'Xã Xa Dung', '3208-xa-xa-dung', 19, '2025-07-01', '{"province_code":"11","province_name":"Tỉnh Điện Biên"}'::jsonb),
  ('43-dien-bien', 'xa', '3214', 'Xã Mường Luân', '3214-xa-muong-luan', 20, '2025-07-01', '{"province_code":"11","province_name":"Tỉnh Điện Biên"}'::jsonb),
  ('43-dien-bien', 'xa', '3217', 'Xã Tủa Chùa', '3217-xa-tua-chua', 21, '2025-07-01', '{"province_code":"11","province_name":"Tỉnh Điện Biên"}'::jsonb),
  ('43-dien-bien', 'xa', '3220', 'Xã Tủa Thàng', '3220-xa-tua-thang', 22, '2025-07-01', '{"province_code":"11","province_name":"Tỉnh Điện Biên"}'::jsonb),
  ('43-dien-bien', 'xa', '3226', 'Xã Sín Chải', '3226-xa-sin-chai', 23, '2025-07-01', '{"province_code":"11","province_name":"Tỉnh Điện Biên"}'::jsonb),
  ('43-dien-bien', 'xa', '3241', 'Xã Sính Phình', '3241-xa-sinh-phinh', 24, '2025-07-01', '{"province_code":"11","province_name":"Tỉnh Điện Biên"}'::jsonb),
  ('43-dien-bien', 'xa', '3244', 'Xã Sáng Nhè', '3244-xa-sang-nhe', 25, '2025-07-01', '{"province_code":"11","province_name":"Tỉnh Điện Biên"}'::jsonb),
  ('43-dien-bien', 'xa', '3253', 'Xã Tuần Giáo', '3253-xa-tuan-giao', 26, '2025-07-01', '{"province_code":"11","province_name":"Tỉnh Điện Biên"}'::jsonb),
  ('43-dien-bien', 'xa', '3256', 'Xã Mường Ảng', '3256-xa-muong-ang', 27, '2025-07-01', '{"province_code":"11","province_name":"Tỉnh Điện Biên"}'::jsonb),
  ('43-dien-bien', 'xa', '3260', 'Xã Pú Nhung', '3260-xa-pu-nhung', 28, '2025-07-01', '{"province_code":"11","province_name":"Tỉnh Điện Biên"}'::jsonb),
  ('43-dien-bien', 'xa', '3268', 'Xã Mường Mùn', '3268-xa-muong-mun', 29, '2025-07-01', '{"province_code":"11","province_name":"Tỉnh Điện Biên"}'::jsonb),
  ('43-dien-bien', 'xa', '3283', 'Xã Chiềng Sinh', '3283-xa-chieng-sinh', 30, '2025-07-01', '{"province_code":"11","province_name":"Tỉnh Điện Biên"}'::jsonb),
  ('43-dien-bien', 'xa', '3295', 'Xã Quài Tở', '3295-xa-quai-to', 31, '2025-07-01', '{"province_code":"11","province_name":"Tỉnh Điện Biên"}'::jsonb),
  ('43-dien-bien', 'xa', '3301', 'Xã Búng Lao', '3301-xa-bung-lao', 32, '2025-07-01', '{"province_code":"11","province_name":"Tỉnh Điện Biên"}'::jsonb),
  ('43-dien-bien', 'xa', '3313', 'Xã Mường Lạn', '3313-xa-muong-lan', 33, '2025-07-01', '{"province_code":"11","province_name":"Tỉnh Điện Biên"}'::jsonb),
  ('43-dien-bien', 'xa', '3316', 'Xã Nà Tấu', '3316-xa-na-tau', 34, '2025-07-01', '{"province_code":"11","province_name":"Tỉnh Điện Biên"}'::jsonb),
  ('43-dien-bien', 'xa', '3325', 'Xã Mường Phăng', '3325-xa-muong-phang', 35, '2025-07-01', '{"province_code":"11","province_name":"Tỉnh Điện Biên"}'::jsonb),
  ('43-dien-bien', 'xa', '3328', 'Xã Thanh Nưa', '3328-xa-thanh-nua', 36, '2025-07-01', '{"province_code":"11","province_name":"Tỉnh Điện Biên"}'::jsonb),
  ('43-dien-bien', 'phuong', '3334', 'Phường Mường Thanh', '3334-phuong-muong-thanh', 37, '2025-07-01', '{"province_code":"11","province_name":"Tỉnh Điện Biên"}'::jsonb),
  ('43-dien-bien', 'xa', '3349', 'Xã Thanh Yên', '3349-xa-thanh-yen', 38, '2025-07-01', '{"province_code":"11","province_name":"Tỉnh Điện Biên"}'::jsonb),
  ('43-dien-bien', 'xa', '3352', 'Xã Thanh An', '3352-xa-thanh-an', 39, '2025-07-01', '{"province_code":"11","province_name":"Tỉnh Điện Biên"}'::jsonb),
  ('43-dien-bien', 'xa', '3356', 'Xã Sam Mứn', '3356-xa-sam-mun', 40, '2025-07-01', '{"province_code":"11","province_name":"Tỉnh Điện Biên"}'::jsonb),
  ('43-dien-bien', 'xa', '3358', 'Xã Núa Ngam', '3358-xa-nua-ngam', 41, '2025-07-01', '{"province_code":"11","province_name":"Tỉnh Điện Biên"}'::jsonb),
  ('43-dien-bien', 'xa', '3368', 'Xã Mường Nhà', '3368-xa-muong-nha', 42, '2025-07-01', '{"province_code":"11","province_name":"Tỉnh Điện Biên"}'::jsonb),
  ('43-dien-bien', 'xa', '3370', 'Xã Pu Nhi', '3370-xa-pu-nhi', 43, '2025-07-01', '{"province_code":"11","province_name":"Tỉnh Điện Biên"}'::jsonb),
  ('43-dien-bien', 'xa', '3382', 'Xã Phình Giàng', '3382-xa-phinh-giang', 44, '2025-07-01', '{"province_code":"11","province_name":"Tỉnh Điện Biên"}'::jsonb),
  ('43-dien-bien', 'xa', '3385', 'Xã Tìa Dình', '3385-xa-tia-dinh', 45, '2025-07-01', '{"province_code":"11","province_name":"Tỉnh Điện Biên"}'::jsonb)
) as v(parent_slug, type_code, code, name, slug, sort_order, effective_from, metadata)
join public.geo_datasets d on d.code = 'vn-admin-2025-07-01'
join public.geo_units parent on parent.dataset_id = d.id
  and parent.level_code = 'province' and parent.slug = v.parent_slug;

commit;
