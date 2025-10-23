/**
 * Export Full Database Schema from Supabase
 * Queries information_schema directly
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = 'https://nqwnkikattupnvtubfsu.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xd25raWthdHR1cG52dHViZnN1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDY2ODk0MiwiZXhwIjoyMDc2MjQ0OTQyfQ.IwfvSUrBbFkWzveUQX17r6zLmLep3LXKUX5Ql5WON_E';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// List of tables to export (you'll need to list them manually or get from elsewhere)
const TABLES = [
    'organizations',
    'locations',
    'sessions',
    'system_settings',
    'qb_monthly_imports',
    'qb_upload_history',
    'qb_category_mapping',
    'allocation_rules',
    'monthly_allocated_expenses',
    'adjusted_monthly_expenses',
    'report_requirements',
    'report_submissions',
    'journal_templates',
    'nav_visibility'
];

async function getTableColumns(tableName) {
    // Query the table directly to get one row and examine its structure
    const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);

    if (error) {
        console.log(`  ⚠️  Could not access table ${tableName}: ${error.message}`);
        return null;
    }

    if (!data || data.length === 0) {
        console.log(`  ℹ️  Table ${tableName} exists but is empty`);
        return { columns: [], sample: null };
    }

    const sample = data[0];
    const columns = Object.keys(sample);

    return { columns, sample };
}

async function exportSchema() {
    console.log('🚀 Exporting Supabase Schema...\n');

    let schemaOutput = `-- Database Schema Export
-- Generated: ${new Date().toISOString()}
-- Database: ${SUPABASE_URL}

`;

    let exportedCount = 0;

    for (const tableName of TABLES) {
        console.log(`📋 Exporting table: ${tableName}`);

        const result = await getTableColumns(tableName);

        if (!result) {
            schemaOutput += `-- Table: ${tableName}\n-- ⚠️ Could not access this table\n\n`;
            continue;
        }

        const { columns, sample } = result;

        schemaOutput += `-- Table: ${tableName}\n`;
        schemaOutput += `-- Columns: ${columns.length}\n`;

        if (columns.length > 0) {
            schemaOutput += `CREATE TABLE IF NOT EXISTS ${tableName} (\n`;

            const columnDefs = columns.map((col, idx) => {
                const value = sample ? sample[col] : null;
                let type = 'TEXT'; // Default

                if (value !== null && value !== undefined) {
                    if (typeof value === 'number') {
                        type = Number.isInteger(value) ? 'INTEGER' : 'NUMERIC';
                    } else if (typeof value === 'boolean') {
                        type = 'BOOLEAN';
                    } else if (value instanceof Date || /^\d{4}-\d{2}-\d{2}/.test(value)) {
                        type = 'TIMESTAMPTZ';
                    } else if (typeof value === 'object') {
                        type = 'JSONB';
                    }
                }

                // Common patterns
                if (col === 'id') type = 'UUID PRIMARY KEY DEFAULT gen_random_uuid()';
                if (col.endsWith('_id') && col !== 'id') type = 'UUID';
                if (col === 'created_at' || col === 'updated_at') type = 'TIMESTAMPTZ DEFAULT NOW()';
                if (col === 'organization_id') type = 'UUID NOT NULL';

                return `    ${col} ${type}`;
            });

            schemaOutput += columnDefs.join(',\n');
            schemaOutput += '\n);\n\n';

            // Show sample data structure
            if (sample) {
                schemaOutput += `-- Sample data structure:\n`;
                schemaOutput += `-- ${JSON.stringify(sample, null, 2).split('\n').join('\n-- ')}\n\n`;
            }

            exportedCount++;
        } else {
            schemaOutput += `-- (Empty table)\n\n`;
        }
    }

    // Write to file
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const filename = `FULL_SCHEMA_${timestamp}.sql`;
    const filepath = `/mnt/c/Users/aring/NewCo/SAR/${filename}`;

    fs.writeFileSync(filepath, schemaOutput);

    console.log('\n✅ Schema export complete!');
    console.log(`📄 Saved to: ${filepath}`);
    console.log(`📊 Total tables exported: ${exportedCount}/${TABLES.length}`);
    console.log('\nNote: This is a best-effort export. For exact schema, use Supabase Dashboard > Database > Schema.');
}

exportSchema().catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
});
