/**
 * Historical Analysis View
 * Provides long-term trend analysis for Sessions and EBITDA
 */

export class HistoricalView {
    constructor(supabaseClient, sessionDataClient) {
        this.supabaseClient = supabaseClient;
        this.sessionDataClient = sessionDataClient;

        // Current filter state
        this.currentLocation = 'COMBINED';
        this.currentRange = '1Y';

        // Chart instances
        this.charts = {
            sessionCountTrend: null,
            revenuePerSession: null,
            ebitdaTrend: null,
            revenueVsExpenses: null,
            ebitdaMargin: null
        };

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupTabNavigation();
    }

    setupEventListeners() {
        // Location filters
        document.querySelectorAll('.historical-location-filter').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.historical-location-filter').forEach(b =>
                    b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentLocation = e.target.dataset.location;
                this.refreshCharts();
            });
        });

        // Time range filters
        document.querySelectorAll('.historical-range-filter').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.historical-range-filter').forEach(b =>
                    b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentRange = e.target.dataset.range;
                this.refreshCharts();
            });
        });
    }

    setupTabNavigation() {
        document.querySelectorAll('#historical-view .tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabId = e.currentTarget.dataset.tab;

                // Update active tab button
                document.querySelectorAll('#historical-view .tab-btn').forEach(b =>
                    b.classList.remove('active'));
                e.currentTarget.classList.add('active');

                // Update active tab content
                document.querySelectorAll('#historical-view .tab-content').forEach(content =>
                    content.classList.remove('active'));
                document.getElementById(`${tabId}-tab`).classList.add('active');

                // Refresh charts when switching tabs
                if (tabId === 'sessions-history') {
                    this.refreshSessionCharts();
                } else if (tabId === 'ebitda-history') {
                    this.refreshEbitdaCharts();
                }
            });
        });
    }

    async loadData() {
        try {
            // Calculate date range based on filter
            const endDate = new Date();
            let startDate = new Date();

            switch (this.currentRange) {
                case '1Y':
                    startDate.setFullYear(endDate.getFullYear() - 1);
                    break;
                case '2Y':
                    startDate.setFullYear(endDate.getFullYear() - 2);
                    break;
                case '3Y':
                    startDate.setFullYear(endDate.getFullYear() - 3);
                    break;
                case 'ALL':
                    startDate = new Date('2020-01-01'); // Default start date
                    break;
            }

            // Fetch session data using supabase client
            const sessionData = await this.supabaseClient.getSessionsByDateRange(
                startDate.toISOString().split('T')[0],
                endDate.toISOString().split('T')[0],
                this.currentLocation === 'COMBINED' ? null : this.currentLocation
            );

            // Fetch monthly summaries
            const summaries = await this.supabaseClient.getMonthlySummariesByRange(
                startDate.toISOString().split('T')[0],
                endDate.toISOString().split('T')[0],
                this.currentLocation === 'COMBINED' ? null : this.currentLocation
            );

            return { sessionData, summaries };
        } catch (error) {
            console.error('Error loading historical data:', error);
            return { sessionData: [], summaries: [] };
        }
    }

    async refreshCharts() {
        const activeTab = document.querySelector('#historical-view .tab-btn.active').dataset.tab;

        if (activeTab === 'sessions-history') {
            await this.refreshSessionCharts();
        } else if (activeTab === 'ebitda-history') {
            await this.refreshEbitdaCharts();
        }
    }

    async refreshSessionCharts() {
        const { sessionData, summaries } = await this.loadData();

        this.renderSessionCountTrend(sessionData);
        this.renderRevenuePerSession(summaries);
    }

    async refreshEbitdaCharts() {
        const { summaries } = await this.loadData();

        this.renderEbitdaTrend(summaries);
        this.renderRevenueVsExpenses(summaries);
        this.renderEbitdaMargin(summaries);
    }

    renderSessionCountTrend(sessionData) {
        // Get current month to exclude it
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        // Aggregate sessions by month
        const monthlyData = {};

        sessionData.forEach(session => {
            const monthKey = session.session_date.substring(0, 7); // YYYY-MM
            // Skip current month
            if (monthKey === currentMonth) {
                return;
            }
            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = 0;
            }
            monthlyData[monthKey]++;
        });

        // Sort by date
        const sortedMonths = Object.keys(monthlyData).sort();
        const counts = sortedMonths.map(month => monthlyData[month]);

        // Format labels
        const labels = sortedMonths.map(month => {
            const [year, monthNum] = month.split('-');
            const date = new Date(year, monthNum - 1);
            return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        });

        // Destroy existing chart
        if (this.charts.sessionCountTrend) {
            this.charts.sessionCountTrend.destroy();
        }

        // Create new chart
        const options = {
            series: [{
                name: 'Sessions',
                data: counts
            }],
            chart: {
                type: 'line',
                height: 350,
                toolbar: {
                    show: true,
                    tools: {
                        download: true,
                        selection: true,
                        zoom: true,
                        zoomin: true,
                        zoomout: true,
                        pan: true,
                        reset: true
                    }
                }
            },
            stroke: {
                curve: 'smooth',
                width: 3
            },
            colors: ['#4f46e5'],
            xaxis: {
                categories: labels,
                labels: {
                    rotate: -45,
                    rotateAlways: false
                }
            },
            yaxis: {
                title: {
                    text: 'Number of Sessions'
                },
                labels: {
                    formatter: (value) => Math.round(value)
                }
            },
            dataLabels: {
                enabled: false
            },
            markers: {
                size: 4,
                hover: {
                    size: 6
                }
            },
            grid: {
                borderColor: '#e5e7eb'
            },
            tooltip: {
                y: {
                    formatter: (value) => `${value} sessions`
                }
            }
        };

        this.charts.sessionCountTrend = new ApexCharts(
            document.querySelector('#sessionCountTrendChart'),
            options
        );
        this.charts.sessionCountTrend.render();
    }

    renderRevenuePerSession(summaries) {
        // Get current month to exclude it
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        // Calculate revenue per session for each month
        const data = summaries
            .filter(s => s.session_count > 0)
            .map(summary => {
                const monthKey = `${summary.year}-${String(summary.month).padStart(2, '0')}`;
                const revenuePerSession = summary.total_sales / summary.session_count;
                return { month: monthKey, value: revenuePerSession };
            })
            .filter(d => d.month !== currentMonth) // Exclude current month
            .sort((a, b) => a.month.localeCompare(b.month));

        const labels = data.map(d => {
            const [year, monthNum] = d.month.split('-');
            const date = new Date(year, monthNum - 1);
            return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        });

        const values = data.map(d => d.value);

        // Destroy existing chart
        if (this.charts.revenuePerSession) {
            this.charts.revenuePerSession.destroy();
        }

        // Create new chart
        const options = {
            series: [{
                name: 'Revenue per Session',
                data: values
            }],
            chart: {
                type: 'area',
                height: 350,
                toolbar: {
                    show: true,
                    tools: {
                        download: true,
                        selection: true,
                        zoom: true,
                        zoomin: true,
                        zoomout: true,
                        pan: true,
                        reset: true
                    }
                }
            },
            fill: {
                type: 'gradient',
                gradient: {
                    shadeIntensity: 1,
                    opacityFrom: 0.7,
                    opacityTo: 0.3
                }
            },
            stroke: {
                curve: 'smooth',
                width: 2
            },
            colors: ['#10b981'],
            xaxis: {
                categories: labels,
                labels: {
                    rotate: -45
                }
            },
            yaxis: {
                labels: {
                    formatter: (value) => `$${Math.round(value).toLocaleString()}`
                }
            },
            dataLabels: {
                enabled: false
            },
            tooltip: {
                y: {
                    formatter: (value) => `$${value.toFixed(2)}`
                }
            }
        };

        this.charts.revenuePerSession = new ApexCharts(
            document.querySelector('#revenuePerSessionChart'),
            options
        );
        this.charts.revenuePerSession.render();
    }

    renderEbitdaTrend(summaries) {
        // Calculate EBITDA for each month
        const data = summaries.map(summary => {
            const monthKey = `${summary.year}-${String(summary.month).padStart(2, '0')}`;
            const payouts = summary.total_payouts || 0;
            const otherExpenses = summary.other_expenses || 0;
            const ebitda = summary.total_sales - payouts - otherExpenses;
            return { month: monthKey, value: ebitda };
        }).sort((a, b) => a.month.localeCompare(b.month));

        const labels = data.map(d => {
            const [year, monthNum] = d.month.split('-');
            const date = new Date(year, monthNum - 1);
            return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        });

        const values = data.map(d => d.value);

        // Destroy existing chart
        if (this.charts.ebitdaTrend) {
            this.charts.ebitdaTrend.destroy();
        }

        // Create new chart
        const options = {
            series: [{
                name: 'EBITDA',
                data: values
            }],
            chart: {
                type: 'line',
                height: 350,
                toolbar: {
                    show: true,
                    tools: {
                        download: true,
                        selection: true,
                        zoom: true,
                        zoomin: true,
                        zoomout: true,
                        pan: true,
                        reset: true
                    }
                }
            },
            stroke: {
                curve: 'smooth',
                width: 3
            },
            colors: ['#059669'],
            xaxis: {
                categories: labels,
                labels: {
                    rotate: -45
                }
            },
            yaxis: {
                title: {
                    text: 'EBITDA ($)'
                },
                labels: {
                    formatter: (value) => `$${Math.round(value).toLocaleString()}`
                }
            },
            dataLabels: {
                enabled: false
            },
            markers: {
                size: 4,
                hover: {
                    size: 6
                }
            },
            grid: {
                borderColor: '#e5e7eb'
            },
            tooltip: {
                y: {
                    formatter: (value) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                }
            }
        };

        this.charts.ebitdaTrend = new ApexCharts(
            document.querySelector('#ebitdaTrendChart'),
            options
        );
        this.charts.ebitdaTrend.render();
    }

    renderRevenueVsExpenses(summaries) {
        // Calculate revenue and expenses for each month
        const data = summaries.map(summary => {
            const monthKey = `${summary.year}-${String(summary.month).padStart(2, '0')}`;
            const revenue = summary.total_sales;
            const payouts = summary.total_payouts || 0;
            const otherExpenses = summary.other_expenses || 0;
            const totalExpenses = payouts + otherExpenses;
            return { month: monthKey, revenue, expenses: totalExpenses };
        }).sort((a, b) => a.month.localeCompare(b.month));

        const labels = data.map(d => {
            const [year, monthNum] = d.month.split('-');
            const date = new Date(year, monthNum - 1);
            return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        });

        const revenueData = data.map(d => d.revenue);
        const expensesData = data.map(d => d.expenses);

        // Destroy existing chart
        if (this.charts.revenueVsExpenses) {
            this.charts.revenueVsExpenses.destroy();
        }

        // Create new chart
        const options = {
            series: [
                {
                    name: 'Revenue',
                    data: revenueData
                },
                {
                    name: 'Expenses',
                    data: expensesData
                }
            ],
            chart: {
                type: 'area',
                height: 300,
                toolbar: {
                    show: false
                }
            },
            fill: {
                type: 'gradient',
                gradient: {
                    shadeIntensity: 1,
                    opacityFrom: 0.7,
                    opacityTo: 0.3
                }
            },
            stroke: {
                curve: 'smooth',
                width: 2
            },
            colors: ['#10b981', '#ef4444'],
            xaxis: {
                categories: labels,
                labels: {
                    rotate: -45
                }
            },
            yaxis: {
                labels: {
                    formatter: (value) => `$${Math.round(value / 1000)}K`
                }
            },
            dataLabels: {
                enabled: false
            },
            legend: {
                position: 'top'
            },
            tooltip: {
                y: {
                    formatter: (value) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                }
            }
        };

        this.charts.revenueVsExpenses = new ApexCharts(
            document.querySelector('#revenueVsExpensesChart'),
            options
        );
        this.charts.revenueVsExpenses.render();
    }

    renderEbitdaMargin(summaries) {
        // Calculate EBITDA margin percentage for each month
        const data = summaries
            .filter(s => s.total_sales > 0)
            .map(summary => {
                const monthKey = `${summary.year}-${String(summary.month).padStart(2, '0')}`;
                const payouts = summary.total_payouts || 0;
                const otherExpenses = summary.other_expenses || 0;
                const ebitda = summary.total_sales - payouts - otherExpenses;
                const marginPercent = (ebitda / summary.total_sales) * 100;
                return { month: monthKey, value: marginPercent };
            })
            .sort((a, b) => a.month.localeCompare(b.month));

        const labels = data.map(d => {
            const [year, monthNum] = d.month.split('-');
            const date = new Date(year, monthNum - 1);
            return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        });

        const values = data.map(d => d.value);

        // Destroy existing chart
        if (this.charts.ebitdaMargin) {
            this.charts.ebitdaMargin.destroy();
        }

        // Create new chart
        const options = {
            series: [{
                name: 'EBITDA Margin %',
                data: values
            }],
            chart: {
                type: 'line',
                height: 300,
                toolbar: {
                    show: false
                }
            },
            stroke: {
                curve: 'smooth',
                width: 3
            },
            colors: ['#8b5cf6'],
            xaxis: {
                categories: labels,
                labels: {
                    rotate: -45
                }
            },
            yaxis: {
                title: {
                    text: 'Margin %'
                },
                labels: {
                    formatter: (value) => `${value.toFixed(1)}%`
                }
            },
            dataLabels: {
                enabled: false
            },
            markers: {
                size: 4,
                hover: {
                    size: 6
                }
            },
            grid: {
                borderColor: '#e5e7eb'
            },
            tooltip: {
                y: {
                    formatter: (value) => `${value.toFixed(2)}%`
                }
            }
        };

        this.charts.ebitdaMargin = new ApexCharts(
            document.querySelector('#ebitdaMarginChart'),
            options
        );
        this.charts.ebitdaMargin.render();
    }

    async show() {
        // Initial load of charts
        await this.refreshSessionCharts();
    }
}
