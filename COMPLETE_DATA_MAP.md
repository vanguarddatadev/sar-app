# COMPLETE SAR DATABASE REQUIREMENTS

## What The App Actually Does

1. **Session Management**: Import bingo session data from Google Sheets (sales, payouts, attendance)
2. **QuickBooks Integration**: Import expense data from QB
3. **Expense Allocation**: Allocate expenses to sessions based on configurable rules
4. **Multi-Tenant**: Support multiple organizations with separate data
5. **Reporting**: Generate monthly reports for county filing

---

## TABLES NEEDED (From Code Analysis)

### 1. organizations
**Purpose**: Multi-tenant support
**Used by**: app.js (line 35), supabase-client.js (line 182)
**Fields**:
- id (UUID, PK)
- name (TEXT, unique)
- display_name (TEXT)
- type (TEXT)
- fiscal_year_end_month (INT)
- fiscal_year_end_day (INT)
- created_at, updated_at (TIMESTAMP)

---

### 2. sessions
**Purpose**: Core bingo session performance data
**Used by**: All views, supabase-client.js, allocation-engine.js
**Fields**:
- id (UUID, PK)
- organization_id (UUID, FK → organizations)
- location (VARCHAR - SC/RWC)
- session_date (DATE)
- session_type (VARCHAR - Early/Late/Single)
- day_of_week (VARCHAR)
- attendance (INT)
- max_capacity (INT)
- capacity_percent (DECIMAL)
- flash_sales, strip_sales, paper_sales, cherry_sales, all_numbers_sales (DECIMAL)
- merchandise_sales, misc_receipts (DECIMAL)
- flash_payouts, strip_payouts, paper_payouts, cherry_payouts, all_numbers_payouts (DECIMAL)
- flash_net, strip_net, paper_net, cherry_net, all_numbers_net (DECIMAL - calculated)
- flash_yield, strip_yield, paper_yield, cherry_yield (DECIMAL)
- total_sales, total_payouts, net_revenue (DECIMAL - calculated)
- revenue_per_attendee, flash_per_attendee, strip_per_attendee (DECIMAL)
- data_source (VARCHAR - gsheet/qb/manual)
- data_source_priority (INT)
- is_projection, is_cancelled (BOOLEAN)
- validation_errors (JSONB)
- validation_status (VARCHAR)
- created_at, updated_at, imported_at (TIMESTAMP)
- source_row_hash (VARCHAR)
- qb_journal_entry_id (VARCHAR)
- qb_sync_status, qb_sync_error (VARCHAR, TEXT)
- **UNIQUE CONSTRAINT**: (organization_id, location, session_date, session_type)

---

### 3. qb_category_mapping
**Purpose**: Map QB expense categories to internal categories
**Used by**: supabase-client.js (line 137), qb-admin.js
**Fields**:
- id (UUID, PK)
- organization_id (UUID, FK → organizations)
- qb_category_name (TEXT)
- internal_category (TEXT)
- allocation_rule_id (UUID, FK → allocation_rules)
- is_active (BOOLEAN)
- created_at, updated_at (TIMESTAMP)

---

### 4. qb_expenses
**Purpose**: Store QB expense imports
**Used by**: qb-admin.js (line 646)
**Fields**:
- id (UUID, PK)
- organization_id (UUID, FK → organizations)
- expense_date (DATE)
- qb_category (TEXT)
- amount (DECIMAL)
- description (TEXT)
- imported_at (TIMESTAMP)

---

### 5. allocation_rules
**Purpose**: Define how expenses are allocated to sessions
**Used by**: supabase-client.js (line 207), allocation-engine.js (line 44)
**Fields**:
- id (UUID, PK)
- organization_id (UUID, FK → organizations)
- expense_category (TEXT)
- allocation_method (TEXT - BY_REVENUE/BY_SESSION_COUNT/FIXED_PER_SESSION)
- bingo_percentage (DECIMAL - what % goes to bingo vs other operations)
- location_split_method (TEXT - ALL_SESSIONS/SC_ONLY/RWC_ONLY/CUSTOM)
- location_split_sc_percent (DECIMAL)
- location_split_rwc_percent (DECIMAL)
- fixed_amount_per_session (DECIMAL)
- is_active (BOOLEAN)
- notes (TEXT)
- created_at, updated_at (TIMESTAMP)

---

### 6. qb_monthly_imports
**Purpose**: Store monthly QB data imports
**Used by**: supabase-client.js (line 264), allocation-engine.js (line 77)
**Fields**:
- id (UUID, PK)
- organization_id (UUID, FK → organizations)
- month (DATE)
- category (TEXT)
- total_amount (DECIMAL)
- imported_at (TIMESTAMP)
- source_file (TEXT)

---

### 7. spreadsheet_monthly_actuals
**Purpose**: Store monthly actual expense data from spreadsheets
**Used by**: supabase-client.js (line 293), allocation-engine.js (line 91)
**Fields**:
- id (UUID, PK)
- organization_id (UUID, FK → organizations)
- month (DATE)
- category (TEXT)
- actual_amount (DECIMAL)
- notes (TEXT)
- created_at, updated_at (TIMESTAMP)

---

### 8. monthly_forecast
**Purpose**: Store allocated expense forecasts by month/location
**Used by**: supabase-client.js (line 324), allocation-engine.js (line 425)
**Fields**:
- id (UUID, PK)
- organization_id (UUID, FK → organizations)
- month (DATE)
- location (VARCHAR)
- expense_category (TEXT)
- allocated_amount (DECIMAL)
- allocation_rule_id (UUID, FK → allocation_rules)
- created_at (TIMESTAMP)
- **UNIQUE**: (organization_id, month, location, expense_category)

---

### 9. monthly_forecast_modified
**Purpose**: Track user modifications to forecasts
**Used by**: supabase-client.js (line 349)
**Fields**:
- id (UUID, PK)
- monthly_forecast_id (UUID, FK → monthly_forecast)
- modified_amount (DECIMAL)
- modification_reason (TEXT)
- modified_by (TEXT)
- modified_at (TIMESTAMP)

---

### 10. session_allocated_expenses
**Purpose**: Expense amounts allocated to individual sessions
**Used by**: supabase-client.js (line 373), allocation-engine.js (line 451)
**Fields**:
- id (UUID, PK)
- organization_id (UUID, FK → organizations)
- session_id (UUID, FK → sessions)
- expense_category (TEXT)
- allocated_amount (DECIMAL)
- allocation_rule_id (UUID, FK → allocation_rules)
- created_at (TIMESTAMP)

---

### 11. revenue_categories
**Purpose**: Define revenue categories for county reporting
**Used by**: supabase-client.js (line 402)
**Fields**:
- id (UUID, PK)
- organization_id (UUID, FK → organizations)
- category_name (TEXT)
- county_report_order (INT)
- is_active (BOOLEAN)
- created_at, updated_at (TIMESTAMP)

---

### 12. system_settings
**Purpose**: Configuration key-value pairs per organization
**Used by**: app.js (line 64), supabase-client.js (line 428)
**Fields**:
- id (UUID, PK)
- organization_id (UUID, FK → organizations)
- key (TEXT)
- value (TEXT)
- value_type (TEXT)
- category (TEXT)
- description (TEXT)
- created_at, updated_at (TIMESTAMP)
- **UNIQUE**: (organization_id, key)

---

### 13. org_report_requirements
**Purpose**: Track what reports each org needs to file
**Used by**: report-checklist-view.js (line 63)
**Fields**:
- id (UUID, PK)
- organization_id (UUID, FK → organizations)
- report_type (TEXT)
- frequency (TEXT - monthly/quarterly/annual)
- due_day_of_month (INT)
- is_active (BOOLEAN)
- created_at, updated_at (TIMESTAMP)

---

### 14. generated_reports
**Purpose**: Track reports that have been generated
**Used by**: report-checklist-view.js (line 77)
**Fields**:
- id (UUID, PK)
- organization_id (UUID, FK → organizations)
- report_type (TEXT)
- report_period (DATE)
- generated_at (TIMESTAMP)
- generated_by (TEXT)
- file_path (TEXT)
- status (TEXT - draft/filed/archived)

---

## VIEWS NEEDED

### v_monthly_summary
**Purpose**: Aggregate session data by month and location
**Used by**: supabase-client.js (line 475), s-sar-view.js (line 263), app.js
**Aggregates**:
- month (DATE)
- location (VARCHAR)
- organization_id (UUID)
- session_count (INT)
- total_attendance (INT)
- total_sales (DECIMAL)
- total_payouts (DECIMAL)
- net_revenue (DECIMAL)
- flash_sales, strip_sales, paper_sales, cherry_sales, all_numbers_sales (DECIMAL)
- avg_revenue_per_attendee (DECIMAL)

---

### v_revenue_share
**Purpose**: Calculate revenue sharing percentages by location
**Used by**: supabase-client.js (line 516)
**Calculates**:
- month (DATE)
- location (VARCHAR)
- organization_id (UUID)
- total_revenue (DECIMAL)
- charity_share (DECIMAL)
- operator_share (DECIMAL)
- charity_percentage (DECIMAL)

---

## MISSING FROM BOTH SCHEMAS

1. **qb_expenses** - Referenced in code but not in fresh-install.sql
2. **org_report_requirements** - Referenced but doesn't exist anywhere
3. **generated_reports** - Referenced but doesn't exist anywhere
4. **v_monthly_summary** - VIEW never created
5. **v_revenue_share** - VIEW never created
6. **expense_allocation_rules** - In 001_initial_schema but named differently than allocation_rules

---

## SCHEMA CONFLICTS TO RESOLVE

### allocation_rules vs expense_allocation_rules
- NewCo schema uses: `allocation_rules`
- GitHub schema uses: `expense_allocation_rules`
- Code references: `allocation_rules`
- **DECISION**: Use `allocation_rules`

### allocated_expenses vs session_allocated_expenses
- NewCo schema uses: `session_allocated_expenses`
- GitHub schema uses: `allocated_expenses`
- Code references: `session_allocated_expenses`
- **DECISION**: Use `session_allocated_expenses`

---

## FINAL TABLE LIST (14 tables + 2 views)

**Tables:**
1. organizations
2. sessions (with organization_id)
3. qb_category_mapping
4. qb_expenses
5. allocation_rules
6. qb_monthly_imports
7. spreadsheet_monthly_actuals
8. monthly_forecast
9. monthly_forecast_modified
10. session_allocated_expenses
11. revenue_categories
12. system_settings
13. org_report_requirements
14. generated_reports

**Views:**
1. v_monthly_summary
2. v_revenue_share

**Database Triggers:**
1. calculate_session_fields() - Auto-calculate session totals and derived fields

---

## NEXT STEPS

1. Build ONE unified schema SQL file with ALL 14 tables + 2 views
2. Test it works with ALL code paths
3. Create seed data for:
   - 2 organizations
   - Allocation rules for Vanguard
   - Revenue categories
   - System settings
4. Deploy to Supabase
5. Test Google Sheets import
6. Test allocation engine
