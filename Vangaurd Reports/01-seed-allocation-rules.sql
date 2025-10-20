-- ============================================
-- Seed Allocation Rules for Vanguard (org_1)
-- ============================================

DO $$
DECLARE
  org1_id UUID;
BEGIN
  -- Get org_1 UUID
  SELECT id INTO org1_id FROM organizations WHERE name = 'org_1';

  -- 1. Staffing Expenses
  INSERT INTO allocation_rules (
    organization_id, bingo_category, display_name, display_order,
    use_spreadsheet, bingo_percentage,
    location_split_method, allocation_method,
    notes, formula_display
  ) VALUES (
    org1_id, 'Staffing Expenses', 'Staffing Expenses', 1,
    true, 100.00,
    'BY_REVENUE', 'BY_REVENUE',
    '100% Bingo. Split by revenue across all sessions.',
    'Spreadsheet Total × (Session Revenue ÷ Total Month Revenue)'
  );

  -- 2. Janitorial
  INSERT INTO allocation_rules (
    organization_id, bingo_category, display_name, display_order,
    use_spreadsheet, bingo_percentage,
    location_split_method, location_filter, allocation_method,
    notes, formula_display
  ) VALUES (
    org1_id, 'Janitorial', 'Janitorial', 2,
    true, 100.00,
    'LOCATION_ONLY', 'SC', 'BY_SESSION_COUNT',
    '100% Bingo, SC only (RWC landlord pays). Divide equally across SC sessions.',
    'Spreadsheet SC Total ÷ Number of SC Sessions'
  );

  -- 3. Security
  INSERT INTO allocation_rules (
    organization_id, bingo_category, display_name, display_order,
    use_spreadsheet, bingo_percentage,
    location_split_method, allocation_method,
    notes, formula_display
  ) VALUES (
    org1_id, 'Security', 'Security', 3,
    true, 100.00,
    'BY_REVENUE', 'BY_SESSION_COUNT',
    '100% Bingo. Divide equally across ALL sessions.',
    'Spreadsheet Total ÷ Number of All Sessions'
  );

  -- 4. Bingo COGS Exp
  INSERT INTO allocation_rules (
    organization_id, bingo_category, display_name, display_order,
    use_spreadsheet, bingo_percentage,
    location_split_method, allocation_method,
    notes, formula_display
  ) VALUES (
    org1_id, 'Bingo COGS Exp', 'Bingo COGS', 4,
    true, 100.00,
    'BY_REVENUE', 'BY_REVENUE',
    '100% Bingo. Direct % of revenue (COGS derived after allocation).',
    'Spreadsheet Total × (Session Revenue ÷ Total Month Revenue)'
  );

  -- 5. Meals/Refreshments
  INSERT INTO allocation_rules (
    organization_id, bingo_category, display_name, display_order,
    use_spreadsheet, bingo_percentage,
    location_split_method, allocation_method,
    notes, formula_display
  ) VALUES (
    org1_id, 'Meals/Refreshments', 'Meals/Refreshments', 5,
    true, 100.00,
    'BY_REVENUE', 'BY_REVENUE',
    '100% Bingo. Split by revenue.',
    'Spreadsheet Total × (Session Revenue ÷ Total Month Revenue)'
  );

  -- 6. Marketing
  INSERT INTO allocation_rules (
    organization_id, bingo_category, display_name, display_order,
    use_spreadsheet, bingo_percentage,
    location_split_method, allocation_method,
    notes, formula_display
  ) VALUES (
    org1_id, 'Marketing', 'Marketing', 6,
    true, 100.00,
    'BY_REVENUE', 'BY_REVENUE',
    '100% Bingo. Split by revenue.',
    'Spreadsheet Total × (Session Revenue ÷ Total Month Revenue)'
  );

  -- 7. Merchant Fee
  INSERT INTO allocation_rules (
    organization_id, bingo_category, display_name, display_order,
    use_spreadsheet, bingo_percentage,
    location_split_method, allocation_method,
    notes, formula_display
  ) VALUES (
    org1_id, 'Merchant Fee', 'Merchant Fee', 7,
    true, 100.00,
    'BY_REVENUE', 'BY_REVENUE',
    '100% Bingo. Direct % of revenue.',
    'Spreadsheet Total × (Session Revenue ÷ Total Month Revenue)'
  );

  -- 8. Insurance
  INSERT INTO allocation_rules (
    organization_id, bingo_category, display_name, display_order,
    qb_account_numbers, bingo_percentage,
    location_split_method, sc_fixed_percent, rwc_fixed_percent,
    allocation_method,
    notes, formula_display
  ) VALUES (
    org1_id, 'Insurance', 'Insurance', 8,
    ARRAY['6500'], 25.00,
    'FIXED_PERCENT', 20.00, 5.00,
    'BY_REVENUE',
    '25% Bingo (75% non-Bingo). SC 20%, RWC 5%. Split by revenue within each location.',
    'QB Total × 25% × Location% × (Session Revenue ÷ Location Month Revenue)'
  );

  -- 9. Utilities
  INSERT INTO allocation_rules (
    organization_id, bingo_category, display_name, display_order,
    qb_account_numbers, bingo_percentage,
    location_split_method, allocation_method,
    notes, formula_display
  ) VALUES (
    org1_id, 'Utilities', 'Utilities', 9,
    ARRAY['6800'], 85.00,
    'BY_REVENUE', 'BY_REVENUE',
    '85% Bingo, 15% non-Bingo. Split by revenue.',
    'QB Total × 85% × (Session Revenue ÷ Total Month Revenue)'
  );

  -- 10. Rent
  INSERT INTO allocation_rules (
    organization_id, bingo_category, display_name, display_order,
    qb_account_numbers, bingo_percentage,
    location_split_method, location_filter,
    allocation_method, fixed_amount_per_session,
    notes, formula_display
  ) VALUES (
    org1_id, 'Rent', 'Rent', 10,
    ARRAY['6700'], 100.00,
    'LOCATION_ONLY', 'RWC',
    'FIXED_PER_SESSION', 1200.00,
    '100% Bingo, RWC only. ~$1,200 per session.',
    '$1,200 per RWC Session'
  );

  -- 11. Other
  INSERT INTO allocation_rules (
    organization_id, bingo_category, display_name, display_order,
    use_spreadsheet, bingo_percentage,
    location_split_method, allocation_method,
    notes, formula_display
  ) VALUES (
    org1_id, 'Other', 'Other Expenses', 11,
    true, 100.00,
    'BY_REVENUE', 'BY_REVENUE',
    '100% Bingo. Split by revenue.',
    'Spreadsheet Total × (Session Revenue ÷ Total Month Revenue)'
  );

  RAISE NOTICE 'Seeded 11 allocation rules for org_1 (Vanguard)';
END $$;

-- Verification
SELECT
  display_order,
  bingo_category,
  display_name,
  bingo_percentage,
  location_split_method,
  allocation_method,
  CASE WHEN use_spreadsheet THEN 'Spreadsheet' ELSE 'QB: ' || array_to_string(qb_account_numbers, ', ') END as source
FROM allocation_rules
WHERE organization_id = (SELECT id FROM organizations WHERE name = 'org_1')
ORDER BY display_order;
