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
            <table class="table-view">
                <thead>
                    <tr>
                        <th>Status</th>
                        <th>Report Name</th>
                        <th>Month</th>
                        <th>Location</th>
                        <th>Due Date</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.requirements.map(req => this.renderRow(req)).join('')}
                </tbody>
            </table>
        `;

        // Attach event listeners
        this.attachEventListeners();
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

        if (daysOverdue > 0) {
            statusBadge = `<span class="status-badge overdue">${daysOverdue} days overdue</span>`;
        } else if (daysUntilDue <= 14) {
            statusBadge = `<span class="status-badge soon">${daysUntilDue} days remaining</span>`;
        } else {
            statusBadge = `<span class="status-badge pending">${daysUntilDue} days remaining</span>`;
        }

        const locationName = req.locations?.location_name || 'Unknown Location';

        return `
            <tr data-requirement-id="${req.id}">
                <td>${statusBadge}</td>
                <td><strong>${req.report_name}</strong></td>
                <td>${reportingMonth}</td>
                <td>${locationName}</td>
                <td>${dueDateStr}</td>
                <td>
                    <button class="btn btn-primary generate-btn" data-requirement-id="${req.id}">
                        Generate Report
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

        // Open modal
        this.openReportModal(requirement);
    }

    openReportModal(requirement) {
        this.currentRequirement = requirement;

        // Set modal title
        const monthStr = new Date(requirement.reporting_month).toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric'
        });
        document.getElementById('modalReportTitle').textContent =
            `${requirement.report_name} - ${monthStr}`;

        // Clear fields
        document.getElementById('testField1').value = '';
        document.getElementById('testField2').value = '';

        // Show modal
        document.getElementById('reportPreviewModal').style.display = 'flex';

        // Attach modal event listeners
        this.attachModalListeners();
    }

    attachModalListeners() {
        const modal = document.getElementById('reportPreviewModal');
        const closeBtn = document.getElementById('closeModalBtn');
        const cancelBtn = document.getElementById('cancelModalBtn');
        const downloadBtn = document.getElementById('downloadReportBtn');
        const saveBtn = document.getElementById('saveReportBtn');

        // Close modal
        const closeModal = () => {
            modal.style.display = 'none';
        };

        closeBtn.onclick = closeModal;
        cancelBtn.onclick = closeModal;

        // Close on overlay click
        modal.onclick = (e) => {
            if (e.target === modal) closeModal();
        };

        // Download PDF
        downloadBtn.onclick = () => {
            this.downloadReport();
        };

        // Save to library
        saveBtn.onclick = async () => {
            await this.saveReport();
        };
    }

    async downloadReport() {
        // Simple alert for now - you can add jsPDF later
        alert('PDF download functionality coming soon!');
    }

    async saveReport() {
        const field1 = document.getElementById('testField1').value;
        const field2 = document.getElementById('testField2').value;

        // Save to report_submissions
        const { data, error } = await supabase.client
            .from('report_submissions')
            .insert({
                organization_id: window.app.currentOrganizationId,
                requirement_id: this.currentRequirement.id,
                report_type: this.currentRequirement.report_type,
                report_name: this.currentRequirement.report_name,
                location_id: this.currentRequirement.location_id,
                reporting_month: this.currentRequirement.reporting_month,
                report_data: {
                    testField1: field1,
                    testField2: field2
                },
                overrides: {},
                submitted_by: 'Admin User'
            })
            .select();

        if (error) {
            console.error('Error saving report:', error);
            alert('Error saving report!');
            return;
        }

        // Mark requirement as completed
        await supabase.client
            .from('report_requirements')
            .update({ status: 'completed' })
            .eq('id', this.currentRequirement.id);

        // Close modal
        document.getElementById('reportPreviewModal').style.display = 'none';

        // Reload checklist
        await this.loadRequirements();
        this.render();

        // Update badge
        await window.app.updateChecklistBadge();

        alert('Report saved to library!');
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
