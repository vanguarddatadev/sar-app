# SAR Database Schema Installation Order

**IMPORTANT: Run SQL files in this exact order to avoid dependency errors!**

## Step-by-Step Installation

### Step 0: Prerequisites

1. Have a Supabase project created
2. Have access to Supabase SQL Editor
3. Have your Supabase URL and service key ready

---

### Step 0.5: Migrate Existing Sessions Table (If Applicable)

**ONLY RUN THIS IF:** You already have a `sessions` table without `organization_id` column

**File:** `01-migrate-existing-sessions.sql`

**What it does:**
- Creates `organizations` table if it doesn't exist
- Inserts Vanguard organization
- Adds `organization_id` column to existing sessions
- Sets all existing sessions to Vanguard org
- Adds missing columns (`allocated_expenses`, `is_cancelled`, etc.)
- Updates indexes and constraints

**Run in Supabase SQL Editor:**
```sql
-- Copy contents of 01-migrate-existing-sessions.sql and paste here
```

**Verify:**
```sql
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'sessions'
  AND column_name IN ('organization_id', 'allocated_expenses', 'is_cancelled')
ORDER BY column_name;
```

Expected: 3 rows showing those columns exist

**Then skip to Step 2** (skip Step 1 if you ran this migration)

---

### Step 1: Base Schema (Foundation)

**ONLY RUN THIS IF:** You DON'T have an existing sessions table (fresh install)

**File:** `00-base-schema.sql`

**Creates:**
- `organizations` table
- `sessions` table
- `system_settings` table
- Inserts Vanguard organization record

**Run in Supabase SQL Editor:**
```sql
-- Copy contents of 00-base-schema.sql and paste here
```

**Verify:**
```sql
SELECT id, name FROM organizations WHERE name = 'Vanguard Music and Performing Arts';
```

Expected: 1 row with organization UUID

---

### Step 2: Expense System Schema (Data Storage)

**File:** `expense-system-schema.sql`

**Creates:**
- `qb_monthly_imports` table
- `spreadsheet_monthly_actuals` table

**Run in Supabase SQL Editor:**
```sql
-- Copy contents of expense-system-schema.sql and paste here
```

**Verify:**
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('qb_monthly_imports', 'spreadsheet_monthly_actuals');
```

Expected: 2 rows

---

### Step 3: Allocation System Schema (Rules & Outputs)

**File:** `allocation-system-schema.sql`

**Creates:**
- `allocation_rules` table
- `monthly_forecast` table
- `monthly_forecast_modified` table
- `session_allocated_expenses` table
- Views: `v_monthly_forecast_complete`, `v_session_pl`
- Enhances `sessions` table with expense columns

**Run in Supabase SQL Editor:**
```sql
-- Copy contents of allocation-system-schema.sql and paste here
```

**Verify:**
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'allocation_rules',
    'monthly_forecast',
    'monthly_forecast_modified',
    'session_allocated_expenses'
  );
```

Expected: 4 rows

---

### Step 4: Seed Allocation Rules

**File:** `allocation-rules-seed.sql`

**Before running:**
1. Get your organization ID:
```sql
SELECT id FROM organizations WHERE name = 'Vanguard Music and Performing Arts';
```

2. Edit `allocation-rules-seed.sql` and replace ALL instances of `'YOUR_ORG_ID'` with the actual UUID

**Run in Supabase SQL Editor:**
```sql
-- Copy contents of allocation-rules-seed.sql (after replacing YOUR_ORG_ID) and paste here
```

**Verify:**
```sql
SELECT
  display_order,
  bingo_category,
  bingo_percentage || '%' as bingo_pct,
  allocation_method,
  formula_display
FROM allocation_rules
WHERE organization_id = 'YOUR_ORG_ID'  -- Replace with actual UUID
ORDER BY display_order;
```

Expected: 11 rows (Staffing, Janitorial, Security, COGS, Meals, Marketing, Merchant Fee, Insurance, Utilities, Rent, Other)

---

## Quick Install Script

For advanced users, you can run all in sequence:

```bash
# Get organization ID first
ORG_ID=$(psql $DATABASE_URL -t -c "SELECT id FROM organizations WHERE name = 'Vanguard Music and Performing Arts';")

# Replace in seed file
sed -i "s/YOUR_ORG_ID/$ORG_ID/g" allocation-rules-seed.sql

# Run all schemas
psql $DATABASE_URL < 00-base-schema.sql
psql $DATABASE_URL < expense-system-schema.sql
psql $DATABASE_URL < allocation-system-schema.sql
psql $DATABASE_URL < allocation-rules-seed.sql
```

---

## Troubleshooting

### Error: "relation 'organizations' does not exist"
**Solution:** Run `00-base-schema.sql` first

### Error: "relation 'sessions' does not exist"
**Solution:** Run `00-base-schema.sql` first

### Error: "column 'organization_id' does not exist"
**Solution:** Make sure base schema ran successfully

### Error: Allocation rules not inserting
**Solution:** Check that you replaced `'YOUR_ORG_ID'` with actual UUID from organizations table

---

## Verification

After all schemas are installed, run this comprehensive check:

```sql
SELECT
  'Base Tables' as category,
  COUNT(*) FILTER (WHERE table_name = 'organizations') as organizations,
  COUNT(*) FILTER (WHERE table_name = 'sessions') as sessions,
  COUNT(*) FILTER (WHERE table_name = 'system_settings') as system_settings
FROM information_schema.tables
WHERE table_schema = 'public'

UNION ALL

SELECT
  'Expense Tables',
  COUNT(*) FILTER (WHERE table_name = 'qb_monthly_imports'),
  COUNT(*) FILTER (WHERE table_name = 'spreadsheet_monthly_actuals'),
  NULL
FROM information_schema.tables
WHERE table_schema = 'public'

UNION ALL

SELECT
  'Allocation Tables',
  COUNT(*) FILTER (WHERE table_name = 'allocation_rules'),
  COUNT(*) FILTER (WHERE table_name = 'monthly_forecast'),
  COUNT(*) FILTER (WHERE table_name = 'session_allocated_expenses')
FROM information_schema.tables
WHERE table_schema = 'public';
```

Expected output: All counts should be 1

---

## Next Steps

After installation:
1. Import QB data: `node import-qb-data.js`
2. Import spreadsheet data: `node import-spreadsheet-data.js`
3. Build allocation engine
4. Run allocations
5. View results in SAR app

---

## File Summary

| File | Purpose | Dependencies |
|------|---------|--------------|
| `00-base-schema.sql` | Foundation tables | None (run first) |
| `expense-system-schema.sql` | QB & Spreadsheet storage | `00-base-schema.sql` |
| `allocation-system-schema.sql` | Allocation rules & outputs | `00-base-schema.sql`, `expense-system-schema.sql` |
| `allocation-rules-seed.sql` | Pre-configured rules | All above + ORG_ID |

---

## Support

For issues:
1. Check error message for missing table/column
2. Verify installation order was followed
3. Check Supabase logs for detailed error
4. Verify organization exists: `SELECT * FROM organizations;`
