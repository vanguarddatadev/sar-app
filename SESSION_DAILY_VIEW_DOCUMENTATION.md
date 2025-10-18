# Session Daily View - Implementation Documentation

## Overview
The Session Daily View is a comprehensive analytics interface that compares a selected event/session against a dynamically filtered pool of historical events. This document provides a complete technical specification for implementing this feature in the SAR app.

---

## 1. UI STRUCTURE & LAYOUT

### 1.1 Header Section (Event Selection & Metadata)
```
┌─────────────────────────────────────────────────────────────────┐
│ [Event Button 1] [Event Button 2] [Event Button 3] [▼ Previous] │
├─────────────────────────────────────────────────────────────────┤
│ Event Title  │  Notes Section  │  Comparison Controls          │
│ Date/Type    │  Promotion Notes│  [1M][3M][1Y] ☑Day Only      │
│ Location     │                 │  Hotball: [None▼] Pool: 75   │
└─────────────────────────────────────────────────────────────────┘
```

**Components:**

1. **Event Selector Buttons** (Row 1)
   - Display 3-4 most recent events as clickable buttons
   - Active event highlighted with blue background
   - Dropdown for "Previous Events" showing older events
   - Format: "SC - Monday 10/13"

2. **Event Information** (Row 2, Left)
   - Event title (location + day + date)
   - Metadata icons showing:
     - 📅 Date (10/13)
     - 🎯 Session Type (Regular Session)
     - 📍 Location (Santa Clara)

3. **Notes Sections** (Row 2, Center)
   - **Notes for Event**: Editable text field for event-specific notes
   - **Promotion Notes**: Editable text field for promotion information
   - Both displayed in white boxes with gray borders

4. **Comparison Controls** (Row 2, Right)
   - **COMPARE TO LOCATION AND:** label (blue, uppercase)
   - **Time Period Buttons**: [1M] [3M] [1Y]
     - 1M = Last 1 month (30 days)
     - 3M = Last 3 months (90 days) [DEFAULT]
     - 1Y = Last 1 year (365 days)
     - Active button has blue background
   - **Day Only Checkbox**: Filter to match exact day/session type
   - **Hotball Filter Dropdown**: Match by hotball amount
     - None (default)
     - Category Match
     - 10% Match
     - 20% Match
   - **Pool Count Display**: "Pool: 75" (green, bold number)

### 1.2 Metrics Grid (6 Cards)

```
┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│ NET SALES│   RPA    │TOTAL SALE│ PAYOUTS  │  MARGIN  │ATTENDANCE│
│ $47,235  │  $680    │ $163,154 │ $115,919 │  29.0%   │ 56%/240  │
│ ↑ 15.2%  │ ↑ 32.0%  │ ↑ 17.5%  │ ↑ 18.5%  │ ↓ 2.0%   │ ↓ 11.0%  │
│          │          │          │          │ -0.6pp   │          │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
```

**Card Structure (each card):**
- **Label**: Metric name (12px, gray, uppercase)
- **Value**: Large bold number (28px, dark)
- **Change**: Percentage with arrow (13px, colored)
  - Green ↑ for positive
  - Red ↓ for negative
  - Gray for Payouts (neutral)
- **Expandable**: Click to show more details

**Special Cases:**
- **Margin**: Shows both % change AND percentage point difference (pp)
- **RPA**: When expanded, shows RPA-Strip and RPA-Flash breakdown
- **Attendance**: Shows as percentage + count (e.g., "56%/240")

---

## 2. DATA ARCHITECTURE

### 2.1 Event Manager Class Structure

```javascript
class EventManager {
    constructor() {
        this.currentEvent = null;
        this.allEvents = [];
        this.eventsByLocation = {}; // Events grouped by location
        this.comparisonPeriod = '3M'; // '1M', '3M', '1Y'
        this.dayOnlyFilter = false;
        this.hotballFilter = 'none'; // 'none', 'category', '10%', '20%'
        this.comparisonEvents = []; // Filtered pool
    }

    selectEvent(event) {
        this.currentEvent = event;
        this.updateComparisons();
        this.renderMetrics();
    }

    setComparisonPeriod(period) {
        this.comparisonPeriod = period;
        this.updateComparisons();
    }

    setDayOnlyFilter(enabled) {
        this.dayOnlyFilter = enabled;
        this.updateComparisons();
    }

    setHotballFilter(filter) {
        this.hotballFilter = filter;
        this.updateComparisons();
    }

    getComparisonPool() {
        // Returns filtered array of events
    }

    updateComparisons() {
        const pool = this.getComparisonPool();
        this.comparisonEvents = pool;
        this.updatePoolCount(pool.length);
        this.calculateAndRenderMetrics(pool);
    }
}
```

### 2.2 Event Object Structure

```javascript
{
    id: "2024-10-13-SC-Monday",
    date: "10/13/2024", // MM/DD/YYYY
    location: "SC", // "SC" or "NJ"
    day: "Monday", // Day of week
    isLate: false, // Late session flag
    sessionType: "Regular Session", // or "Late Session"

    // Financial Metrics
    totalSales: 163154,
    totalPayouts: 115919,
    netSales: 47235,
    margin: 29.0, // percentage

    // Attendance
    attendance: 240,
    attendancePercent: 56, // percentage
    rpa: 680, // Revenue Per Attendee

    // Product Breakdown
    flash: {
        sales: 95000,
        payouts: 68000,
        net: 27000,
        margin: 28.4
    },
    strip: {
        sales: 60000,
        payouts: 42000,
        net: 18000,
        margin: 30.0
    },
    other: {
        sales: 8154,
        payouts: 5919,
        net: 2235,
        margin: 27.4
    },

    // Hotball
    hotballTotal: 8500,
    hotballChange: -500, // Change from previous

    // Notes
    eventNotes: "",
    promotionNotes: ""
}
```

---

## 3. COMPARISON POOL FILTERING LOGIC

### 3.1 Filter Application Order

The comparison pool is built by applying filters in this specific order:

```javascript
getComparisonPool() {
    if (!this.currentEvent) return [];

    // 1. START: Filter by location (ALWAYS)
    let pool = this.eventsByLocation[this.currentEvent.location] || [];

    // 2. Filter by time period
    pool = this.filterByTimePeriod(pool);

    // 3. Filter by Day Only (if enabled)
    if (this.dayOnlyFilter) {
        pool = this.filterByDayMatch(pool);
    }

    // 4. Filter by Hotball (if not 'none')
    if (this.hotballFilter !== 'none') {
        pool = this.filterByHotball(pool);
    }

    // 5. ALWAYS exclude current event
    pool = pool.filter(e => e.id !== this.currentEvent.id);

    return pool;
}
```

### 3.2 Time Period Filter

```javascript
filterByTimePeriod(pool) {
    const currentDate = parseDate(this.currentEvent.date);
    let startDate = new Date(currentDate);

    // Calculate start date based on period
    switch(this.comparisonPeriod) {
        case '1M':
            startDate.setDate(startDate.getDate() - 30);
            break;
        case '3M':
            startDate.setDate(startDate.getDate() - 90);
            break;
        case '1Y':
            startDate.setDate(startDate.getDate() - 365);
            break;
        default:
            startDate.setDate(startDate.getDate() - 90);
    }

    return pool.filter(event => {
        const eventDate = parseDate(event.date);
        // Must be: startDate <= eventDate < currentDate
        return eventDate >= startDate && eventDate < currentDate;
    });
}
```

### 3.3 Day Only Filter

```javascript
filterByDayMatch(pool) {
    return pool.filter(event => {
        // Normalize day strings
        let currentDay = (this.currentEvent.day || '').toLowerCase()
            .replace(/[^a-z]/g, '');
        let eventDay = (event.day || '').toLowerCase()
            .replace(/[^a-z]/g, '');

        // Match day of week
        const dayMatch = currentDay === eventDay;

        // Match session type (Late vs Regular)
        const sessionMatch = this.currentEvent.isLate === event.isLate;

        return dayMatch && sessionMatch;
    });
}
```

### 3.4 Hotball Filter

```javascript
filterByHotball(pool) {
    // Calculate current event's starting hotball
    const currentHotball = this.currentEvent.hotballTotal +
        (this.currentEvent.hotballChange < 0 ?
            Math.abs(this.currentEvent.hotballChange) : 0);

    return pool.filter(event => {
        // Calculate event's starting hotball
        const eventHotball = event.hotballTotal +
            (event.hotballChange < 0 ?
                Math.abs(event.hotballChange) : 0);

        switch(this.hotballFilter) {
            case 'category':
                // Match by color category
                const currentCat = currentHotball < 5000 ? 'green' :
                                  currentHotball < 10000 ? 'yellow' : 'red';
                const eventCat = eventHotball < 5000 ? 'green' :
                                eventHotball < 10000 ? 'yellow' : 'red';
                return currentCat === eventCat;

            case '10%':
                // Within 10% of current hotball
                const range10 = currentHotball * 0.1;
                return Math.abs(eventHotball - currentHotball) <= range10;

            case '20%':
                // Within 20% of current hotball
                const range20 = currentHotball * 0.2;
                return Math.abs(eventHotball - currentHotball) <= range20;

            default:
                return true;
        }
    });
}
```

---

## 4. METRICS CALCULATION

### 4.1 Calculate Pool Averages

```javascript
calculatePoolAverages(pool) {
    if (pool.length === 0) return null;

    const totals = {
        totalSales: 0,
        totalPayouts: 0,
        netSales: 0,
        attendance: 0,
        rpa: 0,
        margin: 0
    };

    // Sum all values
    pool.forEach(event => {
        totals.totalSales += event.totalSales || 0;
        totals.totalPayouts += event.totalPayouts || 0;
        totals.netSales += event.netSales || 0;
        totals.attendance += event.attendance || 0;
    });

    const count = pool.length;

    // Calculate averages
    const averages = {
        totalSales: totals.totalSales / count,
        totalPayouts: totals.totalPayouts / count,
        netSales: totals.netSales / count,
        attendance: totals.attendance / count,
        rpa: totals.attendance > 0 ?
            totals.totalSales / totals.attendance : 0,
        // Margin from totals (more accurate)
        margin: totals.totalSales > 0 ?
            ((totals.totalSales - totals.totalPayouts) / totals.totalSales * 100) : 0
    };

    return averages;
}
```

### 4.2 Calculate Comparison for Each Metric

```javascript
calculateMetricComparison(currentValue, avgValue, metricType) {
    if (!avgValue || avgValue === 0) {
        return {
            percentChange: 0,
            arrow: '',
            color: '#64748b',
            ppDiff: null
        };
    }

    const percentChange = ((currentValue - avgValue) / avgValue) * 100;
    const arrow = percentChange >= 0 ? '↑' : '↓';

    // Color logic
    let color;
    if (metricType === 'payouts') {
        color = '#64748b'; // Neutral gray for payouts
    } else {
        color = percentChange >= 0 ? '#22c55e' : '#ef4444';
    }

    // Calculate percentage point difference for margin
    let ppDiff = null;
    if (metricType === 'margin') {
        ppDiff = currentValue - avgValue;
    }

    return {
        percentChange: Math.abs(percentChange).toFixed(1),
        arrow,
        color,
        ppDiff: ppDiff ? ppDiff.toFixed(1) : null
    };
}
```

### 4.3 Render Metric Card

```javascript
renderMetricCard(metric, currentValue, avgValue, poolSize) {
    const comparison = calculateMetricComparison(
        currentValue, avgValue, metric.type
    );

    const card = document.querySelector(`[data-metric="${metric.id}"]`);

    // Update value
    const valueEl = card.querySelector('.spotlight-value');
    valueEl.textContent = formatMetricValue(currentValue, metric.type);

    // Update change
    const changeEl = card.querySelector('.spotlight-change');
    changeEl.innerHTML = `
        <span style="color: ${comparison.color}">
            ${comparison.arrow} ${comparison.percentChange}%
        </span>
        ${comparison.ppDiff ?
            `<br><span style="font-size: 11px;">${comparison.ppDiff}pp</span>`
            : ''}
    `;

    // Update expansion details
    const expansionValue = card.querySelector('.expansion-value');
    expansionValue.textContent = formatMetricValue(avgValue, metric.type);

    const expansionCount = card.querySelector('.expansion-count');
    expansionCount.textContent = `Average of ${poolSize} events`;
}
```

---

## 5. METRIC FORMATTING

```javascript
function formatMetricValue(value, metricType) {
    switch(metricType) {
        case 'net-sales':
        case 'total-sales':
        case 'payouts':
        case 'rpa':
            return '$' + Math.round(value).toLocaleString();

        case 'margin':
            return value.toFixed(1) + '%';

        case 'attendance':
            // Assuming we have attendancePercent stored
            return `${value.percent}%/${value.count}`;

        default:
            return value.toString();
    }
}
```

---

## 6. USER INTERACTIONS

### 6.1 Event Selection
```javascript
// When user clicks an event button
function handleEventClick(eventId) {
    AppSounds.play('click'); // Play click sound
    const event = findEventById(eventId);
    window.EventManager.selectEvent(event);
}
```

### 6.2 Comparison Filter Changes
```javascript
// Period button click
function handlePeriodClick(period) {
    AppSounds.play('click');

    // Update button states
    document.querySelectorAll('[data-period]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.period === period);
    });

    // Update pool
    window.EventManager.setComparisonPeriod(period);
}

// Day Only checkbox
function handleDayOnlyChange(checked) {
    AppSounds.play('click');
    window.EventManager.setDayOnlyFilter(checked);
}

// Hotball filter dropdown
function handleHotballChange(value) {
    AppSounds.play('click');
    window.EventManager.setHotballFilter(value);
}
```

### 6.3 Card Expansion
```javascript
// When user clicks a metric card
function handleCardClick(card) {
    AppSounds.play('click');
    card.classList.toggle('expanded');
}
```

---

## 7. SOUND EFFECTS

The app uses Web Audio API for interactive sounds:

```javascript
const AppSounds = {
    audioContext: new (window.AudioContext || window.webkitAudioContext)(),
    enabled: true,
    volume: 0.3,

    play(soundType) {
        switch(soundType) {
            case 'click':
                this.playSoftClick(); // 800Hz, 0.05s
                break;
            case 'navigate':
                this.playSwoosh(); // Descending frequency
                break;
            case 'event':
                this.playCasinoChip(); // Two quick ticks
                break;
        }
    },

    playSoftClick() {
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        osc.connect(gain);
        gain.connect(this.audioContext.destination);
        osc.frequency.value = 800;
        gain.gain.value = this.volume * 0.2;
        gain.gain.exponentialRampToValueAtTime(
            0.01, this.audioContext.currentTime + 0.05
        );
        osc.start();
        osc.stop(this.audioContext.currentTime + 0.05);
    }
};
```

---

## 8. STYLING GUIDELINES

### 8.1 Color Scheme
```css
/* Primary Colors */
--blue-primary: #3b82f6;
--green-positive: #22c55e;
--red-negative: #ef4444;
--gray-neutral: #64748b;

/* Background */
--bg-card: rgba(241, 245, 249, 0.8);
--bg-gradient: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);

/* Borders */
--border-light: rgba(148, 163, 184, 0.2);
--border-active: #3b82f6;
```

### 8.2 Card States
```css
.spotlight-card {
    background: rgba(241, 245, 249, 0.8);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 12px;
    padding: 20px;
    transition: all 0.3s;
    cursor: pointer;
    position: relative;
}

.spotlight-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.spotlight-card.expanded {
    z-index: 100;
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.4);
}

.spotlight-expansion {
    display: none;
    position: absolute;
    top: 100%;
    left: -1px;
    right: -1px;
    background: rgba(241, 245, 249, 0.95);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 0 0 12px 12px;
    padding: 15px;
    margin-top: -1px;
}

.spotlight-card.expanded .spotlight-expansion {
    display: block;
}
```

---

## 9. IMPLEMENTATION CHECKLIST

### Phase 1: Basic Structure
- [ ] Create EventManager class
- [ ] Set up event data structure
- [ ] Implement event selector buttons
- [ ] Create metric cards grid
- [ ] Add comparison controls UI

### Phase 2: Filtering Logic
- [ ] Implement time period filter
- [ ] Implement day only filter
- [ ] Implement hotball filter
- [ ] Create getComparisonPool() method
- [ ] Add pool count display

### Phase 3: Metrics Calculation
- [ ] Calculate pool averages
- [ ] Calculate percentage changes
- [ ] Format metric values
- [ ] Render metric cards
- [ ] Handle edge cases (empty pool, zero values)

### Phase 4: Interactivity
- [ ] Event selection handlers
- [ ] Filter change handlers
- [ ] Card expansion/collapse
- [ ] Sound effects integration
- [ ] Update button states

### Phase 5: Polish
- [ ] Responsive design
- [ ] Loading states
- [ ] Error handling
- [ ] Performance optimization
- [ ] Accessibility (ARIA labels)

---

## 10. EXAMPLE USAGE

```javascript
// Initialize
const eventManager = new EventManager();
eventManager.loadEvents(allEventsData);

// Select initial event (most recent)
const latestEvent = eventManager.allEvents[0];
eventManager.selectEvent(latestEvent);

// User changes comparison period to 1 month
eventManager.setComparisonPeriod('1M');
// This automatically:
// 1. Filters pool to last 30 days
// 2. Recalculates averages
// 3. Updates all metric cards
// 4. Updates pool count display

// User enables "Day Only" filter
eventManager.setDayOnlyFilter(true);
// Now pool only includes events on same day (e.g., only Mondays)

// User selects different event
eventManager.selectEvent(anotherEvent);
// All comparisons update based on new current event
```

---

## 11. EDGE CASES & ERROR HANDLING

### Empty Comparison Pool
```javascript
if (pool.length === 0) {
    // Show "N/A" for all comparisons
    cards.forEach(card => {
        card.querySelector('.spotlight-change').textContent = 'N/A';
        card.querySelector('.expansion-value').textContent = 'No comparison data';
        card.querySelector('.expansion-count').textContent =
            'Adjust filters to see comparisons';
    });
    return;
}
```

### Division by Zero
```javascript
// Always check for zero before dividing
const rpa = attendance > 0 ? totalSales / attendance : 0;
const margin = totalSales > 0 ?
    ((totalSales - totalPayouts) / totalSales * 100) : 0;
```

### Missing Data
```javascript
// Use nullish coalescing and defaults
const sales = event.totalSales ?? 0;
const payouts = event.totalPayouts ?? 0;
const attendance = event.attendance ?? 0;
```

---

## 12. PERFORMANCE CONSIDERATIONS

- **Event Grouping**: Pre-group events by location for faster filtering
- **Date Parsing**: Parse dates once and cache
- **Debounce**: Debounce filter changes if updating rapidly
- **Lazy Rendering**: Only render visible cards
- **Memoization**: Cache comparison calculations if current event/filters unchanged

---

## END OF DOCUMENTATION
