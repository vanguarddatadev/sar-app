/**
 * Allocation Engine
 *
 * Processes QB imports and spreadsheet actuals through allocation rules
 * to generate monthly forecasts and session-level expense allocations.
 *
 * Two parallel output paths:
 * 1. Monthly Forecast (user-modifiable) - for monthly reporting
 * 2. Session Allocated Expenses (pure calculation) - for per-session P&L
 */

export class AllocationEngine {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
        this.currentOrgId = null;
    }

    /**
     * Set the current organization context
     */
    setOrganization(organizationId) {
        this.currentOrgId = organizationId;
    }

    /**
     * Get current organization ID
     */
    getOrganizationId() {
        if (!this.currentOrgId) {
            throw new Error('Organization not set. Call setOrganization() first.');
        }
        return this.currentOrgId;
    }

    // ========================================
    // ALLOCATION RULES
    // ========================================

    /**
     * Get all allocation rules for current organization
     */
    async getAllocationRules() {
        const { data, error } = await this.supabase
            .from('allocation_rules')
            .select('*')
            .eq('organization_id', this.getOrganizationId())
            .order('expense_category');

        if (error) throw error;
        return data || [];
    }

    /**
     * Get single allocation rule by category
     */
    async getAllocationRule(category) {
        const { data, error } = await this.supabase
            .from('allocation_rules')
            .select('*')
            .eq('organization_id', this.getOrganizationId())
            .eq('bingo_category', category)
            .single();

        if (error) throw error;
        return data;
    }

    // ========================================
    // MONTHLY EXPENSE DATA
    // ========================================

    /**
     * Get QB imports for a specific month
     */
    async getQBImports(month) {
        const { data, error } = await this.supabase
            .from('qb_monthly_imports')
            .select('*')
            .eq('organization_id', this.getOrganizationId())
            .eq('month', month);

        if (error) throw error;
        return data || [];
    }

    /**
     * Get spreadsheet actuals for a specific month
     */
    async getSpreadsheetActuals(month) {
        const { data, error } = await this.supabase
            .from('spreadsheet_monthly_actuals')
            .select('*')
            .eq('organization_id', this.getOrganizationId())
            .eq('month', month);

        if (error) throw error;
        return data || [];
    }

    /**
     * Get expense amount for a category from QB data
     */
    getQBExpenseAmount(qbImports, accountNumbers) {
        if (!accountNumbers || accountNumbers.length === 0) return 0;

        return qbImports
            .filter(item => accountNumbers.includes(item.account_number))
            .reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    }

    /**
     * Get expense amount for a category from spreadsheet data
     */
    getSpreadsheetExpenseAmount(spreadsheetActuals, category, location = null) {
        let filtered = spreadsheetActuals.filter(item =>
            item.category === category
        );

        if (location) {
            filtered = filtered.filter(item => item.location === location);
        }

        return filtered.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    }

    // ========================================
    // SESSION DATA
    // ========================================

    /**
     * Get sessions for a specific month
     */
    async getSessions(month) {
        // Parse month (YYYY-MM format)
        const startDate = `${month}-01`;
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);
        const endDateStr = endDate.toISOString().split('T')[0];

        const { data, error } = await this.supabase
            .from('sessions')
            .select('*')
            .eq('organization_id', this.getOrganizationId())
            .gte('session_date', startDate)
            .lt('session_date', endDateStr)
            .order('session_date');

        if (error) throw error;
        return data || [];
    }

    /**
     * Calculate total revenue for a month by location
     */
    calculateMonthlyRevenue(sessions, location = null) {
        let filtered = sessions;
        if (location) {
            filtered = sessions.filter(s => s.location === location);
        }

        return filtered.reduce((sum, session) =>
            sum + (parseFloat(session.total_sales) || 0), 0
        );
    }

    /**
     * Count sessions in a month by location
     */
    countSessions(sessions, location = null) {
        if (location) {
            return sessions.filter(s => s.location === location).length;
        }
        return sessions.length;
    }

    // ========================================
    // ALLOCATION LOGIC
    // ========================================

    /**
     * Step 1: Apply Bingo percentage filter
     */
    applyBingoPercentage(totalExpense, bingoPercentage) {
        return totalExpense * (bingoPercentage / 100);
    }

    /**
     * Step 2: Split between locations
     * Returns { SC: amount, RWC: amount }
     */
    splitByLocation(bingoExpense, rule, sessions) {
        const method = rule.location_split_method;

        // LOCATION_ONLY: All to one location
        if (method === 'LOCATION_ONLY') {
            const location = rule.location_filter;
            return {
                SC: location === 'SC' ? bingoExpense : 0,
                RWC: location === 'RWC' ? bingoExpense : 0
            };
        }

        // FIXED_PERCENT: Use fixed percentages
        if (method === 'FIXED_PERCENT') {
            return {
                SC: bingoExpense * ((rule.sc_fixed_percent || 0) / 100),
                RWC: bingoExpense * ((rule.rwc_fixed_percent || 0) / 100)
            };
        }

        // BY_REVENUE: Split proportional to revenue
        if (method === 'BY_REVENUE') {
            const scRevenue = this.calculateMonthlyRevenue(sessions, 'SC');
            const rwcRevenue = this.calculateMonthlyRevenue(sessions, 'RWC');
            const totalRevenue = scRevenue + rwcRevenue;

            if (totalRevenue === 0) {
                return { SC: 0, RWC: 0 };
            }

            return {
                SC: bingoExpense * (scRevenue / totalRevenue),
                RWC: bingoExpense * (rwcRevenue / totalRevenue)
            };
        }

        throw new Error(`Unknown location split method: ${method}`);
    }

    /**
     * Step 3: Allocate location expense to sessions
     * Returns array of { session_id, allocated_amount, calculation_notes }
     */
    allocateToSessions(locationExpense, location, rule, sessions) {
        const method = rule.allocation_method;
        const locationSessions = sessions.filter(s => s.location === location);

        if (locationSessions.length === 0) {
            return [];
        }

        // BY_SESSION_COUNT: Divide equally
        if (method === 'BY_SESSION_COUNT') {
            const amountPerSession = locationExpense / locationSessions.length;
            return locationSessions.map(session => ({
                session_id: session.id,
                allocated_amount: amountPerSession,
                session_revenue: parseFloat(session.total_sales) || 0,
                calculation_notes: `Equal split: $${locationExpense.toFixed(2)} ÷ ${locationSessions.length} sessions`
            }));
        }

        // FIXED_PER_SESSION: Fixed amount per session
        if (method === 'FIXED_PER_SESSION') {
            const fixedAmount = rule.fixed_amount_per_session || 0;
            return locationSessions.map(session => ({
                session_id: session.id,
                allocated_amount: fixedAmount,
                session_revenue: parseFloat(session.total_sales) || 0,
                calculation_notes: `Fixed: $${fixedAmount} per session`
            }));
        }

        // BY_REVENUE: Split proportional to revenue
        if (method === 'BY_REVENUE') {
            const totalRevenue = locationSessions.reduce((sum, s) =>
                sum + (parseFloat(s.total_sales) || 0), 0
            );

            if (totalRevenue === 0) {
                return locationSessions.map(session => ({
                    session_id: session.id,
                    allocated_amount: 0,
                    session_revenue: 0,
                    calculation_notes: 'No revenue to allocate by'
                }));
            }

            return locationSessions.map(session => {
                const sessionRevenue = parseFloat(session.total_sales) || 0;
                const revenuePercent = sessionRevenue / totalRevenue;
                const allocatedAmount = locationExpense * revenuePercent;

                return {
                    session_id: session.id,
                    allocated_amount: allocatedAmount,
                    session_revenue: sessionRevenue,
                    total_month_revenue: totalRevenue,
                    revenue_percentage: revenuePercent,
                    calculation_notes: `Revenue split: $${sessionRevenue.toFixed(2)} / $${totalRevenue.toFixed(2)} = ${(revenuePercent * 100).toFixed(2)}%`
                };
            });
        }

        throw new Error(`Unknown allocation method: ${method}`);
    }

    // ========================================
    // PROCESS MONTH
    // ========================================

    /**
     * Process all allocations for a specific month
     * Generates both monthly forecasts and session allocations
     */
    async processMonth(month) {
        console.log(`🔄 Processing allocations for ${month}...`);

        // Get all required data
        const [rules, qbImports, spreadsheetActuals, sessions] = await Promise.all([
            this.getAllocationRules(),
            this.getQBImports(month),
            this.getSpreadsheetActuals(month),
            this.getSessions(month)
        ]);

        console.log(`  📋 ${rules.length} rules`);
        console.log(`  💰 ${qbImports.length} QB imports`);
        console.log(`  📊 ${spreadsheetActuals.length} spreadsheet actuals`);
        console.log(`  🎯 ${sessions.length} sessions`);

        if (sessions.length === 0) {
            console.warn(`⚠️  No sessions found for ${month}. Skipping allocation.`);
            return { monthlyForecasts: [], sessionAllocations: [] };
        }

        const monthlyForecasts = [];
        const sessionAllocations = [];

        // Process each allocation rule
        for (const rule of rules) {
            console.log(`  Processing: ${rule.display_name}...`);

            // Get total expense from QB or spreadsheet
            let totalExpense = 0;
            if (rule.use_spreadsheet) {
                totalExpense = this.getSpreadsheetExpenseAmount(
                    spreadsheetActuals,
                    rule.bingo_category
                );
            } else {
                totalExpense = this.getQBExpenseAmount(qbImports, rule.qb_account_numbers);
            }

            if (totalExpense === 0) {
                console.log(`    ⏭️  No expense data for ${rule.bingo_category}`);
                continue;
            }

            console.log(`    Total expense: $${totalExpense.toFixed(2)}`);

            // Step 1: Apply Bingo percentage
            const bingoExpense = this.applyBingoPercentage(totalExpense, rule.bingo_percentage);
            console.log(`    Bingo portion (${rule.bingo_percentage}%): $${bingoExpense.toFixed(2)}`);

            // Step 2: Split by location
            const locationSplit = this.splitByLocation(bingoExpense, rule, sessions);
            console.log(`    SC: $${locationSplit.SC.toFixed(2)}, RWC: $${locationSplit.RWC.toFixed(2)}`);

            // Add to monthly forecasts
            if (locationSplit.SC > 0) {
                monthlyForecasts.push({
                    month,
                    location: 'SC',
                    category: rule.bingo_category,
                    forecasted_amount: locationSplit.SC,
                    source: rule.use_spreadsheet ? 'SPREADSHEET' : 'QB'
                });
            }

            if (locationSplit.RWC > 0) {
                monthlyForecasts.push({
                    month,
                    location: 'RWC',
                    category: rule.bingo_category,
                    forecasted_amount: locationSplit.RWC,
                    source: rule.use_spreadsheet ? 'SPREADSHEET' : 'QB'
                });
            }

            // Step 3: Allocate to sessions
            const scAllocations = this.allocateToSessions(locationSplit.SC, 'SC', rule, sessions);
            const rwcAllocations = this.allocateToSessions(locationSplit.RWC, 'RWC', rule, sessions);

            // Add to session allocations
            [...scAllocations, ...rwcAllocations].forEach(allocation => {
                sessionAllocations.push({
                    session_id: allocation.session_id,
                    category: rule.bingo_category,
                    allocated_amount: allocation.allocated_amount,
                    allocation_rule_id: rule.id,
                    source_month: month,
                    allocation_method: rule.allocation_method,
                    total_month_expense: totalExpense,
                    session_revenue: allocation.session_revenue,
                    total_month_revenue: allocation.total_month_revenue || null,
                    revenue_percentage: allocation.revenue_percentage || null,
                    calculation_notes: allocation.calculation_notes
                });
            });

            console.log(`    ✅ Allocated to ${scAllocations.length + rwcAllocations.length} sessions`);
        }

        return { monthlyForecasts, sessionAllocations };
    }

    // ========================================
    // SAVE TO DATABASE
    // ========================================

    /**
     * Save monthly forecasts to database
     */
    async saveMonthlyForecasts(forecasts) {
        if (forecasts.length === 0) return [];

        // Add organization_id to each forecast
        const forecastsWithOrg = forecasts.map(f => ({
            ...f,
            organization_id: this.getOrganizationId()
        }));

        const { data, error } = await this.supabase
            .from('monthly_forecast')
            .upsert(forecastsWithOrg, {
                onConflict: 'organization_id,month,location,category'
            })
            .select();

        if (error) throw error;
        return data;
    }

    /**
     * Save session allocations to database
     */
    async saveSessionAllocations(allocations) {
        if (allocations.length === 0) return [];

        // Add organization_id to each allocation
        const allocationsWithOrg = allocations.map(a => ({
            ...a,
            organization_id: this.getOrganizationId()
        }));

        // Delete existing allocations for these sessions first
        const sessionIds = [...new Set(allocations.map(a => a.session_id))];

        const { error: deleteError } = await this.supabase
            .from('session_allocated_expenses')
            .delete()
            .in('session_id', sessionIds);

        if (deleteError) throw deleteError;

        // Insert new allocations
        const { data, error } = await this.supabase
            .from('session_allocated_expenses')
            .insert(allocationsWithOrg)
            .select();

        if (error) throw error;
        return data;
    }

    /**
     * Process and save a month's allocations
     */
    async processAndSaveMonth(month) {
        const result = await this.processMonth(month);

        const [forecasts, allocations] = await Promise.all([
            this.saveMonthlyForecasts(result.monthlyForecasts),
            this.saveSessionAllocations(result.sessionAllocations)
        ]);

        console.log(`✅ Saved ${forecasts.length} monthly forecasts and ${allocations.length} session allocations`);

        return {
            monthlyForecasts: forecasts,
            sessionAllocations: allocations
        };
    }

    // ========================================
    // QUERIES
    // ========================================

    /**
     * Get monthly forecast (with user modifications if any)
     */
    async getMonthlyForecast(month, location = null) {
        let query = this.supabase
            .from('monthly_forecast')
            .select(`
                *,
                modified:monthly_forecast_modified(modified_amount, reason, modified_by, modified_at)
            `)
            .eq('organization_id', this.getOrganizationId())
            .eq('month', month);

        if (location) {
            query = query.eq('location', location);
        }

        const { data, error } = await query;
        if (error) throw error;

        // Merge modified amounts
        return (data || []).map(row => ({
            ...row,
            final_amount: row.modified?.[0]?.modified_amount || row.forecasted_amount,
            is_modified: !!row.modified?.[0]
        }));
    }

    /**
     * Get session allocated expenses
     */
    async getSessionAllocations(sessionId) {
        const { data, error } = await this.supabase
            .from('session_allocated_expenses')
            .select('*')
            .eq('session_id', sessionId)
            .order('category');

        if (error) throw error;
        return data || [];
    }

    // ========================================
    // MONTHLY ALLOCATED EXPENSES (NEW SYSTEM)
    // ========================================

    /**
     * Apply allocation rules for monthly allocated expenses
     * This generates the monthly_allocated_expenses table from qb_expenses
     */
    async applyMonthlyAllocationRules(month = null, preserveOverrides = true) {
        console.log(`🔄 Applying monthly allocation rules${month ? ` for ${month}` : ' for all months'}...`);

        try {
            const orgId = this.getOrganizationId();

            // Get QB category mappings with allocation rules
            const { data: mappings, error: mappingError } = await this.supabase
                .from('qb_category_mapping')
                .select(`
                    *,
                    allocation_rules(*)
                `)
                .eq('organization_id', orgId)
                .eq('is_active', true);

            if (mappingError) throw mappingError;
            console.log(`📋 Found ${mappings.length} category mappings`);

            // Determine which months to process
            let monthsToProcess = [];
            if (month) {
                monthsToProcess = [month];
            } else {
                // Get all months with QB expense data
                const { data: expenses } = await this.supabase
                    .from('qb_expenses')
                    .select('expense_date')
                    .eq('organization_id', orgId);

                const uniqueMonths = [...new Set(
                    expenses.map(e => e.expense_date.substring(0, 7))
                )].sort();
                monthsToProcess = uniqueMonths;
            }

            console.log(`📅 Processing ${monthsToProcess.length} months:`, monthsToProcess);

            // Process each month
            let totalCreated = 0;
            for (const processMonth of monthsToProcess) {
                const count = await this.processMonthlyAllocations(processMonth, mappings, preserveOverrides);
                totalCreated += count;
            }

            console.log(`✅ Complete! Created/updated ${totalCreated} expense allocations`);
            return {
                success: true,
                monthsProcessed: monthsToProcess.length,
                expensesCreated: totalCreated
            };

        } catch (error) {
            console.error('❌ Error applying allocation rules:', error);
            throw error;
        }
    }

    /**
     * Process a single month for monthly allocated expenses
     */
    async processMonthlyAllocations(month, mappings, preserveOverrides) {
        console.log(`\n📊 Processing ${month}...`);
        const orgId = this.getOrganizationId();

        // Get QB expenses for this month
        const startDate = `${month}-01`;
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);
        endDate.setDate(0);
        const endDateStr = endDate.toISOString().split('T')[0];

        const { data: qbExpenses } = await this.supabase
            .from('qb_expenses')
            .select('*')
            .eq('organization_id', orgId)
            .gte('expense_date', startDate)
            .lte('expense_date', endDateStr);

        if (!qbExpenses || qbExpenses.length === 0) {
            console.log(`  ⏭️  No QB expenses for ${month}`);
            return 0;
        }

        console.log(`  💰 Found ${qbExpenses.length} QB transactions`);

        // Get sessions for revenue/event calculations
        const sessions = await this.getSessions(month);
        console.log(`  🎲 Found ${sessions.length} sessions`);

        // Calculate location statistics
        const locationStats = this.calculateLocationStatistics(sessions);

        // Group expenses by category
        const grouped = this.groupQBExpensesByCategory(qbExpenses, mappings);

        // Generate allocated expense rows
        const allocatedExpenses = [];
        for (const [expenseCategory, data] of Object.entries(grouped)) {
            const { total, transactions, rule } = data;

            if (!rule) {
                console.log(`  ⚠️  No rule for "${expenseCategory}"`);
                continue;
            }

            // Calculate location splits
            const splits = this.calculateMonthlyLocationSplit(total, rule, locationStats);

            // Create rows for each location
            for (const [locationId, split] of Object.entries(splits)) {
                allocatedExpenses.push({
                    organization_id: orgId,
                    month: `${month}-01`,
                    location_id: locationId,
                    expense_category: expenseCategory,
                    qb_total_amount: total,
                    qb_transaction_count: transactions.length,
                    qb_source_data: transactions.map(t => ({
                        date: t.expense_date,
                        qb_category: t.qb_category,
                        amount: t.amount,
                        description: t.description,
                        vendor: t.vendor,
                        qb_expense_id: t.id
                    })),
                    allocation_rule_id: rule.id,
                    allocation_method: rule.allocation_method,
                    location_split_percent: split.percent,
                    allocated_amount: split.amount,
                    bingo_percentage: rule.bingo_percentage,
                    bingo_amount: split.amount * (rule.bingo_percentage / 100),
                    rules_applied_at: new Date().toISOString()
                });
            }
        }

        // Preserve overrides if requested
        if (preserveOverrides) {
            const { data: existing } = await this.supabase
                .from('monthly_allocated_expenses')
                .select('*')
                .eq('organization_id', orgId)
                .eq('month', `${month}-01`)
                .eq('is_overridden', true);

            if (existing && existing.length > 0) {
                const overridden = new Set(
                    existing.map(e => `${e.location_id}|${e.expense_category}`)
                );

                const filtered = allocatedExpenses.filter(e => {
                    const key = `${e.location_id}|${e.expense_category}`;
                    return !overridden.has(key);
                });

                console.log(`  🔒 Preserved ${allocatedExpenses.length - filtered.length} overridden entries`);
                allocatedExpenses.length = 0;
                allocatedExpenses.push(...filtered);
            }
        }

        // Upsert to database
        if (allocatedExpenses.length > 0) {
            const { error } = await this.supabase
                .from('monthly_allocated_expenses')
                .upsert(allocatedExpenses, {
                    onConflict: 'organization_id,month,location_id,expense_category',
                    ignoreDuplicates: false
                });

            if (error) throw error;
            console.log(`  ✅ Created/updated ${allocatedExpenses.length} allocations`);
        }

        return allocatedExpenses.length;
    }

    /**
     * Calculate location statistics for revenue and event-based splits
     */
    calculateLocationStatistics(sessions) {
        const stats = {};

        sessions.forEach(session => {
            const locId = session.location_id;
            if (!stats[locId]) {
                stats[locId] = {
                    locationId: locId,
                    revenue: 0,
                    eventCount: 0
                };
            }
            stats[locId].revenue += (session.net_revenue || session.total_sales || 0);
            stats[locId].eventCount += 1;
        });

        const totalRevenue = Object.values(stats).reduce((sum, s) => sum + s.revenue, 0);
        const totalEvents = Object.values(stats).reduce((sum, s) => sum + s.eventCount, 0);

        Object.values(stats).forEach(s => {
            s.revenuePercent = totalRevenue > 0 ? (s.revenue / totalRevenue) * 100 : 0;
            s.eventPercent = totalEvents > 0 ? (s.eventCount / totalEvents) * 100 : 0;
        });

        return stats;
    }

    /**
     * Group QB expenses by category using mappings
     */
    groupQBExpensesByCategory(qbExpenses, mappings) {
        const grouped = {};

        qbExpenses.forEach(expense => {
            const mapping = mappings.find(m => m.qb_category_name === expense.qb_category);
            if (!mapping || !mapping.allocation_rules) return;

            const category = mapping.allocation_rules.expense_category;
            if (!grouped[category]) {
                grouped[category] = {
                    total: 0,
                    transactions: [],
                    rule: mapping.allocation_rules
                };
            }

            grouped[category].total += parseFloat(expense.amount);
            grouped[category].transactions.push(expense);
        });

        return grouped;
    }

    /**
     * Calculate monthly location split based on rule
     */
    calculateMonthlyLocationSplit(totalAmount, rule, locationStats) {
        const splits = {};
        const locations = Object.values(locationStats);

        switch (rule.location_split_method) {
            case 'BY_REVENUE':
                locations.forEach(loc => {
                    splits[loc.locationId] = {
                        percent: loc.revenuePercent,
                        amount: totalAmount * (loc.revenuePercent / 100)
                    };
                });
                break;

            case 'BY_EVENTS':
                locations.forEach(loc => {
                    splits[loc.locationId] = {
                        percent: loc.eventPercent,
                        amount: totalAmount * (loc.eventPercent / 100)
                    };
                });
                break;

            case 'CUSTOM':
                // Use fixed percentages
                locations.forEach(loc => {
                    // Need to get location code to match with rule percentages
                    // For now, this needs location_code in stats
                    const percent = 50; // Placeholder
                    splits[loc.locationId] = {
                        percent: percent,
                        amount: totalAmount * (percent / 100)
                    };
                });
                break;

            case 'SC_ONLY':
            case 'RWC_ONLY':
                const targetCode = rule.location_split_method === 'SC_ONLY' ? 'SC' : 'RWC';
                const targetLoc = locations.find(l => l.locationCode === targetCode);
                if (targetLoc) {
                    splits[targetLoc.locationId] = {
                        percent: 100,
                        amount: totalAmount
                    };
                }
                break;
        }

        return splits;
    }
}
