-- ============================================
-- Create Two Organizations for Multi-tenant Setup
-- ============================================

-- Create system_settings table if it doesn't exist
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

-- Create org_1 (Vanguard - has existing data)
INSERT INTO organizations (name, display_name, type)
VALUES ('org_1', 'Organization 1', 'nonprofit')
ON CONFLICT (name) DO NOTHING;

-- Create org_2 (second org - empty for now)
INSERT INTO organizations (name, display_name, type)
VALUES ('org_2', 'Organization 2', 'nonprofit')
ON CONFLICT (name) DO NOTHING;

-- Get the UUIDs
DO $$
DECLARE
  org1_id UUID;
  org2_id UUID;
BEGIN
  SELECT id INTO org1_id FROM organizations WHERE name = 'org_1';
  SELECT id INTO org2_id FROM organizations WHERE name = 'org_2';

  RAISE NOTICE 'Org 1 UUID: %', org1_id;
  RAISE NOTICE 'Org 2 UUID: %', org2_id;

  -- Set organization_name in settings for both
  INSERT INTO system_settings (organization_id, key, value, value_type, category)
  VALUES (org1_id, 'organization_name', 'Vanguard Music and Performing Arts', 'string', 'general')
  ON CONFLICT (organization_id, key) DO UPDATE SET value = 'Vanguard Music and Performing Arts';

  INSERT INTO system_settings (organization_id, key, value, value_type, category)
  VALUES (org2_id, 'organization_name', 'Organization 2', 'string', 'general')
  ON CONFLICT (organization_id, key) DO UPDATE SET value = 'Organization 2';

  -- Update all existing sessions to org_1 (Vanguard)
  UPDATE sessions SET organization_id = org1_id WHERE organization_id IS NULL;

  -- Show summary
  RAISE NOTICE '=== ORGANIZATION SETUP COMPLETE ===';
  RAISE NOTICE 'Org 1 (Vanguard): % sessions', (SELECT COUNT(*) FROM sessions WHERE organization_id = org1_id);
  RAISE NOTICE 'Org 2: % sessions', (SELECT COUNT(*) FROM sessions WHERE organization_id = org2_id);
END $$;

-- Verify setup
SELECT
  o.id,
  o.name,
  o.display_name,
  s.value as organization_name_setting,
  (SELECT COUNT(*) FROM sessions WHERE organization_id = o.id) as session_count
FROM organizations o
LEFT JOIN system_settings s ON o.id = s.organization_id AND s.key = 'organization_name'
ORDER BY o.name;
