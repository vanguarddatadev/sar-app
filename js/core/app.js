// SAR Main Application
// Entry point for the application

import { supabase } from './supabase-client.js';
import { qbAdminView } from '../views/qb-admin.js';
import { ssarView } from '../views/s-sar-view.js';
import { HistoricalView } from '../views/historical-view.js';

class SARApp {
    constructor() {
        this.currentView = 'dashboard';
        this.currentAdminSection = 'qb';
        this.initialized = false;
        this.currentOrganizationId = null;
        this.organizations = [];
        this.historicalView = null;

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

            // Load organizations
            this.organizations = await supabase.getOrganizations();
            console.log('📋 Loaded organizations:', this.organizations);

            // Set current organization from localStorage or default to Vanguard
            const savedOrgId = localStorage.getItem('sar_current_organization_id');
            if (savedOrgId && this.organizations.find(o => o.id === savedOrgId)) {
                this.currentOrganizationId = savedOrgId;
            } else {
                // Default to Vanguard organization
                const vanguard = this.organizations.find(o => o.name === 'vanguard');
                this.currentOrganizationId = vanguard?.id || this.organizations[0]?.id;
            }

            // Load organization name from system_settings
            await this.loadOrganizationName();

            this.initialized = true;
            this.setupEventListeners();
            // await this.loadDashboard(); // Temporarily disabled - dashboard view not needed
            console.log('✅ SAR Application initialized');

        } catch (error) {
            console.error('Failed to initialize:', error);
            alert('❌ Error initializing application: ' + error.message);
        }
    }

    async loadOrganizationName() {
        if (!this.currentOrganizationId) return;

        try {
            const setting = await supabase.getSetting(this.currentOrganizationId, 'organization_name');
            if (setting && setting.value) {
                document.getElementById('organizationName').textContent = setting.value;
            } else {
                // Fallback to organization display_name
                const org = this.organizations.find(o => o.id === this.currentOrganizationId);
                if (org) {
                    document.getElementById('organizationName').textContent = org.display_name || org.name;
                }
            }
        } catch (error) {
            console.error('Error loading organization name:', error);
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
                break;
            case 'monthly-revenue':
                this.loadMonthlyRevenue();
                break;
            case 'historical':
                // Initialize historical view if not already done
                if (!this.historicalView) {
                    this.historicalView = new HistoricalView(supabase, null);
                }
                this.historicalView.show();
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
                // Top row metrics
                document.getElementById('totalRevenue').textContent =
                    this.formatCurrency(summary.total_sales);
                document.getElementById('totalPayouts').textContent =
                    this.formatCurrency(summary.total_payouts || 0);
                document.getElementById('netRevenue').textContent =
                    this.formatCurrency(summary.net_revenue);
                document.getElementById('otherExpenses').textContent = '$0'; // From allocated expenses

                // Bottom row metrics
                const totalExpenses = (summary.total_payouts || 0) + 0; // + other_expenses when available
                const ebitda = summary.net_revenue - 0; // - other_expenses when available

                document.getElementById('totalExpenses').textContent =
                    this.formatCurrency(totalExpenses);
                document.getElementById('ebitda').textContent =
                    this.formatCurrency(ebitda);
                document.getElementById('attendance').textContent =
                    this.formatNumber(summary.total_attendance);
                document.getElementById('sessionCount').textContent =
                    this.formatNumber(summary.session_count);
            }
        } catch (error) {
            console.error('Error loading dashboard:', error);
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
            if (!this.currentOrganizationId) {
                console.error('No organization selected');
                return;
            }

            const rules = await supabase.getAllocationRules(this.currentOrganizationId);
            const tbody = document.getElementById('expenseRulesTableBody');

            if (!rules || rules.length === 0) {
                tbody.innerHTML = `
                    <tr class="empty-row">
                        <td colspan="8" class="empty-state">No allocation rules found. Run the seed script to create default rules.</td>
                    </tr>
                `;
                return;
            }

            // Update stats
            document.getElementById('expenseTotalRules').textContent = rules.length;

            // Get method badges
            const getLocationMethodBadge = (method) => {
                const badges = {
                    'BY_REVENUE': 'badge-blue',
                    'FIXED_PERCENT': 'badge-green',
                    'LOCATION_ONLY': 'badge-orange'
                };
                return badges[method] || 'badge-gray';
            };

            const getAllocationMethodBadge = (method) => {
                const badges = {
                    'BY_REVENUE': 'badge-blue',
                    'BY_SESSION_COUNT': 'badge-purple',
                    'FIXED_PER_SESSION': 'badge-green'
                };
                return badges[method] || 'badge-gray';
            };

            const formatLocationSplit = (rule) => {
                if (rule.location_split_method === 'FIXED_PERCENT') {
                    return `SC: ${rule.sc_fixed_percent || 0}%, RWC: ${rule.rwc_fixed_percent || 0}%`;
                } else if (rule.location_split_method === 'LOCATION_ONLY') {
                    return `${rule.location_filter} only`;
                } else {
                    return 'By Revenue';
                }
            };

            tbody.innerHTML = rules.map(r => `
                <tr>
                    <td style="font-weight: 600;">${r.display_order}</td>
                    <td class="cell-bold">${r.display_name}</td>
                    <td><span class="badge badge-gray">${r.bingo_percentage}%</span></td>
                    <td>
                        <span class="badge ${getLocationMethodBadge(r.location_split_method)}">
                            ${r.location_split_method.replace(/_/g, ' ')}
                        </span>
                        <div style="font-size: 11px; color: #6b7280; margin-top: 4px;">
                            ${formatLocationSplit(r)}
                        </div>
                    </td>
                    <td>
                        <span class="badge ${getAllocationMethodBadge(r.allocation_method)}">
                            ${r.allocation_method.replace(/_/g, ' ')}
                        </span>
                        ${r.fixed_amount_per_session ? `<div style="font-size: 11px; color: #6b7280; margin-top: 4px;">$${r.fixed_amount_per_session}/session</div>` : ''}
                    </td>
                    <td style="font-size: 11px;">
                        <span class="badge ${r.use_spreadsheet ? 'badge-blue' : 'badge-green'}">
                            ${r.use_spreadsheet ? 'Spreadsheet' : 'QB'}
                        </span>
                        ${!r.use_spreadsheet && r.qb_account_numbers ? `<div style="color: #6b7280; margin-top: 4px;">${r.qb_account_numbers.join(', ')}</div>` : ''}
                    </td>
                    <td class="cell-muted" style="font-size: 12px; max-width: 200px;">
                        ${r.formula_display || r.notes || '-'}
                    </td>
                    <td style="text-align: right;">
                        <button class="btn btn-secondary" style="padding: 6px 14px; font-size: 13px;"
                                onclick="app.editAllocationRule('${r.id}')">
                            Edit
                        </button>
                    </td>
                </tr>
            `).join('');

        } catch (error) {
            console.error('Error loading allocation rules:', error);
            const tbody = document.getElementById('expenseRulesTableBody');
            tbody.innerHTML = `
                <tr class="empty-row">
                    <td colspan="8" class="empty-state">Error loading rules: ${error.message}</td>
                </tr>
            `;
        }
    }

    editAllocationRule(ruleId) {
        // TODO: Implement edit modal
        console.log('Edit rule:', ruleId);
        alert('Edit functionality coming soon!');
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
            const container = document.getElementById('monthlyRevenueReportingContainer');

            if (!container) {
                console.error('monthlyRevenueReportingContainer not found');
                return;
            }

            if (!data || data.length === 0) {
                container.innerHTML = `<div class="empty-state">No revenue data available.</div>`;
                return;
            }

            // Store data for export
            this.monthlyRevenueData = data;

            // Create table with data
            container.innerHTML = `
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Month</th>
                                <th>Sessions</th>
                                <th style="text-align: right;">Gross Revenue</th>
                                <th style="text-align: right;">Payouts</th>
                                <th style="text-align: right;">Net Revenue</th>
                                <th style="text-align: right;">Net Rev %</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.map(row => `
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
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;

        } catch (error) {
            console.error('Error loading monthly revenue:', error);
            const container = document.getElementById('monthlyRevenueReportingContainer');
            if (container) {
                container.innerHTML = `<div class="empty-state">Error loading data: ${error.message}</div>`;
            }
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

    showStateDetails(stateId) {
        // Update the state selector dropdown
        const stateSelector = document.getElementById('stateSelector');
        if (stateSelector) {
            stateSelector.value = stateId;
        }

        // Call switchState to show the state's detail view
        this.switchState(stateId);
    }
}

// Initialize app
const app = new SARApp();
window.app = app; // Make available globally for onclick handlers
app.init();

export default app;
