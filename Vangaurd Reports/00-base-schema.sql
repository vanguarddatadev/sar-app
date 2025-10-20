-- ============================================
-- SAR BASE SCHEMA - Foundation Tables
-- Must be run FIRST before other schemas
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ORGANIZATIONS TABLE
-- Multi-tenant support
-- ============================================
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  display_name TEXT,
  type TEXT,  -- 'nonprofit', 'business', etc.

  -- Settings
  fiscal_year_end_month INTEGER DEFAULT 12,  -- December
  fiscal_year_end_day INTEGER DEFAULT 31,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(name)
);

-- Insert Vanguard organization
INSERT INTO organizations (name, display_name, type, fiscal_year_end_month, fiscal_year_end_day)
VALUES (
  'Vanguard Music and Performing Arts',
  'Vanguard Music and Performing Arts',
  'nonprofit',
  12,
  31
)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- SESSIONS TABLE (if not exists)
-- Core session/event data
-- ============================================
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- Session details
  session_date DATE NOT NULL,
  location TEXT NOT NULL,  -- 'SC', 'RWC'
  day_of_week TEXT,
  session_type TEXT,  -- 'Regular', 'Special', etc.

  -- Revenue
  total_sales DECIMAL(10,2) DEFAULT 0,
  flash_sales DECIMAL(10,2) DEFAULT 0,
  strip_sales DECIMAL(10,2) DEFAULT 0,
  cherry_sales DECIMAL(10,2) DEFAULT 0,
  paper_sales DECIMAL(10,2) DEFAULT 0,
  misc_sales DECIMAL(10,2) DEFAULT 0,

  -- Expenses
  total_payouts DECIMAL(10,2) DEFAULT 0,
  net_revenue DECIMAL(10,2) DEFAULT 0,

  -- Attendance
  attendance INTEGER DEFAULT 0,

  -- Status
  is_cancelled BOOLEAN DEFAULT false,

  -- Allocated expenses (added by allocation system)
  allocated_expenses DECIMAL(10,2) DEFAULT 0,
  allocated_expenses_calculated_at TIMESTAMPTZ,

  -- Metadata
  notes TEXT,
  data_source TEXT,  -- 'manual', 'google_sheets', 'quickbooks'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, session_date, location)
);

CREATE INDEX IF NOT EXISTS idx_sessions_org_date ON sessions(organization_id, session_date);
CREATE INDEX IF NOT EXISTS idx_sessions_location ON sessions(location);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(session_date);

-- ============================================
-- SYSTEM SETTINGS TABLE (if not exists)
-- ============================================
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT,
  value_type TEXT DEFAULT 'string',  -- 'string', 'number', 'boolean', 'json'
  category TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, key)
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Development: Allow all access
CREATE POLICY "Allow all for development" ON organizations FOR ALL USING (true);
CREATE POLICY "Allow all for development" ON sessions FOR ALL USING (true);
CREATE POLICY "Allow all for development" ON system_settings FOR ALL USING (true);

-- ============================================
-- VERIFICATION QUERY
-- ============================================
-- Run this to verify base schema is set up correctly:
/*
SELECT
  'organizations' as table_name,
  COUNT(*) as row_count,
  (SELECT name FROM organizations LIMIT 1) as sample_org
FROM organizations
UNION ALL
SELECT
  'sessions',
  COUNT(*),
  (SELECT session_date::TEXT FROM sessions ORDER BY session_date DESC LIMIT 1)
FROM sessions
UNION ALL
SELECT
  'system_settings',
  COUNT(*),
  NULL
FROM system_settings;
*/

-- Get Vanguard organization ID for use in other scripts
-- SELECT id, name FROM organizations WHERE name = 'Vanguard Music and Performing Arts';
