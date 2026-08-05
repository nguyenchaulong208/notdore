---
name: Admin Tool
description: Local-only admin UI at /admin for generating SQL insert scripts
---

Located at `/admin` — served by Express only when request comes from localhost IP.
Restriction in `server.js` via `localOnly` middleware (checks req.ip for 127.0.0.1/::1/private ranges).

**Does NOT write to Supabase directly** — generates SQL scripts the user runs in Supabase SQL Editor.

Features:
- Single doc form → INSERT SQL with CTE pattern (doc + file + tags in one transaction)
- Bulk CSV import → preview table → bulk INSERT SQL
- CSV template download (empty + sample with example data)
- Schema viewer with download links for db/schema_v2.sql and db/migration_v1_to_v2.sql

Tag key map used in admin.js: `vat→thue-gtgt`, `tncn→thue-tncn`, `tndn→thue-tndn`, `bhxh→bhxh`, `ke-toan→ke-toan`, `hai-quan→hai-quan`, `xnk→xuat-nhap-khau`

CSV separator for tags field: semicolon `;` (not comma, to avoid CSV conflict).

**Why:** User manages DB manually; no direct write access needed from local tool.

**Roadmap noted in UI:** v3=crawl→form→SQL, v4=auto-schedule+dedup+direct push.
