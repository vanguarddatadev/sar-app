// QuickBooks Admin View
// Handles QB connection, category import, and expense sync

import { qbClient } from '../core/qb-client.js';
import { supabase } from '../core/supabase-client.js';

export class QBAdminView {
    constructor() {
        this.qbClientId = null;
        this.qbClientSecret = null;
        // Get base path from current URL (handles both localhost and GitHub Pages)
        const basePath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
        this.redirectUri = window.location.origin + basePath + 'qb-callback.html';
    }

    async init() {
        // Load QB credentials from Supabase settings
        const clientIdSetting = await supabase.getSetting('qb.client_id');
        const clientSecretSetting = await supabase.getSetting('qb.client_secret');

        this.qbClientId = clientIdSetting?.value || '';
        this.qbClientSecret = clientSecretSetting?.value || '';

        // Load environment setting
        const envSetting = await supabase.getSetting('qb.environment');
        if (envSetting) {
            qbClient.environment = envSetting.value;
        }

        // Try to load existing tokens
        const hasTokens = await qbClient.loadTokens();

        if (hasTokens && this.qbClientId && this.qbClientSecret) {
            // Test connection
            const connected = await qbClient.testConnection(this.qbClientId, this.qbClientSecret);

            if (connected) {
                await this.showConnectedState();
            } else {
                this.showDisconnectedState();
            }
        } else {
            this.showDisconnectedState();
        }
    }

    async showConnectedState() {
        const statusEl = document.getElementById('qbStatus');
        statusEl.innerHTML = `
            <span class="status-dot connected"></span>
            <span class="status-text">Connected</span>
        `;

        document.getElementById('qbConnectBtn').style.display = 'none';
        document.getElementById('qbConnectedDetails').style.display = 'block';

        // Fetch company info
        try {
            const companyInfo = await qbClient.getCompanyInfo(this.qbClientId, this.qbClientSecret);
            document.getElementById('qbCompanyName').textContent = companyInfo.name;
            document.getElementById('qbEnvironment').textContent =
                qbClient.environment === 'sandbox' ? 'Sandbox' : 'Production';

            // Last sync (from settings or local storage)
            const lastSync = localStorage.getItem('sar_qb_last_sync');
            document.getElementById('qbLastSync').textContent = lastSync
                ? new Date(lastSync).toLocaleString()
                : 'Never';

        } catch (error) {
            console.error('Failed to fetch company info:', error);
        }
    }

    showDisconnectedState() {
        const statusEl = document.getElementById('qbStatus');
        statusEl.innerHTML = `
            <span class="status-dot disconnected"></span>
            <span class="status-text">Not Connected</span>
        `;

        document.getElementById('qbConnectBtn').style.display = 'inline-block';
        document.getElementById('qbConnectedDetails').style.display = 'none';
    }

    /**
     * Start QB OAuth flow
     */
    async connectToQB() {
        // Check if credentials are configured
        if (!this.qbClientId || !this.qbClientSecret) {
            const result = await this.showCredentialsPrompt();
            if (!result) return;
        }

        // Generate CSRF state
        const state = this.generateRandomString(32);
        sessionStorage.setItem('qb_oauth_state', state);

        // Get auth URL
        const authUrl = qbClient.getAuthUrl(this.qbClientId, this.redirectUri, state);

        // Open OAuth window
        const width = 600;
        const height = 700;
        const left = (screen.width / 2) - (width / 2);
        const top = (screen.height / 2) - (height / 2);

        const authWindow = window.open(
            authUrl,
            'QB OAuth',
            `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
        );

        // Listen for callback
        window.addEventListener('message', async (event) => {
            if (event.data.type === 'QB_OAUTH_SUCCESS') {
                authWindow?.close();

                const { code, realmId } = event.data;

                // Verify state
                const savedState = sessionStorage.getItem('qb_oauth_state');
                if (event.data.state !== savedState) {
                    alert('❌ OAuth state mismatch. Security error.');
                    return;
                }

                try {
                    // Exchange code for tokens
                    qbClient.realmId = realmId;
                    await qbClient.exchangeCodeForTokens(
                        code,
                        this.qbClientId,
                        this.qbClientSecret,
                        this.redirectUri
                    );

                    alert('✅ Connected to QuickBooks successfully!');
                    await this.showConnectedState();

                    // Optionally auto-fetch Chart of Accounts
                    if (confirm('Import Chart of Accounts now?')) {
                        await this.importChartOfAccounts();
                    }

                } catch (error) {
                    alert('❌ OAuth failed: ' + error.message);
                }
            }
        });
    }

    /**
     * Show credentials input prompt
     */
    async showCredentialsPrompt() {
        return new Promise((resolve) => {
            const html = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>QuickBooks Credentials</h3>
                        <button class="modal-close" onclick="document.getElementById('qbCredentialsModal').classList.remove('active'); document.getElementById('modalOverlay').classList.remove('active');">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p style="color: var(--text-light); margin-bottom: 20px;">
                            Get these from your QuickBooks Developer account.
                        </p>
                        <div class="form-row">
                            <label>Client ID</label>
                            <input type="text" id="qbCredClientId" class="form-input" value="${this.qbClientId}">
                        </div>
                        <div class="form-row">
                            <label>Client Secret</label>
                            <input type="password" id="qbCredClientSecret" class="form-input" value="${this.qbClientSecret}">
                        </div>
                        <p style="font-size: 12px; color: var(--text-light);">
                            Don't have a QB app? <a href="https://developer.intuit.com" target="_blank">Create one here</a>
                        </p>
                    </div>
                    <div class="modal-footer">
                        <button class="btn-primary" id="saveQBCredentials">Save & Continue</button>
                        <button class="btn-secondary modal-close" onclick="document.getElementById('qbCredentialsModal').classList.remove('active'); document.getElementById('modalOverlay').classList.remove('active');">Cancel</button>
                    </div>
                </div>
            `;

            let modal = document.getElementById('qbCredentialsModal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'qbCredentialsModal';
                modal.className = 'modal';
                document.body.appendChild(modal);
            }

            modal.innerHTML = html;
            modal.classList.add('active');
            document.getElementById('modalOverlay').classList.add('active');

            document.getElementById('saveQBCredentials').addEventListener('click', async () => {
                const clientId = document.getElementById('qbCredClientId').value.trim();
                const clientSecret = document.getElementById('qbCredClientSecret').value.trim();

                if (!clientId || !clientSecret) {
                    alert('Please enter both Client ID and Secret');
                    return;
                }

                // Save to Supabase
                await supabase.updateSetting('qb.client_id', clientId);
                await supabase.updateSetting('qb.client_secret', clientSecret);

                this.qbClientId = clientId;
                this.qbClientSecret = clientSecret;

                modal.classList.remove('active');
                document.getElementById('modalOverlay').classList.remove('active');

                resolve(true);
            });
        });
    }

    /**
     * Import Chart of Accounts from QB
     */
    async importChartOfAccounts() {
        try {
            const btn = document.getElementById('importQBCategoriesBtn');
            const originalText = btn.textContent;
            btn.textContent = 'Importing...';
            btn.disabled = true;

            const accounts = await qbClient.getChartOfAccounts(this.qbClientId, this.qbClientSecret);

            // Show selection modal
            this.showAccountSelectionModal(accounts);

            btn.textContent = originalText;
            btn.disabled = false;

        } catch (error) {
            alert('❌ Failed to import: ' + error.message);
        }
    }

    /**
     * Show modal to select which accounts to map
     */
    showAccountSelectionModal(accounts) {
        const html = `
            <div class="modal-content" style="max-width: 700px;">
                <div class="modal-header">
                    <h3>Import QB Accounts (${accounts.length})</h3>
                    <button class="modal-close" onclick="this.closest('.modal').classList.remove('active'); document.getElementById('modalOverlay').classList.remove('active');">&times;</button>
                </div>
                <div class="modal-body" style="max-height: 500px; overflow-y: auto;">
                    <p style="color: var(--text-light); margin-bottom: 16px;">
                        Select accounts to import and choose their SAR category mapping.
                    </p>
                    <div id="accountsList">
                        ${accounts.map((acc, idx) => `
                            <div class="account-row" style="display: flex; gap: 10px; align-items: center; padding: 12px; border-bottom: 1px solid var(--border-color);">
                                <input type="checkbox" id="acc_${idx}" data-account='${JSON.stringify(acc)}'>
                                <label for="acc_${idx}" style="flex: 1; cursor: pointer;">
                                    <strong>${acc.name}</strong>
                                    <br><span style="font-size: 12px; color: var(--text-light);">${acc.fullyQualifiedName}</span>
                                </label>
                                <select class="form-input" style="width: 200px;" id="sar_${idx}">
                                    <option value="">Select SAR category...</option>
                                    <option value="janitorial">janitorial</option>
                                    <option value="security">security</option>
                                    <option value="product_purchases">product_purchases</option>
                                    <option value="insurance">insurance</option>
                                    <option value="utilities_bank_fees">utilities_bank_fees</option>
                                    <option value="premises_rent">premises_rent</option>
                                    <option value="merchant_fees">merchant_fees</option>
                                    <option value="office_supplies">office_supplies</option>
                                    <option value="advertising">advertising</option>
                                    <option value="equipment_maintenance">equipment_maintenance</option>
                                </select>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-primary" onclick="window.qbAdmin.saveSelectedAccounts()">Import Selected</button>
                    <button class="btn-secondary" onclick="this.closest('.modal').classList.remove('active'); document.getElementById('modalOverlay').classList.remove('active');">Cancel</button>
                </div>
            </div>
        `;

        let modal = document.getElementById('qbAccountsModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'qbAccountsModal';
            modal.className = 'modal';
            document.body.appendChild(modal);
        }

        modal.innerHTML = html;
        modal.classList.add('active');
        document.getElementById('modalOverlay').classList.add('active');
    }

    /**
     * Save selected account mappings
     */
    async saveSelectedAccounts() {
        const checkboxes = document.querySelectorAll('#accountsList input[type="checkbox"]:checked');

        if (checkboxes.length === 0) {
            alert('Please select at least one account');
            return;
        }

        const mappings = [];

        checkboxes.forEach((cb, idx) => {
            const account = JSON.parse(cb.dataset.account);
            const sarCategory = document.getElementById(`sar_${cb.id.split('_')[1]}`).value;

            if (!sarCategory) {
                alert(`Please select a SAR category for ${account.name}`);
                return;
            }

            mappings.push({
                qb_category_name: account.name,
                qb_account_id: account.id,
                sar_category: sarCategory,
                is_active: true,
                notes: `Imported from QB: ${account.fullyQualifiedName}`
            });
        });

        if (mappings.length === 0) return;

        try {
            // Bulk insert mappings
            for (const mapping of mappings) {
                await supabase.addQBCategoryMapping(mapping);
            }

            alert(`✅ Imported ${mappings.length} account mappings!`);

            // Close modal
            document.getElementById('qbAccountsModal').classList.remove('active');
            document.getElementById('modalOverlay').classList.remove('active');

            // Reload mappings table
            if (window.app && window.app.loadQBCategoryMappings) {
                await window.app.loadQBCategoryMappings();
            }

        } catch (error) {
            alert('❌ Error: ' + error.message);
        }
    }

    /**
     * Sync expenses from QB
     */
    async syncExpenses() {
        if (!confirm('Fetch expenses from QuickBooks for the current month?')) return;

        try {
            const btn = document.getElementById('qbSyncBtn');
            const originalText = btn.textContent;
            btn.textContent = 'Syncing...';
            btn.disabled = true;

            // Get current month date range
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const startDate = `${year}-${month}-01`;
            const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
            const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

            // Fetch P&L
            const expenses = await qbClient.getProfitAndLoss(
                startDate,
                endDate,
                this.qbClientId,
                this.qbClientSecret
            );

            // Map QB categories to SAR categories using mappings
            const mappedExpenses = await this.mapQBExpensesToSAR(expenses);

            // Display results
            this.showExpenseSyncResults(expenses, mappedExpenses, startDate);

            // Update last sync time
            localStorage.setItem('sar_qb_last_sync', new Date().toISOString());
            document.getElementById('qbLastSync').textContent = new Date().toLocaleString();

            btn.textContent = originalText;
            btn.disabled = false;

        } catch (error) {
            alert('❌ Sync failed: ' + error.message);
        }
    }

    /**
     * Map QB expense categories to SAR categories
     */
    async mapQBExpensesToSAR(qbExpenses) {
        const mappings = await supabase.getQBCategoryMappings();
        const sarExpenses = {};

        for (const [qbCategory, amount] of Object.entries(qbExpenses)) {
            const mapping = mappings.find(m => m.qb_category_name === qbCategory);

            if (mapping) {
                const sarCat = mapping.sar_category;
                sarExpenses[sarCat] = (sarExpenses[sarCat] || 0) + amount;
            } else {
                console.warn(`No mapping for QB category: ${qbCategory}`);
            }
        }

        return sarExpenses;
    }

    /**
     * Show expense sync results modal
     */
    showExpenseSyncResults(qbExpenses, mappedExpenses, month) {
        const unmappedCount = Object.keys(qbExpenses).length - Object.keys(mappedExpenses).length;

        const html = `
            <div class="modal-content" style="max-width: 700px;">
                <div class="modal-header">
                    <h3>Expense Sync Results</h3>
                    <button class="modal-close" onclick="this.closest('.modal').classList.remove('active'); document.getElementById('modalOverlay').classList.remove('active');">&times;</button>
                </div>
                <div class="modal-body">
                    <div style="background: rgba(34, 197, 94, 0.1); padding: 16px; border-radius: 8px; margin-bottom: 20px;">
                        <p style="color: var(--success-color); font-weight: 600;">
                            ✅ Fetched ${Object.keys(qbExpenses).length} expense categories from QB
                        </p>
                        <p style="color: var(--text-light); font-size: 14px; margin-top: 8px;">
                            ${Object.keys(mappedExpenses).length} mapped to SAR categories
                            ${unmappedCount > 0 ? `<br><span style="color: var(--danger-color);">${unmappedCount} unmapped (need category mapping)</span>` : ''}
                        </p>
                    </div>

                    <h4 style="margin-bottom: 12px;">Mapped Expenses:</h4>
                    <div style="max-height: 300px; overflow-y: auto;">
                        ${Object.entries(mappedExpenses).map(([cat, amt]) => `
                            <div style="display: flex; justify-content: space-between; padding: 8px; border-bottom: 1px solid var(--border-color);">
                                <span>${cat.replace(/_/g, ' ')}</span>
                                <strong>$${amt.toLocaleString('en-US', {minimumFractionDigits: 2})}</strong>
                            </div>
                        `).join('')}
                    </div>

                    ${unmappedCount > 0 ? `
                        <div style="margin-top: 20px; padding: 12px; background: rgba(239, 68, 68, 0.1); border-radius: 8px;">
                            <p style="color: var(--danger-color); font-weight: 600; margin-bottom: 8px;">
                                ⚠️ Unmapped Categories
                            </p>
                            <p style="font-size: 14px; color: var(--text-light);">
                                Go to Category Mapping and add mappings for these QB categories.
                            </p>
                        </div>
                    ` : ''}
                </div>
                <div class="modal-footer">
                    <button class="btn-primary" onclick="window.qbAdmin.saveExpensesToDB('${month}', ${JSON.stringify(mappedExpenses).replace(/'/g, '\\\'')})">Save to Database</button>
                    <button class="btn-secondary" onclick="this.closest('.modal').classList.remove('active'); document.getElementById('modalOverlay').classList.remove('active');">Cancel</button>
                </div>
            </div>
        `;

        let modal = document.getElementById('qbSyncResultsModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'qbSyncResultsModal';
            modal.className = 'modal';
            document.body.appendChild(modal);
        }

        modal.innerHTML = html;
        modal.classList.add('active');
        document.getElementById('modalOverlay').classList.add('active');
    }

    /**
     * Save fetched expenses to database
     */
    async saveExpensesToDB(month, mappedExpenses) {
        try {
            // Insert into qb_expenses table
            const { error } = await supabase.getClient()
                .from('qb_expenses')
                .upsert({
                    expense_month: `${month}-01`,
                    ...mappedExpenses,
                    sync_date: new Date().toISOString(),
                    sync_status: 'success'
                }, {
                    onConflict: 'expense_month'
                });

            if (error) throw error;

            alert('✅ Expenses saved to database!');

            document.getElementById('qbSyncResultsModal').classList.remove('active');
            document.getElementById('modalOverlay').classList.remove('active');

        } catch (error) {
            alert('❌ Error saving: ' + error.message);
        }
    }

    /**
     * Disconnect from QB
     */
    disconnect() {
        if (!confirm('Disconnect from QuickBooks?')) return;

        qbClient.clearTokens();
        this.showDisconnectedState();
        alert('✅ Disconnected from QuickBooks');
    }

    /**
     * Test QB connection
     */
    async testConnection() {
        try {
            const btn = document.getElementById('qbTestBtn');
            const originalText = btn.textContent;
            btn.textContent = 'Testing...';
            btn.disabled = true;

            const connected = await qbClient.testConnection(this.qbClientId, this.qbClientSecret);

            btn.textContent = originalText;
            btn.disabled = false;

            if (connected) {
                alert('✅ Connection test successful!');
            } else {
                alert('❌ Connection test failed. Tokens may have expired.');
            }

        } catch (error) {
            alert('❌ Test failed: ' + error.message);
        }
    }

    // Utility
    generateRandomString(length) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
}

// Export singleton
export const qbAdminView = new QBAdminView();
window.qbAdmin = qbAdminView; // Make available globally for onclick handlers
