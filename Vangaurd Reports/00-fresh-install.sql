-- ============================================
-- FRESH INSTALL - Complete Multi-tenant SAR Database
-- WARNING: This will DROP all existing tables and data!
-- ============================================

-- Drop everything in reverse dependency order
DROP TABLE IF EXISTS session_allocated_expenses CASCADE;
DROP TABLE IF EXISTS monthly_forecast_modified CASCADE;
DROP TABLE IF EXISTS monthly_forecast CASCADE;
DROP TABLE IF EXISTS allocation_rules CASCADE;
DROP TABLE IF EXISTS spreadsheet_monthly_actuals CASCADE;
DROP TABLE IF EXISTS qb_monthly_imports CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. Organizations Table
-- ============================================
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  display_name TEXT,
  type TEXT,
  fiscal_year_end_month INTEGER DEFAULT 12,
  fiscal_year_end_day INTEGER DEFAULT 31,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name)
);

-- Create two organizations
INSERT INTO organizations (name, display_name, type)
VALUES
  ('org_1', 'Organization 1', 'nonprofit'),
  ('org_2', 'Organization 2', 'nonprofit');

-- ============================================
-- 2. System Settings Table
-- ============================================
CREATE TABLE system_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT,
  value_type TEXT DEFAULT 'string',
  category TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, key)
);

CREATE INDEX idx_system_settings_org ON system_settings(organization_id);

-- Set organization names
INSERT INTO system_settings (organization_id, key, value, value_type, category)
SELECT
  id,
  'organization_name',
  CASE name
    WHEN 'org_1' THEN 'Vanguard Music and Performing Arts'
    WHEN 'org_2' THEN 'Organization 2'
  END,
  'string',
  'general'
FROM organizations
WHERE name IN ('org_1', 'org_2');

-- ============================================
-- 3. Sessions Table (Complete Original Schema + organization_id)
-- ============================================
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Session Identity
  location VARCHAR(10) NOT NULL CHECK (location IN ('SC', 'RWC')),
  session_date DATE NOT NULL,
  session_type VARCHAR(20) NOT NULL,
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
  net_sales DECIMAL(12,2),
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

  CONSTRAINT sessions_org_location_date_type_key UNIQUE(organization_id, location, session_date, session_type)
);

-- Indexes for sessions
CREATE INDEX idx_sessions_date ON sessions(session_date);
CREATE INDEX idx_sessions_location ON sessions(location);
CREATE INDEX idx_sessions_org_date ON sessions(organization_id, session_date);
CREATE INDEX idx_sessions_org_location ON sessions(organization_id, location);
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

  NEW.net_sales := NEW.total_sales - NEW.total_payouts;
  NEW.net_revenue := NEW.net_sales;

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
-- 4. QB Monthly Imports Table
-- ============================================
CREATE TABLE qb_monthly_imports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  account_number TEXT,
  account_name TEXT,
  class_name TEXT,
  amount DECIMAL(10,2),
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  import_file_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_qb_imports_org_month ON qb_monthly_imports(organization_id, month);
CREATE INDEX idx_qb_imports_account ON qb_monthly_imports(account_number);

-- ============================================
-- 5. Spreadsheet Monthly Actuals Table
-- ============================================
CREATE TABLE spreadsheet_monthly_actuals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  location TEXT NOT NULL,
  category TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, month, location, category)
);

CREATE INDEX idx_spreadsheet_org_month ON spreadsheet_monthly_actuals(organization_id, month);

-- ============================================
-- 6. Allocation Rules Table
-- ============================================
CREATE TABLE allocation_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bingo_category TEXT NOT NULL,
  display_name TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  qb_account_numbers TEXT[],
  use_spreadsheet BOOLEAN DEFAULT false,
  bingo_percentage DECIMAL(5,2) DEFAULT 100.00,
  location_split_method TEXT NOT NULL CHECK (location_split_method IN ('BY_REVENUE', 'FIXED_PERCENT', 'LOCATION_ONLY')),
  sc_fixed_percent DECIMAL(5,2),
  rwc_fixed_percent DECIMAL(5,2),
  location_filter TEXT CHECK (location_filter IN ('SC', 'RWC', NULL)),
  allocation_method TEXT NOT NULL CHECK (allocation_method IN ('BY_REVENUE', 'BY_SESSION_COUNT', 'FIXED_PER_SESSION')),
  fixed_amount_per_session DECIMAL(10,2),
  notes TEXT,
  formula_display TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, bingo_category)
);

CREATE INDEX idx_allocation_rules_org ON allocation_rules(organization_id);

-- ============================================
-- 7. Monthly Forecast Table (User-modifiable)
-- ============================================
CREATE TABLE monthly_forecast (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  location TEXT NOT NULL,
  category TEXT NOT NULL,
  forecasted_amount DECIMAL(10,2) NOT NULL,
  source TEXT CHECK (source IN ('QB', 'SPREADSHEET', 'CALCULATED')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, month, location, category)
);

CREATE INDEX idx_monthly_forecast_org_month ON monthly_forecast(organization_id, month);

-- ============================================
-- 8. Monthly Forecast Modified Table
-- ============================================
CREATE TABLE monthly_forecast_modified (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  location TEXT NOT NULL,
  category TEXT NOT NULL,
  modified_amount DECIMAL(10,2) NOT NULL,
  original_forecasted_amount DECIMAL(10,2),
  reason TEXT,
  modified_by TEXT,
  modified_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, month, location, category)
);

CREATE INDEX idx_monthly_forecast_modified_org ON monthly_forecast_modified(organization_id, month);

-- ============================================
-- 9. Session Allocated Expenses Table (Pure calculation)
-- ============================================
CREATE TABLE session_allocated_expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  allocated_amount DECIMAL(10,2) NOT NULL,
  allocation_rule_id UUID REFERENCES allocation_rules(id),
  source_month DATE,
  allocation_method TEXT,
  total_month_expense DECIMAL(10,2),
  session_revenue DECIMAL(10,2),
  total_month_revenue DECIMAL(10,2),
  revenue_percentage DECIMAL(5,4),
  calculation_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, session_id, category)
);

CREATE INDEX idx_session_expenses_org ON session_allocated_expenses(organization_id);
CREATE INDEX idx_session_expenses_session ON session_allocated_expenses(session_id);
CREATE INDEX idx_session_expenses_month ON session_allocated_expenses(source_month);

-- ============================================
-- RLS Policies (Development - Allow All)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE qb_monthly_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE spreadsheet_monthly_actuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE allocation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_forecast ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_forecast_modified ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_allocated_expenses ENABLE ROW LEVEL SECURITY;

-- Create allow-all policies for development
CREATE POLICY "Allow all for development" ON organizations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for development" ON system_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for development" ON sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for development" ON qb_monthly_imports FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for development" ON spreadsheet_monthly_actuals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for development" ON allocation_rules FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for development" ON monthly_forecast FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for development" ON monthly_forecast_modified FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for development" ON session_allocated_expenses FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- Verification
-- ============================================
SELECT 'Fresh install complete!' as status;

-- Show organizations
SELECT
  o.name,
  o.display_name,
  (SELECT value FROM system_settings WHERE organization_id = o.id AND key = 'organization_name') as org_name_setting
FROM organizations o
ORDER BY o.name;

-- Show all tables created
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE'
ORDER BY table_name;
