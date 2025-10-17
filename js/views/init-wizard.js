// Organization Initialization Wizard
// Handles organization setup and location management

import { supabase } from '../core/supabase-client.js';

class InitWizard {
    constructor() {
        this.locations = [];
        this.locationIdCounter = 0;
        this.caCounties = [];
        this.usStates = [
            'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
            'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
            'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
            'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
            'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
        ];
    }

    /**
     * Initialize the wizard
     */
    async init() {
        console.log('Initializing Organization Wizard...');

        // Load California counties
        await this.loadCACounties();

        // Check if organization already exists
        await this.checkExistingOrganization();

        // Set up event listeners
        this.setupEventListeners();
    }

    /**
     * Load California counties from database
     */
    async loadCACounties() {
        try {
            const counties = await supabase.getCACounties();
            this.caCounties = counties.map(c => c.county_name);
            console.log(`✅ Loaded ${this.caCounties.length} CA counties`);
        } catch (error) {
            console.error('Error loading CA counties:', error);
            this.caCounties = [];
        }
    }

    /**
     * Check if organization already exists and load it
     */
    async checkExistingOrganization() {
        try {
            const org = await supabase.getOrganization();
            if (org) {
                // Organization exists - show summary
                await this.displayOrganizationSummary(org);
            }
        } catch (error) {
            console.error('Error checking for existing organization:', error);
        }
    }

    /**
     * Display existing organization summary
     */
    async displayOrganizationSummary(org) {
        const statusCard = document.getElementById('organizationStatusCard');

        // Load locations
        const locations = await supabase.getLocations();

        statusCard.innerHTML = `
            <div style="display: grid; gap: 15px;">
                <div>
                    <div style="font-weight: 500; color: #374151; margin-bottom: 8px;">Organization Name</div>
                    <div style="font-size: 18px; color: #111827;">${org.organization_name}</div>
                </div>
                <div>
                    <div style="font-weight: 500; color: #374151; margin-bottom: 8px;">Fiscal Year Ending</div>
                    <div>${this.formatDate(org.fiscal_year_ending)}</div>
                </div>
                <div>
                    <div style="font-weight: 500; color: #374151; margin-bottom: 8px;">Locations</div>
                    <div style="display: grid; gap: 8px;">
                        ${locations.map(loc => `
                            <div style="padding: 10px; background: #f9fafb; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <strong>${loc.location_code}</strong> - ${loc.location_name}
                                    <span style="color: #6b7280; margin-left: 10px;">${loc.state}${loc.county ? ` - ${loc.county} County` : ''}</span>
                                </div>
                                ${loc.is_active
                                    ? '<span class="badge" style="background: #22c55e; color: white;">Active</span>'
                                    : '<span class="badge" style="background: #94a3b8; color: white;">Inactive</span>'
                                }
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        // Update button text
        const initBtn = document.getElementById('initOrganizationBtn');
        initBtn.innerHTML = `
            <i data-lucide="edit" style="width: 16px; height: 16px;"></i>
            Edit Organization
        `;

        // Re-render Lucide icons
        lucide.createIcons();
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Initialize Organization button
        document.getElementById('initOrganizationBtn').addEventListener('click', () => {
            this.showWizard();
        });

        // Add Location button
        document.getElementById('addLocationBtn').addEventListener('click', () => {
            this.addLocationField();
        });

        // Cancel button
        document.getElementById('cancelWizardBtn').addEventListener('click', () => {
            this.hideWizard();
        });

        // Form submit
        document.getElementById('organizationForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveOrganization();
        });
    }

    /**
     * Show the wizard form
     */
    async showWizard() {
        // Load existing organization data if it exists
        const org = await supabase.getOrganization();
        const locations = await supabase.getLocations();

        // Populate form
        if (org) {
            document.getElementById('orgName').value = org.organization_name;
            document.getElementById('fiscalYearEnding').value = org.fiscal_year_ending;
        }

        // Clear and repopulate locations
        this.locations = [];
        this.locationIdCounter = 0;
        const container = document.getElementById('locationsContainer');
        container.innerHTML = '';

        if (locations && locations.length > 0) {
            locations.forEach(loc => {
                this.addLocationField({
                    id: loc.id,
                    location_code: loc.location_code,
                    location_name: loc.location_name,
                    state: loc.state,
                    county: loc.county
                });
            });
        } else {
            // Add first location by default
            this.addLocationField();
        }

        // Show wizard, hide status card
        document.getElementById('organizationWizard').style.display = 'block';
        document.getElementById('organizationStatusCard').parentElement.style.display = 'none';

        // Re-render Lucide icons
        lucide.createIcons();
    }

    /**
     * Hide the wizard form
     */
    hideWizard() {
        document.getElementById('organizationWizard').style.display = 'none';
        document.getElementById('organizationStatusCard').parentElement.style.display = 'block';
    }

    /**
     * Add a location input field
     */
    addLocationField(existingData = null) {
        const locationId = existingData?.id || `new_${this.locationIdCounter++}`;

        const locationEntry = {
            id: locationId,
            code: existingData?.location_code || '',
            name: existingData?.location_name || '',
            state: existingData?.state || '',
            county: existingData?.county || ''
        };

        this.locations.push(locationEntry);

        const container = document.getElementById('locationsContainer');
        const locationDiv = document.createElement('div');
        locationDiv.className = 'location-entry';
        locationDiv.dataset.locationId = locationId;
        locationDiv.style.cssText = 'padding: 20px; background: #f9fafb; border-radius: 8px; margin-bottom: 15px; position: relative;';

        locationDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                <h4 style="margin: 0; color: #374151;">Location ${this.locations.length}</h4>
                ${this.locations.length > 1 ? `
                    <button type="button" class="btn btn-danger btn-sm remove-location-btn" data-location-id="${locationId}">
                        <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
                        Remove
                    </button>
                ` : ''}
            </div>
            <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 15px; margin-bottom: 15px;">
                <div>
                    <label style="display: block; margin-bottom: 6px; font-weight: 500; font-size: 14px;">Location Code *</label>
                    <input
                        type="text"
                        class="form-input location-code"
                        data-location-id="${locationId}"
                        placeholder="e.g., SC"
                        value="${locationEntry.code}"
                        maxlength="10"
                        required
                    >
                </div>
                <div>
                    <label style="display: block; margin-bottom: 6px; font-weight: 500; font-size: 14px;">Location Name *</label>
                    <input
                        type="text"
                        class="form-input location-name"
                        data-location-id="${locationId}"
                        placeholder="e.g., Santa Clara Bingo Hall"
                        value="${locationEntry.name}"
                        required
                    >
                </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 15px;">
                <div>
                    <label style="display: block; margin-bottom: 6px; font-weight: 500; font-size: 14px;">State *</label>
                    <select
                        class="form-input location-state"
                        data-location-id="${locationId}"
                        required
                    >
                        <option value="">Select state...</option>
                        ${this.usStates.map(state =>
                            `<option value="${state}" ${state === locationEntry.state ? 'selected' : ''}>${state}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="county-container" style="${locationEntry.state === 'CA' ? '' : 'display: none;'}">
                    <label style="display: block; margin-bottom: 6px; font-weight: 500; font-size: 14px;">County ${locationEntry.state === 'CA' ? '*' : '(CA only)'}</label>
                    <select
                        class="form-input location-county"
                        data-location-id="${locationId}"
                        ${locationEntry.state === 'CA' ? 'required' : ''}
                    >
                        <option value="">Select county...</option>
                        ${this.caCounties.map(county =>
                            `<option value="${county}" ${county === locationEntry.county ? 'selected' : ''}>${county}</option>`
                        ).join('')}
                    </select>
                </div>
            </div>
        `;

        container.appendChild(locationDiv);

        // Add event listener for state change (show/hide county)
        const stateSelect = locationDiv.querySelector('.location-state');
        const countyContainer = locationDiv.querySelector('.county-container');
        const countySelect = locationDiv.querySelector('.location-county');

        stateSelect.addEventListener('change', (e) => {
            if (e.target.value === 'CA') {
                countyContainer.style.display = 'block';
                countySelect.required = true;
            } else {
                countyContainer.style.display = 'none';
                countySelect.required = false;
                countySelect.value = '';
            }
        });

        // Add remove button listener
        if (this.locations.length > 1) {
            const removeBtn = locationDiv.querySelector('.remove-location-btn');
            removeBtn.addEventListener('click', () => {
                this.removeLocationField(locationId);
            });
        }

        // Re-render Lucide icons
        lucide.createIcons();
    }

    /**
     * Remove a location field
     */
    removeLocationField(locationId) {
        // Remove from DOM
        const locationDiv = document.querySelector(`[data-location-id="${locationId}"]`).closest('.location-entry');
        locationDiv.remove();

        // Remove from locations array
        this.locations = this.locations.filter(loc => loc.id !== locationId);

        // Renumber remaining locations
        this.renumberLocations();
    }

    /**
     * Renumber location headings
     */
    renumberLocations() {
        const locationDivs = document.querySelectorAll('.location-entry');
        locationDivs.forEach((div, index) => {
            const heading = div.querySelector('h4');
            heading.textContent = `Location ${index + 1}`;
        });
    }

    /**
     * Save organization and locations
     */
    async saveOrganization() {
        try {
            // Get form values
            const orgName = document.getElementById('orgName').value.trim();
            const fiscalYearEnding = document.getElementById('fiscalYearEnding').value;

            if (!orgName || !fiscalYearEnding) {
                alert('Please fill in all required fields');
                return;
            }

            // Collect location data
            const locationsData = [];
            const locationEntries = document.querySelectorAll('.location-entry');

            locationEntries.forEach(entry => {
                const locationId = entry.dataset.locationId;
                const code = entry.querySelector('.location-code').value.trim();
                const name = entry.querySelector('.location-name').value.trim();
                const state = entry.querySelector('.location-state').value;
                const county = entry.querySelector('.location-county').value;

                if (!code || !name || !state) {
                    throw new Error('Please fill in all required location fields');
                }

                if (state === 'CA' && !county) {
                    throw new Error('County is required for California locations');
                }

                locationsData.push({
                    location_code: code,
                    location_name: name,
                    state: state,
                    county: state === 'CA' ? county : null,
                    is_active: true
                });
            });

            if (locationsData.length === 0) {
                alert('Please add at least one location');
                return;
            }

            // Save organization
            console.log('Saving organization...');
            const orgData = {
                organization_name: orgName,
                fiscal_year_ending: fiscalYearEnding
            };

            await supabase.upsertOrganization(orgData);
            console.log('✅ Organization saved');

            // Save locations
            console.log('Saving locations...');
            for (const location of locationsData) {
                await supabase.upsertLocation(location);
            }
            console.log('✅ Locations saved');

            // Update header
            this.updateHeader(orgName);

            // Hide wizard and show summary
            this.hideWizard();
            await this.checkExistingOrganization();

            alert('Organization settings saved successfully!');

        } catch (error) {
            console.error('Error saving organization:', error);
            alert('Error saving organization: ' + error.message);
        }
    }

    /**
     * Update header with organization name
     */
    updateHeader(orgName) {
        const headerOrgName = document.getElementById('organizationName');
        if (headerOrgName) {
            headerOrgName.textContent = orgName.toUpperCase();
        }
    }

    /**
     * Format date for display
     */
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
}

export const initWizard = new InitWizard();
