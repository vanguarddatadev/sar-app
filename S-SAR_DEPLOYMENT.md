# S-SAR Deployment Instructions

## Files to Deploy to GitHub Pages

Deploy these new files to your GitHub repository:

```bash
# New files created:
js/core/session-data-client.js
js/views/s-sar-view.js
S-SAR_IMPLEMENTATION.md
S-SAR_DEPLOYMENT.md

# Modified files:
index.html
js/core/app.js
```

## Deployment Steps

### 1. Commit All Changes

```bash
cd /mnt/c/Users/aring/NewCo/SAR

# Add all new and modified files
git add js/core/session-data-client.js
git add js/views/s-sar-view.js
git add S-SAR_IMPLEMENTATION.md
git add S-SAR_DEPLOYMENT.md
git add index.html
git add js/core/app.js

# Commit with descriptive message
git commit -m "Add S-SAR (Sessions Standalone Reporting) feature

- Added S-SAR tab to navigation
- Created session data client to fetch from Google Sheets
- Built session parser for Vanguard GSheet format
- Implemented database upsert logic for sessions
- Created monthly summary view with location breakdown
- Integrated with existing Supabase database schema"

# Push to GitHub
git push origin main
```

### 2. Wait for GitHub Pages to Rebuild

- GitHub Pages automatically rebuilds when you push to main
- Typically takes 1-2 minutes
- Check deployment status at: https://github.com/vanguarddatadev/sar-app/deployments

### 3. Verify Deployment

Visit: https://vanguarddatadev.github.io/sar-app/

**Check that:**
- [ ] S-SAR tab appears in navigation (between Dashboard and County Reports)
- [ ] Clicking S-SAR tab shows the Sessions Standalone Reporting view
- [ ] "Refresh Data" button is visible
- [ ] "Last updated: Never" text is visible
- [ ] No JavaScript console errors

### 4. Test Data Fetching

**Initial Test:**
1. Open browser console (F12)
2. Click "Refresh Data" button
3. Watch for console messages:
   - "Fetching session data from Google Sheets..."
   - "✅ Session data fetched successfully"
   - "✅ Parsed X sessions"
   - "✅ Saved X sessions to database"

**Expected Result:**
- Status changes to show loading spinner
- After 3-5 seconds, shows "✅ Successfully loaded X sessions"
- Last updated timestamp appears
- Monthly summary section appears
- Month selector is populated

**If It Fails:**
- Check console for errors
- Verify Supabase connection (should already be working from initial setup)
- Verify Google Sheets API URL is accessible
- Check that database schema includes `sessions` table and `v_monthly_summary` view

### 5. Test Monthly Summary

**After successful data fetch:**
1. Verify month selector shows available months (newest first)
2. Verify combined metrics display:
   - Total Sales
   - Net Revenue
   - Total Attendance
   - Avg RPA
3. Verify location cards show SC and RWC breakdown
4. Verify revenue breakdown shows Flash, Strip, Paper sales

**Change Month:**
1. Select different month from dropdown
2. Verify summary updates
3. Check that all metrics recalculate

## Troubleshooting

### Issue: "Failed to load data from Google Sheets"

**Possible Causes:**
- Google Sheets API URL is incorrect
- CORS issues (should be resolved with JSONP)
- Network connectivity issue

**Solution:**
1. Verify API URL in `js/core/session-data-client.js`
2. Test API URL directly in browser
3. Check browser network tab for request details

### Issue: "Failed to save sessions: XXX"

**Possible Causes:**
- Supabase connection not initialized
- Database schema mismatch
- Row Level Security blocking writes

**Solution:**
1. Verify Supabase credentials in browser localStorage
2. Check that you're using the **service role key** (not anon key)
3. Verify `sessions` table exists in Supabase
4. Check RLS is disabled (should be from `002_disable_rls.sql`)

### Issue: Monthly summary shows "No data for this month"

**Possible Causes:**
- Sessions saved but view query failed
- Date format mismatch
- View returns no results

**Solution:**
1. Check Supabase `sessions` table has data
2. Verify dates are in YYYY-MM-DD format
3. Query `v_monthly_summary` view directly in Supabase SQL editor:
   ```sql
   SELECT * FROM v_monthly_summary
   WHERE month >= '2024-01-01'
   ORDER BY month DESC, location;
   ```

### Issue: Month selector is empty

**Possible Causes:**
- No sessions were parsed
- Date parsing failed
- Sessions array is empty

**Solution:**
1. Check console for "✅ Parsed X sessions" message
2. Verify sessions array in browser debugger
3. Check that session dates are valid

## Database Verification

### Check Sessions Table

```sql
-- View recent sessions
SELECT
  location,
  session_date,
  session_type,
  attendance,
  total_sales,
  net_revenue
FROM sessions
ORDER BY session_date DESC
LIMIT 20;
```

### Check Monthly Summary View

```sql
-- View monthly summaries
SELECT
  month,
  location,
  session_count,
  total_sales,
  net_revenue,
  total_attendance,
  avg_rpa
FROM v_monthly_summary
ORDER BY month DESC, location;
```

### Check for Errors

```sql
-- Check sessions with validation errors
SELECT *
FROM sessions
WHERE validation_status = 'error'
OR validation_errors IS NOT NULL;
```

## Production Checklist

Before marking S-SAR as production-ready:

- [ ] Data fetches successfully from Google Sheets
- [ ] Sessions save to Supabase without errors
- [ ] Upsert logic works (re-fetching updates existing sessions)
- [ ] Monthly summary displays correctly
- [ ] Location breakdown shows SC and RWC
- [ ] Month selector works for all available months
- [ ] Calculated fields (flash_net, flash_yield, etc.) populate correctly
- [ ] RPA calculations are accurate
- [ ] No console errors
- [ ] Mobile responsive (test on phone)
- [ ] Works in multiple browsers (Chrome, Firefox, Safari)

## Next Steps After Deployment

1. **Test with Real Data**
   - Click "Refresh Data" to fetch latest sessions
   - Verify all data looks correct
   - Compare with Vanguard app to validate accuracy

2. **Monitor Database**
   - Check Supabase for session records
   - Verify monthly summaries are calculating
   - Ensure no duplicate sessions

3. **User Training**
   - Show user how to refresh data
   - Explain month selector
   - Demonstrate location breakdown

4. **Plan Future Enhancements**
   - Session-level view (table of all sessions)
   - Date range filtering
   - Export to CSV/Excel
   - Charts and trend visualization
   - Session comparison tools

## Rollback Plan

If S-SAR has critical issues after deployment:

1. **Quick Fix:** Remove S-SAR tab from navigation
   ```html
   <!-- Comment out in index.html -->
   <!-- <button class="nav-tab" data-view="s-sar">S-SAR</button> -->
   ```

2. **Full Rollback:** Revert to previous commit
   ```bash
   git revert HEAD
   git push origin main
   ```

3. **Database Cleanup:** (if needed)
   ```sql
   -- Remove test sessions
   DELETE FROM sessions
   WHERE data_source = 'gsheet'
   AND imported_at > '2025-10-16 00:00:00';
   ```

## Support

- **Documentation:** See `S-SAR_IMPLEMENTATION.md` for technical details
- **Database Schema:** See `sql/migrations/001_initial_schema.sql`
- **Supabase Dashboard:** https://supabase.com/dashboard
- **GitHub Repository:** https://github.com/vanguarddatadev/sar-app

---

**Deployment Date:** October 16, 2025
**Version:** S-SAR MVP 1.0
**Status:** Ready for Production Testing
