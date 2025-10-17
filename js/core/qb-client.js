// QuickBooks API Client (Read-Only)
// Handles OAuth and data fetching from QuickBooks

export class QuickBooksClient {
    constructor() {
        this.accessToken = null;
        this.refreshToken = null;
        this.realmId = null;
        this.tokenExpiry = null;
        this.environment = 'sandbox'; // 'sandbox' or 'production'
    }

    /**
     * Get QB OAuth authorization URL
     * User will click this to authorize SAR to read their QB data
     */
    getAuthUrl(clientId, redirectUri, state) {
        const scope = 'com.intuit.quickbooks.accounting';
        const baseUrl = 'https://appcenter.intuit.com/connect/oauth2';

        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: scope,
            state: state // CSRF protection
        });

        return `${baseUrl}?${params.toString()}`;
    }

    /**
     * Exchange authorization code for tokens
     * Called after user authorizes in QB
     */
    async exchangeCodeForTokens(code, clientId, clientSecret, redirectUri) {
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
                'Authorization': 'Basic ' + btoa(`${clientId}:${clientSecret}`)
            },
            body: body.toString()
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(`QB OAuth error: ${data.error_description || data.error}`);
        }

        this.accessToken = data.access_token;
        this.refreshToken = data.refresh_token;
        this.tokenExpiry = Date.now() + (data.expires_in * 1000);

        // Store tokens (encrypted in production!)
        await this.storeTokens();

        console.log('✅ QB tokens acquired');
        return data;
    }

    /**
     * Refresh access token when expired
     */
    async refreshAccessToken(clientId, clientSecret) {
        const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

        const body = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: this.refreshToken
        });

        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + btoa(`${clientId}:${clientSecret}`)
            },
            body: body.toString()
        });

        const data = await response.json();

        if (!response.ok) {
            if (data.error === 'invalid_grant') {
                throw new Error('REFRESH_TOKEN_EXPIRED');
            }
            throw new Error(`Refresh failed: ${data.error_description || data.error}`);
        }

        this.accessToken = data.access_token;
        this.refreshToken = data.refresh_token;
        this.tokenExpiry = Date.now() + (data.expires_in * 1000);

        await this.storeTokens();
        console.log('✅ QB tokens refreshed');
        return data;
    }

    /**
     * Make authenticated request to QB API
     */
    async makeRequest(endpoint, clientId, clientSecret) {
        // Refresh token if expired (within 5 min)
        if (this.tokenExpiry && Date.now() > this.tokenExpiry - 300000) {
            await this.refreshAccessToken(clientId, clientSecret);
        }

        const baseUrl = this.environment === 'production'
            ? 'https://quickbooks.api.intuit.com'
            : 'https://sandbox-quickbooks.api.intuit.com';

        const url = `${baseUrl}/v3/company/${this.realmId}/${endpoint}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        // Handle rate limiting
        if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After') || 60;
            console.log(`⏳ Rate limited, waiting ${retryAfter}s...`);
            await this.sleep(retryAfter * 1000);
            return this.makeRequest(endpoint, clientId, clientSecret);
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(`QB API error: ${JSON.stringify(data)}`);
        }

        return data;
    }

    /**
     * Fetch Chart of Accounts
     * This shows all account names and IDs
     */
    async getChartOfAccounts(clientId, clientSecret) {
        try {
            const sql = "SELECT * FROM Account WHERE AccountType = 'Expense' MAXRESULTS 1000";
            const endpoint = `query?query=${encodeURIComponent(sql)}`;
            const data = await this.makeRequest(endpoint, clientId, clientSecret);

            const accounts = data.QueryResponse?.Account || [];
            console.log(`✅ Fetched ${accounts.length} expense accounts from QB`);

            return accounts.map(acc => ({
                id: acc.Id,
                name: acc.Name,
                fullyQualifiedName: acc.FullyQualifiedName,
                accountType: acc.AccountType,
                accountSubType: acc.AccountSubType,
                active: acc.Active
            }));

        } catch (error) {
            console.error('❌ Failed to fetch Chart of Accounts:', error);
            throw error;
        }
    }

    /**
     * Fetch Profit & Loss Report
     * This is where we get expense amounts by category
     */
    async getProfitAndLoss(startDate, endDate, clientId, clientSecret) {
        try {
            const params = new URLSearchParams({
                start_date: startDate,
                end_date: endDate,
                accounting_method: 'Cash',
                summarize_column_by: 'Total'
            });

            const endpoint = `reports/ProfitAndLoss?${params.toString()}`;
            const data = await this.makeRequest(endpoint, clientId, clientSecret);

            console.log('✅ Fetched P&L report from QB');
            return this.parseProfitAndLoss(data);

        } catch (error) {
            console.error('❌ Failed to fetch P&L report:', error);
            throw error;
        }
    }

    /**
     * Parse QB Profit & Loss report into expense categories
     */
    parseProfitAndLoss(plData) {
        const expenses = {};

        // QB P&L structure is nested rows
        const parseRows = (rows) => {
            if (!rows) return;

            rows.forEach(row => {
                if (row.type === 'Data' && row.ColData) {
                    const accountName = row.ColData[0]?.value;
                    const amountStr = row.ColData[1]?.value;

                    // Parse amount (remove commas, handle negatives)
                    let amount = 0;
                    if (amountStr && amountStr !== '') {
                        amount = parseFloat(amountStr.replace(/,/g, '')) || 0;
                    }

                    if (accountName && amount !== 0) {
                        expenses[accountName] = amount;
                    }
                }

                // Recurse into nested rows
                if (row.Rows?.Row) {
                    parseRows(row.Rows.Row);
                }
            });
        };

        if (plData.Rows?.Row) {
            parseRows(plData.Rows.Row);
        }

        console.log(`📊 Parsed ${Object.keys(expenses).length} expense categories from P&L`);
        return expenses;
    }

    /**
     * Fetch specific expense transactions (optional - for detail)
     */
    async getExpenseTransactions(startDate, endDate, clientId, clientSecret) {
        try {
            const sql = `
                SELECT * FROM Purchase
                WHERE TxnDate >= '${startDate}' AND TxnDate <= '${endDate}'
                AND PaymentType = 'Cash'
                MAXRESULTS 1000
            `;

            const endpoint = `query?query=${encodeURIComponent(sql)}`;
            const data = await this.makeRequest(endpoint, clientId, clientSecret);

            const purchases = data.QueryResponse?.Purchase || [];
            console.log(`✅ Fetched ${purchases.length} purchase transactions`);

            return purchases;

        } catch (error) {
            console.error('❌ Failed to fetch expense transactions:', error);
            throw error;
        }
    }

    /**
     * Get company info
     */
    async getCompanyInfo(clientId, clientSecret) {
        try {
            const data = await this.makeRequest('companyinfo/' + this.realmId, clientId, clientSecret);

            const company = data.CompanyInfo;
            console.log('✅ Fetched company info:', company.CompanyName);

            return {
                name: company.CompanyName,
                legalName: company.LegalName,
                email: company.Email?.Address,
                country: company.Country
            };

        } catch (error) {
            console.error('❌ Failed to fetch company info:', error);
            throw error;
        }
    }

    /**
     * Test connection
     */
    async testConnection(clientId, clientSecret) {
        try {
            await this.getCompanyInfo(clientId, clientSecret);
            return true;
        } catch (error) {
            console.error('❌ QB connection test failed:', error);
            return false;
        }
    }

    /**
     * Store tokens in localStorage (encrypt in production!)
     */
    async storeTokens() {
        const tokens = {
            access_token: this.accessToken,
            refresh_token: this.refreshToken,
            realm_id: this.realmId,
            token_expiry: this.tokenExpiry,
            environment: this.environment
        };

        // In production, encrypt this!
        localStorage.setItem('sar_qb_tokens', JSON.stringify(tokens));
    }

    /**
     * Load tokens from storage
     */
    async loadTokens() {
        const tokensJson = localStorage.getItem('sar_qb_tokens');
        if (!tokensJson) return false;

        const tokens = JSON.parse(tokensJson);
        this.accessToken = tokens.access_token;
        this.refreshToken = tokens.refresh_token;
        this.realmId = tokens.realm_id;
        this.tokenExpiry = tokens.token_expiry;
        this.environment = tokens.environment || 'sandbox';

        return true;
    }

    /**
     * Clear stored tokens (disconnect)
     */
    clearTokens() {
        this.accessToken = null;
        this.refreshToken = null;
        this.realmId = null;
        this.tokenExpiry = null;
        localStorage.removeItem('sar_qb_tokens');
    }

    /**
     * Check if connected
     */
    isConnected() {
        return this.accessToken !== null && this.realmId !== null;
    }

    /**
     * Sleep helper
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Export singleton
export const qbClient = new QuickBooksClient();
