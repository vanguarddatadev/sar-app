// Reporting Checklist View
// Professional UI for managing required reports

import { supabase } from '../core/supabase-client.js';

class ChecklistView {
    constructor() {
        this.requirements = [];
    }

    async init() {
        console.log('Initializing Reporting Checklist View');
        await this.loadRequirements();
        this.render();
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
            return;
        }

        this.requirements = data || [];
        console.log(`Loaded ${this.requirements.length} pending requirements`);
    }

    categorizeRequirements() {
        const now = new Date();
        const in14Days = new Date(now);
        in14Days.setDate(in14Days.getDate() + 14);

        const pastDue = [];
        const soonDue = [];
        const pending = [];

        this.requirements.forEach(req => {
            const dueDate = new Date(req.due_date);

            if (dueDate < now) {
                pastDue.push(req);
            } else if (dueDate <= in14Days) {
                soonDue.push(req);
            } else {
                pending.push(req);
            }
        });

        return { pastDue, soonDue, pending };
    }

    render() {
        const container = document.getElementById('checklistContent');
        if (!container) return;

        const { pastDue, soonDue, pending } = this.categorizeRequirements();

        container.innerHTML = `
            <div class="checklist-container">
                ${this.renderSection('🔴 PAST DUE', pastDue, 'past-due')}
                ${this.renderSection('⚠️ SOON DUE', soonDue, 'soon-due')}
                ${pending.length > 0 ? this.renderSection('📋 PENDING', pending, 'pending') : ''}
            </div>
        `;

        // Attach event listeners
        this.attachEventListeners();
    }

    renderSection(title, requirements, className) {
        if (requirements.length === 0) return '';

        return `
            <div class="checklist-section ${className}">
                <div class="checklist-section-header">
                    <h2>${title}</h2>
                    <span class="checklist-count">${requirements.length}</span>
                </div>
                <div class="checklist-items">
                    ${requirements.map(req => this.renderRequirement(req)).join('')}
                </div>
            </div>
        `;
    }

    renderRequirement(req) {
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

        let urgencyText = '';
        if (daysOverdue > 0) {
            urgencyText = `<span class="urgency-text overdue">${daysOverdue} days overdue</span>`;
        } else if (daysUntilDue <= 14) {
            urgencyText = `<span class="urgency-text soon">${daysUntilDue} days remaining</span>`;
        } else {
            urgencyText = `<span class="urgency-text pending">Due ${dueDateStr}</span>`;
        }

        const locationName = req.locations?.location_name || 'Unknown Location';

        return `
            <div class="checklist-item" data-requirement-id="${req.id}">
                <div class="checklist-item-icon">
                    <i data-lucide="file-text"></i>
                </div>
                <div class="checklist-item-content">
                    <div class="checklist-item-header">
                        <h3>${req.report_name}</h3>
                        <span class="checklist-item-location">${locationName}</span>
                    </div>
                    <div class="checklist-item-details">
                        <span class="checklist-item-month">${reportingMonth}</span>
                        <span class="checklist-item-separator">•</span>
                        <span class="checklist-item-due">Due ${dueDateStr}</span>
                        <span class="checklist-item-separator">•</span>
                        ${urgencyText}
                    </div>
                </div>
                <button class="btn btn-primary checklist-generate-btn" data-requirement-id="${req.id}">
                    Generate Report
                </button>
            </div>
        `;
    }

    attachEventListeners() {
        // Generate Report buttons
        document.querySelectorAll('.checklist-generate-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const requirementId = e.target.dataset.requirementId;
                this.handleGenerateReport(requirementId);
            });
        });

        // Refresh Lucide icons
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    async handleGenerateReport(requirementId) {
        const requirement = this.requirements.find(r => r.id === requirementId);
        if (!requirement) return;

        console.log('Generating report for:', requirement);

        // TODO: Open report preview modal
        alert(`Generating ${requirement.report_name} for ${requirement.reporting_month}...`);
    }

    // Get badge count for nav
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
const checklistView = new ChecklistView();

export { checklistView, ChecklistView };
