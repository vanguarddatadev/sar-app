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

        console.log(`📅 Available months from sessions: ${months.join(', ')}`);

        // Find most recent month with allocations
        const { data: allocations, error: allocError } = await supabase.client
            .from('monthly_allocated_expenses')
            .select('month')
            .eq('organization_id', this.currentOrganizationId)
            .order('month', { ascending: false })
            .limit(1);

        if (allocError) {
            console.error('❌ Error querying allocations:', allocError);
        }

        let defaultMonth = months[0]; // Fallback to most recent session month

        if (allocations && allocations.length > 0) {
            // Extract YYYY-MM from the month field (which is stored as YYYY-MM-01)
            const allocMonth = allocations[0].month.substring(0, 7);
            console.log(`📅 Most recent allocation month from DB: ${allocations[0].month} → ${allocMonth}`);
            if (months.includes(allocMonth)) {
                defaultMonth = allocMonth;
                console.log(`✅ Found most recent month with allocations: ${defaultMonth}`);
            } else {
                console.log(`⚠️ Allocation month ${allocMonth} not in sessions list`);
            }
        } else {
            console.log(`⚠️ No allocations found for organization ${this.currentOrganizationId}`);
        }

        // Populate selector
        const select = document.getElementById('comparisonMonthSelect');
        if (select) {
            select.innerHTML = months.map(month => {
                const date = new Date(month + '-01');
                const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                return `<option value="${month}">${label}</option>`;
            }).join('');

            // Set current month to most recent with data
            this.currentMonth = defaultMonth;
            select.value = defaultMonth; // Set the dropdown to match
            console.log(`📅 Defaulting to: ${this.currentMonth}`);
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

        console.log(`🔍 Loading comparison data for ${this.currentMonth}...`);
        console.log(`   Organization: ${this.currentOrganizationId}`);

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

        console.log(`   📊 QB Expenses: ${startDate} to ${endDate}`);

        // Get QB expenses
        const { data: expenses, error: expenseError } = await supabase.client
            .from('qb_expenses')
            .select('*')
            .eq('organization_id', this.currentOrganizationId)
            .gte('expense_date', startDate)
            .lte('expense_date', endDate)
            .order('qb_category', { ascending: true });

        if (expenseError) throw expenseError;

        // Get QB category mappings to filter to only mapped expenses
        const { data: mappings, error: mappingError } = await supabase.client
            .from('qb_category_mapping')
            .select(`
                *,
                allocation_rules(expense_category, allocation_method)
            `)
            .eq('organization_id', this.currentOrganizationId);

        if (mappingError) throw mappingError;

        console.log(`   📊 Found ${expenses?.length || 0} total QB transactions, ${mappings?.length || 0} mapped categories`);

        // Filter to only mapped expenses and group by expense category (not QB category)
        const grouped = {};
        const unmappedExpenses = [];

        expenses.forEach(expense => {
            const mapping = mappings.find(m => m.qb_category_name === expense.qb_category);
            if (!mapping || !mapping.allocation_rules) {
                unmappedExpenses.push(expense);
                return;
            }

            const expenseCategory = mapping.allocation_rules.expense_category;
            if (!grouped[expenseCategory]) {
                grouped[expenseCategory] = {
                    category: expenseCategory,
                    count: 0,
                    total: 0,
                    qbCategories: new Set(),
                    transactions: []
                };
            }
            grouped[expenseCategory].count++;
            grouped[expenseCategory].total += parseFloat(expense.amount || 0);
            grouped[expenseCategory].qbCategories.add(expense.qb_category);
            grouped[expenseCategory].transactions.push({
                qb_category: expense.qb_category,
                amount: parseFloat(expense.amount || 0),
                date: expense.expense_date,
                vendor: expense.vendor
            });
        });

        const mappedExpenses = expenses.filter(e =>
            mappings.some(m => m.qb_category_name === e.qb_category && m.allocation_rules)
        );

        console.log(`   📊 ${mappedExpenses.length} mapped, ${unmappedExpenses.length} unmapped transactions`);

        return {
            raw: mappedExpenses,
            grouped: Object.values(grouped).map(g => ({
                ...g,
                qbCategories: Array.from(g.qbCategories).join(', ')
            })),
            totalAmount: mappedExpenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0),
            totalCount: mappedExpenses.length,
            unmappedCount: unmappedExpenses.length,
            unmappedAmount: unmappedExpenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0)
        };
    }

    async loadAdjustedMonthly() {
        const monthFilter = `${this.currentMonth}-01`;
        console.log(`   📅 Adjusted Monthly: month = ${monthFilter}`);

        const { data, error } = await supabase.client
            .from('monthly_allocated_expenses')
            .select(`
                *,
                locations(location_code),
                allocation_rules(expense_category, allocation_method)
            `)
            .eq('organization_id', this.currentOrganizationId)
            .eq('month', monthFilter)
            .order('expense_category', { ascending: true });

        if (error) {
            console.error('Error loading adjusted monthly:', error);
            throw error;
        }

        console.log(`   📅 Found ${data?.length || 0} adjusted monthly allocations`);
        if (data && data.length > 0) {
            console.log(`   📅 Sample allocation:`, data[0]);
        }

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

        console.log(`   🎯 Sessions: ${startDate} to ${endDate}`);

        // Get sessions
        const { data: sessions, error: sessionError } = await supabase.client
            .from('sessions')
            .select('*')
            .eq('organization_id', this.currentOrganizationId)
            .gte('session_date', startDate)
            .lte('session_date', endDate)
            .order('session_date', { ascending: true });

        if (sessionError) throw sessionError;

        console.log(`   🎯 Found ${sessions?.length || 0} sessions`);

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
                    <h4>1. QB Expenses (Mapped Only - by Expense Category)</h4>
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Expense Category</th>
                                <th>QB Categories</th>
                                <th>Count</th>
                                <th>Total Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${qbData.grouped.map(cat => `
                                <tr>
                                    <td><strong>${cat.category}</strong></td>
                                    <td style="font-size: 0.85em; color: #666;">${cat.qbCategories}</td>
                                    <td>${cat.count}</td>
                                    <td>${this.fmt(cat.total)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr>
                                <th>TOTAL (Mapped)</th>
                                <th>-</th>
                                <th>${qbData.totalCount}</th>
                                <th>${this.fmt(qbData.totalAmount)}</th>
                            </tr>
                            ${qbData.unmappedCount > 0 ? `
                            <tr style="color: #999;">
                                <th>Unmapped (not allocated)</th>
                                <th>-</th>
                                <th>${qbData.unmappedCount}</th>
                                <th>${this.fmt(qbData.unmappedAmount)}</th>
                            </tr>
                            ` : ''}
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
