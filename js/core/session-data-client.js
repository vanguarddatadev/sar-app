// Session Data Client
// Fetches session data from Google Sheets and parses it for SAR

export class SessionDataClient {
    constructor() {
        this.apiUrl = 'https://script.google.com/macros/s/AKfycbzbmJqRgd4kpZFNrpnKH3I7md6fM8eOsOoukEc2Mp_rDzUQNkpJ7u5msmZ1zJweTKij/exec';
        this.data = null;
        this.lastFetch = null;
    }

    /**
     * Fetch data from Google Sheets using JSONP
     * Returns: { sc: { columns: [], rows: {} }, rwc: { columns: [], rows: {} } }
     */
    async fetchData() {
        return new Promise((resolve, reject) => {
            try {
                console.log('Fetching session data from Google Sheets...');

                // Create unique callback name
                const callbackName = 'jsonpCallback_' + Date.now();

                // Create callback function
                window[callbackName] = (data) => {
                    // Clean up
                    delete window[callbackName];
                    if (script.parentNode) {
                        script.parentNode.removeChild(script);
                    }

                    // Check for errors
                    if (data && data.error) {
                        console.error('API error:', data);
                        reject(new Error(data.message || 'API error'));
                        return;
                    }

                    // Save data
                    this.data = data;
                    this.lastFetch = new Date();
                    console.log('✅ Session data fetched successfully');

                    resolve(data);
                };

                // Create script tag for JSONP
                const script = document.createElement('script');
                script.src = `${this.apiUrl}?callback=${callbackName}`;
                script.onerror = () => {
                    delete window[callbackName];
                    if (script.parentNode) {
                        script.parentNode.removeChild(script);
                    }
                    reject(new Error('Failed to load data from Google Sheets'));
                };

                // Add script to page
                document.head.appendChild(script);

                // Timeout after 30 seconds
                setTimeout(() => {
                    if (window[callbackName]) {
                        delete window[callbackName];
                        if (script.parentNode) {
                            script.parentNode.removeChild(script);
                        }
                        reject(new Error('Request timeout'));
                    }
                }, 30000);

            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Parse raw Google Sheets data into SAR session format
     * Returns array of session objects ready for database insertion
     */
    parseSessions(rawData) {
        if (!rawData) {
            rawData = this.data;
        }

        if (!rawData) {
            throw new Error('No data available. Call fetchData() first.');
        }

        const sessions = [];

        // Parse SC sessions
        if (rawData.sc && rawData.sc.columns) {
            rawData.sc.columns.forEach((column, index) => {
                const session = this.parseSessionColumn('SC', column, rawData.sc.rows);
                if (session) {
                    sessions.push(session);
                }
            });
        }

        // Parse RWC sessions
        if (rawData.rwc && rawData.rwc.columns) {
            rawData.rwc.columns.forEach((column, index) => {
                const session = this.parseSessionColumn('RWC', column, rawData.rwc.rows);
                if (session) {
                    sessions.push(session);
                }
            });
        }

        console.log(`✅ Parsed ${sessions.length} sessions`);
        return sessions;
    }

    /**
     * Parse a single session column into a session object
     */
    parseSessionColumn(location, column, rows) {
        // Helper to get row value from column
        const getRowValue = (rowNum) => {
            return column.values[rowNum] || null;
        };

        // Extract basic session info
        const rawDate = getRowValue(3); // Row 3 = Date
        const dayInfo = getRowValue(4) || ''; // Row 4 = Day

        // Parse date - handle various formats
        let sessionDate = this.parseDate(rawDate);
        if (!sessionDate) {
            console.warn('Skipping session with invalid date:', rawDate);
            return null;
        }

        // Parse day and session type from dayInfo (e.g., "Monday Late", "Tuesday")
        const dayParts = String(dayInfo).trim().split(/\s+/);
        const day = dayParts[0] || '';
        const isLate = dayInfo.toLowerCase().includes('late');
        const sessionType = isLate ? 'Late' : 'Regular';

        // Extract revenue data (row numbers from Vanguard app)
        const flashSales = this.parseNumber(getRowValue(5)) || 0; // Row 5
        const flashPayouts = this.parseNumber(getRowValue(6)) || 0; // Row 6
        const stripSales = this.parseNumber(getRowValue(9)) || 0; // Row 9
        const stripPayouts = this.parseNumber(getRowValue(10)) || 0; // Row 10
        const paperSales = this.parseNumber(getRowValue(13)) || 0; // Row 13
        const paperPayouts = this.parseNumber(getRowValue(14)) || 0; // Row 14
        const cherrySales = this.parseNumber(getRowValue(17)) || 0; // Row 17
        const cherryPayouts = this.parseNumber(getRowValue(18)) || 0; // Row 18
        const allNumbersSales = this.parseNumber(getRowValue(21)) || 0; // Row 21
        const allNumbersPayouts = this.parseNumber(getRowValue(22)) || 0; // Row 22

        // Extract additional revenue fields
        const merchandiseSales = this.parseNumber(getRowValue(25)) || 0; // Row 25 - Merchandise
        const miscReceipts = this.parseNumber(getRowValue(26)) || 0; // Row 26 - Misc Receipts

        // Extract attendance
        const attendance = this.parseNumber(getRowValue(36)) || 0; // Row 36 (or 40 for monthly)

        // Build session object matching our database schema
        return {
            location: location,
            session_date: sessionDate,
            session_type: sessionType,
            day_of_week: day,

            // Flash
            flash_sales: flashSales,
            flash_payouts: flashPayouts,

            // Strip
            strip_sales: stripSales,
            strip_payouts: stripPayouts,

            // Paper
            paper_sales: paperSales,
            paper_payouts: paperPayouts,

            // Cherry
            cherry_sales: cherrySales,
            cherry_payouts: cherryPayouts,

            // All Numbers
            all_numbers_sales: allNumbersSales,
            all_numbers_payouts: allNumbersPayouts,

            // Other revenue
            merchandise_sales: merchandiseSales,
            misc_receipts: miscReceipts,

            // Attendance
            attendance: attendance

            // Note: flash_net, flash_yield, total_sales, total_payouts, net_revenue,
            // total_rpa, flash_rpa will be calculated by database triggers
        };
    }

    /**
     * Parse date string to YYYY-MM-DD format for database
     */
    parseDate(rawDate) {
        if (!rawDate) return null;

        try {
            let dateStr = String(rawDate);

            // Handle ISO format with timestamp (e.g., "2025-08-11T07:00:00.000Z")
            if (dateStr.includes('T')) {
                return dateStr.split('T')[0]; // Returns YYYY-MM-DD
            }

            // Handle date with time like "8/11/2025 8:00:00 AM"
            if (dateStr.includes(' ')) {
                dateStr = dateStr.split(' ')[0];
            }

            // Handle M/D/YYYY or MM/DD/YYYY format
            if (dateStr.includes('/')) {
                const parts = dateStr.split('/');
                if (parts.length === 3) {
                    const month = parts[0].padStart(2, '0');
                    const day = parts[1].padStart(2, '0');
                    const year = parts[2];
                    return `${year}-${month}-${day}`; // YYYY-MM-DD
                }
            }

            // If already in YYYY-MM-DD format
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                return dateStr;
            }

            console.warn('Unable to parse date:', rawDate);
            return null;

        } catch (error) {
            console.error('Error parsing date:', rawDate, error);
            return null;
        }
    }

    /**
     * Parse number from various formats (handles currency, percentages, etc.)
     */
    parseNumber(value) {
        if (value === null || value === undefined || value === '') {
            return null;
        }

        // If already a number
        if (typeof value === 'number') {
            return value;
        }

        // Convert to string and clean
        let str = String(value).trim();

        // Remove currency symbols, commas, parentheses
        str = str.replace(/[$,()]/g, '');

        // Handle percentages
        if (str.includes('%')) {
            str = str.replace('%', '');
            const num = parseFloat(str);
            return isNaN(num) ? null : num;
        }

        // Parse as float
        const num = parseFloat(str);
        return isNaN(num) ? null : num;
    }

    /**
     * Get unique months from sessions for filtering
     */
    getAvailableMonths(sessions) {
        const monthsSet = new Set();

        sessions.forEach(session => {
            if (session.session_date) {
                // Extract YYYY-MM from YYYY-MM-DD
                const month = session.session_date.substring(0, 7);
                monthsSet.add(month);
            }
        });

        // Convert to array and sort (newest first)
        return Array.from(monthsSet).sort().reverse();
    }
}

export const sessionDataClient = new SessionDataClient();
