// QB History View
// Displays QB upload history and activity logs

import { supabase } from '../core/supabase-client.js';

class QBHistoryView {
    constructor() {
        this.currentRange = 'ALL';
        this.currentAction = 'ALL';
        this.currentStatus = 'ALL';
        this.currentTab = 'qb-history';
    }

    async init() {
        console.log('Initializing QB History View');
        this.setupEventListeners();
        await this.loadUploadHistory();
    }

    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('#qb-history-view .tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Update active tab button
                document.querySelectorAll('#qb-history-view .tab-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');

                // Update active tab content
                document.querySelectorAll('#qb-history-view .tab-content').forEach(content => content.classList.remove('active'));
                const tabId = e.target.dataset.tab;
                document.getElementById(`${tabId}-tab`)?.classList.add('active');

                this.currentTab = tabId;

                // Load appropriate data
                if (tabId === 'upload-history') {
                    this.loadUploadHistory();
                }
            });
        });

        // Filter buttons
        document.querySelectorAll('.qb-history-range-filter').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.qb-history-range-filter').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentRange = e.target.dataset.range;
                this.loadUploadHistory();
            });
        });

        document.querySelectorAll('.qb-history-action-filter').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.qb-history-action-filter').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentAction = e.target.dataset.action;
                this.loadUploadHistory();
            });
        });

        document.querySelectorAll('.qb-history-status-filter').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.qb-history-status-filter').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentStatus = e.target.dataset.status;
                this.loadUploadHistory();
            });
        });
    }

    async loadUploadHistory() {
        const tbody = document.getElementById('qbHistoryTableBody');
        if (!tbody) return;

        try {
            // Build query
            let query = supabase.client
                .from('qb_upload_history')
                .select('*')
                .eq('organization_id', window.app.currentOrganizationId)
                .order('upload_date', { ascending: false });

            // Apply date range filter
            if (this.currentRange !== 'ALL') {
                const days = parseInt(this.currentRange);
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - days);
                query = query.gte('upload_date', cutoffDate.toISOString());
            }

            // Apply action filter (for now, only showing UPLOAD since that's what we have)
            // Future: add push/sync when implemented

            // Apply status filter
            if (this.currentStatus !== 'ALL') {
                query = query.eq('status', this.currentStatus.toLowerCase());
            }

            const { data, error } = await query;

            if (error) {
                console.error('Error loading QB upload history:', error);
                tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">Error loading upload history</td></tr>';
                return;
            }

            if (!data || data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">No upload history available</td></tr>';
                return;
            }

            // Render rows
            tbody.innerHTML = data.map(upload => this.renderUploadRow(upload)).join('');

        } catch (error) {
            console.error('Error in loadUploadHistory:', error);
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">Error loading upload history</td></tr>';
        }
    }

    renderUploadRow(upload) {
        const timestamp = new Date(upload.upload_date).toLocaleString();
        const month = new Date(upload.month).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });

        // Status badge
        let statusBadge = '';
        if (upload.status === 'success') {
            statusBadge = '<span class="badge badge-success">Success</span>';
        } else if (upload.status === 'failed') {
            statusBadge = '<span class="badge badge-error">Failed</span>';
        } else {
            statusBadge = '<span class="badge badge-warning">Pending</span>';
        }

        // Duration in seconds
        const durationSec = upload.processing_duration_ms ? (upload.processing_duration_ms / 1000).toFixed(2) : '-';

        // Description
        const description = upload.error_message || `${month} QB P&L import`;

        return `
            <tr>
                <td>${timestamp}</td>
                <td><span class="badge badge-secondary">Upload</span></td>
                <td>${description}</td>
                <td>${statusBadge}</td>
                <td>${upload.records_imported.toLocaleString()}</td>
                <td>${durationSec}s</td>
                <td>${upload.processed_by || 'System'}</td>
            </tr>
        `;
    }

    formatNumber(value) {
        if (!value) return '0';
        return new Intl.NumberFormat('en-US').format(value);
    }
}

// Create singleton instance
const qbHistoryView = new QBHistoryView();

export { qbHistoryView };
