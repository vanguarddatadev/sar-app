// SAR Main Application
// Entry point for the application

import { supabase } from './supabase-client.js';
import { qbAdminView } from '../views/qb-admin.js';
import { ssarView } from '../views/s-sar-view.js';

class SARApp {
    constructor() {
        this.currentView = 'dashboard';
        this.currentAdminSection = 'qb';
        this.initialized = false;
    }

    async init() {
        console.log('🚀 Initializing SAR Application...');

        // Load organization name from localStorage
        const orgName = localStorage.getItem('sar_organization_name');
        if (orgName) {
            document.getElementById('organizationName').textContent = orgName;
        }

        // Check if Supabase credentials are stored
        const supabaseUrl = localStorage.getItem('sar_supabase_url');
        const supabaseKey = localStorage.getItem('sar_supabase_key');

        if (!supabaseUrl || !supabaseKey) {
            this.showSupabaseSetup();
            return;
        }

        try {
            await supabase.init(supabaseUrl, supabaseKey);
            const connected = await supabase.testConnection();

            if (!connected) {
                this.showSupabaseSetup();
                return;
            }

            this.initialized = true;
            this.setupEventListeners();
            await this.loadDashboard();
            console.log('✅ SAR Application initialized');

        } catch (error) {
            console.error('Failed to initialize:', error);
            this.showSupabaseSetup();
        }
    }

    showSupabaseSetup() {
        const setup = `
            <div class="content-card" style="max-width: 600px; margin: 40px auto;">
                <div class="card-header">
                    <div class="card-title">Welcome to SAR</div>
                </div>
                <div class="card-body">
                    <p style="color: #6b7280; margin-bottom: 24px;">
                        To get started, please enter your Supabase connection details.
                    </p>

                    <div class="form-row">
                        <label>Supabase URL</label>
                        <input type="text" id="setupSupabaseUrl" class="form-input"
                               placeholder="https://xxxxx.supabase.co">
                    </div>

                    <div class="form-row">
                        <label>Supabase Service Role Key</label>
                        <input type="password" id="setupSupabaseKey" class="form-input"
                               placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...">
                    </div>

                    <button class="btn btn-primary" id="setupSupabaseBtn">Connect</button>

                    <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">
                        Don't have a Supabase project? <a href="https://supabase.com" target="_blank" style="color: #4f46e5;">Create one here</a>
                    </p>
                </div>
            </div>
        `;

        document.getElementById('dashboard-view').innerHTML = setup;

        document.getElementById('setupSupabaseBtn').addEventListener('click', async () => {
            const url = document.getElementById('setupSupabaseUrl').value.trim();
            const key = document.getElementById('setupSupabaseKey').value.trim();

            if (!url || !key) {
                alert('Please enter both URL and Key');
                return;
            }

            try {
                await supabase.init(url, key);
                const connected = await supabase.testConnection();

                if (connected) {
                    localStorage.setItem('sar_supabase_url', url);
                    localStorage.setItem('sar_supabase_key', key);
                    this.initialized = true;

                    // Reload the page to restore full UI
                    alert('✅ Connected successfully! The page will reload.');
                    window.location.reload();
                } else {
                    alert('❌ Connection test failed. Please check your credentials.');
                }
            } catch (error) {
                alert('❌ Error: ' + error.message);
            }
        });
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
}

// Initialize app
const app = new SARApp();
window.app = app; // Make available globally for onclick handlers
app.init();

export default app;
