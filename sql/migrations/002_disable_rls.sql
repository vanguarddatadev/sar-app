-- Disable RLS for development
-- This allows the anon key to access all tables
-- In production, you would add proper RLS policies instead

ALTER TABLE sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE qb_expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE expense_allocation_rules DISABLE ROW LEVEL SECURITY;
ALTER TABLE allocated_expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE forecast_adjustments DISABLE ROW LEVEL SECURITY;
ALTER TABLE qb_category_mapping DISABLE ROW LEVEL SECURITY;
ALTER TABLE qb_journal_entry_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE gsheet_import_mapping DISABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings DISABLE ROW LEVEL SECURITY;
