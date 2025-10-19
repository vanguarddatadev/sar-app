-- ============================================
-- SAR Report System - Multi-tenant Schema
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ORGANIZATIONS (Multi-tenant foundation)
-- ============================================
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  fiscal_year_end_month INTEGER NOT NULL DEFAULT 12,
  fiscal_year_end_day INTEGER NOT NULL DEFAULT 31,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- REPORT TEMPLATES (System-wide catalog)
-- ============================================
CREATE TABLE IF NOT EXISTS report_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  jurisdiction_type TEXT NOT NULL CHECK (jurisdiction_type IN ('county', 'state', 'federal')),
  jurisdiction_name TEXT,
  frequency TEXT NOT NULL CHECK (frequency IN ('monthly', 'quarterly', 'yearly')),
  due_day INTEGER,
  due_month INTEGER,
  template_url TEXT,
  data_mapping JSONB,
  description TEXT,
  requirements TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ORG REPORT REQUIREMENTS (What each client needs)
-- ============================================
CREATE TABLE IF NOT EXISTS org_report_requirements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  template_code TEXT REFERENCES report_templates(template_code) ON DELETE CASCADE,
  location TEXT,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, template_code, location)
);

-- ============================================
-- GENERATED REPORTS (Library/Archive)
-- ============================================
CREATE TABLE IF NOT EXISTS generated_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  template_code TEXT REFERENCES report_templates(template_code) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  location TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'filed')),
  filed_date DATE,
  pdf_url TEXT,
  data_snapshot JSONB,
  notes TEXT,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  generated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_org_requirements_org ON org_report_requirements(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_requirements_template ON org_report_requirements(template_code);
CREATE INDEX IF NOT EXISTS idx_generated_reports_org ON generated_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_generated_reports_template ON generated_reports(template_code);
CREATE INDEX IF NOT EXISTS idx_generated_reports_status ON generated_reports(status);
CREATE INDEX IF NOT EXISTS idx_generated_reports_period ON generated_reports(period_start, period_end);

-- ============================================
-- ROW LEVEL SECURITY (Future multi-tenant)
-- ============================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_report_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_reports ENABLE ROW LEVEL SECURITY;

-- For now, allow all access (will refine when adding auth)
CREATE POLICY "Allow all for development" ON organizations FOR ALL USING (true);
CREATE POLICY "Allow all for development" ON org_report_requirements FOR ALL USING (true);
CREATE POLICY "Allow all for development" ON generated_reports FOR ALL USING (true);
