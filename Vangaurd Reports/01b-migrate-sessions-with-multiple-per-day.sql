-- ============================================
-- MIGRATION: Add organization_id to existing sessions table
-- SUPPORTS MULTIPLE SESSIONS PER DAY (early/late sessions)
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

  -- Note: We do NOT add a session_time column
  -- Multiple sessions per day are allowed and distinguished by their unique ID
  -- Users can manually add notes or other fields if needed to distinguish sessions

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

-- Drop any existing problematic unique indexes
DROP INDEX IF EXISTS idx_sessions_org_date_location;

-- **NO UNIQUE CONSTRAINT** - Allow multiple sessions per date/location
-- Instead, just create regular indexes for performance

CREATE INDEX IF NOT EXISTS idx_sessions_org_date ON sessions(organization_id, session_date);
CREATE INDEX IF NOT EXISTS idx_sessions_location ON sessions(location);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_sessions_org_date_loc ON sessions(organization_id, session_date, location);
CREATE INDEX IF NOT EXISTS idx_sessions_expenses ON sessions(organization_id, session_date)
  WHERE allocated_expenses IS NOT NULL;

-- Verify the migration
SELECT
  'sessions table migration complete' as status,
  COUNT(*) as total_sessions,
  COUNT(DISTINCT organization_id) as organizations,
  COUNT(*) FILTER (WHERE organization_id IS NOT NULL) as sessions_with_org,
  COUNT(DISTINCT (session_date || location)) as unique_date_location,
  COUNT(*) - COUNT(DISTINCT (session_date || location)) as sessions_with_early_late
FROM sessions;

-- Show sessions with multiple on same day (e.g., Regular and Late)
SELECT
  session_date,
  location,
  COUNT(*) as session_count,
  array_agg(id) as session_ids,
  array_agg(COALESCE(session_type, 'unspecified')) as session_types,
  array_agg(total_sales) as sales_amounts
FROM sessions
GROUP BY session_date, location
HAVING COUNT(*) > 1
ORDER BY session_date DESC, location
LIMIT 10;

-- Your sessions are already distinguished by session_type (Regular, Late, etc.)
-- No additional updates needed!
