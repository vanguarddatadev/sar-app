// SAR Main Application
// Entry point for the application

import { supabase } from './supabase-client.js';
import { qbAdminView } from '../views/qb-admin.js';
import { ssarView } from '../views/s-sar-view.js';
import { leaderboardView } from '../views/leaderboard-view.js';
import { initWizard } from '../views/init-wizard.js';

class SARApp {
    constructor() {
        this.currentView = 'dashboard';
        this.currentAdminSection = 'qb';
        this.initialized = false;

        // Hardcoded Supabase credentials
        this.SUPABASE_URL = 'https://nqwnkikattupnvtubfsu.supabase.co';
        this.SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xd25raWthdHR1cG52dHViZnN1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDY2ODk0MiwiZXhwIjoyMDc2MjQ0OTQyfQ.IwfvSUrBbFkWzveUQX17r6zLmLep3LXKUX5Ql5WON_E';
    }

    async init() {
        console.log('🚀 Initializing SAR Application...');

        try {
            // Initialize with hardcoded credentials
            await supabase.init(this.SUPABASE_URL, this.SUPABASE_SERVICE_KEY);
            const connected = await supabase.testConnection();

            if (!connected) {
                alert('❌ Failed to connect to Supabase. Please check your credentials in js/core/app.js');
                return;
            }

            // Load organization name from database
            await this.loadOrganizationName();

            this.initialized = true;
            this.setupEventListeners();
            await this.loadDashboard();
            console.log('✅ SAR Application initialized');

        } catch (error) {
            console.error('Failed to initialize:', error);
            alert('❌ Error initializing application: ' + error.message);
        }
    }

    async loadOrganizationName() {
        try {
            const org = await supabase.getOrganization();
            if (org && org.organization_name) {
                document.getElementById('organizationName').textContent = org.organization_name.toUpperCase();
            }
        } catch (error) {
            console.error('Error loading organization name:', error);
            // Keep default name if error
        }
    }

    setupEventListeners() {
        // Navigation items (sidebar)
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const view = e.currentTarget.dataset.view;
                if (view) {
                    this.switchView(view);
                }
            });
        });

        // Collapsible sidebar sections
        document.querySelectorAll('.nav-section-title').forEach(title => {
            title.addEventListener('click', (e) => {
                const section = e.currentTarget.closest('.nav-section');
                section.classList.toggle('collapsed');
            });
        });

        // Admin menu items
        document.querySelectorAll('.admin-menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const section = e.currentTarget.dataset.adminSection;
                this.switchAdminSection(section);
            });
        });

        // Theme toggle
        document.getElementById('themeToggle')?.addEventListener('click', () => {
            document.body.classList.toggle('light-mode');
            document.body.classList.toggle('dark-mode');
        });

        // QB Connect
        document.getElementById('qbConnectBtn')?.addEventListener('click', () => {
            qbAdminView.connectToQB();
        });

        // QB Test Connection
        document.getElementById('qbTestBtn')?.addEventListener('click', () => {
            qbAdminView.testConnection();
        });

        // QB Sync
        document.getElementById('qbSyncBtn')?.addEventListener('click', () => {
            qbAdminView.syncExpenses();
        });

        // QB Disconnect
        document.getElementById('qbDisconnectBtn')?.addEventListener('click', () => {
            qbAdminView.disconnect();
        });

        // Category Mapping
        document.getElementById('addCategoryMappingBtn')?.addEventListener('click', () => {
            this.showCategoryMappingModal();
        });

        // Modal close
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                this.closeModal();
            });
        });

        document.getElementById('modalOverlay')?.addEventListener('click', () => {
            this.closeModal();
        });

        // Save category mapping
        document.getElementById('saveCategoryMappingBtn')?.addEventListener('click', () => {
            this.saveCategoryMapping();
        });

        // Import QB Categories
        document.getElementById('importQBCategoriesBtn')?.addEventListener('click', () => {
            qbAdminView.importChartOfAccounts();
        });

        // S-SAR Refresh
        document.getElementById('refreshSessionsBtn')?.addEventListener('click', () => {
            ssarView.refreshData();
        });

        // Monthly Revenue Location Filter
        document.getElementById('monthlyRevenueLocation')?.addEventListener('change', (e) => {
            this.loadMonthlyRevenue(e.target.value);
        });

        // Monthly Revenue Export
        document.getElementById('exportMonthlyRevenueBtn')?.addEventListener('click', () => {
            this.exportMonthlyRevenueCSV();
        });

        // State Rules Selector
        document.getElementById('stateSelector')?.addEventListener('change', (e) => {
            this.switchState(e.target.value);
        });

        // S-SAR Tab Switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.currentTarget.dataset.tab;
                this.switchSSARTab(tab);
            });
        });

        // Load expense rules on admin section load
        if (this.currentView === 'admin') {
            this.loadExpenseRules();
            this.loadRevenueCategories();
        }
    }

    switchView(view) {
        // Update active nav item
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        const activeItem = document.querySelector(`.nav-item[data-view="${view}"]`);
        if (activeItem) {
            activeItem.classList.add('active');
        }

        // Update visible view
        document.querySelectorAll('.view-container').forEach(container => {
            container.classList.remove('active');
        });
        document.getElementById(`${view}-view`).classList.add('active');

        this.currentView = view;

        // Load view data
        switch(view) {
            case 'dashboard':
                this.loadDashboard();
                break;
            case 's-sar':
                ssarView.init();
                leaderboardView.init(); // Initialize leaderboard (default tab)
                break;
            case 'monthly-revenue':
                this.loadMonthlyRevenue();
                break;
            case 'qb-sync':
                qbAdminView.init();
                this.loadQBCategoryMappings();
                break;
            case 'expense-rules':
                this.loadExpenseRules();
                break;
            case 'revenue-config':
                this.loadRevenueCategories();
                break;
            case 'settings':
                initWizard.init();
                break;
        }
    }

    switchAdminSection(section) {
        // Update active menu item
        document.querySelectorAll('.admin-menu-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-admin-section="${section}"]`).classList.add('active');

        // Update visible section
        document.querySelectorAll('.admin-section').forEach(sec => {
            sec.classList.remove('active');
        });
        document.getElementById(`admin-${section}`).classList.add('active');

        this.currentAdminSection = section;
        this.loadAdminSection(section);
    }

    async loadAdminSection(section) {
        switch(section) {
            case 'qb':
                await qbAdminView.init(); // Initialize QB view
                await this.loadQBCategoryMappings();
                break;
            case 'expense-rules':
                await this.loadExpenseRules();
                break;
            case 'revenue-config':
                await this.loadRevenueCategories();
                break;
        }
    }

    async loadDashboard() {
        try {
            // Get current month
            const now = new Date();
            const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

            const summary = await supabase.getMonthlySummary(month, 'COMBINED');

            if (summary) {
                document.getElementById('totalRevenue').textContent =
                    this.formatCurrency(summary.total_sales);
                document.getElementById('netRevenue').textContent =
                    this.formatCurrency(summary.net_revenue);
                document.getElementById('ebitda').textContent = '$0'; // Calculate with expenses
                document.getElementById('attendance').textContent =
                    this.formatNumber(summary.total_attendance);

                document.getElementById('dashboardContent').innerHTML = `
                    <div class="metrics-grid">
                        <div class="metric-card">
                            <div class="metric-label">Sessions</div>
                            <div class="metric-value">${summary.session_count}</div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-label">Flash Sales</div>
                            <div class="metric-value">${this.formatCurrency(summary.flash_sales)}</div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-label">Strip Sales</div>
                            <div class="metric-value">${this.formatCurrency(summary.strip_sales)}</div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-label">Avg RPA</div>
                            <div class="metric-value">${this.formatCurrency(summary.avg_rpa)}</div>
                        </div>
                    </div>
                `;
            } else {
                document.getElementById('dashboardContent').innerHTML = `
                    <p class="empty-state">
                        No data for this month. Import session data in the Admin section.
                    </p>
                `;
            }
        } catch (error) {
            console.error('Error loading dashboard:', error);
            document.getElementById('dashboardContent').innerHTML = `
                <p class="empty-state">Error loading data: ${error.message}</p>
            `;
        }
    }

    async loadQBCategoryMappings() {
        try {
            const mappings = await supabase.getQBCategoryMappings();
            const tbody = document.getElementById('categoryMappingTableBody');

            if (!mappings || mappings.length === 0) {
                tbody.innerHTML = `
                    <tr class="empty-row">
                        <td colspan="5" class="empty-state">
                            No mappings configured. Click "Add Mapping" to get started.
                        </td>
                    </tr>
                `;
                return;
            }

            tbody.innerHTML = mappings.map(m => `
                <tr>
                    <td>${this.escapeHtml(m.qb_category_name)}</td>
                    <td><strong>${m.sar_category}</strong></td>
                    <td>${m.qb_account_id || '-'}</td>
                    <td>
                        <span style="color: ${m.is_active ? 'var(--success-color)' : 'var(--danger-color)'}">
                            ${m.is_active ? '✓ Active' : '✗ Inactive'}
                        </span>
                    </td>
                    <td>
                        <button class="btn-secondary" style="padding: 6px 12px; font-size: 12px;"
                                onclick="app.deleteCategoryMapping('${m.id}')">
                            Delete
                        </button>
                    </td>
                </tr>
            `).join('');

        } catch (error) {
            console.error('Error loading category mappings:', error);
        }
    }

    async loadExpenseRules() {
        try {
            const rules = await supabase.getExpenseRules();
            const tbody = document.getElementById('expenseRulesTableBody');

            if (!rules || rules.length === 0) {
                tbody.innerHTML = `
                    <tr class="empty-row">
                        <td colspan="7" class="empty-state">Loading...</td>
                    </tr>
                `;
                return;
            }

            // Calculate averages for stats
            const totalRules = rules.length;
            const avgSC = rules.reduce((sum, r) => sum + (r.sc_percent || 0), 0) / totalRules;
            const avgRWC = rules.reduce((sum, r) => sum + (r.rwc_percent || 0), 0) / totalRules;
            const avgUnallocated = rules.reduce((sum, r) => sum + (r.unallocated_percent || 0), 0) / totalRules;

            // Update stats
            document.getElementById('expenseTotalRules').textContent = totalRules;
            document.getElementById('expenseSCAvg').textContent = avgSC.toFixed(1) + '%';
            document.getElementById('expenseRWCAvg').textContent = avgRWC.toFixed(1) + '%';
            document.getElementById('expenseUnallocatedAvg').textContent = avgUnallocated.toFixed(1) + '%';

            // Get method badge class
            const getMethodBadge = (method) => {
                return method === 'fixed_percent' ? 'badge-blue' : 'badge-gray';
            };

            tbody.innerHTML = rules.map(r => `
                <tr>
                    <td class="cell-bold">${r.expense_category.replace(/_/g, ' ')}</td>
                    <td><span class="badge ${getMethodBadge(r.allocation_method)}">${r.allocation_method === 'fixed_percent' ? 'Fixed Percent' : 'Revenue Share'}</span></td>
                    <td class="col-highlight" style="font-weight: 600;">${r.sc_percent || '-'}%</td>
                    <td class="col-highlight-green" style="font-weight: 600;">${r.rwc_percent || '-'}%</td>
                    <td>${r.unallocated_percent || '-'}%</td>
                    <td class="cell-muted">
                        ${r.notes || '-'}
                    </td>
                    <td style="text-align: right;">
                        <button class="btn btn-secondary" style="padding: 6px 14px; font-size: 13px;">
                            Edit
                        </button>
                    </td>
                </tr>
            `).join('');

        } catch (error) {
            console.error('Error loading expense rules:', error);
        }
    }

    async loadRevenueCategories() {
        try {
            const categories = await supabase.getRevenueCategories();
            const tbody = document.getElementById('revenueTableBody');

            if (!categories || categories.length === 0) {
                tbody.innerHTML = `
                    <tr class="empty-row">
                        <td colspan="6" class="empty-state">Loading...</td>
                    </tr>
                `;
                return;
            }

            tbody.innerHTML = categories.map(c => `
                <tr>
                    <td><strong>${c.category_name}</strong></td>
                    <td>${c.display_name}</td>
                    <td>${c.tracked_in_sessions ? '✓' : '-'}</td>
                    <td>${c.tracked_monthly_only ? '✓' : '-'}</td>
                    <td>${c.show_in_county_report ? '✓' : '-'}</td>
                    <td>
                        <button class="btn-secondary" style="padding: 6px 12px; font-size: 12px;">
                            Edit
                        </button>
                    </td>
                </tr>
            `).join('');

        } catch (error) {
            console.error('Error loading revenue categories:', error);
        }
    }

    showCategoryMappingModal() {
        document.getElementById('modalOverlay').classList.add('active');
        document.getElementById('categoryMappingModal').classList.add('active');

        // Reset form
        document.getElementById('modalQBCategory').value = '';
        document.getElementById('modalSARCategory').value = '';
        document.getElementById('modalQBAccountID').value = '';
        document.getElementById('modalNotes').value = '';
    }

    closeModal() {
        document.getElementById('modalOverlay').classList.remove('active');
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    }

    async saveCategoryMapping() {
        const qbCategory = document.getElementById('modalQBCategory').value.trim();
        const sarCategory = document.getElementById('modalSARCategory').value;
        const qbAccountId = document.getElementById('modalQBAccountID').value.trim();
        const notes = document.getElementById('modalNotes').value.trim();

        if (!qbCategory || !sarCategory) {
            alert('Please fill in QB Category and SAR Category');
            return;
        }

        try {
            await supabase.addQBCategoryMapping({
                qb_category_name: qbCategory,
                sar_category: sarCategory,
                qb_account_id: qbAccountId || null,
                notes: notes || null,
                is_active: true
            });

            this.closeModal();
            await this.loadQBCategoryMappings();
            alert('✅ Category mapping added successfully!');

        } catch (error) {
            alert('❌ Error: ' + error.message);
        }
    }

    async deleteCategoryMapping(id) {
        if (!confirm('Delete this mapping?')) return;

        try {
            await supabase.deleteQBCategoryMapping(id);
            await this.loadQBCategoryMappings();
        } catch (error) {
            alert('Error: ' + error.message);
        }
    }

    // Utility methods
    formatCurrency(value) {
        if (!value) return '$0';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value);
    }

    formatNumber(value) {
        if (!value) return '0';
        return new Intl.NumberFormat('en-US').format(value);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async loadMonthlyRevenue(location = 'COMBINED') {
        try {
            const data = await supabase.getMonthlyRevenueReport(location);
            const tbody = document.getElementById('monthlyRevenueTableBody');

            if (!data || data.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" class="empty-state">No revenue data available.</td>
                    </tr>
                `;
                return;
            }

            // Store data for export
            this.monthlyRevenueData = data;

            tbody.innerHTML = data.map(row => `
                <tr>
                    <td class="cell-bold">${this.formatMonth(row.month)}</td>
                    <td>${row.session_count}</td>
                    <td style="text-align: right; font-weight: 600;">${this.formatCurrency(row.total_sales)}</td>
                    <td style="text-align: right;">${this.formatCurrency(row.total_payouts)}</td>
                    <td style="text-align: right; font-weight: 600; color: #16a34a;">${this.formatCurrency(row.net_revenue)}</td>
                    <td style="text-align: right; font-weight: 600;">
                        <span style="padding: 4px 8px; background: #dcfce7; color: #166534; border-radius: 4px; font-size: 13px;">
                            ${row.net_revenue_percent}%
                        </span>
                    </td>
                </tr>
            `).join('');

        } catch (error) {
            console.error('Error loading monthly revenue:', error);
            document.getElementById('monthlyRevenueTableBody').innerHTML = `
                <tr>
                    <td colspan="6" class="empty-state">Error loading data: ${error.message}</td>
                </tr>
            `;
        }
    }

    formatMonth(monthStr) {
        // Convert YYYY-MM to "Month YYYY"
        const [year, month] = monthStr.split('-');
        const date = new Date(year, parseInt(month) - 1, 1);
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }

    exportMonthlyRevenueCSV() {
        if (!this.monthlyRevenueData || this.monthlyRevenueData.length === 0) {
            alert('No data to export');
            return;
        }

        const location = document.getElementById('monthlyRevenueLocation').value;

        // Build CSV
        let csv = 'Month,Sessions,Gross Revenue,Payouts,Net Revenue,Net Rev %\n';

        this.monthlyRevenueData.forEach(row => {
            csv += `${this.formatMonth(row.month)},`;
            csv += `${row.session_count},`;
            csv += `${row.total_sales.toFixed(2)},`;
            csv += `${row.total_payouts.toFixed(2)},`;
            csv += `${row.net_revenue.toFixed(2)},`;
            csv += `${row.net_revenue_percent}%\n`;
        });

        // Download CSV
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `monthly-revenue-${location}-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }

    switchState(stateId) {
        // Hide all state content sections
        document.querySelectorAll('.state-content').forEach(content => {
            content.classList.remove('active');
        });

        // Show selected state content
        if (stateId === 'overview') {
            document.getElementById('state-overview')?.classList.add('active');
        } else {
            // For other states, show placeholder for now
            // In a more complete implementation, we'd load the detailed content
            const stateElement = document.getElementById(`state-${stateId}`);
            if (stateElement) {
                stateElement.classList.add('active');
            } else {
                // Show placeholder with state name
                const placeholder = document.getElementById('state-content-placeholder');
                if (placeholder) {
                    const stateName = stateId.split('-').map(word =>
                        word.charAt(0).toUpperCase() + word.slice(1)
                    ).join(' ');
                    document.getElementById('placeholder-title').textContent = `${stateName} Regulations`;
                    placeholder.classList.add('active');
                }
            }
        }
    }

    switchSSARTab(tabName) {
        // Update active tab button
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`.tab-btn[data-tab="${tabName}"]`)?.classList.add('active');

        // Update active tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`)?.classList.add('active');

        // Load tab-specific data
        switch(tabName) {
            case 'leaderboard':
                leaderboardView.init();
                break;
            case 'daily':
                // Daily view will be implemented later
                break;
            case 'data-source':
                // Data source tab is static
                break;
        }
    }
}

// Initialize app
const app = new SARApp();
window.app = app; // Make available globally for onclick handlers
app.init();

export default app;
