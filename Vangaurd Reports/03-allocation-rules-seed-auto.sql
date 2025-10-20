-- ============================================
-- SAR ALLOCATION RULES - Auto-Seed for Org 1
-- No manual UUID editing required!
-- ============================================

DO $$
DECLARE
  org1_id UUID;
BEGIN
  -- Get org_1 UUID automatically
  SELECT id INTO org1_id FROM organizations WHERE name = 'org_1';

  IF org1_id IS NULL THEN
    RAISE EXCEPTION 'Organization org_1 not found. Run 02-create-two-orgs.sql first!';
  END IF;

  RAISE NOTICE 'Creating allocation rules for org_1 (UUID: %)', org1_id;

  -- ============================================
  -- 1. STAFFING EXPENSES
  -- ============================================
  INSERT INTO allocation_rules (
    organization_id, bingo_category, display_name, display_order,
    qb_account_numbers, qb_account_names, use_spreadsheet,
    bingo_percentage, location_split_method, allocation_method,
    notes, formula_display
  ) VALUES (
    org1_id, 'Staffing Expenses', 'Staffing Expenses', 1,
    ARRAY['6020', '6020.01', '6020.02'], ARRAY['Hourly', 'Salary', 'Benefits'],
    true, 100.00, 'BY_REVENUE', 'BY_REVENUE',
    'Staffing costs scale with revenue',
    'Spreadsheet Total ÷ Revenue per Session'
  ) ON CONFLICT (organization_id, bingo_category) DO NOTHING;

  -- ============================================
  -- 2. JANITORIAL
  -- ============================================
  INSERT INTO allocation_rules (
    organization_id, bingo_category, display_name, display_order,
    qb_account_numbers, use_spreadsheet, bingo_percentage,
    location_split_method, location_filter, allocation_method,
    notes, formula_display
  ) VALUES (
    org1_id, 'Janitorial', 'Janitorial', 2,
    ARRAY['6410'], true, 100.00,
    'LOCATION_ONLY', 'SC', 'BY_SESSION_COUNT',
    'RWC landlord pays janitorial - only allocate to SC sessions',
    'Spreadsheet SC Total ÷ Number of SC Sessions'
  ) ON CONFLICT (organization_id, bingo_category) DO NOTHING;

  -- ============================================
  -- 3. SECURITY
  -- ============================================
  INSERT INTO allocation_rules (
    organization_id, bingo_category, display_name, display_order,
    qb_account_numbers, use_spreadsheet, bingo_percentage,
    location_split_method, allocation_method,
    notes, formula_display
  ) VALUES (
    org1_id, 'Security', 'Security', 3,
    ARRAY['6420'], true, 100.00,
    'BY_SESSION_COUNT', 'BY_SESSION_COUNT',
    'Security is fixed per session regardless of revenue',
    'Spreadsheet Total ÷ Total Number of Sessions (SC + RWC)'
  ) ON CONFLICT (organization_id, bingo_category) DO NOTHING;

  -- ============================================
  -- 4. BINGO COGS EXPENSE
  -- ============================================
  INSERT INTO allocation_rules (
    organization_id, bingo_category, display_name, display_order,
    qb_account_numbers, qb_account_names, use_spreadsheet,
    bingo_percentage, location_split_method, allocation_method,
    notes, formula_display
  ) VALUES (
    org1_id, 'Bingo COGS Exp', 'Bingo COGS', 4,
    ARRAY['5010', '5012', '5020'], ARRAY['Cherry Sales', 'Flash Sales', 'Strip Sales'],
    true, 100.00, 'BY_REVENUE', 'BY_REVENUE',
    'COGS is direct % of revenue - allocate proportionally',
    'Spreadsheet Total ÷ Revenue per Session (Derived COGS %)'
  ) ON CONFLICT (organization_id, bingo_category) DO NOTHING;

  -- ============================================
  -- 5. MEALS/REFRESHMENTS
  -- ============================================
  INSERT INTO allocation_rules (
    organization_id, bingo_category, display_name, display_order,
    qb_account_numbers, use_spreadsheet, bingo_percentage,
    location_split_method, allocation_method,
    notes, formula_display
  ) VALUES (
    org1_id, 'Meals/Refreshments', 'Meals/Refreshments', 5,
    ARRAY['6100'], true, 100.00,
    'BY_REVENUE', 'BY_REVENUE',
    'Meals scale with revenue',
    'Spreadsheet Total ÷ Revenue per Session'
  ) ON CONFLICT (organization_id, bingo_category) DO NOTHING;

  -- ============================================
  -- 6. MARKETING
  -- ============================================
  INSERT INTO allocation_rules (
    organization_id, bingo_category, display_name, display_order,
    qb_account_numbers, use_spreadsheet, bingo_percentage,
    location_split_method, allocation_method,
    notes, formula_display
  ) VALUES (
    org1_id, 'Marketing', 'Marketing', 6,
    ARRAY['6200'], true, 100.00,
    'BY_REVENUE', 'BY_REVENUE',
    'Marketing scales with revenue',
    'Spreadsheet Total ÷ Revenue per Session'
  ) ON CONFLICT (organization_id, bingo_category) DO NOTHING;

  -- ============================================
  -- 7. MERCHANT FEE
  -- ============================================
  INSERT INTO allocation_rules (
    organization_id, bingo_category, display_name, display_order,
    qb_account_numbers, use_spreadsheet, bingo_percentage,
    location_split_method, allocation_method,
    notes, formula_display
  ) VALUES (
    org1_id, 'Merchant Fee', 'Merchant Fees', 7,
    ARRAY['6300'], true, 100.00,
    'BY_REVENUE', 'BY_REVENUE',
    'Merchant fees are direct % of revenue',
    'Spreadsheet Total ÷ Revenue per Session'
  ) ON CONFLICT (organization_id, bingo_category) DO NOTHING;

  -- ============================================
  -- 8. INSURANCE
  -- ============================================
  INSERT INTO allocation_rules (
    organization_id, bingo_category, display_name, display_order,
    qb_account_numbers, use_spreadsheet, bingo_percentage,
    location_split_method, sc_fixed_percent, rwc_fixed_percent,
    allocation_method, notes, formula_display
  ) VALUES (
    org1_id, 'Insurance', 'Insurance', 8,
    ARRAY['6410.01', '6410.02'], true, 25.00,
    'FIXED_PERCENT', 20.00, 5.00, 'BY_REVENUE',
    'Insurance: 20% allocated to SC, 5% to RWC, rest to other operations',
    'QB Total × 20% (SC) or 5% (RWC), then ÷ Revenue per Session'
  ) ON CONFLICT (organization_id, bingo_category) DO NOTHING;

  -- ============================================
  -- 9. UTILITIES
  -- ============================================
  INSERT INTO allocation_rules (
    organization_id, bingo_category, display_name, display_order,
    qb_account_numbers, use_spreadsheet, bingo_percentage,
    location_split_method, allocation_method,
    notes, formula_display
  ) VALUES (
    org1_id, 'Utilities', 'Utilities', 9,
    ARRAY['6500'], true, 85.00,
    'BY_REVENUE', 'BY_REVENUE',
    'Only 85% of utilities allocated to Bingo operations',
    '(Spreadsheet Total × 85%) ÷ Revenue per Session'
  ) ON CONFLICT (organization_id, bingo_category) DO NOTHING;

  -- ============================================
  -- 10. RENT
  -- ============================================
  INSERT INTO allocation_rules (
    organization_id, bingo_category, display_name, display_order,
    qb_account_numbers, use_spreadsheet, bingo_percentage,
    location_split_method, location_filter, allocation_method,
    fixed_amount_per_session, notes, formula_display
  ) VALUES (
    org1_id, 'Rent', 'Rent', 10,
    ARRAY['6600'], true, 100.00,
    'LOCATION_ONLY', 'RWC', 'FIXED_PER_SESSION', 1200.00,
    'Rent only applies to RWC - fixed amount per session',
    'Monthly Rent ÷ Number of RWC Sessions = ~$1,200 per session'
  ) ON CONFLICT (organization_id, bingo_category) DO NOTHING;

  -- ============================================
  -- 11. OTHER
  -- ============================================
  INSERT INTO allocation_rules (
    organization_id, bingo_category, display_name, display_order,
    qb_account_numbers, use_spreadsheet, bingo_percentage,
    location_split_method, allocation_method,
    notes, formula_display
  ) VALUES (
    org1_id, 'Other', 'Other Expenses', 11,
    ARRAY['6900'], true, 100.00,
    'BY_REVENUE', 'BY_REVENUE',
    'Miscellaneous expenses divided by revenue',
    'Spreadsheet Total ÷ Revenue per Session'
  ) ON CONFLICT (organization_id, bingo_category) DO NOTHING;

  RAISE NOTICE '=== ALLOCATION RULES SEEDED ===';
  RAISE NOTICE 'Created 11 allocation rules for org_1';
END $$;

-- Verify rules were created
SELECT
  display_order,
  bingo_category,
  bingo_percentage || '%' as bingo_pct,
  location_split_method,
  allocation_method,
  formula_display
FROM allocation_rules
WHERE organization_id = (SELECT id FROM organizations WHERE name = 'org_1')
ORDER BY display_order;
