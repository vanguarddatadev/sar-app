-- ============================================
-- SAR Expense System - Data Storage Only
-- Stores QB imports and Spreadsheet actuals
-- ============================================

-- ============================================
-- 1. RAW QB IMPORTS (Source of Truth #1)
-- Stores every line from QB P&L by Class CSV
-- ============================================
CREATE TABLE IF NOT EXISTS qb_monthly_imports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  month DATE NOT NULL,  -- First day of month (e.g., '2025-05-01')
  account_number TEXT,  -- e.g., '6020', '5012', '6410.01'
  account_name TEXT,    -- e.g., 'Hourly', 'Cards/Supplies', 'General Liability'
  class_name TEXT,      -- e.g., 'Bingo - SC', 'Bingo - RWC', 'Shared Services'
  amount DECIMAL(10,2),
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  import_file_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast QB queries
CREATE INDEX IF NOT EXISTS idx_qb_imports_org_month ON qb_monthly_imports(organization_id, month);
CREATE INDEX IF NOT EXISTS idx_qb_imports_account ON qb_monthly_imports(account_number);
CREATE INDEX IF NOT EXISTS idx_qb_imports_class ON qb_monthly_imports(class_name);

-- Unique constraint: One entry per org/month/account/class
CREATE UNIQUE INDEX IF NOT EXISTS idx_qb_imports_unique
  ON qb_monthly_imports(organization_id, month, account_number, class_name)
  WHERE account_number IS NOT NULL AND class_name IS NOT NULL;

-- ============================================
-- 2. SPREADSHEET MONTHLY ACTUALS (Source of Truth #2)
-- Stores the "correct" monthly totals per category/location
-- This is your manually calculated/reviewed data
-- ============================================
CREATE TABLE IF NOT EXISTS spreadsheet_monthly_actuals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  month DATE NOT NULL,  -- First day of month
  location TEXT NOT NULL,  -- 'SC', 'RWC', 'COMBINED'
  category TEXT NOT NULL,  -- 'Staffing Expenses', 'Security', 'Janitorial', etc.
  amount DECIMAL(10,2) NOT NULL,

  -- Metadata
  notes TEXT,
  data_source TEXT,  -- 'manual_entry', 'csv_import', 'spreadsheet_v1'
  entered_by TEXT,
  entered_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, month, location, category)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_spreadsheet_actuals_org_month
  ON spreadsheet_monthly_actuals(organization_id, month);
CREATE INDEX IF NOT EXISTS idx_spreadsheet_actuals_location
  ON spreadsheet_monthly_actuals(location);
CREATE INDEX IF NOT EXISTS idx_spreadsheet_actuals_category
  ON spreadsheet_monthly_actuals(category);

-- ============================================
-- Row Level Security (Future multi-tenant)
-- ============================================
ALTER TABLE qb_monthly_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE spreadsheet_monthly_actuals ENABLE ROW LEVEL SECURITY;

-- Development: Allow all access
CREATE POLICY "Allow all for development" ON qb_monthly_imports FOR ALL USING (true);
CREATE POLICY "Allow all for development" ON spreadsheet_monthly_actuals FOR ALL USING (true);
