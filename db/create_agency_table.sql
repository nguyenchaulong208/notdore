-- Agency Management Table
-- Stores base-level (cơ sở) agency management data per commune
-- agency_type: 'BHXH', 'THUE', 'HAIQUAN'
-- agency_name: official name of the base-level office
-- commune_name: official commune/ward name (post-merger)
-- province_code: 2-digit province code

CREATE TABLE IF NOT EXISTS public.agency_management (
    id BIGSERIAL PRIMARY KEY,
    agency_type TEXT NOT NULL CHECK (agency_type IN ('BHXH', 'THUE', 'HAIQUAN')),
    agency_name TEXT NOT NULL,
    commune_name TEXT NOT NULL,
    province_code TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(agency_type, agency_name, commune_name)
);

CREATE INDEX IF NOT EXISTS idx_agency_type ON public.agency_management(agency_type);
CREATE INDEX IF NOT EXISTS idx_agency_province ON public.agency_management(province_code);
CREATE INDEX IF NOT EXISTS idx_agency_commune ON public.agency_management(commune_name);

-- Grant permissions
GRANT SELECT ON public.agency_management TO anon, authenticated;
GRANT ALL ON public.agency_management TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.agency_management_id_seq TO anon, authenticated, service_role;

-- Disable RLS for public read
ALTER TABLE public.agency_management DISABLE ROW LEVEL SECURITY;