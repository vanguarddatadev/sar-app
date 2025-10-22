/**
 * ALLOCATION ENGINE V2 - Clean Rebuild
 * Handles QB → Adjusted Monthly expense allocation
 *
 * Flow:
 * 1. Load QB expenses for month (filtered to Bingo classes only)
 * 2. Load allocation rules
 * 3. Calculate bingo % for month
 * 4. For each expense category, apply allocation method
 * 5. Save to adjusted_monthly_expenses
 */

import { supabase } from './supabase.js';

export class AllocationEngineV2 {
    constructor(organizationId) {
        this.organizationId = organizationId;
    }

    /**
     * Calculate adjusted monthly expenses for a given month
     * @param {string} month - Format: 'YYYY-MM'
     */
    async calculateAdjustedMonthly(month) {
        console.log(`🔄 Calculating Adjusted Monthly for ${month}...`);

        try {
            // Step 1: Load QB expenses for the month (Bingo classes only)
            const qbExpenses = await this.loadQBExpenses(month);
            console.log(`   📊 Loaded ${qbExpenses.length} QB expense transactions`);

            // Step 2: Load allocation rules and mappings
            const { rules, mappings } = await this.loadAllocationRules();
            console.log(`   📋 Loaded ${Object.keys(rules).length} allocation rules, ${mappings.length} QB mappings`);

            // Step 3: Calculate bingo % for the month
            const { bingoPercentage, scSales, rwcSales, totalSales } = await this.calculateBingoPercentage(month);
            console.log(`   💰 Bingo % = ${bingoPercentage.toFixed(1)}% (SC: $${scSales.toLocaleString()}, RWC: $${rwcSales.toLocaleString()}, Total: $${totalSales.toLocaleString()})`);

            // Step 4: Group QB expenses by expense category
            const qbByCategory = this.groupQBByCategory(qbExpenses, mappings);
            console.log(`   📦 Grouped QB expenses into ${Object.keys(qbByCategory).length} categories`);

            // Step 5: Calculate allocations for each expense category
            const allocations = [];
            for (const [expenseCategory, categoryData] of Object.entries(qbByCategory)) {
                const rule = rules[expenseCategory];
                if (!rule) {
                    console.warn(`   ⚠️  No allocation rule for category: ${expenseCategory}`);
                    continue;
                }

                const allocation = await this.allocateCategory(
                    expenseCategory,
                    categoryData,
                    rule,
                    bingoPercentage,
                    scSales,
                    rwcSales,
                    totalSales
                );

                allocations.push(allocation);
                console.log(`   ✅ ${expenseCategory}: QB=$${allocation.qb_total.toFixed(2)}, SC=$${allocation.sc_amount.toFixed(2)}, RWC=$${allocation.rwc_amount.toFixed(2)}`);
            }

            // Step 6: Save allocations to adjusted_monthly_expenses
            await this.saveAllocations(month, allocations);
            console.log(`✅ Saved ${allocations.length} allocations for ${month}`);

            return {
                success: true,
                month,
                allocations,
                bingoPercentage,
                scSales,
                rwcSales,
                totalSales
            };

        } catch (error) {
            console.error('❌ Error calculating adjusted monthly:', error);
            throw error;
        }
    }

    /**
     * Load QB expenses for a month (Bingo classes only)
     */
    async loadQBExpenses(month) {
        const startDate = `${month}-01`;
        const [year, monthNum] = month.split('-');
        const lastDay = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
        const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;

        const { data, error } = await supabase.client
            .from('qb_expenses')
            .select('*')
            .eq('organization_id', this.organizationId)
            .gte('expense_date', startDate)
            .lte('expense_date', endDate)
            .in('qb_class', ['Bingo - SC', 'Bingo - RWC']);  // Only Bingo classes

        if (error) throw error;
        return data || [];
    }

    /**
     * Load allocation rules and QB category mappings
     */
    async loadAllocationRules() {
        // Load rules
        const { data: rulesData, error: rulesError } = await supabase.client
            .from('expense_allocation_rules')
            .select('*')
            .eq('organization_id', this.organizationId);

        if (rulesError) throw rulesError;

        // Convert to lookup: expense_category => rule
        const rules = {};
        (rulesData || []).forEach(r => {
            rules[r.expense_category] = r;
        });

        // Load mappings
        const { data: mappings, error: mappingsError } = await supabase.client
            .from('qb_category_mapping')
            .select('*')
            .eq('organization_id', this.organizationId);

        if (mappingsError) throw mappingsError;

        return { rules, mappings: mappings || [] };
    }

    /**
     * Calculate bingo percentage for the month
     * Bingo % = (SC sales + RWC sales) / Total sales (all locations)
     */
    async calculateBingoPercentage(month) {
        const startDate = `${month}-01`;
        const [year, monthNum] = month.split('-');
        const lastDay = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
        const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;

        // Get all sessions for the month
        const { data: sessions, error } = await supabase.client
            .from('sessions')
            .select('location_id, total_sales')
            .eq('organization_id', this.organizationId)
            .gte('session_date', startDate)
            .lte('session_date', endDate);

        if (error) throw error;

        // Get location info to identify SC and RWC
        const { data: locations } = await supabase.client
            .from('locations')
            .select('id, short_name')
            .eq('organization_id', this.organizationId);

        const locationLookup = {};
        (locations || []).forEach(loc => {
            locationLookup[loc.id] = loc.short_name;
        });

        // Calculate sales by location
        let scSales = 0;
        let rwcSales = 0;
        let totalSales = 0;

        (sessions || []).forEach(s => {
            const sales = parseFloat(s.total_sales || 0);
            totalSales += sales;

            const locName = locationLookup[s.location_id];
            if (locName === 'SC') {
                scSales += sales;
            } else if (locName === 'RWC') {
                rwcSales += sales;
            }
        });

        const bingoSales = scSales + rwcSales;
        const bingoPercentage = totalSales > 0 ? (bingoSales / totalSales) * 100 : 0;

        return {
            bingoPercentage,
            scSales,
            rwcSales,
            totalSales,
            bingoSales
        };
    }

    /**
     * Group QB expenses by expense category
     * Returns: { expense_category: { total, byClass: {SC: amount, RWC: amount}, qbCategories: [...] } }
     */
    groupQBByCategory(qbExpenses, mappings) {
        const grouped = {};

        qbExpenses.forEach(expense => {
            // Find mapping for this QB category
            const mapping = mappings.find(m => m.qb_category_name === expense.qb_category);
            if (!mapping) return;  // Skip unmapped categories

            const expenseCategory = mapping.expense_category;
            const amount = parseFloat(expense.amount || 0);
            const qbClass = expense.qb_class;

            if (!grouped[expenseCategory]) {
                grouped[expenseCategory] = {
                    total: 0,
                    byClass: { 'Bingo - SC': 0, 'Bingo - RWC': 0 },
                    qbCategories: new Set()
                };
            }

            grouped[expenseCategory].total += amount;
            grouped[expenseCategory].byClass[qbClass] = (grouped[expenseCategory].byClass[qbClass] || 0) + amount;
            grouped[expenseCategory].qbCategories.add(expense.qb_category);
        });

        // Convert qbCategories Set to Array
        Object.values(grouped).forEach(g => {
            g.qbCategories = Array.from(g.qbCategories);
        });

        return grouped;
    }

    /**
     * Allocate a single expense category using its allocation rule
     */
    async allocateCategory(expenseCategory, categoryData, rule, bingoPercentage, scSales, rwcSales, totalSales) {
        const qbTotal = categoryData.total;
        let scAmount = 0;
        let rwcAmount = 0;

        // Apply QB percentage adjustment first
        let adjustedTotal = qbTotal * (rule.qb_percentage / 100);

        // Apply allocation method
        switch (rule.allocation_method) {
            case 'qb_class_split':
                // Use QB's class split directly
                scAmount = categoryData.byClass['Bingo - SC'] || 0;
                rwcAmount = categoryData.byClass['Bingo - RWC'] || 0;

                // Apply QB percentage if needed (e.g., Payroll Taxes = 50%)
                // Special case: check if this category contains "Payroll Taxes"
                if (categoryData.qbCategories.includes('Payroll Taxes')) {
                    scAmount *= 0.5;  // 50% for Payroll Taxes
                    rwcAmount *= 0.5;
                }
                break;

            case 'revenue_split':
                // Apply bingo %, then split by revenue
                const bingoAmount = adjustedTotal * (bingoPercentage / 100);
                const bingoSales = scSales + rwcSales;

                if (bingoSales > 0) {
                    scAmount = bingoAmount * (scSales / bingoSales);
                    rwcAmount = bingoAmount * (rwcSales / bingoSales);
                }
                break;

            case 'fixed_percentages':
                // Use fixed percentages (Insurance only)
                scAmount = qbTotal * (rule.fixed_sc_percentage / 100);
                rwcAmount = qbTotal * (rule.fixed_rwc_percentage / 100);
                break;

            case 'sc_only':
                // 100% to SC (Janitorial only)
                const scOnlyAmount = adjustedTotal * (bingoPercentage / 100);
                scAmount = scOnlyAmount;
                rwcAmount = 0;
                break;

            default:
                console.warn(`Unknown allocation method: ${rule.allocation_method}`);
        }

        return {
            expense_category: expenseCategory,
            qb_total: qbTotal,
            allocated_amount: scAmount + rwcAmount,
            sc_amount: scAmount,
            rwc_amount: rwcAmount,
            allocation_method: rule.allocation_method,
            qb_percentage: rule.qb_percentage,
            is_overridden: false
        };
    }

    /**
     * Save allocations to adjusted_monthly_expenses table
     */
    async saveAllocations(month, allocations) {
        const monthDate = `${month}-01`;

        // Delete existing allocations for this month
        const { error: deleteError } = await supabase.client
            .from('adjusted_monthly_expenses')
            .delete()
            .eq('organization_id', this.organizationId)
            .eq('month', monthDate)
            .eq('is_overridden', false);  // Only delete non-overridden allocations

        if (deleteError) {
            console.error('Error deleting old allocations:', deleteError);
            throw deleteError;
        }

        // Insert new allocations
        const rows = allocations.map(a => ({
            organization_id: this.organizationId,
            month: monthDate,
            expense_category: a.expense_category,
            qb_total: a.qb_total,
            allocated_amount: a.allocated_amount,
            sc_amount: a.sc_amount,
            rwc_amount: a.rwc_amount,
            is_overridden: false
        }));

        const { error: insertError } = await supabase.client
            .from('adjusted_monthly_expenses')
            .insert(rows);

        if (insertError) {
            console.error('Error inserting allocations:', insertError);
            throw insertError;
        }
    }

    /**
     * Calculate allocations for all months that have QB data
     */
    async calculateAllMonths() {
        // Get all unique months from QB expenses
        const { data: months, error } = await supabase.client
            .from('qb_expenses')
            .select('expense_date')
            .eq('organization_id', this.organizationId);

        if (error) throw error;

        // Extract unique YYYY-MM values
        const uniqueMonths = new Set();
        (months || []).forEach(m => {
            if (m.expense_date) {
                const month = m.expense_date.substring(0, 7);  // 'YYYY-MM'
                uniqueMonths.add(month);
            }
        });

        const monthsList = Array.from(uniqueMonths).sort();
        console.log(`🔄 Calculating allocations for ${monthsList.length} months...`);

        const results = [];
        for (const month of monthsList) {
            try {
                const result = await this.calculateAdjustedMonthly(month);
                results.push(result);
            } catch (error) {
                console.error(`❌ Error calculating ${month}:`, error);
                results.push({ success: false, month, error: error.message });
            }
        }

        return results;
    }
}
