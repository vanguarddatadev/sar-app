-- ============================================
-- SAR ALLOCATION SYSTEM - Complete Schema
-- Handles QB → Forecast (Monthly) and Session Allocation (Parallel Paths)
-- ============================================

-- ============================================
-- 1. ALLOCATION RULES (The Brain)
-- Defines how each expense category is allocated
-- ============================================
CREATE TABLE IF NOT EXISTS allocation_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- Rule identification
  bingo_category TEXT NOT NULL,  -- 'Security', 'Janitorial', 'Insurance', etc.
  display_name TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,

  -- Source mapping
  qb_account_numbers TEXT[],  -- Array of QB account numbers to sum (e.g., [6020, 6020.01])
  qb_account_names TEXT[],    -- For reference/display
  use_spreadsheet BOOLEAN DEFAULT false,  -- True = use spreadsheet_monthly_actuals, False = use QB

  -- STEP 1: Pre-allocation - Bingo percentage filter
  -- (Some expenses are shared with non-Bingo operations)
  bingo_percentage DECIMAL(5,2) DEFAULT 100.00,  -- % to allocate to Bingo (e.g., 85.00 for Utilities)

  -- STEP 2: Location split method
  location_split_method TEXT NOT NULL,  -- 'BY_REVENUE', 'FIXED_PERCENT', 'LOCATION_ONLY'
  -- For FIXED_PERCENT method (e.g., Insurance: 20% SC, 5% RWC, remaining 75% elsewhere)
  sc_fixed_percent DECIMAL(5,2),
  rwc_fixed_percent DECIMAL(5,2),
  -- For LOCATION_ONLY method (e.g., Janitorial: SC only, Rent: RWC only)
  location_filter TEXT,  -- 'SC', 'RWC', or NULL for both

  -- STEP 3: Session allocation method
  allocation_method TEXT NOT NULL,  -- 'BY_REVENUE', 'BY_SESSION_COUNT', 'FIXED_PER_SESSION'
  fixed_amount_per_session DECIMAL(10,2),  -- For FIXED_PER_SESSION (e.g., Rent)

  -- Metadata
  notes TEXT,
  formula_display TEXT,  -- Human-readable formula for UI (e.g., "85% of QB Utilities ÷ Revenue")
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, bingo_category)
);

-- Index for fast rule lookups
CREATE INDEX IF NOT EXISTS idx_allocation_rules_org ON allocation_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_allocation_rules_active ON allocation_rules(organization_id, is_active);

-- ============================================
-- PATH 1: MONTHLY FORECAST (Auto-Calculated)
-- Monthly expense totals by category/location
-- Recalculated from QB/Spreadsheet + Rules
-- ============================================
CREATE TABLE IF NOT EXISTS monthly_forecast (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- Time & Location
  month DATE NOT NULL,  -- First day of month
  location TEXT NOT NULL,  -- 'SC', 'RWC', 'COMBINED'

  -- Expense details
  category TEXT NOT NULL,  -- Matches allocation_rules.bingo_category
  forecasted_amount DECIMAL(10,2) NOT NULL,

  -- Calculation audit trail
  allocation_rule_id UUID REFERENCES allocation_rules(id),
  source_data TEXT,  -- 'QB', 'SPREADSHEET'
  source_amount DECIMAL(10,2),  -- Original QB or spreadsheet amount before allocation
  calculation_method TEXT,  -- Description of how it was calculated

  -- Metadata
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, month, location, category)
);

CREATE INDEX IF NOT EXISTS idx_monthly_forecast_org_month ON monthly_forecast(organization_id, month);
CREATE INDEX IF NOT EXISTS idx_monthly_forecast_location ON monthly_forecast(location);

-- ============================================
-- PATH 1: MONTHLY FORECAST MODIFIED (User Overrides)
-- User can manually adjust monthly forecast amounts
-- Takes precedence over auto-calculated forecast
-- ============================================
CREATE TABLE IF NOT EXISTS monthly_forecast_modified (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- Time & Location
  month DATE NOT NULL,
  location TEXT NOT NULL,

  -- Expense details
  category TEXT NOT NULL,
  modified_amount DECIMAL(10,2) NOT NULL,

  -- Audit trail
  original_forecasted_amount DECIMAL(10,2),  -- From monthly_forecast before override
  reason TEXT,  -- Why was this overridden?
  modified_by TEXT,
  modified_at TIMESTAMPTZ DEFAULT NOW(),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, month, location, category)
);

CREATE INDEX IF NOT EXISTS idx_monthly_forecast_modified_org_month
  ON monthly_forecast_modified(organization_id, month);

-- ============================================
-- PATH 2: SESSION ALLOCATED EXPENSES (Pure Calculation)
-- Session-level expense breakdown
-- NEVER user-modified, always recalculated from rules
-- ============================================
CREATE TABLE IF NOT EXISTS session_allocated_expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,

  -- Expense details
  category TEXT NOT NULL,
  allocated_amount DECIMAL(10,2) NOT NULL,

  -- Allocation metadata
  allocation_rule_id UUID REFERENCES allocation_rules(id),
  source_month DATE,  -- Which month's QB/spreadsheet data was used
  allocation_method TEXT,  -- 'BY_REVENUE', 'BY_SESSION_COUNT', 'FIXED_PER_SESSION'

  -- Calculation audit trail (for transparency)
  total_month_expense DECIMAL(10,2),  -- Total expense for the month (pre-allocation)
  session_revenue DECIMAL(10,2),  -- This session's total_sales
  total_month_revenue DECIMAL(10,2),  -- Total revenue for month/location
  revenue_percentage DECIMAL(5,4),  -- Session's % of total revenue (e.g., 0.1523 = 15.23%)
  calculation_notes TEXT,  -- e.g., "Security: $11,736 ÷ 22 sessions"

  -- Metadata
  allocated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, session_id, category)
);

CREATE INDEX IF NOT EXISTS idx_session_allocated_org_session ON session_allocated_expenses(organization_id, session_id);
CREATE INDEX IF NOT EXISTS idx_session_allocated_category ON session_allocated_expenses(category);
CREATE INDEX IF NOT EXISTS idx_session_allocated_month ON session_allocated_expenses(source_month);

-- ============================================
-- ENHANCED SESSIONS TABLE (Add Expense Columns)
-- Add computed expense totals to sessions table
-- ============================================
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS allocated_expenses DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS allocated_expenses_calculated_at TIMESTAMPTZ;

-- Add index for sessions with expense data
CREATE INDEX IF NOT EXISTS idx_sessions_expenses ON sessions(organization_id, session_date)
  WHERE allocated_expenses IS NOT NULL;

-- ============================================
-- VIEWS FOR REPORTING
-- ============================================

-- View: Complete monthly forecast (with overrides taking precedence)
CREATE OR REPLACE VIEW v_monthly_forecast_complete AS
SELECT
  COALESCE(mfm.organization_id, mf.organization_id) as organization_id,
  COALESCE(mfm.month, mf.month) as month,
  COALESCE(mfm.location, mf.location) as location,
  COALESCE(mfm.category, mf.category) as category,
  COALESCE(mfm.modified_amount, mf.forecasted_amount) as amount,
  CASE WHEN mfm.id IS NOT NULL THEN 'MODIFIED' ELSE 'FORECASTED' END as source,
  mfm.modified_by,
  mfm.modified_at,
  mf.calculated_at
FROM monthly_forecast mf
FULL OUTER JOIN monthly_forecast_modified mfm
  ON mf.organization_id = mfm.organization_id
  AND mf.month = mfm.month
  AND mf.location = mfm.location
  AND mf.category = mfm.category;

-- View: Session P&L (Revenue + Allocated Expenses)
CREATE OR REPLACE VIEW v_session_pl AS
SELECT
  s.id as session_id,
  s.organization_id,
  s.session_date,
  s.location,
  s.total_sales as revenue,
  s.total_payouts as cogs,
  s.net_revenue,
  SUM(sae.allocated_amount) as total_allocated_expenses,
  s.net_revenue - COALESCE(SUM(sae.allocated_amount), 0) as ebitda,
  COUNT(sae.id) as expense_line_items
FROM sessions s
LEFT JOIN session_allocated_expenses sae ON s.id = sae.session_id
GROUP BY s.id, s.organization_id, s.session_date, s.location, s.total_sales,
         s.total_payouts, s.net_revenue;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE allocation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_forecast ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_forecast_modified ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_allocated_expenses ENABLE ROW LEVEL SECURITY;

-- Development: Allow all access
CREATE POLICY "Allow all for development" ON allocation_rules FOR ALL USING (true);
CREATE POLICY "Allow all for development" ON monthly_forecast FOR ALL USING (true);
CREATE POLICY "Allow all for development" ON monthly_forecast_modified FOR ALL USING (true);
CREATE POLICY "Allow all for development" ON session_allocated_expenses FOR ALL USING (true);

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON TABLE allocation_rules IS 'Defines how each expense category is split and allocated to sessions';
COMMENT ON TABLE monthly_forecast IS 'Auto-calculated monthly expense forecast by category/location';
COMMENT ON TABLE monthly_forecast_modified IS 'User overrides for monthly forecast - takes precedence over auto-calculated';
COMMENT ON TABLE session_allocated_expenses IS 'Session-level expense breakdown - pure calculation, never modified';
COMMENT ON COLUMN allocation_rules.bingo_percentage IS 'Percentage of expense allocated to Bingo operations (e.g., 85% for Utilities)';
COMMENT ON COLUMN allocation_rules.location_split_method IS 'How to split between SC/RWC: BY_REVENUE, FIXED_PERCENT, or LOCATION_ONLY';
COMMENT ON COLUMN allocation_rules.allocation_method IS 'How to allocate to sessions: BY_REVENUE, BY_SESSION_COUNT, or FIXED_PER_SESSION';
