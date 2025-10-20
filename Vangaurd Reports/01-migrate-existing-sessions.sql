-- ============================================
-- MIGRATION: Add organization_id to existing sessions table
-- Run this if you already have a sessions table without organization_id
-- ============================================

-- First, ensure organizations table exists
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

-- Insert Vanguard organization if it doesn't exist
INSERT INTO organizations (name, display_name, type, fiscal_year_end_month, fiscal_year_end_day)
VALUES (
  'Vanguard Music and Performing Arts',
  'Vanguard Music and Performing Arts',
  'nonprofit',
  12,
  31
)
ON CONFLICT (name) DO NOTHING;

-- Get the organization ID
DO $$
DECLARE
  vanguard_org_id UUID;
BEGIN
  -- Get Vanguard org ID
  SELECT id INTO vanguard_org_id
  FROM organizations
  WHERE name = 'Vanguard Music and Performing Arts';

  -- Add organization_id column to sessions if it doesn't exist
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'sessions'
    AND column_name = 'organization_id'
  ) THEN
    -- Add the column (nullable first)
    ALTER TABLE sessions ADD COLUMN organization_id UUID;

    -- Set all existing sessions to Vanguard org
    UPDATE sessions SET organization_id = vanguard_org_id WHERE organization_id IS NULL;

    -- Make it NOT NULL
    ALTER TABLE sessions ALTER COLUMN organization_id SET NOT NULL;

    -- Add foreign key constraint
    ALTER TABLE sessions ADD CONSTRAINT fk_sessions_organization
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

    RAISE NOTICE 'Added organization_id column to sessions table';
  ELSE
    RAISE NOTICE 'organization_id column already exists in sessions table';
  END IF;

  -- Add other missing columns if they don't exist

  -- allocated_expenses
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sessions' AND column_name = 'allocated_expenses'
  ) THEN
    ALTER TABLE sessions ADD COLUMN allocated_expenses DECIMAL(10,2) DEFAULT 0;
    RAISE NOTICE 'Added allocated_expenses column';
  END IF;

  -- allocated_expenses_calculated_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sessions' AND column_name = 'allocated_expenses_calculated_at'
  ) THEN
    ALTER TABLE sessions ADD COLUMN allocated_expenses_calculated_at TIMESTAMPTZ;
    RAISE NOTICE 'Added allocated_expenses_calculated_at column';
  END IF;

  -- is_cancelled
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sessions' AND column_name = 'is_cancelled'
  ) THEN
    ALTER TABLE sessions ADD COLUMN is_cancelled BOOLEAN DEFAULT false;
    RAISE NOTICE 'Added is_cancelled column';
  END IF;

END $$;

-- Drop the old unique constraint if it exists (without organization_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sessions_session_date_location_key'
  ) THEN
    ALTER TABLE sessions DROP CONSTRAINT sessions_session_date_location_key;
    RAISE NOTICE 'Dropped old unique constraint';
  END IF;
END $$;

-- Drop existing index if it exists (in case of partial failure)
DROP INDEX IF EXISTS idx_sessions_org_date_location;

-- Check for duplicates before creating unique index
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT organization_id, session_date, location, COUNT(*) as cnt
    FROM sessions
    GROUP BY organization_id, session_date, location
    HAVING COUNT(*) > 1
  ) duplicates;

  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Found % duplicate session groups. Run 01a-cleanup-duplicate-sessions.sql first!', duplicate_count;
  END IF;

  RAISE NOTICE 'No duplicates found - safe to create unique index';
END $$;

-- Create new unique constraint with organization_id
CREATE UNIQUE INDEX idx_sessions_org_date_location
  ON sessions(organization_id, session_date, location);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sessions_org_date ON sessions(organization_id, session_date);
CREATE INDEX IF NOT EXISTS idx_sessions_location ON sessions(location);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_sessions_expenses ON sessions(organization_id, session_date)
  WHERE allocated_expenses IS NOT NULL;

-- Verify the migration
SELECT
  'sessions table migration complete' as status,
  COUNT(*) as total_sessions,
  COUNT(DISTINCT organization_id) as organizations,
  COUNT(*) FILTER (WHERE organization_id IS NOT NULL) as sessions_with_org
FROM sessions;

-- Show sample
SELECT
  session_date,
  location,
  total_sales,
  organization_id,
  (SELECT name FROM organizations WHERE id = sessions.organization_id) as org_name
FROM sessions
ORDER BY session_date DESC
LIMIT 5;
