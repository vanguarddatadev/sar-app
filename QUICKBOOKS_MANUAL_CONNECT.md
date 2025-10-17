# QuickBooks Manual Connection Guide

## Quick Setup (5 Minutes)

This guide shows how to connect QuickBooks to SAR **without setting up OAuth backend** by manually entering tokens.

---

## Steps for Admin

### 1. Get Tokens from QuickBooks OAuth Playground

1. Go to: https://developer.intuit.com/app/developer/playground

2. **Log in** with your Intuit Developer account

3. **Select your QuickBooks Company** from the dropdown

4. Click the blue **"Get OAuth2 Token"** button

5. **Authorize** the connection (if prompted)

6. You'll see a response with tokens - **keep this page open!**

---

### 2. Enter Tokens in SAR

1. Open SAR application (index.html)

2. Navigate to: **Configuration → QuickBooks Sync**

3. Click the **"Connect to QuickBooks"** button

4. In the popup, click **"OK"** for Manual Token Entry (easier option)

5. A form will appear with 4 fields:

---

### 3. Copy & Paste the Following:

**From the OAuth Playground response, copy these values:**

#### Access Token
- Find: `"access_token": "eyJlbmMiOi..."`
- Copy everything between the quotes (the long string)
- Paste into **Access Token** field in SAR

#### Refresh Token
- Find: `"refresh_token": "L0118615..."`
- Copy everything between the quotes
- Paste into **Refresh Token** field in SAR

#### Realm ID (Company ID)
- Find: `"realmId": "9341452843828347"`
- Copy the number
- Paste into **Realm ID** field in SAR

#### Environment
- If using **sandbox/test** QB company: Select "Sandbox (Testing)"
- If using **production/live** QB company: Select "Production (Live)"

---

### 4. Click "Connect"

- SAR will test the connection
- If successful, you'll see: **"✅ Connected to QuickBooks successfully!"**
- You can now sync expenses!

---

## Token Expiration

⏱️ **Important:**

- **Access Token**: Expires in **1 hour**
  - SAR will automatically refresh it using the Refresh Token

- **Refresh Token**: Valid for **100 days**
  - After 100 days, repeat this process to get new tokens

---

## Troubleshooting

### ❌ "Connection test failed"

**Possible causes:**
1. Wrong Company ID (Realm ID) - make sure it matches your QB company
2. Token already expired - get fresh tokens from OAuth Playground
3. Wrong environment selected (sandbox vs production)

**Solution:** Delete tokens and try again with fresh ones

---

### ❌ "Invalid grant" error when syncing

**Cause:** Refresh token expired (after 100 days)

**Solution:** Get new tokens from OAuth Playground and reconnect

---

### ❌ Can't find tokens in OAuth Playground response

**Solution:** Look for JSON response like this:

```json
{
  "token_type": "bearer",
  "access_token": "eyJlbmMiOiJBMTI4Q0JDLUhTMjU2...",
  "refresh_token": "L011861527914S5ojiazGFwl...",
  "expires_in": 3600,
  "x_refresh_token_expires_in": 8726400
}
```

Also check the URL parameters - `realmId` appears there:
```
?realmId=9341452843828347&code=...
```

---

## What You Can Do After Connecting

Once connected, you can:

1. ✅ **Import Chart of Accounts** - Map QB expense categories to SAR categories
2. ✅ **Sync Monthly Expenses** - Pull P&L data from QuickBooks
3. ✅ **Automatic Categorization** - Expenses automatically mapped using your rules
4. ✅ **Test Connection** - Verify tokens are still valid

---

## Security Notes

🔒 **Important:**

- Tokens are stored in browser's localStorage
- Only access SAR on trusted computers
- Don't share your Access/Refresh tokens
- Tokens give **read-only** access to your QuickBooks data

---

## Need Help?

If you encounter issues:
1. Check that you're using the correct QB company
2. Verify environment (sandbox vs production) matches
3. Get fresh tokens from OAuth Playground
4. Contact your developer for assistance

---

## Alternative: Full OAuth Setup

If you prefer proper OAuth flow (recommended for production):
- See: `QUICKBOOKS_OAUTH_FIX.md`
- Requires setting up a backend server/function
- More secure for long-term use
- No manual token entry needed

---

**Last Updated:** 2025-10-17
