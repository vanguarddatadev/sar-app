-- Check if organizations table exists
SELECT table_name
FROM information_schema.tables
WHERE table_name = 'organizations';

-- Check sessions columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'sessions'
ORDER BY ordinal_position;
