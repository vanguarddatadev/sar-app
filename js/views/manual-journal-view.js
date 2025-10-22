/**
 * Manual Journal Entry View
 * Handles template creation and manual session data entry
 */

import { supabase } from '../core/supabase.js';

export class ManualJournalView {
    constructor() {
        this.templates = [];
        this.currentTemplate = null;
    }

    init() {
        console.log('Initializing Manual Journal Entry View');
        this.attachEventListeners();
    }

    attachEventListeners() {
        // Create Template button
        const createTemplateBtn = document.getElementById('createTemplateBtn');
        if (createTemplateBtn) {
            createTemplateBtn.addEventListener('click', () => {
                this.showCreateTemplateModal();
            });
        }

        // Create Entry button
        const createEntryBtn = document.getElementById('createEntryBtn');
        if (createEntryBtn) {
            createEntryBtn.addEventListener('click', () => {
                this.showCreateEntryModal();
            });
        }

        // Pull Data button (Stage 2 - placeholder)
        const pullDataBtn = document.getElementById('pullJournalDataBtn');
        if (pullDataBtn) {
            pullDataBtn.addEventListener('click', () => {
                alert('Pull Data from Journals - Coming in Stage 2!');
            });
        }
    }

    /**
     * Show Create Template Modal
     */
    async showCreateTemplateModal() {
        const modal = document.getElementById('manualJournalModal');
        if (!modal) return;

        const modalTitle = document.getElementById('manualJournalTitle');
        const modalBody = document.getElementById('manualJournalBody');

        modalTitle.textContent = 'Create Journal Template';

        modalBody.innerHTML = `
            <div class="template-builder">
                <div class="form-field">
                    <label for="templateName">Template Name <span style="color: red;">*</span></label>
                    <input type="text" id="templateName" placeholder="e.g., SC - Session" required>
                </div>

                <div class="form-field">
                    <label for="templateDescription">Description</label>
                    <input type="text" id="templateDescription" placeholder="e.g., Santa Clara bingo session data entry">
                </div>

                <div class="form-field">
                    <label>Template Fields</label>
                    <p style="color: #64748b; font-size: 13px; margin-bottom: 10px;">
                        Build your custom form by adding fields below.
                    </p>
                    <div id="templateFieldsList">
                        <!-- Fields will be added here -->
                    </div>
                    <button type="button" class="btn btn-secondary" id="addTemplateFieldBtn">
                        <i data-lucide="plus" style="width: 14px; height: 14px;"></i>
                        Add Field
                    </button>
                </div>

                <div class="modal-footer" style="margin-top: 30px; display: flex; gap: 10px; justify-content: flex-end;">
                    <button class="btn btn-secondary" id="cancelTemplateBtn">Cancel</button>
                    <button class="btn btn-success" id="saveTemplateBtn">Save Template</button>
                </div>
            </div>
        `;

        // Show modal
        modal.style.display = 'flex';

        // Re-initialize Lucide icons
        if (window.lucide) {
            window.lucide.createIcons();
        }

        // Attach template builder event listeners
        this.attachTemplateBuilderListeners();
    }

    /**
     * Attach listeners for template builder
     */
    attachTemplateBuilderListeners() {
        // Add Field button
        const addFieldBtn = document.getElementById('addTemplateFieldBtn');
        if (addFieldBtn) {
            addFieldBtn.addEventListener('click', () => {
                this.addTemplateField();
            });
        }

        // Save Template button
        const saveBtn = document.getElementById('saveTemplateBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveTemplate();
            });
        }

        // Cancel button
        const cancelBtn = document.getElementById('cancelTemplateBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.closeModal();
            });
        }
    }

    /**
     * Add a field to the template builder
     */
    addTemplateField() {
        const fieldsList = document.getElementById('templateFieldsList');
        const fieldIndex = fieldsList.children.length;

        const fieldHTML = `
            <div class="template-field-item" data-field-index="${fieldIndex}" style="border: 1px solid #e5e7eb; padding: 15px; border-radius: 8px; margin-bottom: 10px;">
                <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                    <div style="flex: 1;">
                        <label style="font-size: 12px; color: #64748b;">Field Name</label>
                        <input type="text" class="field-name-input" placeholder="e.g., flash" style="width: 100%; padding: 6px; border: 1px solid #e5e7eb; border-radius: 4px;">
                    </div>
                    <div style="flex: 1;">
                        <label style="font-size: 12px; color: #64748b;">Field Label</label>
                        <input type="text" class="field-label-input" placeholder="e.g., Flash Sales" style="width: 100%; padding: 6px; border: 1px solid #e5e7eb; border-radius: 4px;">
                    </div>
                </div>
                <div style="display: flex; gap: 10px; align-items: flex-end;">
                    <div style="flex: 1;">
                        <label style="font-size: 12px; color: #64748b;">Field Type</label>
                        <select class="field-type-select" style="width: 100%; padding: 6px; border: 1px solid #e5e7eb; border-radius: 4px;">
                            <option value="text">Text</option>
                            <option value="number">Number</option>
                            <option value="date">Date</option>
                            <option value="checkbox">Checkbox</option>
                            <option value="dropdown">Dropdown</option>
                        </select>
                    </div>
                    <div>
                        <label style="font-size: 12px; color: #64748b;">
                            <input type="checkbox" class="field-required-checkbox"> Required
                        </label>
                    </div>
                    <button class="btn-small btn-danger remove-field-btn" data-field-index="${fieldIndex}">Remove</button>
                </div>
            </div>
        `;

        fieldsList.insertAdjacentHTML('beforeend', fieldHTML);

        // Attach remove button listener
        const removeBtn = fieldsList.querySelector(`[data-field-index="${fieldIndex}"] .remove-field-btn`);
        if (removeBtn) {
            removeBtn.addEventListener('click', (e) => {
                const fieldItem = e.target.closest('.template-field-item');
                fieldItem.remove();
            });
        }
    }

    /**
     * Save template to database
     */
    async saveTemplate() {
        const templateName = document.getElementById('templateName').value.trim();
        const templateDescription = document.getElementById('templateDescription').value.trim();

        if (!templateName) {
            alert('Please enter a template name');
            return;
        }

        // Collect fields
        const fieldItems = document.querySelectorAll('.template-field-item');
        const fields = [];

        fieldItems.forEach(item => {
            const name = item.querySelector('.field-name-input').value.trim();
            const label = item.querySelector('.field-label-input').value.trim();
            const type = item.querySelector('.field-type-select').value;
            const required = item.querySelector('.field-required-checkbox').checked;

            if (name && label) {
                fields.push({
                    name,
                    label,
                    type,
                    required
                });
            }
        });

        if (fields.length === 0) {
            alert('Please add at least one field to the template');
            return;
        }

        // Save to database
        const { data, error } = await supabase.client
            .from('journal_templates')
            .insert({
                organization_id: window.app.currentOrganizationId,
                name: templateName,
                description: templateDescription,
                fields: fields
            })
            .select();

        if (error) {
            console.error('Error saving template:', error);
            alert('Error saving template: ' + error.message);
            return;
        }

        alert(`Template "${templateName}" saved successfully!`);
        this.closeModal();
    }

    /**
     * Show Create Entry Modal
     */
    async showCreateEntryModal() {
        const modal = document.getElementById('manualJournalModal');
        if (!modal) return;

        const modalTitle = document.getElementById('manualJournalTitle');
        const modalBody = document.getElementById('manualJournalBody');

        modalTitle.textContent = 'Create Manual Entry';

        // Load templates
        await this.loadTemplates();

        if (this.templates.length === 0) {
            modalBody.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <p style="color: #64748b; margin-bottom: 20px;">No templates found. Create a template first!</p>
                    <button class="btn btn-primary" id="goToCreateTemplateBtn">Create Template</button>
                </div>
            `;

            modal.style.display = 'flex';

            const goBtn = document.getElementById('goToCreateTemplateBtn');
            if (goBtn) {
                goBtn.addEventListener('click', () => {
                    this.closeModal();
                    this.showCreateTemplateModal();
                });
            }

            return;
        }

        // Show template selector
        modalBody.innerHTML = `
            <div class="entry-builder">
                <div class="form-field">
                    <label for="selectTemplate">Select Template <span style="color: red;">*</span></label>
                    <select id="selectTemplate" class="pretty-select">
                        <option value="">Choose a template...</option>
                        ${this.templates.map(t => `<option value="${t.id}">${t.name} - ${t.description || ''}</option>`).join('')}
                    </select>
                </div>

                <div id="entryFormFields" style="margin-top: 20px;">
                    <!-- Form fields will appear here after template selection -->
                </div>

                <div class="modal-footer" style="margin-top: 30px; display: flex; gap: 10px; justify-content: flex-end;">
                    <button class="btn btn-secondary" id="cancelEntryBtn">Cancel</button>
                    <button class="btn btn-success" id="saveEntryBtn" disabled>Save Entry</button>
                </div>
            </div>
        `;

        modal.style.display = 'flex';

        // Attach entry form listeners
        this.attachEntryFormListeners();
    }

    /**
     * Load templates from database
     */
    async loadTemplates() {
        const { data, error } = await supabase.client
            .from('journal_templates')
            .select('*')
            .eq('organization_id', window.app.currentOrganizationId)
            .order('name');

        if (error) {
            console.error('Error loading templates:', error);
            this.templates = [];
        } else {
            this.templates = data || [];
        }
    }

    /**
     * Attach listeners for entry form
     */
    attachEntryFormListeners() {
        const templateSelect = document.getElementById('selectTemplate');
        if (templateSelect) {
            templateSelect.addEventListener('change', (e) => {
                const templateId = e.target.value;
                if (templateId) {
                    this.renderEntryForm(templateId);
                } else {
                    document.getElementById('entryFormFields').innerHTML = '';
                    document.getElementById('saveEntryBtn').disabled = true;
                }
            });
        }

        const cancelBtn = document.getElementById('cancelEntryBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.closeModal();
            });
        }

        const saveBtn = document.getElementById('saveEntryBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveEntry();
            });
        }
    }

    /**
     * Render entry form based on selected template
     */
    renderEntryForm(templateId) {
        const template = this.templates.find(t => t.id === templateId);
        if (!template) return;

        this.currentTemplate = template;

        const formFields = document.getElementById('entryFormFields');

        let fieldsHTML = '<h3 style="margin-bottom: 15px; color: #374151;">Enter Session Data</h3>';

        template.fields.forEach((field, index) => {
            let inputHTML = '';

            switch (field.type) {
                case 'text':
                    inputHTML = `<input type="text" id="field_${index}" class="entry-field-input" ${field.required ? 'required' : ''}>`;
                    break;
                case 'number':
                    inputHTML = `<input type="number" step="0.01" id="field_${index}" class="entry-field-input" ${field.required ? 'required' : ''}>`;
                    break;
                case 'date':
                    inputHTML = `<input type="date" id="field_${index}" class="entry-field-input" ${field.required ? 'required' : ''}>`;
                    break;
                case 'checkbox':
                    inputHTML = `<input type="checkbox" id="field_${index}" class="entry-field-checkbox">`;
                    break;
                case 'dropdown':
                    inputHTML = `<select id="field_${index}" class="entry-field-input" ${field.required ? 'required' : ''}>
                        <option value="">Choose...</option>
                    </select>`;
                    break;
            }

            fieldsHTML += `
                <div class="form-field" style="margin-bottom: 15px;">
                    <label for="field_${index}">
                        ${field.label}
                        ${field.required ? '<span style="color: red;">*</span>' : ''}
                    </label>
                    ${inputHTML}
                </div>
            `;
        });

        formFields.innerHTML = fieldsHTML;

        // Enable save button
        document.getElementById('saveEntryBtn').disabled = false;
    }

    /**
     * Save entry to sessions table
     */
    async saveEntry() {
        if (!this.currentTemplate) return;

        const entryData = {};
        let hasErrors = false;

        // Collect field values
        this.currentTemplate.fields.forEach((field, index) => {
            const input = document.getElementById(`field_${index}`);
            if (!input) return;

            let value;
            if (field.type === 'checkbox') {
                value = input.checked;
            } else {
                value = input.value;
            }

            // Validate required fields
            if (field.required && !value) {
                alert(`Please fill in required field: ${field.label}`);
                hasErrors = true;
                return;
            }

            entryData[field.name] = value;
        });

        if (hasErrors) return;

        // Determine location_id based on template name
        let locationId = null;
        if (this.currentTemplate.name.includes('SC')) {
            // Get SC location ID
            const { data: scLocation } = await supabase.client
                .from('locations')
                .select('id')
                .eq('organization_id', window.app.currentOrganizationId)
                .eq('location_code', 'sc')
                .single();
            locationId = scLocation?.id;
        } else if (this.currentTemplate.name.includes('RWC')) {
            // Get RWC location ID
            const { data: rwcLocation } = await supabase.client
                .from('locations')
                .select('id')
                .eq('organization_id', window.app.currentOrganizationId)
                .eq('location_code', 'rwc')
                .single();
            locationId = rwcLocation?.id;
        }

        if (!locationId) {
            alert('Could not determine location from template name');
            return;
        }

        // Build session record
        const sessionRecord = {
            organization_id: window.app.currentOrganizationId,
            location_id: locationId,
            source: 'manual',
            ...entryData
        };

        // Insert into sessions table
        const { data, error } = await supabase.client
            .from('sessions')
            .insert(sessionRecord)
            .select();

        if (error) {
            console.error('Error saving entry:', error);
            alert('Error saving entry: ' + error.message);
            return;
        }

        alert(`Session entry saved successfully!`);
        this.closeModal();

        // Refresh session data if on Session Analysis view
        if (window.app.currentView === 'session-analysis') {
            window.app.sessionDailyView?.init();
        }
    }

    /**
     * Close modal
     */
    closeModal() {
        const modal = document.getElementById('manualJournalModal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.currentTemplate = null;
    }
}

// Create singleton instance
const manualJournalView = new ManualJournalView();

export { manualJournalView };
