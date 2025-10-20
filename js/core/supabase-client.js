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
            query.eq('location', filters.location);
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

        // Add organization_id to each session if not present
        const sessionsWithOrg = sessions.map(s => ({
            ...s,
            organization_id: s.organization_id || organizationId
        }));

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
            .order('display_order');

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

    async getMonthlyForecast(organizationId, month, location = null) {
        let query = this.client
            .from('monthly_forecast')
            .select(`
                *,
                modified:monthly_forecast_modified(modified_amount, reason, modified_by, modified_at)
            `)
            .eq('organization_id', organizationId)
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
            query = query.eq('location', location);
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
        const { data, error } = await this.client
            .from('v_revenue_share')
            .select('*')
            .eq('month', `${month}-01`)
            .eq('location', location)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw error;
        }
        return data;
    }

    // ========================================
    // MONTHLY REVENUE REPORT
    // ========================================

    async getMonthlyRevenueReport(location = null) {
        // Get all sessions with pre-calculated totals from spreadsheet
        let query = this.client
            .from('sessions')
            .select(`
                session_date,
                location,
                total_sales,
                total_payouts,
                net_revenue
            `);

        if (location && location !== 'COMBINED') {
            query = query.eq('location', location);
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
                    location: session.location,
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
}

// Export singleton instance
export const supabase = new SupabaseClient();
