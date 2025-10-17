# S-SAR Implementation Summary

## Overview
S-SAR (Sessions Standalone Reporting) has been successfully integrated into the SAR application. This feature fetches session data from Google Sheets, stores it in Supabase, and provides monthly summary reporting.

## What Was Built

### 1. New Navigation Tab
- Added "S-SAR" tab to main navigation (between Dashboard and County Reports)
- Tab displays Sessions Standalone Reporting view

### 2. Session Data Client (`js/core/session-data-client.js`)
**Purpose:** Fetch and parse session data from Google Sheets

**Key Methods:**
- `fetchData()` - Fetches raw data from Google Sheets using JSONP
- `parseSessions()` - Converts raw GSheet data into SAR session format
- `parseSessionColumn()` - Parses individual session columns
- `parseDate()` - Handles various date formats (M/D/YYYY, YYYY-MM-DD, ISO)
- `parseNumber()` - Handles currency, percentages, and numeric values
- `getAvailableMonths()` - Extracts unique months for filtering

**Data Source:**
```javascript
apiUrl = 'https://script.google.com/macros/s/AKfycbzbmJqRgd4kpZFNrpnKH3I7md6fM8eOsOoukEc2Mp_rDzUQNkpJ7u5msmZ1zJweTKij/exec'
```

**Data Structure:**
The client parses the following revenue fields from Google Sheets:
- Flash Sales/Payouts (rows 5-6)
- Strip Sales/Payouts (rows 9-10)
- Paper Sales/Payouts (rows 13-14)
- Cherry Sales/Payouts (rows 17-18)
- All Numbers Sales/Payouts (rows 21-22)
- Pulltabs, Food/Bev, Other Revenue (rows 25-27)
- Attendance (row 36)

### 3. S-SAR View Controller (`js/views/s-sar-view.js`)
**Purpose:** Manage S-SAR UI and data flow

**Key Methods:**
- `init()` - Initialize view
- `refreshData()` - Fetch data from GSheets and save to database
- `saveSessions()` - Upsert sessions to Supabase (uses unique constraint on location+date+type)
- `populateMonthSelector()` - Build month dropdown from available data
- `loadMonthlySummary()` - Fetch and display monthly summary from database
- `displayMonthlySummary()` - Render monthly metrics
- `renderLocationCard()` - Display location-specific data

**UI Features:**
- "Refresh Data" button to fetch latest from GSheets
- Last updated timestamp
- Month selector dropdown
- Monthly summary metrics (Total Sales, Net Revenue, Attendance, Avg RPA)
- Location breakdown (SC/RWC)
- Revenue category breakdown

### 4. Main App Integration
**Updated `js/core/app.js`:**
- Imported `ssarView`
- Added event listener for "Refresh Data" button
- Added view switching for 's-sar' view
- Calls `ssarView.init()` when tab is selected

### 5. HTML View (`index.html`)
**New S-SAR View Container:**
- Header with "Refresh Data" button
- Status display area
- Monthly summary section with:
  - Month selector
  - Combined metrics grid
  - Location cards (SC/RWC)
  - Revenue breakdown

## How It Works

### Data Flow
1. **User clicks "Refresh Data"**
   - Triggers `ssarView.refreshData()`

2. **Fetch from Google Sheets**
   - `sessionDataClient.fetchData()` uses JSONP to call GSheet API
   - Returns raw data with SC and RWC columns

3. **Parse Sessions**
   - `sessionDataClient.parseSessions()` converts columns to session objects
   - Handles date parsing, number parsing, field mapping

4. **Save to Database**
   - `ssarView.saveSessions()` upserts sessions to Supabase
   - Uses unique constraint: `location + session_date + session_type`
   - Updates existing sessions or inserts new ones

5. **Display Monthly Summary**
   - Populates month selector with available months
   - Fetches data from `monthly_summaries` view
   - Displays combined totals and location breakdowns

### Database Integration
The S-SAR feature leverages existing database schema:

**Tables Used:**
- `sessions` - Stores session data
  - Unique constraint: (location, session_date, session_type)
  - Triggers auto-calculate: flash_net, flash_yield, totals, RPA

**Views Used:**
- `monthly_summaries` - Aggregates sessions by month and location
  - Returns: session_count, total_sales, net_revenue, attendance, avg_rpa, etc.

## User Workflow

### First Time Setup
1. Navigate to "S-SAR" tab
2. Click "Refresh Data" button
3. System fetches data from Google Sheets
4. Sessions are saved to database
5. Monthly summary appears with most recent month selected

### Ongoing Use
1. Click "Refresh Data" to get latest session data
2. Select different months from dropdown to view historical summaries
3. View combined totals and location-specific breakdowns

## Key Features

### Intelligent Data Parsing
- Handles multiple date formats (M/D/YYYY, YYYY-MM-DD, ISO timestamps)
- Cleans currency values (removes $, commas)
- Handles missing/null values gracefully

### Upsert Logic
- Prevents duplicate sessions
- Updates existing sessions if data changes
- Uses Supabase's `onConflict` parameter

### Automatic Calculations
Database triggers automatically calculate:
- Flash Net (sales - payouts)
- Flash Yield (net / sales * 100)
- Total Sales (sum of all revenue types)
- Total Payouts (sum of all payouts)
- Net Revenue (sales - payouts)
- Revenue Per Attendee (RPA)

### Monthly Aggregation
The `monthly_summaries` view automatically:
- Groups sessions by month and location
- Counts sessions
- Sums revenue, attendance
- Calculates average RPA
- Provides ready-to-display metrics

## Data Validation

### Date Handling
```javascript
// Supports formats:
"2025-08-11T07:00:00.000Z" → "2025-08-11"
"8/11/2025 8:00:00 AM"     → "2025-08-11"
"8/11/2025"                → "2025-08-11"
```

### Number Parsing
```javascript
// Handles:
"$1,234.56"  → 1234.56
"(500)"      → -500
"45%"        → 45
```

## Future Enhancements (Not Yet Implemented)

### Potential Additions:
1. **Session-Level View** - Display individual sessions in table
2. **Date Range Filtering** - Filter sessions by custom date range
3. **Export Functions** - Export to CSV/Excel
4. **Session Comparison** - Compare sessions across different time periods
5. **Trend Charts** - Visualize revenue trends over time
6. **Session Type Filtering** - Filter by Regular/Late sessions
7. **Auto-Refresh** - Schedule automatic data fetches
8. **Data Validation Alerts** - Warn about missing/invalid data

## Files Modified

### New Files Created:
- `/js/core/session-data-client.js` - GSheet data fetcher and parser
- `/js/views/s-sar-view.js` - S-SAR view controller
- `/S-SAR_IMPLEMENTATION.md` - This documentation

### Files Modified:
- `/index.html` - Added S-SAR navigation tab and view container
- `/js/core/app.js` - Integrated S-SAR view and event handlers

## Testing Checklist

### Before Production Deployment:
- [ ] Test "Refresh Data" button functionality
- [ ] Verify data fetches from Google Sheets
- [ ] Confirm sessions save to Supabase
- [ ] Check monthly summary displays correctly
- [ ] Test month selector dropdown
- [ ] Verify location breakdown (SC/RWC)
- [ ] Test with empty database (first time)
- [ ] Test with existing data (upsert logic)
- [ ] Check error handling for network failures
- [ ] Verify date parsing for various formats
- [ ] Test currency formatting
- [ ] Confirm RPA calculations

## Configuration

### Google Sheets API URL
If you need to change the data source, update:
```javascript
// In js/core/session-data-client.js
this.apiUrl = 'YOUR_NEW_GOOGLE_SHEETS_API_URL';
```

### Row Numbers
If your Google Sheets structure changes, update row numbers in:
```javascript
// In parseSessionColumn() method
const flashSales = this.parseNumber(getRowValue(5)); // Update row number
```

## Deployment

### To Deploy to GitHub Pages:
1. Commit all new files:
   ```bash
   git add js/core/session-data-client.js
   git add js/views/s-sar-view.js
   git add index.html
   git add js/core/app.js
   git add S-SAR_IMPLEMENTATION.md
   git commit -m "Add S-SAR (Sessions Standalone Reporting) feature"
   git push origin main
   ```

2. GitHub Pages will automatically rebuild
3. Access at: https://vanguarddatadev.github.io/sar-app/

### Post-Deployment Testing:
1. Open S-SAR tab
2. Click "Refresh Data"
3. Verify data loads from Google Sheets
4. Check Supabase database for new session records
5. Verify monthly summary displays

## Success Criteria

### MVP Achieved ✅
- [x] S-SAR tab added to navigation
- [x] Fetch session data from Google Sheets
- [x] Parse and validate session data
- [x] Save sessions to Supabase database
- [x] Display monthly summary view
- [x] Month selector for historical data
- [x] Location breakdown (SC/RWC)
- [x] Revenue category breakdown
- [x] Error handling and user feedback

## Notes

### Database Triggers
The sessions table has a trigger that automatically calculates:
- `flash_net` = flash_sales - flash_payouts
- `flash_yield` = (flash_net / flash_sales) * 100
- `total_sales` = sum of all revenue types
- `total_payouts` = sum of all payouts
- `net_revenue` = total_sales - total_payouts
- `total_rpa` = total_sales / attendance
- `flash_rpa` = flash_sales / attendance

This means you don't need to calculate these fields in JavaScript - they're automatically computed on INSERT/UPDATE.

### Monthly Summaries View
The `monthly_summaries` view automatically:
- Groups by month and location
- Provides pre-aggregated metrics
- Updates whenever sessions table changes
- No manual aggregation needed

## Support

For questions or issues:
1. Check browser console for error messages
2. Verify Supabase connection is active
3. Confirm Google Sheets API is accessible
4. Review this documentation for configuration

---

**Last Updated:** October 16, 2025
**Version:** 1.0 (MVP)
**Status:** ✅ Complete and Ready for Testing
