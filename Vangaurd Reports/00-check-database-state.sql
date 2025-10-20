-- ============================================
-- Check Current Database State
-- ============================================

-- Check 1: Does organizations table exist?
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizations')
    THEN 'YES - organizations table exists'
    ELSE 'NO - organizations table does not exist'
  END as organizations_table_status;

-- Check 2: Does sessions table have organization_id column?
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'sessions' AND column_name = 'organization_id'
    )
    THEN 'YES - sessions.organization_id column exists'
    ELSE 'NO - sessions.organization_id column does not exist'
  END as sessions_org_id_status;

-- Check 3: What columns does sessions table have?
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'sessions'
ORDER BY ordinal_position;

-- Check 4: If organizations exists, show the records
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizations')
    THEN 'Organizations table exists - checking records...'
    ELSE 'Organizations table does not exist'
  END as status;

-- Check 5: Show organizations if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizations') THEN
    RAISE NOTICE 'Running organizations query...';
  END IF;
END $$;

-- Only run this if organizations table exists
SELECT id, name, display_name, type
FROM organizations
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizations');

-- Check 6: Count sessions
SELECT COUNT(*) as total_sessions FROM sessions;

-- Check 7: If organization_id exists in sessions, count non-null values
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sessions' AND column_name = 'organization_id'
  ) THEN
    RAISE NOTICE 'organization_id column exists in sessions';
  ELSE
    RAISE NOTICE 'organization_id column DOES NOT exist in sessions';
  END IF;
END $$;
