# SAR - Standalone Reporting

Bingo Hall financial reporting and forecasting application for Santa Clara Vanguard.

## Features

### V1 (Current)
- ✅ **Admin Portal** - Configure all settings without code changes
- ✅ **QB Category Mapping** - Map QuickBooks categories to SAR categories
- ✅ **Expense Allocation Rules** - Configure how expenses split between locations
- ✅ **Revenue Category Manager** - Manage revenue types and county report mapping
- ✅ **Session Data Import** - Import from GSheet JSON exports
- ✅ **Dashboard** - View monthly metrics and summaries
- 🚧 **County Report Generator** - Generate monthly reports for city filing
- 🚧 **Interactive Forecast** - 24-month forecast with adjustments
- 🚧 **QuickBooks Integration** - Sync expenses, create journal entries

### V2 (Planned)
- Vanguard Data App integration
- Multi-user support
- Advanced forecasting scenarios
- Automated QB sync
- PDF report generation

---

## Quick Start

### 1. Set Up Supabase

1. Create a free account at [supabase.com](https://supabase.com)
2. Create a new project
3. Go to **Project Settings** → **API**
4. Copy your:
   - Project URL
   - `anon` public key

### 2. Run Database Migration

1. In Supabase, go to **SQL Editor**
2. Click **New Query**
3. Copy and paste the contents of `/sql/migrations/001_initial_schema.sql`
4. Click **Run**
5. Verify tables were created in **Table Editor**

### 3. Launch SAR

**Option A: Local Development**
```bash
cd /home/aring/sar-app
python3 -m http.server 8000
```
Open `http://localhost:8000` in your browser

**Option B: Deploy to Vercel/Netlify**
- Just drag & drop the `sar-app` folder
- No build step needed!

### 4. Connect to Supabase

1. When you first open SAR, you'll see a setup screen
2. Enter your Supabase URL and anon key
3. Click **Connect**
4. SAR will test the connection and save your credentials

---

## Project Structure

```
sar-app/
├── index.html              # Main app HTML
├── css/
│   └── main.css           # Vanguard-inspired styling
├── js/
│   ├── core/
│   │   ├── app.js         # Main application logic
│   │   └── supabase-client.js  # Database client
│   ├── models/            # Data models (future)
│   ├── views/             # View components (future)
│   ├── components/        # Reusable UI components (future)
│   └── utils/             # Utility functions (future)
├── sql/
│   └── migrations/
│       └── 001_initial_schema.sql  # Database schema
└── README.md              # This file
```

---

## Admin Portal Guide

### QuickBooks Integration

**Category Mapping:**
1. Go to **Admin** → **QuickBooks**
2. Click **Add Mapping**
3. Enter QB category name (e.g., "Janitorial Services")
4. Select SAR category (e.g., "janitorial")
5. Optionally enter QB Account ID
6. Save

**Why this matters:**
When QB expenses are synced, SAR uses these mappings to categorize expenses correctly.

### Expense Allocation Rules

**How it works:**
- Each expense category has an allocation method
- **revenue_share**: Split by % of revenue (SC had 60% revenue → gets 60% of expense)
- **fixed_percent**: Fixed percentages (Insurance: 20% SC, 5% RWC, 75% unallocated)
- **location_specific**: 100% to one location (Rent: 100% RWC)

**To edit:**
1. Go to **Admin** → **Expense Rules**
2. Click **Edit** on any rule
3. Modify percentages or method
4. Save

### Revenue Categories

Configure which revenue types appear in:
- Session data imports
- County reports
- Forecasts

**Monthly-only categories:**
- ATM Fees
- Quarterly Sales Tax
- Gift Certificates Purchased (if not tracked per session)

---

## Data Import

### GSheet JSON Format

SAR expects JSON in the Vanguard app format:

```javascript
{
  "sc": {
    "columns": [
      {
        "header": "5/2/2025 Friday",
        "data": {
          "row3": { "value": "5/2/2025" },  // Date
          "row4": { "value": "Friday" },    // Day
          "row6": { "value": 1988640 },     // Flash Sales
          "row8": { "value": 49888 },       // Paper Sales
          "row12": { "value": 3131771 },    // Total Sales
          "row29": { "value": 2090123 },    // Total Payouts
          "row40": { "value": 314 }         // Attendance
        }
      }
    ]
  },
  "rwc": { /* same structure */ }
}
```

**To import:**
1. Export JSON from your GSheet script
2. Go to **Admin** → **Data Import**
3. Drag & drop the JSON file
4. Preview the data
5. Click **Import**

---

## Database Schema

### Key Tables

**sessions** - Individual bingo sessions
- Unique by: `location + date + session_type`
- Tracks: revenue, payouts, attendance, yields
- Auto-calculates: net revenue, per-attendee metrics

**qb_expenses** - Monthly QuickBooks expenses
- One row per month
- All expense categories from county report

**expense_allocation_rules** - How expenses split
- User-configurable via admin portal

**qb_category_mapping** - QB → SAR category mapping
- User-configurable via admin portal

**revenue_categories** - Revenue type configuration
- Controls what appears in imports/reports

### Views

**v_monthly_summary** - Aggregated session data by month/location

**v_revenue_share** - Revenue % by location for expense allocation

---

## Roadmap

### Next Steps (Priority Order)

1. **QB OAuth Integration**
   - Connect to QuickBooks
   - Fetch expense data
   - Sync daily

2. **County Report Generator**
   - PDF generation matching exact format
   - Session detail tables
   - Revenue/expense breakdown

3. **Interactive Forecast**
   - 24-month projection
   - Percentage/absolute adjustments
   - Cascade forward logic
   - Year-over-year comparison

4. **QB Journal Entry Builder**
   - Template system (configurable via admin)
   - Test entry generator
   - Send to QB for approval

5. **Data Validation**
   - Pre-import checks
   - Reconciliation warnings
   - Duplicate detection

---

## Architecture Decisions

### Why Admin Portal First?

- Everything is configurable without code changes
- Test different QB entry structures without redeploying
- Easy to hand off to non-technical users
- Provides immediate value (even before QB integration)

### Why Supabase?

- Built-in PostgreSQL (powerful queries/views)
- Real-time subscriptions (future feature)
- Row-level security (for multi-user V2)
- Generous free tier
- Easy to migrate elsewhere if needed

### Why Vanilla JS?

- No build step = faster iteration
- Easier debugging
- Smaller bundle size
- You already understand it from Vanguard app
- Can add React/Vue later if needed

---

## FAQ

**Q: Can I use the sandbox QuickBooks account?**
A: Yes! In Admin → Settings, set QB Environment to "sandbox"

**Q: What if my QB category names don't match exactly?**
A: That's why we have the mapping table! Just create a mapping for each variation.

**Q: Do I need to import all historical data?**
A: No, start with recent months. You can always import older data later.

**Q: Can I edit imported session data?**
A: Future feature. For now, fix data in GSheet and re-import.

**Q: What happens if I import the same data twice?**
A: Sessions are uniquely identified by location+date+type. Reimporting will update existing sessions.

---

## Support

### Issues
- Check browser console for errors
- Verify Supabase connection in Network tab
- Check database tables in Supabase Table Editor

### Common Errors

**"Supabase client not initialized"**
- Clear localStorage and re-enter credentials
- Verify URL and key are correct

**"PGRST116" error**
- Database table doesn't exist
- Run migration again

**"Unique constraint violation"**
- Trying to insert duplicate session
- Use upsert instead (already done in import)

---

## Contributing

This is a private app built via vibe coding. If you find bugs or have ideas:
1. Document the issue clearly
2. Provide sample data if relevant
3. Screenshots help!

---

## License

Proprietary - Santa Clara Vanguard Internal Use Only
