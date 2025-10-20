-- ============================================
-- SAR ALLOCATION RULES - Seed Data
-- Pre-configured rules for Vanguard Bingo expense allocation
-- ============================================

-- NOTE: Replace 'YOUR_ORG_ID' with actual organization UUID
-- Get it with: SELECT id FROM organizations WHERE name = 'Vanguard Music and Performing Arts';

-- ============================================
-- 1. STAFFING EXPENSES
-- Full amount divided by revenue across all sessions
-- ============================================
INSERT INTO allocation_rules (
  organization_id,
  bingo_category,
  display_name,
  display_order,
  qb_account_numbers,
  qb_account_names,
  use_spreadsheet,
  bingo_percentage,
  location_split_method,
  allocation_method,
  notes,
  formula_display
) VALUES (
  'YOUR_ORG_ID',
  'Staffing Expenses',
  'Staffing Expenses',
  1,
  ARRAY['6020', '6020.01', '6020.02'],  -- Adjust based on actual QB accounts
  ARRAY['Hourly', 'Salary', 'Benefits'],
  true,  -- Use spreadsheet actuals
  100.00,
  'BY_REVENUE',  -- Split by location revenue first
  'BY_REVENUE',  -- Then divide within each location by session revenue
  'Staffing costs scale with revenue',
  'Spreadsheet Total ÷ Revenue per Session'
);

-- ============================================
-- 2. JANITORIAL
-- SC ONLY, divided by number of SC sessions
-- (RWC landlord pays)
-- ============================================
INSERT INTO allocation_rules (
  organization_id,
  bingo_category,
  display_name,
  display_order,
  qb_account_numbers,
  use_spreadsheet,
  bingo_percentage,
  location_split_method,
  location_filter,
  allocation_method,
  notes,
  formula_display
) VALUES (
  'YOUR_ORG_ID',
  'Janitorial',
  'Janitorial',
  2,
  ARRAY['6410'],  -- QB Janitorial account
  true,  -- Use spreadsheet
  100.00,
  'LOCATION_ONLY',
  'SC',  -- SC only
  'BY_SESSION_COUNT',  -- Divide equally across SC sessions
  'RWC landlord pays janitorial - only allocate to SC sessions',
  'Spreadsheet SC Total ÷ Number of SC Sessions'
);

-- ============================================
-- 3. SECURITY
-- Total amount divided by ALL sessions (SC + RWC)
-- ============================================
INSERT INTO allocation_rules (
  organization_id,
  bingo_category,
  display_name,
  display_order,
  qb_account_numbers,
  use_spreadsheet,
  bingo_percentage,
  location_split_method,
  allocation_method,
  notes,
  formula_display
) VALUES (
  'YOUR_ORG_ID',
  'Security',
  'Security',
  3,
  ARRAY['6420'],  -- QB Security account
  true,  -- Use spreadsheet
  100.00,
  'BY_SESSION_COUNT',  -- Don't split by revenue first, just count sessions
  'BY_SESSION_COUNT',  -- Divide equally across ALL sessions
  'Security is fixed per session regardless of revenue',
  'Spreadsheet Total ÷ Total Number of Sessions (SC + RWC)'
);

-- ============================================
-- 4. BINGO COGS EXPENSE
-- Direct percentage of revenue (COGS Rate)
-- ============================================
INSERT INTO allocation_rules (
  organization_id,
  bingo_category,
  display_name,
  display_order,
  qb_account_numbers,
  qb_account_names,
  use_spreadsheet,
  bingo_percentage,
  location_split_method,
  allocation_method,
  notes,
  formula_display
) VALUES (
  'YOUR_ORG_ID',
  'Bingo COGS Exp',
  'Bingo COGS',
  4,
  ARRAY['5010', '5012', '5020'],  -- QB COGS accounts
  ARRAY['Cherry Sales', 'Flash Sales', 'Strip Sales'],
  true,  -- Use spreadsheet
  100.00,
  'BY_REVENUE',
  'BY_REVENUE',
  'COGS is direct % of revenue - allocate proportionally',
  'Spreadsheet Total ÷ Revenue per Session (Derived COGS %)'
);

-- ============================================
-- 5. MEALS/REFRESHMENTS
-- Divided by revenue
-- ============================================
INSERT INTO allocation_rules (
  organization_id,
  bingo_category,
  display_name,
  display_order,
  qb_account_numbers,
  use_spreadsheet,
  bingo_percentage,
  location_split_method,
  allocation_method,
  notes,
  formula_display
) VALUES (
  'YOUR_ORG_ID',
  'Meals/Refreshments',
  'Meals/Refreshments',
  5,
  ARRAY['6100'],  -- QB Meals account
  true,
  100.00,
  'BY_REVENUE',
  'BY_REVENUE',
  'Meals scale with revenue',
  'Spreadsheet Total ÷ Revenue per Session'
);

-- ============================================
-- 6. MARKETING
-- Divided by revenue
-- ============================================
INSERT INTO allocation_rules (
  organization_id,
  bingo_category,
  display_name,
  display_order,
  qb_account_numbers,
  use_spreadsheet,
  bingo_percentage,
  location_split_method,
  allocation_method,
  notes,
  formula_display
) VALUES (
  'YOUR_ORG_ID',
  'Marketing',
  'Marketing',
  6,
  ARRAY['6200'],  -- QB Marketing account
  true,
  100.00,
  'BY_REVENUE',
  'BY_REVENUE',
  'Marketing scales with revenue',
  'Spreadsheet Total ÷ Revenue per Session'
);

-- ============================================
-- 7. MERCHANT FEE
-- Divided by revenue (direct % of revenue)
-- ============================================
INSERT INTO allocation_rules (
  organization_id,
  bingo_category,
  display_name,
  display_order,
  qb_account_numbers,
  use_spreadsheet,
  bingo_percentage,
  location_split_method,
  allocation_method,
  notes,
  formula_display
) VALUES (
  'YOUR_ORG_ID',
  'Merchant Fee',
  'Merchant Fees',
  7,
  ARRAY['6300'],  -- QB Merchant Fees account
  true,
  100.00,
  'BY_REVENUE',
  'BY_REVENUE',
  'Merchant fees are direct % of revenue',
  'Spreadsheet Total ÷ Revenue per Session'
);

-- ============================================
-- 8. INSURANCE
-- QB: 20% to SC, 5% to RWC, remaining 75% elsewhere
-- Then divided by revenue within each location
-- ============================================
INSERT INTO allocation_rules (
  organization_id,
  bingo_category,
  display_name,
  display_order,
  qb_account_numbers,
  use_spreadsheet,
  bingo_percentage,
  location_split_method,
  sc_fixed_percent,
  rwc_fixed_percent,
  allocation_method,
  notes,
  formula_display
) VALUES (
  'YOUR_ORG_ID',
  'Insurance',
  'Insurance',
  8,
  ARRAY['6410.01', '6410.02'],  -- QB Insurance accounts
  true,
  25.00,  -- Only 25% total to Bingo (20% SC + 5% RWC)
  'FIXED_PERCENT',
  20.00,  -- SC gets 20% of QB total
  5.00,   -- RWC gets 5% of QB total
  'BY_REVENUE',
  'Insurance: 20% allocated to SC, 5% to RWC, rest to other operations',
  'QB Total × 20% (SC) or 5% (RWC), then ÷ Revenue per Session'
);

-- ============================================
-- 9. UTILITIES
-- 85% of QB amount allocated to Bingo
-- Then divided by revenue
-- ============================================
INSERT INTO allocation_rules (
  organization_id,
  bingo_category,
  display_name,
  display_order,
  qb_account_numbers,
  use_spreadsheet,
  bingo_percentage,
  location_split_method,
  allocation_method,
  notes,
  formula_display
) VALUES (
  'YOUR_ORG_ID',
  'Utilities',
  'Utilities',
  9,
  ARRAY['6500'],  -- QB Utilities account
  true,
  85.00,  -- 85% to Bingo, 15% elsewhere
  'BY_REVENUE',
  'BY_REVENUE',
  'Only 85% of utilities allocated to Bingo operations',
  '(Spreadsheet Total × 85%) ÷ Revenue per Session'
);

-- ============================================
-- 10. RENT
-- RWC ONLY, fixed amount per session
-- ============================================
INSERT INTO allocation_rules (
  organization_id,
  bingo_category,
  display_name,
  display_order,
  qb_account_numbers,
  use_spreadsheet,
  bingo_percentage,
  location_split_method,
  location_filter,
  allocation_method,
  fixed_amount_per_session,
  notes,
  formula_display
) VALUES (
  'YOUR_ORG_ID',
  'Rent',
  'Rent',
  10,
  ARRAY['6600'],  -- QB Rent account
  true,
  100.00,
  'LOCATION_ONLY',
  'RWC',  -- RWC only
  'FIXED_PER_SESSION',
  1200.00,  -- $1200 per RWC session (will be calculated from data)
  'Rent only applies to RWC - fixed amount per session',
  'Monthly Rent ÷ Number of RWC Sessions = ~$1,200 per session'
);

-- ============================================
-- 11. OTHER
-- Full amount divided by revenue
-- ============================================
INSERT INTO allocation_rules (
  organization_id,
  bingo_category,
  display_name,
  display_order,
  qb_account_numbers,
  use_spreadsheet,
  bingo_percentage,
  location_split_method,
  allocation_method,
  notes,
  formula_display
) VALUES (
  'YOUR_ORG_ID',
  'Other',
  'Other Expenses',
  11,
  ARRAY['6900'],  -- QB Other account
  true,
  100.00,
  'BY_REVENUE',
  'BY_REVENUE',
  'Miscellaneous expenses divided by revenue',
  'Spreadsheet Total ÷ Revenue per Session'
);

-- ============================================
-- VERIFICATION QUERY
-- Run this after seeding to verify rules
-- ============================================
/*
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
*/
