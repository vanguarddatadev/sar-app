// Monthly Reporting View Controller
// Handles detailed monthly aggregated metrics display

import { supabase } from '../core/supabase-client.js';

class MonthlyReportingView {
    constructor() {
        this.currentLocation = 'SC';
        this.currentPeriod = 'monthly';
        this.months = [];
        this.currentMonthIndex = 0;
        this.collapsedSections = new Set(); // Track which sections are collapsed

        // Sound effects using Web Audio API (same as App.html)
        this.audioContext = null;
        this.volume = 0.3;
        this.initAudio();
    }

    /**
     * Initialize audio context
     */
    initAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.log('Web Audio API not supported');
        }
    }

    /**
     * Play soft click sound (from App.html)
     */
    playSound() {
        if (!this.audioContext) return;

        try {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            osc.connect(gain);
            gain.connect(this.audioContext.destination);
            osc.frequency.value = 800;
            gain.gain.value = this.volume * 0.2;
            gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.05);
            osc.start();
            osc.stop(this.audioContext.currentTime + 0.05);
        } catch (e) {
            // Ignore audio errors
        }
    }

    /**
     * Initialize the monthly reporting view
     */
    async init() {
        console.log('Initializing Monthly Reporting view...');

        // Set up filter handlers
        this.setupFilters();

        // Set up keyboard navigation
        this.setupKeyboardNavigation();

        // Load data
        await this.loadData();
    }

    /**
     * Set up keyboard navigation
     */
    setupKeyboardNavigation() {
        // Remove old listener if exists
        if (this.keyboardHandler) {
            document.removeEventListener('keydown', this.keyboardHandler);
        }

        this.keyboardHandler = (e) => {
            // Only handle if monthly reporting view is active
            const isActive = document.getElementById('monthly-revenue-view')?.classList.contains('active') ||
                           document.getElementById('monthly-reporting-tab')?.classList.contains('active');

            if (!isActive) return;

            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                this.navigateMonth('prev');
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                this.navigateMonth('next');
            }
        };

        document.addEventListener('keydown', this.keyboardHandler);
    }

    /**
     * Navigate between months
     */
    navigateMonth(direction) {
        this.playSound();

        if (direction === 'prev' && this.currentMonthIndex > 0) {
            this.currentMonthIndex--;
        } else if (direction === 'next' && this.currentMonthIndex < this.months.length - 1) {
            this.currentMonthIndex++;
        }

        // Update navigation buttons
        this.updateNavigationButtons();

        // Scroll to the current month card
        const container = document.getElementById('monthly-revenue-view')?.classList.contains('active')
            ? document.getElementById('monthlyRevenueReportingContainer')
            : document.getElementById('monthlyReportingContainer');

        const cards = container?.querySelectorAll('.month-card');
        if (cards && cards[this.currentMonthIndex]) {
            cards[this.currentMonthIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });

            // Add highlight effect
            cards.forEach(card => card.classList.remove('active'));
            cards[this.currentMonthIndex].classList.add('active');
        }
    }

    /**
     * Update navigation button states
     */
    updateNavigationButtons() {
        const isMonthlyView = document.getElementById('monthly-revenue-view')?.classList.contains('active');
        const prevBtn = isMonthlyView ? document.getElementById('monthNavPrevTopView') : document.getElementById('monthNavPrevTop');
        const nextBtn = isMonthlyView ? document.getElementById('monthNavNextTopView') : document.getElementById('monthNavNextTop');
        const currentSpan = isMonthlyView ? document.getElementById('monthNavCurrentTopView') : document.getElementById('monthNavCurrentTop');
        const totalSpan = isMonthlyView ? document.getElementById('monthNavTotalTopView') : document.getElementById('monthNavTotalTop');

        if (prevBtn) {
            prevBtn.disabled = this.currentMonthIndex === 0;
        }
        if (nextBtn) {
            nextBtn.disabled = this.currentMonthIndex === this.months.length - 1;
        }
        if (currentSpan) {
            currentSpan.textContent = this.currentMonthIndex + 1;
        }
        if (totalSpan) {
            totalSpan.textContent = this.months.length;
        }
    }

    /**
     * Set up filter button handlers
     */
    setupFilters() {
        // Location filter
        document.querySelectorAll('.monthly-location-filter').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.playSound();
                document.querySelectorAll('.monthly-location-filter').forEach(b => {
                    b.classList.remove('active');
                });
                e.target.classList.add('active');
                this.currentLocation = e.target.dataset.location;
                this.currentMonthIndex = 0; // Reset to first month
                this.collapsedSections.clear(); // Reset collapsed state
                this.loadData();
            });
        });

        // Period filter
        document.querySelectorAll('.monthly-period-filter').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.playSound();
                document.querySelectorAll('.monthly-period-filter').forEach(b => {
                    b.classList.remove('active');
                });
                e.target.classList.add('active');
                this.currentPeriod = e.target.dataset.period;
                this.currentMonthIndex = 0; // Reset to first month
                this.collapsedSections.clear(); // Reset collapsed state
                this.loadData();
            });
        });
    }

    /**
     * Load session data and aggregate by month
     */
    async loadData() {
        // Check which view is active and use the appropriate container
        const container = document.getElementById('monthly-revenue-view')?.classList.contains('active')
            ? document.getElementById('monthlyRevenueReportingContainer')
            : document.getElementById('monthlyReportingContainer');

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

            // Convert to array and sort (OLDEST FIRST - ascending order)
            this.months = Array.from(monthsMap.values()).sort((a, b) => a.key.localeCompare(b.key));

            console.log('📅 Grouped into', this.months.length, 'months');

            // Calculate metrics for each month
            const monthsWithMetrics = this.months.map((month, index, array) => {
                const metrics = this.calculateMetrics(month.sessions);

                // Calculate changes from previous month
                let changes = null;
                if (index > 0) {
                    const prevMetrics = this.calculateMetrics(array[index - 1].sessions);
                    changes = this.calculateChanges(prevMetrics, metrics);
                }

                return {
                    ...month,
                    metrics,
                    changes
                };
            });

            // Render
            this.renderMonths(monthsWithMetrics);

            // Set up navigation button handlers
            this.setupNavigationHandlers();

            // Set up click handlers for metric sections
            this.setupMetricSectionHandlers();

        } catch (err) {
            console.error('Error loading monthly data:', err);
            container.innerHTML = `<div class="empty-state" style="color: var(--danger-color);">Error: ${err.message}</div>`;
        }
    }

    /**
     * Set up click handlers for metric sections to expand/collapse
     */
    setupMetricSectionHandlers() {
        document.querySelectorAll('.metric-section').forEach(section => {
            section.addEventListener('click', () => {
                this.playSound();
                const sectionId = section.dataset.sectionId;

                if (this.collapsedSections.has(sectionId)) {
                    this.collapsedSections.delete(sectionId);
                    section.classList.remove('collapsed');
                } else {
                    this.collapsedSections.add(sectionId);
                    section.classList.add('collapsed');
                }
            });
        });
    }

    /**
     * Calculate changes between two months
     */
    calculateChanges(prevMetrics, currentMetrics) {
        const changes = {};

        // Total Sales change
        changes.totalSales = this.calculateChange(prevMetrics.totalSales, currentMetrics.totalSales);

        // Total Payouts change
        changes.totalPayouts = this.calculateChange(prevMetrics.totalPayouts, currentMetrics.totalPayouts);

        // Net Sales change
        changes.netRevenue = this.calculateChange(prevMetrics.netRevenue, currentMetrics.netRevenue);

        // Products - Flash change (percentage points)
        const prevFlashPct = prevMetrics.totalSales > 0 ? (prevMetrics.flash / prevMetrics.totalSales * 100) : 0;
        const currFlashPct = currentMetrics.totalSales > 0 ? (currentMetrics.flash / currentMetrics.totalSales * 100) : 0;
        changes.flashPct = currFlashPct - prevFlashPct;

        // Products - Strip change (percentage points)
        const prevStripPct = prevMetrics.totalSales > 0 ? (prevMetrics.strips / prevMetrics.totalSales * 100) : 0;
        const currStripPct = currentMetrics.totalSales > 0 ? (currentMetrics.strips / currentMetrics.totalSales * 100) : 0;
        changes.stripPct = currStripPct - prevStripPct;

        // Margin change (percentage points)
        changes.margin = currentMetrics.margin - prevMetrics.margin;

        // RPA change
        changes.rpa = this.calculateChange(prevMetrics.rpa, currentMetrics.rpa);

        // Profit/Event change
        changes.profitPerEvent = this.calculateChange(prevMetrics.profitPerEvent, currentMetrics.profitPerEvent);

        // Attendance change
        changes.attendance = this.calculateChange(prevMetrics.attendance, currentMetrics.attendance);

        return changes;
    }

    /**
     * Calculate percentage change between two values
     */
    calculateChange(oldVal, newVal) {
        if (!oldVal || oldVal === 0) return 0;
        return ((newVal - oldVal) / oldVal * 100);
    }

    /**
     * Set up navigation button handlers
     */
    setupNavigationHandlers() {
        // For tab view
        document.getElementById('monthNavPrevTop')?.addEventListener('click', () => {
            this.navigateMonth('prev');
        });

        document.getElementById('monthNavNextTop')?.addEventListener('click', () => {
            this.navigateMonth('next');
        });

        // For full page view
        document.getElementById('monthNavPrevTopView')?.addEventListener('click', () => {
            this.navigateMonth('prev');
        });

        document.getElementById('monthNavNextTopView')?.addEventListener('click', () => {
            this.navigateMonth('next');
        });
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
        // Check which view is active and use the appropriate container
        const container = document.getElementById('monthly-revenue-view')?.classList.contains('active')
            ? document.getElementById('monthlyRevenueReportingContainer')
            : document.getElementById('monthlyReportingContainer');

        if (months.length === 0) {
            container.innerHTML = '<div class="empty-state">No data available for the selected filters</div>';
            return;
        }

        const monthsHTML = months.map((month, index) => this.createMonthCard(month, index === this.currentMonthIndex)).join('');

        container.innerHTML = '<div class="months-scroll-container">' + monthsHTML + '</div>';

        // Update navigation buttons
        this.updateNavigationButtons();
    }

    /**
     * Create HTML for a single month card with all metrics
     */
    createMonthCard(month, isActive = false) {
        const m = month.metrics;
        const c = month.changes;

        return `
            <div class="month-card ${isActive ? 'active' : ''}" data-month="${month.key}">
                <div class="month-header">
                    <div class="month-name">${month.name}</div>
                    <div class="month-meta">${m.eventCount} Events</div>
                </div>

                <!-- Total Sales -->
                <div class="metric-section blue collapsed" data-section-id="${month.key}-sales">
                    <div class="metric-label">TOTAL SALES</div>
                    <div class="metric-value">$${this.fmt(m.totalSales)}</div>
                    ${this.renderChange(c?.totalSales, true)}
                </div>

                <!-- Total Payouts -->
                <div class="metric-section red collapsed" data-section-id="${month.key}-payouts">
                    <div class="metric-label">TOTAL PAYOUTS</div>
                    <div class="metric-value">$${this.fmt(m.totalPayouts)}</div>
                    ${this.renderChange(c?.totalPayouts, true)}
                </div>

                <!-- Net Sales -->
                <div class="metric-section green collapsed" data-section-id="${month.key}-net">
                    <div class="metric-label">NET SALES</div>
                    <div class="metric-value">$${this.fmt(m.netRevenue)}</div>
                    ${this.renderChange(c?.netRevenue, true)}
                </div>

                <!-- Products (Flash and Strip on separate rows) -->
                <div class="metric-section purple collapsed" data-section-id="${month.key}-products">
                    <div class="metric-label">PRODUCTS</div>
                    <div class="products-grid">
                        <div class="product-row">
                            <span class="product-label">Flash: ${this.pct(m.flash, m.totalSales)}%</span>
                            ${this.renderChange(c?.flashPct, false, true)}
                        </div>
                        <div class="product-row">
                            <span class="product-label">Strip: ${this.pct(m.strips, m.totalSales)}%</span>
                            ${this.renderChange(c?.stripPct, false, true)}
                        </div>
                    </div>
                </div>

                <!-- Margin -->
                <div class="metric-section orange collapsed" data-section-id="${month.key}-margin">
                    <div class="metric-label">MARGIN</div>
                    <div class="metric-value">${m.margin.toFixed(1)}%</div>
                    ${this.renderChange(c?.margin, false, true)}
                </div>

                <!-- RPA -->
                <div class="metric-section cyan collapsed" data-section-id="${month.key}-rpa">
                    <div class="metric-label">RPA</div>
                    <div class="metric-value">$${m.rpa.toFixed(2)}</div>
                    ${this.renderChange(c?.rpa, true)}
                </div>

                <!-- Profit/Event -->
                <div class="metric-section indigo collapsed" data-section-id="${month.key}-profit">
                    <div class="metric-label">PROFIT/EVENT</div>
                    <div class="metric-value">$${this.fmt(m.profitPerEvent)}</div>
                    ${this.renderChange(c?.profitPerEvent, true)}
                </div>

                <!-- Attendance -->
                <div class="metric-section teal collapsed" data-section-id="${month.key}-attendance">
                    <div class="metric-label">ATTENDANCE</div>
                    <div class="metric-value">${this.fmt(m.attendance, false)}</div>
                    ${this.renderChange(c?.attendance, true)}
                </div>
            </div>
        `;
    }

    /**
     * Render change indicator
     */
    renderChange(change, isPercentage = true, isPercentagePoints = false) {
        if (change === null || change === undefined) {
            return '<div class="metric-change"></div>';
        }

        const isPositive = change > 0;
        const isNegative = change < 0;
        const arrow = isPositive ? '↑' : isNegative ? '↓' : '';
        const colorClass = isPositive ? 'positive' : isNegative ? 'negative' : 'neutral';

        const formattedValue = isPercentagePoints
            ? `${Math.abs(change).toFixed(1)}pp`
            : isPercentage
                ? `${Math.abs(change).toFixed(1)}%`
                : Math.abs(change).toFixed(1);

        return `
            <div class="metric-change ${colorClass}">
                ${arrow} ${formattedValue}
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
