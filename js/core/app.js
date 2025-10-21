// SAR Main Application
// Entry point for the application

import { supabase } from './supabase-client.js';
import { qbAdminView } from '../views/qb-admin.js';
import { ssarView } from '../views/s-sar-view.js';
import { HistoricalView } from '../views/historical-view.js';
import { monthlyReportingView } from '../views/monthly-reporting-view.js';
import { qbHistoryView } from '../views/qb-history-view.js';
import { stateRegulations } from '../data/state-regulations.js';

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
                // Default to Vanguard organization (case-insensitive search)
                const vanguard = this.organizations.find(o =>
                    o.name.toLowerCase().includes('vanguard')
                );
                this.currentOrganizationId = vanguard?.id || this.organizations[0]?.id;
            }

            console.log('🏢 Current Organization ID:', this.currentOrganizationId);

            // Load organization name from system_settings
            await this.loadOrganizationName();

            this.initialized = true;
            this.setupEventListeners();

            // Load nav visibility settings
            await this.loadNavVisibilitySettings();

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

        // Sidebar Toggle
        document.getElementById('sidebarToggle')?.addEventListener('click', () => {
            document.body.classList.toggle('sidebar-collapsed');
        });

        // S-SAR Refresh
        document.getElementById('refreshSessionsBtn')?.addEventListener('click', () => {
            ssarView.refreshData();
        });

        // Monthly Revenue event listeners are now handled by monthlyReportingView

        // Dashboard Location Filter
        document.querySelectorAll('.dashboard-location-filter').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.dashboard-location-filter').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                const location = e.target.dataset.location;
                this.loadDashboard(location);
            });
        });

        // Dashboard Period Filter
        document.querySelectorAll('.dashboard-period-filter').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.dashboard-period-filter').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                const period = e.target.dataset.period;
                // Period filter functionality to be implemented
                console.log('Period filter:', period);
            });
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

        // Setup nav visibility event listeners
        this.setupNavVisibilityListeners();
    }

    // ========================================
    // NAVIGATION VISIBILITY
    // ========================================

    setupNavVisibilityListeners() {
        // Save button
        const saveBtn = document.getElementById('saveNavVisibilityBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveNavVisibility());
        }

        // Category toggles - update visibility when changed
        document.querySelectorAll('#navVisibilityCategories input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                this.updateCategoryVisibility(e.target.dataset.category, e.target.checked);
            });
        });
    }

    async loadNavVisibilitySettings() {
        if (!this.currentOrganizationId) return;

        try {
            const settings = await supabase.getNavVisibilitySettings(this.currentOrganizationId);

            // Update category toggles and apply visibility
            if (settings.visibility_config) {
                for (const [category, visible] of Object.entries(settings.visibility_config)) {
                    const checkbox = document.querySelector(`#navVisibilityCategories input[data-category="${category}"]`);
                    if (checkbox) {
                        checkbox.checked = visible;
                    }
                    // Apply visibility to nav sections
                    this.updateCategoryVisibility(category, visible);
                }
            }

        } catch (error) {
            console.error('Error loading nav visibility settings:', error);
        }
    }

    updateCategoryVisibility(category, visible) {
        const navSection = document.querySelector(`.nav-section[data-category="${category}"]`);
        if (navSection) {
            if (visible) {
                navSection.classList.remove('hidden-by-visibility');
            } else {
                navSection.classList.add('hidden-by-visibility');
            }
        }
    }

    async saveNavVisibility() {
        if (!this.currentOrganizationId) {
            alert('No organization selected');
            return;
        }

        try {
            // Collect visibility config from category toggles
            const visibilityConfig = {};
            document.querySelectorAll('#navVisibilityCategories input[type="checkbox"]').forEach(checkbox => {
                visibilityConfig[checkbox.dataset.category] = checkbox.checked;
            });

            await supabase.saveNavVisibilitySettings(
                this.currentOrganizationId,
                false, // No longer need show_checkboxes
                visibilityConfig
            );

            alert('✅ Navigation visibility settings saved successfully');
        } catch (error) {
            console.error('Error saving nav visibility settings:', error);
            alert('❌ Error saving settings: ' + error.message);
        }
    }

    async switchView(view) {
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
                await ssarView.init();
                break;
            case 'monthly-revenue':
                await monthlyReportingView.init();
                break;
            case 'historical':
                // Initialize historical view if not already done
                if (!this.historicalView) {
                    this.historicalView = new HistoricalView(supabase, null);
                }
                this.historicalView.show();
                break;
            case 'qb-history':
                await qbHistoryView.init();
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
                await this.loadNavVisibilitySettings();
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

    async loadDashboard(location = 'COMBINED') {
        try {
            // Get current month
            const now = new Date();
            const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

            const summary = await supabase.getMonthlySummary(month, location);

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
                        <td colspan="5" class="empty-state">No allocation rules found. Run the seed script to create default rules.</td>
                    </tr>
                `;
                return;
            }

            // Get method badges
            const getAllocationMethodBadge = (method) => {
                const badges = {
                    'BY_REVENUE': 'badge-blue',
                    'BY_SESSION_COUNT': 'badge-purple',
                    'FIXED_PER_SESSION': 'badge-green'
                };
                return badges[method] || 'badge-gray';
            };

            const getLocationSplitBadge = (method) => {
                const badges = {
                    'ALL_SESSIONS': 'badge-blue',
                    'SC_ONLY': 'badge-orange',
                    'RWC_ONLY': 'badge-green',
                    'CUSTOM': 'badge-purple'
                };
                return badges[method] || 'badge-gray';
            };

            const formatLocationSplit = (rule) => {
                if (rule.location_split_method === 'CUSTOM') {
                    const sc = rule.location_split_sc_percent || 0;
                    const rwc = rule.location_split_rwc_percent || 0;
                    return `SC: ${sc}%, RWC: ${rwc}%`;
                } else if (rule.location_split_method === 'SC_ONLY') {
                    return 'SC only';
                } else if (rule.location_split_method === 'RWC_ONLY') {
                    return 'RWC only';
                } else if (rule.location_split_method === 'ALL_SESSIONS') {
                    return 'All sessions';
                } else {
                    return rule.location_split_method;
                }
            };

            tbody.innerHTML = rules.map(r => `
                <tr>
                    <td class="cell-bold">${r.expense_category}</td>
                    <td><span class="badge badge-gray">${r.bingo_percentage}%</span></td>
                    <td>
                        <span class="badge ${getAllocationMethodBadge(r.allocation_method)}">
                            ${r.allocation_method.replace(/_/g, ' ')}
                        </span>
                        ${r.fixed_amount_per_session ? `<div style="font-size: 11px; color: #6b7280; margin-top: 4px;">$${r.fixed_amount_per_session.toFixed(2)}/session</div>` : ''}
                    </td>
                    <td>
                        <span class="badge ${getLocationSplitBadge(r.location_split_method)}">
                            ${formatLocationSplit(r)}
                        </span>
                    </td>
                    <td class="cell-muted" style="font-size: 12px; max-width: 300px;">
                        ${r.notes || '-'}
                    </td>
                </tr>
            `).join('');

        } catch (error) {
            console.error('Error loading allocation rules:', error);
            const tbody = document.getElementById('expenseRulesTableBody');
            tbody.innerHTML = `
                <tr class="empty-row">
                    <td colspan="5" class="empty-state">Error loading rules: ${error.message}</td>
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

    // loadMonthlyRevenue and exportMonthlyRevenueCSV removed - now handled by monthlyReportingView

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

        // Load state data dynamically if it exists in stateRegulations
        const stateData = stateRegulations[stateId];
        if (stateData) {
            this.renderStateDetails(stateId, stateData);
        } else {
            // Fall back to showing static HTML content
            this.switchState(stateId);
        }
    }

    renderStateDetails(stateId, stateData) {
        const placeholder = document.getElementById('state-content-placeholder');
        if (!placeholder) return;

        // Build HTML from state data
        const sectionsHTML = stateData.sections.map(section => `
            <div style="margin-bottom: 30px;">
                <h4 style="color: #1e293b; margin-bottom: 15px;">${section.title}</h4>
                ${section.content}
            </div>
        `).join('');

        placeholder.innerHTML = `
            <div class="content-card">
                <div class="card-header">
                    <div class="card-title">${stateData.name} Bingo Regulations</div>
                    <button class="btn btn-secondary" onclick="app.switchState('overview')" style="padding: 6px 12px; font-size: 13px;">
                        ← Back to Overview
                    </button>
                </div>
                <div class="card-body">
                    ${sectionsHTML}
                </div>
            </div>
        `;

        // Hide all state content sections
        document.querySelectorAll('.state-content').forEach(content => {
            content.classList.remove('active');
        });

        // Show the placeholder
        placeholder.classList.add('active');
    }
}

// Initialize app
const app = new SARApp();
window.app = app; // Make available globally for onclick handlers
app.init();

export default app;
