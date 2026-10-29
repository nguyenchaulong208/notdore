-- ═════════════════════════════════════════════════════════════════════════════
-- Grant SELECT on communes, admin_unit_history tables
-- Fix: permission denied for table communes (42501)
-- TABLES: public.communes, public.admin_unit_history, public.admin_units
-- ═════════════════════════════════════════════════════════════════════════════

-- Grants on communes (main table)
-- communes.code is text - no sequence needed
GRANT SELECT ON public.communes TO service_role;
GRANT SELECT ON public.communes TO anon;
GRANT SELECT ON public.communes TO authenticated;

-- Grants on admin_unit_history
GRANT SELECT ON public.admin_unit_history TO service_role;
GRANT SELECT ON public.admin_unit_history TO anon;
GRANT SELECT ON public.admin_unit_history TO authenticated;

-- Grants on admin_units (if exists)
GRANT SELECT ON public.admin_units TO service_role;
GRANT SELECT ON public.admin_units TO anon;
GRANT SELECT ON public.admin_units TO authenticated;

-- Note: admin_unit_history.id is bigserial -> auto-creates admin_unit_history_id_seq
-- No manual sequence grants needed