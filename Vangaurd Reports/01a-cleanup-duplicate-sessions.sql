-- ============================================
-- CLEANUP: Remove Duplicate Sessions
-- Run this BEFORE 01-migrate-existing-sessions.sql if you have duplicates
-- ============================================

-- Step 1: Identify duplicates
DO $$
BEGIN
  RAISE NOTICE '=== DUPLICATE SESSIONS REPORT ===';
END $$;

SELECT
  session_date,
  location,
  COUNT(*) as duplicate_count,
  array_agg(id) as session_ids,
  array_agg(total_sales) as sales_amounts
FROM sessions
GROUP BY session_date, location
HAVING COUNT(*) > 1
ORDER BY session_date, location;

-- Step 2: Keep the most recent/complete record, delete duplicates
-- Strategy: Keep the session with the highest total_sales, or most recent created_at

DO $$
DECLARE
  duplicate_record RECORD;
  sessions_to_keep UUID[];
  sessions_to_delete UUID[];
  deleted_count INTEGER := 0;
BEGIN
  RAISE NOTICE '=== REMOVING DUPLICATE SESSIONS ===';

  -- For each duplicate group, keep the best one
  FOR duplicate_record IN
    SELECT
      session_date,
      location,
      array_agg(id ORDER BY
        COALESCE(total_sales, 0) DESC,
        COALESCE(created_at, NOW()) DESC
      ) as all_ids
    FROM sessions
    GROUP BY session_date, location
    HAVING COUNT(*) > 1
  LOOP
    -- Keep the first ID (highest sales or most recent)
    sessions_to_keep := sessions_to_keep || duplicate_record.all_ids[1];

    -- Delete the rest
    FOR i IN 2..array_length(duplicate_record.all_ids, 1) LOOP
      sessions_to_delete := sessions_to_delete || duplicate_record.all_ids[i];

      DELETE FROM sessions WHERE id = duplicate_record.all_ids[i];
      deleted_count := deleted_count + 1;

      RAISE NOTICE 'Deleted duplicate: date=%, location=%, id=%',
        duplicate_record.session_date,
        duplicate_record.location,
        duplicate_record.all_ids[i];
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Total duplicates removed: %', deleted_count;
  RAISE NOTICE 'Sessions kept: %', array_length(sessions_to_keep, 1);
END $$;

-- Step 3: Verify no duplicates remain
SELECT
  CASE
    WHEN COUNT(*) = 0 THEN '✓ No duplicates found - safe to proceed'
    ELSE '✗ Still have ' || COUNT(*) || ' duplicate groups - check manually'
  END as status
FROM (
  SELECT session_date, location, COUNT(*) as cnt
  FROM sessions
  GROUP BY session_date, location
  HAVING COUNT(*) > 1
) duplicates;

-- Step 4: Show final session count
SELECT
  COUNT(*) as total_sessions,
  COUNT(DISTINCT session_date || location) as unique_date_location_combos,
  MIN(session_date) as earliest_session,
  MAX(session_date) as latest_session
FROM sessions;
