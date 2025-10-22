// SAR Main Application
// Entry point for the application

import { supabase } from './supabase-client.js';
import { qbAdminView } from '../views/qb-admin.js';
import { ssarView } from '../views/s-sar-view.js';
import { HistoricalView } from '../views/historical-view.js';
import { monthlyReportingView } from '../views/monthly-reporting-view.js';
import { qbHistoryView } from '../views/qb-history-view.js';
import { adjustedExpensesView } from '../views/adjusted-expenses-view.js';
import { sessionDailyView } from '../views/session-daily-view.js';
import { dataComparisonView } from '../views/data-comparison-view.js';
import { AllocationEngine } from './allocation-engine.js';
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

        // Setup organization edit button
        document.getElementById('editOrganizationBtn')?.addEventListener('click', () => {
            this.openEditOrganizationModal();
        });

        // Setup modal close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
                document.getElementById('modalOverlay').classList.remove('active');
            });
        });

        document.getElementById('modalOverlay')?.addEventListener('click', () => {
            document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
            document.getElementById('modalOverlay').classList.remove('active');
        });

        // Save organization details button
        document.getElementById('saveOrganizationDetailsBtn')?.addEventListener('click', () => {
            this.saveOrganizationDetails();
        });

        // Fiscal month change - populate days
        document.getElementById('editFiscalMonth')?.addEventListener('change', (e) => {
            this.populateDaysForMonth(parseInt(e.target.value));
        });

        // Apply Rules button
        document.getElementById('applyRulesBtn')?.addEventListener('click', () => {
            this.applyAllocationRules();
        });

        // Apply Rules Modal - Apply All Months button
        document.getElementById('applyRulesAllMonthsBtn')?.addEventListener('click', () => {
            this.executeApplyRules(null); // null = all months
        });

        // Apply Rules Modal - Apply Selected Month button
        document.getElementById('applyRulesSelectedMonthBtn')?.addEventListener('click', () => {
            const selectedMonth = document.getElementById('applyRulesMonthSelect').value;
            if (!selectedMonth) {
                alert('Please select a month');
                return;
            }
            this.executeApplyRules(selectedMonth);
        });
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

        // Category toggles - hide/show item checkboxes
        document.querySelectorAll('.category-toggle').forEach(toggle => {
            toggle.addEventListener('change', (e) => {
                const category = e.target.dataset.category;
                const itemCheckboxes = document.querySelector(`.nav-item-checkboxes[data-category="${category}"]`);

                if (e.target.checked) {
                    // Show item checkboxes
                    itemCheckboxes.classList.remove('hidden');
                    this.updateCategoryVisibility(category, true);
                } else {
                    // Hide item checkboxes and hide entire category
                    itemCheckboxes.classList.add('hidden');
                    this.updateCategoryVisibility(category, false);
                }
            });
        });

        // Individual item checkboxes - show/hide specific nav items
        document.querySelectorAll('.nav-visibility-item input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                this.updateNavItemVisibility(e.target.dataset.view, e.target.checked);
            });
        });
    }

    async loadNavVisibilitySettings() {
        if (!this.currentOrganizationId) return;

        try {
            const settings = await supabase.getNavVisibilitySettings(this.currentOrganizationId);

            // Load category visibility
            if (settings.visibility_config && settings.visibility_config.categories) {
                for (const [category, visible] of Object.entries(settings.visibility_config.categories)) {
                    const toggle = document.querySelector(`.category-toggle[data-category="${category}"]`);
                    const itemCheckboxes = document.querySelector(`.nav-item-checkboxes[data-category="${category}"]`);

                    if (toggle) {
                        toggle.checked = visible;
                    }

                    if (itemCheckboxes) {
                        if (visible) {
                            itemCheckboxes.classList.remove('hidden');
                        } else {
                            itemCheckboxes.classList.add('hidden');
                        }
                    }

                    this.updateCategoryVisibility(category, visible);
                }
            }

            // Load individual item visibility
            if (settings.visibility_config && settings.visibility_config.items) {
                for (const [view, visible] of Object.entries(settings.visibility_config.items)) {
                    const checkbox = document.querySelector(`.nav-visibility-item input[data-view="${view}"]`);
                    if (checkbox) {
                        checkbox.checked = visible;
                    }
                    this.updateNavItemVisibility(view, visible);
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

    updateNavItemVisibility(view, visible) {
        const navItem = document.querySelector(`.nav-item[data-view="${view}"]`);
        if (navItem) {
            if (visible) {
                navItem.classList.remove('hidden-by-visibility');
            } else {
                navItem.classList.add('hidden-by-visibility');
            }
        }
    }

    async saveNavVisibility() {
        if (!this.currentOrganizationId) {
            alert('No organization selected');
            return;
        }

        try {
            // Collect category visibility
            const categories = {};
            document.querySelectorAll('.category-toggle').forEach(toggle => {
                categories[toggle.dataset.category] = toggle.checked;
            });

            // Collect individual item visibility
            const items = {};
            document.querySelectorAll('.nav-visibility-item input[type="checkbox"]').forEach(checkbox => {
                items[checkbox.dataset.view] = checkbox.checked;
            });

            const visibilityConfig = {
                categories: categories,
                items: items
            };

            await supabase.saveNavVisibilitySettings(
                this.currentOrganizationId,
                false,
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
                await this.loadExpenseRules();
                await this.loadLastAppliedDate();
                break;
            case 'adjusted-expenses':
                await adjustedExpensesView.init();
                break;
            case 'revenue-config':
                this.loadRevenueCategories();
                break;
            case 'data-import':
                console.log('Loading Data Import view...');
                try {
                    await dataComparisonView.init();
                } catch (error) {
                    console.error('Error loading data comparison view:', error);
                }
                break;
            case 'settings':
                await this.loadNavVisibilitySettings();
                await this.loadOrganizationDetails();
                break;
        }
    }

    async loadOrganizationDetails() {
        if (!this.currentOrganizationId) return;

        try {
            // Get organization details
            const { data: org, error: orgError } = await supabase.client
                .from('organizations')
                .select('*')
                .eq('id', this.currentOrganizationId)
                .single();

            if (orgError) throw orgError;

            // Get locations
            const { data: locations, error: locError } = await supabase.client
                .from('locations')
                .select('*')
                .eq('organization_id', this.currentOrganizationId)
                .eq('is_active', true)
                .order('location_code');

            if (locError) throw locError;

            // Store for later use
            this.currentOrgData = org;
            this.currentLocations = locations;

            // Build display HTML
            const fiscalYearEnd = `${org.fiscal_year_end_month}/${org.fiscal_year_end_day}`;

            const locationsHTML = locations.map(loc => `
                <div style="padding: 12px; background: #f9fafb; border-radius: 6px; margin-bottom: 8px;">
                    <div style="font-weight: 600; font-size: 14px; color: #111827; margin-bottom: 4px;">
                        ${loc.location_code} - ${loc.location_name}
                    </div>
                    <div style="font-size: 13px; color: #6b7280;">
                        ${loc.address || 'No address specified'}
                    </div>
                    ${loc.city || loc.state ? `<div style="font-size: 13px; color: #6b7280;">${loc.city ? loc.city + ', ' : ''}${loc.state || ''}</div>` : ''}
                </div>
            `).join('');

            const displayHTML = `
                <div style="margin-bottom: 20px;">
                    <div style="display: grid; grid-template-columns: 200px 1fr; gap: 16px; margin-bottom: 16px;">
                        <div style="font-weight: 600; color: #6b7280;">Organization Name:</div>
                        <div style="color: #111827;">${org.display_name || org.name}</div>

                        <div style="font-weight: 600; color: #6b7280;">Organization Type:</div>
                        <div style="color: #111827; text-transform: capitalize;">${org.type || 'Not specified'}</div>

                        <div style="font-weight: 600; color: #6b7280;">Fiscal Year End:</div>
                        <div style="color: #111827;">${fiscalYearEnd}</div>
                    </div>
                </div>

                <div>
                    <div style="font-weight: 600; color: #111827; margin-bottom: 12px; font-size: 14px;">Locations (${locations.length})</div>
                    ${locationsHTML}
                </div>
            `;

            document.getElementById('organizationStatusCard').innerHTML = displayHTML;

        } catch (error) {
            console.error('Error loading organization details:', error);
            document.getElementById('organizationStatusCard').innerHTML = `
                <p class="empty-state">Error loading organization details: ${error.message}</p>
            `;
        }
    }

    openEditOrganizationModal() {
        if (!this.currentOrgData || !this.currentLocations) return;

        const org = this.currentOrgData;
        const locations = this.currentLocations;

        // Populate organization fields
        document.getElementById('editOrgName').value = org.display_name || org.name;
        document.getElementById('editFiscalMonth').value = org.fiscal_year_end_month;

        // Populate days for selected month
        this.populateDaysForMonth(org.fiscal_year_end_month);
        document.getElementById('editFiscalDay').value = org.fiscal_year_end_day;

        // Populate locations
        const locationsHTML = locations.map(loc => `
            <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 12px; background: #fafafa;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <div style="font-weight: 600; color: #111827;">
                        ${loc.location_code} <span style="color: #6b7280; font-weight: 400; font-size: 12px;">(Location code cannot be changed)</span>
                    </div>
                </div>

                <div class="form-row">
                    <label>Location Name</label>
                    <input type="text" class="form-input location-name" data-location-id="${loc.id}" value="${loc.location_name || ''}">
                </div>

                <div class="form-row">
                    <label>Address</label>
                    <input type="text" class="form-input location-address" data-location-id="${loc.id}" value="${loc.address || ''}">
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
                    <div class="form-row">
                        <label>City</label>
                        <input type="text" class="form-input location-city" data-location-id="${loc.id}" value="${loc.city || ''}">
                    </div>
                    <div class="form-row">
                        <label>State</label>
                        <input type="text" class="form-input location-state" data-location-id="${loc.id}" value="${loc.state || ''}" maxlength="2">
                    </div>
                    <div class="form-row">
                        <label>County</label>
                        <input type="text" class="form-input location-county" data-location-id="${loc.id}" value="${loc.county || ''}">
                    </div>
                </div>
            </div>
        `).join('');

        document.getElementById('editLocationsContainer').innerHTML = locationsHTML;

        // Show modal
        document.getElementById('editOrganizationModal').classList.add('active');
        document.getElementById('modalOverlay').classList.add('active');
    }

    populateDaysForMonth(month) {
        const daySelect = document.getElementById('editFiscalDay');
        if (!daySelect || !month) return;

        const daysInMonth = new Date(2024, month, 0).getDate();

        daySelect.innerHTML = '<option value="">Day</option>';
        for (let i = 1; i <= daysInMonth; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = i;
            daySelect.appendChild(option);
        }
    }

    async saveOrganizationDetails() {
        try {
            const orgName = document.getElementById('editOrgName').value.trim();
            const fiscalMonth = parseInt(document.getElementById('editFiscalMonth').value);
            const fiscalDay = parseInt(document.getElementById('editFiscalDay').value);

            if (!orgName || !fiscalMonth || !fiscalDay) {
                alert('Please fill in all required fields');
                return;
            }

            // Update organization
            const { error: orgError } = await supabase.client
                .from('organizations')
                .update({
                    display_name: orgName,
                    fiscal_year_end_month: fiscalMonth,
                    fiscal_year_end_day: fiscalDay
                })
                .eq('id', this.currentOrganizationId);

            if (orgError) throw orgError;

            // Update each location
            const locationUpdates = [];
            this.currentLocations.forEach(loc => {
                const name = document.querySelector(`.location-name[data-location-id="${loc.id}"]`).value.trim();
                const address = document.querySelector(`.location-address[data-location-id="${loc.id}"]`).value.trim();
                const city = document.querySelector(`.location-city[data-location-id="${loc.id}"]`).value.trim();
                const state = document.querySelector(`.location-state[data-location-id="${loc.id}"]`).value.trim();
                const county = document.querySelector(`.location-county[data-location-id="${loc.id}"]`).value.trim();

                locationUpdates.push(
                    supabase.client
                        .from('locations')
                        .update({
                            location_name: name,
                            address: address,
                            city: city,
                            state: state,
                            county: county
                        })
                        .eq('id', loc.id)
                );
            });

            await Promise.all(locationUpdates);

            // Close modal
            document.getElementById('editOrganizationModal').classList.remove('active');
            document.getElementById('modalOverlay').classList.remove('active');

            // Reload organization details
            await this.loadOrganizationDetails();

            alert('✅ Organization details updated successfully');

        } catch (error) {
            console.error('Error saving organization details:', error);
            alert('❌ Error saving changes: ' + error.message);
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

                // Get session-level operational expenses and operating profit
                let sessionsQuery = supabase.client
                    .from('sessions')
                    .select('operational_expenses, operating_profit')
                    .gte('session_date', `${month}-01`)
                    .lt('session_date', `${month}-32`)
                    .eq('organization_id', this.currentOrganizationId);

                // Filter by location if not COMBINED
                if (location && location !== 'COMBINED') {
                    sessionsQuery = sessionsQuery.eq('location_code', location);
                }

                const { data: sessions, error } = await sessionsQuery;

                let operationalExpenses = 0;
                let operatingProfit = 0;

                if (sessions && sessions.length > 0) {
                    operationalExpenses = sessions.reduce((sum, s) => sum + (parseFloat(s.operational_expenses) || 0), 0);
                    operatingProfit = sessions.reduce((sum, s) => sum + (parseFloat(s.operating_profit) || 0), 0);
                }

                // Other Expenses = Operational Expenses (not including payouts)
                document.getElementById('otherExpenses').textContent =
                    this.formatCurrency(operationalExpenses);

                // Bottom row metrics
                document.getElementById('operationalExpenses').textContent =
                    this.formatCurrency(operationalExpenses);
                document.getElementById('operatingProfit').textContent =
                    this.formatCurrency(operatingProfit);
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
                        <td colspan="6" class="empty-state">No allocation rules found. Run the seed script to create default rules.</td>
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
                    <td style="text-align: right;">
                        <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 13px;" onclick="alert('Edit functionality coming soon')">
                            <i data-lucide="edit-2" style="width: 14px; height: 14px;"></i>
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
                    <td colspan="6" class="empty-state">Error loading rules: ${error.message}</td>
                </tr>
            `;
        }
    }

    editAllocationRule(ruleId) {
        // TODO: Implement edit modal
        console.log('Edit rule:', ruleId);
        alert('Edit functionality coming soon!');
    }

    async loadLastAppliedDate() {
        try {
            const lastApplied = await supabase.getLastRulesAppliedDate(this.currentOrganizationId);
            const display = document.getElementById('rulesLastApplied');
            if (display) {
                if (lastApplied) {
                    const date = new Date(lastApplied);
                    display.textContent = date.toLocaleString();
                } else {
                    display.textContent = 'Never';
                }
            }
        } catch (error) {
            console.error('Error loading last applied date:', error);
        }
    }

    async applyAllocationRules() {
        // Load available months from QB imports (raw data before transformation)
        try {
            const { data: imports } = await supabase.client
                .from('qb_monthly_imports')
                .select('month')
                .eq('organization_id', this.currentOrganizationId);

            if (!imports || imports.length === 0) {
                alert('No QB import data found. Please upload QB data first.');
                return;
            }

            const uniqueMonths = [...new Set(
                imports.map(i => {
                    const date = new Date(i.month);
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    return `${year}-${month}`;
                })
            )].sort().reverse();

            const monthSelect = document.getElementById('applyRulesMonthSelect');
            monthSelect.innerHTML = '<option value="">Select a month...</option>' +
                uniqueMonths.map(m => {
                    const date = new Date(m + '-01');
                    const display = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
                    return `<option value="${m}">${display}</option>`;
                }).join('');

            // Show modal
            document.getElementById('applyRulesModal').classList.add('active');
            document.getElementById('modalOverlay').classList.add('active');

            // Reinitialize Lucide icons
            if (window.lucide) {
                window.lucide.createIcons();
            }

        } catch (error) {
            console.error('Error loading months:', error);
            alert('Error loading QB data: ' + error.message);
        }
    }

    async executeApplyRules(month = null) {
        try {
            const engine = new AllocationEngine(supabase.client);
            engine.setOrganization(this.currentOrganizationId);

            // Close modal
            document.getElementById('applyRulesModal').classList.remove('active');
            document.getElementById('modalOverlay').classList.remove('active');

            // Show processing indicator
            const indicator = document.createElement('div');
            indicator.id = 'processingIndicator';
            indicator.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 30px; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.3); z-index: 10000; text-align: center;';

            // Step 1: Transform QB imports
            indicator.innerHTML = `
                <div style="font-size: 18px; font-weight: 600; margin-bottom: 10px;">Step 1: Transforming QB Imports...</div>
                <div style="color: #6b7280; margin-bottom: 20px;">Converting raw imports to normalized expenses</div>
                <div class="spinner" style="width: 40px; height: 40px; margin: 0 auto;"></div>
            `;
            document.body.appendChild(indicator);

            console.log('🔄 Transforming QB monthly imports to qb_expenses...');
            const transformResult = await supabase.transformQBImportsToExpenses(this.currentOrganizationId, month);
            console.log(`✅ Transformation complete: ${transformResult.records_created} expense records created`);

            // Step 2: Apply allocation rules
            indicator.innerHTML = `
                <div style="font-size: 18px; font-weight: 600; margin-bottom: 10px;">Step 2: Applying Allocation Rules...</div>
                <div style="color: #6b7280; margin-bottom: 20px;">${month ? `Month: ${month}` : 'All months'}</div>
                <div class="spinner" style="width: 40px; height: 40px; margin: 0 auto;"></div>
            `;

            const result = await engine.applyMonthlyAllocationRules(month, true);

            // Step 3: Apply session allocation rules
            indicator.innerHTML = `
                <div style="font-size: 18px; font-weight: 600; margin-bottom: 10px;">Step 3: Allocating to Sessions...</div>
                <div style="color: #6b7280; margin-bottom: 20px;">Distributing expenses across sessions</div>
                <div class="spinner" style="width: 40px; height: 40px; margin: 0 auto;"></div>
            `;

            const sessionResult = await engine.applySessionAllocationRules(month);

            // Remove indicator
            indicator.remove();

            alert(`✅ Success!\n\nStep 1: Transformed ${transformResult.records_processed} QB records → ${transformResult.records_created} expenses\n\nStep 2: Processed ${result.monthsProcessed} months → ${result.expensesCreated} monthly allocations\n\nStep 3: Created ${sessionResult.sessionAllocations} session expense allocations`);

            // Reload last applied date
            await this.loadLastAppliedDate();

        } catch (error) {
            console.error('Error applying rules:', error);
            document.getElementById('processingIndicator')?.remove();
            alert('❌ Error applying rules: ' + error.message);
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
