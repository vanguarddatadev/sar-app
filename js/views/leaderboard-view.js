// Leaderboard View Controller
// Handles top-performing sessions display with clickable metric cards

import { supabase } from '../core/supabase-client.js';
import { AppSounds } from '../utils/sounds.js';

class LeaderboardView {
    constructor() {
        this.sessions = [];
        this.filteredSessions = [];
        this.currentMetric = 'net_revenue'; // Default sort metric
        this.currentLocation = 'ALL'; // ALL, SC, RWC
        this.currentTimeframe = '3months'; // 1month, 3months, 6months, 12months, all
        this.selectedDays = {
            'Monday': true,
            'Tuesday': true,
            'Wednesday': true,
            'Thursday': true,
            'Friday': true,
            'Saturday': true,
            'Saturday Late': true,
            'Sunday': true,
            'Sunday Late': true
        };
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

        // Day of week filter
        const dayCheckboxes = document.querySelectorAll('.leaderboard-day-filter');
        dayCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const day = e.target.dataset.day;
                this.selectedDays[day] = e.target.checked;
                this.updateLeaderboard(); // Re-filter and display
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

            // Debug: Log first session to see data structure
            if (data && data.length > 0) {
                console.log('📋 Sample session data:', {
                    date: data[0].session_date,
                    location: data[0].location,
                    attendance: data[0].attendance,
                    flash_sales: data[0].flash_sales,
                    strip_sales: data[0].strip_sales,
                    total_sales: data[0].total_sales
                });
            }

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
        // Filter by day of week
        let dayFilteredSessions = this.sessions.filter(session => {
            const sessionDate = new Date(session.session_date + 'T00:00:00');
            const dayOfWeek = sessionDate.toLocaleDateString('en-US', { weekday: 'long' });
            const sessionType = session.session_type || '';

            // Check if regular day is selected
            if (this.selectedDays[dayOfWeek]) {
                // For "Late" sessions, check if specific late day is selected
                if (sessionType.toLowerCase().includes('late')) {
                    const lateDay = `${dayOfWeek} Late`;
                    return this.selectedDays[lateDay];
                }
                return true;
            }

            // Check if this is a late session and only the "Late" checkbox is selected
            if (sessionType.toLowerCase().includes('late')) {
                const lateDay = `${dayOfWeek} Late`;
                return this.selectedDays[lateDay];
            }

            return false;
        });

        // Update event pool count (total sessions after day filter)
        const poolCount = document.getElementById('eventPoolCount');
        if (poolCount) {
            poolCount.textContent = dayFilteredSessions.length;
        }

        // Sort sessions by current metric
        this.filteredSessions = [...dayFilteredSessions].sort((a, b) => {
            let aValue, bValue;

            // Special handling for margin (calculated field)
            if (this.currentMetric === 'margin') {
                aValue = this.calculateMargin(a);
                bValue = this.calculateMargin(b);
            } else {
                aValue = parseFloat(a[this.currentMetric]) || 0;
                bValue = parseFloat(b[this.currentMetric]) || 0;
            }

            return bValue - aValue; // Descending order
        });

        // Take top 50
        this.filteredSessions = this.filteredSessions.slice(0, 50);

        // Render leaderboard
        this.renderLeaderboard();
    }

    /**
     * Calculate margin percentage
     */
    calculateMargin(session) {
        if (!session.total_sales || session.total_sales === 0) return 0;
        return (session.net_revenue / session.total_sales) * 100;
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
                            ${this.renderMetricCard('Margin', this.calculateMargin(session), '#8b5cf6', 'margin', 'percent')}
                            ${this.renderMetricCard('RPA', session.revenue_per_attendee, '#f59e0b', 'revenue_per_attendee')}
                            ${this.renderMetricCard('Strip RPA', session.strip_per_attendee, '#06b6d4', 'strip_per_attendee')}
                            ${this.renderMetricCard('Flash RPA', session.flash_per_attendee, '#84cc16', 'flash_per_attendee')}
                            ${this.renderMetricCard('Attendance', session.attendance, '#dc2626', 'attendance', 'number')}
                            ${this.renderMetricCard('Strip Sales', session.strip_sales, '#a855f7', 'strip_sales')}
                            ${this.renderMetricCard('Flash Sales', session.flash_sales, '#0ea5e9', 'flash_sales')}
                        </div>

                        <!-- Note Display and Add Note Button -->
                        <div style="display: flex; align-items: center; gap: 8px; margin-left: 8px;">
                            ${session.note ? `
                                <div style="max-width: 200px; padding: 4px 8px; background: #fef3c7; border: 1px solid #fbbf24;
                                           border-radius: 4px; font-size: 11px; color: #78350f; overflow: hidden; text-overflow: ellipsis;
                                           white-space: nowrap; cursor: pointer;"
                                     onclick="event.stopPropagation(); window.leaderboardView.editNote('${session.id}', '${session.note.replace(/'/g, "\\'")}');"
                                     title="${session.note.replace(/"/g, '&quot;')}">
                                    📝 ${session.note}
                                </div>
                            ` : ''}
                            <button onclick="event.stopPropagation(); window.leaderboardView.addNote('${session.id}', '${session.note ? session.note.replace(/'/g, "\\'") : ''}');"
                                    style="padding: 4px 10px; background: #3b82f6; color: white; border: none; border-radius: 4px;
                                          font-size: 11px; font-weight: 500; cursor: pointer; white-space: nowrap; flex-shrink: 0;
                                          transition: background 0.2s;"
                                    onmouseover="this.style.background='#2563eb'"
                                    onmouseout="this.style.background='#3b82f6'">
                                ${session.note ? 'Edit Note' : 'Add Note'}
                            </button>
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
     * Sort leaderboard by metric with animation and sound
     */
    sortBy(metric) {
        // Play shuffle sound
        if (AppSounds && AppSounds.enabled) {
            AppSounds.play('shuffle');
        }

        // Animate existing rows before re-sorting
        this.animateReorder();

        // Update after animation starts
        setTimeout(() => {
            this.currentMetric = metric;
            this.updateLeaderboard();
        }, 100);
    }

    /**
     * Animate rows moving up and down during re-sort
     */
    animateReorder() {
        const rows = document.querySelectorAll('.leaderboard-row');
        rows.forEach((row, index) => {
            // Larger random vertical shift for more dramatic movement (100px)
            const randomShift = (Math.random() - 0.5) * 100;

            // Add smooth transition
            row.style.transition = 'transform 0.4s ease-in-out, opacity 0.4s ease-in-out';

            // Apply random transform
            row.style.transform = `translateY(${randomShift}px)`;
            row.style.opacity = '0.7';

            // Reset after animation (390ms = 30% longer than 300ms)
            setTimeout(() => {
                row.style.transform = 'translateY(0)';
                row.style.opacity = '1';
            }, 390);
        });
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

    /**
     * Open modal to add or edit a note
     */
    addNote(sessionId, existingNote = '') {
        this.showNoteModal(sessionId, existingNote);
    }

    /**
     * Alias for addNote (for clicking on existing notes)
     */
    editNote(sessionId, existingNote) {
        this.addNote(sessionId, existingNote);
    }

    /**
     * Show note modal
     */
    showNoteModal(sessionId, existingNote = '') {
        // Create modal overlay
        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'noteModalOverlay';
        modalOverlay.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.5); display: flex; align-items: center;
            justify-content: center; z-index: 10000;
        `;

        // Create modal
        const modal = document.createElement('div');
        modal.style.cssText = `
            background: white; padding: 24px; border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); max-width: 500px; width: 90%;
        `;

        modal.innerHTML = `
            <h3 style="margin: 0 0 16px 0; font-size: 18px; color: #1e293b;">
                ${existingNote ? 'Edit' : 'Add'} Session Note
            </h3>
            <textarea id="noteTextarea"
                      style="width: 100%; min-height: 100px; padding: 8px; border: 1px solid #cbd5e1;
                            border-radius: 4px; font-family: inherit; font-size: 14px; resize: vertical;"
                      placeholder="Enter note about this session...">${existingNote}</textarea>
            <div style="display: flex; gap: 8px; margin-top: 16px; justify-content: flex-end;">
                ${existingNote ? `
                    <button id="deleteNoteBtn" style="padding: 8px 16px; background: #dc2626; color: white;
                                                       border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
                        Delete Note
                    </button>
                ` : ''}
                <button id="cancelNoteBtn" style="padding: 8px 16px; background: #e5e7eb; color: #1e293b;
                                                   border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
                    Cancel
                </button>
                <button id="saveNoteBtn" style="padding: 8px 16px; background: #3b82f6; color: white;
                                                 border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
                    Save Note
                </button>
            </div>
        `;

        modalOverlay.appendChild(modal);
        document.body.appendChild(modalOverlay);

        // Focus textarea
        const textarea = document.getElementById('noteTextarea');
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);

        // Handle save
        document.getElementById('saveNoteBtn').onclick = async () => {
            const note = textarea.value.trim();
            await this.saveNote(sessionId, note);
            document.body.removeChild(modalOverlay);
        };

        // Handle delete
        if (existingNote) {
            document.getElementById('deleteNoteBtn').onclick = async () => {
                if (confirm('Delete this note?')) {
                    await this.saveNote(sessionId, '');
                    document.body.removeChild(modalOverlay);
                }
            };
        }

        // Handle cancel
        document.getElementById('cancelNoteBtn').onclick = () => {
            document.body.removeChild(modalOverlay);
        };

        // Close on overlay click
        modalOverlay.onclick = (e) => {
            if (e.target === modalOverlay) {
                document.body.removeChild(modalOverlay);
            }
        };

        // Close on Escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                document.body.removeChild(modalOverlay);
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }

    /**
     * Save note to database
     */
    async saveNote(sessionId, note) {
        try {
            const { error } = await supabase.client
                .from('sessions')
                .update({ note: note || null })
                .eq('id', sessionId);

            if (error) throw error;

            // Update local session data
            const session = this.sessions.find(s => s.id === sessionId);
            if (session) {
                session.note = note || null;
            }

            // Re-render leaderboard
            this.updateLeaderboard();

            console.log('✅ Note saved successfully');

        } catch (error) {
            console.error('❌ Error saving note:', error);
            alert('Failed to save note: ' + error.message);
        }
    }
}

export const leaderboardView = new LeaderboardView();
