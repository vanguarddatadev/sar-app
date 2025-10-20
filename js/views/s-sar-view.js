// S-SAR View Controller
// Handles Sessions Standalone Reporting view

import { sessionDataClient } from '../core/session-data-client.js';
import { supabase } from '../core/supabase-client.js';

class SSARView {
    constructor() {
        this.sessions = [];
        this.selectedMonth = null;
    }

    /**
     * Initialize the S-SAR view
     */
    async init() {
        console.log('Initializing S-SAR view...');

        // Setup tab switching
        this.setupTabSwitching();

        // Check if we have data in the database
        try {
            const { data, error } = await supabase.client
                .from('sessions')
                .select('session_date')
                .limit(1);

            if (error) throw error;

            // If we have data, update status
            const statusDiv = document.getElementById('sessionDataStatus');
            if (statusDiv && data && data.length > 0) {
                statusDiv.innerHTML = `
                    <p style="color: #6b7280;">
                        Session data is loaded. Click "Refresh Data" to update from Google Sheets.
                    </p>
                `;
            }
        } catch (error) {
            console.error('Error checking for existing data:', error);
        }
    }

    /**
     * Setup tab switching functionality
     */
    setupTabSwitching() {
        // Use event delegation on the parent container
        const ssarView = document.getElementById('s-sar-view');
        if (!ssarView) {
            console.error('s-sar-view not found');
            return;
        }

        ssarView.addEventListener('click', (e) => {
            const button = e.target.closest('.tab-btn');
            if (!button) return;

            const tabName = button.getAttribute('data-tab');
            console.log('Tab clicked:', tabName);

            // Remove active class from all buttons and contents in this view
            ssarView.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            ssarView.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

            // Add active class to clicked button and corresponding content
            button.classList.add('active');
            const targetContent = document.getElementById(`${tabName}-tab`);
            if (targetContent) {
                targetContent.classList.add('active');
                console.log('Activated tab:', tabName);
            } else {
                console.error('Tab content not found:', `${tabName}-tab`);
            }
        });

        console.log('Tab switching initialized for s-sar-view');
    }

    /**
     * Load available months from database
     */
    async loadAvailableMonths() {
        try {
            const { data, error } = await supabase.client
                .from('sessions')
                .select('session_date')
                .order('session_date', { ascending: false });

            if (error) throw error;

            // Extract unique months
            const monthsSet = new Set();
            data.forEach(session => {
                const month = session.session_date.substring(0, 7);
                monthsSet.add(month);
            });

            const months = Array.from(monthsSet).sort().reverse();

            // Populate month selector
            const monthSelect = document.getElementById('ssarMonthSelect');
            monthSelect.innerHTML = months.map(month => {
                const date = new Date(month + '-01');
                const monthName = date.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long'
                });
                return `<option value="${month}">${monthName}</option>`;
            }).join('');

            // Set selected month to most recent
            if (months.length > 0) {
                this.selectedMonth = months[0];
                monthSelect.value = this.selectedMonth;

                // Load summary for most recent month
                await this.loadMonthlySummary(this.selectedMonth);
            }

            // Add change listener
            monthSelect.addEventListener('change', (e) => {
                this.selectedMonth = e.target.value;
                this.loadMonthlySummary(this.selectedMonth);
            });

        } catch (error) {
            console.error('Error loading available months:', error);
        }
    }

    /**
     * Refresh session data from Google Sheets
     */
    async refreshData() {
        const statusDiv = document.getElementById('sessionDataStatus');
        const lastUpdateSpan = document.getElementById('lastDataUpdate');

        try {
            // Show loading state
            statusDiv.innerHTML = `
                <p class="empty-state">
                    <span style="font-size: 24px;">⏳</span><br>
                    Fetching data from Google Sheets...
                </p>
            `;

            // Fetch raw data
            const rawData = await sessionDataClient.fetchData();

            // Parse sessions
            this.sessions = sessionDataClient.parseSessions(rawData);

            if (this.sessions.length === 0) {
                statusDiv.innerHTML = `
                    <p class="empty-state">
                        No session data found. Please check your Google Sheets connection.
                    </p>
                `;
                return;
            }

            // Save sessions to database
            statusDiv.innerHTML = `
                <p class="empty-state">
                    <span style="font-size: 24px;">💾</span><br>
                    Saving ${this.sessions.length} sessions to database...
                </p>
            `;

            await this.saveSessions();

            // Update UI
            statusDiv.innerHTML = `
                <p style="color: var(--success-color); font-weight: 500;">
                    ✅ Successfully loaded ${this.sessions.length} sessions
                </p>
            `;

            const now = new Date();
            if (lastUpdateSpan) {
                lastUpdateSpan.textContent = `Last updated: ${now.toLocaleString()}`;
            }

        } catch (error) {
            console.error('Error refreshing data:', error);
            if (statusDiv) {
                statusDiv.innerHTML = `
                    <p style="color: var(--danger-color);">
                        ❌ Error: ${error.message}
                    </p>
                `;
            }
        }
    }

    /**
     * Save sessions to Supabase database
     * Uses upsert to update existing sessions or insert new ones
     */
    async saveSessions() {
        try {
            // Get current organization ID from app
            const organizationId = window.app?.currentOrganizationId;
            if (!organizationId) {
                throw new Error('No organization selected. Please reload the page.');
            }

            // Prepare sessions for upsert - map to new schema
            const sessionsToSave = this.sessions.map(s => ({
                location: s.location, // Will be converted to location_id by upsertSessions
                session_date: s.session_date,
                session_type: s.session_type,
                day_of_week: s.day_of_week,
                attendance: s.attendance,

                // Sales (5 categories)
                flash_sales: s.flash_sales || 0,
                strip_sales: s.strip_sales || 0,
                paper_sales: s.paper_sales || 0,
                cherry_sales: s.cherry_sales || 0,
                merch_other_sales: (s.merchandise_sales || 0) + (s.misc_receipts || 0),

                // Individual Payouts (12 columns) - map from parsed data
                flash_payouts: s.flash_payouts || 0,
                flash_redeemed: s.flash_redeemed || 0,
                strip_payouts: s.strip_payouts || 0,
                all_numbers_payouts: s.all_numbers_payouts || 0,
                double_action_payouts: s.double_action_payouts || 0,
                winnemucca_payouts: s.winnemucca_payouts || 0,
                rwb_payouts: s.rwb_payouts || 0,
                paper_payouts: s.paper_payouts || 0,
                cherry_redeemed: s.cherry_redeemed || 0,
                cherry_from_winn: s.cherry_from_winn || 0,
                gift_cert: s.gift_cert || 0,
                refund_other: s.refund_other || 0,

                // Hotball tracking (not revenue)
                hotball_participation: s.hotball_participation || 0,
                hotball_change: s.hotball_change || 0,
                hotball_total: s.hotball_total || 0,

                // Data source metadata
                data_source: 'gsheet',
                data_source_priority: 1,
                is_cancelled: false
            }));

            console.log(`💾 Saving ${sessionsToSave.length} sessions...`);

            // Use the upsertSessions method which handles location_id conversion
            await supabase.upsertSessions(sessionsToSave, organizationId);

            console.log(`✅ Saved ${sessionsToSave.length} sessions to database`);

        } catch (error) {
            console.error('Error saving sessions:', error);
            throw new Error('Failed to save sessions: ' + error.message);
        }
    }

    /**
     * Populate the month selector dropdown
     */
    populateMonthSelector() {
        const monthSelect = document.getElementById('ssarMonthSelect');
        const months = sessionDataClient.getAvailableMonths(this.sessions);

        monthSelect.innerHTML = months.map(month => {
            const date = new Date(month + '-01');
            const monthName = date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long'
            });
            return `<option value="${month}">${monthName}</option>`;
        }).join('');

        // Set selected month to most recent
        if (months.length > 0) {
            this.selectedMonth = months[0];
            monthSelect.value = this.selectedMonth;
        }

        // Add change listener
        monthSelect.addEventListener('change', (e) => {
            this.selectedMonth = e.target.value;
            this.loadMonthlySummary(this.selectedMonth);
        });
    }

    /**
     * Load and display monthly summary for selected month
     */
    async loadMonthlySummary(month) {
        try {
            // Fetch monthly summary from database view
            // Note: The view uses DATE_TRUNC which returns YYYY-MM-01 format
            const monthDate = `${month}-01`;

            const { data, error } = await supabase.client
                .from('v_monthly_summary')
                .select('*')
                .eq('month', monthDate)
                .order('location');

            if (error) {
                throw error;
            }

            // Display summary
            this.displayMonthlySummary(data, month);

        } catch (error) {
            console.error('Error loading monthly summary:', error);
            document.getElementById('monthlySummaryContent').innerHTML = `
                <p style="color: var(--danger-color);">Error loading summary: ${error.message}</p>
            `;
        }
    }

    /**
     * Display monthly summary data
     */
    displayMonthlySummary(summaries, month) {
        const container = document.getElementById('monthlySummaryContent');

        if (!summaries || summaries.length === 0) {
            container.innerHTML = `<p class="empty-state">No data for this month</p>`;
            return;
        }

        // Find SC and RWC data
        const scData = summaries.find(s => s.location === 'SC');
        const rwcData = summaries.find(s => s.location === 'RWC');

        // Calculate combined totals
        const combined = {
            session_count: (scData?.session_count || 0) + (rwcData?.session_count || 0),
            total_sales: (scData?.total_sales || 0) + (rwcData?.total_sales || 0),
            net_revenue: (scData?.net_revenue || 0) + (rwcData?.net_revenue || 0),
            total_attendance: (scData?.total_attendance || 0) + (rwcData?.total_attendance || 0),
            flash_sales: (scData?.flash_sales || 0) + (rwcData?.flash_sales || 0),
            strip_sales: (scData?.strip_sales || 0) + (rwcData?.strip_sales || 0),
            paper_sales: (scData?.paper_sales || 0) + (rwcData?.paper_sales || 0),
            avg_rpa: ((scData?.total_sales || 0) + (rwcData?.total_sales || 0)) /
                     ((scData?.total_attendance || 0) + (rwcData?.total_attendance || 0))
        };

        container.innerHTML = `
            <div class="metrics-grid" style="margin-bottom: 30px;">
                <div class="metric-card highlight">
                    <div class="metric-label">Total Sales</div>
                    <div class="metric-value">${this.formatCurrency(combined.total_sales)}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Net Revenue</div>
                    <div class="metric-value">${this.formatCurrency(combined.net_revenue)}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Total Attendance</div>
                    <div class="metric-value">${this.formatNumber(combined.total_attendance)}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Avg RPA</div>
                    <div class="metric-value">${this.formatCurrency(combined.avg_rpa)}</div>
                </div>
            </div>

            <h4 style="margin: 30px 0 15px 0;">By Location</h4>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                ${scData ? this.renderLocationCard('Santa Clara', scData) : ''}
                ${rwcData ? this.renderLocationCard('Redwood City', rwcData) : ''}
            </div>

            <h4 style="margin: 30px 0 15px 0;">Revenue Breakdown</h4>

            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-label">Flash Sales</div>
                    <div class="metric-value">${this.formatCurrency(combined.flash_sales)}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Strip Sales</div>
                    <div class="metric-value">${this.formatCurrency(combined.strip_sales)}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Paper Sales</div>
                    <div class="metric-value">${this.formatCurrency(combined.paper_sales)}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Sessions</div>
                    <div class="metric-value">${combined.session_count}</div>
                </div>
            </div>
        `;
    }

    /**
     * Render location card
     */
    renderLocationCard(locationName, data) {
        return `
            <div class="admin-card">
                <h5 style="margin-bottom: 15px;">${locationName}</h5>
                <div style="display: grid; gap: 10px; font-size: 14px;">
                    <div style="display: flex; justify-content: space-between;">
                        <span>Sessions:</span>
                        <strong>${data.session_count}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span>Total Sales:</span>
                        <strong>${this.formatCurrency(data.total_sales)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span>Net Revenue:</span>
                        <strong>${this.formatCurrency(data.net_revenue)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span>Attendance:</span>
                        <strong>${this.formatNumber(data.total_attendance)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span>Avg RPA:</span>
                        <strong>${this.formatCurrency(data.avg_rpa)}</strong>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Format currency
     */
    formatCurrency(value) {
        if (!value || isNaN(value)) return '$0';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value);
    }

    /**
     * Format number
     */
    formatNumber(value) {
        if (!value || isNaN(value)) return '0';
        return new Intl.NumberFormat('en-US').format(Math.round(value));
    }
}

export const ssarView = new SSARView();
