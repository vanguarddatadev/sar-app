# SAR Database Installation Flowchart

```
START
  ↓
┌─────────────────────────────────┐
│ Do you have existing sessions?  │
└─────────────────────────────────┘
         ↓ YES              ↓ NO
         ↓                  ↓
         ↓            ┌──────────────────┐
         ↓            │ Run:             │
         ↓            │ 00-base-schema   │
         ↓            └──────────────────┘
         ↓                  ↓
┌────────────────────┐      ↓
│ Run:               │      ↓
│ 01a-cleanup-       │      ↓
│ duplicate-sessions │      ↓
└────────────────────┘      ↓
         ↓                  ↓
┌────────────────────┐      ↓
│ Verify:            │      ↓
│ No duplicates?     │      ↓
└────────────────────┘      ↓
         ↓                  ↓
┌────────────────────┐      ↓
│ Run:               │      ↓
│ 01-migrate-        │      ↓
│ existing-sessions  │      ↓
└────────────────────┘      ↓
         ↓                  ↓
         └──────────┬───────┘
                    ↓
         ┌──────────────────────┐
         │ Run:                 │
         │ expense-system-      │
         │ schema               │
         └──────────────────────┘
                    ↓
         ┌──────────────────────┐
         │ Run:                 │
         │ allocation-system-   │
         │ schema               │
         └──────────────────────┘
                    ↓
         ┌──────────────────────┐
         │ Get Org ID:          │
         │ SELECT id FROM       │
         │ organizations        │
         └──────────────────────┘
                    ↓
         ┌──────────────────────┐
         │ Edit:                │
         │ allocation-rules-    │
         │ seed.sql             │
         │ (Replace YOUR_ORG_ID)│
         └──────────────────────┘
                    ↓
         ┌──────────────────────┐
         │ Run:                 │
         │ allocation-rules-    │
         │ seed                 │
         └──────────────────────┘
                    ↓
         ┌──────────────────────┐
         │ Verify:              │
         │ 11 rules exist       │
         └──────────────────────┘
                    ↓
                  DONE
                    ↓
         ┌──────────────────────┐
         │ Next: Import data    │
         │ - import-qb-data.js  │
         │ - import-spreadsheet │
         └──────────────────────┘
```

## Quick Reference

### Path 1: Fresh Install (No existing data)
```
00-base-schema.sql
  ↓
expense-system-schema.sql
  ↓
allocation-system-schema.sql
  ↓
allocation-rules-seed.sql (edit first!)
```

### Path 2: Existing Sessions (Most common)
```
01a-cleanup-duplicate-sessions.sql
  ↓
01-migrate-existing-sessions.sql
  ↓
expense-system-schema.sql
  ↓
allocation-system-schema.sql
  ↓
allocation-rules-seed.sql (edit first!)
```

## Files You'll Run (In Order)

| Step | File | Purpose | Skip if... |
|------|------|---------|-----------|
| 0a | `01a-cleanup-duplicate-sessions.sql` | Remove duplicates | Fresh install |
| 0b | `01-migrate-existing-sessions.sql` | Add org_id to sessions | Fresh install |
| 0c | `00-base-schema.sql` | Create base tables | Have sessions table |
| 1 | `expense-system-schema.sql` | QB/Spreadsheet storage | Never skip |
| 2 | `allocation-system-schema.sql` | Allocation engine | Never skip |
| 3 | `allocation-rules-seed.sql` | Pre-configured rules | Never skip |

## Common Issues

### ❌ "column organization_id does not exist"
**You're here:** → You skipped the migration step
**Fix:** Run `01-migrate-existing-sessions.sql`

### ❌ "could not create unique index... is duplicated"
**You're here:** → You have duplicate sessions
**Fix:** Run `01a-cleanup-duplicate-sessions.sql` first

### ❌ "relation 'organizations' does not exist"
**You're here:** → You skipped base/migration step
**Fix:** Run `01-migrate-existing-sessions.sql` (if you have sessions) OR `00-base-schema.sql` (fresh install)

### ❌ "relation 'sessions' does not exist"
**You're here:** → Fresh install but ran wrong script
**Fix:** Run `00-base-schema.sql` instead of migration

## One-Command Check (After Install)

```sql
-- Paste this to verify everything is set up correctly
SELECT
  (SELECT COUNT(*) FROM organizations) as orgs,
  (SELECT COUNT(*) FROM sessions) as sessions,
  (SELECT COUNT(*) FROM allocation_rules) as rules,
  (SELECT CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sessions' AND column_name = 'organization_id'
  ) THEN 'YES' ELSE 'NO' END) as sessions_has_org_id;
```

**Expected Output:**
```
orgs: 1
sessions: [your session count]
rules: 11
sessions_has_org_id: YES
```

If any are wrong, check which script failed and re-run from that point.
