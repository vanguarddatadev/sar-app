/**
 * Report Checklist View
 * Shows required reports, deadlines, and filing status
 */

export class ReportChecklistView {
    constructor(supabaseClient) {
        this.supabaseClient = supabaseClient;
        this.organizationId = '123e4567-e89b-12d3-a456-426614174000'; // Vanguard (hardcoded for MVP)
    }

    async init() {
        this.showLoading();
        await this.loadChecklist();
        this.hideLoading();
    }

    showLoading() {
        document.getElementById('checklistLoadingState').style.display = 'block';
        document.getElementById('checklistContent').style.display = 'none';
    }

    hideLoading() {
        document.getElementById('checklistLoadingState').style.display = 'none';
        document.getElementById('checklistContent').style.display = 'block';
    }

    async loadChecklist() {
        try {
            // Get organization details
            const org = await this.getOrganization();

            // Get required reports for this organization
            const requirements = await this.getRequiredReports();

            // Get generated reports
            const generatedReports = await this.getGeneratedReports();

            // Calculate checklist items
            const checklistItems = await this.calculateChecklistItems(requirements, generatedReports, org);

            // Render checklist
            this.renderChecklist(checklistItems);
        } catch (error) {
            console.error('Error loading checklist:', error);
            this.renderError();
        }
    }

    async getOrganization() {
        const { data, error } = await this.supabaseClient.getClient()
            .from('organizations')
            .select('*')
            .eq('id', this.organizationId)
            .single();

        if (error) throw error;
        return data;
    }

    async getRequiredReports() {
        const { data, error } = await this.supabaseClient.getClient()
            .from('org_report_requirements')
            .select(`
                *,
                report_templates (*)
            `)
            .eq('organization_id', this.organizationId)
            .eq('enabled', true);

        if (error) throw error;
        return data;
    }

    async getGeneratedReports() {
        const { data, error} = await this.supabaseClient.getClient()
            .from('generated_reports')
            .select('*')
            .eq('organization_id', this.organizationId)
            .order('period_start', { ascending: false });

        if (error) throw error;
        return data || [];
    }

    async calculateChecklistItems(requirements, generatedReports, org) {
        const items = [];
        const today = new Date();

        for (const req of requirements) {
            const template = req.report_templates;

            if (template.frequency === 'monthly') {
                // Generate checklist items for last 3 months and next month
                for (let i = -2; i <= 1; i++) {
                    const period = new Date(today.getFullYear(), today.getMonth() + i, 1);
                    const item = this.createChecklistItem(template, req.location, period, generatedReports);
                    items.push(item);
                }
            } else if (template.frequency === 'yearly') {
                // Generate item for current fiscal year
                const fiscalYearEnd = new Date(today.getFullYear(), org.fiscal_year_end_month - 1, org.fiscal_year_end_day);
                const fiscalYearStart = new Date(fiscalYearEnd);
                fiscalYearStart.setFullYear(fiscalYearStart.getFullYear() - 1);
                fiscalYearStart.setDate(fiscalYearStart.getDate() + 1);

                const item = this.createChecklistItem(template, req.location, fiscalYearStart, generatedReports, fiscalYearEnd);
                items.push(item);
            }
        }

        // Sort by due date (chronological)
        items.sort((a, b) => a.dueDate - b.dueDate);

        return items;
    }

    createChecklistItem(template, location, periodStart, generatedReports, periodEnd = null) {
        const today = new Date();

        // Calculate period end if not provided
        if (!periodEnd) {
            periodEnd = new Date(periodStart);
            if (template.frequency === 'monthly') {
                periodEnd.setMonth(periodEnd.getMonth() + 1);
                periodEnd.setDate(0); // Last day of month
            }
        }

        // Calculate due date
        const dueDate = this.calculateDueDate(periodEnd, template);

        // Find if report has been generated
        const generated = generatedReports.find(r =>
            r.template_code === template.template_code &&
            r.location === location &&
            new Date(r.period_start).getTime() === periodStart.getTime()
        );

        // Calculate status
        let status = 'not-started';
        let statusLabel = '⭕ Not Generated';
        let statusClass = 'status-not-started';

        if (generated) {
            if (generated.status === 'filed') {
                status = 'filed';
                statusLabel = `✅ Filed (${this.formatDate(new Date(generated.filed_date))})`;
                statusClass = 'status-filed';
            } else {
                status = 'generated';
                statusLabel = `✅ Generated (${this.formatDate(new Date(generated.generated_at))})`;
                statusClass = 'status-generated';
            }
        }

        // Calculate urgency
        const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
        let urgency = 'upcoming';
        if (daysUntilDue < 0 && status !== 'filed') {
            urgency = 'overdue';
        } else if (daysUntilDue <= 30 && status !== 'filed') {
            urgency = 'due-soon';
        } else if (status === 'filed') {
            urgency = 'filed';
        }

        return {
            template,
            location,
            periodStart,
            periodEnd,
            dueDate,
            status,
            statusLabel,
            statusClass,
            urgency,
            daysUntilDue,
            generated
        };
    }

    calculateDueDate(periodEnd, template) {
        const dueDate = new Date(periodEnd);

        if (template.frequency === 'monthly') {
            // Monthly reports due on specific day of following month
            dueDate.setMonth(dueDate.getMonth() + 1);
            dueDate.setDate(template.due_day);
        } else if (template.frequency === 'yearly') {
            // Yearly reports due on specific month/day
            dueDate.setFullYear(periodEnd.getFullYear() + 1);
            dueDate.setMonth(template.due_month - 1);
            dueDate.setDate(template.due_day);
        }

        return dueDate;
    }

    renderChecklist(items) {
        const container = document.getElementById('checklistContent');

        // Group items by urgency
        const overdue = items.filter(i => i.urgency === 'overdue');
        const dueSoon = items.filter(i => i.urgency === 'due-soon');
        const upcoming = items.filter(i => i.urgency === 'upcoming');
        const filed = items.filter(i => i.urgency === 'filed');

        let html = '';

        // Overdue section
        if (overdue.length > 0) {
            html += `
                <div class="checklist-section">
                    <div class="checklist-section-header overdue">
                        <i data-lucide="alert-triangle" style="width: 20px; height: 20px;"></i>
                        <h2>OVERDUE (${overdue.length})</h2>
                    </div>
                    ${overdue.map(item => this.renderChecklistCard(item)).join('')}
                </div>
            `;
        }

        // Due soon section
        if (dueSoon.length > 0) {
            html += `
                <div class="checklist-section">
                    <div class="checklist-section-header due-soon">
                        <i data-lucide="bell" style="width: 20px; height: 20px;"></i>
                        <h2>DUE THIS MONTH (${dueSoon.length})</h2>
                    </div>
                    ${dueSoon.map(item => this.renderChecklistCard(item)).join('')}
                </div>
            `;
        }

        // Upcoming section
        if (upcoming.length > 0) {
            html += `
                <div class="checklist-section">
                    <div class="checklist-section-header upcoming">
                        <i data-lucide="clock" style="width: 20px; height: 20px;"></i>
                        <h2>UPCOMING (${upcoming.length})</h2>
                    </div>
                    ${upcoming.map(item => this.renderChecklistCard(item, true)).join('')}
                </div>
            `;
        }

        // Filed section (compact list)
        if (filed.length > 0) {
            html += `
                <div class="checklist-section">
                    <div class="checklist-section-header filed">
                        <i data-lucide="check-circle" style="width: 20px; height: 20px;"></i>
                        <h2>FILED THIS YEAR (${filed.length})</h2>
                    </div>
                    <div class="content-card">
                        <div class="card-body">
                            <ul class="filed-list">
                                ${filed.map(item => `
                                    <li>
                                        • ${item.template.name} - ${this.formatPeriod(item.periodStart, item.template.frequency)}
                                        (Filed ${this.formatDate(new Date(item.generated.filed_date))})
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;

        // Reinitialize Lucide icons
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    renderChecklistCard(item, compact = false) {
        const dueDateText = item.daysUntilDue < 0
            ? `${Math.abs(item.daysUntilDue)} days overdue`
            : `${item.daysUntilDue} days remaining`;

        if (compact) {
            return `
                <div class="checklist-card compact">
                    <div class="checklist-card-header">
                        <div>
                            <div class="checklist-card-title">${item.template.name} - ${this.formatPeriod(item.periodStart, item.template.frequency)}</div>
                            <div class="checklist-card-meta">Due: ${this.formatDate(item.dueDate)} (${dueDateText})</div>
                        </div>
                        <div class="${item.statusClass}">${item.statusLabel}</div>
                    </div>
                </div>
            `;
        }

        return `
            <div class="content-card checklist-card">
                <div class="card-body">
                    <div class="checklist-card-header">
                        <div>
                            <h3 class="checklist-card-title">${item.template.name} - ${this.formatPeriod(item.periodStart, item.template.frequency)}</h3>
                            <div class="checklist-card-meta">
                                Due: ${this.formatDate(item.dueDate)}
                                ${item.daysUntilDue < 0 ? `(${Math.abs(item.daysUntilDue)} days overdue)` : `(${item.daysUntilDue} days remaining)`}
                            </div>
                        </div>
                        <div class="${item.statusClass}">${item.statusLabel}</div>
                    </div>

                    ${item.generated && item.generated.data_snapshot ? `
                        <div class="checklist-card-data">
                            <strong>Data Preview:</strong>
                            <ul>
                                ${item.generated.data_snapshot.sessions ? `<li>Sessions: ${item.generated.data_snapshot.sessions}</li>` : ''}
                                ${item.generated.data_snapshot.attendance ? `<li>Attendance: ${item.generated.data_snapshot.attendance}</li>` : ''}
                                ${item.generated.data_snapshot.gross_receipts ? `<li>Gross Receipts: $${item.generated.data_snapshot.gross_receipts.toLocaleString()}</li>` : ''}
                                ${item.generated.data_snapshot.prize_payouts ? `<li>Prize Payouts: $${item.generated.data_snapshot.prize_payouts.toLocaleString()}</li>` : ''}
                            </ul>
                        </div>
                    ` : ''}

                    <div class="checklist-card-actions">
                        ${item.status === 'not-started' ? `
                            <button class="btn btn-primary" onclick="window.app.generateReport('${item.template.template_code}', '${item.periodStart.toISOString()}', '${item.periodEnd.toISOString()}', '${item.location}')">
                                <i data-lucide="file-plus" style="width: 16px; height: 16px;"></i>
                                Generate Report
                            </button>
                            <button class="btn btn-secondary">
                                <i data-lucide="info" style="width: 16px; height: 16px;"></i>
                                View Requirements
                            </button>
                        ` : ''}

                        ${item.status === 'generated' ? `
                            <button class="btn btn-secondary">
                                <i data-lucide="download" style="width: 16px; height: 16px;"></i>
                                Download PDF
                            </button>
                            <button class="btn btn-primary" onclick="window.app.markAsFiled('${item.generated.id}')">
                                <i data-lucide="check" style="width: 16px; height: 16px;"></i>
                                Mark as Filed
                            </button>
                            <button class="btn btn-secondary" onclick="window.app.generateReport('${item.template.template_code}', '${item.periodStart.toISOString()}', '${item.periodEnd.toISOString()}', '${item.location}')">
                                <i data-lucide="refresh-cw" style="width: 16px; height: 16px;"></i>
                                Re-generate
                            </button>
                        ` : ''}

                        ${item.status === 'filed' ? `
                            <button class="btn btn-secondary">
                                <i data-lucide="download" style="width: 16px; height: 16px;"></i>
                                Download PDF
                            </button>
                            <button class="btn btn-secondary">
                                <i data-lucide="file-text" style="width: 16px; height: 16px;"></i>
                                View Details
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    formatDate(date) {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    formatPeriod(periodStart, frequency) {
        if (frequency === 'monthly') {
            return periodStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        } else if (frequency === 'yearly') {
            return `FY ${periodStart.getFullYear()}`;
        }
        return periodStart.toLocaleDateString();
    }

    renderError() {
        const container = document.getElementById('checklistContent');
        container.innerHTML = `
            <div class="content-card">
                <div class="card-body">
                    <p class="empty-state" style="color: #ef4444;">
                        Error loading report checklist. Please try again.
                    </p>
                </div>
            </div>
        `;
    }
}
