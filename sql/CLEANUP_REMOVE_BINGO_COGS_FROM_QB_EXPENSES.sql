-- Remove Bingo COGS transactions from qb_expenses table
-- These are derived from payouts and should not be treated as operational expenses

-- First, check how many records will be deleted
SELECT
    qb_category,
    COUNT(*) as transaction_count,
    SUM(amount) as total_amount
FROM qb_expenses
WHERE qb_category LIKE '%Bingo COGS%'
   OR qb_category LIKE '%Bingo Payouts%'
   OR qb_category LIKE '%Bingo Costs%'
GROUP BY qb_category
ORDER BY total_amount DESC;

-- After reviewing the above, run this to delete:
-- DELETE FROM qb_expenses
-- WHERE qb_category LIKE '%Bingo COGS%'
--    OR qb_category LIKE '%Bingo Payouts%'
--    OR qb_category LIKE '%Bingo Costs%';

-- Note: Comment out the DELETE and run the SELECT first to verify
-- what will be deleted before actually deleting it.
