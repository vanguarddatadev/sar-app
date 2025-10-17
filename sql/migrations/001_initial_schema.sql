-- SAR (Standalone Reporting) Database Schema
-- Migration 001: Initial Schema
-- Created: 2025-10-16

-- ============================================
-- SESSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Session Identity
  location VARCHAR(10) NOT NULL CHECK (location IN ('SC', 'RWC')),
  session_date DATE NOT NULL,
  session_type VARCHAR(20) NOT NULL, -- 'Early', 'Late', 'Single', 'Special'
  day_of_week VARCHAR(10) NOT NULL,

  -- Attendance
  attendance INT CHECK (attendance >= 0),
  max_capacity INT,
  capacity_percent DECIMAL(5,2),

  -- Revenue Categories (Sales)
  flash_sales DECIMAL(12,2) DEFAULT 0,
  strip_sales DECIMAL(12,2) DEFAULT 0,
  paper_sales DECIMAL(12,2) DEFAULT 0,
  cherry_sales DECIMAL(12,2) DEFAULT 0,
  all_numbers_sales DECIMAL(12,2) DEFAULT 0,
  merchandise_sales DECIMAL(12,2) DEFAULT 0,
  misc_receipts DECIMAL(12,2) DEFAULT 0,

  -- Revenue Categories (Payouts)
  flash_payouts DECIMAL(12,2) DEFAULT 0,
  strip_payouts DECIMAL(12,2) DEFAULT 0,
  paper_payouts DECIMAL(12,2) DEFAULT 0,
  cherry_payouts DECIMAL(12,2) DEFAULT 0,
  all_numbers_payouts DECIMAL(12,2) DEFAULT 0,

  -- Net by Category (Calculated)
  flash_net DECIMAL(12,2),
  strip_net DECIMAL(12,2),
  paper_net DECIMAL(12,2),
  cherry_net DECIMAL(12,2),
  all_numbers_net DECIMAL(12,2),

  -- Yield Percentages
  flash_yield DECIMAL(5,2),
  strip_yield DECIMAL(5,2),
  paper_yield DECIMAL(5,2),
  cherry_yield DECIMAL(5,2),

  -- Aggregated Totals
  total_sales DECIMAL(12,2),
  total_payouts DECIMAL(12,2),
  net_revenue DECIMAL(12,2),

  -- Per-Attendee Metrics
  revenue_per_attendee DECIMAL(10,2),
  flash_per_attendee DECIMAL(10,2),
  strip_per_attendee DECIMAL(10,2),

  -- Data Source & Priority
  data_source VARCHAR(20) NOT NULL DEFAULT 'gsheet',
  data_source_priority INT NOT NULL DEFAULT 0,
  is_projection BOOLEAN DEFAULT false,
  is_cancelled BOOLEAN DEFAULT false,

  -- Validation
  validation_errors JSONB,
  validation_status VARCHAR(20) DEFAULT 'pending',

  -- Audit Trail
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  imported_at TIMESTAMP,
  source_row_hash VARCHAR(64),

  -- QB Integration
  qb_journal_entry_id VARCHAR(50),
  qb_sync_status VARCHAR(20),
  qb_sync_error TEXT,

  UNIQUE(location, session_date, session_type)
);

-- Indexes for sessions
CREATE INDEX idx_sessions_date ON sessions(session_date);
CREATE INDEX idx_sessions_location ON sessions(location);
CREATE INDEX idx_sessions_month ON sessions(EXTRACT(YEAR FROM session_date), EXTRACT(MONTH FROM session_date));
CREATE INDEX idx_sessions_location_month ON sessions(location, EXTRACT(YEAR FROM session_date), EXTRACT(MONTH FROM session_date));
CREATE INDEX idx_sessions_data_source ON sessions(data_source, data_source_priority);

-- Trigger to calculate derived fields
CREATE OR REPLACE FUNCTION calculate_session_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate net by category
  NEW.flash_net := NEW.flash_sales - NEW.flash_payouts;
  NEW.strip_net := NEW.strip_sales - NEW.strip_payouts;
  NEW.paper_net := NEW.paper_sales - NEW.paper_payouts;
  NEW.cherry_net := NEW.cherry_sales - NEW.cherry_payouts;
  NEW.all_numbers_net := NEW.all_numbers_sales - NEW.all_numbers_payouts;

  -- Calculate yields (handle division by zero)
  NEW.flash_yield := CASE
    WHEN NEW.flash_sales > 0 THEN (NEW.flash_net / NEW.flash_sales * 100)
    ELSE NULL
  END;

  NEW.strip_yield := CASE
    WHEN NEW.strip_sales > 0 THEN (NEW.strip_net / NEW.strip_sales * 100)
    ELSE NULL
  END;

  NEW.paper_yield := CASE
    WHEN NEW.paper_sales > 0 THEN (NEW.paper_net / NEW.paper_sales * 100)
    ELSE NULL
  END;

  NEW.cherry_yield := CASE
    WHEN NEW.cherry_sales > 0 THEN (NEW.cherry_net / NEW.cherry_sales * 100)
    ELSE NULL
  END;

  -- Calculate totals
  NEW.total_sales := COALESCE(NEW.flash_sales, 0) + COALESCE(NEW.strip_sales, 0) +
                     COALESCE(NEW.paper_sales, 0) + COALESCE(NEW.cherry_sales, 0) +
                     COALESCE(NEW.all_numbers_sales, 0) + COALESCE(NEW.merchandise_sales, 0) +
                     COALESCE(NEW.misc_receipts, 0);

  NEW.total_payouts := COALESCE(NEW.flash_payouts, 0) + COALESCE(NEW.strip_payouts, 0) +
                       COALESCE(NEW.paper_payouts, 0) + COALESCE(NEW.cherry_payouts, 0) +
                       COALESCE(NEW.all_numbers_payouts, 0);

  NEW.net_revenue := NEW.total_sales - NEW.total_payouts;

  -- Calculate per-attendee metrics
  IF NEW.attendance > 0 THEN
    NEW.revenue_per_attendee := NEW.total_sales / NEW.attendance;
    NEW.flash_per_attendee := NEW.flash_sales / NEW.attendance;
    NEW.strip_per_attendee := NEW.strip_sales / NEW.attendance;
  END IF;

  NEW.updated_at := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calculate_session_fields
BEFORE INSERT OR UPDATE ON sessions
FOR EACH ROW
EXECUTE FUNCTION calculate_session_fields();


-- ============================================
-- QB EXPENSES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS qb_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  expense_month DATE NOT NULL,

  -- Expense categories
  product_purchases DECIMAL(12,2) DEFAULT 0,
  electronic_rentals DECIMAL(12,2) DEFAULT 0,
  premises_rent DECIMAL(12,2) DEFAULT 0,
  equipment_maintenance DECIMAL(12,2) DEFAULT 0,
  janitorial DECIMAL(12,2) DEFAULT 0,
  security DECIMAL(12,2) DEFAULT 0,
  employee_supplies_meals DECIMAL(12,2) DEFAULT 0,
  refreshments_meals DECIMAL(12,2) DEFAULT 0,
  employee_gifts DECIMAL(12,2) DEFAULT 0,
  patron_supplies DECIMAL(12,2) DEFAULT 0,
  advertising DECIMAL(12,2) DEFAULT 0,
  office_supplies DECIMAL(12,2) DEFAULT 0,
  utilities_bank_fees DECIMAL(12,2) DEFAULT 0,
  merchant_fees DECIMAL(12,2) DEFAULT 0,
  bad_checks_returned DECIMAL(12,2) DEFAULT 0,
  bad_checks_recovered DECIMAL(12,2) DEFAULT 0,
  city_fee DECIMAL(12,2) DEFAULT 0,
  gift_certificates_redeemed DECIMAL(12,2) DEFAULT 0,
  city_permits DECIMAL(12,2) DEFAULT 0,
  insurance DECIMAL(12,2) DEFAULT 0,

  -- Total
  total_disbursements DECIMAL(12,2),

  -- Sync metadata
  sync_date TIMESTAMP DEFAULT NOW(),
  sync_status VARCHAR(20) DEFAULT 'success',
  sync_log JSONB,
  is_partial BOOLEAN DEFAULT false,
  qb_transaction_ids JSONB,
  qb_company_id VARCHAR(50),

  UNIQUE(expense_month)
);

CREATE INDEX idx_qb_expenses_month ON qb_expenses(expense_month);


-- ============================================
-- EXPENSE ALLOCATION RULES
-- ============================================
CREATE TABLE IF NOT EXISTS expense_allocation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  expense_category VARCHAR(50) NOT NULL UNIQUE,
  allocation_method VARCHAR(30) NOT NULL,

  sc_percent DECIMAL(5,2),
  rwc_percent DECIMAL(5,2),
  unallocated_percent DECIMAL(5,2),

  revenue_share_base_percent DECIMAL(5,2),
  specific_location VARCHAR(10),

  notes TEXT,
  county_report_line_item VARCHAR(100),
  is_active BOOLEAN DEFAULT true,

  updated_at TIMESTAMP DEFAULT NOW()
);

-- Default allocation rules
INSERT INTO expense_allocation_rules
  (expense_category, allocation_method, sc_percent, rwc_percent, unallocated_percent, notes)
VALUES
  ('insurance', 'fixed_percent', 20.00, 5.00, 75.00, 'Fixed: 20% SC, 5% RWC, 75% unallocated'),
  ('utilities_bank_fees', 'fixed_percent', 42.50, 42.50, 15.00, '85% split by revenue share'),
  ('merchant_fees', 'revenue_share', NULL, NULL, NULL, 'Split by revenue share'),
  ('janitorial', 'revenue_share', NULL, NULL, NULL, 'Split by revenue share'),
  ('security', 'revenue_share', NULL, NULL, NULL, 'Split by revenue share'),
  ('product_purchases', 'revenue_share', NULL, NULL, NULL, 'COGS - split by revenue share');

UPDATE expense_allocation_rules SET specific_location = 'RWC', allocation_method = 'location_specific'
WHERE expense_category = 'premises_rent';


-- ============================================
-- ALLOCATED EXPENSES
-- ============================================
CREATE TABLE IF NOT EXISTS allocated_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  expense_month DATE NOT NULL,
  location VARCHAR(10) NOT NULL,

  product_purchases DECIMAL(12,2) DEFAULT 0,
  electronic_rentals DECIMAL(12,2) DEFAULT 0,
  premises_rent DECIMAL(12,2) DEFAULT 0,
  equipment_maintenance DECIMAL(12,2) DEFAULT 0,
  janitorial DECIMAL(12,2) DEFAULT 0,
  security DECIMAL(12,2) DEFAULT 0,
  employee_supplies_meals DECIMAL(12,2) DEFAULT 0,
  refreshments_meals DECIMAL(12,2) DEFAULT 0,
  employee_gifts DECIMAL(12,2) DEFAULT 0,
  patron_supplies DECIMAL(12,2) DEFAULT 0,
  advertising DECIMAL(12,2) DEFAULT 0,
  office_supplies DECIMAL(12,2) DEFAULT 0,
  utilities_bank_fees DECIMAL(12,2) DEFAULT 0,
  merchant_fees DECIMAL(12,2) DEFAULT 0,
  bad_checks_returned DECIMAL(12,2) DEFAULT 0,
  bad_checks_recovered DECIMAL(12,2) DEFAULT 0,
  city_fee DECIMAL(12,2) DEFAULT 0,
  gift_certificates_redeemed DECIMAL(12,2) DEFAULT 0,
  city_permits DECIMAL(12,2) DEFAULT 0,
  insurance DECIMAL(12,2) DEFAULT 0,

  total_allocated DECIMAL(12,2),
  revenue_share_percent DECIMAL(5,2),

  calculated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(expense_month, location)
);


-- ============================================
-- FORECAST ADJUSTMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS forecast_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  adjustment_month DATE NOT NULL,
  location VARCHAR(10),

  metric VARCHAR(50) NOT NULL,
  adjustment_type VARCHAR(20) NOT NULL,
  percentage_change DECIMAL(7,2),
  absolute_value DECIMAL(12,2),

  cascade_forward BOOLEAN DEFAULT true,
  apply_to_base BOOLEAN DEFAULT true,

  yoy_comparison_month DATE,
  yoy_change_percent DECIMAL(7,2),

  created_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(100),
  notes TEXT,
  adjustment_order INT DEFAULT 1
);

CREATE INDEX idx_forecast_adj_month ON forecast_adjustments(adjustment_month);


-- ============================================
-- QB CATEGORY MAPPING
-- ============================================
CREATE TABLE IF NOT EXISTS qb_category_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  qb_category_name VARCHAR(200) NOT NULL UNIQUE,
  qb_account_id VARCHAR(50),
  sar_category VARCHAR(50) NOT NULL,

  is_active BOOLEAN DEFAULT true,
  notes TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);


-- ============================================
-- QB JOURNAL ENTRY TEMPLATES
-- ============================================
CREATE TABLE IF NOT EXISTS qb_journal_entry_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  template_name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  entry_frequency VARCHAR(20),

  line_items JSONB NOT NULL,

  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  require_approval BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(100),
  updated_at TIMESTAMP DEFAULT NOW()
);


-- ============================================
-- REVENUE CATEGORIES
-- ============================================
CREATE TABLE IF NOT EXISTS revenue_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  category_name VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(100),

  tracked_in_sessions BOOLEAN DEFAULT true,
  tracked_monthly_only BOOLEAN DEFAULT false,

  show_in_county_report BOOLEAN DEFAULT true,
  county_report_section VARCHAR(50),
  county_report_order INT,

  qb_account_id VARCHAR(50),
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT NOW()
);

-- Default revenue categories
INSERT INTO revenue_categories
  (category_name, display_name, tracked_in_sessions, tracked_monthly_only, show_in_county_report, county_report_section, county_report_order)
VALUES
  ('flash', 'Flash', true, false, true, 'receipts', 1),
  ('strip', 'Strip', true, false, true, 'receipts', 2),
  ('paper', 'Bingo Paper', true, false, true, 'receipts', 3),
  ('cherry', 'Cherry', true, false, true, 'receipts', 4),
  ('all_numbers', 'All Numbers', true, false, true, 'receipts', 5),
  ('merchandise', 'Merchandise (w/o tax)', true, false, true, 'receipts', 6),
  ('quarterly_sales_tax', 'Quarterly Sales Tax', false, true, true, 'receipts', 7),
  ('atm_fees', 'ATM Fees', false, true, true, 'receipts', 8),
  ('gift_certificates', 'Gift Certificates Purchased', true, false, true, 'receipts', 9),
  ('misc_receipts', 'Misc Receipts', true, false, true, 'receipts', 10);


-- ============================================
-- GSHEET IMPORT MAPPING
-- ============================================
CREATE TABLE IF NOT EXISTS gsheet_import_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  mapping_name VARCHAR(100) DEFAULT 'Default',

  column_mappings JSONB,
  date_format VARCHAR(50) DEFAULT 'M/D/YYYY',
  session_type_rules JSONB,

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Default mapping for Vanguard GSheet format
INSERT INTO gsheet_import_mapping (mapping_name, column_mappings, session_type_rules)
VALUES ('Vanguard Default',
  '{"row3": "session_date", "row4": "day_of_week", "row6": "flash_sales", "row7": "cherry_sales", "row8": "paper_sales", "row9": "strip_sales", "row12": "total_sales", "row29": "total_payouts", "row31": "net_revenue", "row40": "attendance"}'::jsonb,
  '{"detect_late": ["Late", "PM", "LATE"], "detect_early": ["Early", "EARLY"]}'::jsonb
);


-- ============================================
-- SYSTEM SETTINGS
-- ============================================
CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT,
  value_type VARCHAR(20),
  category VARCHAR(50),
  description TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Default settings
INSERT INTO system_settings (key, value, value_type, category, description) VALUES
  ('qb.client_id', '', 'string', 'qb', 'QuickBooks OAuth Client ID'),
  ('qb.environment', 'sandbox', 'string', 'qb', 'QuickBooks environment'),
  ('qb.auto_sync_enabled', 'false', 'boolean', 'qb', 'Enable automatic daily QB sync'),
  ('forecast.default_horizon_months', '24', 'number', 'forecast', 'Default forecast horizon (months)'),
  ('general.default_sc_capacity', '430', 'number', 'general', 'Default max capacity for SC'),
  ('general.default_rwc_capacity', '200', 'number', 'general', 'Default max capacity for RWC');


-- ============================================
-- VIEWS
-- ============================================

-- Monthly summary by location
CREATE OR REPLACE VIEW v_monthly_summary AS
SELECT
  DATE_TRUNC('month', session_date)::date as month,
  location,
  COUNT(*) as session_count,
  SUM(attendance) as total_attendance,
  SUM(total_sales) as total_sales,
  SUM(total_payouts) as total_payouts,
  SUM(net_revenue) as net_revenue,
  SUM(flash_sales) as flash_sales,
  SUM(strip_sales) as strip_sales,
  AVG(revenue_per_attendee) as avg_rpa
FROM sessions
WHERE is_cancelled = false AND data_source_priority > 0
GROUP BY DATE_TRUNC('month', session_date)::date, location;

-- Revenue share calculation
CREATE OR REPLACE VIEW v_revenue_share AS
WITH monthly_revenue AS (
  SELECT
    DATE_TRUNC('month', session_date)::date as month,
    location,
    SUM(net_revenue) as location_revenue
  FROM sessions
  WHERE is_cancelled = false
  GROUP BY DATE_TRUNC('month', session_date)::date, location
),
combined_revenue AS (
  SELECT
    month,
    SUM(location_revenue) as total_revenue
  FROM monthly_revenue
  GROUP BY month
)
SELECT
  mr.month,
  mr.location,
  mr.location_revenue,
  cr.total_revenue,
  CASE
    WHEN cr.total_revenue > 0 THEN (mr.location_revenue / cr.total_revenue * 100)
    ELSE 50.00
  END as revenue_share_percent
FROM monthly_revenue mr
JOIN combined_revenue cr ON mr.month = cr.month;
