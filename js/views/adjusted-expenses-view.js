// Adjusted Monthly Expenses View
import { supabase } from '../core/supabase-client.js';

export class AdjustedExpensesView {
    constructor() {
        this.currentMonth = null;
        this.expenses = [];
        this.sortColumn = null;
        this.sortDirection = 'asc'; // 'asc' or 'desc'
    }

    async init() {
        console.log('🎯 Initializing Adjusted Expenses View...');
        await this.loadMonths();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Month selector
        const monthSelect = document.getElementById('adjustedExpensesMonthSelect');
        monthSelect?.addEventListener('change', (e) => {
            this.currentMonth = e.target.value;
            if (this.currentMonth) {
                this.loadExpenses();
            }
        });

        // Refresh button
        document.getElementById('refreshAdjustedExpensesBtn')?.addEventListener('click', () => {
            if (this.currentMonth) {
                this.loadExpenses();
            }
        });

        // Column header sorting
        document.querySelectorAll('.sortable-header').forEach(header => {
            header.addEventListener('click', () => {
                const column = header.dataset.column;
                this.sortBy(column);
            });
        });
    }

    async loadMonths() {
        try {
            const months = await supabase.getMonthsWithAllocatedExpenses(window.app.currentOrganizationId);

            const monthSelect = document.getElementById('adjustedExpensesMonthSelect');
            if (!monthSelect) return;

            if (months.length === 0) {
                monthSelect.innerHTML = '<option value="">No data available - Apply rules first</option>';
                return;
            }

            // Format months for display
            monthSelect.innerHTML = '<option value="">Select a month...</option>' +
                months.map(m => {
                    const date = new Date(m);
                    const display = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
                    const value = m.substring(0, 7); // YYYY-MM
                    return `<option value="${value}">${display}</option>`;
                }).join('');

            // Auto-select most recent month
            if (months.length > 0) {
                this.currentMonth = months[0].substring(0, 7);
                monthSelect.value = this.currentMonth;
                await this.loadExpenses();
            }

        } catch (error) {
            console.error('Error loading months:', error);
        }
    }

    async loadExpenses() {
        if (!this.currentMonth) return;

        try {
            console.log(`📊 Loading expenses for ${this.currentMonth}...`);

            this.expenses = await supabase.getMonthlyAllocatedExpenses(
                window.app.currentOrganizationId,
                this.currentMonth
            );

            console.log(`Found ${this.expenses.length} expense allocations`);

            this.updateSummaryCards();
            this.renderExpensesTable();

        } catch (error) {
            console.error('Error loading expenses:', error);
            alert('Error loading expenses: ' + error.message);
        }
    }

    sortBy(column) {
        // Toggle direction if same column, otherwise default to asc
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'asc';
        }

        // Sort the expenses array
        this.expenses.sort((a, b) => {
            let aVal, bVal;

            switch (column) {
                case 'location':
                    aVal = a.locations?.location_code || '';
                    bVal = b.locations?.location_code || '';
                    break;
                case 'category':
                    aVal = a.expense_category;
                    bVal = b.expense_category;
                    break;
                case 'qb_total':
                    aVal = parseFloat(a.qb_total_amount || 0);
                    bVal = parseFloat(b.qb_total_amount || 0);
                    break;
                case 'split_percent':
                    aVal = parseFloat(a.location_split_percent || 0);
                    bVal = parseFloat(b.location_split_percent || 0);
                    break;
                case 'allocated':
                    aVal = parseFloat(a.allocated_amount || 0);
                    bVal = parseFloat(b.allocated_amount || 0);
                    break;
                case 'bingo_percent':
                    aVal = parseFloat(a.bingo_percentage || 0);
                    bVal = parseFloat(b.bingo_percentage || 0);
                    break;
                case 'bingo_amount':
                    aVal = parseFloat(a.override_bingo_amount || a.bingo_amount || 0);
                    bVal = parseFloat(b.override_bingo_amount || b.bingo_amount || 0);
                    break;
                case 'override':
                    aVal = a.override_allocated_amount ? parseFloat(a.override_allocated_amount) : 0;
                    bVal = b.override_allocated_amount ? parseFloat(b.override_allocated_amount) : 0;
                    break;
                case 'transactions':
                    aVal = parseInt(a.qb_transaction_count || 0);
                    bVal = parseInt(b.qb_transaction_count || 0);
                    break;
                default:
                    return 0;
            }

            // String comparison
            if (typeof aVal === 'string') {
                return this.sortDirection === 'asc'
                    ? aVal.localeCompare(bVal)
                    : bVal.localeCompare(aVal);
            }

            // Numeric comparison
            return this.sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        });

        // Re-render table
        this.renderExpensesTable();
    }

    updateSummaryCards() {
        // Calculate totals
        const totals = this.expenses.reduce((acc, exp) => {
            acc.qbTotal += parseFloat(exp.qb_total_amount || 0);

            const locCode = exp.locations?.location_code;
            const allocated = parseFloat(exp.override_allocated_amount || exp.allocated_amount || 0);
            const bingo = parseFloat(exp.override_bingo_amount || exp.bingo_amount || 0);

            if (locCode === 'SC') {
                acc.scAllocated += allocated;
                acc.scBingo += bingo;
            } else if (locCode === 'RWC') {
                acc.rwcAllocated += allocated;
                acc.rwcBingo += bingo;
            }

            if (exp.is_overridden) {
                acc.overrides++;
            }

            return acc;
        }, { qbTotal: 0, scAllocated: 0, scBingo: 0, rwcAllocated: 0, rwcBingo: 0, overrides: 0 });

        // Update cards
        document.getElementById('totalQBExpenses').textContent = `$${totals.qbTotal.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
        document.getElementById('scAllocated').textContent = `$${totals.scAllocated.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
        document.getElementById('scBingo').textContent = `Bingo: $${totals.scBingo.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
        document.getElementById('rwcAllocated').textContent = `$${totals.rwcAllocated.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
        document.getElementById('rwcBingo').textContent = `Bingo: $${totals.rwcBingo.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
        document.getElementById('overrideCount').textContent = totals.overrides;
    }

    renderExpensesTable() {
        const tbody = document.getElementById('adjustedExpensesTableBody');
        if (!tbody) return;

        if (this.expenses.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" class="empty-state">No expenses found for this month</td></tr>';
            return;
        }

        tbody.innerHTML = this.expenses.map(exp => {
            const locCode = exp.locations?.location_code || 'Unknown';
            const allocated = parseFloat(exp.allocated_amount || 0);
            const overrideAmt = exp.override_allocated_amount ? parseFloat(exp.override_allocated_amount) : null;
            const displayAmount = overrideAmt !== null ? overrideAmt : allocated;
            const bingoAmt = exp.override_bingo_amount ? parseFloat(exp.override_bingo_amount) : parseFloat(exp.bingo_amount || 0);

            return `
                <tr style="${exp.is_overridden ? 'background: #fef3c7;' : ''}">
                    <td><span class="badge badge-${locCode === 'SC' ? 'blue' : 'purple'}">${locCode}</span></td>
                    <td class="cell-bold">${exp.expense_category}</td>
                    <td>$${parseFloat(exp.qb_total_amount).toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                    <td>${parseFloat(exp.location_split_percent || 0).toFixed(1)}%</td>
                    <td>$${allocated.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                    <td>${parseFloat(exp.bingo_percentage).toFixed(0)}%</td>
                    <td>$${bingoAmt.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                    <td class="clickable-cell" onclick="adjustedExpensesView.editOverride('${exp.id}', ${allocated})" style="cursor: pointer; text-align: center;">
                        ${overrideAmt !== null ?
                            `<span class="badge badge-warning">$${overrideAmt.toLocaleString('en-US', {minimumFractionDigits: 2})}</span>` :
                            '<span class="badge badge-secondary">None</span>'}
                    </td>
                    <td>${exp.qb_transaction_count || 0}</td>
                </tr>
            `;
        }).join('');

        // Re-initialize Lucide icons
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    async editOverride(expenseId, currentAllocated) {
        const expense = this.expenses.find(e => e.id === expenseId);
        if (!expense) return;

        const currentOverride = expense.override_allocated_amount || currentAllocated;
        const newAmount = prompt(
            `Override allocated amount for ${expense.expense_category} (${expense.locations?.location_code}):\n\nCurrent: $${parseFloat(currentAllocated).toFixed(2)}\nOverride: $${currentOverride ? parseFloat(currentOverride).toFixed(2) : 'None'}\n\nEnter new amount:`,
            currentOverride
        );

        if (newAmount === null) return; // Cancelled

        const amount = parseFloat(newAmount);
        if (isNaN(amount) || amount < 0) {
            alert('Invalid amount');
            return;
        }

        try {
            await supabase.updateMonthlyExpenseOverride(expenseId, amount, null);
            await this.loadExpenses(); // Reload to show changes
            alert('✅ Override saved successfully');
        } catch (error) {
            console.error('Error saving override:', error);
            alert('❌ Error saving override: ' + error.message);
        }
    }
}

// Export singleton instance
export const adjustedExpensesView = new AdjustedExpensesView();

// Make globally accessible for onclick handlers
window.adjustedExpensesView = adjustedExpensesView;
