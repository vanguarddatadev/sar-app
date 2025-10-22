// Data Comparison View
// Shows QB imports, adjusted monthly allocations, and session allocations side-by-side

import { supabase } from '../core/supabase-client.js';

class DataComparisonView {
    constructor() {
        this.currentMonth = null;
        this.currentOrganizationId = null;
    }

    async init() {
        console.log('Initializing Data Comparison view...');

        // Get organization ID
        this.currentOrganizationId = window.app?.currentOrganizationId;

        // Populate month selector
        await this.populateMonthSelector();

        this.setupEventHandlers();
        await this.loadData();
    }

    async populateMonthSelector() {
        // Get available months from sessions
        const { data: sessions } = await supabase.client
            .from('sessions')
            .select('session_date')
            .eq('organization_id', this.currentOrganizationId)
            .order('session_date', { ascending: false });

        if (!sessions || sessions.length === 0) return;

        // Extract unique months
        const monthsSet = new Set();
        sessions.forEach(s => {
            const date = new Date(s.session_date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            monthsSet.add(monthKey);
        });

        const months = Array.from(monthsSet).sort().reverse();

        // Populate selector
        const select = document.getElementById('comparisonMonthSelect');
        if (select) {
            select.innerHTML = months.map(month => {
                const date = new Date(month + '-01');
                const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                return `<option value="${month}">${label}</option>`;
            }).join('');

            // Set current month to most recent
            this.currentMonth = months[0];
        }
    }

    setupEventHandlers() {
        const monthSelect = document.getElementById('comparisonMonthSelect');
        if (monthSelect) {
            monthSelect.addEventListener('change', async (e) => {
                this.currentMonth = e.target.value;
                await this.loadData();
            });
        }

        const refreshBtn = document.getElementById('refreshComparisonBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                await this.loadData();
            });
        }
    }

    async loadData() {
        if (!this.currentMonth || !this.currentOrganizationId) {
            console.error('Month or organization not set');
            return;
        }

        console.log(`Loading comparison data for ${this.currentMonth}...`);

        // Show loading state
        const container = document.getElementById('comparisonDataContainer');
        if (container) {
            container.innerHTML = '<div class="loading">Loading data...</div>';
        }

        try {
            // Load all three data sources in parallel
            const [qbData, adjustedData, sessionData] = await Promise.all([
                this.loadQBExpenses(),
                this.loadAdjustedMonthly(),
                this.loadSessionAllocations()
            ]);

            this.renderComparison(qbData, adjustedData, sessionData);
        } catch (error) {
            console.error('Error loading comparison data:', error);
            if (container) {
                container.innerHTML = `<div class="error">Error loading data: ${error.message}</div>`;
            }
        }
    }

    async loadQBExpenses() {
        const startDate = `${this.currentMonth}-01`;
        const [year, monthNum] = this.currentMonth.split('-');
        const lastDay = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
        const endDate = `${this.currentMonth}-${String(lastDay).padStart(2, '0')}`;

        const { data, error } = await supabase.client
            .from('qb_expenses')
            .select('*')
            .eq('organization_id', this.currentOrganizationId)
            .gte('expense_date', startDate)
            .lte('expense_date', endDate)
            .order('qb_category', { ascending: true });

        if (error) throw error;

        // Group by category
        const grouped = {};
        data.forEach(expense => {
            if (!grouped[expense.qb_category]) {
                grouped[expense.qb_category] = {
                    category: expense.qb_category,
                    count: 0,
                    total: 0,
                    expenses: []
                };
            }
            grouped[expense.qb_category].count++;
            grouped[expense.qb_category].total += parseFloat(expense.amount || 0);
            grouped[expense.qb_category].expenses.push(expense);
        });

        return {
            raw: data,
            grouped: Object.values(grouped),
            totalAmount: data.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0),
            totalCount: data.length
        };
    }

    async loadAdjustedMonthly() {
        const { data, error } = await supabase.client
            .from('monthly_allocated_expenses')
            .select(`
                *,
                locations(location_code),
                allocation_rules(expense_category, allocation_method)
            `)
            .eq('organization_id', this.currentOrganizationId)
            .eq('month', `${this.currentMonth}-01`)
            .order('expense_category', { ascending: true });

        if (error) throw error;

        // Group by expense category
        const grouped = {};
        data.forEach(allocation => {
            const category = allocation.allocation_rules?.expense_category || 'Unknown';
            if (!grouped[category]) {
                grouped[category] = {
                    category,
                    qbTotal: 0,
                    allocatedTotal: 0,
                    bingoTotal: 0,
                    locations: []
                };
            }
            grouped[category].qbTotal = parseFloat(allocation.qb_total_amount || 0);
            grouped[category].allocatedTotal += parseFloat(allocation.allocated_amount || 0);
            grouped[category].bingoTotal += parseFloat(allocation.bingo_amount || 0);
            grouped[category].locations.push({
                location: allocation.locations?.location_code || 'Unknown',
                allocated: parseFloat(allocation.allocated_amount || 0),
                bingo: parseFloat(allocation.bingo_amount || 0),
                percent: parseFloat(allocation.location_split_percent || 0)
            });
        });

        return {
            raw: data,
            grouped: Object.values(grouped),
            totalAllocated: data.reduce((sum, e) => sum + parseFloat(e.allocated_amount || 0), 0),
            totalBingo: data.reduce((sum, e) => sum + parseFloat(e.bingo_amount || 0), 0)
        };
    }

    async loadSessionAllocations() {
        const startDate = `${this.currentMonth}-01`;
        const [year, monthNum] = this.currentMonth.split('-');
        const lastDay = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
        const endDate = `${this.currentMonth}-${String(lastDay).padStart(2, '0')}`;

        // Get sessions
        const { data: sessions, error: sessionError } = await supabase.client
            .from('sessions')
            .select('*')
            .eq('organization_id', this.currentOrganizationId)
            .gte('session_date', startDate)
            .lte('session_date', endDate)
            .order('session_date', { ascending: true });

        if (sessionError) throw sessionError;

        // Get session allocations
        const sessionIds = sessions.map(s => s.id);
        const { data: allocations, error: allocError } = await supabase.client
            .from('session_allocated_expenses')
            .select('*')
            .in('session_id', sessionIds);

        if (allocError) throw allocError;

        // Group allocations by expense category
        const categoryTotals = {};
        allocations.forEach(alloc => {
            if (!categoryTotals[alloc.expense_category]) {
                categoryTotals[alloc.expense_category] = 0;
            }
            categoryTotals[alloc.expense_category] += parseFloat(alloc.allocated_amount || 0);
        });

        return {
            sessions,
            allocations,
            categoryTotals,
            totalOperationalExpenses: sessions.reduce((sum, s) => sum + parseFloat(s.operational_expenses || 0), 0),
            totalOperatingProfit: sessions.reduce((sum, s) => sum + parseFloat(s.operating_profit || 0), 0),
            sessionCount: sessions.length
        };
    }

    renderComparison(qbData, adjustedData, sessionData) {
        const container = document.getElementById('comparisonDataContainer');
        if (!container) return;

        const html = `
            <div class="comparison-summary">
                <h3>Data Flow Summary for ${this.currentMonth}</h3>
                <div class="summary-cards">
                    <div class="summary-card">
                        <div class="summary-label">QB Expenses</div>
                        <div class="summary-value">${this.fmt(qbData.totalAmount)}</div>
                        <div class="summary-detail">${qbData.totalCount} transactions</div>
                    </div>
                    <div class="summary-card">
                        <div class="summary-label">Adjusted Monthly</div>
                        <div class="summary-value">${this.fmt(adjustedData.totalAllocated)}</div>
                        <div class="summary-detail">${adjustedData.raw.length} allocations</div>
                    </div>
                    <div class="summary-card">
                        <div class="summary-label">Session Allocations</div>
                        <div class="summary-value">${this.fmt(sessionData.totalOperationalExpenses)}</div>
                        <div class="summary-detail">${sessionData.sessionCount} sessions</div>
                    </div>
                </div>
            </div>

            <div class="comparison-tables">
                <!-- QB Expenses -->
                <div class="comparison-section">
                    <h4>1. QB Expenses (by Category)</h4>
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>QB Category</th>
                                <th>Count</th>
                                <th>Total Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${qbData.grouped.map(cat => `
                                <tr>
                                    <td>${cat.category}</td>
                                    <td>${cat.count}</td>
                                    <td>${this.fmt(cat.total)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr>
                                <th>TOTAL</th>
                                <th>${qbData.totalCount}</th>
                                <th>${this.fmt(qbData.totalAmount)}</th>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <!-- Adjusted Monthly -->
                <div class="comparison-section">
                    <h4>2. Adjusted Monthly Allocations (by Expense Category)</h4>
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Expense Category</th>
                                <th>QB Total</th>
                                <th>Allocated</th>
                                <th>Bingo Amount</th>
                                <th>Locations</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${adjustedData.grouped.map(cat => `
                                <tr>
                                    <td><strong>${cat.category}</strong></td>
                                    <td>${this.fmt(cat.qbTotal)}</td>
                                    <td>${this.fmt(cat.allocatedTotal)}</td>
                                    <td>${this.fmt(cat.bingoTotal)}</td>
                                    <td>${cat.locations.map(loc =>
                                        `${loc.location}: ${this.fmt(loc.allocated)} (${loc.percent.toFixed(1)}%)`
                                    ).join('<br>')}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr>
                                <th>TOTAL</th>
                                <th>-</th>
                                <th>${this.fmt(adjustedData.totalAllocated)}</th>
                                <th>${this.fmt(adjustedData.totalBingo)}</th>
                                <th>-</th>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <!-- Session Allocations -->
                <div class="comparison-section">
                    <h4>3. Session Allocations Summary</h4>
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Expense Category</th>
                                <th>Total Allocated</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Object.entries(sessionData.categoryTotals).map(([category, total]) => `
                                <tr>
                                    <td>${category}</td>
                                    <td>${this.fmt(total)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr>
                                <th>Total Operational Expenses</th>
                                <th>${this.fmt(sessionData.totalOperationalExpenses)}</th>
                            </tr>
                            <tr>
                                <th>Total Operating Profit</th>
                                <th>${this.fmt(sessionData.totalOperatingProfit)}</th>
                            </tr>
                        </tfoot>
                    </table>

                    <h5 style="margin-top: 20px;">Sessions Detail</h5>
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Location</th>
                                <th>Total Sales</th>
                                <th>Total Payouts</th>
                                <th>Op Expenses</th>
                                <th>Operating Profit</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${sessionData.sessions.map(session => `
                                <tr>
                                    <td>${session.session_date}</td>
                                    <td>${session.location_code}</td>
                                    <td>${this.fmt(session.total_sales)}</td>
                                    <td>${this.fmt(session.total_payouts)}</td>
                                    <td>${this.fmt(session.operational_expenses)}</td>
                                    <td>${this.fmt(session.operating_profit)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        container.innerHTML = html;
    }

    fmt(value) {
        if (!value || isNaN(value)) return '$0';
        return '$' + Math.round(value).toLocaleString();
    }
}

export const dataComparisonView = new DataComparisonView();
