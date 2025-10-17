# SAR Setup Instructions

## Supabase Configuration

To configure your Supabase credentials:

1. Open `js/core/app.js`
2. Find lines 16-17 in the `SARApp` constructor
3. Replace the placeholder values with your actual Supabase credentials:

```javascript
this.SUPABASE_URL = 'YOUR_SUPABASE_URL_HERE';
this.SUPABASE_SERVICE_KEY = 'YOUR_SUPABASE_SERVICE_KEY_HERE';
```

### Where to find your credentials:

1. Go to your Supabase project dashboard
2. Click on **Settings** (gear icon in sidebar)
3. Click on **API** in the settings menu
4. Copy:
   - **Project URL** → Use this for `SUPABASE_URL`
   - **service_role key** (under "Project API keys") → Use this for `SUPABASE_SERVICE_KEY`

   ⚠️ **Important**: Use the `service_role` key, NOT the `anon` key!

### Example:

```javascript
this.SUPABASE_URL = 'https://abcdefghijklmnop.supabase.co';
this.SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

## Organization Name

To set your organization name in the header:

1. Open browser console (F12)
2. Run: `localStorage.setItem('sar_organization_name', 'YOUR ORGANIZATION NAME')`
3. Refresh the page

Or update it in the Settings view (coming soon).

## First Time Setup

After configuring credentials:

1. Refresh your browser
2. The app should connect automatically to Supabase
3. Go to "Session Analysis" and click "Refresh Data" to import session data from Google Sheets
4. Navigate through the different reports to explore your data

## Troubleshooting

If you see connection errors:
- Verify your Supabase URL and key are correct
- Check browser console (F12) for detailed error messages
- Ensure your Supabase project is active and accessible
