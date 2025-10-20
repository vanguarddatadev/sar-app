# Expense Allocation System - Complete Design

## Overview

The SAR Allocation System handles complex expense allocation from QuickBooks and Spreadsheet data into two parallel paths:

1. **Monthly Forecast Path**: Monthly expense totals (with user override capability)
2. **Session Allocation Path**: Session-level expense breakdown (pure calculation, never modified)

## Architecture

```
┌─────────────────┐     ┌──────────────────────┐
│   QB Data       │────▶│                      │
│ (raw imports)   │     │  Allocation Rules    │
└─────────────────┘     │   (per category)     │
                        │                      │
┌─────────────────┐     └──────────┬───────────┘
│ Spreadsheet     │────▶           │
│ Data (actuals)  │                │
└─────────────────┘                │
                        ┌──────────┴───────────┐
                        │                      │
                        ▼                      ▼
             ┌──────────────────┐   ┌──────────────────────┐
             │ Monthly Forecast │   │ Session Allocated    │
             │ (auto-calculated)│   │   Expenses           │
             └────────┬─────────┘   │ (session-level)      │
                      │              └──────────┬───────────┘
                      ▼                         │
             ┌──────────────────┐               │
             │ Forecast Modified│               │
             │ (user overrides) │               │
             └──────────────────┘               │
                                                 ▼
                                      ┌─────────────────┐
                                      │ Sessions Table  │
                                      │ (enhanced with  │
                                      │  expense data)  │
                                      └─────────────────┘
```

## Database Tables

### Source Data
1. `qb_monthly_imports` - Raw QuickBooks P&L data by class
2. `spreadsheet_monthly_actuals` - Manually reviewed/calculated monthly actuals

### Allocation Engine
3. `allocation_rules` - Defines how each expense category is allocated
   - Maps QB accounts to Bingo categories
   - Defines location split method (BY_REVENUE, FIXED_PERCENT, LOCATION_ONLY)
   - Defines session allocation method (BY_REVENUE, BY_SESSION_COUNT, FIXED_PER_SESSION)
   - Stores Bingo percentage (e.g., 85% for Utilities)

### Output - Monthly Path
4. `monthly_forecast` - Auto-calculated monthly expenses by category/location
5. `monthly_forecast_modified` - User overrides (takes precedence over forecast)
6. `v_monthly_forecast_complete` - View combining forecast + overrides

### Output - Session Path
7. `session_allocated_expenses` - Session-level expense breakdown
8. `v_session_pl` - View showing session P&L (Revenue - COGS - Allocated Expenses)
9. `sessions` table enhanced with `allocated_expenses` column

## Allocation Rules

### Rule Structure

Each allocation rule has 3 steps:

**STEP 1: Bingo Percentage Filter**
- Some expenses are shared with non-Bingo operations
- `bingo_percentage` field (e.g., 85.00 for Utilities, 25.00 for Insurance)

**STEP 2: Location Split**
- `BY_REVENUE`: Split proportionally by location's monthly revenue
- `FIXED_PERCENT`: Fixed percentages (e.g., Insurance: 20% SC, 5% RWC)
- `LOCATION_ONLY`: Only allocate to one location (e.g., Janitorial: SC only, Rent: RWC only)

**STEP 3: Session Allocation**
- `BY_REVENUE`: Allocate proportionally by session revenue
- `BY_SESSION_COUNT`: Divide equally across sessions
- `FIXED_PER_SESSION`: Fixed amount per session (e.g., Rent: $1,200 per RWC session)

### Vanguard Bingo Rules

| Category | Source | Bingo % | Location Split | Allocation Method | Notes |
|----------|--------|---------|----------------|-------------------|-------|
| **Staffing Expenses** | Spreadsheet | 100% | BY_REVENUE | BY_REVENUE | Scales with revenue |
| **Janitorial** | Spreadsheet | 100% | LOCATION_ONLY (SC) | BY_SESSION_COUNT | RWC landlord pays |
| **Security** | Spreadsheet | 100% | BY_SESSION_COUNT | BY_SESSION_COUNT | Fixed per session, all locations |
| **Bingo COGS Exp** | Spreadsheet | 100% | BY_REVENUE | BY_REVENUE | Direct % of revenue |
| **Meals/Refreshments** | Spreadsheet | 100% | BY_REVENUE | BY_REVENUE | Scales with revenue |
| **Marketing** | Spreadsheet | 100% | BY_REVENUE | BY_REVENUE | Scales with revenue |
| **Merchant Fee** | Spreadsheet | 100% | BY_REVENUE | BY_REVENUE | Direct % of revenue |
| **Insurance** | Spreadsheet | 25% | FIXED_PERCENT (20% SC, 5% RWC) | BY_REVENUE | 75% to non-Bingo |
| **Utilities** | Spreadsheet | 85% | BY_REVENUE | BY_REVENUE | 15% to non-Bingo |
| **Rent** | Spreadsheet | 100% | LOCATION_ONLY (RWC) | FIXED_PER_SESSION | ~$1,200 per RWC session |
| **Other** | Spreadsheet | 100% | BY_REVENUE | BY_REVENUE | Miscellaneous |

## Allocation Examples

### Example 1: Security (BY_SESSION_COUNT)

**Scenario**: May 2025, Security = $11,736 total

**Calculation**:
```
SC Sessions: 17 sessions
RWC Sessions: 5 sessions
Total Sessions: 22

Security per session = $11,736 / 22 = $533.45

Each session gets $533.45 allocated
```

**Audit Trail**:
```sql
total_month_expense: 11736.00
allocation_method: BY_SESSION_COUNT
calculation_notes: "Security: $11,736 ÷ 22 sessions = $533.45 per session"
```

### Example 2: Merchant Fees (BY_REVENUE)

**Scenario**: June 2025, Merchant Fees = $20,873

**Month Totals**:
```
SC Revenue:  $2,130,000 (80.9%)
RWC Revenue: $  502,000 (19.1%)
Total:       $2,632,000
```

**Location Split**:
```
SC Merchant Fees:  $20,873 × 80.9% = $16,886
RWC Merchant Fees: $20,873 × 19.1% = $ 3,987
```

**Session Allocation** (Example SC session):
```
Session Revenue: $125,000
SC Total Revenue: $2,130,000
Session %: 5.87%

Session Merchant Fee = $16,886 × 5.87% = $991.20
```

**Audit Trail**:
```sql
total_month_expense: 20873.00
session_revenue: 125000.00
total_month_revenue: 2130000.00
revenue_percentage: 0.0587
allocated_amount: 991.20
calculation_notes: "Merchant Fee: ($20,873 × 80.9% SC split) × 5.87% session revenue"
```

### Example 3: Rent (FIXED_PER_SESSION)

**Scenario**: May 2025, Rent = $15,600, RWC only

**Calculation**:
```
RWC Sessions in May: 13 sessions
Rent per session = $15,600 / 13 = $1,200

Each RWC session gets $1,200
SC sessions get $0
```

**Audit Trail**:
```sql
total_month_expense: 15600.00
location_filter: RWC
allocation_method: FIXED_PER_SESSION
fixed_amount_per_session: 1200.00
calculation_notes: "Rent: $15,600 ÷ 13 RWC sessions = $1,200 per session"
```

### Example 4: Insurance (FIXED_PERCENT + BY_REVENUE)

**Scenario**: June 2025, QB Insurance = $10,256

**Step 1 - Bingo %**: 25% to Bingo (20% SC + 5% RWC)
```
Bingo Insurance = $10,256 × 25% = $2,564
```

**Step 2 - Location Split**: Fixed percentages
```
SC Insurance:  $10,256 × 20% = $2,051.20
RWC Insurance: $10,256 × 5%  = $  512.80
```

**Step 3 - Session Allocation**: BY_REVENUE (same as Merchant Fees example)
```
SC Session (5.87% of SC revenue):
$2,051.20 × 5.87% = $120.40
```

**Audit Trail**:
```sql
total_month_expense: 10256.00
source_amount: 2564.00  -- After 25% Bingo filter
session_revenue: 125000.00
total_month_revenue: 2130000.00
revenue_percentage: 0.0587
allocated_amount: 120.40
calculation_notes: "Insurance: ($10,256 × 20% SC split) × 5.87% session revenue"
```

## Installation

### 1. Apply Schema

```bash
# Copy to clipboard
cat ~/OneDrive/Documents/GitHub/sar-app/db/allocation-system-schema.sql

# Paste into Supabase SQL Editor and run
```

### 2. Seed Allocation Rules

```bash
# First, get your organization ID
# In Supabase SQL Editor:
SELECT id FROM organizations WHERE name = 'Vanguard Music and Performing Arts';

# Edit allocation-rules-seed.sql and replace 'YOUR_ORG_ID' with actual UUID

# Run the seed file
cat ~/OneDrive/Documents/GitHub/sar-app/db/allocation-rules-seed.sql
# Paste into Supabase SQL Editor and run
```

### 3. Verify Rules

```sql
SELECT
  display_order,
  bingo_category,
  bingo_percentage || '%' as bingo_pct,
  location_split_method,
  CASE
    WHEN location_filter IS NOT NULL THEN location_filter || ' only'
    WHEN sc_fixed_percent IS NOT NULL THEN 'SC: ' || sc_fixed_percent || '%, RWC: ' || rwc_fixed_percent || '%'
    ELSE 'Both locations'
  END as location_split,
  allocation_method,
  CASE WHEN use_spreadsheet THEN 'Spreadsheet' ELSE 'QB' END as source,
  formula_display
FROM allocation_rules
WHERE organization_id = 'YOUR_ORG_ID'
ORDER BY display_order;
```

Expected output: 11 rows (Staffing, Janitorial, Security, COGS, Meals, Marketing, Merchant Fee, Insurance, Utilities, Rent, Other)

## Next Steps

### Allocation Engine Implementation

**Option 1: Node.js Script** (Recommended for batch processing)
- Create `run-allocation.js`
- Reads QB/Spreadsheet data
- Applies allocation rules
- Writes to `monthly_forecast` and `session_allocated_expenses`

**Option 2: PostgreSQL Function** (For real-time allocation)
- Create stored procedure
- Can be triggered automatically when data changes
- More complex but better for live updates

**Option 3: Hybrid**
- Node.js for monthly forecast generation
- Real-time UI updates for modified forecasts

### UI Requirements

1. **Expense Rules Management** (`/expense-rules` view - already exists!)
   - Display allocation_rules in table
   - Show formula_display for each rule
   - Allow editing: bingo_percentage, location split, allocation method
   - Preview impact of rule changes

2. **Monthly Forecast Review**
   - Show monthly_forecast by category/location
   - Compare QB vs Spreadsheet vs Forecast
   - Allow manual overrides (creates monthly_forecast_modified records)
   - Highlight which values are modified vs auto-calculated

3. **Session P&L View**
   - Show session-level breakdown
   - Display allocated expenses by category
   - Calculate session EBITDA
   - Export to CSV/Excel

## Questions & Clarifications

1. **Rent Calculation**: Should rent be calculated dynamically (`total_rent / session_count`) or use fixed `$1,200` value?
   - Current implementation: Uses `fixed_amount_per_session` = 1200.00
   - Can be adjusted per rule

2. **COGS Rate**: Is COGS truly a % or should we use actual COGS amounts from spreadsheet?
   - Current: Allocates actual COGS amount by revenue proportion
   - Alternative: Calculate COGS_Rate × Session_Revenue

3. **Insurance Clarification**: Confirmed that 25% total goes to Bingo (20% SC + 5% RWC), remaining 75% to other operations

4. **Data Priority**: Spreadsheet data takes precedence over QB data when `use_spreadsheet = true`

## Files Created

1. `/db/allocation-system-schema.sql` - Complete database schema
2. `/db/allocation-rules-seed.sql` - 11 pre-configured allocation rules
3. `/db/ALLOCATION_SYSTEM_README.md` - This documentation

## Status

- ✅ Schema designed
- ✅ Rules seeded
- ✅ Documentation complete
- ⏳ Allocation engine (pending)
- ⏳ UI implementation (pending)
- ⏳ Testing with real data (pending)
