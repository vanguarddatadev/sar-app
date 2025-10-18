// Monthly Reporting View Controller
// Handles detailed monthly aggregated metrics display

import { supabase } from '../core/supabase-client.js';

class MonthlyReportingView {
    constructor() {
        this.currentLocation = 'SC';
        this.currentPeriod = 'monthly';
        this.months = [];
    }

    /**
     * Initialize the monthly reporting view
     */
    async init() {
        console.log('Initializing Monthly Reporting view...');

        // Set up filter handlers
        this.setupFilters();

        // Load data
        await this.loadData();
    }

    /**
     * Set up filter button handlers
     */
    setupFilters() {
        // Location filter
        document.querySelectorAll('.monthly-location-filter').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.monthly-location-filter').forEach(b => {
                    b.classList.remove('active');
                });
                e.target.classList.add('active');
                this.currentLocation = e.target.dataset.location;
                this.loadData();
            });
        });

        // Period filter
        document.querySelectorAll('.monthly-period-filter').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.monthly-period-filter').forEach(b => {
                    b.classList.remove('active');
                });
                e.target.classList.add('active');
                this.currentPeriod = e.target.dataset.period;
                this.loadData();
            });
        });
    }

    /**
     * Load session data and aggregate by month
     */
    async loadData() {
        const container = document.getElementById('monthlyReportingContainer');

        try {
            container.innerHTML = '<div class="empty-state">Loading data...</div>';

            // Build query
            let query = supabase.client
                .from('sessions')
                .select('*')
                .eq('is_cancelled', false)
                .order('session_date', { ascending: true });

            // Apply location filter
            if (this.currentLocation !== 'COMBINED') {
                query = query.eq('location', this.currentLocation);
            }

            const { data, error } = await query;

            if (error) throw error;

            console.log('📊 Loaded', data.length, 'sessions for monthly reporting');

            // Group by month
            const monthsMap = new Map();

            data.forEach(session => {
                const date = new Date(session.session_date);
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

                if (!monthsMap.has(monthKey)) {
                    monthsMap.set(monthKey, {
                        key: monthKey,
                        name: monthName,
                        sessions: []
                    });
                }

                monthsMap.get(monthKey).sessions.push(session);
            });

            // Convert to array and sort (newest first)
            this.months = Array.from(monthsMap.values()).sort((a, b) => b.key.localeCompare(a.key));

            console.log('📅 Grouped into', this.months.length, 'months');

            // Calculate metrics for each month
            const monthsWithMetrics = this.months.map(month => ({
                ...month,
                metrics: this.calculateMetrics(month.sessions)
            }));

            // Render
            this.renderMonths(monthsWithMetrics);

        } catch (err) {
            console.error('Error loading monthly data:', err);
            container.innerHTML = `<div class="empty-state" style="color: var(--danger-color);">Error: ${err.message}</div>`;
        }
    }

    /**
     * Calculate aggregated metrics for a month
     */
    calculateMetrics(sessions) {
        const metrics = {
            eventCount: sessions.length,
            totalSales: 0,
            totalPayouts: 0,
            netRevenue: 0,
            attendance: 0,
            flash: 0,
            strips: 0,
            paper: 0,
            cherries: 0,
            flashPayouts: 0,
            stripPayouts: 0,
            paperPayouts: 0
        };

        sessions.forEach(s => {
            metrics.totalSales += parseFloat(s.total_sales || 0);
            metrics.totalPayouts += parseFloat(s.total_payouts || 0);
            metrics.netRevenue += parseFloat(s.net_revenue || 0);
            metrics.attendance += parseInt(s.attendance || 0);
            metrics.flash += parseFloat(s.flash_sales || 0);
            metrics.strips += parseFloat(s.strip_sales || 0);
            metrics.paper += parseFloat(s.paper_sales || 0);
            metrics.cherries += parseFloat(s.cherry_sales || 0);
            metrics.flashPayouts += parseFloat(s.flash_payouts || 0);
            metrics.stripPayouts += parseFloat(s.strip_payouts || 0);
            metrics.paperPayouts += parseFloat(s.paper_payouts || 0);
        });

        // Derived metrics
        metrics.margin = metrics.totalSales > 0 ? (metrics.netRevenue / metrics.totalSales * 100) : 0;
        metrics.rpa = metrics.attendance > 0 ? (metrics.totalSales / metrics.attendance) : 0;
        metrics.flashNet = metrics.flash - metrics.flashPayouts;
        metrics.stripNet = metrics.strips - metrics.stripPayouts;
        metrics.flashMargin = metrics.flash > 0 ? (metrics.flashNet / metrics.flash * 100) : 0;
        metrics.stripMargin = metrics.strips > 0 ? (metrics.stripNet / metrics.strips * 100) : 0;
        metrics.flashRPA = metrics.attendance > 0 ? (metrics.flash / metrics.attendance) : 0;
        metrics.stripRPA = metrics.attendance > 0 ? (metrics.strips / metrics.attendance) : 0;
        metrics.profitPerEvent = metrics.eventCount > 0 ? (metrics.netRevenue / metrics.eventCount) : 0;

        return metrics;
    }

    /**
     * Render all month cards
     */
    renderMonths(months) {
        const container = document.getElementById('monthlyReportingContainer');

        if (months.length === 0) {
            container.innerHTML = '<div class="empty-state">No data available for the selected filters</div>';
            return;
        }

        container.innerHTML = months.map(month => this.createMonthCard(month)).join('');
    }

    /**
     * Create HTML for a single month card with all metrics
     */
    createMonthCard(month) {
        const m = month.metrics;

        return `
            <div class="month-card">
                <div class="month-header">
                    <div class="month-name">${month.name}</div>
                    <div class="month-meta">${m.eventCount} Events</div>
                </div>

                <!-- Total Sales -->
                <div class="metric-section blue">
                    <div class="metric-label">Total Sales</div>
                    <div class="metric-value">$${this.fmt(m.totalSales)}</div>
                    <div class="metric-details">
                        <div class="metric-details-item">
                            <span class="metric-details-label">Flash:</span>
                            <span>$${this.fmt(m.flash)} (${this.pct(m.flash, m.totalSales)}%)</span>
                        </div>
                        <div class="metric-details-item">
                            <span class="metric-details-label">Strips:</span>
                            <span>$${this.fmt(m.strips)} (${this.pct(m.strips, m.totalSales)}%)</span>
                        </div>
                        <div class="metric-details-item">
                            <span class="metric-details-label">Paper:</span>
                            <span>$${this.fmt(m.paper)} (${this.pct(m.paper, m.totalSales)}%)</span>
                        </div>
                        <div class="metric-details-item">
                            <span class="metric-details-label">Cherries:</span>
                            <span>$${this.fmt(m.cherries)} (${this.pct(m.cherries, m.totalSales)}%)</span>
                        </div>
                        <div class="metric-details-item">
                            <span class="metric-details-label">Avg/Event:</span>
                            <span>$${this.fmt(m.totalSales / m.eventCount)}</span>
                        </div>
                    </div>
                </div>

                <!-- Total Payouts -->
                <div class="metric-section red">
                    <div class="metric-label">Total Payouts</div>
                    <div class="metric-value">$${this.fmt(m.totalPayouts)}</div>
                    <div class="metric-details">
                        <div class="metric-details-item">
                            <span class="metric-details-label">Strip Payouts:</span>
                            <span>$${this.fmt(m.stripPayouts)} (${this.pct(m.stripPayouts, m.totalPayouts)}%)</span>
                        </div>
                        <div class="metric-details-item">
                            <span class="metric-details-label">Paper Payouts:</span>
                            <span>$${this.fmt(m.paperPayouts)} (${this.pct(m.paperPayouts, m.totalPayouts)}%)</span>
                        </div>
                        <div class="metric-details-item">
                            <span class="metric-details-label">Flash Payouts:</span>
                            <span>$${this.fmt(m.flashPayouts)} (${this.pct(m.flashPayouts, m.totalPayouts)}%)</span>
                        </div>
                        <div class="metric-details-item">
                            <span class="metric-details-label">Payout %:</span>
                            <span>${this.pct(m.totalPayouts, m.totalSales)}%</span>
                        </div>
                        <div class="metric-details-item">
                            <span class="metric-details-label">Avg/Event:</span>
                            <span>$${this.fmt(m.totalPayouts / m.eventCount)}</span>
                        </div>
                    </div>
                </div>

                <!-- Net Sales -->
                <div class="metric-section green">
                    <div class="metric-label">Net Sales</div>
                    <div class="metric-value">$${this.fmt(m.netRevenue)}</div>
                    <div class="metric-details">
                        <div class="metric-details-item">
                            <span class="metric-details-label">Total Sales:</span>
                            <span>$${this.fmt(m.totalSales)}</span>
                        </div>
                        <div class="metric-details-item">
                            <span class="metric-details-label">Total Payouts:</span>
                            <span>$${this.fmt(m.totalPayouts)}</span>
                        </div>
                        <div class="metric-details-item">
                            <span class="metric-details-label">Margin:</span>
                            <span>${m.margin.toFixed(1)}%</span>
                        </div>
                        <div class="metric-details-item">
                            <span class="metric-details-label">Avg/Event:</span>
                            <span>$${this.fmt(m.netRevenue / m.eventCount)}</span>
                        </div>
                        <div class="metric-details-item">
                            <span class="metric-details-label">Daily Average:</span>
                            <span>$${this.fmt(m.netRevenue / 30)}</span>
                        </div>
                    </div>
                </div>

                <!-- Products -->
                <div class="metric-section purple">
                    <div class="metric-label">Products</div>
                    <div class="metric-value">Flash: ${this.pct(m.flash, m.totalSales)}% | Strip: ${this.pct(m.strips, m.totalSales)}%</div>
                    <div class="metric-details">
                        <div style="margin-bottom: 8px;">
                            <div style="font-weight: 700; margin-bottom: 4px;">FLASH ${this.pct(m.flash, m.totalSales)}%</div>
                            <div class="metric-details-item">
                                <span>Sales:</span><span>$${this.fmt(m.flash)}</span>
                            </div>
                            <div class="metric-details-item">
                                <span>Payouts:</span><span>$${this.fmt(m.flashPayouts)}</span>
                            </div>
                            <div class="metric-details-item">
                                <span>Net:</span><span>$${this.fmt(m.flashNet)}</span>
                            </div>
                            <div class="metric-details-item">
                                <span>Margin:</span><span>${m.flashMargin.toFixed(1)}%</span>
                            </div>
                            <div class="metric-details-item">
                                <span>RPA:</span><span>$${m.flashRPA.toFixed(2)}</span>
                            </div>
                        </div>
                        <div>
                            <div style="font-weight: 700; margin-bottom: 4px;">STRIP ${this.pct(m.strips, m.totalSales)}%</div>
                            <div class="metric-details-item">
                                <span>Sales:</span><span>$${this.fmt(m.strips)}</span>
                            </div>
                            <div class="metric-details-item">
                                <span>Payouts:</span><span>$${this.fmt(m.stripPayouts)}</span>
                            </div>
                            <div class="metric-details-item">
                                <span>Net:</span><span>$${this.fmt(m.stripNet)}</span>
                            </div>
                            <div class="metric-details-item">
                                <span>Margin:</span><span>${m.stripMargin.toFixed(1)}%</span>
                            </div>
                            <div class="metric-details-item">
                                <span>RPA:</span><span>$${m.stripRPA.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Margin -->
                <div class="metric-section orange">
                    <div class="metric-label">Margin</div>
                    <div class="metric-value">${m.margin.toFixed(1)}%</div>
                    <div class="metric-details">
                        <div class="metric-details-item">
                            <span class="metric-details-label">Net Sales:</span>
                            <span>$${this.fmt(m.netRevenue)}</span>
                        </div>
                        <div class="metric-details-item">
                            <span class="metric-details-label">Total Sales:</span>
                            <span>$${this.fmt(m.totalSales)}</span>
                        </div>
                        <div class="metric-details-item">
                            <span class="metric-details-label">Total Payouts:</span>
                            <span>$${this.fmt(m.totalPayouts)}</span>
                        </div>
                        <div class="metric-details-item">
                            <span class="metric-details-label">Payout %:</span>
                            <span>${this.pct(m.totalPayouts, m.totalSales)}%</span>
                        </div>
                        <div class="metric-details-item">
                            <span class="metric-details-label">Net per Event:</span>
                            <span>$${this.fmt(m.netRevenue / m.eventCount)}</span>
                        </div>
                    </div>
                </div>

                <!-- RPA -->
                <div class="metric-section cyan">
                    <div class="metric-label">RPA</div>
                    <div class="metric-value">$${m.rpa.toFixed(2)}</div>
                    <div class="metric-details">
                        <div class="metric-details-item">
                            <span class="metric-details-label">Total Sales:</span>
                            <span>$${this.fmt(m.totalSales)}</span>
                        </div>
                        <div class="metric-details-item">
                            <span class="metric-details-label">Total Attendance:</span>
                            <span>${this.fmt(m.attendance, false)}</span>
                        </div>
                        <div class="metric-details-item">
                            <span class="metric-details-label">Flash/Att:</span>
                            <span>$${m.flashRPA.toFixed(2)} (${this.pct(m.flash, m.totalSales)}%)</span>
                        </div>
                        <div class="metric-details-item">
                            <span class="metric-details-label">Strip/Att:</span>
                            <span>$${m.stripRPA.toFixed(2)} (${this.pct(m.strips, m.totalSales)}%)</span>
                        </div>
                        <div class="metric-details-item">
                            <span class="metric-details-label">Paper/Att:</span>
                            <span>$${(m.paper / m.attendance).toFixed(2)} (${this.pct(m.paper, m.totalSales)}%)</span>
                        </div>
                        <div class="metric-details-item">
                            <span class="metric-details-label">Net/Att:</span>
                            <span>$${(m.netRevenue / m.attendance).toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                <!-- Profit/Event -->
                <div class="metric-section indigo">
                    <div class="metric-label">Profit/Event</div>
                    <div class="metric-value">$${this.fmt(m.profitPerEvent)}</div>
                    <div class="metric-details">
                        <div class="metric-details-item">
                            <span class="metric-details-label">Net Sales:</span>
                            <span>$${this.fmt(m.netRevenue)}</span>
                        </div>
                        <div class="metric-details-item">
                            <span class="metric-details-label">Total Events:</span>
                            <span>${m.eventCount}</span>
                        </div>
                        <div class="metric-details-item">
                            <span class="metric-details-label">Gross/Event:</span>
                            <span>$${this.fmt(m.totalSales / m.eventCount)}</span>
                        </div>
                        <div class="metric-details-item">
                            <span class="metric-details-label">Payouts/Event:</span>
                            <span>$${this.fmt(m.totalPayouts / m.eventCount)}</span>
                        </div>
                        <div class="metric-details-item">
                            <span class="metric-details-label">Avg Attendance:</span>
                            <span>${this.fmt(m.attendance / m.eventCount, false)}</span>
                        </div>
                    </div>
                </div>

                <!-- Attendance -->
                <div class="metric-section teal">
                    <div class="metric-label">Attendance</div>
                    <div class="metric-value">${this.fmt(m.attendance, false)} total</div>
                    <div class="metric-details">
                        <div class="metric-details-item">
                            <span class="metric-details-label">Total Attendance:</span>
                            <span>${this.fmt(m.attendance, false)}</span>
                        </div>
                        <div class="metric-details-item">
                            <span class="metric-details-label">Total Events:</span>
                            <span>${m.eventCount}</span>
                        </div>
                        <div class="metric-details-item">
                            <span class="metric-details-label">Avg/Event:</span>
                            <span>${this.fmt(m.attendance / m.eventCount, false)}</span>
                        </div>
                        <div class="metric-details-item">
                            <span class="metric-details-label">Daily Average:</span>
                            <span>${this.fmt(m.attendance / 30, false)}</span>
                        </div>
                        <div class="metric-details-item">
                            <span class="metric-details-label">RPA:</span>
                            <span>$${m.rpa.toFixed(2)}</span>
                        </div>
                        <div class="metric-details-item">
                            <span class="metric-details-label">Total Sales/Att:</span>
                            <span>$${m.rpa.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Format number with optional currency
     */
    fmt(val, isCurrency = true) {
        if (!val || isNaN(val)) return isCurrency ? '0' : '0';
        const rounded = Math.round(val);
        return rounded.toLocaleString();
    }

    /**
     * Calculate percentage
     */
    pct(part, whole) {
        if (!whole || whole === 0) return '0.0';
        return ((part / whole) * 100).toFixed(1);
    }
}

export const monthlyReportingView = new MonthlyReportingView();
