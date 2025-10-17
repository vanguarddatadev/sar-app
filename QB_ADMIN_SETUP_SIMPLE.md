# QuickBooks Connection Setup for SAR
## Simple Guide for Non-Technical Admins

**Time Required:** 5-10 minutes
**What You Need:** QuickBooks Company Admin access

---

## Step 1: Get Your Tokens from QuickBooks

### 1.1 Open the QuickBooks OAuth Playground

Click this link (or copy/paste into your browser):

```
https://developer.intuit.com/app/developer/playground
```

### 1.2 Sign In

- Click the **"Sign In"** button (top right)
- Use your **Intuit/QuickBooks login** (the same one you use for QuickBooks)
- If asked to authorize, click **"Allow"** or **"Authorize"**

### 1.3 Select Your Company

- Look for a dropdown that says **"Select Company"**
- Choose the QuickBooks company you want to connect to SAR
- Make sure it's the RIGHT company (check the name carefully!)

### 1.4 Get Your Tokens

1. Click the big blue button that says **"Get OAuth 2 Token"**
2. Wait 2-3 seconds while it loads
3. You'll see a box with a bunch of text - **DON'T CLOSE THIS PAGE!**

### 1.5 Find Your 3 Important Values

Look for these in the response (they'll look like this):

```json
{
  "token_type": "bearer",
  "access_token": "eyJlbmMiOiJBMTI4Q0JDLUhTMjU2...",
  "refresh_token": "L011861527914S5ojiazGFwl...",
  "expires_in": 3600,
  "x_refresh_token_expires_in": 8726400
}
```

**You need to copy 3 things:**

1. **Access Token** - The long string after `"access_token":` (between the quotes)
2. **Refresh Token** - The string after `"refresh_token":` (between the quotes)
3. **Realm ID** - Look at the URL at the top of your browser. You'll see something like:
   ```
   ?realmId=9341452843828347&code=...
   ```
   Copy just the number after `realmId=` (before the `&`)

**IMPORTANT:** Keep this page open! You'll need to copy these values in the next step.

---

## Step 2: Enter Tokens into SAR

### 2.1 Open SAR Application

- Open the SAR app in your web browser
- URL: `https://vanguarddatadev.github.io/sar-app/`
- Log in if needed

### 2.2 Go to QuickBooks Settings

1. Look at the **left sidebar**
2. Find **"Configuration"** section
3. Click **"QuickBooks Sync"**

### 2.3 Start Connection

1. Click the big green button: **"Connect to QuickBooks"**
2. A popup will appear
3. Click **"OK"** (this chooses "Manual Token Entry" - the easier option)

### 2.4 Fill in the Form

A form will appear with 4 fields. Fill them in:

#### **Access Token** (Field 1)
- Go back to the QuickBooks OAuth Playground page
- Find `"access_token":`
- Copy everything between the quotes (the long string starting with `eyJ...`)
- Paste it into the **Access Token** field in SAR

#### **Refresh Token** (Field 2)
- Find `"refresh_token":`
- Copy everything between the quotes (starts with `L01...` or similar)
- Paste it into the **Refresh Token** field in SAR

#### **Realm ID** (Field 3)
- Look at the browser URL bar in the OAuth Playground
- Find `realmId=` followed by a number
- Copy just the number (example: `9341452843828347`)
- Paste it into the **Realm ID** field in SAR

#### **Environment** (Field 4 - Dropdown)
- If you're using a **TEST/SANDBOX** QuickBooks company: Select **"Sandbox (Testing)"**
- If you're using your **REAL/LIVE** QuickBooks company: Select **"Production (Live)"**

**Most people will choose "Production (Live)"**

### 2.5 Connect!

1. Double-check all 4 fields are filled in
2. Click the **"Connect"** button at the bottom
3. Wait 3-5 seconds...

**SUCCESS!** You should see:
```
✅ Connected to QuickBooks successfully!
```

### 2.6 Import Chart of Accounts (Optional but Recommended)

After connecting, SAR will ask:
```
Import Chart of Accounts now?
```

Click **"Yes"** or **"OK"** - this brings in your expense categories from QuickBooks so SAR can categorize expenses automatically.

---

## Step 3: You're Done!

That's it! QuickBooks is now connected to SAR.

### What Happens Now?

- SAR can pull your monthly expense data from QuickBooks
- Expenses will be automatically categorized
- You can sync P&L reports
- The connection will work for **100 days** before you need to refresh it

---

## Important Notes

### ⏱️ Token Expiration

- **Access Token:** Expires in 1 hour (SAR automatically refreshes it)
- **Refresh Token:** Valid for 100 days
- After 100 days, you'll need to repeat this process

### 🔒 Security

- Tokens are stored securely in your browser
- They only give **READ access** to your QuickBooks data
- SAR cannot modify or delete anything in QuickBooks
- Only use SAR on trusted computers

### ❓ Troubleshooting

**Problem:** "Connection test failed"

**Try these fixes:**
1. Make sure you copied the **entire** Access Token and Refresh Token (they're very long!)
2. Check that the **Realm ID** is correct (just numbers, no letters)
3. Make sure you selected the right **Environment** (Sandbox vs Production)
4. If still failing, get **fresh tokens** from the OAuth Playground (they expire after 1 hour if not used)

---

**Problem:** "Invalid grant" error when syncing

**Cause:** Refresh token expired (after 100 days)

**Solution:** Repeat Step 1 and Step 2 to get new tokens

---

## Need Help?

If you get stuck:
1. Make sure you're logged into the correct QuickBooks company
2. Try closing the OAuth Playground page and starting over
3. Contact your SAR administrator/developer

---

## Quick Reference Card

**Step 1:** Go to https://developer.intuit.com/app/developer/playground
**Step 2:** Sign in → Select Company → Click "Get OAuth 2 Token"
**Step 3:** Copy Access Token, Refresh Token, and Realm ID
**Step 4:** Open SAR → Configuration → QuickBooks Sync
**Step 5:** Click "Connect to QuickBooks" → Click "OK"
**Step 6:** Paste the 3 values + select Environment
**Step 7:** Click "Connect" → Done!

---

**Last Updated:** 2025-10-17
