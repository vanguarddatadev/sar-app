/**
 * Report Checklist View - Option 1: Clean Table View
 * Professional spreadsheet-style layout for required reports
 */

import { supabase } from '../core/supabase-client.js';

export class ReportChecklistView {
    constructor() {
        this.requirements = [];
    }

    async init() {
        console.log('Initializing Report Checklist View');
        this.showLoading();
        await this.loadRequirements();
        this.render();
        this.hideLoading();
    }

    showLoading() {
        const loadingEl = document.getElementById('checklistLoadingState');
        const contentEl = document.getElementById('checklistContent');
        if (loadingEl) loadingEl.style.display = 'block';
        if (contentEl) contentEl.style.display = 'none';
    }

    hideLoading() {
        const loadingEl = document.getElementById('checklistLoadingState');
        const contentEl = document.getElementById('checklistContent');
        if (loadingEl) loadingEl.style.display = 'none';
        if (contentEl) contentEl.style.display = 'block';
    }

    async loadRequirements() {
        const orgId = window.app.currentOrganizationId;

        const { data, error } = await supabase.client
            .from('report_requirements')
            .select(`
                *,
                locations (
                    location_code,
                    location_name
                )
            `)
            .eq('organization_id', orgId)
            .eq('status', 'pending')
            .order('due_date', { ascending: true });

        if (error) {
            console.error('Error loading requirements:', error);
            this.requirements = [];
            return;
        }

        this.requirements = data || [];
        console.log(`Loaded ${this.requirements.length} pending requirements`);
    }

    render() {
        const container = document.getElementById('checklistContent');
        if (!container) return;

        if (this.requirements.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No pending reports found. You're all caught up!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="table-wrapper">
                <table class="table-view">
                    <thead>
                        <tr>
                            <th>Status</th>
                            <th>Report Name</th>
                            <th>Location</th>
                            <th>Reporting Month</th>
                            <th>Due Date</th>
                            <th>Days</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.requirements.map(req => this.renderRow(req)).join('')}
                    </tbody>
                </table>
            </div>
        `;

        // Attach event listeners
        this.attachEventListeners();

        // Refresh Lucide icons
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    renderRow(req) {
        const reportingMonth = new Date(req.reporting_month).toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric'
        });

        const dueDate = new Date(req.due_date);
        const dueDateStr = dueDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });

        const now = new Date();
        const daysOverdue = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));
        const daysUntilDue = Math.floor((dueDate - now) / (1000 * 60 * 60 * 24));

        let statusBadge = '';
        let daysText = '';

        if (daysOverdue > 0) {
            statusBadge = '<span class="status-badge overdue">OVERDUE</span>';
            daysText = `<span class="days-text overdue">+${daysOverdue}d</span>`;
        } else if (daysUntilDue <= 14) {
            statusBadge = '<span class="status-badge soon">DUE SOON</span>';
            daysText = `<span class="days-text soon">${daysUntilDue}d</span>`;
        } else {
            statusBadge = '<span class="status-badge pending">PENDING</span>';
            daysText = `<span class="days-text pending">${daysUntilDue}d</span>`;
        }

        const locationName = req.locations?.location_name || 'Unknown Location';

        return `
            <tr data-requirement-id="${req.id}">
                <td>${statusBadge}</td>
                <td class="report-name">${req.report_name}</td>
                <td>${locationName}</td>
                <td>${reportingMonth}</td>
                <td>${dueDateStr}</td>
                <td>${daysText}</td>
                <td>
                    <button class="btn-table btn-primary generate-btn" data-requirement-id="${req.id}">
                        <i data-lucide="file-plus"></i>
                        Generate
                    </button>
                </td>
            </tr>
        `;
    }

    attachEventListeners() {
        document.querySelectorAll('.generate-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const requirementId = e.currentTarget.dataset.requirementId;
                this.handleGenerateReport(requirementId);
            });
        });
    }

    async handleGenerateReport(requirementId) {
        const requirement = this.requirements.find(r => r.id === requirementId);
        if (!requirement) return;

        console.log('Generating report for:', requirement);

        // TODO: Open report preview modal
        alert(`Generating ${requirement.report_name} for ${requirement.reporting_month}...`);
    }

    // Get badge count for nav (past due + soon due)
    static async getBadgeCount(orgId) {
        const { data, error } = await supabase.client
            .from('report_requirements')
            .select('due_date', { count: 'exact', head: false })
            .eq('organization_id', orgId)
            .eq('status', 'pending');

        if (error) return 0;

        const now = new Date();
        const in14Days = new Date(now);
        in14Days.setDate(in14Days.getDate() + 14);

        return data.filter(r => new Date(r.due_date) <= in14Days).length;
    }
}

// Create singleton instance
const reportChecklistView = new ReportChecklistView();

export { reportChecklistView };
