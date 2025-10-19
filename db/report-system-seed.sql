-- ============================================
-- SAR Report System - Seed Data
-- ============================================

-- ============================================
-- 1. CREATE ORGANIZATION (Vanguard)
-- ============================================
INSERT INTO organizations (id, name, fiscal_year_end_month, fiscal_year_end_day)
VALUES ('123e4567-e89b-12d3-a456-426614174000', 'Santa Clara Vanguard', 10, 31)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 2. REPORT TEMPLATES (System Catalog)
-- ============================================

-- County Reports (California)
INSERT INTO report_templates (template_code, name, jurisdiction_type, jurisdiction_name, frequency, due_day, description, requirements)
VALUES
  ('sc-county-monthly', 'Santa Clara County Monthly Report', 'county', 'Santa Clara County, CA', 'monthly', 15,
   'Monthly bingo activity report for Santa Clara County',
   'Session count, attendance, gross receipts, prize payouts, license fees'),

  ('alameda-county-monthly', 'Alameda County Monthly Report', 'county', 'Alameda County, CA', 'monthly', 15,
   'Monthly bingo activity report for Alameda County',
   'Session count, attendance, gross receipts, prize payouts'),

  ('san-mateo-county-monthly', 'San Mateo County Monthly Report', 'county', 'San Mateo County, CA', 'monthly', 15,
   'Monthly bingo activity report for San Mateo County',
   'Session count, attendance, gross receipts, prize payouts'),

  ('los-angeles-county-monthly', 'Los Angeles County Monthly Report', 'county', 'Los Angeles County, CA', 'monthly', 20,
   'Monthly bingo activity report for Los Angeles County',
   'Session count, attendance, gross receipts, prize payouts, charitable distributions')
ON CONFLICT (template_code) DO NOTHING;

-- County Reports (Ohio)
INSERT INTO report_templates (template_code, name, jurisdiction_type, jurisdiction_name, frequency, due_day, description, requirements)
VALUES
  ('franklin-county-monthly', 'Franklin County Monthly Report', 'county', 'Franklin County, OH', 'monthly', 15,
   'Monthly bingo activity report for Franklin County',
   'Session count, attendance, gross receipts, prize payouts'),

  ('cuyahoga-county-monthly', 'Cuyahoga County Monthly Report', 'county', 'Cuyahoga County, OH', 'monthly', 15,
   'Monthly bingo activity report for Cuyahoga County',
   'Session count, attendance, gross receipts, prize payouts')
ON CONFLICT (template_code) DO NOTHING;

-- County Reports (Texas)
INSERT INTO report_templates (template_code, name, jurisdiction_type, jurisdiction_name, frequency, due_day, description, requirements)
VALUES
  ('harris-county-monthly', 'Harris County Monthly Report', 'county', 'Harris County, TX', 'monthly', 20,
   'Monthly bingo activity report for Harris County',
   'Session count, attendance, gross receipts, prize payouts'),

  ('dallas-county-monthly', 'Dallas County Monthly Report', 'county', 'Dallas County, TX', 'monthly', 20,
   'Monthly bingo activity report for Dallas County',
   'Session count, attendance, gross receipts, prize payouts')
ON CONFLICT (template_code) DO NOTHING;

-- State Reports
INSERT INTO report_templates (template_code, name, jurisdiction_type, jurisdiction_name, frequency, due_month, due_day, description, requirements)
VALUES
  ('ca-annual-bingo', 'California Annual Bingo Report', 'state', 'California', 'yearly', 10, 31,
   'Annual bingo activity report for California Department of Justice',
   'Yearly session totals, revenue, payouts, charitable distributions, license information'),

  ('ohio-annual-financial', 'Ohio Annual Financial Report', 'state', 'Ohio', 'yearly', 12, 31,
   'Annual financial report for Ohio Attorney General',
   'Yearly revenue, expenses, distributions, balance sheet'),

  ('ohio-inventory-report', 'Ohio Inventory Report', 'state', 'Ohio', 'yearly', 12, 15,
   'Annual inventory report for bingo supplies and equipment',
   'Bingo paper inventory, equipment list, purchase records'),

  ('texas-annual-report', 'Texas Annual Report', 'state', 'Texas', 'yearly', 1, 31,
   'Annual bingo report for Texas Lottery Commission',
   'Yearly session count, gross receipts, prize payouts'),

  ('nevada-annual-report', 'Nevada Annual Report', 'state', 'Nevada', 'yearly', 3, 31,
   'Annual charitable gaming report for Nevada',
   'Yearly revenue, expenses, charitable purposes')
ON CONFLICT (template_code) DO NOTHING;

-- Federal Reports
INSERT INTO report_templates (template_code, name, jurisdiction_type, jurisdiction_name, frequency, due_month, due_day, description, requirements)
VALUES
  ('990g', '990+G Tax Return', 'federal', 'IRS', 'yearly', 10, 31,
   'Form 990 Schedule G for bingo organizations',
   'Fiscal year gross revenue, prize payouts, other expenses, charitable distributions'),

  ('990n', '990-N e-Postcard', 'federal', 'IRS', 'yearly', 10, 31,
   'Form 990-N for small charities (under $50k gross receipts)',
   'Annual gross receipts confirmation')
ON CONFLICT (template_code) DO NOTHING;

-- ============================================
-- 3. VANGUARD'S REQUIRED REPORTS
-- ============================================
INSERT INTO org_report_requirements (organization_id, template_code, location, enabled)
VALUES
  ('123e4567-e89b-12d3-a456-426614174000', 'sc-county-monthly', 'SC', true),
  ('123e4567-e89b-12d3-a456-426614174000', 'ca-annual-bingo', 'COMBINED', true),
  ('123e4567-e89b-12d3-a456-426614174000', '990g', 'COMBINED', true)
ON CONFLICT (organization_id, template_code, location) DO NOTHING;

-- ============================================
-- 4. SAMPLE GENERATED REPORTS (Demo Data)
-- ============================================

-- Filed reports (Jan-Sep 2025)
INSERT INTO generated_reports (organization_id, template_code, period_start, period_end, location, status, filed_date, generated_at, data_snapshot)
VALUES
  -- January 2025
  ('123e4567-e89b-12d3-a456-426614174000', 'sc-county-monthly', '2025-01-01', '2025-01-31', 'SC', 'filed', '2025-02-14', '2025-02-14 10:30:00',
   '{"sessions": 22, "attendance": 845, "gross_receipts": 42150.00, "prize_payouts": 29800.00}'),

  -- February 2025
  ('123e4567-e89b-12d3-a456-426614174000', 'sc-county-monthly', '2025-02-01', '2025-02-28', 'SC', 'filed', '2025-03-14', '2025-03-14 11:15:00',
   '{"sessions": 20, "attendance": 780, "gross_receipts": 38920.00, "prize_payouts": 27500.00}'),

  -- March 2025
  ('123e4567-e89b-12d3-a456-426614174000', 'sc-county-monthly', '2025-03-01', '2025-03-31', 'SC', 'filed', '2025-04-14', '2025-04-14 09:45:00',
   '{"sessions": 24, "attendance": 920, "gross_receipts": 46200.00, "prize_payouts": 32800.00}'),

  -- April 2025
  ('123e4567-e89b-12d3-a456-426614174000', 'sc-county-monthly', '2025-04-01', '2025-04-30', 'SC', 'filed', '2025-05-14', '2025-05-14 14:20:00',
   '{"sessions": 23, "attendance": 885, "gross_receipts": 44100.00, "prize_payouts": 31200.00}'),

  -- May 2025
  ('123e4567-e89b-12d3-a456-426614174000', 'sc-county-monthly', '2025-05-01', '2025-05-31', 'SC', 'filed', '2025-06-14', '2025-06-14 10:00:00',
   '{"sessions": 25, "attendance": 950, "gross_receipts": 47800.00, "prize_payouts": 33900.00}'),

  -- June 2025
  ('123e4567-e89b-12d3-a456-426614174000', 'sc-county-monthly', '2025-06-01', '2025-06-30', 'SC', 'filed', '2025-07-14', '2025-07-14 11:30:00',
   '{"sessions": 24, "attendance": 910, "gross_receipts": 45600.00, "prize_payouts": 32300.00}'),

  -- July 2025
  ('123e4567-e89b-12d3-a456-426614174000', 'sc-county-monthly', '2025-07-01', '2025-07-31', 'SC', 'filed', '2025-08-14', '2025-08-14 15:45:00',
   '{"sessions": 26, "attendance": 980, "gross_receipts": 49200.00, "prize_payouts": 34800.00}'),

  -- August 2025
  ('123e4567-e89b-12d3-a456-426614174000', 'sc-county-monthly', '2025-08-01', '2025-08-31', 'SC', 'filed', '2025-09-16', '2025-09-16 10:15:00',
   '{"sessions": 24, "attendance": 892, "gross_receipts": 45320.00, "prize_payouts": 32150.00}'),

  -- September 2025 (generated but not filed yet)
  ('123e4567-e89b-12d3-a456-426614174000', 'sc-county-monthly', '2025-09-01', '2025-09-30', 'SC', 'generated', NULL, '2025-10-10 14:30:00',
   '{"sessions": 23, "attendance": 870, "gross_receipts": 43800.00, "prize_payouts": 31000.00}'),

  -- FY 2024 990+G (filed)
  ('123e4567-e89b-12d3-a456-426614174000', '990g', '2023-11-01', '2024-10-31', 'COMBINED', 'filed', '2024-10-28', '2024-10-01 09:00:00',
   '{"gross_revenue": 542000.00, "prize_payouts": 384000.00, "other_expenses": 89000.00, "charitable_distributions": 69000.00}')
ON CONFLICT DO NOTHING;
