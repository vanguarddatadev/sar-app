// Session Daily View Controller
// Handles individual session comparison against filtered pool of events

import { supabase } from '../core/supabase-client.js';

class SessionDailyView {
    constructor() {
        this.currentEvent = null;
        this.allEvents = [];
        this.eventsByLocation = {}; // Events grouped by location
        this.comparisonPeriod = '3M'; // '1M', '3M', '1Y'
        this.dayOnlyFilter = false;
        this.hotballFilter = 'none'; // 'none', 'category', '10%', '20%'
        this.comparisonPool = []; // Filtered comparison pool

        // Sound effects using Web Audio API
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
     * Play soft click sound
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
     * Initialize the view
     */
    async init() {
        console.log('Initializing Session Daily view...');
        await this.loadEvents();
        this.setupFilterHandlers();
        this.setupCardHandlers();
    }

    /**
     * Load all events from database
     */
    async loadEvents() {
        try {
            const { data, error } = await supabase.client
                .from('sessions')
                .select('*')
                .eq('is_cancelled', false)
                .order('session_date', { ascending: false });

            if (error) throw error;

            this.allEvents = data.map(session => this.normalizeEvent(session));

            // Group by location
            this.eventsByLocation = {};
            this.allEvents.forEach(event => {
                if (!this.eventsByLocation[event.location]) {
                    this.eventsByLocation[event.location] = [];
                }
                this.eventsByLocation[event.location].push(event);
            });

            console.log(`📊 Loaded ${this.allEvents.length} events for Session Daily view`);

            // Select most recent event
            if (this.allEvents.length > 0) {
                this.selectEvent(this.allEvents[0]);
            }

            // Render event selector buttons
            this.renderEventButtons();

        } catch (err) {
            console.error('Error loading events:', err);
        }
    }

    /**
     * Normalize session data to event object
     */
    normalizeEvent(session) {
        const date = new Date(session.session_date);

        return {
            id: session.id,
            date: session.session_date,
            location: session.location,
            day: session.day_of_week,
            sessionType: session.session_type || 'Regular Session',
            isLate: session.session_type?.toLowerCase().includes('late') || false,

            // Financial metrics
            totalSales: parseFloat(session.total_sales || 0),
            totalPayouts: parseFloat(session.total_payouts || 0),
            netSales: parseFloat(session.net_revenue || 0),
            margin: parseFloat(session.total_sales || 0) > 0
                ? (parseFloat(session.net_revenue || 0) / parseFloat(session.total_sales || 0) * 100)
                : 0,

            // Attendance
            attendance: parseInt(session.attendance || 0),
            rpa: parseInt(session.attendance || 0) > 0
                ? parseFloat(session.total_sales || 0) / parseInt(session.attendance || 0)
                : 0,

            // Product breakdown
            flash: parseFloat(session.flash_sales || 0),
            strip: parseFloat(session.strip_sales || 0),

            // Display name
            displayName: `${session.location} - ${session.day_of_week} ${date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}`
        };
    }

    /**
     * Select an event to compare
     */
    selectEvent(event) {
        this.playSound();
        this.currentEvent = event;

        // Update active button
        document.querySelectorAll('.session-event-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.eventId === event.id);
        });

        // Update comparison
        this.updateComparison();
    }

    /**
     * Render event selector buttons (top 4 most recent)
     */
    renderEventButtons() {
        const recentEvents = this.allEvents.slice(0, 4);
        const container = document.getElementById('sessionEventButtons');

        if (!container) return;

        const buttonsHTML = recentEvents.map((event, index) => `
            <button class="btn btn-secondary session-event-btn ${index === 0 ? 'active' : ''}"
                    data-event-id="${event.id}">
                ${event.displayName}
            </button>
        `).join('');

        container.innerHTML = buttonsHTML;

        // Add click handlers
        document.querySelectorAll('.session-event-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const eventId = btn.dataset.eventId;
                const event = this.allEvents.find(e => e.id === eventId);
                if (event) this.selectEvent(event);
            });
        });
    }

    /**
     * Set up filter button handlers
     */
    setupFilterHandlers() {
        // Period buttons
        document.querySelectorAll('.session-period-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.playSound();
                document.querySelectorAll('.session-period-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.comparisonPeriod = btn.dataset.period;
                this.updateComparison();
            });
        });

        // Day Only checkbox
        const dayOnlyCheckbox = document.getElementById('sessionDayOnlyFilter');
        if (dayOnlyCheckbox) {
            dayOnlyCheckbox.addEventListener('change', (e) => {
                this.playSound();
                this.dayOnlyFilter = e.target.checked;
                this.updateComparison();
            });
        }

        // Hotball filter
        const hotballSelect = document.getElementById('sessionHotballFilter');
        if (hotballSelect) {
            hotballSelect.addEventListener('change', (e) => {
                this.playSound();
                this.hotballFilter = e.target.value;
                this.updateComparison();
            });
        }
    }

    /**
     * Set up metric card expand/collapse handlers
     */
    setupCardHandlers() {
        document.querySelectorAll('.session-metric-card').forEach(card => {
            card.addEventListener('click', () => {
                this.playSound();
                card.classList.toggle('expanded');
            });
        });
    }

    /**
     * Get filtered comparison pool
     */
    getComparisonPool() {
        if (!this.currentEvent) return [];

        // Start with events from same location
        let pool = [...(this.eventsByLocation[this.currentEvent.location] || [])];

        // Filter by time period
        const currentDate = new Date(this.currentEvent.date);
        let startDate = new Date(currentDate);

        switch(this.comparisonPeriod) {
            case '1M':
                startDate.setDate(startDate.getDate() - 30);
                break;
            case '3M':
                startDate.setDate(startDate.getDate() - 90);
                break;
            case '1Y':
                startDate.setDate(startDate.getDate() - 365);
                break;
        }

        pool = pool.filter(event => {
            const eventDate = new Date(event.date);
            return eventDate >= startDate && eventDate < currentDate;
        });

        // Filter by day/session type if enabled
        if (this.dayOnlyFilter) {
            pool = pool.filter(event => {
                const dayMatch = event.day?.toLowerCase() === this.currentEvent.day?.toLowerCase();
                const sessionMatch = event.isLate === this.currentEvent.isLate;
                return dayMatch && sessionMatch;
            });
        }

        // Hotball filter (placeholder - implement based on your hotball data)
        if (this.hotballFilter !== 'none') {
            // TODO: Implement hotball filtering when hotball data is available
        }

        // Always exclude current event
        pool = pool.filter(e => e.id !== this.currentEvent.id);

        return pool;
    }

    /**
     * Calculate pool averages
     */
    calculatePoolAverages(pool) {
        if (pool.length === 0) return null;

        const totals = {
            totalSales: 0,
            totalPayouts: 0,
            netSales: 0,
            attendance: 0
        };

        pool.forEach(event => {
            totals.totalSales += event.totalSales;
            totals.totalPayouts += event.totalPayouts;
            totals.netSales += event.netSales;
            totals.attendance += event.attendance;
        });

        const count = pool.length;

        return {
            totalSales: totals.totalSales / count,
            totalPayouts: totals.totalPayouts / count,
            netSales: totals.netSales / count,
            attendance: totals.attendance / count,
            rpa: totals.attendance > 0 ? totals.totalSales / totals.attendance : 0,
            margin: totals.totalSales > 0
                ? ((totals.totalSales - totals.totalPayouts) / totals.totalSales * 100)
                : 0
        };
    }

    /**
     * Calculate percentage change
     */
    calculateChange(current, average) {
        if (!average || average === 0) return 0;
        return ((current - average) / average) * 100;
    }

    /**
     * Update comparison display
     */
    updateComparison() {
        if (!this.currentEvent) return;

        this.comparisonPool = this.getComparisonPool();
        const averages = this.calculatePoolAverages(this.comparisonPool);

        // Update pool count
        const poolCountEl = document.getElementById('sessionPoolCount');
        if (poolCountEl) {
            poolCountEl.textContent = this.comparisonPool.length;
        }

        // Update event info
        this.updateEventInfo();

        // Update metrics
        this.updateMetricCard('net-sales', this.currentEvent.netSales, averages?.netSales, this.comparisonPool.length);
        this.updateMetricCard('rpa', this.currentEvent.rpa, averages?.rpa, this.comparisonPool.length);
        this.updateMetricCard('total-sales', this.currentEvent.totalSales, averages?.totalSales, this.comparisonPool.length);
        this.updateMetricCard('payouts', this.currentEvent.totalPayouts, averages?.totalPayouts, this.comparisonPool.length);
        this.updateMetricCard('margin', this.currentEvent.margin, averages?.margin, this.comparisonPool.length);
        this.updateMetricCard('attendance', this.currentEvent.attendance, averages?.attendance, this.comparisonPool.length);
    }

    /**
     * Update event information display
     */
    updateEventInfo() {
        const titleEl = document.getElementById('sessionEventTitle');
        const dateEl = document.getElementById('sessionEventDate');
        const typeEl = document.getElementById('sessionEventType');
        const locationEl = document.getElementById('sessionEventLocation');

        if (titleEl) titleEl.textContent = this.currentEvent.displayName;
        if (dateEl) dateEl.textContent = new Date(this.currentEvent.date).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        });
        if (typeEl) typeEl.textContent = this.currentEvent.sessionType;
        if (locationEl) locationEl.textContent = this.currentEvent.location;
    }

    /**
     * Update a metric card
     */
    updateMetricCard(metricId, currentValue, avgValue, poolSize) {
        const card = document.querySelector(`[data-metric="${metricId}"]`);
        if (!card) return;

        const valueEl = card.querySelector('.metric-value');
        const changeEl = card.querySelector('.metric-change');
        const avgEl = card.querySelector('.metric-avg-value');
        const countEl = card.querySelector('.metric-pool-count');

        // Format value based on metric type
        let formattedValue, formattedAvg;
        if (metricId === 'margin') {
            formattedValue = currentValue.toFixed(1) + '%';
            formattedAvg = avgValue ? avgValue.toFixed(1) + '%' : 'N/A';
        } else if (metricId === 'attendance') {
            formattedValue = Math.round(currentValue).toLocaleString();
            formattedAvg = avgValue ? Math.round(avgValue).toLocaleString() : 'N/A';
        } else {
            formattedValue = '$' + Math.round(currentValue).toLocaleString();
            formattedAvg = avgValue ? '$' + Math.round(avgValue).toLocaleString() : 'N/A';
        }

        if (valueEl) valueEl.textContent = formattedValue;
        if (avgEl) avgEl.textContent = formattedAvg;
        if (countEl) countEl.textContent = `Average of ${poolSize} events`;

        // Calculate and display change
        if (changeEl && avgValue) {
            const change = this.calculateChange(currentValue, avgValue);
            const isPositive = change > 0;
            const arrow = isPositive ? '↑' : change < 0 ? '↓' : '';

            // Color: green for positive, red for negative, gray for payouts (neutral)
            let colorClass = '';
            if (metricId === 'payouts') {
                colorClass = 'neutral';
            } else {
                colorClass = isPositive ? 'positive' : 'negative';
            }

            changeEl.className = `metric-change ${colorClass}`;
            changeEl.textContent = `${arrow} ${Math.abs(change).toFixed(1)}%`;

            // For margin, add percentage point difference
            if (metricId === 'margin') {
                const ppDiff = currentValue - avgValue;
                changeEl.innerHTML = `${arrow} ${Math.abs(change).toFixed(1)}%<br><span style="font-size: 10px;">${ppDiff >= 0 ? '+' : ''}${ppDiff.toFixed(1)}pp</span>`;
            }
        } else if (changeEl) {
            changeEl.textContent = 'N/A';
            changeEl.className = 'metric-change neutral';
        }
    }

    /**
     * Format currency
     */
    fmt(value) {
        return '$' + Math.round(value).toLocaleString();
    }
}

export const sessionDailyView = new SessionDailyView();
