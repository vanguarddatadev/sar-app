-- ============================================
-- Create Two Organizations - Simplified Version
-- ============================================

-- Step 1: Create system_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS system_settings (
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

CREATE INDEX IF NOT EXISTS idx_system_settings_org ON system_settings(organization_id);

-- Step 2: Create org_1 (Vanguard - has existing data)
INSERT INTO organizations (name, display_name, type)
VALUES ('org_1', 'Organization 1', 'nonprofit')
ON CONFLICT (name) DO NOTHING;

-- Step 3: Create org_2 (second org - empty for now)
INSERT INTO organizations (name, display_name, type)
VALUES ('org_2', 'Organization 2', 'nonprofit')
ON CONFLICT (name) DO NOTHING;

-- Step 4: Update sessions to org_1 (only NULL ones)
UPDATE sessions
SET organization_id = (SELECT id FROM organizations WHERE name = 'org_1')
WHERE organization_id IS NULL;

-- Step 5: Set organization names in settings
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
WHERE name IN ('org_1', 'org_2')
ON CONFLICT (organization_id, key) DO UPDATE
SET value = EXCLUDED.value;

-- Verify setup
SELECT 'Setup complete!' as status;

-- Show organization summary
SELECT
  o.name,
  o.display_name,
  (SELECT value FROM system_settings WHERE organization_id = o.id AND key = 'organization_name') as org_name_setting
FROM organizations o
WHERE o.name IN ('org_1', 'org_2')
ORDER BY o.name;

-- Show session counts (separate query to avoid confusion)
SELECT
  name as org_name,
  (SELECT COUNT(*) FROM sessions s WHERE s.organization_id = o.id) as session_count
FROM organizations o
WHERE o.name IN ('org_1', 'org_2')
ORDER BY o.name;
