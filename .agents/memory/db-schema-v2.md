---
name: DB Schema v2
description: documents table new fields and migration approach
---

Added to `documents` table in v2:
- `issued_date DATE` — ngày ban hành
- `expiry_date DATE NULL` — ngày hết hiệu lực
- `status TEXT CHECK(hieu_luc|het_hieu_luc|chua_hieu_luc)` — DEFAULT 'hieu_luc'
- `updated_at TIMESTAMPTZ` — auto-updated by trigger `set_updated_at()`

Also added `label TEXT` column to `document_tags`.

New tags: `ke-toan`, `hai-quan`, `xuat-nhap-khau`.

**Files:**
- `db/schema_v2.sql` — full fresh schema (drops all tables)
- `db/migration_v1_to_v2.sql` — safe ALTER TABLE (preserves existing data)

**Why:** User needs to track document validity periods and status for filter UI.

**How to apply:** Run migration in Supabase SQL Editor. For fresh DB use schema_v2.sql.
