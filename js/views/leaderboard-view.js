// Leaderboard View Controller
// Handles top-performing sessions display and filtering

import { supabase } from '../core/supabase-client.js';

class LeaderboardView {
    constructor() {
        this.sessions = [];
        this.filteredSessions = [];
        this.currentMetric = 'net_revenue'; // Default sort metric
        this.currentLocation = 'ALL'; // ALL, SC, RWC
        this.currentTimeframe = '3months'; // 1month, 3months, 6months, 12months, all
    }

    /**
     * Initialize the Leaderboard view
     */
    async init() {
        console.log('Initializing Leaderboard view...');

        // Load initial data
        await this.loadSessions();

        // Set up event listeners
        this.setupEventListeners();

        // Display leaderboard
        this.updateLeaderboard();
    }

    /**
     * Set up event listeners for filters
     */
    setupEventListeners() {
        // Metric selector
        const metricSelector = document.getElementById('leaderboardMetric');
        if (metricSelector) {
            metricSelector.addEventListener('change', (e) => {
                this.currentMetric = e.target.value;
                this.updateLeaderboard();
            });
        }

        // Location filter
        const locationBtns = document.querySelectorAll('.leaderboard-location-filter');
        locationBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                locationBtns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentLocation = e.target.dataset.location;
                this.loadSessions(); // Reload with new filter
            });
        });

        // Timeframe filter
        const timeframeBtns = document.querySelectorAll('.leaderboard-timeframe-filter');
        timeframeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                timeframeBtns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentTimeframe = e.target.dataset.timeframe;
                this.loadSessions(); // Reload with new filter
            });
        });
    }

    /**
     * Load sessions from database with filters
     */
    async loadSessions() {
        try {
            // Calculate date range based on timeframe
            const dateFilter = this.getDateFilter();

            // Build query
            let query = supabase.client
                .from('sessions')
                .select('*')
                .eq('is_cancelled', false)
                .gte('data_source_priority', 1);

            // Apply location filter
            if (this.currentLocation !== 'ALL') {
                query = query.eq('location', this.currentLocation);
            }

            // Apply date filter
            if (dateFilter) {
                query = query.gte('session_date', dateFilter);
            }

            // Order by session_date descending
            query = query.order('session_date', { ascending: false });

            const { data, error } = await query;

            if (error) throw error;

            this.sessions = data || [];
            this.updateLeaderboard();

        } catch (error) {
            console.error('Error loading sessions:', error);
            this.displayError('Failed to load sessions: ' + error.message);
        }
    }

    /**
     * Get date filter based on timeframe
     */
    getDateFilter() {
        if (this.currentTimeframe === 'all') return null;

        const now = new Date();
        const monthsAgo = {
            '1month': 1,
            '3months': 3,
            '6months': 6,
            '12months': 12
        }[this.currentTimeframe];

        const filterDate = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
        return filterDate.toISOString().split('T')[0];
    }

    /**
     * Update leaderboard display
     */
    updateLeaderboard() {
        // Sort sessions by current metric
        this.filteredSessions = [...this.sessions].sort((a, b) => {
            const aValue = parseFloat(a[this.currentMetric]) || 0;
            const bValue = parseFloat(b[this.currentMetric]) || 0;
            return bValue - aValue; // Descending order
        });

        // Take top 50
        this.filteredSessions = this.filteredSessions.slice(0, 50);

        // Render leaderboard
        this.renderLeaderboard();

        // Update stats
        this.updateStats();
    }

    /**
     * Render leaderboard table
     */
    renderLeaderboard() {
        const tbody = document.getElementById('leaderboardTableBody');

        if (!tbody) return;

        if (this.filteredSessions.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="empty-state">No sessions found for selected filters</td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.filteredSessions.map((session, index) => {
            const rank = index + 1;
            const isTopThree = rank <= 3;
            const metricValue = parseFloat(session[this.currentMetric]) || 0;

            return `
                <tr class="${isTopThree ? 'top-performer' : ''}">
                    <td class="rank-cell">
                        ${rank <= 3 ? this.getRankBadge(rank) : rank}
                    </td>
                    <td>${this.formatDate(session.session_date)}</td>
                    <td>
                        <span class="location-badge ${session.location.toLowerCase()}">${session.location}</span>
                    </td>
                    <td>${session.session_type}</td>
                    <td style="text-align: right;">${this.formatCurrency(session.total_sales)}</td>
                    <td style="text-align: right;">${this.formatCurrency(session.net_revenue)}</td>
                    <td style="text-align: right;">${this.formatNumber(session.attendance)}</td>
                    <td style="text-align: right; font-weight: 600; color: var(--primary-color);">
                        ${this.formatMetricValue(metricValue)}
                    </td>
                </tr>
            `;
        }).join('');
    }

    /**
     * Get rank badge for top 3
     */
    getRankBadge(rank) {
        const badges = {
            1: '🥇',
            2: '🥈',
            3: '🥉'
        };
        return badges[rank] || rank;
    }

    /**
     * Format metric value based on current metric
     */
    formatMetricValue(value) {
        // Currency metrics
        if (this.currentMetric.includes('sales') ||
            this.currentMetric.includes('revenue') ||
            this.currentMetric.includes('payouts') ||
            this.currentMetric.includes('per_attendee')) {
            return this.formatCurrency(value);
        }

        // Percentage metrics
        if (this.currentMetric.includes('yield')) {
            return this.formatPercent(value);
        }

        // Count metrics
        return this.formatNumber(value);
    }

    /**
     * Update summary stats
     */
    updateStats() {
        const totalSessions = document.getElementById('leaderboardTotalSessions');
        const avgMetric = document.getElementById('leaderboardAvgMetric');
        const topMetric = document.getElementById('leaderboardTopMetric');

        if (!totalSessions || !avgMetric || !topMetric) return;

        // Total sessions
        totalSessions.textContent = this.formatNumber(this.filteredSessions.length);

        // Average metric
        const avgValue = this.filteredSessions.reduce((sum, s) => sum + (parseFloat(s[this.currentMetric]) || 0), 0) /
                        (this.filteredSessions.length || 1);
        avgMetric.textContent = this.formatMetricValue(avgValue);

        // Top metric
        const topValue = this.filteredSessions.length > 0 ? (parseFloat(this.filteredSessions[0][this.currentMetric]) || 0) : 0;
        topMetric.textContent = this.formatMetricValue(topValue);
    }

    /**
     * Display error message
     */
    displayError(message) {
        const tbody = document.getElementById('leaderboardTableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="color: var(--danger-color); text-align: center; padding: 40px;">
                        ❌ ${message}
                    </td>
                </tr>
            `;
        }
    }

    /**
     * Format date
     */
    formatDate(dateString) {
        const date = new Date(dateString + 'T00:00:00');
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
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

    /**
     * Format percentage
     */
    formatPercent(value) {
        if (!value || isNaN(value)) return '0%';
        return `${value.toFixed(1)}%`;
    }
}

export const leaderboardView = new LeaderboardView();
