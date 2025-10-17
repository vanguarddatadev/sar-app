# QuickBooks OAuth Issue - "Failed to fetch"

## Problem

The error `OAuth failed: Failed to fetch` occurs because the SAR application is trying to exchange the OAuth authorization code for tokens directly from the browser, which fails due to:

1. **CORS (Cross-Origin Resource Sharing)** - QuickBooks token endpoint doesn't allow browser requests
2. **Security** - The Client Secret should never be exposed in browser JavaScript
3. **QuickBooks API Requirements** - Token exchange must happen server-side

## Current Flow (BROKEN)

```
Browser → QB Auth → Callback → Browser tries to fetch tokens → ❌ CORS Error
```

## Required Flow (SECURE)

```
Browser → QB Auth → Callback → Backend exchanges tokens → ✅ Success
```

---

## Solution Options

### Option 1: Supabase Edge Function (Recommended for SAR)

Since you're already using Supabase, create an Edge Function to handle the OAuth exchange.

**Step 1: Create Supabase Edge Function**

File: `supabase/functions/qb-oauth-exchange/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const { code, redirectUri, realmId } = await req.json()

    // Get QB credentials from Supabase settings
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: clientIdSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'qb.client_id')
      .single()

    const { data: clientSecretSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'qb.client_secret')
      .single()

    const clientId = clientIdSetting?.value
    const clientSecret = clientSecretSetting?.value

    if (!clientId || !clientSecret) {
      throw new Error('QB credentials not configured')
    }

    // Exchange code for tokens
    const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri
    })

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + btoa(`${clientId}:${clientSecret}`)
      },
      body: body.toString()
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(`QB OAuth error: ${data.error_description || data.error}`)
    }

    // Return tokens (they'll be stored in browser localStorage)
    return new Response(
      JSON.stringify({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        token_expiry: Date.now() + (data.expires_in * 1000),
        realm_id: realmId
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
```

**Step 2: Deploy the Edge Function**

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref nqwnkikattupnvtubfsu

# Deploy the function
supabase functions deploy qb-oauth-exchange
```

**Step 3: Update qb-client.js**

Replace the `exchangeCodeForTokens()` method:

```javascript
async exchangeCodeForTokens(code, realmId, redirectUri) {
    // Call our Edge Function instead of direct QB API
    const functionUrl = 'https://nqwnkikattupnvtubfsu.supabase.co/functions/v1/qb-oauth-exchange';

    const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}` // Your anon key
        },
        body: JSON.stringify({
            code: code,
            redirectUri: redirectUri,
            realmId: realmId
        })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(`QB OAuth error: ${data.error}`);
    }

    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token;
    this.tokenExpiry = data.token_expiry;
    this.realmId = data.realm_id;

    // Store tokens (encrypted in production!)
    await this.storeTokens();

    console.log('✅ QB tokens acquired');
    return data;
}
```

---

### Option 2: Simple Node.js Backend

If you don't want to use Supabase Edge Functions, create a simple Express server:

**server.js:**

```javascript
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/qb-oauth-exchange', async (req, res) => {
    try {
        const { code, redirectUri, clientId, clientSecret } = req.body;

        const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

        const body = new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: redirectUri
        });

        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
            },
            body: body.toString()
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(400).json({ error: data.error_description || data.error });
        }

        res.json(data);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
```

---

### Option 3: Use QuickBooks' Intuit OAuth Playground (Testing Only)

For testing purposes, you can use Intuit's OAuth Playground, but this won't work for production.

---

## Recommendation

For your SAR application, I recommend **Option 1 (Supabase Edge Function)** because:

1. ✅ You're already using Supabase
2. ✅ No separate server to maintain
3. ✅ Scales automatically
4. ✅ Free tier includes 500K function invocations/month
5. ✅ Keeps credentials secure server-side

## Next Steps

1. Decide which solution you want to implement
2. Let me know and I'll help you set it up
3. We'll update the SAR code to use the backend endpoint
4. Test the OAuth flow again

---

## Important Security Notes

⚠️ **Current Code Issues:**

1. Client Secret is stored in browser localStorage (lines in app.js) - this is **NOT secure**
2. Client Secret should ONLY be on the backend
3. Consider encrypting OAuth tokens before storing in localStorage

Would you like me to implement the Supabase Edge Function solution for you?
