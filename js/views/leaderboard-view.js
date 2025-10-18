// Leaderboard View Controller
// Handles top-performing sessions display with clickable metric cards

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
        console.log('🏆 Initializing Leaderboard view...');

        try {
            // Load initial data
            await this.loadSessions();

            // Set up event listeners
            this.setupEventListeners();

            // Display leaderboard
            this.updateLeaderboard();

            console.log('✅ Leaderboard initialized with', this.sessions.length, 'sessions');
        } catch (error) {
            console.error('❌ Error initializing leaderboard:', error);
            this.displayError('Failed to initialize: ' + error.message);
        }
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
            console.log('📊 Loading sessions from database...');

            // Calculate date range based on timeframe
            const dateFilter = this.getDateFilter();

            // Build query - simplified to avoid column issues
            let query = supabase.client
                .from('sessions')
                .select('*');

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

            if (error) {
                console.error('Database error:', error);
                throw error;
            }

            console.log('✅ Loaded', data?.length || 0, 'sessions from database');

            this.sessions = data || [];
            this.updateLeaderboard();

        } catch (error) {
            console.error('❌ Error loading sessions:', error);
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
     * Render leaderboard as clickable cards
     */
    renderLeaderboard() {
        const container = document.getElementById('leaderboardCardContainer');

        if (!container) return;

        if (this.filteredSessions.length === 0) {
            container.innerHTML = `<div class="empty-state">No sessions found for selected filters</div>`;
            return;
        }

        container.innerHTML = this.filteredSessions.map((session, index) => {
            const rank = index + 1;

            // Rank icon
            let rankIcon = '';
            if (rank === 1) rankIcon = '🏆';
            else if (rank === 2) rankIcon = '🥈';
            else if (rank === 3) rankIcon = '🥉';
            else rankIcon = rank;

            // Border style based on rank
            let borderStyle = '';
            if (rank === 1) {
                borderStyle = 'border: 2px solid #FFD700; box-shadow: 0 0 10px rgba(255, 215, 0, 0.3);';
            } else if (rank === 2) {
                borderStyle = 'border: 2px solid #C0C0C0;';
            } else if (rank === 3) {
                borderStyle = 'border: 2px solid #CD7F32;';
            } else {
                borderStyle = 'border: 1px solid #e5e7eb;';
            }

            return `
                <div class="leaderboard-row" style="background: white; padding: 8px; ${borderStyle} border-radius: 6px; transition: all 0.2s;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <!-- Rank -->
                        <div style="width: 28px; height: 28px; ${rank > 3 ? 'background: linear-gradient(135deg, #667eea, #764ba2);' : ''}
                                  border-radius: 50%; display: flex; align-items: center; justify-content: center;
                                  ${rank > 3 ? 'color: white;' : ''} font-weight: bold; font-size: ${rank <= 3 ? '16px' : '12px'}; flex-shrink: 0;">
                            ${rankIcon}
                        </div>

                        <!-- Session Info -->
                        <div style="min-width: 140px; flex-shrink: 0;">
                            <div style="font-size: 12px; font-weight: 600; color: #1e293b;">
                                ${this.formatDate(session.session_date)}
                            </div>
                            <div style="font-size: 11px; color: #64748b;">
                                <span class="location-badge ${session.location.toLowerCase()}">${session.location}</span>
                                ${session.session_type}
                            </div>
                        </div>

                        <!-- Clickable Metric Cards -->
                        <div style="display: flex; gap: 4px; flex: 1; flex-wrap: nowrap;">
                            ${this.renderMetricCard('Net Rev', session.net_revenue, '#10b981', 'net_revenue')}
                            ${this.renderMetricCard('Total Sales', session.total_sales, '#3b82f6', 'total_sales')}
                            ${this.renderMetricCard('Attendance', session.attendance, '#dc2626', 'attendance', 'number')}
                            ${this.renderMetricCard('RPA', session.revenue_per_attendee, '#f59e0b', 'revenue_per_attendee')}
                            ${this.renderMetricCard('Flash Sales', session.flash_sales, '#0ea5e9', 'flash_sales')}
                            ${this.renderMetricCard('Flash RPA', session.flash_per_attendee, '#84cc16', 'flash_per_attendee')}
                            ${this.renderMetricCard('Strip Sales', session.strip_sales, '#a855f7', 'strip_sales')}
                            ${this.renderMetricCard('Strip RPA', session.strip_per_attendee, '#06b6d4', 'strip_per_attendee')}
                            ${this.renderMetricCard('Paper Sales', session.paper_sales, '#ec4899', 'paper_sales')}
                            ${this.renderMetricCard('Flash Yield', session.flash_yield, '#22c55e', 'flash_yield', 'percent')}
                            ${this.renderMetricCard('Strip Yield', session.strip_yield, '#8b5cf6', 'strip_yield', 'percent')}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Render a single metric card
     */
    renderMetricCard(label, value, color, metric, type = 'currency') {
        const isHighlighted = this.currentMetric === metric;
        const formattedValue = this.formatMetricValue(value, type);

        if (isHighlighted) {
            return `
                <div onclick="event.stopPropagation(); window.leaderboardView.sortBy('${metric}');"
                     style="background: ${color}; border: 1px solid ${color}; border-radius: 4px; padding: 4px 6px;
                           min-width: 65px; cursor: pointer; transition: transform 0.2s;"
                     title="Currently sorting by ${label} - Click to re-sort">
                    <div style="font-size: 8px; color: white; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px;">
                        ${label}
                    </div>
                    <div style="font-size: 11px; font-weight: 700; color: white; margin-top: 1px;">
                        ${formattedValue}
                    </div>
                </div>
            `;
        } else {
            return `
                <div onclick="event.stopPropagation(); window.leaderboardView.sortBy('${metric}');"
                     style="background: ${color}15; border: 1px solid ${color}40; border-radius: 4px; padding: 4px 6px;
                           min-width: 65px; cursor: pointer; transition: all 0.2s;"
                     onmouseover="this.style.background='${color}25'; this.style.transform='scale(1.05)'"
                     onmouseout="this.style.background='${color}15'; this.style.transform='scale(1)'"
                     title="Click to sort by ${label}">
                    <div style="font-size: 8px; color: ${color}; font-weight: 500; text-transform: uppercase; letter-spacing: 0.3px;">
                        ${label}
                    </div>
                    <div style="font-size: 10px; font-weight: 600; color: #1e293b; margin-top: 1px;">
                        ${formattedValue}
                    </div>
                </div>
            `;
        }
    }

    /**
     * Sort leaderboard by metric
     */
    sortBy(metric) {
        this.currentMetric = metric;
        const metricSelector = document.getElementById('leaderboardMetric');
        if (metricSelector) {
            metricSelector.value = metric;
        }
        this.updateLeaderboard();
    }

    /**
     * Format metric value based on type
     */
    formatMetricValue(value, type) {
        if (!value || isNaN(value)) {
            if (type === 'number') return '0';
            if (type === 'percent') return '0%';
            return '$0';
        }

        if (type === 'currency') {
            return '$' + Math.round(value).toLocaleString();
        } else if (type === 'percent') {
            return value.toFixed(1) + '%';
        } else {
            return Math.round(value).toLocaleString();
        }
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

        // Determine type for formatting
        let type = 'currency';
        if (this.currentMetric === 'attendance') type = 'number';
        else if (this.currentMetric.includes('yield')) type = 'percent';

        avgMetric.textContent = this.formatMetricValue(avgValue, type);

        // Top metric
        const topValue = this.filteredSessions.length > 0 ? (parseFloat(this.filteredSessions[0][this.currentMetric]) || 0) : 0;
        topMetric.textContent = this.formatMetricValue(topValue, type);
    }

    /**
     * Display error message
     */
    displayError(message) {
        const container = document.getElementById('leaderboardCardContainer');
        if (container) {
            container.innerHTML = `
                <div style="color: var(--danger-color); text-align: center; padding: 40px;">
                    ❌ ${message}
                </div>
            `;
        }
    }

    /**
     * Format date
     */
    formatDate(dateString) {
        const date = new Date(dateString + 'T00:00:00');
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }

    /**
     * Format number
     */
    formatNumber(value) {
        if (!value || isNaN(value)) return '0';
        return new Intl.NumberFormat('en-US').format(Math.round(value));
    }
}

export const leaderboardView = new LeaderboardView();
