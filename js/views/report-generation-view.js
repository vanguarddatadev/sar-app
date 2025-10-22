/**
 * Report Generation View
 * Visual report builder with location, period, and type selection
 */

export class ReportGenerationView {
    constructor() {
        this.selectedLocation = null;
        this.selectedMonth = null;
        this.selectedYear = null;
        this.selectedType = null;
    }

    init() {
        console.log('Initializing Report Generation View');
        this.attachEventListeners();
    }

    attachEventListeners() {
        // Location selector
        const locationSelect = document.getElementById('reportLocation');
        if (locationSelect) {
            locationSelect.addEventListener('change', (e) => {
                this.selectedLocation = e.target.value;
                this.updateGenerateButton();
            });
        }

        // Month selector
        const monthSelect = document.getElementById('reportMonth');
        if (monthSelect) {
            monthSelect.addEventListener('change', (e) => {
                this.selectedMonth = e.target.value;
                this.updateGenerateButton();
            });
        }

        // Year selector
        const yearSelect = document.getElementById('reportYear');
        if (yearSelect) {
            yearSelect.addEventListener('change', (e) => {
                this.selectedYear = e.target.value;
                this.updateGenerateButton();
            });
        }

        // Report type boxes
        const typeBoxes = document.querySelectorAll('.report-type-box');
        typeBoxes.forEach(box => {
            box.addEventListener('click', () => {
                // Remove selected from all boxes
                typeBoxes.forEach(b => b.classList.remove('selected'));

                // Add selected to clicked box
                box.classList.add('selected');

                // Store selection
                this.selectedType = box.dataset.type;
                this.updateGenerateButton();
            });
        });

        // Generate button
        const generateBtn = document.getElementById('generateReportBtn');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => {
                this.generateReport();
            });
        }
    }

    updateGenerateButton() {
        const btn = document.getElementById('generateReportBtn');
        const hint = document.querySelector('.generate-hint');

        if (!btn) return;

        const allSelected = this.selectedLocation &&
                          this.selectedMonth &&
                          this.selectedYear &&
                          this.selectedType;

        if (allSelected) {
            btn.disabled = false;
            hint.textContent = 'Ready to generate! Click the button above.';
            hint.style.color = '#10b981';
        } else {
            btn.disabled = true;
            hint.textContent = 'Select location, period, and report type to continue';
            hint.style.color = '#64748b';
        }
    }

    generateReport() {
        const location = this.selectedLocation;
        const month = this.selectedMonth;
        const year = this.selectedYear;
        const type = this.selectedType;

        console.log('Generating report:', { location, month, year, type });

        // For now, show an alert - you can wire this to open the modal later
        alert(`Generating ${type} report for ${this.getMonthName(month)} ${year} at ${this.getLocationName(location)}!`);
    }

    getMonthName(monthNum) {
        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        return months[parseInt(monthNum) - 1];
    }

    getLocationName(code) {
        const locations = {
            'sc': 'Santa Clara',
            'rwc': 'Redwood City',
            'all': 'All Locations'
        };
        return locations[code] || code;
    }
}

// Create singleton instance
const reportGenerationView = new ReportGenerationView();

export { reportGenerationView };
