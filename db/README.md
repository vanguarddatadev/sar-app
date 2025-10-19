# SAR Report System Database

This directory contains the database schema and seed data for the SAR multi-tenant report system.

## Files

- **report-system-schema.sql** - Database schema (tables, indexes, RLS policies)
- **report-system-seed.sql** - Sample data for Vanguard organization
- **apply-schema.html** - Helper tool to copy SQL to clipboard

## Database Tables

### 1. organizations
Multi-tenant foundation table storing client organizations.

**Columns:**
- `id` - UUID primary key
- `name` - Organization name
- `fiscal_year_end_month` - Month when fiscal year ends (1-12)
- `fiscal_year_end_day` - Day when fiscal year ends (1-31)
- `created_at`, `updated_at` - Timestamps

**Sample Data:**
- Santa Clara Vanguard (fiscal year ends Oct 31)

---

### 2. report_templates
System-wide catalog of all available government reports.

**Columns:**
- `id` - UUID primary key
- `template_code` - Unique identifier (e.g., 'sc-county-monthly')
- `name` - Display name
- `jurisdiction_type` - 'county', 'state', or 'federal'
- `jurisdiction_name` - Name of jurisdiction
- `frequency` - 'monthly', 'quarterly', or 'yearly'
- `due_day` - Day of month when due (for monthly)
- `due_month` - Month when due (for yearly)
- `template_url` - URL to official form template
- `data_mapping` - JSONB mapping of data fields
- `description` - Human-readable description
- `requirements` - List of required data points

**Sample Data (15 templates):**
- **County Reports (8):**
  - Santa Clara County Monthly
  - Alameda County Monthly
  - San Mateo County Monthly
  - Los Angeles County Monthly
  - Franklin County (OH) Monthly
  - Cuyahoga County (OH) Monthly
  - Harris County (TX) Monthly
  - Dallas County (TX) Monthly

- **State Reports (5):**
  - California Annual Bingo Report
  - Ohio Annual Financial Report
  - Ohio Inventory Report
  - Texas Annual Report
  - Nevada Annual Report

- **Federal Reports (2):**
  - 990+G Tax Return
  - 990-N e-Postcard

---

### 3. org_report_requirements
Junction table linking organizations to their required reports.

**Columns:**
- `id` - UUID primary key
- `organization_id` - FK to organizations
- `template_code` - FK to report_templates
- `location` - Location identifier (e.g., 'SC', 'COMBINED')
- `enabled` - Boolean flag
- `created_at`, `updated_at` - Timestamps

**Sample Data (Vanguard):**
- Santa Clara County Monthly Report (location: SC)
- California Annual Bingo Report (location: COMBINED)
- 990+G Tax Return (location: COMBINED)

---

### 4. generated_reports
Archive of all generated reports with status tracking.

**Columns:**
- `id` - UUID primary key
- `organization_id` - FK to organizations
- `template_code` - FK to report_templates
- `period_start`, `period_end` - Date range covered
- `location` - Location identifier
- `status` - 'draft', 'generated', or 'filed'
- `filed_date` - Date when filed with agency
- `pdf_url` - URL to generated PDF
- `data_snapshot` - JSONB snapshot of data used
- `notes` - Free-text notes
- `generated_at` - Timestamp when generated
- `generated_by` - UUID of user who generated
- `updated_at` - Last update timestamp

**Sample Data:**
- 9 filed monthly reports (Jan-Aug 2025)
- 1 generated monthly report (Sep 2025)
- 1 filed 990+G for FY 2024

---

## Installation

### Option 1: Use the Helper Tool

1. Open `apply-schema.html` in your browser
2. Click "Copy Schema SQL" and paste in Supabase SQL Editor
3. Run the schema SQL
4. Click "Copy Seed Data SQL" and paste in Supabase SQL Editor
5. Run the seed data SQL

### Option 2: Manual Copy/Paste

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy the contents of `report-system-schema.sql`
4. Paste and run in SQL Editor
5. Copy the contents of `report-system-seed.sql`
6. Paste and run in SQL Editor

### Option 3: Supabase CLI (if installed)

```bash
# Apply schema
supabase db push --file report-system-schema.sql

# Apply seed data
supabase db push --file report-system-seed.sql
```

---

## Data Model Diagram

```
organizations (1) ──────┐
                        │
                        ├──> (N) org_report_requirements (N) ──> (1) report_templates
                        │
                        └──> (N) generated_reports (N) ──────────> (1) report_templates
```

---

## Multi-Tenant Design

The schema is designed for multi-tenancy from day one:

1. **organizations table** - Each client gets their own row
2. **Row Level Security (RLS)** - Enabled on all tables
3. **Foreign keys** - All data linked to organization_id
4. **Isolated data** - Each org only sees their own reports

**MVP Implementation:**
- Single hardcoded organization ID in views
- RLS policies set to "allow all" for development
- Ready to add auth and proper RLS when needed

---

## Report Workflow

### Monthly Reports

1. **Period Calculation:**
   - First day of month → Last day of month
   - Due date: `due_day` of following month

2. **Example:**
   - Period: Jan 1, 2025 - Jan 31, 2025
   - Due date: Feb 15, 2025 (if template.due_day = 15)

### Yearly Reports

1. **Period Calculation:**
   - Fiscal year start → Fiscal year end
   - Due date: `due_month`/`due_day` of following fiscal year

2. **Example:**
   - Org fiscal year: Nov 1, 2024 - Oct 31, 2025
   - Period: Nov 1, 2024 - Oct 31, 2025
   - Due date: Oct 31, 2025 (for 990+G)

---

## Status Progression

```
not-started → generated → filed
     ↓            ↓         ↓
  (Create)   (Download)  (Archive)
             (Re-gen)
```

---

## Sample Queries

### Get all required reports for an organization
```sql
SELECT
    orr.*,
    rt.name,
    rt.frequency,
    rt.due_day,
    rt.due_month
FROM org_report_requirements orr
JOIN report_templates rt ON orr.template_code = rt.template_code
WHERE orr.organization_id = '123e4567-e89b-12d3-a456-426614174000'
  AND orr.enabled = true;
```

### Get all generated reports for a period
```sql
SELECT
    gr.*,
    rt.name as report_name
FROM generated_reports gr
JOIN report_templates rt ON gr.template_code = rt.template_code
WHERE gr.organization_id = '123e4567-e89b-12d3-a456-426614174000'
  AND gr.period_start >= '2025-01-01'
  AND gr.period_end <= '2025-12-31'
ORDER BY gr.period_start DESC;
```

### Find overdue reports
```sql
-- This logic is implemented in report-checklist-view.js
-- Calculates due dates and compares to current date
```

---

## Next Steps

After applying the schema and seed data:

1. Navigate to Report Checklist in the app
2. You should see:
   - September 2025 report (generated, not filed)
   - October 2025 report (due soon)
   - November 2025 report (upcoming)
   - Jan-Aug 2025 reports (filed)
3. Test the "Generate Report" button
4. Test the "Mark as Filed" button
5. Verify the data snapshot displays correctly

---

## Extending the System

### Adding a New Report Template

```sql
INSERT INTO report_templates (
    template_code,
    name,
    jurisdiction_type,
    jurisdiction_name,
    frequency,
    due_day,
    description,
    requirements
) VALUES (
    'my-county-monthly',
    'My County Monthly Report',
    'county',
    'My County, CA',
    'monthly',
    20,
    'Monthly bingo activity report',
    'Sessions, attendance, revenue, payouts'
);
```

### Configuring a Report for an Organization

```sql
INSERT INTO org_report_requirements (
    organization_id,
    template_code,
    location,
    enabled
) VALUES (
    '123e4567-e89b-12d3-a456-426614174000',
    'my-county-monthly',
    'MC',
    true
);
```

### Adding a New Organization

```sql
INSERT INTO organizations (
    id,
    name,
    fiscal_year_end_month,
    fiscal_year_end_day
) VALUES (
    uuid_generate_v4(),
    'My New Organization',
    12,
    31
);
```

---

## Troubleshooting

### "relation does not exist" error
- Make sure you ran `report-system-schema.sql` first
- Check that the UUID extension is enabled

### "constraint violation" error
- Make sure you're using valid values for enums
- Check foreign key references exist

### Reports not showing in checklist
- Verify `org_report_requirements` has enabled=true
- Check that organization_id matches the hardcoded ID
- Verify template_code exists in report_templates

---

## Support

For issues or questions:
1. Check the application console for error messages
2. Verify SQL executed successfully in Supabase
3. Review the app.js and report-checklist-view.js code
