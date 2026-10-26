/*
 * NotDore Admin — Dump toàn bộ database (structure + data)
 * Sử dụng để: backup, migrate, hoặc chèn dữ liệu vào Supabase
 * 
 * Cần chỉnh sửa:
 * 1. Thay <project-ref> bằng project Ref của bạn
 * 2. Thêm dữ liệu thực tế vào bảng admin_units
 * 3. Cấu hình SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * 
 * Cách dùng:
 *   - Dán vào SQL Editor (Supabase Dashboard)
 *   - Hoặc chạy bằng psql: psql $DATABASE_URL < dump_database.sql
 */

-- =============================================================================
-- 1. Cấu hình kết nối
-- =============================================================================
-- Thay bằng project ref của bạn:
\set project_ref 'thmvaufuaxfoflyndrcq'
\set supabase_url 'https://' || :'project_ref' || '.supabase.co'

-- =============================================================================
-- 2. Cấp quyền SELECT cho service_role trên tất cả bảng
-- =============================================================================
DO $$
DECLARE
    tbl record;
BEGIN
    FOR tbl IN
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
    LOOP
        EXECUTE format('GRANT SELECT ON public.%I TO service_role;', tbl.table_name);
    END LOOP;
    RAISE NOTICE '✅ Đã cấp SELECT trên tất cả bảng cho service_role.';
END $$;

-- =============================================================================
-- 3. Tạo bảng (nếu chưa có)
-- =============================================================================

-- Bảng admin_units
CREATE TABLE IF NOT EXISTS public.admin_units (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    type_code VARCHAR(50),
    slug VARCHAR(255),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bảng admin_unit_history
CREATE TABLE IF NOT EXISTS public.admin_unit_history (
    id SERIAL PRIMARY KEY,
    admin_unit_id INTEGER REFERENCES public.admin_units(id),
    action VARCHAR(50),
    old_value JSONB,
    new_value JSONB,
    changed_by VARCHAR(100),
    changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bảng geo_units (tùy chọn - dữ liệu địa giới hành chính)
CREATE TABLE IF NOT EXISTS public.geo_units (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20),
    name VARCHAR(255),
    level_code VARCHAR(50),
    type_code VARCHAR(50),
    slug VARCHAR(255),
    geometry GEOMETRY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bảng geo_reform_summaries
CREATE TABLE IF NOT EXISTS public.geo_reform_summaries (
    id SERIAL PRIMARY KEY,
    province_name VARCHAR(255),
    resolution_number VARCHAR(50),
    communes_before INTEGER,
    communes_after INTEGER,
    wards_after INTEGER,
    special_zones_after INTEGER,
    not_applied INTEGER,
    total_units_after INTEGER,
    communes_delta INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bảng admin_meta
CREATE TABLE IF NOT EXISTS public.admin_meta (
    id SERIAL PRIMARY KEY,
    key VARCHAR(255) UNIQUE,
    value JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 4. Thêm dữ liệu mẫu vào admin_units (CHỈNH SỬA THÊM DỮ LIỆU CỦA BẠN)
-- =============================================================================

-- Xóa dữ liệu cũ (chỉ chạy khi reset database)
-- TRUNCATE TABLE public.admin_units RESTART IDENTITY;

-- Thêm dữ liệu mẫu (cập nhật bằng dữ liệu thực tế của bạn)
INSERT INTO public.admin_units (code, name, type_code, slug, description, created_at, updated_at)
VALUES 
-- 1. Tỉnh Hà Nội
('1', 'Tỉnh Hà Nội', 'province', 'ha-noi', 'Tổng quản lý vùng miền Bắc', NOW(), NOW()),
-- 2. Tỉnh Hải Phòng
('2', 'Tỉnh Hải Phòng', 'province', 'hai-phong', 'Khu kinh tế ven biển', NOW(), NOW()),
-- 3. Tỉnh Đà Nẵng
('3', 'Tỉnh Đà Nẵng', 'province', 'da-nang', 'Thành phố trực thuộc trung ương', NOW(), NOW()),
-- 4. Tỉnh TP. HCM
('4', 'Tỉnh TP. HCM', 'province', 'tp-hcm', 'Khu vực kinh tế trọng điểm', NOW(), NOW()),
-- 5. Tỉnh Cần Thơ
('5', 'Tỉnh Cần Thơ', 'province', 'can-tho', 'Thành phố trực thuộc trung ương', NOW(), NOW());

-- =============================================================================
-- 5. Thêm dữ liệu mẫu vào admin_unit_history
-- =============================================================================

INSERT INTO public.admin_unit_history (admin_unit_id, action, old_value, new_value, changed_by, changed_at)
SELECT 
    id,
    'created',
    NULL,
    jsonb_build_object('code', code, 'name', name, 'type_code', type_code),
    'admin_system',
    NOW()
FROM public.admin_units;

-- =============================================================================
-- 6. Kiểm tra kết quả
-- =============================================================================

-- Đếm số dòng trong mỗi bảng
SELECT 'admin_units' AS table_name, COUNT(*) AS total FROM public.admin_units
UNION ALL
SELECT 'admin_unit_history', COUNT(*) FROM public.admin_unit_history
UNION ALL
SELECT 'geo_units', COUNT(*) FROM public.geo_units
UNION ALL
SELECT 'geo_reform_summaries', COUNT(*) FROM public.geo_reform_summaries
UNION ALL
SELECT 'admin_meta', COUNT(*) FROM public.admin_meta;

-- Xem dữ liệu admin_units
SELECT * FROM public.admin_units ORDER BY code;

-- Xem lịch sử
SELECT * FROM public.admin_unit_history ORDER BY changed_at DESC;

-- =============================================================================
-- 7. Cấu hình kết nối để dùng bên ngoài (psql)
-- =============================================================================
-- Lấy connection string từ Supabase Dashboard:
--   Project Settings → Database → Connection String
--   Format: postgresql://postgres:***@db.<project-ref>.supabase.co:5432/postgres
--
-- Dùng với psql:
--   export DATABASE_URL="postgresql://postgres:***@db.<project-ref>.supabase.co:5432/postgres"
--   psql $DATABASE_URL < dump_database.sql
--
-- Hoặc dùng Admin SDK / Supabase JS client:
--   const { supabase } = require('@supabase/supabase-js');
--   const projects = await supabase.auth.getSession();
--   const { data: tables } = await supabase.from('admin_units').select('*');
-- =============================================================================

-- ✅ Hoàn thành
RAISE NOTICE '✅ Dump database hoàn tất!';
