-- Migration: Add notes and qb_percentage to qb_category_mapping
-- Date: 2025-10-21
-- Purpose: Allow finance person to document QB category mappings and set percentage overrides

-- Add notes field to qb_category_mapping table
ALTER TABLE qb_category_mapping 
ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN qb_category_mapping.notes IS 'Notes about why this QB category is mapped this way, or special handling instructions';

-- Add qb_percentage to qb_category_mapping for per-category percentage overrides
ALTER TABLE qb_category_mapping
ADD COLUMN IF NOT EXISTS qb_percentage NUMERIC DEFAULT 100;

COMMENT ON COLUMN qb_category_mapping.qb_percentage IS 'Percentage of this QB category amount to use (0-100). Default 100 means use full amount. Use 50 for "Payroll Taxes" to approximate hourly-only portion.';

-- Now populate the correct mappings based on our analysis
-- This assumes allocation_rules already exist for these categories

DO $$
DECLARE
    v_org_id UUID;
    v_security_rule_id UUID;
    v_janitorial_rule_id UUID;
    v_rent_rule_id UUID;
    v_marketing_rule_id UUID;
    v_meals_rule_id UUID;
    v_merchant_rule_id UUID;
    v_staffing_rule_id UUID;
    v_utilities_rule_id UUID;
    v_other_rule_id UUID;
BEGIN
    -- Get the organization ID (assuming single org, adjust if multi-tenant)
    SELECT id INTO v_org_id FROM organizations LIMIT 1;

    -- Get allocation rule IDs
    SELECT id INTO v_security_rule_id FROM allocation_rules WHERE expense_category = 'Security' AND organization_id = v_org_id;
    SELECT id INTO v_janitorial_rule_id FROM allocation_rules WHERE expense_category = 'Janitorial' AND organization_id = v_org_id;
    SELECT id INTO v_rent_rule_id FROM allocation_rules WHERE expense_category = 'Rent' AND organization_id = v_org_id;
    SELECT id INTO v_marketing_rule_id FROM allocation_rules WHERE expense_category = 'Marketing' AND organization_id = v_org_id;
    SELECT id INTO v_meals_rule_id FROM allocation_rules WHERE expense_category = 'Meals/Refreshments' AND organization_id = v_org_id;
    SELECT id INTO v_merchant_rule_id FROM allocation_rules WHERE expense_category = 'Merchant Fee' AND organization_id = v_org_id;
    SELECT id INTO v_staffing_rule_id FROM allocation_rules WHERE expense_category = 'Staffing Expenses' AND organization_id = v_org_id;
    SELECT id INTO v_utilities_rule_id FROM allocation_rules WHERE expense_category = 'Utilities' AND organization_id = v_org_id;
    SELECT id INTO v_other_rule_id FROM allocation_rules WHERE expense_category = 'Other' AND organization_id = v_org_id;

    -- Clear existing mappings to start fresh
    DELETE FROM qb_category_mapping WHERE organization_id = v_org_id;

    -- Security: 6040 Security Service
    INSERT INTO qb_category_mapping (organization_id, qb_category_name, allocation_rule_id, qb_percentage, notes)
    VALUES (v_org_id, '6040 Security Service', v_security_rule_id, 100, 'Bingo classes only - security guard services for bingo operations');

    -- Janitorial: 6085 Janitorial
    INSERT INTO qb_category_mapping (organization_id, qb_category_name, allocation_rule_id, qb_percentage, notes)
    VALUES (v_org_id, '6085 Janitorial', v_janitorial_rule_id, 100, 'Bingo classes only - janitorial services at bingo locations');

    -- Rent: 6051 Rent
    INSERT INTO qb_category_mapping (organization_id, qb_category_name, allocation_rule_id, qb_percentage, notes)
    VALUES (v_org_id, '6051 Rent', v_rent_rule_id, 100, 'Bingo classes only - facility rent for RWC location');

    -- Marketing: 6050 Advertising
    INSERT INTO qb_category_mapping (organization_id, qb_category_name, allocation_rule_id, qb_percentage, notes)
    VALUES (v_org_id, '6050 Advertising', v_marketing_rule_id, 100, 'Bingo classes only - advertising and promotional expenses');

    -- Meals/Refreshments: 6030 Refreshments/Meals (NOT 6060 Employee Meals)
    INSERT INTO qb_category_mapping (organization_id, qb_category_name, allocation_rule_id, qb_percentage, notes)
    VALUES (v_org_id, '6030 Refreshments/Meals', v_meals_rule_id, 100, 'Bingo classes only - customer refreshments. Excludes 6060 Employee Meals which is incorrectly classified.');

    -- Merchant Fee: 5095 Credit Card Merchant Fees (from COGS section)
    INSERT INTO qb_category_mapping (organization_id, qb_category_name, allocation_rule_id, qb_percentage, notes)
    VALUES (v_org_id, '5095 Credit Card Merchant Fees', v_merchant_rule_id, 100, 'Bingo classes only - credit card processing fees for customer payments');

    -- Staffing Expenses: 6020 Hourly + 6115 Payroll Taxes (50%)
    INSERT INTO qb_category_mapping (organization_id, qb_category_name, allocation_rule_id, qb_percentage, notes)
    VALUES (v_org_id, '6020 Hourly', v_staffing_rule_id, 100, 'Bingo classes only - hourly employee wages for bingo operations');

    INSERT INTO qb_category_mapping (organization_id, qb_category_name, allocation_rule_id, qb_percentage, notes)
    VALUES (v_org_id, '6115 Payroll Taxes', v_staffing_rule_id, 50, 'Bingo classes only - Use 50% to approximate hourly-only payroll taxes. Excludes salary portion (6010 Salary not mapped).');

    -- Utilities: 6150 Utilities - Power (NOT 6088, NOT wireless/internet)
    INSERT INTO qb_category_mapping (organization_id, qb_category_name, allocation_rule_id, qb_percentage, notes)
    VALUES (v_org_id, '6150 Utilities - Power', v_utilities_rule_id, 100, 'Shared Services class - electricity costs. Note: 6088 Utilities is incomplete, 6160/6170 phones/internet excluded.');

    -- Other: 6080 Equip Repairs + 6082 Office Supplies + 6195 Outside Storage
    INSERT INTO qb_category_mapping (organization_id, qb_category_name, allocation_rule_id, qb_percentage, notes)
    VALUES (v_org_id, '6080 Equip. Repairs and Maintenance', v_other_rule_id, 100, 'Bingo classes only - equipment repairs for bingo operations');

    INSERT INTO qb_category_mapping (organization_id, qb_category_name, allocation_rule_id, qb_percentage, notes)
    VALUES (v_org_id, '6082 Office Supplies, Decor and Fees', v_other_rule_id, 100, 'Bingo classes only - office supplies and decorations');

    INSERT INTO qb_category_mapping (organization_id, qb_category_name, allocation_rule_id, qb_percentage, notes)
    VALUES (v_org_id, '6195 Outside Storage', v_other_rule_id, 100, 'Bingo classes only - external storage costs');

    RAISE NOTICE 'QB category mappings created successfully for organization %', v_org_id;

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error creating QB mappings: %', SQLERRM;
END $$;

-- Verify mappings
SELECT 
    ar.expense_category,
    qcm.qb_category_name,
    qcm.qb_percentage,
    qcm.notes
FROM qb_category_mapping qcm
JOIN allocation_rules ar ON ar.id = qcm.allocation_rule_id
ORDER BY ar.expense_category, qcm.qb_category_name;
