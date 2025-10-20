-- ============================================
-- Verify Current State and Fix Organizations Setup
-- ============================================

-- Step 1: Check if organization_id exists in sessions
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sessions'
        AND column_name = 'organization_id'
    ) THEN
        -- Add the column if it doesn't exist
        ALTER TABLE sessions ADD COLUMN organization_id UUID;
        RAISE NOTICE 'Added organization_id column to sessions';
    ELSE
        RAISE NOTICE 'organization_id column already exists in sessions';
    END IF;
END $$;

-- Step 2: Create organizations table if needed
CREATE TABLE IF NOT EXISTS organizations (
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

-- Step 3: Create system_settings table if needed
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

-- Step 4: Create the two organizations
INSERT INTO organizations (name, display_name, type)
VALUES ('org_1', 'Organization 1', 'nonprofit')
ON CONFLICT (name) DO NOTHING;

INSERT INTO organizations (name, display_name, type)
VALUES ('org_2', 'Organization 2', 'nonprofit')
ON CONFLICT (name) DO NOTHING;

-- Step 5: Update sessions with org_1 (only NULL ones)
UPDATE sessions
SET organization_id = (SELECT id FROM organizations WHERE name = 'org_1')
WHERE organization_id IS NULL;

-- Step 6: Add foreign key constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'sessions_organization_id_fkey'
        AND table_name = 'sessions'
    ) THEN
        ALTER TABLE sessions
        ADD CONSTRAINT sessions_organization_id_fkey
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added foreign key constraint';
    ELSE
        RAISE NOTICE 'Foreign key constraint already exists';
    END IF;
END $$;

-- Step 7: Set NOT NULL constraint if possible
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sessions'
        AND column_name = 'organization_id'
        AND is_nullable = 'NO'
    ) THEN
        -- Only add NOT NULL if all sessions have an organization_id
        IF NOT EXISTS (SELECT 1 FROM sessions WHERE organization_id IS NULL) THEN
            ALTER TABLE sessions ALTER COLUMN organization_id SET NOT NULL;
            RAISE NOTICE 'Set organization_id to NOT NULL';
        ELSE
            RAISE NOTICE 'Cannot set NOT NULL - some sessions still have NULL organization_id';
        END IF;
    ELSE
        RAISE NOTICE 'organization_id is already NOT NULL';
    END IF;
END $$;

-- Step 8: Set organization names in settings
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

-- Step 9: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_org_date ON sessions(organization_id, session_date);
CREATE INDEX IF NOT EXISTS idx_sessions_org_location ON sessions(organization_id, location);

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

-- Show session counts
SELECT
  o.name as org_name,
  COUNT(s.id) as session_count
FROM organizations o
LEFT JOIN sessions s ON s.organization_id = o.id
WHERE o.name IN ('org_1', 'org_2')
GROUP BY o.name
ORDER BY o.name;
