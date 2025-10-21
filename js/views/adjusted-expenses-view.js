// Adjusted Monthly Expenses View
import { supabase } from '../core/supabase-client.js';

export class AdjustedExpensesView {
    constructor() {
        this.currentMonth = null;
        this.expenses = [];
        this.allExpenses = []; // Unfiltered expenses
        this.locationFilter = 'all'; // 'all', 'SC', 'RWC'
        this.sortColumn = null;
        this.sortDirection = 'asc'; // 'asc' or 'desc'
    }

    async init() {
        console.log('🎯 Initializing Adjusted Expenses View...');
        await this.loadMonths();
        this.setupEventListeners();
        this.setupOverridePopupListeners();
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

        // Location filter buttons
        document.querySelectorAll('.location-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.locationFilter = btn.dataset.location;
                this.applyFilters();

                // Update active state
                document.querySelectorAll('.location-filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    }

    applyFilters() {
        // Filter expenses based on location filter
        if (this.locationFilter === 'all') {
            this.expenses = [...this.allExpenses];
        } else {
            this.expenses = this.allExpenses.filter(exp =>
                exp.locations?.location_code === this.locationFilter
            );
        }

        // Re-render
        this.updateSummaryCards();
        this.renderExpensesTable();
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

            this.allExpenses = await supabase.getMonthlyAllocatedExpenses(
                window.app.currentOrganizationId,
                this.currentMonth
            );

            console.log(`Found ${this.allExpenses.length} expense allocations`);

            // Apply filters
            this.applyFilters();

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
        // Calculate counts
        const uniqueLocations = new Set(this.allExpenses.map(e => e.locations?.location_code)).size;
        const overrideCount = this.allExpenses.filter(e => e.is_overridden).length;

        // Update cards
        document.getElementById('totalExpenseCount').textContent = this.expenses.length;
        document.getElementById('monthCount').textContent = this.currentMonth ? '1' : '0';
        document.getElementById('locationCount').textContent = uniqueLocations;
        document.getElementById('overrideCount').textContent = overrideCount;
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
                    <td class="clickable-cell" onclick="adjustedExpensesView.editOverride('${exp.id}', ${allocated}, event)" style="cursor: pointer; text-align: center;">
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

    async editOverride(expenseId, currentAllocated, event) {
        const expense = this.allExpenses.find(e => e.id === expenseId);
        if (!expense) return;

        // Position popup near click location
        const popup = document.getElementById('overrideEditPopup');
        const rect = event ? event.target.getBoundingClientRect() : { left: window.innerWidth / 2, top: window.innerHeight / 2 };

        popup.style.left = `${Math.min(rect.left, window.innerWidth - 320)}px`;
        popup.style.top = `${Math.min(rect.top + 30, window.innerHeight - 200)}px`;
        popup.style.display = 'block';

        // Update popup content
        document.getElementById('overrideEditTitle').textContent = `${expense.expense_category} (${expense.locations?.location_code})`;
        document.getElementById('overrideCurrentAmount').textContent = `$${parseFloat(currentAllocated).toLocaleString('en-US', {minimumFractionDigits: 2})}`;

        const input = document.getElementById('overrideEditInput');
        input.value = expense.override_allocated_amount || currentAllocated;
        input.focus();
        input.select();

        // Store expense ID for save handler
        popup.dataset.expenseId = expenseId;
    }

    setupOverridePopupListeners() {
        const popup = document.getElementById('overrideEditPopup');

        // Cancel button
        document.getElementById('overrideCancelBtn').addEventListener('click', () => {
            popup.style.display = 'none';
        });

        // Save button
        document.getElementById('overrideSaveBtn').addEventListener('click', async () => {
            const expenseId = popup.dataset.expenseId;
            const amount = parseFloat(document.getElementById('overrideEditInput').value);

            if (isNaN(amount) || amount < 0) {
                alert('Invalid amount');
                return;
            }

            try {
                await supabase.updateMonthlyExpenseOverride(expenseId, amount, null);
                popup.style.display = 'none';
                await this.loadExpenses(); // Reload to show changes
            } catch (error) {
                console.error('Error saving override:', error);
                alert('❌ Error saving override: ' + error.message);
            }
        });

        // Enter key to save
        document.getElementById('overrideEditInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('overrideSaveBtn').click();
            } else if (e.key === 'Escape') {
                popup.style.display = 'none';
            }
        });

        // Click outside to close
        document.addEventListener('click', (e) => {
            if (popup.style.display === 'block' && !popup.contains(e.target) && !e.target.closest('.clickable-cell')) {
                popup.style.display = 'none';
            }
        });
    }
}

// Export singleton instance
export const adjustedExpensesView = new AdjustedExpensesView();

// Make globally accessible for onclick handlers
window.adjustedExpensesView = adjustedExpensesView;
