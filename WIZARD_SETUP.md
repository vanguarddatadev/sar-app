# Organization Initialization Wizard - Setup Guide

## Overview
The SAR app now includes an organization initialization wizard that allows users to configure their organization settings and locations through the UI.

## What Was Built

### 1. Database Schema (`sql/migrations/003_organization_settings.sql`)
- **organization table**: Single-record table for org name, fiscal year ending, and contact info
- **locations table**: Multi-location support with state and county fields
- **ca_counties table**: Reference table with all 58 California counties

### 2. UI Components (`index.html`)
- Settings view with organization summary card
- Wizard form with:
  - Organization name input
  - Fiscal year ending date picker
  - Dynamic location fields (add/remove)
  - State dropdown (all 50 US states)
  - Conditional CA county dropdown

### 3. Controller (`js/views/init-wizard.js`)
- Handles wizard display/hide
- Manages dynamic location fields
- Validates and saves organization + locations
- Updates header organization name
- Loads existing organization data for editing

### 4. Database Integration (`js/core/supabase-client.js`)
Added methods:
- `getOrganization()`
- `upsertOrganization(orgData)`
- `getLocations()`
- `upsertLocation(locationData)`
- `deleteLocation(id)`
- `getCACounties()`

### 5. App Integration (`js/core/app.js`)
- Imports init-wizard
- Initializes wizard when Settings view loads
- Loads organization name from database on app startup

## Next Steps to Complete Setup

### Step 1: Apply Database Migration
Run the SQL migration on your Supabase database:

```sql
-- Copy contents of sql/migrations/003_organization_settings.sql
-- Paste and run in Supabase SQL Editor
```

This creates the following tables:
- `organization`
- `locations`
- `ca_counties`

### Step 2: Test the Wizard

1. Open the SAR app in your browser
2. Click "Settings" in the sidebar
3. Click "Initialize Organization" button
4. Fill in the form:
   - Organization Name: e.g., "Frontier Gaming Systems"
   - Fiscal Year Ending: Select a date (e.g., "December 31, 2025")
   - Add locations:
     - Location Code: e.g., "SC"
     - Location Name: e.g., "Santa Clara Bingo Hall"
     - State: Select "CA"
     - County: Select "Santa Clara"
5. Click "Add Location" to add more
6. Click "Save Organization"

### Step 3: Verify Results

After saving, verify:
1. Header shows your organization name (top left)
2. Settings page shows organization summary
3. Database has records:
   ```sql
   SELECT * FROM organization;
   SELECT * FROM locations;
   ```

### Step 4: Edit Organization (Optional)

To edit later:
1. Go to Settings
2. Button should now say "Edit Organization"
3. Click it to open the wizard with existing data
4. Make changes and save

## Features

### Dynamic Location Management
- Add unlimited locations
- Remove locations (minimum 1 required)
- Each location has:
  - Code (e.g., "SC", "RWC")
  - Name (e.g., "Santa Clara Bingo Hall")
  - State (dropdown)
  - County (CA only, dropdown with 58 counties)

### State-Specific Validation
- County field only shows for California locations
- County becomes required when CA is selected
- County hidden and optional for other states

### Data Persistence
- Uses Supabase upsert operations
- Organization: Single record, always updates
- Locations: Upsert by location_code
- Editable anytime through Settings

## Database Schema Details

### organization table
```sql
- id (UUID, primary key)
- organization_name (VARCHAR, required)
- fiscal_year_ending (DATE, required)
- address fields (optional)
- contact fields (optional)
- tax/legal fields (optional)
- Single record constraint
```

### locations table
```sql
- id (UUID, primary key)
- location_code (VARCHAR, unique, required)
- location_name (VARCHAR, required)
- state (VARCHAR(2), required)
- county (VARCHAR, CA only)
- address fields (optional)
- capacity fields (optional)
- license fields (optional)
- is_active (BOOLEAN)
- opened_date, closed_date (DATE)
```

### ca_counties table
```sql
- id (SERIAL, primary key)
- county_name (VARCHAR, unique)
- county_seat (VARCHAR)
- population (INT)
- sort_order (INT)
```

## Files Modified

### Created
- `js/views/init-wizard.js` - Wizard controller
- `sql/migrations/003_organization_settings.sql` - Database schema

### Modified
- `index.html` - Settings view UI
- `js/core/app.js` - App integration
- `js/core/supabase-client.js` - Database methods

## Troubleshooting

### Organization name not showing in header
- Check browser console for errors
- Verify organization record exists in database
- Try refreshing the page

### County dropdown not showing
- Verify state is set to "CA"
- Check that ca_counties table was created and populated
- Open browser console to check for errors

### Cannot save organization
- Check browser console for detailed error
- Verify all required fields are filled
- Ensure database migration was applied successfully

## Future Enhancements

Possible improvements:
- Add organization logo upload
- Add location capacity tracking
- Add license expiration reminders
- Import locations from CSV
- Location contact information
- Multi-org support for franchises

---

**Status**: Ready for testing
**Last Updated**: 2025-10-17
**Commit**: 25ed71c
