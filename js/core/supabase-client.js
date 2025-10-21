// Supabase Client for SAR
// Initialize connection to Supabase

export class SupabaseClient {
    constructor() {
        this.client = null;
        this.initialized = false;
    }

    /**
     * Initialize Supabase client
     * User needs to provide their Supabase URL and anon key
     */
    async init(supabaseUrl, supabaseKey) {
        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Supabase URL and Key are required');
        }

        try {
            this.client = window.supabase.createClient(supabaseUrl, supabaseKey);
            this.initialized = true;
            console.log('✅ Supabase client initialized');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize Supabase:', error);
            throw error;
        }
    }

    /**
     * Check if client is initialized
     */
    isInitialized() {
        return this.initialized && this.client !== null;
    }

    /**
     * Get Supabase client instance
     */
    getClient() {
        if (!this.isInitialized()) {
            throw new Error('Supabase client not initialized');
        }
        return this.client;
    }

    /**
     * Test connection by fetching system settings
     */
    async testConnection() {
        try {
            const { data, error } = await this.client
                .from('system_settings')
                .select('key')
                .limit(1);

            if (error) throw error;

            console.log('✅ Supabase connection test successful');
            return true;
        } catch (error) {
            console.error('❌ Supabase connection test failed:', error);
            return false;
        }
    }

    // ========================================
    // SESSIONS
    // ========================================

    async getSessions(filters = {}) {
        const query = this.client
            .from('sessions')
            .select('*')
            .order('session_date', { ascending: false });

        if (filters.location) {
            query.eq('location_code', filters.location);
        }

        if (filters.month) {
            const startDate = `${filters.month}-01`;
            const endDate = new Date(filters.month + '-01');
            endDate.setMonth(endDate.getMonth() + 1);
            query.gte('session_date', startDate)
                .lt('session_date', endDate.toISOString().split('T')[0]);
        }

        const { data, error } = await query;

        if (error) throw error;
        return data;
    }

    async insertSession(session) {
        const { data, error } = await this.client
            .from('sessions')
            .insert([session])
            .select();

        if (error) throw error;
        return data[0];
    }

    async upsertSessions(sessions, organizationId) {
        // Delete existing sessions first, then insert
        // This avoids the constraint matching issue

        // Get location_id mapping for this organization
        const { data: locations, error: locError } = await this.client
            .from('locations')
            .select('id, location_code')
            .eq('organization_id', organizationId);

        if (locError) throw locError;

        // Create location code to ID map
        const locationMap = {};
        locations.forEach(loc => {
            locationMap[loc.location_code] = loc.id;
        });

        // Add organization_id and convert location to location_id
        const sessionsWithOrg = sessions.map(s => {
            const locationId = locationMap[s.location];
            if (!locationId) {
                throw new Error(`Unknown location code: ${s.location}`);
            }

            const { location, ...sessionData } = s; // Remove location field
            return {
                ...sessionData,
                organization_id: sessionData.organization_id || organizationId,
                location_id: locationId
            };
        });

        // Delete all sessions for this organization first
        await this.client
            .from('sessions')
            .delete()
            .eq('organization_id', organizationId);

        // Insert all sessions fresh
        const { data, error } = await this.client
            .from('sessions')
            .insert(sessionsWithOrg)
            .select();

        if (error) throw error;
        return data;
    }

    // ========================================
    // QB CATEGORY MAPPING
    // ========================================

    async getQBCategoryMappings() {
        const { data, error } = await this.client
            .from('qb_category_mapping')
            .select('*')
            .order('qb_category_name');

        if (error) throw error;
        return data || [];
    }

    async addQBCategoryMapping(mapping) {
        const { data, error } = await this.client
            .from('qb_category_mapping')
            .insert([mapping])
            .select();

        if (error) throw error;
        return data[0];
    }

    async updateQBCategoryMapping(id, updates) {
        const { data, error } = await this.client
            .from('qb_category_mapping')
            .update(updates)
            .eq('id', id)
            .select();

        if (error) throw error;
        return data[0];
    }

    async deleteQBCategoryMapping(id) {
        const { error } = await this.client
            .from('qb_category_mapping')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return true;
    }

    // ========================================
    // ORGANIZATIONS
    // ========================================

    async getOrganizations() {
        const { data, error } = await this.client
            .from('organizations')
            .select('*')
            .order('name');

        if (error) throw error;
        return data || [];
    }

    async getOrganization(orgId) {
        const { data, error } = await this.client
            .from('organizations')
            .select('*')
            .eq('id', orgId)
            .single();

        if (error) throw error;
        return data;
    }

    // ========================================
    // ALLOCATION RULES (NEW SCHEMA)
    // ========================================

    async getAllocationRules(organizationId) {
        const { data, error } = await this.client
            .from('allocation_rules')
            .select('*')
            .eq('organization_id', organizationId)
            .order('expense_category');

        if (error) throw error;
        return data || [];
    }

    async getAllocationRule(id) {
        const { data, error } = await this.client
            .from('allocation_rules')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data;
    }

    async updateAllocationRule(id, updates) {
        const { data, error } = await this.client
            .from('allocation_rules')
            .update(updates)
            .eq('id', id)
            .select();

        if (error) throw error;
        return data[0];
    }

    async createAllocationRule(rule) {
        const { data, error } = await this.client
            .from('allocation_rules')
            .insert([rule])
            .select();

        if (error) throw error;
        return data[0];
    }

    async deleteAllocationRule(id) {
        const { error } = await this.client
            .from('allocation_rules')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return true;
    }

    // ========================================
    // QB MONTHLY IMPORTS
    // ========================================

    async getQBImports(organizationId, month = null) {
        let query = this.client
            .from('qb_monthly_imports')
            .select('*')
            .eq('organization_id', organizationId);

        if (month) {
            query = query.eq('month', month);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    }

    async importQBData(imports) {
        const { data, error } = await this.client
            .from('qb_monthly_imports')
            .insert(imports)
            .select();

        if (error) throw error;
        return data;
    }

    // ========================================
    // SPREADSHEET MONTHLY ACTUALS
    // ========================================

    async getSpreadsheetActuals(organizationId, month = null) {
        let query = this.client
            .from('spreadsheet_monthly_actuals')
            .select('*')
            .eq('organization_id', organizationId);

        if (month) {
            query = query.eq('month', month);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    }

    async upsertSpreadsheetActuals(actuals) {
        const { data, error } = await this.client
            .from('spreadsheet_monthly_actuals')
            .upsert(actuals, {
                onConflict: 'organization_id,month,location,category'
            })
            .select();

        if (error) throw error;
        return data;
    }

    // ========================================
    // MONTHLY FORECAST
    // ========================================

    async getMonthlyForecast(organizationId, month, locationCode = null) {
        let query = this.client
            .from('monthly_forecast')
            .select(`
                *,
                locations!inner(location_code),
                modified:monthly_forecast_modified(modified_amount, reason, modified_by, modified_at)
            `)
            .eq('organization_id', organizationId)
            .eq('month', month);

        if (locationCode) {
            query = query.eq('locations.location_code', locationCode);
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

    async modifyMonthlyForecast(organizationId, month, location, category, modifiedAmount, reason, modifiedBy) {
        const { data, error } = await this.client
            .from('monthly_forecast_modified')
            .upsert({
                organization_id: organizationId,
                month,
                location,
                category,
                modified_amount: modifiedAmount,
                reason,
                modified_by: modifiedBy
            }, {
                onConflict: 'organization_id,month,location,category'
            })
            .select();

        if (error) throw error;
        return data[0];
    }

    // ========================================
    // SESSION ALLOCATED EXPENSES
    // ========================================

    async getSessionAllocatedExpenses(sessionId) {
        const { data, error } = await this.client
            .from('session_allocated_expenses')
            .select('*')
            .eq('session_id', sessionId)
            .order('category');

        if (error) throw error;
        return data || [];
    }

    async getMonthAllocatedExpenses(organizationId, month) {
        const { data, error } = await this.client
            .from('session_allocated_expenses')
            .select(`
                *,
                session:sessions(session_date, location, total_sales)
            `)
            .eq('organization_id', organizationId)
            .eq('source_month', month);

        if (error) throw error;
        return data || [];
    }

    // ========================================
    // REVENUE CATEGORIES
    // ========================================

    async getRevenueCategories() {
        const { data, error } = await this.client
            .from('revenue_categories')
            .select('*')
            .eq('is_active', true)
            .order('county_report_order');

        if (error) throw error;
        return data || [];
    }

    async updateRevenueCategory(id, updates) {
        const { data, error } = await this.client
            .from('revenue_categories')
            .update(updates)
            .eq('id', id)
            .select();

        if (error) throw error;
        return data[0];
    }

    // ========================================
    // SYSTEM SETTINGS
    // ========================================

    async getSetting(organizationId, key) {
        const { data, error } = await this.client
            .from('system_settings')
            .select('*')
            .eq('organization_id', organizationId)
            .eq('key', key)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null; // Not found
            throw error;
        }
        return data;
    }

    async getSettingsByCategory(organizationId, category) {
        const { data, error } = await this.client
            .from('system_settings')
            .select('*')
            .eq('organization_id', organizationId)
            .eq('category', category);

        if (error) throw error;
        return data || [];
    }

    async updateSetting(organizationId, key, value) {
        const { data, error} = await this.client
            .from('system_settings')
            .upsert({
                organization_id: organizationId,
                key,
                value: value.toString(),
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'organization_id,key'
            })
            .select();

        if (error) throw error;
        return data[0];
    }

    // ========================================
    // MONTHLY SUMMARY VIEW
    // ========================================

    async getMonthlySummary(month, location = null) {
        let query = this.client
            .from('v_monthly_summary')
            .select('*')
            .eq('month', `${month}-01`);

        if (location && location !== 'COMBINED') {
            query = query.eq('location_code', location);
        }

        const { data, error } = await query;

        if (error) throw error;

        // If COMBINED, sum up both locations
        if (!data || data.length === 0) {
            return null;
        }

        if (location === 'COMBINED' && data.length > 1) {
            return {
                month: data[0].month,
                location: 'COMBINED',
                session_count: data.reduce((sum, d) => sum + d.session_count, 0),
                total_attendance: data.reduce((sum, d) => sum + d.total_attendance, 0),
                total_sales: data.reduce((sum, d) => sum + d.total_sales, 0),
                total_payouts: data.reduce((sum, d) => sum + d.total_payouts, 0),
                net_revenue: data.reduce((sum, d) => sum + d.net_revenue, 0),
                flash_sales: data.reduce((sum, d) => sum + d.flash_sales, 0),
                strip_sales: data.reduce((sum, d) => sum + d.strip_sales, 0),
                avg_rpa: data.reduce((sum, d) => sum + d.avg_rpa, 0) / data.length
            };
        }

        return data[0];
    }

    // ========================================
    // REVENUE SHARE VIEW
    // ========================================

    async getRevenueShare(month, location) {
        const { data, error} = await this.client
            .from('v_revenue_share')
            .select('*')
            .eq('month', `${month}-01`)
            .eq('location_code', location)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw error;
        }
        return data;
    }

    // ========================================
    // HISTORICAL ANALYSIS
    // ========================================

    async getSessionsByDateRange(startDate, endDate, locationCode = null) {
        // Get current organization ID
        const organizationId = window.app?.currentOrganizationId;
        if (!organizationId) {
            throw new Error('No organization selected');
        }

        let query = this.client
            .from('sessions')
            .select('*')
            .eq('organization_id', organizationId)
            .gte('session_date', startDate)
            .lte('session_date', endDate)
            .order('session_date', { ascending: true });

        if (locationCode) {
            query = query.eq('location_code', locationCode);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    }

    async getMonthlySummariesByRange(startDate, endDate, locationCode = null) {
        // Get current organization ID
        const organizationId = window.app?.currentOrganizationId;
        if (!organizationId) {
            throw new Error('No organization selected');
        }

        // Get sessions in date range
        const sessions = await this.getSessionsByDateRange(startDate, endDate, locationCode);

        // Aggregate by month
        const monthlyData = {};

        sessions.forEach(session => {
            const date = new Date(session.session_date);
            const year = date.getFullYear();
            const month = date.getMonth() + 1; // 1-12
            const key = `${year}-${String(month).padStart(2, '0')}`;

            if (!monthlyData[key]) {
                monthlyData[key] = {
                    year,
                    month,
                    session_count: 0,
                    total_sales: 0,
                    total_payouts: 0,
                    net_revenue: 0,
                    other_expenses: 0
                };
            }

            monthlyData[key].session_count += 1;
            monthlyData[key].total_sales += parseFloat(session.total_sales || 0);
            monthlyData[key].total_payouts += parseFloat(session.total_payouts || 0);
            monthlyData[key].net_revenue += parseFloat(session.net_revenue || 0);
            // other_expenses would come from allocated expenses (not implemented yet)
        });

        return Object.values(monthlyData).sort((a, b) => {
            const aKey = `${a.year}-${String(a.month).padStart(2, '0')}`;
            const bKey = `${b.year}-${String(b.month).padStart(2, '0')}`;
            return aKey.localeCompare(bKey);
        });
    }

    // ========================================
    // MONTHLY REVENUE REPORT
    // ========================================

    async getMonthlyRevenueReport(locationCode = null) {
        // Get current organization ID
        const organizationId = window.app?.currentOrganizationId;
        if (!organizationId) {
            throw new Error('No organization selected');
        }

        // Get all sessions with pre-calculated totals from spreadsheet
        let query = this.client
            .from('sessions')
            .select(`
                session_date,
                location_id,
                locations!inner(location_code),
                total_sales,
                total_payouts,
                net_revenue
            `)
            .eq('organization_id', organizationId);

        if (locationCode && locationCode !== 'COMBINED') {
            query = query.eq('locations.location_code', locationCode);
        }

        const { data, error } = await query;

        if (error) throw error;

        console.log(`📊 Processing ${data.length} sessions for monthly revenue report`);

        // Aggregate by month
        const monthlyData = {};

        data.forEach((session, index) => {
            const month = session.session_date.substring(0, 7); // YYYY-MM

            if (!monthlyData[month]) {
                monthlyData[month] = {
                    month: month,
                    total_sales: 0,
                    total_payouts: 0,
                    net_revenue: 0,
                    session_count: 0
                };
            }

            // Debug first session of each month
            if (monthlyData[month].session_count === 0) {
                console.log(`First session for ${month}:`, {
                    date: session.session_date,
                    location: session.locations.location_code,
                    total_sales: session.total_sales,
                    total_payouts: session.total_payouts,
                    net_revenue: session.net_revenue
                });
            }

            // Sum the pre-calculated totals from spreadsheet
            monthlyData[month].total_sales += (session.total_sales || 0);
            monthlyData[month].total_payouts += (session.total_payouts || 0);
            monthlyData[month].net_revenue += (session.net_revenue || 0);
            monthlyData[month].session_count += 1;
        });

        // Log final monthly totals
        Object.entries(monthlyData).forEach(([month, totals]) => {
            console.log(`✅ ${month}: ${totals.session_count} sessions, Total Sales: $${totals.total_sales.toFixed(2)}, Net Revenue: $${totals.net_revenue.toFixed(2)}`);
        });

        // Convert to array and calculate percentages
        const result = Object.values(monthlyData).map(month => ({
            ...month,
            net_revenue_percent: month.total_sales > 0
                ? ((month.net_revenue / month.total_sales) * 100).toFixed(1)
                : 0
        }));

        // Sort by month descending
        result.sort((a, b) => b.month.localeCompare(a.month));

        return result;
    }

    // ========================================
    // NAVIGATION VISIBILITY SETTINGS
    // ========================================

    async getNavVisibilitySettings(organizationId) {
        const { data, error } = await this.client
            .from('nav_visibility_settings')
            .select('*')
            .eq('organization_id', organizationId)
            .single();

        if (error) {
            // If no record exists, return defaults
            if (error.code === 'PGRST116') {
                return {
                    show_checkboxes: false,
                    visibility_config: {
                        categories: {
                            "analytics": true,
                            "data-management": true,
                            "reports": true,
                            "configuration": true
                        },
                        items: {
                            "dashboard": true,
                            "s-sar": true,
                            "monthly-revenue": true,
                            "historical": true,
                            "ai-analysis": true,
                            "forecast": true,
                            "transaction-recon": true,
                            "data-quality": true,
                            "qb-history": true,
                            "adjusted-expenses": true,
                            "report-generation": true,
                            "report-checklist": true,
                            "report-library": true,
                            "qb-sync": true,
                            "expense-rules": true,
                            "revenue-config": true,
                            "data-import": true
                        }
                    }
                };
            }
            throw error;
        }
        return data;
    }

    async saveNavVisibilitySettings(organizationId, showCheckboxes, visibilityConfig) {
        const { data, error} = await this.client
            .from('nav_visibility_settings')
            .upsert({
                organization_id: organizationId,
                show_checkboxes: showCheckboxes,
                visibility_config: visibilityConfig,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'organization_id'
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    // ========================================
    // MONTHLY ALLOCATED EXPENSES
    // ========================================

    /**
     * Get monthly allocated expenses for an organization
     * @param {string} organizationId
     * @param {string} month - Optional YYYY-MM format to filter specific month
     */
    async getMonthlyAllocatedExpenses(organizationId, month = null) {
        let query = this.client
            .from('monthly_allocated_expenses')
            .select(`
                *,
                locations(location_code, location_name),
                allocation_rules(expense_category, bingo_percentage, location_split_method)
            `)
            .eq('organization_id', organizationId)
            .order('month', { ascending: false });

        if (month) {
            query = query.eq('month', `${month}-01`);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    }

    /**
     * Get list of months that have allocated expenses
     */
    async getMonthsWithAllocatedExpenses(organizationId) {
        const { data, error } = await this.client
            .from('monthly_allocated_expenses')
            .select('month')
            .eq('organization_id', organizationId)
            .order('month', { ascending: false });

        if (error) throw error;

        // Extract unique months
        const uniqueMonths = [...new Set(data.map(row => row.month))];
        return uniqueMonths;
    }

    /**
     * Update override amount for a monthly allocated expense
     */
    async updateMonthlyExpenseOverride(expenseId, overrideAmount, notes = null) {
        const bingoPct = await this.client
            .from('monthly_allocated_expenses')
            .select('bingo_percentage')
            .eq('id', expenseId)
            .single();

        const overrideBingoAmount = overrideAmount * (bingoPct.data.bingo_percentage / 100);

        const { data, error } = await this.client
            .from('monthly_allocated_expenses')
            .update({
                override_allocated_amount: overrideAmount,
                override_bingo_amount: overrideBingoAmount,
                is_overridden: true,
                override_notes: notes,
                updated_at: new Date().toISOString()
            })
            .eq('id', expenseId)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Get QB expenses for a specific month
     */
    async getQBExpensesByMonth(organizationId, month) {
        const startDate = `${month}-01`;
        const endDate = new Date(month + '-01');
        endDate.setMonth(endDate.getMonth() + 1);
        endDate.setDate(0); // Last day of month
        const endDateStr = endDate.toISOString().split('T')[0];

        const { data, error } = await this.client
            .from('qb_expenses')
            .select('*')
            .eq('organization_id', organizationId)
            .gte('expense_date', startDate)
            .lte('expense_date', endDateStr)
            .order('expense_date');

        if (error) throw error;
        return data || [];
    }

    /**
     * Transform QB monthly imports into normalized qb_expenses table
     * This aggregates raw QB P&L imports by month/category
     */
    async transformQBImportsToExpenses(organizationId, month = null) {
        try {
            // Call the PostgreSQL function
            const { data, error } = await this.client.rpc('transform_qb_imports_to_expenses', {
                p_organization_id: organizationId,
                p_month: month
            });

            if (error) throw error;

            console.log(`✅ Transformed QB imports: ${data[0].records_processed} processed, ${data[0].records_created} created`);
            return data[0];
        } catch (error) {
            console.error('Error transforming QB imports:', error);
            throw error;
        }
    }

    /**
     * Get QB category mappings with allocation rules
     */
    async getQBCategoryMappingsWithRules(organizationId) {
        const { data, error } = await this.client
            .from('qb_category_mapping')
            .select(`
                *,
                allocation_rules(*)
            `)
            .eq('organization_id', organizationId)
            .eq('is_active', true);

        if (error) throw error;
        return data || [];
    }

    /**
     * Get sessions summary for a month (for revenue/event count calculations)
     */
    async getSessionsSummaryByMonth(organizationId, month) {
        const startDate = `${month}-01`;
        const endDate = new Date(month + '-01');
        endDate.setMonth(endDate.getMonth() + 1);
        endDate.setDate(0);
        const endDateStr = endDate.toISOString().split('T')[0];

        const { data, error } = await this.client
            .from('sessions')
            .select(`
                id,
                session_date,
                location_id,
                locations(location_code),
                net_revenue,
                total_sales
            `)
            .eq('organization_id', organizationId)
            .gte('session_date', startDate)
            .lte('session_date', endDateStr);

        if (error) throw error;
        return data || [];
    }

    /**
     * Bulk upsert monthly allocated expenses
     */
    async upsertMonthlyAllocatedExpenses(expenses) {
        const { data, error } = await this.client
            .from('monthly_allocated_expenses')
            .upsert(expenses, {
                onConflict: 'organization_id,month,location_id,expense_category',
                ignoreDuplicates: false
            })
            .select();

        if (error) throw error;
        return data;
    }

    /**
     * Get last applied date for allocation rules
     */
    async getLastRulesAppliedDate(organizationId) {
        const { data, error } = await this.client
            .from('monthly_allocated_expenses')
            .select('rules_applied_at')
            .eq('organization_id', organizationId)
            .order('rules_applied_at', { ascending: false })
            .limit(1)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null; // No data
            throw error;
        }
        return data?.rules_applied_at || null;
    }
}

// Export singleton instance
export const supabase = new SupabaseClient();
