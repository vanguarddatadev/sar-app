# QuickBooks Integration Setup Guide

## Overview

SAR can connect to your QuickBooks account using **read-only access** to:
- ✅ Fetch Profit & Loss reports (expenses by category)
- ✅ Import Chart of Accounts (account names/IDs)
- ✅ Auto-map QB categories to SAR categories
- ❌ Create journal entries (requires write access - can add later)

---

## Step 1: Create a QuickBooks Developer Account

### 1.1 Sign Up
1. Go to [https://developer.intuit.com](https://developer.intuit.com)
2. Sign in with your Intuit account (or create one)
3. Verify your email

### 1.2 Create an App
1. Go to **Dashboard** → **My Apps**
2. Click **Create an app**
3. Select **QuickBooks Online API**
4. Choose app name: `SAR - Standalone Reporting`
5. Click **Create app**

---

## Step 2: Configure Your App

### 2.1 Get Credentials
1. In your app dashboard, go to **Keys & credentials**
2. Under **Development**, copy:
   - **Client ID** (starts with `AB...`)
   - **Client Secret** (starts with ...)
3. **Save these somewhere safe!**

### 2.2 Set Redirect URI
1. Still in **Keys & credentials**
2. Under **Redirect URIs**, add:
   ```
   http://localhost:8000/qb-callback.html
   ```
   (Or your actual domain if deployed)

3. Click **Save**

---

## Step 3: Connect SAR to QuickBooks

### 3.1 Enter Credentials in SAR
1. Open SAR in your browser
2. Go to **Admin** → **QuickBooks**
3. Click **Connect to QuickBooks**
4. You'll be prompted for Client ID and Secret
5. Paste the values from Step 2.1
6. Click **Save & Continue**

### 3.2 Authorize SAR
1. A QuickBooks window will pop up
2. **Sign in** to your QuickBooks account
3. Select which **company** to connect
4. Click **Authorize**
5. The window will close automatically

### 3.3 Verify Connection
1. You should see **Connected** status in SAR
2. Company name should be displayed
3. Click **Test Connection** to verify

---

## Step 4: Import Chart of Accounts

### 4.1 Fetch QB Accounts
1. In SAR Admin → QuickBooks
2. Click **Import from QB**
3. Wait a few seconds while SAR fetches your accounts

### 4.2 Map Accounts to SAR Categories
1. A modal will show all your QB expense accounts
2. For each account you want to track:
   - ✅ Check the checkbox
   - Select the matching SAR category
3. Click **Import Selected**

**Example Mappings:**
```
QB Account              →  SAR Category
─────────────────────────────────────────
Janitorial Services     →  janitorial
Security                →  security
Office Supplies         →  office_supplies
Insurance               →  insurance
Rent                    →  premises_rent
```

---

## Step 5: Sync Expenses

### 5.1 Manual Sync
1. Go to Admin → QuickBooks
2. Click **Sync Now**
3. SAR will fetch current month's P&L report
4. Review the results modal
5. Click **Save to Database**

### 5.2 Review Synced Data
1. Expense amounts are shown by SAR category
2. Unmapped categories will be flagged
3. Go add mappings for any unmapped categories

---

## Using Read-Only Access

### What You CAN Do
✅ **Fetch Expense Data**
- Pull Profit & Loss reports for any date range
- Get expense amounts by category
- See which accounts have activity

✅ **Import Accounts**
- Fetch Chart of Accounts
- Get account names and IDs
- Auto-suggest category mappings

✅ **View Company Info**
- Company name
- Legal name
- Country/settings

### What You CANNOT Do (Read-Only)
❌ **Create Journal Entries**
- Requires write access (`com.intuit.quickbooks.accounting.write`)
- Can be added later if needed

❌ **Modify Data**
- Cannot create/update/delete anything in QB
- Read-only is safer for initial setup

---

## Troubleshooting

### "Invalid Client ID or Secret"
- Double-check you copied correctly from QB Developer
- Make sure there are no extra spaces
- Verify you're using **Development** credentials (not Production)

### "Redirect URI mismatch"
- Make sure your SAR URL matches the redirect URI in QB app settings
- If using localhost, it must be exact: `http://localhost:8000/qb-callback.html`
- If deployed, use your actual domain

### "Token expired"
- QB access tokens expire after 1 hour
- SAR auto-refreshes tokens
- If refresh fails, just reconnect (click Disconnect, then Connect again)

### "No expenses found"
- Make sure you selected the correct company
- Verify there are expenses in QB for the current month
- Check date range in QB

### "Unmapped categories"
- QB category names don't match SAR categories
- Go to Category Mapping and add the missing mappings
- Then sync again

---

## FAQ

**Q: Do I need a paid QB Developer account?**
A: No! The free developer account includes sandbox access and up to 100 connections.

**Q: Can I use my production QB data?**
A: Yes! Just use Production credentials instead of Development credentials.

**Q: What if I have multiple QB companies?**
A: You can connect to one company at a time. Disconnect and reconnect to switch companies.

**Q: How often should I sync?**
A: Manually sync when you need updated expense data. You can set up auto-sync later.

**Q: Will SAR modify my QB data?**
A: No! With read-only access, SAR can only fetch data, never modify it.

**Q: Can I add write access later for journal entries?**
A: Yes! Just update your QB app scope and reconnect.

---

## Security Notes

⚠️ **Important:**
- Client Secret is stored in localStorage (browser-only)
- Access tokens expire after 1 hour
- Refresh tokens expire after 100 days
- SAR never sends your QB credentials to any server
- All QB API calls are direct from your browser to QuickBooks

🔒 **For Production:**
- Consider encrypting tokens
- Use HTTPS for your SAR deployment
- Rotate Client Secret periodically
- Monitor OAuth access in QB

---

## Next Steps

Once connected:
1. ✅ Import all your QB expense accounts
2. ✅ Map them to SAR categories
3. ✅ Sync current month's expenses
4. ✅ Review expense allocation in SAR
5. ✅ Generate county reports with real QB data!

---

Need help? Check the SAR README or QB API docs at https://developer.intuit.com/app/developer/qbo/docs/get-started
