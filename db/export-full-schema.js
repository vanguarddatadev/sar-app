/**
 * Export Full Database Schema from Supabase
 * This script connects to Supabase and exports the complete schema
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = 'https://nqwnkikattupnvtubfsu.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xd25raWthdHR1cG52dHViZnN1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDY2ODk0MiwiZXhwIjoyMDc2MjQ0OTQyfQ.IwfvSUrBbFkWzveUQX17r6zLmLep3LXKUX5Ql5WON_E';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function getAllTables() {
    const { data, error } = await supabase
        .rpc('exec_sql', {
            sql: `
                SELECT
                    table_name
                FROM
                    information_schema.tables
                WHERE
                    table_schema = 'public'
                    AND table_type = 'BASE TABLE'
                ORDER BY
                    table_name;
            `
        });

    if (error) {
        console.error('Error fetching tables:', error);
        return [];
    }

    return data || [];
}

async function getTableSchema(tableName) {
    const { data, error } = await supabase
        .rpc('exec_sql', {
            sql: `
                SELECT
                    column_name,
                    data_type,
                    character_maximum_length,
                    column_default,
                    is_nullable,
                    udt_name
                FROM
                    information_schema.columns
                WHERE
                    table_schema = 'public'
                    AND table_name = '${tableName}'
                ORDER BY
                    ordinal_position;
            `
        });

    if (error) {
        console.error(`Error fetching schema for ${tableName}:`, error);
        return [];
    }

    return data || [];
}

async function getTableConstraints(tableName) {
    const { data, error } = await supabase
        .rpc('exec_sql', {
            sql: `
                SELECT
                    tc.constraint_name,
                    tc.constraint_type,
                    kcu.column_name,
                    ccu.table_name AS foreign_table_name,
                    ccu.column_name AS foreign_column_name
                FROM
                    information_schema.table_constraints AS tc
                    LEFT JOIN information_schema.key_column_usage AS kcu
                        ON tc.constraint_name = kcu.constraint_name
                        AND tc.table_schema = kcu.table_schema
                    LEFT JOIN information_schema.constraint_column_usage AS ccu
                        ON ccu.constraint_name = tc.constraint_name
                        AND ccu.table_schema = tc.table_schema
                WHERE
                    tc.table_schema = 'public'
                    AND tc.table_name = '${tableName}'
                ORDER BY
                    tc.constraint_type, tc.constraint_name;
            `
        });

    if (error) {
        console.error(`Error fetching constraints for ${tableName}:`, error);
        return [];
    }

    return data || [];
}

async function exportSchema() {
    console.log('🚀 Exporting Full Supabase Schema...\n');

    let schemaOutput = `-- Full Database Schema Export
-- Generated: ${new Date().toISOString()}
-- Database: ${SUPABASE_URL}

`;

    // Get all tables
    const tables = await getAllTables();
    console.log(`Found ${tables.length} tables\n`);

    for (const table of tables) {
        const tableName = table.table_name;
        console.log(`📋 Exporting table: ${tableName}`);

        // Get columns
        const columns = await getTableSchema(tableName);

        // Get constraints
        const constraints = await getTableConstraints(tableName);

        // Build CREATE TABLE statement
        schemaOutput += `-- Table: ${tableName}\n`;
        schemaOutput += `CREATE TABLE IF NOT EXISTS ${tableName} (\n`;

        // Add columns
        const columnDefs = columns.map((col, idx) => {
            let def = `    ${col.column_name} ${col.data_type}`;

            if (col.character_maximum_length) {
                def += `(${col.character_maximum_length})`;
            }

            if (col.column_default) {
                def += ` DEFAULT ${col.column_default}`;
            }

            if (col.is_nullable === 'NO') {
                def += ' NOT NULL';
            }

            return def;
        });

        schemaOutput += columnDefs.join(',\n');

        // Add constraints
        const pkConstraints = constraints.filter(c => c.constraint_type === 'PRIMARY KEY');
        if (pkConstraints.length > 0) {
            const pkColumns = pkConstraints.map(c => c.column_name).join(', ');
            schemaOutput += `,\n    PRIMARY KEY (${pkColumns})`;
        }

        const fkConstraints = constraints.filter(c => c.constraint_type === 'FOREIGN KEY');
        for (const fk of fkConstraints) {
            schemaOutput += `,\n    CONSTRAINT ${fk.constraint_name} FOREIGN KEY (${fk.column_name}) REFERENCES ${fk.foreign_table_name}(${fk.foreign_column_name})`;
        }

        schemaOutput += '\n);\n\n';
    }

    // Write to file
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const filename = `FULL_SCHEMA_${timestamp}.sql`;
    const filepath = `/mnt/c/Users/aring/NewCo/SAR/${filename}`;

    fs.writeFileSync(filepath, schemaOutput);

    console.log('\n✅ Schema export complete!');
    console.log(`📄 Saved to: ${filepath}`);
    console.log(`📊 Total tables: ${tables.length}`);
}

exportSchema().catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
});
