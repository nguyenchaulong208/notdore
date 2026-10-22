-- =============================================================================
-- NotDore — số liệu tổng hợp xã/phường/đặc khu trước và sau sắp xếp 2025
--
-- Tệp này được sinh tự động bởi scripts/build-reform-summary-sql.mjs.
-- Nguồn dữ liệu: db/data/commune-reform-summary.json
--
-- LƯU Ý QUAN TRỌNG
--   Dữ liệu nguồn gồm SỐ LIỆU TỔNG HỢP theo 34 tỉnh/thành và TÊN 127 đơn vị
--   không thực hiện sắp xếp. 3.194 đơn vị hình thành sau sắp xếp vẫn chưa có
--   danh sách tên trước sắp xếp; muốn có đủ phải đọc riêng 34 nghị quyết
--   UBTVQH (1654–1687/NQ-UBTVQH15).
--
--   xa_truoc            : số xã ghi nhận trước sắp xếp theo nguồn
--   xa_sau              : số xã sau sắp xếp
--   phuong_sau          : số phường sau sắp xếp
--   dac_ku_sau          : số đặc khu sau sắp xếp
--   khong_thuc_hien     : số đơn vị không thực hiện sắp xếp (127)
--   unit_count_after    : xa_sau + phuong_sau + dac_ku_sau + khong_thuc_hien
--
--   127 đơn vị giữ nguyên được đối chiếu với geo_units cấp xã và cập nhật
--   metadata: reform_status=not_applied, changed=false, before_names, source_name.
--   Tên gốc trong nguồn được giữ ở source_name; 2 trường hợp khác chính tả
--   (Tuấn Đáo/Tuấn Đạo, Thuận Hòa/Thuận Hoà) được ghi chú, không sửa tên geo_units.
--
--   Bản tổng hợp trước có tong_quan.tong_xa_truoc = 3233, nhưng tổng 34 dòng
--   xa_truoc lại là 2621. Script dùng tổng theo 34 dòng và giữ nguyên ghi chú
--   về sai lệch trong metadata của dataset; không tự ý sửa số liệu nguồn.
--
-- Chạy sau db/schema-geo.sql, db/seed-geo-1-core.sql, các seed cấp xã và
-- db/seed-geo-3-relations.sql để có đủ dataset, đơn vị, văn bản và sự kiện.
-- Có thể chạy lại nhiều lần (idempotent).
-- =============================================================================

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Bảng tổng hợp (một dòng cho mỗi tỉnh/thành trong dataset hiện hành)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.geo_reform_summaries (
  id                  bigserial primary key,
  dataset_id          uuid not null references public.geo_datasets(id) on delete cascade,
  unit_id             uuid references public.geo_units(id) on delete set null,
  province_slug       text not null,
  province_code       text not null,
  province_name       text not null,
  resolution_number   text not null,
  status              text not null default 'Sắp xếp',
  communes_before     integer not null check (communes_before >= 0),
  communes_after      integer not null check (communes_after >= 0),
  wards_after         integer not null check (wards_after >= 0),
  special_zones_after integer not null check (special_zones_after >= 0),
  not_applied         integer not null check (not_applied >= 0),
  total_units_after   integer generated always as
    (communes_after + wards_after + special_zones_after + not_applied) stored,
  communes_delta      integer generated always as
    (communes_after - communes_before) stored,
  source_document_id  uuid references public.geo_documents(id) on delete set null,
  metadata            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create unique index if not exists geo_reform_summaries_dataset_name_uq
  on public.geo_reform_summaries (dataset_id, province_name);

create index if not exists idx_geo_reform_summaries_dataset
  on public.geo_reform_summaries (dataset_id);

create index if not exists idx_geo_reform_summaries_unit
  on public.geo_reform_summaries (unit_id);

drop trigger if exists trg_geo_reform_summaries_updated_at
  on public.geo_reform_summaries;
create trigger trg_geo_reform_summaries_updated_at
  before update on public.geo_reform_summaries
  for each row execute function public.set_updated_at();

alter table public.geo_reform_summaries enable row level security;

drop policy if exists "public read" on public.geo_reform_summaries;
create policy "public read" on public.geo_reform_summaries
  for select to anon, authenticated using (true);

grant select on public.geo_reform_summaries to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Upsert 34 dòng tổng hợp
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.geo_reform_summaries (
  dataset_id,
  unit_id,
  province_slug,
  province_code,
  province_name,
  resolution_number,
  status,
  communes_before,
  communes_after,
  wards_after,
  special_zones_after,
  not_applied,
  source_document_id,
  metadata
)
select
  d.id,
  u.id,
  v.province_slug,
  v.province_code,
  v.province_name,
  v.resolution_number,
  v.status,
  v.communes_before,
  v.communes_after,
  v.wards_after,
  v.special_zones_after,
  v.not_applied,
  doc.id,
  v.metadata
from (values
  ('31-an-giang', '31', 'An Giang', '1654/NQ-UBTVQH15', 'Sắp xếp', 85, 79, 14, 3, 6, '{"source_field":"danh_sach_xa_phuong_truoc_sau_sap_xep.json","note":"Số liệu tổng hợp theo tỉnh; metadata.not_applied_units chỉ chứa 127 đơn vị không thực hiện sắp xếp, không phải danh sách tên của 3.194 đơn vị còn lại.","not_applied_type":"xã","not_applied_unit_count":6,"not_applied_units":["Mỹ Hòa Hưng","Bình Giang","Bình Sơn","Hòn Nghệ","Sơn Hải","Tiên Hải"],"not_applied_unit_details":[{"source_name":"Mỹ Hòa Hưng","unit_slug":"30313-xa-my-hoa-hung","unit_name":"Xã Mỹ Hòa Hưng","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"Bình Giang","unit_slug":"30826-xa-binh-giang","unit_name":"Xã Bình Giang","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"Bình Sơn","unit_slug":"30823-xa-binh-son","unit_name":"Xã Bình Sơn","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"Hòn Nghệ","unit_slug":"30814-xa-hon-nghe","unit_name":"Xã Hòn Nghệ","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"Sơn Hải","unit_slug":"30811-xa-son-hai","unit_name":"Xã Sơn Hải","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"Tiên Hải","unit_slug":"30781-xa-tien-hai","unit_name":"Xã Tiên Hải","unit_type":"xa","match":"exact","name_variant":false}]}'::jsonb),
  ('32-bac-ninh', '32', 'Bắc Ninh', '1658/NQ-UBTVQH15', 'Sắp xếp', 66, 65, 33, 0, 1, '{"source_field":"danh_sach_xa_phuong_truoc_sau_sap_xep.json","note":"Số liệu tổng hợp theo tỉnh; metadata.not_applied_units chỉ chứa 127 đơn vị không thực hiện sắp xếp, không phải danh sách tên của 3.194 đơn vị còn lại.","not_applied_type":"xã","not_applied_unit_count":1,"not_applied_units":["Tuấn Đáo"],"not_applied_unit_details":[{"source_name":"Tuấn Đáo","unit_slug":"7663-xa-tuan-dao","unit_name":"Xã Tuấn Đạo","unit_type":"xa","match":"normalized","name_variant":true}]}'::jsonb),
  ('34-ca-mau', '34', 'Cà Mau', '1655/NQ-UBTVQH15', 'Sắp xếp', 55, 54, 9, 0, 1, '{"source_field":"danh_sach_xa_phuong_truoc_sau_sap_xep.json","note":"Số liệu tổng hợp theo tỉnh; metadata.not_applied_units chỉ chứa 127 đơn vị không thực hiện sắp xếp, không phải danh sách tên của 3.194 đơn vị còn lại.","not_applied_type":"xã","not_applied_unit_count":1,"not_applied_units":["Hồ Thị Kỷ"],"not_applied_unit_details":[{"source_name":"Hồ Thị Kỷ","unit_slug":"32092-xa-ho-thi-ky","unit_name":"Xã Hồ Thị Kỷ","unit_type":"xa","match":"exact","name_variant":false}]}'::jsonb),
  ('36-can-tho', '36', 'Cần Thơ', '1668/NQ-UBTVQH15', 'Sắp xếp', 72, 65, 30, 0, 8, '{"source_field":"danh_sach_xa_phuong_truoc_sau_sap_xep.json","note":"Số liệu tổng hợp theo tỉnh; metadata.not_applied_units chỉ chứa 127 đơn vị không thực hiện sắp xếp, không phải danh sách tên của 3.194 đơn vị còn lại.","not_applied_type":"xã/phường","not_applied_unit_count":8,"not_applied_units":["phường Tân Lộc","xã Trường Long","xã Thạnh Phú","xã Thới Hưng","xã Phong Nẫm","xã Mỹ Phước","xã Lai Hòa","xã Vĩnh Hải"],"not_applied_unit_details":[{"source_name":"phường Tân Lộc","unit_slug":"31213-phuong-tan-loc","unit_name":"Phường Tân Lộc","unit_type":"phuong","match":"exact","name_variant":false},{"source_name":"xã Trường Long","unit_slug":"31309-xa-truong-long","unit_name":"Xã Trường Long","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Thạnh Phú","unit_slug":"31249-xa-thanh-phu","unit_name":"Xã Thạnh Phú","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Thới Hưng","unit_slug":"31264-xa-thoi-hung","unit_name":"Xã Thới Hưng","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Phong Nẫm","unit_slug":"31537-xa-phong-nam","unit_name":"Xã Phong Nẫm","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Mỹ Phước","unit_slug":"31603-xa-my-phuoc","unit_name":"Xã Mỹ Phước","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Lai Hòa","unit_slug":"31810-xa-lai-hoa","unit_name":"Xã Lai Hòa","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Vĩnh Hải","unit_slug":"31795-xa-vinh-hai","unit_name":"Xã Vĩnh Hải","unit_type":"xa","match":"exact","name_variant":false}]}'::jsonb),
  ('39-cao-bang', '39', 'Cao Bằng', '1657/NQ-UBTVQH15', 'Sắp xếp', 53, 53, 3, 0, 0, '{"source_field":"danh_sach_xa_phuong_truoc_sau_sap_xep.json","note":"Số liệu tổng hợp theo tỉnh; metadata.not_applied_units chỉ chứa 127 đơn vị không thực hiện sắp xếp, không phải danh sách tên của 3.194 đơn vị còn lại.","not_applied_type":"xã","not_applied_unit_count":0,"not_applied_units":[],"not_applied_unit_details":[]}'::jsonb),
  ('40-da-nang', '40', 'Đà Nẵng', '1659/NQ-UBTVQH15', 'Sắp xếp', 70, 68, 23, 1, 2, '{"source_field":"danh_sach_xa_phuong_truoc_sau_sap_xep.json","note":"Số liệu tổng hợp theo tỉnh; metadata.not_applied_units chỉ chứa 127 đơn vị không thực hiện sắp xếp, không phải danh sách tên của 3.194 đơn vị còn lại.","not_applied_type":"xã","not_applied_unit_count":2,"not_applied_units":["Tam Hải","Tân Hiệp"],"not_applied_unit_details":[{"source_name":"Tam Hải","unit_slug":"20992-xa-tam-hai","unit_name":"Xã Tam Hải","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"Tân Hiệp","unit_slug":"20434-xa-tan-hiep","unit_name":"Xã Tân Hiệp","unit_type":"xa","match":"exact","name_variant":false}]}'::jsonb),
  ('41-dak-lak', '41', 'Đắk Lắk', '1660/NQ-UBTVQH15', 'Sắp xếp', 88, 82, 14, 0, 6, '{"source_field":"danh_sach_xa_phuong_truoc_sau_sap_xep.json","note":"Số liệu tổng hợp theo tỉnh; metadata.not_applied_units chỉ chứa 127 đơn vị không thực hiện sắp xếp, không phải danh sách tên của 3.194 đơn vị còn lại.","not_applied_type":"xã","not_applied_unit_count":6,"not_applied_units":["Ea H''Leo","Ea Trang","Ia Lốp","Ia Rvê","Krông Nô","Vụ Bổn"],"not_applied_unit_details":[{"source_name":"Ea H''Leo","unit_slug":"24184-xa-ea-h-leo","unit_name":"Xã Ea H’Leo","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"Ea Trang","unit_slug":"24445-xa-ea-trang","unit_name":"Xã Ea Trang","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"Ia Lốp","unit_slug":"24214-xa-ia-lop","unit_name":"Xã Ia Lốp","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"Ia Rvê","unit_slug":"24221-xa-ia-rve","unit_name":"Xã Ia Rvê","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"Krông Nô","unit_slug":"24604-xa-krong-no","unit_name":"Xã Krông Nô","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"Vụ Bổn","unit_slug":"24529-xa-vu-bon","unit_name":"Xã Vụ Bổn","unit_type":"xa","match":"exact","name_variant":false}]}'::jsonb),
  ('43-dien-bien', '43', 'Điện Biên', '1661/NQ-UBTVQH15', 'Sắp xếp', 42, 42, 3, 0, 0, '{"source_field":"danh_sach_xa_phuong_truoc_sau_sap_xep.json","note":"Số liệu tổng hợp theo tỉnh; metadata.not_applied_units chỉ chứa 127 đơn vị không thực hiện sắp xếp, không phải danh sách tên của 3.194 đơn vị còn lại.","not_applied_type":"xã","not_applied_unit_count":0,"not_applied_units":[],"not_applied_unit_details":[]}'::jsonb),
  ('43-dong-nai', '43', 'Đồng Nai', '1662/NQ-UBTVQH15', 'Sắp xếp', 72, 67, 21, 0, 7, '{"source_field":"danh_sach_xa_phuong_truoc_sau_sap_xep.json","note":"Số liệu tổng hợp theo tỉnh; metadata.not_applied_units chỉ chứa 127 đơn vị không thực hiện sắp xếp, không phải danh sách tên của 3.194 đơn vị còn lại.","not_applied_type":"xã/phường","not_applied_unit_count":7,"not_applied_units":["phường Phước Tân","phường Tam Phước","xã Thanh Sơn (huyện Định Quán)","xã Đak Lua","xã Phú Lý","xã Bù Gia Mập","xã Đăk Ơ"],"not_applied_unit_details":[{"source_name":"phường Phước Tân","unit_slug":"26377-phuong-phuoc-tan","unit_name":"Phường Phước Tân","unit_type":"phuong","match":"exact","name_variant":false},{"source_name":"phường Tam Phước","unit_slug":"26374-phuong-tam-phuoc","unit_name":"Phường Tam Phước","unit_type":"phuong","match":"exact","name_variant":false},{"source_name":"xã Thanh Sơn (huyện Định Quán)","unit_slug":"26209-xa-thanh-son","unit_name":"Xã Thanh Sơn","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Đak Lua","unit_slug":"26119-xa-dak-lua","unit_name":"Xã Đak Lua","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Phú Lý","unit_slug":"26173-xa-phu-ly","unit_name":"Xã Phú Lý","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Bù Gia Mập","unit_slug":"25222-xa-bu-gia-map","unit_name":"Xã Bù Gia Mập","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Đăk Ơ","unit_slug":"25225-xa-dak-o","unit_name":"Xã Đăk Ơ","unit_type":"xa","match":"exact","name_variant":false}]}'::jsonb),
  ('44-dong-thap', '44', 'Đồng Tháp', '1663/NQ-UBTVQH15', 'Sắp xếp', 82, 82, 20, 0, 0, '{"source_field":"danh_sach_xa_phuong_truoc_sau_sap_xep.json","note":"Số liệu tổng hợp theo tỉnh; metadata.not_applied_units chỉ chứa 127 đơn vị không thực hiện sắp xếp, không phải danh sách tên của 3.194 đơn vị còn lại.","not_applied_type":"xã","not_applied_unit_count":0,"not_applied_units":[],"not_applied_unit_details":[]}'::jsonb),
  ('45-gia-lai', '45', 'Gia Lai', '1664/NQ-UBTVQH15', 'Sắp xếp', 110, 101, 25, 0, 9, '{"source_field":"danh_sach_xa_phuong_truoc_sau_sap_xep.json","note":"Số liệu tổng hợp theo tỉnh; metadata.not_applied_units chỉ chứa 127 đơn vị không thực hiện sắp xếp, không phải danh sách tên của 3.194 đơn vị còn lại.","not_applied_type":"xã","not_applied_unit_count":9,"not_applied_units":["xã Ia O (huyện Ia Grai)","xã Nhơn Châu","xã Ia Púch","xã Ia Mơ","xã Ia Pnôn","xã Ia Nan","xã Ia Dom","xã Ia Chia","xã Krong"],"not_applied_unit_details":[{"source_name":"xã Ia O (huyện Ia Grai)","unit_slug":"23782-xa-ia-o","unit_name":"Xã Ia O","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Nhơn Châu","unit_slug":"21607-xa-nhon-chau","unit_name":"Xã Nhơn Châu","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Ia Púch","unit_slug":"23917-xa-ia-puch","unit_name":"Xã Ia Púch","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Ia Mơ","unit_slug":"23938-xa-ia-mo","unit_name":"Xã Ia Mơ","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Ia Pnôn","unit_slug":"23881-xa-ia-pnon","unit_name":"Xã Ia Pnôn","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Ia Nan","unit_slug":"23884-xa-ia-nan","unit_name":"Xã Ia Nan","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Ia Dom","unit_slug":"23872-xa-ia-dom","unit_name":"Xã Ia Dom","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Ia Chia","unit_slug":"23788-xa-ia-chia","unit_name":"Xã Ia Chia","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Krong","unit_slug":"23650-xa-krong","unit_name":"Xã Krong","unit_type":"xa","match":"exact","name_variant":false}]}'::jsonb),
  ('46-ha-noi', '46', 'Hà Nội', '1656/NQ-UBTVQH15', 'Sắp xếp', 75, 75, 51, 0, 0, '{"source_field":"danh_sach_xa_phuong_truoc_sau_sap_xep.json","note":"Số liệu tổng hợp theo tỉnh; metadata.not_applied_units chỉ chứa 127 đơn vị không thực hiện sắp xếp, không phải danh sách tên của 3.194 đơn vị còn lại.","not_applied_type":"xã","not_applied_unit_count":0,"not_applied_units":[],"not_applied_unit_details":[]}'::jsonb),
  ('47-ha-tinh', '47', 'Hà Tĩnh', '1665/NQ-UBTVQH15', 'Sắp xếp', 60, 58, 9, 0, 2, '{"source_field":"danh_sach_xa_phuong_truoc_sau_sap_xep.json","note":"Số liệu tổng hợp theo tỉnh; metadata.not_applied_units chỉ chứa 127 đơn vị không thực hiện sắp xếp, không phải danh sách tên của 3.194 đơn vị còn lại.","not_applied_type":"xã","not_applied_unit_count":2,"not_applied_units":["xã Sơn Kim 1","xã Sơn Kim 2"],"not_applied_unit_details":[{"source_name":"xã Sơn Kim 1","unit_slug":"18196-xa-son-kim-1","unit_name":"Xã Sơn Kim 1","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Sơn Kim 2","unit_slug":"18199-xa-son-kim-2","unit_name":"Xã Sơn Kim 2","unit_type":"xa","match":"exact","name_variant":false}]}'::jsonb),
  ('48-hai-phong', '48', 'Hải Phòng', '1669/NQ-UBTVQH15', 'Sắp xếp', 67, 67, 45, 2, 0, '{"source_field":"danh_sach_xa_phuong_truoc_sau_sap_xep.json","note":"Số liệu tổng hợp theo tỉnh; metadata.not_applied_units chỉ chứa 127 đơn vị không thực hiện sắp xếp, không phải danh sách tên của 3.194 đơn vị còn lại.","not_applied_type":"xã","not_applied_unit_count":0,"not_applied_units":[],"not_applied_unit_details":[]}'::jsonb),
  ('49-hung-yen', '49', 'Hưng Yên', '1666/NQ-UBTVQH15', 'Sắp xếp', 93, 93, 11, 0, 0, '{"source_field":"danh_sach_xa_phuong_truoc_sau_sap_xep.json","note":"Số liệu tổng hợp theo tỉnh; metadata.not_applied_units chỉ chứa 127 đơn vị không thực hiện sắp xếp, không phải danh sách tên của 3.194 đơn vị còn lại.","not_applied_type":"xã","not_applied_unit_count":0,"not_applied_units":[],"not_applied_unit_details":[]}'::jsonb),
  ('51-thanh-pho-hue', '51', 'Thành phố Huế', '1675/NQ-UBTVQH15', 'Sắp xếp', 19, 19, 20, 0, 1, '{"source_field":"danh_sach_xa_phuong_truoc_sau_sap_xep.json","note":"Số liệu tổng hợp theo tỉnh; metadata.not_applied_units chỉ chứa 127 đơn vị không thực hiện sắp xếp, không phải danh sách tên của 3.194 đơn vị còn lại.","not_applied_type":"phường","not_applied_unit_count":1,"not_applied_units":["phường Dương Nỗ"],"not_applied_unit_details":[{"source_name":"phường Dương Nỗ","unit_slug":"19909-phuong-duong-no","unit_name":"Phường Dương Nỗ","unit_type":"phuong","match":"exact","name_variant":false}]}'::jsonb),
  ('52-khanh-hoa', '52', 'Khánh Hòa', '1667/NQ-UBTVQH15', 'Sắp xếp', 48, 48, 16, 1, 0, '{"source_field":"danh_sach_xa_phuong_truoc_sau_sap_xep.json","note":"Số liệu tổng hợp theo tỉnh; metadata.not_applied_units chỉ chứa 127 đơn vị không thực hiện sắp xếp, không phải danh sách tên của 3.194 đơn vị còn lại.","not_applied_type":"xã","not_applied_unit_count":0,"not_applied_units":[],"not_applied_unit_details":[]}'::jsonb),
  ('53-lai-chau', '53', 'Lai Châu', '1670/NQ-UBTVQH15', 'Sắp xếp', 36, 34, 2, 0, 2, '{"source_field":"danh_sach_xa_phuong_truoc_sau_sap_xep.json","note":"Số liệu tổng hợp theo tỉnh; metadata.not_applied_units chỉ chứa 127 đơn vị không thực hiện sắp xếp, không phải danh sách tên của 3.194 đơn vị còn lại.","not_applied_type":"xã","not_applied_unit_count":2,"not_applied_units":["xã Mù Cả","xã Tà Tổng"],"not_applied_unit_details":[{"source_name":"xã Mù Cả","unit_slug":"3451-xa-mu-ca","unit_name":"Xã Mù Cả","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Tà Tổng","unit_slug":"3463-xa-ta-tong","unit_name":"Xã Tà Tổng","unit_type":"xa","match":"exact","name_variant":false}]}'::jsonb),
  ('54-lam-dong', '54', 'Lâm Đồng', '1671/NQ-UBTVQH15', 'Sắp xếp', 103, 99, 20, 1, 4, '{"source_field":"danh_sach_xa_phuong_truoc_sau_sap_xep.json","note":"Số liệu tổng hợp theo tỉnh; metadata.not_applied_units chỉ chứa 127 đơn vị không thực hiện sắp xếp, không phải danh sách tên của 3.194 đơn vị còn lại.","not_applied_type":"xã","not_applied_unit_count":4,"not_applied_units":["xã Quảng Hòa","xã Quảng Sơn","xã Quảng Trực","xã Ninh Gia"],"not_applied_unit_details":[{"source_name":"xã Quảng Hòa","unit_slug":"24620-xa-quang-hoa","unit_name":"Xã Quảng Hòa","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Quảng Sơn","unit_slug":"24616-xa-quang-son","unit_name":"Xã Quảng Sơn","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Quảng Trực","unit_slug":"24736-xa-quang-truc","unit_name":"Xã Quảng Trực","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Ninh Gia","unit_slug":"24985-xa-ninh-gia","unit_name":"Xã Ninh Gia","unit_type":"xa","match":"exact","name_variant":false}]}'::jsonb),
  ('55-lang-son', '55', 'Lạng Sơn', '1672/NQ-UBTVQH15', 'Sắp xếp', 61, 61, 4, 0, 0, '{"source_field":"danh_sach_xa_phuong_truoc_sau_sap_xep.json","note":"Số liệu tổng hợp theo tỉnh; metadata.not_applied_units chỉ chứa 127 đơn vị không thực hiện sắp xếp, không phải danh sách tên của 3.194 đơn vị còn lại.","not_applied_type":"xã","not_applied_unit_count":0,"not_applied_units":[],"not_applied_unit_details":[]}'::jsonb),
  ('56-lao-cai', '56', 'Lào Cai', '1673/NQ-UBTVQH15', 'Sắp xếp', 89, 81, 10, 0, 8, '{"source_field":"danh_sach_xa_phuong_truoc_sau_sap_xep.json","note":"Số liệu tổng hợp theo tỉnh; metadata.not_applied_units chỉ chứa 127 đơn vị không thực hiện sắp xếp, không phải danh sách tên của 3.194 đơn vị còn lại.","not_applied_type":"xã","not_applied_unit_count":8,"not_applied_units":["xã Nậm Xé","xã Ngũ Chỉ Sơn","xã Chế Tạo","xã Lao Chải","xã Nậm Có","xã Tà Xi Láng","xã Cát Thịnh","xã Phong Dụ Thượng"],"not_applied_unit_details":[{"source_name":"xã Nậm Xé","unit_slug":"3085-xa-nam-xe","unit_name":"Xã Nậm Xé","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Ngũ Chỉ Sơn","unit_slug":"3004-xa-ngu-chi-son","unit_name":"Xã Ngũ Chỉ Sơn","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Chế Tạo","unit_slug":"4489-xa-che-tao","unit_name":"Xã Chế Tạo","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Lao Chải","unit_slug":"4474-xa-lao-chai","unit_name":"Xã Lao Chải","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Nậm Có","unit_slug":"4462-xa-nam-co","unit_name":"Xã Nậm Có","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Tà Xi Láng","unit_slug":"4603-xa-ta-xi-lang","unit_name":"Xã Tà Xi Láng","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Cát Thịnh","unit_slug":"4693-xa-cat-thinh","unit_name":"Xã Cát Thịnh","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Phong Dụ Thượng","unit_slug":"4423-xa-phong-du-thuong","unit_name":"Xã Phong Dụ Thượng","unit_type":"xa","match":"exact","name_variant":false}]}'::jsonb),
  ('57-nghe-an', '57', 'Nghệ An', '1678/NQ-UBTVQH15', 'Sắp xếp', 119, 110, 11, 0, 9, '{"source_field":"danh_sach_xa_phuong_truoc_sau_sap_xep.json","note":"Số liệu tổng hợp theo tỉnh; metadata.not_applied_units chỉ chứa 127 đơn vị không thực hiện sắp xếp, không phải danh sách tên của 3.194 đơn vị còn lại.","not_applied_type":"xã","not_applied_unit_count":9,"not_applied_units":["xã Keng Đu","xã Mỹ Lý","xã Bắc Lý","xã Huồi Tụ","xã Mường Lống","xã Bình Chuẩn","xã Hữu Khuông","xã Lượng Minh","xã Châu Bình"],"not_applied_unit_details":[{"source_name":"xã Keng Đu","unit_slug":"16822-xa-keng-du","unit_name":"Xã Keng Đu","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Mỹ Lý","unit_slug":"16816-xa-my-ly","unit_name":"Xã Mỹ Lý","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Bắc Lý","unit_slug":"16819-xa-bac-ly","unit_name":"Xã Bắc Lý","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Huồi Tụ","unit_slug":"16828-xa-huoi-tu","unit_name":"Xã Huồi Tụ","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Mường Lống","unit_slug":"16831-xa-muong-long","unit_name":"Xã Mường Lống","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Bình Chuẩn","unit_slug":"17230-xa-binh-chuan","unit_name":"Xã Bình Chuẩn","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Hữu Khuông","unit_slug":"16885-xa-huu-khuong","unit_name":"Xã Hữu Khuông","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Lượng Minh","unit_slug":"16906-xa-luong-minh","unit_name":"Xã Lượng Minh","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Châu Bình","unit_slug":"16804-xa-chau-binh","unit_name":"Xã Châu Bình","unit_type":"xa","match":"exact","name_variant":false}]}'::jsonb),
  ('58-ninh-binh', '58', 'Ninh Bình', '1674/NQ-UBTVQH15', 'Sắp xếp', 97, 97, 32, 0, 0, '{"source_field":"danh_sach_xa_phuong_truoc_sau_sap_xep.json","note":"Số liệu tổng hợp theo tỉnh; metadata.not_applied_units chỉ chứa 127 đơn vị không thực hiện sắp xếp, không phải danh sách tên của 3.194 đơn vị còn lại.","not_applied_type":"xã","not_applied_unit_count":0,"not_applied_units":[],"not_applied_unit_details":[]}'::jsonb),
  ('59-phu-tho', '59', 'Phú Thọ', '1676/NQ-UBTVQH15', 'Sắp xếp', 133, 131, 15, 0, 2, '{"source_field":"danh_sach_xa_phuong_truoc_sau_sap_xep.json","note":"Số liệu tổng hợp theo tỉnh; metadata.not_applied_units chỉ chứa 127 đơn vị không thực hiện sắp xếp, không phải danh sách tên của 3.194 đơn vị còn lại.","not_applied_type":"xã","not_applied_unit_count":2,"not_applied_units":["xã Thu Cúc","xã Trung Sơn"],"not_applied_unit_details":[{"source_name":"xã Thu Cúc","unit_slug":"8545-xa-thu-cuc","unit_name":"Xã Thu Cúc","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Trung Sơn","unit_slug":"8311-xa-trung-son","unit_name":"Xã Trung Sơn","unit_type":"xa","match":"exact","name_variant":false}]}'::jsonb),
  ('60-quang-ngai', '60', 'Quảng Ngãi', '1677/NQ-UBTVQH15', 'Sắp xếp', 86, 81, 9, 1, 5, '{"source_field":"danh_sach_xa_phuong_truoc_sau_sap_xep.json","note":"Số liệu tổng hợp theo tỉnh; metadata.not_applied_units chỉ chứa 127 đơn vị không thực hiện sắp xếp, không phải danh sách tên của 3.194 đơn vị còn lại.","not_applied_type":"xã","not_applied_unit_count":5,"not_applied_units":["xã Đăk Long (huyện Đăk Glei)","xã Ba Xa","xã Rờ Kơi","xã Mô Rai","xã Ia Đal"],"not_applied_unit_details":[{"source_name":"xã Đăk Long (huyện Đăk Glei)","unit_slug":"23368-xa-dak-long","unit_name":"Xã Đăk Long","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Ba Xa","unit_slug":"21538-xa-ba-xa","unit_name":"Xã Ba Xa","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Rờ Kơi","unit_slug":"23530-xa-ro-koi","unit_name":"Xã Rờ Kơi","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Mô Rai","unit_slug":"23536-xa-mo-rai","unit_name":"Xã Mô Rai","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Ia Đal","unit_slug":"23535-xa-ia-dal","unit_name":"Xã Ia Đal","unit_type":"xa","match":"exact","name_variant":false}]}'::jsonb),
  ('61-quang-ninh', '61', 'Quảng Ninh', '1679/NQ-UBTVQH15', 'Sắp xếp', 22, 21, 30, 2, 1, '{"source_field":"danh_sach_xa_phuong_truoc_sau_sap_xep.json","note":"Số liệu tổng hợp theo tỉnh; metadata.not_applied_units chỉ chứa 127 đơn vị không thực hiện sắp xếp, không phải danh sách tên của 3.194 đơn vị còn lại.","not_applied_type":"xã","not_applied_unit_count":1,"not_applied_units":["xã Cái Chiên"],"not_applied_unit_details":[{"source_name":"xã Cái Chiên","unit_slug":"6967-xa-cai-chien","unit_name":"Xã Cái Chiên","unit_type":"xa","match":"exact","name_variant":false}]}'::jsonb),
  ('62-quang-tri', '62', 'Quảng Trị', '1680/NQ-UBTVQH15', 'Sắp xếp', 69, 68, 8, 1, 1, '{"source_field":"danh_sach_xa_phuong_truoc_sau_sap_xep.json","note":"Số liệu tổng hợp theo tỉnh; metadata.not_applied_units chỉ chứa 127 đơn vị không thực hiện sắp xếp, không phải danh sách tên của 3.194 đơn vị còn lại.","not_applied_type":"xã","not_applied_unit_count":1,"not_applied_units":["xã Tân Thành (huyện Minh Hóa)"],"not_applied_unit_details":[{"source_name":"xã Tân Thành (huyện Minh Hóa)","unit_slug":"18919-xa-tan-thanh","unit_name":"Xã Tân Thành","unit_type":"xa","match":"exact","name_variant":false}]}'::jsonb),
  ('63-son-la', '63', 'Sơn La', '1681/NQ-UBTVQH15', 'Sắp xếp', 67, 60, 8, 0, 7, '{"source_field":"danh_sach_xa_phuong_truoc_sau_sap_xep.json","note":"Số liệu tổng hợp theo tỉnh; metadata.not_applied_units chỉ chứa 127 đơn vị không thực hiện sắp xếp, không phải danh sách tên của 3.194 đơn vị còn lại.","not_applied_type":"xã","not_applied_unit_count":7,"not_applied_units":["xã Mường Lạn","xã Phiêng Khoài","xã Suối Tọ","xã Ngọc Chiến","xã Tân Yên","xã Mường Bám","xã Mường Lèo"],"not_applied_unit_details":[{"source_name":"xã Mường Lạn","unit_slug":"4246-xa-muong-lan","unit_name":"Xã Mường Lạn","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Phiêng Khoài","unit_slug":"4099-xa-phieng-khoai","unit_name":"Xã Phiêng Khoài","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Suối Tọ","unit_slug":"3901-xa-suoi-to","unit_name":"Xã Suối Tọ","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Ngọc Chiến","unit_slug":"3820-xa-ngoc-chien","unit_name":"Xã Ngọc Chiến","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Tân Yên","unit_slug":"3997-xa-tan-yen","unit_name":"Xã Tân Yên","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Mường Bám","unit_slug":"3760-xa-muong-bam","unit_name":"Xã Mường Bám","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Mường Lèo","unit_slug":"4240-xa-muong-leo","unit_name":"Xã Mường Lèo","unit_type":"xa","match":"exact","name_variant":false}]}'::jsonb),
  ('64-tay-ninh', '64', 'Tây Ninh', '1682/NQ-UBTVQH15', 'Sắp xếp', 82, 82, 14, 0, 0, '{"source_field":"danh_sach_xa_phuong_truoc_sau_sap_xep.json","note":"Số liệu tổng hợp theo tỉnh; metadata.not_applied_units chỉ chứa 127 đơn vị không thực hiện sắp xếp, không phải danh sách tên của 3.194 đơn vị còn lại.","not_applied_type":"xã","not_applied_unit_count":0,"not_applied_units":[],"not_applied_unit_details":[]}'::jsonb),
  ('65-thai-nguyen', '65', 'Thái Nguyên', '1683/NQ-UBTVQH15', 'Sắp xếp', 77, 75, 15, 0, 2, '{"source_field":"danh_sach_xa_phuong_truoc_sau_sap_xep.json","note":"Số liệu tổng hợp theo tỉnh; metadata.not_applied_units chỉ chứa 127 đơn vị không thực hiện sắp xếp, không phải danh sách tên của 3.194 đơn vị còn lại.","not_applied_type":"xã","not_applied_unit_count":2,"not_applied_units":["xã Sảng Mộc","xã Thượng Quan"],"not_applied_unit_details":[{"source_name":"xã Sảng Mộc","unit_slug":"5719-xa-sang-moc","unit_name":"Xã Sảng Mộc","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Thượng Quan","unit_slug":"1957-xa-thuong-quan","unit_name":"Xã Thượng Quan","unit_type":"xa","match":"exact","name_variant":false}]}'::jsonb),
  ('66-thanh-hoa', '66', 'Thanh Hóa', '1686/NQ-UBTVQH15', 'Sắp xếp', 147, 126, 19, 0, 21, '{"source_field":"danh_sach_xa_phuong_truoc_sau_sap_xep.json","note":"Số liệu tổng hợp theo tỉnh; metadata.not_applied_units chỉ chứa 127 đơn vị không thực hiện sắp xếp, không phải danh sách tên của 3.194 đơn vị còn lại.","not_applied_type":"xã","not_applied_unit_count":21,"not_applied_units":["xã Phú Xuân (huyện Quan Hóa)","xã Mường Chanh","xã Quang Chiểu","xã Tam Chung","xã Pù Nhi","xã Nhi Sơn","xã Mường Lý","xã Trung Lý","xã Trung Sơn","xã Na Mèo","xã Sơn Thủy","xã Sơn Điện","xã Mường Mìn","xã Tam Thanh","xã Yên Khương","xã Yên Thắng","xã Xuân Thái","xã Bát Mọt","xã Yên Nhân","xã Lương Sơn","xã Vạn Xuân"],"not_applied_unit_details":[{"source_name":"xã Phú Xuân (huyện Quan Hóa)","unit_slug":"14890-xa-phu-xuan","unit_name":"Xã Phú Xuân","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Mường Chanh","unit_slug":"14866-xa-muong-chanh","unit_name":"Xã Mường Chanh","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Quang Chiểu","unit_slug":"14860-xa-quang-chieu","unit_name":"Xã Quang Chiểu","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Tam Chung","unit_slug":"14848-xa-tam-chung","unit_name":"Xã Tam Chung","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Pù Nhi","unit_slug":"14863-xa-pu-nhi","unit_name":"Xã Pù Nhi","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Nhi Sơn","unit_slug":"14864-xa-nhi-son","unit_name":"Xã Nhi Sơn","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Mường Lý","unit_slug":"14854-xa-muong-ly","unit_name":"Xã Mường Lý","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Trung Lý","unit_slug":"14857-xa-trung-ly","unit_name":"Xã Trung Lý","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Trung Sơn","unit_slug":"14875-xa-trung-son","unit_name":"Xã Trung Sơn","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Na Mèo","unit_slug":"15013-xa-na-meo","unit_name":"Xã Na Mèo","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Sơn Thủy","unit_slug":"15010-xa-son-thuy","unit_name":"Xã Sơn Thủy","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Sơn Điện","unit_slug":"15022-xa-son-dien","unit_name":"Xã Sơn Điện","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Mường Mìn","unit_slug":"15025-xa-muong-min","unit_name":"Xã Mường Mìn","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Tam Thanh","unit_slug":"15007-xa-tam-thanh","unit_name":"Xã Tam Thanh","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Yên Khương","unit_slug":"15031-xa-yen-khuong","unit_name":"Xã Yên Khương","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Yên Thắng","unit_slug":"15034-xa-yen-thang","unit_name":"Xã Yên Thắng","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Xuân Thái","unit_slug":"16258-xa-xuan-thai","unit_name":"Xã Xuân Thái","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Bát Mọt","unit_slug":"15607-xa-bat-mot","unit_name":"Xã Bát Mọt","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Yên Nhân","unit_slug":"15610-xa-yen-nhan","unit_name":"Xã Yên Nhân","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Lương Sơn","unit_slug":"15628-xa-luong-son","unit_name":"Xã Lương Sơn","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Vạn Xuân","unit_slug":"15622-xa-van-xuan","unit_name":"Xã Vạn Xuân","unit_type":"xa","match":"exact","name_variant":false}]}'::jsonb),
  ('67-thanh-pho-ho-chi-minh', '67', 'Thành phố Hồ Chí Minh', '1685/NQ-UBTVQH15', 'Sắp xếp', 54, 50, 112, 1, 5, '{"source_field":"danh_sach_xa_phuong_truoc_sau_sap_xep.json","note":"Số liệu tổng hợp theo tỉnh; metadata.not_applied_units chỉ chứa 127 đơn vị không thực hiện sắp xếp, không phải danh sách tên của 3.194 đơn vị còn lại.","not_applied_type":"xã/phường","not_applied_unit_count":5,"not_applied_units":["phường Thới Hòa","xã Long Sơn","xã Hòa Hiệp","xã Bình Châu","xã Thạnh An"],"not_applied_unit_details":[{"source_name":"phường Thới Hòa","unit_slug":"25846-phuong-thoi-hoa","unit_name":"Phường Thới Hòa","unit_type":"phuong","match":"exact","name_variant":false},{"source_name":"xã Long Sơn","unit_slug":"26545-xa-long-son","unit_name":"Xã Long Sơn","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Hòa Hiệp","unit_slug":"26647-xa-hoa-hiep","unit_name":"Xã Hòa Hiệp","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Bình Châu","unit_slug":"26656-xa-binh-chau","unit_name":"Xã Bình Châu","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Thạnh An","unit_slug":"27676-xa-thanh-an","unit_name":"Xã Thạnh An","unit_type":"xa","match":"exact","name_variant":false}]}'::jsonb),
  ('68-tuyen-quang', '68', 'Tuyên Quang', '1684/NQ-UBTVQH15', 'Sắp xếp', 117, 104, 7, 0, 13, '{"source_field":"danh_sach_xa_phuong_truoc_sau_sap_xep.json","note":"Số liệu tổng hợp theo tỉnh; metadata.not_applied_units chỉ chứa 127 đơn vị không thực hiện sắp xếp, không phải danh sách tên của 3.194 đơn vị còn lại.","not_applied_type":"xã","not_applied_unit_count":13,"not_applied_units":["xã Trung Hà","xã Kiến Thiết","xã Hùng Đức","xã Minh Sơn","xã Minh Tân","xã Thuận Hòa","xã Tùng Bá","xã Thượng Sơn","xã Cao Bồ","xã Ngọc Long","xã Giáp Trung","xã Tiên Nguyên","xã Quảng Nguyên"],"not_applied_unit_details":[{"source_name":"xã Trung Hà","unit_slug":"2305-xa-trung-ha","unit_name":"Xã Trung Hà","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Kiến Thiết","unit_slug":"2437-xa-kien-thiet","unit_name":"Xã Kiến Thiết","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Hùng Đức","unit_slug":"2425-xa-hung-duc","unit_name":"Xã Hùng Đức","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Minh Sơn","unit_slug":"982-xa-minh-son","unit_name":"Xã Minh Sơn","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Minh Tân","unit_slug":"919-xa-minh-tan","unit_name":"Xã Minh Tân","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Thuận Hòa","unit_slug":"922-xa-thuan-hoa","unit_name":"Xã Thuận Hoà","unit_type":"xa","match":"normalized","name_variant":true},{"source_name":"xã Tùng Bá","unit_slug":"925-xa-tung-ba","unit_name":"Xã Tùng Bá","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Thượng Sơn","unit_slug":"958-xa-thuong-son","unit_name":"Xã Thượng Sơn","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Cao Bồ","unit_slug":"952-xa-cao-bo","unit_name":"Xã Cao Bồ","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Ngọc Long","unit_slug":"859-xa-ngoc-long","unit_name":"Xã Ngọc Long","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Giáp Trung","unit_slug":"985-xa-giap-trung","unit_name":"Xã Giáp Trung","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Tiên Nguyên","unit_slug":"1225-xa-tien-nguyen","unit_name":"Xã Tiên Nguyên","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Quảng Nguyên","unit_slug":"1144-xa-quang-nguyen","unit_name":"Xã Quảng Nguyên","unit_type":"xa","match":"exact","name_variant":false}]}'::jsonb),
  ('70-vinh-long', '70', 'Vĩnh Long', '1687/NQ-UBTVQH15', 'Sắp xếp', 105, 101, 19, 0, 4, '{"source_field":"danh_sach_xa_phuong_truoc_sau_sap_xep.json","note":"Số liệu tổng hợp theo tỉnh; metadata.not_applied_units chỉ chứa 127 đơn vị không thực hiện sắp xếp, không phải danh sách tên của 3.194 đơn vị còn lại.","not_applied_type":"xã","not_applied_unit_count":4,"not_applied_units":["xã Long Hòa (huyện Châu Thành)","xã Đông Hải","xã Long Vĩnh","xã Hòa Minh"],"not_applied_unit_details":[{"source_name":"xã Long Hòa (huyện Châu Thành)","unit_slug":"29413-xa-long-hoa","unit_name":"Xã Long Hòa","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Đông Hải","unit_slug":"29536-xa-dong-hai","unit_name":"Xã Đông Hải","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Long Vĩnh","unit_slug":"29533-xa-long-vinh","unit_name":"Xã Long Vĩnh","unit_type":"xa","match":"exact","name_variant":false},{"source_name":"xã Hòa Minh","unit_slug":"29410-xa-hoa-minh","unit_name":"Xã Hòa Minh","unit_type":"xa","match":"exact","name_variant":false}]}'::jsonb)
) as v(
  province_slug,
  province_code,
  province_name,
  resolution_number,
  status,
  communes_before,
  communes_after,
  wards_after,
  special_zones_after,
  not_applied,
  metadata
)
join public.geo_datasets d
  on d.code = 'vn-admin-2025-07-01'
left join public.geo_units u
  on u.dataset_id = d.id
 and u.level_code = 'province'
 and u.slug = v.province_slug
left join public.geo_documents doc
  on doc.document_number = v.resolution_number
on conflict (dataset_id, province_name) do update set
  unit_id             = excluded.unit_id,
  province_slug       = excluded.province_slug,
  province_code       = excluded.province_code,
  resolution_number   = excluded.resolution_number,
  status              = excluded.status,
  communes_before     = excluded.communes_before,
  communes_after      = excluded.communes_after,
  wards_after         = excluded.wards_after,
  special_zones_after = excluded.special_zones_after,
  not_applied         = excluded.not_applied,
  source_document_id  = excluded.source_document_id,
  metadata            = public.geo_reform_summaries.metadata || excluded.metadata;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Đánh dấu 127 đơn vị không thực hiện sắp xếp trên geo_units cấp xã
--    Chỉ cập nhật metadata; không đổi tên, mã hay slug của geo_units.
-- ─────────────────────────────────────────────────────────────────────────────
with not_applied(
  province_slug,
  resolution_number,
  unit_slug,
  unit_name,
  unit_type,
  source_name,
  source_type,
  match_kind,
  name_variant
) as (
  values
  ('31-an-giang', '1654/NQ-UBTVQH15', '30313-xa-my-hoa-hung', 'Xã Mỹ Hòa Hưng', 'xa', 'Mỹ Hòa Hưng', null, 'exact', false),
  ('31-an-giang', '1654/NQ-UBTVQH15', '30826-xa-binh-giang', 'Xã Bình Giang', 'xa', 'Bình Giang', null, 'exact', false),
  ('31-an-giang', '1654/NQ-UBTVQH15', '30823-xa-binh-son', 'Xã Bình Sơn', 'xa', 'Bình Sơn', null, 'exact', false),
  ('31-an-giang', '1654/NQ-UBTVQH15', '30814-xa-hon-nghe', 'Xã Hòn Nghệ', 'xa', 'Hòn Nghệ', null, 'exact', false),
  ('31-an-giang', '1654/NQ-UBTVQH15', '30811-xa-son-hai', 'Xã Sơn Hải', 'xa', 'Sơn Hải', null, 'exact', false),
  ('31-an-giang', '1654/NQ-UBTVQH15', '30781-xa-tien-hai', 'Xã Tiên Hải', 'xa', 'Tiên Hải', null, 'exact', false),
  ('32-bac-ninh', '1658/NQ-UBTVQH15', '7663-xa-tuan-dao', 'Xã Tuấn Đạo', 'xa', 'Tuấn Đáo', null, 'normalized', true),
  ('34-ca-mau', '1655/NQ-UBTVQH15', '32092-xa-ho-thi-ky', 'Xã Hồ Thị Kỷ', 'xa', 'Hồ Thị Kỷ', null, 'exact', false),
  ('36-can-tho', '1668/NQ-UBTVQH15', '31213-phuong-tan-loc', 'Phường Tân Lộc', 'phuong', 'phường Tân Lộc', 'phường', 'exact', false),
  ('36-can-tho', '1668/NQ-UBTVQH15', '31309-xa-truong-long', 'Xã Trường Long', 'xa', 'xã Trường Long', 'xã', 'exact', false),
  ('36-can-tho', '1668/NQ-UBTVQH15', '31249-xa-thanh-phu', 'Xã Thạnh Phú', 'xa', 'xã Thạnh Phú', 'xã', 'exact', false),
  ('36-can-tho', '1668/NQ-UBTVQH15', '31264-xa-thoi-hung', 'Xã Thới Hưng', 'xa', 'xã Thới Hưng', 'xã', 'exact', false),
  ('36-can-tho', '1668/NQ-UBTVQH15', '31537-xa-phong-nam', 'Xã Phong Nẫm', 'xa', 'xã Phong Nẫm', 'xã', 'exact', false),
  ('36-can-tho', '1668/NQ-UBTVQH15', '31603-xa-my-phuoc', 'Xã Mỹ Phước', 'xa', 'xã Mỹ Phước', 'xã', 'exact', false),
  ('36-can-tho', '1668/NQ-UBTVQH15', '31810-xa-lai-hoa', 'Xã Lai Hòa', 'xa', 'xã Lai Hòa', 'xã', 'exact', false),
  ('36-can-tho', '1668/NQ-UBTVQH15', '31795-xa-vinh-hai', 'Xã Vĩnh Hải', 'xa', 'xã Vĩnh Hải', 'xã', 'exact', false),
  ('40-da-nang', '1659/NQ-UBTVQH15', '20992-xa-tam-hai', 'Xã Tam Hải', 'xa', 'Tam Hải', null, 'exact', false),
  ('40-da-nang', '1659/NQ-UBTVQH15', '20434-xa-tan-hiep', 'Xã Tân Hiệp', 'xa', 'Tân Hiệp', null, 'exact', false),
  ('41-dak-lak', '1660/NQ-UBTVQH15', '24184-xa-ea-h-leo', 'Xã Ea H’Leo', 'xa', 'Ea H''Leo', null, 'exact', false),
  ('41-dak-lak', '1660/NQ-UBTVQH15', '24445-xa-ea-trang', 'Xã Ea Trang', 'xa', 'Ea Trang', null, 'exact', false),
  ('41-dak-lak', '1660/NQ-UBTVQH15', '24214-xa-ia-lop', 'Xã Ia Lốp', 'xa', 'Ia Lốp', null, 'exact', false),
  ('41-dak-lak', '1660/NQ-UBTVQH15', '24221-xa-ia-rve', 'Xã Ia Rvê', 'xa', 'Ia Rvê', null, 'exact', false),
  ('41-dak-lak', '1660/NQ-UBTVQH15', '24604-xa-krong-no', 'Xã Krông Nô', 'xa', 'Krông Nô', null, 'exact', false),
  ('41-dak-lak', '1660/NQ-UBTVQH15', '24529-xa-vu-bon', 'Xã Vụ Bổn', 'xa', 'Vụ Bổn', null, 'exact', false),
  ('43-dong-nai', '1662/NQ-UBTVQH15', '26377-phuong-phuoc-tan', 'Phường Phước Tân', 'phuong', 'phường Phước Tân', 'phường', 'exact', false),
  ('43-dong-nai', '1662/NQ-UBTVQH15', '26374-phuong-tam-phuoc', 'Phường Tam Phước', 'phuong', 'phường Tam Phước', 'phường', 'exact', false),
  ('43-dong-nai', '1662/NQ-UBTVQH15', '26209-xa-thanh-son', 'Xã Thanh Sơn', 'xa', 'xã Thanh Sơn (huyện Định Quán)', 'xã', 'exact', false),
  ('43-dong-nai', '1662/NQ-UBTVQH15', '26119-xa-dak-lua', 'Xã Đak Lua', 'xa', 'xã Đak Lua', 'xã', 'exact', false),
  ('43-dong-nai', '1662/NQ-UBTVQH15', '26173-xa-phu-ly', 'Xã Phú Lý', 'xa', 'xã Phú Lý', 'xã', 'exact', false),
  ('43-dong-nai', '1662/NQ-UBTVQH15', '25222-xa-bu-gia-map', 'Xã Bù Gia Mập', 'xa', 'xã Bù Gia Mập', 'xã', 'exact', false),
  ('43-dong-nai', '1662/NQ-UBTVQH15', '25225-xa-dak-o', 'Xã Đăk Ơ', 'xa', 'xã Đăk Ơ', 'xã', 'exact', false),
  ('45-gia-lai', '1664/NQ-UBTVQH15', '23782-xa-ia-o', 'Xã Ia O', 'xa', 'xã Ia O (huyện Ia Grai)', 'xã', 'exact', false),
  ('45-gia-lai', '1664/NQ-UBTVQH15', '21607-xa-nhon-chau', 'Xã Nhơn Châu', 'xa', 'xã Nhơn Châu', 'xã', 'exact', false),
  ('45-gia-lai', '1664/NQ-UBTVQH15', '23917-xa-ia-puch', 'Xã Ia Púch', 'xa', 'xã Ia Púch', 'xã', 'exact', false),
  ('45-gia-lai', '1664/NQ-UBTVQH15', '23938-xa-ia-mo', 'Xã Ia Mơ', 'xa', 'xã Ia Mơ', 'xã', 'exact', false),
  ('45-gia-lai', '1664/NQ-UBTVQH15', '23881-xa-ia-pnon', 'Xã Ia Pnôn', 'xa', 'xã Ia Pnôn', 'xã', 'exact', false),
  ('45-gia-lai', '1664/NQ-UBTVQH15', '23884-xa-ia-nan', 'Xã Ia Nan', 'xa', 'xã Ia Nan', 'xã', 'exact', false),
  ('45-gia-lai', '1664/NQ-UBTVQH15', '23872-xa-ia-dom', 'Xã Ia Dom', 'xa', 'xã Ia Dom', 'xã', 'exact', false),
  ('45-gia-lai', '1664/NQ-UBTVQH15', '23788-xa-ia-chia', 'Xã Ia Chia', 'xa', 'xã Ia Chia', 'xã', 'exact', false),
  ('45-gia-lai', '1664/NQ-UBTVQH15', '23650-xa-krong', 'Xã Krong', 'xa', 'xã Krong', 'xã', 'exact', false),
  ('47-ha-tinh', '1665/NQ-UBTVQH15', '18196-xa-son-kim-1', 'Xã Sơn Kim 1', 'xa', 'xã Sơn Kim 1', 'xã', 'exact', false),
  ('47-ha-tinh', '1665/NQ-UBTVQH15', '18199-xa-son-kim-2', 'Xã Sơn Kim 2', 'xa', 'xã Sơn Kim 2', 'xã', 'exact', false),
  ('51-thanh-pho-hue', '1675/NQ-UBTVQH15', '19909-phuong-duong-no', 'Phường Dương Nỗ', 'phuong', 'phường Dương Nỗ', 'phường', 'exact', false),
  ('53-lai-chau', '1670/NQ-UBTVQH15', '3451-xa-mu-ca', 'Xã Mù Cả', 'xa', 'xã Mù Cả', 'xã', 'exact', false),
  ('53-lai-chau', '1670/NQ-UBTVQH15', '3463-xa-ta-tong', 'Xã Tà Tổng', 'xa', 'xã Tà Tổng', 'xã', 'exact', false),
  ('54-lam-dong', '1671/NQ-UBTVQH15', '24620-xa-quang-hoa', 'Xã Quảng Hòa', 'xa', 'xã Quảng Hòa', 'xã', 'exact', false),
  ('54-lam-dong', '1671/NQ-UBTVQH15', '24616-xa-quang-son', 'Xã Quảng Sơn', 'xa', 'xã Quảng Sơn', 'xã', 'exact', false),
  ('54-lam-dong', '1671/NQ-UBTVQH15', '24736-xa-quang-truc', 'Xã Quảng Trực', 'xa', 'xã Quảng Trực', 'xã', 'exact', false),
  ('54-lam-dong', '1671/NQ-UBTVQH15', '24985-xa-ninh-gia', 'Xã Ninh Gia', 'xa', 'xã Ninh Gia', 'xã', 'exact', false),
  ('56-lao-cai', '1673/NQ-UBTVQH15', '3085-xa-nam-xe', 'Xã Nậm Xé', 'xa', 'xã Nậm Xé', 'xã', 'exact', false),
  ('56-lao-cai', '1673/NQ-UBTVQH15', '3004-xa-ngu-chi-son', 'Xã Ngũ Chỉ Sơn', 'xa', 'xã Ngũ Chỉ Sơn', 'xã', 'exact', false),
  ('56-lao-cai', '1673/NQ-UBTVQH15', '4489-xa-che-tao', 'Xã Chế Tạo', 'xa', 'xã Chế Tạo', 'xã', 'exact', false),
  ('56-lao-cai', '1673/NQ-UBTVQH15', '4474-xa-lao-chai', 'Xã Lao Chải', 'xa', 'xã Lao Chải', 'xã', 'exact', false),
  ('56-lao-cai', '1673/NQ-UBTVQH15', '4462-xa-nam-co', 'Xã Nậm Có', 'xa', 'xã Nậm Có', 'xã', 'exact', false),
  ('56-lao-cai', '1673/NQ-UBTVQH15', '4603-xa-ta-xi-lang', 'Xã Tà Xi Láng', 'xa', 'xã Tà Xi Láng', 'xã', 'exact', false),
  ('56-lao-cai', '1673/NQ-UBTVQH15', '4693-xa-cat-thinh', 'Xã Cát Thịnh', 'xa', 'xã Cát Thịnh', 'xã', 'exact', false),
  ('56-lao-cai', '1673/NQ-UBTVQH15', '4423-xa-phong-du-thuong', 'Xã Phong Dụ Thượng', 'xa', 'xã Phong Dụ Thượng', 'xã', 'exact', false),
  ('57-nghe-an', '1678/NQ-UBTVQH15', '16822-xa-keng-du', 'Xã Keng Đu', 'xa', 'xã Keng Đu', 'xã', 'exact', false),
  ('57-nghe-an', '1678/NQ-UBTVQH15', '16816-xa-my-ly', 'Xã Mỹ Lý', 'xa', 'xã Mỹ Lý', 'xã', 'exact', false),
  ('57-nghe-an', '1678/NQ-UBTVQH15', '16819-xa-bac-ly', 'Xã Bắc Lý', 'xa', 'xã Bắc Lý', 'xã', 'exact', false),
  ('57-nghe-an', '1678/NQ-UBTVQH15', '16828-xa-huoi-tu', 'Xã Huồi Tụ', 'xa', 'xã Huồi Tụ', 'xã', 'exact', false),
  ('57-nghe-an', '1678/NQ-UBTVQH15', '16831-xa-muong-long', 'Xã Mường Lống', 'xa', 'xã Mường Lống', 'xã', 'exact', false),
  ('57-nghe-an', '1678/NQ-UBTVQH15', '17230-xa-binh-chuan', 'Xã Bình Chuẩn', 'xa', 'xã Bình Chuẩn', 'xã', 'exact', false),
  ('57-nghe-an', '1678/NQ-UBTVQH15', '16885-xa-huu-khuong', 'Xã Hữu Khuông', 'xa', 'xã Hữu Khuông', 'xã', 'exact', false),
  ('57-nghe-an', '1678/NQ-UBTVQH15', '16906-xa-luong-minh', 'Xã Lượng Minh', 'xa', 'xã Lượng Minh', 'xã', 'exact', false),
  ('57-nghe-an', '1678/NQ-UBTVQH15', '16804-xa-chau-binh', 'Xã Châu Bình', 'xa', 'xã Châu Bình', 'xã', 'exact', false),
  ('59-phu-tho', '1676/NQ-UBTVQH15', '8545-xa-thu-cuc', 'Xã Thu Cúc', 'xa', 'xã Thu Cúc', 'xã', 'exact', false),
  ('59-phu-tho', '1676/NQ-UBTVQH15', '8311-xa-trung-son', 'Xã Trung Sơn', 'xa', 'xã Trung Sơn', 'xã', 'exact', false),
  ('60-quang-ngai', '1677/NQ-UBTVQH15', '23368-xa-dak-long', 'Xã Đăk Long', 'xa', 'xã Đăk Long (huyện Đăk Glei)', 'xã', 'exact', false),
  ('60-quang-ngai', '1677/NQ-UBTVQH15', '21538-xa-ba-xa', 'Xã Ba Xa', 'xa', 'xã Ba Xa', 'xã', 'exact', false),
  ('60-quang-ngai', '1677/NQ-UBTVQH15', '23530-xa-ro-koi', 'Xã Rờ Kơi', 'xa', 'xã Rờ Kơi', 'xã', 'exact', false),
  ('60-quang-ngai', '1677/NQ-UBTVQH15', '23536-xa-mo-rai', 'Xã Mô Rai', 'xa', 'xã Mô Rai', 'xã', 'exact', false),
  ('60-quang-ngai', '1677/NQ-UBTVQH15', '23535-xa-ia-dal', 'Xã Ia Đal', 'xa', 'xã Ia Đal', 'xã', 'exact', false),
  ('61-quang-ninh', '1679/NQ-UBTVQH15', '6967-xa-cai-chien', 'Xã Cái Chiên', 'xa', 'xã Cái Chiên', 'xã', 'exact', false),
  ('62-quang-tri', '1680/NQ-UBTVQH15', '18919-xa-tan-thanh', 'Xã Tân Thành', 'xa', 'xã Tân Thành (huyện Minh Hóa)', 'xã', 'exact', false),
  ('63-son-la', '1681/NQ-UBTVQH15', '4246-xa-muong-lan', 'Xã Mường Lạn', 'xa', 'xã Mường Lạn', 'xã', 'exact', false),
  ('63-son-la', '1681/NQ-UBTVQH15', '4099-xa-phieng-khoai', 'Xã Phiêng Khoài', 'xa', 'xã Phiêng Khoài', 'xã', 'exact', false),
  ('63-son-la', '1681/NQ-UBTVQH15', '3901-xa-suoi-to', 'Xã Suối Tọ', 'xa', 'xã Suối Tọ', 'xã', 'exact', false),
  ('63-son-la', '1681/NQ-UBTVQH15', '3820-xa-ngoc-chien', 'Xã Ngọc Chiến', 'xa', 'xã Ngọc Chiến', 'xã', 'exact', false),
  ('63-son-la', '1681/NQ-UBTVQH15', '3997-xa-tan-yen', 'Xã Tân Yên', 'xa', 'xã Tân Yên', 'xã', 'exact', false),
  ('63-son-la', '1681/NQ-UBTVQH15', '3760-xa-muong-bam', 'Xã Mường Bám', 'xa', 'xã Mường Bám', 'xã', 'exact', false),
  ('63-son-la', '1681/NQ-UBTVQH15', '4240-xa-muong-leo', 'Xã Mường Lèo', 'xa', 'xã Mường Lèo', 'xã', 'exact', false),
  ('65-thai-nguyen', '1683/NQ-UBTVQH15', '5719-xa-sang-moc', 'Xã Sảng Mộc', 'xa', 'xã Sảng Mộc', 'xã', 'exact', false),
  ('65-thai-nguyen', '1683/NQ-UBTVQH15', '1957-xa-thuong-quan', 'Xã Thượng Quan', 'xa', 'xã Thượng Quan', 'xã', 'exact', false),
  ('66-thanh-hoa', '1686/NQ-UBTVQH15', '14890-xa-phu-xuan', 'Xã Phú Xuân', 'xa', 'xã Phú Xuân (huyện Quan Hóa)', 'xã', 'exact', false),
  ('66-thanh-hoa', '1686/NQ-UBTVQH15', '14866-xa-muong-chanh', 'Xã Mường Chanh', 'xa', 'xã Mường Chanh', 'xã', 'exact', false),
  ('66-thanh-hoa', '1686/NQ-UBTVQH15', '14860-xa-quang-chieu', 'Xã Quang Chiểu', 'xa', 'xã Quang Chiểu', 'xã', 'exact', false),
  ('66-thanh-hoa', '1686/NQ-UBTVQH15', '14848-xa-tam-chung', 'Xã Tam Chung', 'xa', 'xã Tam Chung', 'xã', 'exact', false),
  ('66-thanh-hoa', '1686/NQ-UBTVQH15', '14863-xa-pu-nhi', 'Xã Pù Nhi', 'xa', 'xã Pù Nhi', 'xã', 'exact', false),
  ('66-thanh-hoa', '1686/NQ-UBTVQH15', '14864-xa-nhi-son', 'Xã Nhi Sơn', 'xa', 'xã Nhi Sơn', 'xã', 'exact', false),
  ('66-thanh-hoa', '1686/NQ-UBTVQH15', '14854-xa-muong-ly', 'Xã Mường Lý', 'xa', 'xã Mường Lý', 'xã', 'exact', false),
  ('66-thanh-hoa', '1686/NQ-UBTVQH15', '14857-xa-trung-ly', 'Xã Trung Lý', 'xa', 'xã Trung Lý', 'xã', 'exact', false),
  ('66-thanh-hoa', '1686/NQ-UBTVQH15', '14875-xa-trung-son', 'Xã Trung Sơn', 'xa', 'xã Trung Sơn', 'xã', 'exact', false),
  ('66-thanh-hoa', '1686/NQ-UBTVQH15', '15013-xa-na-meo', 'Xã Na Mèo', 'xa', 'xã Na Mèo', 'xã', 'exact', false),
  ('66-thanh-hoa', '1686/NQ-UBTVQH15', '15010-xa-son-thuy', 'Xã Sơn Thủy', 'xa', 'xã Sơn Thủy', 'xã', 'exact', false),
  ('66-thanh-hoa', '1686/NQ-UBTVQH15', '15022-xa-son-dien', 'Xã Sơn Điện', 'xa', 'xã Sơn Điện', 'xã', 'exact', false),
  ('66-thanh-hoa', '1686/NQ-UBTVQH15', '15025-xa-muong-min', 'Xã Mường Mìn', 'xa', 'xã Mường Mìn', 'xã', 'exact', false),
  ('66-thanh-hoa', '1686/NQ-UBTVQH15', '15007-xa-tam-thanh', 'Xã Tam Thanh', 'xa', 'xã Tam Thanh', 'xã', 'exact', false),
  ('66-thanh-hoa', '1686/NQ-UBTVQH15', '15031-xa-yen-khuong', 'Xã Yên Khương', 'xa', 'xã Yên Khương', 'xã', 'exact', false),
  ('66-thanh-hoa', '1686/NQ-UBTVQH15', '15034-xa-yen-thang', 'Xã Yên Thắng', 'xa', 'xã Yên Thắng', 'xã', 'exact', false),
  ('66-thanh-hoa', '1686/NQ-UBTVQH15', '16258-xa-xuan-thai', 'Xã Xuân Thái', 'xa', 'xã Xuân Thái', 'xã', 'exact', false),
  ('66-thanh-hoa', '1686/NQ-UBTVQH15', '15607-xa-bat-mot', 'Xã Bát Mọt', 'xa', 'xã Bát Mọt', 'xã', 'exact', false),
  ('66-thanh-hoa', '1686/NQ-UBTVQH15', '15610-xa-yen-nhan', 'Xã Yên Nhân', 'xa', 'xã Yên Nhân', 'xã', 'exact', false),
  ('66-thanh-hoa', '1686/NQ-UBTVQH15', '15628-xa-luong-son', 'Xã Lương Sơn', 'xa', 'xã Lương Sơn', 'xã', 'exact', false),
  ('66-thanh-hoa', '1686/NQ-UBTVQH15', '15622-xa-van-xuan', 'Xã Vạn Xuân', 'xa', 'xã Vạn Xuân', 'xã', 'exact', false),
  ('67-thanh-pho-ho-chi-minh', '1685/NQ-UBTVQH15', '25846-phuong-thoi-hoa', 'Phường Thới Hòa', 'phuong', 'phường Thới Hòa', 'phường', 'exact', false),
  ('67-thanh-pho-ho-chi-minh', '1685/NQ-UBTVQH15', '26545-xa-long-son', 'Xã Long Sơn', 'xa', 'xã Long Sơn', 'xã', 'exact', false),
  ('67-thanh-pho-ho-chi-minh', '1685/NQ-UBTVQH15', '26647-xa-hoa-hiep', 'Xã Hòa Hiệp', 'xa', 'xã Hòa Hiệp', 'xã', 'exact', false),
  ('67-thanh-pho-ho-chi-minh', '1685/NQ-UBTVQH15', '26656-xa-binh-chau', 'Xã Bình Châu', 'xa', 'xã Bình Châu', 'xã', 'exact', false),
  ('67-thanh-pho-ho-chi-minh', '1685/NQ-UBTVQH15', '27676-xa-thanh-an', 'Xã Thạnh An', 'xa', 'xã Thạnh An', 'xã', 'exact', false),
  ('68-tuyen-quang', '1684/NQ-UBTVQH15', '2305-xa-trung-ha', 'Xã Trung Hà', 'xa', 'xã Trung Hà', 'xã', 'exact', false),
  ('68-tuyen-quang', '1684/NQ-UBTVQH15', '2437-xa-kien-thiet', 'Xã Kiến Thiết', 'xa', 'xã Kiến Thiết', 'xã', 'exact', false),
  ('68-tuyen-quang', '1684/NQ-UBTVQH15', '2425-xa-hung-duc', 'Xã Hùng Đức', 'xa', 'xã Hùng Đức', 'xã', 'exact', false),
  ('68-tuyen-quang', '1684/NQ-UBTVQH15', '982-xa-minh-son', 'Xã Minh Sơn', 'xa', 'xã Minh Sơn', 'xã', 'exact', false),
  ('68-tuyen-quang', '1684/NQ-UBTVQH15', '919-xa-minh-tan', 'Xã Minh Tân', 'xa', 'xã Minh Tân', 'xã', 'exact', false),
  ('68-tuyen-quang', '1684/NQ-UBTVQH15', '922-xa-thuan-hoa', 'Xã Thuận Hoà', 'xa', 'xã Thuận Hòa', 'xã', 'normalized', true),
  ('68-tuyen-quang', '1684/NQ-UBTVQH15', '925-xa-tung-ba', 'Xã Tùng Bá', 'xa', 'xã Tùng Bá', 'xã', 'exact', false),
  ('68-tuyen-quang', '1684/NQ-UBTVQH15', '958-xa-thuong-son', 'Xã Thượng Sơn', 'xa', 'xã Thượng Sơn', 'xã', 'exact', false),
  ('68-tuyen-quang', '1684/NQ-UBTVQH15', '952-xa-cao-bo', 'Xã Cao Bồ', 'xa', 'xã Cao Bồ', 'xã', 'exact', false),
  ('68-tuyen-quang', '1684/NQ-UBTVQH15', '859-xa-ngoc-long', 'Xã Ngọc Long', 'xa', 'xã Ngọc Long', 'xã', 'exact', false),
  ('68-tuyen-quang', '1684/NQ-UBTVQH15', '985-xa-giap-trung', 'Xã Giáp Trung', 'xa', 'xã Giáp Trung', 'xã', 'exact', false),
  ('68-tuyen-quang', '1684/NQ-UBTVQH15', '1225-xa-tien-nguyen', 'Xã Tiên Nguyên', 'xa', 'xã Tiên Nguyên', 'xã', 'exact', false),
  ('68-tuyen-quang', '1684/NQ-UBTVQH15', '1144-xa-quang-nguyen', 'Xã Quảng Nguyên', 'xa', 'xã Quảng Nguyên', 'xã', 'exact', false),
  ('70-vinh-long', '1687/NQ-UBTVQH15', '29413-xa-long-hoa', 'Xã Long Hòa', 'xa', 'xã Long Hòa (huyện Châu Thành)', 'xã', 'exact', false),
  ('70-vinh-long', '1687/NQ-UBTVQH15', '29536-xa-dong-hai', 'Xã Đông Hải', 'xa', 'xã Đông Hải', 'xã', 'exact', false),
  ('70-vinh-long', '1687/NQ-UBTVQH15', '29533-xa-long-vinh', 'Xã Long Vĩnh', 'xa', 'xã Long Vĩnh', 'xã', 'exact', false),
  ('70-vinh-long', '1687/NQ-UBTVQH15', '29410-xa-hoa-minh', 'Xã Hòa Minh', 'xa', 'xã Hòa Minh', 'xã', 'exact', false)
),
matched as (
  select
    u.id,
    u.name,
    v.province_slug,
    v.resolution_number,
    v.unit_slug,
    v.unit_name,
    v.unit_type,
    v.source_name,
    v.source_type,
    v.match_kind,
    v.name_variant
  from public.geo_units u
  join public.geo_datasets d
    on d.id = u.dataset_id
   and d.code = 'vn-admin-2025-07-01'
  join not_applied v
    on v.unit_slug = u.slug
  where u.level_code = 'commune'
)
update public.geo_units u
set metadata = u.metadata || jsonb_build_object(
  'reform_status', 'not_applied',
  'not_applied', true,
  'changed', false,
  'before_names', jsonb_build_array(
    regexp_replace(m.name, '^(Xã|Phường|Đặc khu|Thị trấn)\s+', '', 'i')
  ),
  'before_note', 'Không thực hiện sắp xếp theo ' || m.resolution_number || '.',
  'note', 'Không thực hiện sắp xếp theo ' || m.resolution_number || '.' ||
    case when m.name_variant then
      ' Nguồn ghi "' || m.source_name || '", đơn vị hiện hành là "' || m.name || '".'
    else '' end,
  'source_resolution', m.resolution_number,
  'source_effective_date', '2025-07-01',
  'source_name', m.source_name,
  'source_type', m.source_type,
  'source_match', m.match_kind,
  'source_name_variant', m.name_variant,
  'source_unit_type', m.unit_type
)
from matched m
where u.id = m.id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Đồng bộ các chỉ số per-tỉnh trong geo_unit_metrics
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.geo_unit_metrics (
  unit_id,
  metric_code,
  value,
  source_document_id,
  metadata
)
select
  u.id,
  m.metric_code,
  m.value,
  doc.id,
  m.metadata
from (values
  ('31-an-giang', 'commune_count_before', 85, '202/2025/QH15', '{"source_field":"xa_truoc","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('31-an-giang', 'commune_count', 79, '1654/NQ-UBTVQH15', '{"source_field":"xa_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('31-an-giang', 'ward_count', 14, '1654/NQ-UBTVQH15', '{"source_field":"phuong_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('31-an-giang', 'special_zone_count', 3, '1654/NQ-UBTVQH15', '{"source_field":"dac_ku_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('31-an-giang', 'not_applied_count', 6, '1654/NQ-UBTVQH15', '{"source_field":"khong_thuc_hien","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('31-an-giang', 'unit_count_after', 102, '1654/NQ-UBTVQH15', '{"source_field":"unit_count_after","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('32-bac-ninh', 'commune_count_before', 66, '202/2025/QH15', '{"source_field":"xa_truoc","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('32-bac-ninh', 'commune_count', 65, '1658/NQ-UBTVQH15', '{"source_field":"xa_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('32-bac-ninh', 'ward_count', 33, '1658/NQ-UBTVQH15', '{"source_field":"phuong_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('32-bac-ninh', 'special_zone_count', 0, '1658/NQ-UBTVQH15', '{"source_field":"dac_ku_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('32-bac-ninh', 'not_applied_count', 1, '1658/NQ-UBTVQH15', '{"source_field":"khong_thuc_hien","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('32-bac-ninh', 'unit_count_after', 99, '1658/NQ-UBTVQH15', '{"source_field":"unit_count_after","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('34-ca-mau', 'commune_count_before', 55, '202/2025/QH15', '{"source_field":"xa_truoc","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('34-ca-mau', 'commune_count', 54, '1655/NQ-UBTVQH15', '{"source_field":"xa_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('34-ca-mau', 'ward_count', 9, '1655/NQ-UBTVQH15', '{"source_field":"phuong_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('34-ca-mau', 'special_zone_count', 0, '1655/NQ-UBTVQH15', '{"source_field":"dac_ku_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('34-ca-mau', 'not_applied_count', 1, '1655/NQ-UBTVQH15', '{"source_field":"khong_thuc_hien","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('34-ca-mau', 'unit_count_after', 64, '1655/NQ-UBTVQH15', '{"source_field":"unit_count_after","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('36-can-tho', 'commune_count_before', 72, '202/2025/QH15', '{"source_field":"xa_truoc","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('36-can-tho', 'commune_count', 65, '1668/NQ-UBTVQH15', '{"source_field":"xa_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('36-can-tho', 'ward_count', 30, '1668/NQ-UBTVQH15', '{"source_field":"phuong_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('36-can-tho', 'special_zone_count', 0, '1668/NQ-UBTVQH15', '{"source_field":"dac_ku_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('36-can-tho', 'not_applied_count', 8, '1668/NQ-UBTVQH15', '{"source_field":"khong_thuc_hien","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('36-can-tho', 'unit_count_after', 103, '1668/NQ-UBTVQH15', '{"source_field":"unit_count_after","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('39-cao-bang', 'commune_count_before', 53, '202/2025/QH15', '{"source_field":"xa_truoc","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('39-cao-bang', 'commune_count', 53, '1657/NQ-UBTVQH15', '{"source_field":"xa_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('39-cao-bang', 'ward_count', 3, '1657/NQ-UBTVQH15', '{"source_field":"phuong_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('39-cao-bang', 'special_zone_count', 0, '1657/NQ-UBTVQH15', '{"source_field":"dac_ku_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('39-cao-bang', 'not_applied_count', 0, '1657/NQ-UBTVQH15', '{"source_field":"khong_thuc_hien","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('39-cao-bang', 'unit_count_after', 56, '1657/NQ-UBTVQH15', '{"source_field":"unit_count_after","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('40-da-nang', 'commune_count_before', 70, '202/2025/QH15', '{"source_field":"xa_truoc","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('40-da-nang', 'commune_count', 68, '1659/NQ-UBTVQH15', '{"source_field":"xa_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('40-da-nang', 'ward_count', 23, '1659/NQ-UBTVQH15', '{"source_field":"phuong_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('40-da-nang', 'special_zone_count', 1, '1659/NQ-UBTVQH15', '{"source_field":"dac_ku_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('40-da-nang', 'not_applied_count', 2, '1659/NQ-UBTVQH15', '{"source_field":"khong_thuc_hien","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('40-da-nang', 'unit_count_after', 94, '1659/NQ-UBTVQH15', '{"source_field":"unit_count_after","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('41-dak-lak', 'commune_count_before', 88, '202/2025/QH15', '{"source_field":"xa_truoc","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('41-dak-lak', 'commune_count', 82, '1660/NQ-UBTVQH15', '{"source_field":"xa_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('41-dak-lak', 'ward_count', 14, '1660/NQ-UBTVQH15', '{"source_field":"phuong_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('41-dak-lak', 'special_zone_count', 0, '1660/NQ-UBTVQH15', '{"source_field":"dac_ku_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('41-dak-lak', 'not_applied_count', 6, '1660/NQ-UBTVQH15', '{"source_field":"khong_thuc_hien","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('41-dak-lak', 'unit_count_after', 102, '1660/NQ-UBTVQH15', '{"source_field":"unit_count_after","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('43-dien-bien', 'commune_count_before', 42, '202/2025/QH15', '{"source_field":"xa_truoc","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('43-dien-bien', 'commune_count', 42, '1661/NQ-UBTVQH15', '{"source_field":"xa_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('43-dien-bien', 'ward_count', 3, '1661/NQ-UBTVQH15', '{"source_field":"phuong_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('43-dien-bien', 'special_zone_count', 0, '1661/NQ-UBTVQH15', '{"source_field":"dac_ku_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('43-dien-bien', 'not_applied_count', 0, '1661/NQ-UBTVQH15', '{"source_field":"khong_thuc_hien","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('43-dien-bien', 'unit_count_after', 45, '1661/NQ-UBTVQH15', '{"source_field":"unit_count_after","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('43-dong-nai', 'commune_count_before', 72, '202/2025/QH15', '{"source_field":"xa_truoc","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('43-dong-nai', 'commune_count', 67, '1662/NQ-UBTVQH15', '{"source_field":"xa_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('43-dong-nai', 'ward_count', 21, '1662/NQ-UBTVQH15', '{"source_field":"phuong_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('43-dong-nai', 'special_zone_count', 0, '1662/NQ-UBTVQH15', '{"source_field":"dac_ku_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('43-dong-nai', 'not_applied_count', 7, '1662/NQ-UBTVQH15', '{"source_field":"khong_thuc_hien","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('43-dong-nai', 'unit_count_after', 95, '1662/NQ-UBTVQH15', '{"source_field":"unit_count_after","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('44-dong-thap', 'commune_count_before', 82, '202/2025/QH15', '{"source_field":"xa_truoc","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('44-dong-thap', 'commune_count', 82, '1663/NQ-UBTVQH15', '{"source_field":"xa_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('44-dong-thap', 'ward_count', 20, '1663/NQ-UBTVQH15', '{"source_field":"phuong_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('44-dong-thap', 'special_zone_count', 0, '1663/NQ-UBTVQH15', '{"source_field":"dac_ku_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('44-dong-thap', 'not_applied_count', 0, '1663/NQ-UBTVQH15', '{"source_field":"khong_thuc_hien","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('44-dong-thap', 'unit_count_after', 102, '1663/NQ-UBTVQH15', '{"source_field":"unit_count_after","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('45-gia-lai', 'commune_count_before', 110, '202/2025/QH15', '{"source_field":"xa_truoc","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('45-gia-lai', 'commune_count', 101, '1664/NQ-UBTVQH15', '{"source_field":"xa_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('45-gia-lai', 'ward_count', 25, '1664/NQ-UBTVQH15', '{"source_field":"phuong_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('45-gia-lai', 'special_zone_count', 0, '1664/NQ-UBTVQH15', '{"source_field":"dac_ku_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('45-gia-lai', 'not_applied_count', 9, '1664/NQ-UBTVQH15', '{"source_field":"khong_thuc_hien","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('45-gia-lai', 'unit_count_after', 135, '1664/NQ-UBTVQH15', '{"source_field":"unit_count_after","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('46-ha-noi', 'commune_count_before', 75, '202/2025/QH15', '{"source_field":"xa_truoc","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('46-ha-noi', 'commune_count', 75, '1656/NQ-UBTVQH15', '{"source_field":"xa_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('46-ha-noi', 'ward_count', 51, '1656/NQ-UBTVQH15', '{"source_field":"phuong_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('46-ha-noi', 'special_zone_count', 0, '1656/NQ-UBTVQH15', '{"source_field":"dac_ku_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('46-ha-noi', 'not_applied_count', 0, '1656/NQ-UBTVQH15', '{"source_field":"khong_thuc_hien","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('46-ha-noi', 'unit_count_after', 126, '1656/NQ-UBTVQH15', '{"source_field":"unit_count_after","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('47-ha-tinh', 'commune_count_before', 60, '202/2025/QH15', '{"source_field":"xa_truoc","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('47-ha-tinh', 'commune_count', 58, '1665/NQ-UBTVQH15', '{"source_field":"xa_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('47-ha-tinh', 'ward_count', 9, '1665/NQ-UBTVQH15', '{"source_field":"phuong_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('47-ha-tinh', 'special_zone_count', 0, '1665/NQ-UBTVQH15', '{"source_field":"dac_ku_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('47-ha-tinh', 'not_applied_count', 2, '1665/NQ-UBTVQH15', '{"source_field":"khong_thuc_hien","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('47-ha-tinh', 'unit_count_after', 69, '1665/NQ-UBTVQH15', '{"source_field":"unit_count_after","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('48-hai-phong', 'commune_count_before', 67, '202/2025/QH15', '{"source_field":"xa_truoc","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('48-hai-phong', 'commune_count', 67, '1669/NQ-UBTVQH15', '{"source_field":"xa_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('48-hai-phong', 'ward_count', 45, '1669/NQ-UBTVQH15', '{"source_field":"phuong_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('48-hai-phong', 'special_zone_count', 2, '1669/NQ-UBTVQH15', '{"source_field":"dac_ku_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('48-hai-phong', 'not_applied_count', 0, '1669/NQ-UBTVQH15', '{"source_field":"khong_thuc_hien","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('48-hai-phong', 'unit_count_after', 114, '1669/NQ-UBTVQH15', '{"source_field":"unit_count_after","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('49-hung-yen', 'commune_count_before', 93, '202/2025/QH15', '{"source_field":"xa_truoc","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('49-hung-yen', 'commune_count', 93, '1666/NQ-UBTVQH15', '{"source_field":"xa_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('49-hung-yen', 'ward_count', 11, '1666/NQ-UBTVQH15', '{"source_field":"phuong_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('49-hung-yen', 'special_zone_count', 0, '1666/NQ-UBTVQH15', '{"source_field":"dac_ku_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('49-hung-yen', 'not_applied_count', 0, '1666/NQ-UBTVQH15', '{"source_field":"khong_thuc_hien","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('49-hung-yen', 'unit_count_after', 104, '1666/NQ-UBTVQH15', '{"source_field":"unit_count_after","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('51-thanh-pho-hue', 'commune_count_before', 19, '202/2025/QH15', '{"source_field":"xa_truoc","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('51-thanh-pho-hue', 'commune_count', 19, '1675/NQ-UBTVQH15', '{"source_field":"xa_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('51-thanh-pho-hue', 'ward_count', 20, '1675/NQ-UBTVQH15', '{"source_field":"phuong_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('51-thanh-pho-hue', 'special_zone_count', 0, '1675/NQ-UBTVQH15', '{"source_field":"dac_ku_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('51-thanh-pho-hue', 'not_applied_count', 1, '1675/NQ-UBTVQH15', '{"source_field":"khong_thuc_hien","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('51-thanh-pho-hue', 'unit_count_after', 40, '1675/NQ-UBTVQH15', '{"source_field":"unit_count_after","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('52-khanh-hoa', 'commune_count_before', 48, '202/2025/QH15', '{"source_field":"xa_truoc","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('52-khanh-hoa', 'commune_count', 48, '1667/NQ-UBTVQH15', '{"source_field":"xa_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('52-khanh-hoa', 'ward_count', 16, '1667/NQ-UBTVQH15', '{"source_field":"phuong_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('52-khanh-hoa', 'special_zone_count', 1, '1667/NQ-UBTVQH15', '{"source_field":"dac_ku_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('52-khanh-hoa', 'not_applied_count', 0, '1667/NQ-UBTVQH15', '{"source_field":"khong_thuc_hien","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('52-khanh-hoa', 'unit_count_after', 65, '1667/NQ-UBTVQH15', '{"source_field":"unit_count_after","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('53-lai-chau', 'commune_count_before', 36, '202/2025/QH15', '{"source_field":"xa_truoc","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('53-lai-chau', 'commune_count', 34, '1670/NQ-UBTVQH15', '{"source_field":"xa_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('53-lai-chau', 'ward_count', 2, '1670/NQ-UBTVQH15', '{"source_field":"phuong_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('53-lai-chau', 'special_zone_count', 0, '1670/NQ-UBTVQH15', '{"source_field":"dac_ku_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('53-lai-chau', 'not_applied_count', 2, '1670/NQ-UBTVQH15', '{"source_field":"khong_thuc_hien","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('53-lai-chau', 'unit_count_after', 38, '1670/NQ-UBTVQH15', '{"source_field":"unit_count_after","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('54-lam-dong', 'commune_count_before', 103, '202/2025/QH15', '{"source_field":"xa_truoc","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('54-lam-dong', 'commune_count', 99, '1671/NQ-UBTVQH15', '{"source_field":"xa_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('54-lam-dong', 'ward_count', 20, '1671/NQ-UBTVQH15', '{"source_field":"phuong_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('54-lam-dong', 'special_zone_count', 1, '1671/NQ-UBTVQH15', '{"source_field":"dac_ku_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('54-lam-dong', 'not_applied_count', 4, '1671/NQ-UBTVQH15', '{"source_field":"khong_thuc_hien","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('54-lam-dong', 'unit_count_after', 124, '1671/NQ-UBTVQH15', '{"source_field":"unit_count_after","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('55-lang-son', 'commune_count_before', 61, '202/2025/QH15', '{"source_field":"xa_truoc","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('55-lang-son', 'commune_count', 61, '1672/NQ-UBTVQH15', '{"source_field":"xa_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('55-lang-son', 'ward_count', 4, '1672/NQ-UBTVQH15', '{"source_field":"phuong_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('55-lang-son', 'special_zone_count', 0, '1672/NQ-UBTVQH15', '{"source_field":"dac_ku_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('55-lang-son', 'not_applied_count', 0, '1672/NQ-UBTVQH15', '{"source_field":"khong_thuc_hien","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('55-lang-son', 'unit_count_after', 65, '1672/NQ-UBTVQH15', '{"source_field":"unit_count_after","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('56-lao-cai', 'commune_count_before', 89, '202/2025/QH15', '{"source_field":"xa_truoc","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('56-lao-cai', 'commune_count', 81, '1673/NQ-UBTVQH15', '{"source_field":"xa_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('56-lao-cai', 'ward_count', 10, '1673/NQ-UBTVQH15', '{"source_field":"phuong_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('56-lao-cai', 'special_zone_count', 0, '1673/NQ-UBTVQH15', '{"source_field":"dac_ku_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('56-lao-cai', 'not_applied_count', 8, '1673/NQ-UBTVQH15', '{"source_field":"khong_thuc_hien","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('56-lao-cai', 'unit_count_after', 99, '1673/NQ-UBTVQH15', '{"source_field":"unit_count_after","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('57-nghe-an', 'commune_count_before', 119, '202/2025/QH15', '{"source_field":"xa_truoc","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('57-nghe-an', 'commune_count', 110, '1678/NQ-UBTVQH15', '{"source_field":"xa_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('57-nghe-an', 'ward_count', 11, '1678/NQ-UBTVQH15', '{"source_field":"phuong_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('57-nghe-an', 'special_zone_count', 0, '1678/NQ-UBTVQH15', '{"source_field":"dac_ku_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('57-nghe-an', 'not_applied_count', 9, '1678/NQ-UBTVQH15', '{"source_field":"khong_thuc_hien","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('57-nghe-an', 'unit_count_after', 130, '1678/NQ-UBTVQH15', '{"source_field":"unit_count_after","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('58-ninh-binh', 'commune_count_before', 97, '202/2025/QH15', '{"source_field":"xa_truoc","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('58-ninh-binh', 'commune_count', 97, '1674/NQ-UBTVQH15', '{"source_field":"xa_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('58-ninh-binh', 'ward_count', 32, '1674/NQ-UBTVQH15', '{"source_field":"phuong_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('58-ninh-binh', 'special_zone_count', 0, '1674/NQ-UBTVQH15', '{"source_field":"dac_ku_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('58-ninh-binh', 'not_applied_count', 0, '1674/NQ-UBTVQH15', '{"source_field":"khong_thuc_hien","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('58-ninh-binh', 'unit_count_after', 129, '1674/NQ-UBTVQH15', '{"source_field":"unit_count_after","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('59-phu-tho', 'commune_count_before', 133, '202/2025/QH15', '{"source_field":"xa_truoc","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('59-phu-tho', 'commune_count', 131, '1676/NQ-UBTVQH15', '{"source_field":"xa_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('59-phu-tho', 'ward_count', 15, '1676/NQ-UBTVQH15', '{"source_field":"phuong_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('59-phu-tho', 'special_zone_count', 0, '1676/NQ-UBTVQH15', '{"source_field":"dac_ku_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('59-phu-tho', 'not_applied_count', 2, '1676/NQ-UBTVQH15', '{"source_field":"khong_thuc_hien","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('59-phu-tho', 'unit_count_after', 148, '1676/NQ-UBTVQH15', '{"source_field":"unit_count_after","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('60-quang-ngai', 'commune_count_before', 86, '202/2025/QH15', '{"source_field":"xa_truoc","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('60-quang-ngai', 'commune_count', 81, '1677/NQ-UBTVQH15', '{"source_field":"xa_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('60-quang-ngai', 'ward_count', 9, '1677/NQ-UBTVQH15', '{"source_field":"phuong_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('60-quang-ngai', 'special_zone_count', 1, '1677/NQ-UBTVQH15', '{"source_field":"dac_ku_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('60-quang-ngai', 'not_applied_count', 5, '1677/NQ-UBTVQH15', '{"source_field":"khong_thuc_hien","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('60-quang-ngai', 'unit_count_after', 96, '1677/NQ-UBTVQH15', '{"source_field":"unit_count_after","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('61-quang-ninh', 'commune_count_before', 22, '202/2025/QH15', '{"source_field":"xa_truoc","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('61-quang-ninh', 'commune_count', 21, '1679/NQ-UBTVQH15', '{"source_field":"xa_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('61-quang-ninh', 'ward_count', 30, '1679/NQ-UBTVQH15', '{"source_field":"phuong_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('61-quang-ninh', 'special_zone_count', 2, '1679/NQ-UBTVQH15', '{"source_field":"dac_ku_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('61-quang-ninh', 'not_applied_count', 1, '1679/NQ-UBTVQH15', '{"source_field":"khong_thuc_hien","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('61-quang-ninh', 'unit_count_after', 54, '1679/NQ-UBTVQH15', '{"source_field":"unit_count_after","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('62-quang-tri', 'commune_count_before', 69, '202/2025/QH15', '{"source_field":"xa_truoc","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('62-quang-tri', 'commune_count', 68, '1680/NQ-UBTVQH15', '{"source_field":"xa_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('62-quang-tri', 'ward_count', 8, '1680/NQ-UBTVQH15', '{"source_field":"phuong_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('62-quang-tri', 'special_zone_count', 1, '1680/NQ-UBTVQH15', '{"source_field":"dac_ku_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('62-quang-tri', 'not_applied_count', 1, '1680/NQ-UBTVQH15', '{"source_field":"khong_thuc_hien","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('62-quang-tri', 'unit_count_after', 78, '1680/NQ-UBTVQH15', '{"source_field":"unit_count_after","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('63-son-la', 'commune_count_before', 67, '202/2025/QH15', '{"source_field":"xa_truoc","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('63-son-la', 'commune_count', 60, '1681/NQ-UBTVQH15', '{"source_field":"xa_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('63-son-la', 'ward_count', 8, '1681/NQ-UBTVQH15', '{"source_field":"phuong_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('63-son-la', 'special_zone_count', 0, '1681/NQ-UBTVQH15', '{"source_field":"dac_ku_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('63-son-la', 'not_applied_count', 7, '1681/NQ-UBTVQH15', '{"source_field":"khong_thuc_hien","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('63-son-la', 'unit_count_after', 75, '1681/NQ-UBTVQH15', '{"source_field":"unit_count_after","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('64-tay-ninh', 'commune_count_before', 82, '202/2025/QH15', '{"source_field":"xa_truoc","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('64-tay-ninh', 'commune_count', 82, '1682/NQ-UBTVQH15', '{"source_field":"xa_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('64-tay-ninh', 'ward_count', 14, '1682/NQ-UBTVQH15', '{"source_field":"phuong_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('64-tay-ninh', 'special_zone_count', 0, '1682/NQ-UBTVQH15', '{"source_field":"dac_ku_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('64-tay-ninh', 'not_applied_count', 0, '1682/NQ-UBTVQH15', '{"source_field":"khong_thuc_hien","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('64-tay-ninh', 'unit_count_after', 96, '1682/NQ-UBTVQH15', '{"source_field":"unit_count_after","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('65-thai-nguyen', 'commune_count_before', 77, '202/2025/QH15', '{"source_field":"xa_truoc","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('65-thai-nguyen', 'commune_count', 75, '1683/NQ-UBTVQH15', '{"source_field":"xa_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('65-thai-nguyen', 'ward_count', 15, '1683/NQ-UBTVQH15', '{"source_field":"phuong_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('65-thai-nguyen', 'special_zone_count', 0, '1683/NQ-UBTVQH15', '{"source_field":"dac_ku_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('65-thai-nguyen', 'not_applied_count', 2, '1683/NQ-UBTVQH15', '{"source_field":"khong_thuc_hien","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('65-thai-nguyen', 'unit_count_after', 92, '1683/NQ-UBTVQH15', '{"source_field":"unit_count_after","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('66-thanh-hoa', 'commune_count_before', 147, '202/2025/QH15', '{"source_field":"xa_truoc","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('66-thanh-hoa', 'commune_count', 126, '1686/NQ-UBTVQH15', '{"source_field":"xa_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('66-thanh-hoa', 'ward_count', 19, '1686/NQ-UBTVQH15', '{"source_field":"phuong_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('66-thanh-hoa', 'special_zone_count', 0, '1686/NQ-UBTVQH15', '{"source_field":"dac_ku_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('66-thanh-hoa', 'not_applied_count', 21, '1686/NQ-UBTVQH15', '{"source_field":"khong_thuc_hien","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('66-thanh-hoa', 'unit_count_after', 166, '1686/NQ-UBTVQH15', '{"source_field":"unit_count_after","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('67-thanh-pho-ho-chi-minh', 'commune_count_before', 54, '202/2025/QH15', '{"source_field":"xa_truoc","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('67-thanh-pho-ho-chi-minh', 'commune_count', 50, '1685/NQ-UBTVQH15', '{"source_field":"xa_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('67-thanh-pho-ho-chi-minh', 'ward_count', 112, '1685/NQ-UBTVQH15', '{"source_field":"phuong_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('67-thanh-pho-ho-chi-minh', 'special_zone_count', 1, '1685/NQ-UBTVQH15', '{"source_field":"dac_ku_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('67-thanh-pho-ho-chi-minh', 'not_applied_count', 5, '1685/NQ-UBTVQH15', '{"source_field":"khong_thuc_hien","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('67-thanh-pho-ho-chi-minh', 'unit_count_after', 168, '1685/NQ-UBTVQH15', '{"source_field":"unit_count_after","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('68-tuyen-quang', 'commune_count_before', 117, '202/2025/QH15', '{"source_field":"xa_truoc","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('68-tuyen-quang', 'commune_count', 104, '1684/NQ-UBTVQH15', '{"source_field":"xa_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('68-tuyen-quang', 'ward_count', 7, '1684/NQ-UBTVQH15', '{"source_field":"phuong_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('68-tuyen-quang', 'special_zone_count', 0, '1684/NQ-UBTVQH15', '{"source_field":"dac_ku_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('68-tuyen-quang', 'not_applied_count', 13, '1684/NQ-UBTVQH15', '{"source_field":"khong_thuc_hien","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('68-tuyen-quang', 'unit_count_after', 124, '1684/NQ-UBTVQH15', '{"source_field":"unit_count_after","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('70-vinh-long', 'commune_count_before', 105, '202/2025/QH15', '{"source_field":"xa_truoc","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('70-vinh-long', 'commune_count', 101, '1687/NQ-UBTVQH15', '{"source_field":"xa_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('70-vinh-long', 'ward_count', 19, '1687/NQ-UBTVQH15', '{"source_field":"phuong_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('70-vinh-long', 'special_zone_count', 0, '1687/NQ-UBTVQH15', '{"source_field":"dac_ku_sau","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('70-vinh-long', 'not_applied_count', 4, '1687/NQ-UBTVQH15', '{"source_field":"khong_thuc_hien","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb),
  ('70-vinh-long', 'unit_count_after', 124, '1687/NQ-UBTVQH15', '{"source_field":"unit_count_after","note":"Đồng bộ từ bảng tổng hợp sắp xếp 2025."}'::jsonb)
) as m(
  province_slug,
  metric_code,
  value,
  document_number,
  metadata
)
join public.geo_datasets d
  on d.code = 'vn-admin-2025-07-01'
join public.geo_units u
  on u.dataset_id = d.id
 and u.level_code = 'province'
 and u.slug = m.province_slug
left join public.geo_documents doc
  on doc.document_number = m.document_number
on conflict (unit_id, metric_code) do update set
  value              = excluded.value,
  source_document_id = excluded.source_document_id,
  metadata           = public.geo_unit_metrics.metadata || excluded.metadata;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Gắn số nghị quyết / trạng thái / danh sách giữ nguyên vào sự kiện hiện có
-- ─────────────────────────────────────────────────────────────────────────────
update public.geo_events e
set metadata = e.metadata || jsonb_build_object(
  'resolution_number', s.resolution_number,
  'reform_status', s.status,
  'not_applied', s.not_applied,
  'not_applied_units', s.metadata->'not_applied_units'
)
from public.geo_reform_summaries s
where e.dataset_id = s.dataset_id
  and e.metadata->>'province_slug' = s.province_slug;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Ghi chú tổng hợp vào metadata dataset (không ghi đè metadata cũ)
-- ─────────────────────────────────────────────────────────────────────────────
update public.geo_datasets d
set metadata = d.metadata || jsonb_build_object(
  'reform_summary', '{"source_file":"db/data/commune-reform-summary.json","rows":34,"totals":{"xa_truoc":2621,"xa_sau":2499,"phuong_sau":682,"dac_ku_sau":13,"khong_thuc_hien":127,"unit_count_after":3321},"not_applied_units":127,"not_applied_source_file":"db/source/danh_sach_xa_phuong_truoc_sau_sap_xep.json","not_applied_note":"Chỉ 127 đơn vị không thực hiện sắp xếp có tên; 3.194 đơn vị còn lại chỉ có số liệu tổng hợp.","source_total_note":"B?n JSON ??nh k?m ghi tong_quan.tong_xa_truoc = 3233, nh?ng t?ng 34 d?ng xa_truoc l? 2621. Script d?ng t?ng theo 34 d?ng v? kh?ng t? ? s?a s? li?u ngu?n."}'::jsonb
)
where d.code = 'vn-admin-2025-07-01';

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Kiểm tra nhanh (chỉ cảnh báo, không chặn giao dịch)
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_rows          integer;
  v_before        integer;
  v_after         integer;
  v_units         integer;
  v_metrics       integer;
  v_not_applied   integer;
begin
  select
    count(*),
    coalesce(sum(communes_before), 0),
    coalesce(sum(total_units_after), 0)
  into v_rows, v_before, v_after
  from public.geo_reform_summaries s
  join public.geo_datasets d on d.id = s.dataset_id
  where d.code = 'vn-admin-2025-07-01';

  select count(*) into v_units
  from public.geo_units u
  join public.geo_datasets d on d.id = u.dataset_id
  where d.code = 'vn-admin-2025-07-01'
    and u.level_code = 'province';

  select count(*) into v_metrics
  from public.geo_unit_metrics m
  join public.geo_units u on u.id = m.unit_id
  join public.geo_datasets d on d.id = u.dataset_id
  where d.code = 'vn-admin-2025-07-01'
    and m.metric_code in (
      'commune_count_before', 'commune_count', 'ward_count',
      'special_zone_count', 'not_applied_count', 'unit_count_after'
    );

  select count(*) into v_not_applied
  from public.geo_units u
  join public.geo_datasets d on d.id = u.dataset_id
  where d.code = 'vn-admin-2025-07-01'
    and u.level_code = 'commune'
    and u.metadata->>'reform_status' = 'not_applied';

  raise notice 'geo_reform_summaries: % dòng; communes_before=%; total_units_after=%',
    v_rows, v_before, v_after;
  raise notice 'geo_units cấp tỉnh: %; geo_unit_metrics liên quan: %; đơn vị giữ nguyên: %',
    v_units, v_metrics, v_not_applied;

  if v_rows <> 34 then
    raise warning 'Số dòng tổng hợp là %, mong đợi 34.', v_rows;
  end if;
  if v_before <> 2621 then
    raise warning 'Tổng communes_before là %, mong đợi 2621.', v_before;
  end if;
  if v_after <> 3321 then
    raise warning 'Tổng total_units_after là %, mong đợi 3321.', v_after;
  end if;
  if v_not_applied <> 127 then
    raise warning 'Số geo_units được đánh dấu not_applied là %, mong đợi 127.',
      v_not_applied;
  end if;
end
$$;

commit;

-- =============================================================================
-- Kiểm tra sau khi chạy:
--   select * from public.geo_reform_summaries order by province_name;
--   select sum(communes_before), sum(communes_after), sum(wards_after),
--          sum(special_zones_after), sum(not_applied), sum(total_units_after)
--   from public.geo_reform_summaries;
--   select * from public.geo_unit_summary
--   where level_code = 'province' order by name;
-- =============================================================================
