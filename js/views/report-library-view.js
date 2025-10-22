/**
 * Report Library View
 * Shows all saved/completed reports
 */

import { supabase } from '../core/supabase-client.js';

export class ReportLibraryView {
    constructor() {
        this.reports = [];
    }

    async init() {
        console.log('Initializing Report Library View');
        await this.loadReports();
        this.render();
    }

    async loadReports() {
        const orgId = window.app.currentOrganizationId;

        const { data, error } = await supabase.client
            .from('report_submissions')
            .select(`
                *,
                locations (
                    location_code,
                    location_name
                )
            `)
            .eq('organization_id', orgId)
            .order('submitted_at', { ascending: false });

        if (error) {
            console.error('Error loading reports:', error);
            this.reports = [];
            return;
        }

        this.reports = data || [];
        console.log(`Loaded ${this.reports.length} saved reports`);
    }

    render() {
        const container = document.querySelector('#report-library-view .card-body');
        if (!container) return;

        if (this.reports.length === 0) {
            container.innerHTML = `
                <p class="empty-state">No reports saved yet. Generate and save a report from the Report Checklist to see it here.</p>
            `;
            return;
        }

        container.innerHTML = `
            <table class="library-table">
                <thead>
                    <tr>
                        <th>Report Name</th>
                        <th>Reporting Month</th>
                        <th>Location</th>
                        <th>Submitted</th>
                        <th>Submitted By</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.reports.map(report => this.renderRow(report)).join('')}
                </tbody>
            </table>
        `;
    }

    renderRow(report) {
        const reportingMonth = new Date(report.reporting_month).toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric'
        });

        const submittedDate = new Date(report.submitted_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });

        const locationName = report.locations?.location_name || 'Unknown';

        return `
            <tr>
                <td><strong>${report.report_name}</strong></td>
                <td>${reportingMonth}</td>
                <td>${locationName}</td>
                <td>${submittedDate}</td>
                <td>${report.submitted_by || 'Unknown'}</td>
                <td>
                    <button class="btn-small btn-primary" onclick="alert('View functionality coming soon!')">
                        View
                    </button>
                </td>
            </tr>
        `;
    }
}

// Create singleton instance
const reportLibraryView = new ReportLibraryView();

export { reportLibraryView };
