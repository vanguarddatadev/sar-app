# Quick Start Guide - SAR Database Setup

## You Have an Existing `sessions` Table?

### ✅ Run This Migration Script

**File:** `01b-migrate-sessions-with-multiple-per-day.sql`

**Supports multiple sessions per day** (Early/Late sessions at same location)

This will:
- Create `organizations` table
- Add `organization_id` to your existing sessions
- Set all sessions to Vanguard org
- Add `session_time` column (for "Early", "Late", etc.)
- Add missing columns (`allocated_expenses`, `is_cancelled`)
- **NO unique constraint** - allows multiple sessions per date/location

```sql
-- In Supabase SQL Editor, run:
-- (Copy contents of 01b-migrate-sessions-with-multiple-per-day.sql)
```

**Note:** Your sessions already have `session_type` (Regular, Late, etc.) to distinguish multiple sessions on the same day - no additional labeling needed!

---

## Then Run These in Order:

### 1. Create Two Organizations
```sql
-- File: 02-create-two-orgs.sql
-- Creates: org_1 (Vanguard with data), org_2 (empty)
-- Sets organization_name in system_settings for both
```

### 2. Expense System Schema
```sql
-- File: expense-system-schema.sql
-- Creates: qb_monthly_imports, spreadsheet_monthly_actuals
```

### 3. Allocation System Schema
```sql
-- File: allocation-system-schema.sql
-- Creates: allocation_rules, monthly_forecast, session_allocated_expenses
```

### 4. Seed Allocation Rules (Auto - No Editing!)
```sql
-- File: 03-allocation-rules-seed-auto.sql
-- Auto-creates 11 rules for org_1 (Vanguard)
-- No manual UUID editing required!
```

---

## Verification

After all files run successfully:

```sql
-- Check tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'organizations',
    'sessions',
    'qb_monthly_imports',
    'spreadsheet_monthly_actuals',
    'allocation_rules',
    'monthly_forecast',
    'session_allocated_expenses'
  )
ORDER BY table_name;
```

Expected: 7 rows

```sql
-- Check allocation rules loaded
SELECT COUNT(*) as rule_count FROM allocation_rules;
```

Expected: 11 rules

```sql
-- Check sessions have organization_id
SELECT
  COUNT(*) as total_sessions,
  COUNT(organization_id) as sessions_with_org,
  COUNT(DISTINCT organization_id) as org_count
FROM sessions;
```

Expected: total_sessions = sessions_with_org, org_count = 1

---

## Common Errors

### ❌ "relation 'organizations' does not exist"
**Fix:** Run `01-migrate-existing-sessions.sql` first

### ❌ "column 'organization_id' does not exist"
**Fix:** Run `01-migrate-existing-sessions.sql` first

### ❌ Allocation rules not inserting
**Fix:** Check you replaced `'YOUR_ORG_ID'` with actual UUID

---

## Next Steps

1. Import QB data: `node import-qb-data.js`
2. Import spreadsheet data: `node import-spreadsheet-data.js`
3. Build allocation engine
4. Profit! 💰
