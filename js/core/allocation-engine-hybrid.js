/**
 * HYBRID ALLOCATION ENGINE
 *
 * Implements NEW clean business logic while writing to OLD table structure
 * for FE compatibility.
 *
 * This is the replacement for processMonthlyAllocations() in allocation-engine.js
 */

/**
 * Process a single month for monthly allocated expenses - NEW CLEAN LOGIC
 *
 * @param {string} month - YYYY-MM format
 * @param {Array} mappings - QB category mappings with rules joined
 * @param {boolean} preserveOverrides - Keep manually overridden values
 */
async function processMonthlyAllocationsV2(month, mappings, preserveOverrides) {
    console.log(`\n📊 Processing ${month} with NEW LOGIC...`);
    const orgId = this.getOrganizationId();

    // Step 1: Load QB expenses (Bingo classes only)
    const { qbExpenses, qbTotal } = await this.loadQBExpensesForMonth(month);

    if (!qbExpenses || qbExpenses.length === 0) {
        console.log(`  ⏭️  No QB expenses for ${month}`);
        return 0;
    }

    console.log(`  💰 Found ${qbExpenses.length} QB transactions, total: $${qbTotal.toLocaleString()}`);

    // Step 2: Calculate bingo % for the month
    const { bingoPercentage, scSales, rwcSales, totalSales, scLocationId, rwcLocationId } =
        await this.calculateBingoPercentageV2(month);

    console.log(`  💰 Bingo % = ${bingoPercentage.toFixed(1)}%`);
    console.log(`  📊 SC: $${scSales.toLocaleString()}, RWC: $${rwcSales.toLocaleString()}, Total: $${totalSales.toLocaleString()}`);

    // Step 3: Group QB expenses by category
    const grouped = this.groupQBExpensesByCategory(qbExpenses, mappings);
    console.log(`  📦 Grouped into ${Object.keys(grouped).length} expense categories`);

    // Step 4: Calculate allocations for each category
    const allocatedExpenses = [];

    for (const [expenseCategory, data] of Object.entries(grouped)) {
        const { total, transactions, rule } = data;

        if (!rule) {
            console.log(`  ⚠️  No rule for "${expenseCategory}"`);
            continue;
        }

        // Skip Bingo COGS - derived value, not allocated
        if (expenseCategory === 'Bingo COGS') {
            console.log(`  ⏭️  Skipping ${expenseCategory} (derived from payouts)`);
            continue;
        }

        // Apply NEW CLEAN LOGIC
        const allocation = this.calculateCategoryAllocationV2(
            expenseCategory,
            total,
            transactions,
            rule,
            bingoPercentage,
            scSales,
            rwcSales,
            totalSales,
            scLocationId,
            rwcLocationId
        );

        allocatedExpenses.push(...allocation);

        console.log(`  ✅ ${expenseCategory}: QB=$${total.toFixed(2)} → SC=$${allocation.find(a => a.location_id === scLocationId)?.allocated_amount.toFixed(2) || 0}, RWC=$${allocation.find(a => a.location_id === rwcLocationId)?.allocated_amount.toFixed(2) || 0}`);
    }

    // Step 5: Preserve overrides
    if (preserveOverrides) {
        const preserved = await this.preserveOverrides(month, allocatedExpenses);
        console.log(`  🔒 Preserved ${preserved} overridden entries`);
    }

    // Step 6: Save to database
    await this.saveMonthlyAllocations(month, allocatedExpenses, preserveOverrides);
    console.log(`  ✅ Saved ${allocatedExpenses.length} allocations`);

    return allocatedExpenses.length;
}

/**
 * Load QB expenses for a month (Bingo classes only)
 */
async function loadQBExpensesForMonth(month) {
    const startDate = `${month}-01`;
    const [year, monthNum] = month.split('-');
    const lastDay = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
    const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;

    const { data: qbExpenses } = await this.supabase
        .from('qb_expenses')
        .select('*')
        .eq('organization_id', this.getOrganizationId())
        .in('qb_class', ['Bingo - SC', 'Bingo - RWC'])  // ONLY Bingo classes
        .gte('expense_date', startDate)
        .lte('expense_date', endDate);

    const qbTotal = (qbExpenses || []).reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

    return { qbExpenses: qbExpenses || [], qbTotal };
}

/**
 * Calculate bingo percentage: (SC sales + RWC sales) / total sales
 */
async function calculateBingoPercentageV2(month) {
    const sessions = await this.getSessions(month);

    // Get location IDs
    const { data: locations } = await this.supabase
        .from('locations')
        .select('id, short_name')
        .eq('organization_id', this.getOrganizationId());

    const scLoc = locations.find(l => l.short_name === 'SC');
    const rwcLoc = locations.find(l => l.short_name === 'RWC');

    let scSales = 0;
    let rwcSales = 0;
    let totalSales = 0;

    sessions.forEach(s => {
        const sales = parseFloat(s.total_sales || 0);
        totalSales += sales;

        if (s.location_id === scLoc?.id) {
            scSales += sales;
        } else if (s.location_id === rwcLoc?.id) {
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
        bingoSales,
        scLocationId: scLoc?.id,
        rwcLocationId: rwcLoc?.id
    };
}

/**
 * Calculate allocation for a single expense category using NEW CLEAN LOGIC
 * Returns array of allocations (one per location)
 */
function calculateCategoryAllocationV2(
    expenseCategory,
    qbTotal,
    transactions,
    rule,
    bingoPercentage,
    scSales,
    rwcSales,
    totalSales,
    scLocationId,
    rwcLocationId
) {
    const allocations = [];
    const bingoSales = scSales + rwcSales;

    // Determine allocation approach based on rule flags
    if (rule.uses_qb_class_split) {
        // NEW LOGIC: Use QB's class split directly
        return this.allocateUsingQBClassSplit(
            expenseCategory, qbTotal, transactions, rule,
            scLocationId, rwcLocationId
        );
    } else if (rule.fixed_sc_percentage !== null && rule.fixed_rwc_percentage !== null) {
        // NEW LOGIC: Fixed percentages (Insurance)
        return this.allocateUsingFixedPercentages(
            expenseCategory, qbTotal, transactions, rule,
            scLocationId, rwcLocationId
        );
    } else if (rule.location_split_method === 'SC_ONLY') {
        // NEW LOGIC: 100% to SC (Janitorial)
        return this.allocateToSCOnly(
            expenseCategory, qbTotal, transactions, rule,
            bingoPercentage, scLocationId
        );
    } else {
        // NEW LOGIC: Revenue split (most expenses)
        return this.allocateByRevenueSplit(
            expenseCategory, qbTotal, transactions, rule,
            bingoPercentage, scSales, rwcSales, bingoSales,
            scLocationId, rwcLocationId
        );
    }
}

/**
 * Allocate using QB's class split (Hourly, Payroll Taxes, Rent, Security)
 */
function allocateUsingQBClassSplit(
    expenseCategory, qbTotal, transactions, rule,
    scLocationId, rwcLocationId
) {
    // Group transactions by QB class
    let scAmount = 0;
    let rwcAmount = 0;

    transactions.forEach(t => {
        const amount = parseFloat(t.amount || 0);
        if (t.qb_class === 'Bingo - SC') {
            scAmount += amount;
        } else if (t.qb_class === 'Bingo - RWC') {
            rwcAmount += amount;
        }
    });

    // Apply QB percentage (e.g., Payroll Taxes = 50%)
    const qbPercent = rule.qb_percentage / 100;
    scAmount *= qbPercent;
    rwcAmount *= qbPercent;

    const scSplit = qbTotal > 0 ? (scAmount / qbTotal) * 100 : 0;
    const rwcSplit = qbTotal > 0 ? (rwcAmount / qbTotal) * 100 : 0;

    return [
        {
            organization_id: this.getOrganizationId(),
            month: `${month}-01`,
            location_id: scLocationId,
            expense_category: expenseCategory,
            qb_total_amount: qbTotal,
            qb_transaction_count: transactions.length,
            qb_source_data: this.buildQBSourceData(transactions),
            allocation_rule_id: rule.id,
            allocation_method: rule.allocation_method,
            location_split_percent: scSplit,
            allocated_amount: scAmount,
            bingo_percentage: rule.bingo_percentage,
            bingo_amount: scAmount,  // Already filtered to Bingo classes
            is_overridden: false,
            rules_applied_at: new Date().toISOString()
        },
        {
            organization_id: this.getOrganizationId(),
            month: `${month}-01`,
            location_id: rwcLocationId,
            expense_category: expenseCategory,
            qb_total_amount: qbTotal,
            qb_transaction_count: transactions.length,
            qb_source_data: this.buildQBSourceData(transactions),
            allocation_rule_id: rule.id,
            allocation_method: rule.allocation_method,
            location_split_percent: rwcSplit,
            allocated_amount: rwcAmount,
            bingo_percentage: rule.bingo_percentage,
            bingo_amount: rwcAmount,  // Already filtered to Bingo classes
            is_overridden: false,
            rules_applied_at: new Date().toISOString()
        }
    ];
}

/**
 * Allocate using fixed percentages (Insurance only)
 */
function allocateUsingFixedPercentages(
    expenseCategory, qbTotal, transactions, rule,
    scLocationId, rwcLocationId
) {
    const scAmount = qbTotal * (rule.fixed_sc_percentage / 100);
    const rwcAmount = qbTotal * (rule.fixed_rwc_percentage / 100);

    return [
        {
            organization_id: this.getOrganizationId(),
            month: `${month}-01`,
            location_id: scLocationId,
            expense_category: expenseCategory,
            qb_total_amount: qbTotal,
            qb_transaction_count: transactions.length,
            qb_source_data: this.buildQBSourceData(transactions),
            allocation_rule_id: rule.id,
            allocation_method: rule.allocation_method,
            location_split_percent: rule.fixed_sc_percentage,
            allocated_amount: scAmount,
            bingo_percentage: rule.bingo_percentage,
            bingo_amount: scAmount,  // No bingo % applied for fixed percentages
            is_overridden: false,
            rules_applied_at: new Date().toISOString()
        },
        {
            organization_id: this.getOrganizationId(),
            month: `${month}-01`,
            location_id: rwcLocationId,
            expense_category: expenseCategory,
            qb_total_amount: qbTotal,
            qb_transaction_count: transactions.length,
            qb_source_data: this.buildQBSourceData(transactions),
            allocation_rule_id: rule.id,
            allocation_method: rule.allocation_method,
            location_split_percent: rule.fixed_rwc_percentage,
            allocated_amount: rwcAmount,
            bingo_percentage: rule.bingo_percentage,
            bingo_amount: rwcAmount,  // No bingo % applied for fixed percentages
            is_overridden: false,
            rules_applied_at: new Date().toISOString()
        }
    ];
}

/**
 * Allocate 100% to SC only (Janitorial)
 */
function allocateToSCOnly(
    expenseCategory, qbTotal, transactions, rule,
    bingoPercentage, scLocationId
) {
    const adjustedTotal = qbTotal * (rule.qb_percentage / 100);
    const bingoAmount = adjustedTotal * (bingoPercentage / 100);

    return [
        {
            organization_id: this.getOrganizationId(),
            month: `${month}-01`,
            location_id: scLocationId,
            expense_category: expenseCategory,
            qb_total_amount: qbTotal,
            qb_transaction_count: transactions.length,
            qb_source_data: this.buildQBSourceData(transactions),
            allocation_rule_id: rule.id,
            allocation_method: rule.allocation_method,
            location_split_percent: 100,
            allocated_amount: bingoAmount,
            bingo_percentage: bingoPercentage,
            bingo_amount: bingoAmount,
            is_overridden: false,
            rules_applied_at: new Date().toISOString()
        }
    ];
}

/**
 * Allocate by revenue split (most expenses)
 */
function allocateByRevenueSplit(
    expenseCategory, qbTotal, transactions, rule,
    bingoPercentage, scSales, rwcSales, bingoSales,
    scLocationId, rwcLocationId
) {
    // Apply QB percentage adjustment (e.g., Utilities = 85%)
    const adjustedTotal = qbTotal * (rule.qb_percentage / 100);

    // Apply bingo percentage
    const bingoAmount = adjustedTotal * (bingoPercentage / 100);

    // Split by revenue
    const scAmount = bingoSales > 0 ? bingoAmount * (scSales / bingoSales) : 0;
    const rwcAmount = bingoSales > 0 ? bingoAmount * (rwcSales / bingoSales) : 0;

    const scSplit = bingoSales > 0 ? (scSales / bingoSales) * 100 : 0;
    const rwcSplit = bingoSales > 0 ? (rwcSales / bingoSales) * 100 : 0;

    return [
        {
            organization_id: this.getOrganizationId(),
            month: `${month}-01`,
            location_id: scLocationId,
            expense_category: expenseCategory,
            qb_total_amount: qbTotal,
            qb_transaction_count: transactions.length,
            qb_source_data: this.buildQBSourceData(transactions),
            allocation_rule_id: rule.id,
            allocation_method: rule.allocation_method,
            location_split_percent: scSplit,
            allocated_amount: scAmount,
            bingo_percentage: bingoPercentage,
            bingo_amount: scAmount,
            is_overridden: false,
            rules_applied_at: new Date().toISOString()
        },
        {
            organization_id: this.getOrganizationId(),
            month: `${month}-01`,
            location_id: rwcLocationId,
            expense_category: expenseCategory,
            qb_total_amount: qbTotal,
            qb_transaction_count: transactions.length,
            qb_source_data: this.buildQBSourceData(transactions),
            allocation_rule_id: rule.id,
            allocation_method: rule.allocation_method,
            location_split_percent: rwcSplit,
            allocated_amount: rwcAmount,
            bingo_percentage: bingoPercentage,
            bingo_amount: rwcAmount,
            is_overridden: false,
            rules_applied_at: new Date().toISOString()
        }
    ];
}

/**
 * Build QB source data JSONB array
 */
function buildQBSourceData(transactions) {
    return transactions.map(t => ({
        date: t.expense_date,
        qb_category: t.qb_category,
        qb_class: t.qb_class,
        amount: t.amount,
        description: t.description,
        vendor: t.vendor,
        qb_expense_id: t.id
    }));
}

/**
 * Save monthly allocations to database
 */
async function saveMonthlyAllocations(month, allocations, preserveOverrides) {
    const orgId = this.getOrganizationId();

    // Delete old allocations (except overridden ones if preserving)
    const deleteQuery = this.supabase
        .from('monthly_allocated_expenses')
        .delete()
        .eq('organization_id', orgId)
        .eq('month', `${month}-01`);

    if (preserveOverrides) {
        deleteQuery.neq('is_overridden', true);
    }

    await deleteQuery;

    // Insert new allocations
    if (allocations.length > 0) {
        const { error } = await this.supabase
            .from('monthly_allocated_expenses')
            .insert(allocations);

        if (error) throw error;
    }
}

// Export functions to replace in allocation-engine.js
export {
    processMonthlyAllocationsV2,
    loadQBExpensesForMonth,
    calculateBingoPercentageV2,
    calculateCategoryAllocationV2,
    allocateUsingQBClassSplit,
    allocateUsingFixedPercentages,
    allocateToSCOnly,
    allocateByRevenueSplit,
    buildQBSourceData,
    saveMonthlyAllocations
};
