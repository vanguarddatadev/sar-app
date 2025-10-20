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

        const scrollContainer = container?.querySelector('.months-scroll-container');
        const cards = scrollContainer?.querySelectorAll('.month-card');
        if (cards && cards[this.currentMonthIndex] && scrollContainer) {
            // Get the target card and scroll container dimensions
            const targetCard = cards[this.currentMonthIndex];
            const containerRect = scrollContainer.getBoundingClientRect();
            const cardRect = targetCard.getBoundingClientRect();

            // Calculate the scroll position to center the card
            const scrollLeft = targetCard.offsetLeft - (containerRect.width / 2) + (cardRect.width / 2);

            scrollContainer.scrollTo({
                left: scrollLeft,
                behavior: 'smooth'
            });

            // Add highlight effect
            cards.forEach(card => card.classList.remove('active'));
            targetCard.classList.add('active');
        }
    }

    /**
     * Update navigation button states
     */
    updateNavigationButtons() {
        const isMonthlyView = document.getElementById('monthly-revenue-view')?.classList.contains('active');

        // Update top navigation (if exists)
        const prevBtnTop = isMonthlyView ? document.getElementById('monthNavPrevTopView') : document.getElementById('monthNavPrevTop');
        const nextBtnTop = isMonthlyView ? document.getElementById('monthNavNextTopView') : document.getElementById('monthNavNextTop');
        const currentSpanTop = isMonthlyView ? document.getElementById('monthNavCurrentTopView') : document.getElementById('monthNavCurrentTop');
        const totalSpanTop = isMonthlyView ? document.getElementById('monthNavTotalTopView') : document.getElementById('monthNavTotalTop');

        // Update card header navigation
        const prevBtnCard = isMonthlyView ? document.getElementById('monthNavPrevTopViewCard') : document.getElementById('monthNavPrevTopCard');
        const nextBtnCard = isMonthlyView ? document.getElementById('monthNavNextTopViewCard') : document.getElementById('monthNavNextTopCard');
        const currentSpanCard = isMonthlyView ? document.getElementById('monthNavCurrentTopViewCard') : document.getElementById('monthNavCurrentTopCard');
        const totalSpanCard = isMonthlyView ? document.getElementById('monthNavTotalTopViewCard') : document.getElementById('monthNavTotalTopCard');

        const isFirst = this.currentMonthIndex === 0;
        const isLast = this.currentMonthIndex === this.months.length - 1;

        // Update all buttons and spans
        [prevBtnTop, prevBtnCard].forEach(btn => { if (btn) btn.disabled = isFirst; });
        [nextBtnTop, nextBtnCard].forEach(btn => { if (btn) btn.disabled = isLast; });
        [currentSpanTop, currentSpanCard].forEach(span => { if (span) span.textContent = this.currentMonthIndex + 1; });
        [totalSpanTop, totalSpanCard].forEach(span => { if (span) span.textContent = this.months.length; });
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

            // Get current organization ID
            const organizationId = window.app?.currentOrganizationId;
            if (!organizationId) {
                throw new Error('No organization selected');
            }

            // Build query
            let query = supabase.client
                .from('sessions')
                .select('*')
                .eq('organization_id', organizationId)
                .eq('is_cancelled', false)
                .order('session_date', { ascending: true });

            // Apply location filter
            if (this.currentLocation !== 'COMBINED') {
                query = query.eq('location_code', this.currentLocation);
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

            // Add forecasted month if applicable
            const forecastMonth = this.generateForecastMonth(data, monthsWithMetrics);
            if (forecastMonth) {
                monthsWithMetrics.push(forecastMonth);
            }

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
            const sectionId = section.dataset.sectionId;

            // Initialize all sections as collapsed in the Set to match the HTML class
            this.collapsedSections.add(sectionId);

            section.addEventListener('click', () => {
                this.playSound();

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
        // Top navigation (tab view)
        document.getElementById('monthNavPrevTop')?.addEventListener('click', () => {
            this.navigateMonth('prev');
        });
        document.getElementById('monthNavNextTop')?.addEventListener('click', () => {
            this.navigateMonth('next');
        });

        // Top navigation (full page view)
        document.getElementById('monthNavPrevTopView')?.addEventListener('click', () => {
            this.navigateMonth('prev');
        });
        document.getElementById('monthNavNextTopView')?.addEventListener('click', () => {
            this.navigateMonth('next');
        });

        // Card header navigation (tab view)
        document.getElementById('monthNavPrevTopCard')?.addEventListener('click', () => {
            this.navigateMonth('prev');
        });
        document.getElementById('monthNavNextTopCard')?.addEventListener('click', () => {
            this.navigateMonth('next');
        });

        // Card header navigation (full page view)
        document.getElementById('monthNavPrevTopViewCard')?.addEventListener('click', () => {
            this.navigateMonth('prev');
        });
        document.getElementById('monthNavNextTopViewCard')?.addEventListener('click', () => {
            this.navigateMonth('next');
        });
    }

    /**
     * Generate forecast month based on existing events and 3-month averages
     * Forecasts the CURRENT month using real data for past events and projections for future events
     */
    generateForecastMonth(allSessions, monthsWithMetrics) {
        const now = new Date();
        const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const currentMonth = monthsWithMetrics.find(m => m.key === currentMonthKey);

        // Only generate forecast if we're currently in a month that has data
        if (!currentMonth) return null;

        // Get last 3 months of data for averaging (excluding current month)
        const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const recentSessions = allSessions.filter(s => {
            const sessionDate = new Date(s.session_date);
            return sessionDate >= threeMonthsAgo && sessionDate < currentMonthStart;
        });

        // Calculate averages by day of week from last 3 months
        const dayAverages = this.calculateDayAverages(recentSessions);

        // Get all actual sessions from current month (including events reported 2 days late)
        const actualCurrentMonthSessions = currentMonth.sessions;

        // Calculate which days of the month have already occurred (plus 2-day reporting buffer)
        const today = now.getDate();
        const reportingBuffer = 2; // Events can be reported 2 days late
        const cutoffDay = Math.max(1, today - reportingBuffer);

        // Get end of current month
        const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const daysInCurrentMonth = currentMonthEnd.getDate();

        // Count remaining days in current month by day of week
        const remainingDayDistribution = {};
        for (let day = cutoffDay + 1; day <= daysInCurrentMonth; day++) {
            const date = new Date(now.getFullYear(), now.getMonth(), day);
            const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
            remainingDayDistribution[dayName] = (remainingDayDistribution[dayName] || 0) + 1;
        }

        // Generate forecast sessions for remaining days
        const forecastSessions = [...actualCurrentMonthSessions]; // Start with real data
        const location = this.currentLocation === 'COMBINED' ? ['SC', 'RWC'] : [this.currentLocation];

        Object.entries(remainingDayDistribution).forEach(([dayName, count]) => {
            const avgForDay = dayAverages[dayName];
            if (avgForDay && avgForDay.eventCount > 0) {
                // Calculate expected number of events for this day
                const eventsPerOccurrence = avgForDay.eventCount / avgForDay.occurrences;
                const expectedEvents = Math.round(eventsPerOccurrence * count);

                // Create forecast sessions for remaining days
                for (let i = 0; i < expectedEvents; i++) {
                    forecastSessions.push({
                        session_date: currentMonthKey + '-01', // Placeholder date
                        day_of_week: dayName,
                        location: location[i % location.length],
                        total_sales: avgForDay.avgTotalSales,
                        total_payouts: avgForDay.avgTotalPayouts,
                        net_revenue: avgForDay.avgNetRevenue,
                        attendance: avgForDay.avgAttendance,
                        flash_sales: avgForDay.avgFlash,
                        strip_sales: avgForDay.avgStrip,
                        paper_sales: avgForDay.avgPaper,
                        cherry_sales: avgForDay.avgCherries,
                        flash_payouts: avgForDay.avgFlashPayouts,
                        strip_payouts: avgForDay.avgStripPayouts,
                        paper_payouts: avgForDay.avgPaperPayouts
                    });
                }
            }
        });

        // Only generate forecast if we have projected sessions (not just actual data)
        if (forecastSessions.length === actualCurrentMonthSessions.length) return null;

        // Calculate metrics for combined actual + forecast
        const forecastMetrics = this.calculateMetrics(forecastSessions);

        // Get previous FULL month for change calculation (skip the current partial month)
        // The forecast should compare to the last complete month, not the current partial month
        const currentMonthIndex = monthsWithMetrics.findIndex(m => m.key === currentMonthKey);
        const prevFullMonthIndex = currentMonthIndex - 1;
        const prevMonth = prevFullMonthIndex >= 0 ? monthsWithMetrics[prevFullMonthIndex] : null;
        const changes = prevMonth ? this.calculateChanges(prevMonth.metrics, forecastMetrics) : null;

        const currentMonthName = now.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

        return {
            key: currentMonthKey + '-forecast',
            name: currentMonthName + ' (Forecast)',
            sessions: forecastSessions,
            metrics: forecastMetrics,
            changes,
            isForecast: true,
            actualEvents: actualCurrentMonthSessions.length,
            projectedEvents: forecastSessions.length - actualCurrentMonthSessions.length
        };
    }

    /**
     * Calculate 3-month averages by day of week
     */
    calculateDayAverages(sessions) {
        const dayStats = {};

        sessions.forEach(session => {
            const date = new Date(session.session_date);
            const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });

            if (!dayStats[dayName]) {
                dayStats[dayName] = {
                    eventCount: 0,
                    occurrences: 0,
                    totalSales: 0,
                    totalPayouts: 0,
                    netRevenue: 0,
                    attendance: 0,
                    flash: 0,
                    strip: 0,
                    paper: 0,
                    cherries: 0,
                    flashPayouts: 0,
                    stripPayouts: 0,
                    paperPayouts: 0
                };
            }

            const stats = dayStats[dayName];
            stats.eventCount++;
            stats.totalSales += parseFloat(session.total_sales || 0);
            stats.totalPayouts += parseFloat(session.total_payouts || 0);
            stats.netRevenue += parseFloat(session.net_revenue || 0);
            stats.attendance += parseInt(session.attendance || 0);
            stats.flash += parseFloat(session.flash_sales || 0);
            stats.strip += parseFloat(session.strip_sales || 0);
            stats.paper += parseFloat(session.paper_sales || 0);
            stats.cherries += parseFloat(session.cherry_sales || 0);
            stats.flashPayouts += parseFloat(session.flash_payouts || 0);
            stats.stripPayouts += parseFloat(session.strip_payouts || 0);
            stats.paperPayouts += parseFloat(session.paper_payouts || 0);
        });

        // Calculate averages and count unique weeks
        const dayAverages = {};
        Object.entries(dayStats).forEach(([dayName, stats]) => {
            // Count occurrences by counting unique weeks
            const weeksSet = new Set();
            sessions.forEach(session => {
                const date = new Date(session.session_date);
                if (date.toLocaleDateString('en-US', { weekday: 'long' }) === dayName) {
                    const weekKey = this.getWeekKey(date);
                    weeksSet.add(weekKey);
                }
            });

            const occurrences = weeksSet.size || 1;

            dayAverages[dayName] = {
                eventCount: stats.eventCount,
                occurrences,
                avgTotalSales: stats.totalSales / stats.eventCount,
                avgTotalPayouts: stats.totalPayouts / stats.eventCount,
                avgNetRevenue: stats.netRevenue / stats.eventCount,
                avgAttendance: stats.attendance / stats.eventCount,
                avgFlash: stats.flash / stats.eventCount,
                avgStrip: stats.strip / stats.eventCount,
                avgPaper: stats.paper / stats.eventCount,
                avgCherries: stats.cherries / stats.eventCount,
                avgFlashPayouts: stats.flashPayouts / stats.eventCount,
                avgStripPayouts: stats.stripPayouts / stats.eventCount,
                avgPaperPayouts: stats.paperPayouts / stats.eventCount
            };
        });

        return dayAverages;
    }

    /**
     * Get week key for grouping (Year-Week)
     */
    getWeekKey(date) {
        const year = date.getFullYear();
        const week = this.getWeekNumber(date);
        return `${year}-W${week}`;
    }

    /**
     * Get ISO week number
     */
    getWeekNumber(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
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

        // Set current month index to the last month (most recent)
        this.currentMonthIndex = months.length - 1;
        this.months = months;

        const monthsHTML = months.map((month, index) => this.createMonthCard(month, index === this.currentMonthIndex)).join('');

        container.innerHTML = '<div class="months-scroll-container">' + monthsHTML + '</div>';

        // Update navigation buttons
        this.updateNavigationButtons();

        // Scroll to the right (showing most recent months) and maintain this position
        setTimeout(() => {
            const scrollContainer = container.querySelector('.months-scroll-container');
            if (scrollContainer) {
                const targetScrollLeft = scrollContainer.scrollWidth - scrollContainer.clientWidth;
                scrollContainer.scrollLeft = targetScrollLeft;

                // Store the scroll position to restore it if needed
                this.lastScrollLeft = targetScrollLeft;
            }
        }, 0);
    }

    /**
     * Create HTML for a single month card with all metrics
     */
    createMonthCard(month, isActive = false) {
        const m = month.metrics;
        const c = month.changes;
        const isForecast = month.isForecast || false;

        // Determine if this is the current (partial) month
        const now = new Date();
        const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const isCurrentMonth = month.key === currentMonthKey && !isForecast;

        // Don't show changes for current partial month, but DO show them for forecast
        const showChanges = !isCurrentMonth;

        return `
            <div class="month-card ${isActive ? 'active' : ''} ${isForecast ? 'forecast' : ''}" data-month="${month.key}">
                <div class="month-header ${isForecast ? 'forecast-header' : ''}">
                    <div class="month-name">${month.name}</div>
                    <div class="month-meta">${m.eventCount} Events (${isForecast ? 'Projected' : 'Actual'})</div>
                </div>

                <!-- Total Sales -->
                <div class="metric-section blue collapsed" data-section-id="${month.key}-sales">
                    <div class="metric-label">TOTAL SALES</div>
                    <div class="metric-value">$${this.fmt(m.totalSales)}</div>
                    ${showChanges ? this.renderChange(c?.totalSales, true) : '<div class="metric-change"></div>'}
                    <div class="metric-details">
                        <div class="metric-details-item">
                            <span class="metric-details-label">Flash:</span>
                            <span>$${this.fmt(m.flash)}</span>
                        </div>
                        <div class="metric-details-item">
                            <span class="metric-details-label">Strip:</span>
                            <span>$${this.fmt(m.strips)}</span>
                        </div>
                        <div class="metric-details-item">
                            <span class="metric-details-label">Paper:</span>
                            <span>$${this.fmt(m.paper)}</span>
                        </div>
                        <div class="metric-details-item">
                            <span class="metric-details-label">Cherries:</span>
                            <span>$${this.fmt(m.cherries)}</span>
                        </div>
                    </div>
                </div>

                <!-- Total Payouts -->
                <div class="metric-section red collapsed" data-section-id="${month.key}-payouts">
                    <div class="metric-label">TOTAL PAYOUTS</div>
                    <div class="metric-value">$${this.fmt(m.totalPayouts)}</div>
                    ${showChanges ? this.renderChange(c?.totalPayouts, true) : '<div class="metric-change"></div>'}
                    <div class="metric-details">
                        <div class="metric-details-item">
                            <span class="metric-details-label">Flash:</span>
                            <span>$${this.fmt(m.flashPayouts)}</span>
                        </div>
                        <div class="metric-details-item">
                            <span class="metric-details-label">Strip:</span>
                            <span>$${this.fmt(m.stripPayouts)}</span>
                        </div>
                        <div class="metric-details-item">
                            <span class="metric-details-label">Paper:</span>
                            <span>$${this.fmt(m.paperPayouts)}</span>
                        </div>
                    </div>
                </div>

                <!-- Net Sales -->
                <div class="metric-section green collapsed" data-section-id="${month.key}-net">
                    <div class="metric-label">NET SALES</div>
                    <div class="metric-value">$${this.fmt(m.netRevenue)}</div>
                    ${showChanges ? this.renderChange(c?.netRevenue, true) : '<div class="metric-change"></div>'}
                    <div class="metric-details">
                        <div class="metric-details-item">
                            <span class="metric-details-label">Flash Net:</span>
                            <span>$${this.fmt(m.flashNet)}</span>
                        </div>
                        <div class="metric-details-item">
                            <span class="metric-details-label">Strip Net:</span>
                            <span>$${this.fmt(m.stripNet)}</span>
                        </div>
                        <div class="metric-details-item">
                            <span class="metric-details-label">Flash Margin:</span>
                            <span>${m.flashMargin.toFixed(1)}%</span>
                        </div>
                        <div class="metric-details-item">
                            <span class="metric-details-label">Strip Margin:</span>
                            <span>${m.stripMargin.toFixed(1)}%</span>
                        </div>
                    </div>
                </div>

                <!-- Products (Flash and Strip on separate rows) -->
                <div class="metric-section purple collapsed" data-section-id="${month.key}-products">
                    <div class="metric-label">PRODUCTS</div>
                    <div class="products-grid">
                        <div class="product-row">
                            <span class="product-label">Flash: ${this.pct(m.flash, m.totalSales)}%</span>
                            ${showChanges ? this.renderChange(c?.flashPct, false, true) : '<div class="metric-change"></div>'}
                        </div>
                        <div class="product-row">
                            <span class="product-label">Strip: ${this.pct(m.strips, m.totalSales)}%</span>
                            ${showChanges ? this.renderChange(c?.stripPct, false, true) : '<div class="metric-change"></div>'}
                        </div>
                    </div>
                    <div class="metric-details">
                        <div class="metric-details-item">
                            <span class="metric-details-label">Flash Sales:</span>
                            <span>$${this.fmt(m.flash)}</span>
                        </div>
                        <div class="metric-details-item">
                            <span class="metric-details-label">Flash RPA:</span>
                            <span>$${m.flashRPA.toFixed(2)}</span>
                        </div>
                        <div class="metric-details-item">
                            <span class="metric-details-label">Strip Sales:</span>
                            <span>$${this.fmt(m.strips)}</span>
                        </div>
                        <div class="metric-details-item">
                            <span class="metric-details-label">Strip RPA:</span>
                            <span>$${m.stripRPA.toFixed(2)}</span>
                        </div>
                        <div class="metric-details-item">
                            <span class="metric-details-label">Paper:</span>
                            <span>$${this.fmt(m.paper)} (${this.pct(m.paper, m.totalSales)}%)</span>
                        </div>
                        <div class="metric-details-item">
                            <span class="metric-details-label">Cherries:</span>
                            <span>$${this.fmt(m.cherries)} (${this.pct(m.cherries, m.totalSales)}%)</span>
                        </div>
                    </div>
                </div>

                <!-- Margin -->
                <div class="metric-section orange collapsed" data-section-id="${month.key}-margin">
                    <div class="metric-label">MARGIN</div>
                    <div class="metric-value">${m.margin.toFixed(1)}%</div>
                    ${showChanges ? this.renderChange(c?.margin, false, true) : '<div class="metric-change"></div>'}
                    <div class="metric-details">
                        <div class="metric-details-item">
                            <span class="metric-details-label">Flash Margin:</span>
                            <span>${m.flashMargin.toFixed(1)}%</span>
                        </div>
                        <div class="metric-details-item">
                            <span class="metric-details-label">Strip Margin:</span>
                            <span>${m.stripMargin.toFixed(1)}%</span>
                        </div>
                        <div class="metric-details-item">
                            <span class="metric-details-label">Total Sales:</span>
                            <span>$${this.fmt(m.totalSales)}</span>
                        </div>
                        <div class="metric-details-item">
                            <span class="metric-details-label">Net Revenue:</span>
                            <span>$${this.fmt(m.netRevenue)}</span>
                        </div>
                    </div>
                </div>

                <!-- RPA -->
                <div class="metric-section cyan collapsed" data-section-id="${month.key}-rpa">
                    <div class="metric-label">RPA</div>
                    <div class="metric-value">$${m.rpa.toFixed(2)}</div>
                    ${showChanges ? this.renderChange(c?.rpa, true) : '<div class="metric-change"></div>'}
                    <div class="metric-details">
                        <div class="metric-details-item">
                            <span class="metric-details-label">Flash RPA:</span>
                            <span>$${m.flashRPA.toFixed(2)}</span>
                        </div>
                        <div class="metric-details-item">
                            <span class="metric-details-label">Strip RPA:</span>
                            <span>$${m.stripRPA.toFixed(2)}</span>
                        </div>
                        <div class="metric-details-item">
                            <span class="metric-details-label">Total Sales:</span>
                            <span>$${this.fmt(m.totalSales)}</span>
                        </div>
                        <div class="metric-details-item">
                            <span class="metric-details-label">Attendance:</span>
                            <span>${this.fmt(m.attendance, false)}</span>
                        </div>
                    </div>
                </div>

                <!-- Profit/Event -->
                <div class="metric-section indigo collapsed" data-section-id="${month.key}-profit">
                    <div class="metric-label">PROFIT/EVENT</div>
                    <div class="metric-value">$${this.fmt(m.profitPerEvent)}</div>
                    ${showChanges ? this.renderChange(c?.profitPerEvent, true) : '<div class="metric-change"></div>'}
                    <div class="metric-details">
                        <div class="metric-details-item">
                            <span class="metric-details-label">Net Revenue:</span>
                            <span>$${this.fmt(m.netRevenue)}</span>
                        </div>
                        <div class="metric-details-item">
                            <span class="metric-details-label">Events:</span>
                            <span>${m.eventCount}</span>
                        </div>
                        <div class="metric-details-item">
                            <span class="metric-details-label">Total Sales:</span>
                            <span>$${this.fmt(m.totalSales)}</span>
                        </div>
                        <div class="metric-details-item">
                            <span class="metric-details-label">Total Payouts:</span>
                            <span>$${this.fmt(m.totalPayouts)}</span>
                        </div>
                    </div>
                </div>

                <!-- Attendance -->
                <div class="metric-section teal collapsed" data-section-id="${month.key}-attendance">
                    <div class="metric-label">ATTENDANCE</div>
                    <div class="metric-value">${this.fmt(m.attendance, false)}</div>
                    ${showChanges ? this.renderChange(c?.attendance, true) : '<div class="metric-change"></div>'}
                    <div class="metric-details">
                        <div class="metric-details-item">
                            <span class="metric-details-label">Events:</span>
                            <span>${m.eventCount}</span>
                        </div>
                        <div class="metric-details-item">
                            <span class="metric-details-label">Avg/Event:</span>
                            <span>${m.eventCount > 0 ? Math.round(m.attendance / m.eventCount) : 0}</span>
                        </div>
                        <div class="metric-details-item">
                            <span class="metric-details-label">RPA:</span>
                            <span>$${m.rpa.toFixed(2)}</span>
                        </div>
                    </div>
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
