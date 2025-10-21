-- Find what QB categories are mapped to "Bingo COGS" expense category

-- Step 1: Find the allocation rule for Bingo COGS
SELECT id, expense_category
FROM allocation_rules
WHERE expense_category = 'Bingo COGS';

-- Step 2: Find QB categories mapped to that rule
-- (Replace 'RULE_ID_HERE' with the id from step 1)
SELECT
    qb_category_name,
    expense_category
FROM qb_category_mapping
WHERE allocation_rule_id = 'RULE_ID_HERE';

-- Step 3: Count QB expenses for those categories
-- (Replace with actual category names from step 2)
SELECT
    qb_category,
    COUNT(*) as expense_count,
    SUM(amount) as total_amount
FROM qb_expenses
WHERE qb_category IN ('CATEGORY_NAME_1', 'CATEGORY_NAME_2')
GROUP BY qb_category
ORDER BY total_amount DESC;

-- Then we can delete those QB categories:
-- DELETE FROM qb_expenses
-- WHERE qb_category IN (
--   SELECT qb_category_name
--   FROM qb_category_mapping cm
--   JOIN allocation_rules ar ON cm.allocation_rule_id = ar.id
--   WHERE ar.expense_category = 'Bingo COGS'
-- );
