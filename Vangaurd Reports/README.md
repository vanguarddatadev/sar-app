# SAR Expense Data Import

This folder contains scripts to import QB and Spreadsheet data into the SAR database.

## Files

- **QB CSV Files** - 13 months of QuickBooks P&L by Class reports (Sept 2024 - Sept 2025)
- **spreadsheet-data.csv** - Manual spreadsheet actuals (March - August 2025)
- **import-qb-data.js** - Script to import QB data
- **import-spreadsheet-data.js** - Script to import spreadsheet data

---

## Prerequisites

1. **Node.js** installed (v18 or higher)
2. **Supabase database schema** applied (`expense-system-schema.sql`)
3. **@supabase/supabase-js** package installed

```bash
npm install @supabase/supabase-js
```

---

## Step 1: Apply Database Schema

Run this in your Supabase SQL Editor:

```bash
# Copy schema to clipboard
cat ~/OneDrive/Documents/GitHub/sar-app/db/expense-system-schema.sql

# Then paste in Supabase SQL Editor and run
```

---

## Step 2: Import QB Data

```bash
cd "/mnt/c/Users/aring/NewCo/SAR/Vangaurd Reports/"
node import-qb-data.js
```

**What it does:**
- Parses all 13 QB P&L CSV files
- Extracts account numbers, names, classes, and amounts
- Inserts into `qb_monthly_imports` table
- Expected: ~3,000-5,000 records

**Output:**
```
🚀 QB P&L Data Importer
=======================

Organization ID: 123e4567-e89b-12d3-a456-426614174000
Supabase URL: https://nqwnkikattupnvtubfsu.supabase.co
QB Directory: /mnt/c/Users/aring/NewCo/SAR/Vangaurd Reports/
Files to import: 13

✓ Supabase connection successful

📊 Processing 2024-09-01 (Vanguard Music and Performing Arts_Profit and Loss by Class (3)1.csv)
  Classes found: Bingo - RWC, Bingo - SC, Santa Clara Vanguard, Shared Services
  ✓ Parsed 234 records
  ✓ Inserted batch 1 (234 records)

... (continues for all months)

📈 IMPORT SUMMARY
==================
✓ Successful: 13/13 months
❌ Failed: 0/13 months
📊 Total Records Imported: 3,842

✅ Import complete!
```

---

## Step 3: Import Spreadsheet Data

```bash
cd "/mnt/c/Users/aring/NewCo/SAR/Vangaurd Reports/"
node import-spreadsheet-data.js
```

**What it does:**
- Reads `spreadsheet-data.csv`
- Inserts into `spreadsheet_monthly_actuals` table
- Expected: ~100-150 records (March - August 2025)

**Output:**
```
🚀 Spreadsheet Data Importer
============================

Organization ID: 123e4567-e89b-12d3-a456-426614174000
Supabase URL: https://nqwnkikattupnvtubfsu.supabase.co
CSV File: spreadsheet-data.csv

✓ Supabase connection successful
✓ Parsed 126 records from CSV

Months found: 2025-03-01, 2025-04-01, 2025-05-01, 2025-06-01, 2025-07-01, 2025-08-01

Deleting existing spreadsheet data...
✓ Existing data cleared

Inserting new data...

✓ Inserted batch 1 (126 records)

📈 IMPORT SUMMARY
==================
✓ Total Records: 126
✓ Months: 6
✓ Categories: 11

✅ Import complete!
```

---

## Step 4: Verify Data

Query the database to confirm:

```sql
-- Check QB imports
SELECT
  month,
  COUNT(*) as records,
  COUNT(DISTINCT class_name) as classes,
  COUNT(DISTINCT account_number) as accounts
FROM qb_monthly_imports
WHERE organization_id = '123e4567-e89b-12d3-a456-426614174000'
GROUP BY month
ORDER BY month;

-- Check spreadsheet actuals
SELECT
  month,
  location,
  COUNT(*) as categories,
  SUM(amount) as total_amount
FROM spreadsheet_monthly_actuals
WHERE organization_id = '123e4567-e89b-12d3-a456-426614174000'
GROUP BY month, location
ORDER BY month, location;
```

---

## Data Summary

### QB P&L Data
- **Months:** Sept 2024 - Sept 2025 (13 months)
- **Classes:** Bingo - RWC, Bingo - SC, Santa Clara Vanguard, Shared Services, etc.
- **Accounts:** ~200-300 unique account numbers
- **Records:** ~3,000-5,000 total

### Spreadsheet Actuals
- **Months:** March 2025 - August 2025 (6 months)
- **Locations:** SC, RWC
- **Categories:**
  - Staffing Expenses
  - Janitorial
  - Security
  - Bingo COGS Exp
  - Meals/Refreshments
  - Marketing
  - Merchant Fee
  - Insurance
  - Utilities
  - Rent
  - Other
- **Records:** ~100-150 total

---

## Re-running Imports

Both scripts are **idempotent** - they delete existing data before inserting:
- `import-qb-data.js` - Deletes by month before inserting
- `import-spreadsheet-data.js` - Deletes all spreadsheet data before inserting

Safe to run multiple times!

---

## Next Steps

After importing data:
1. Build reconciliation UI to compare QB vs Spreadsheet
2. Build allocation rules engine
3. Allocate expenses to sessions

---

## Troubleshooting

**Error: "File not found"**
- Check that you're running from the correct directory
- Verify CSV files exist in `/mnt/c/Users/aring/NewCo/SAR/Vangaurd Reports/`

**Error: "Supabase insert error"**
- Check that schema is applied correctly
- Verify organization ID exists in `organizations` table
- Check Supabase service key is valid

**Error: "Invalid QB CSV format"**
- Verify CSV files are unmodified from QuickBooks export
- Check that header row matches expected format

---

## Support

For issues, check:
1. Console output for specific error messages
2. Supabase dashboard logs
3. Database schema is applied correctly
