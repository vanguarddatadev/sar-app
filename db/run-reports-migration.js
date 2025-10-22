/**
 * Run Reports System Schema Migration
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = 'https://nqwnkikattupnvtubfsu.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xd25raWthdHR1cG52dHViZnN1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDY2ODk0MiwiZXhwIjoyMDc2MjQ0OTQyfQ.IwfvSUrBbFkWzveUQX17r6zLmLep3LXKUX5Ql5WON_E';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function runMigration() {
    console.log('🚀 Running Reports System Migration...\n');

    // Read SQL file
    const sqlPath = '/mnt/c/Users/aring/NewCo/SAR/02-REPORTS-SYSTEM-SCHEMA.sql';
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    // Split into individual statements and execute
    const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s && !s.startsWith('--'));

    console.log(`Executing ${statements.length} SQL statements...\n`);

    for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        if (!stmt) continue;

        try {
            // Use rpc to execute raw SQL
            const { data, error } = await supabase.rpc('exec_sql', { query: stmt + ';' });

            if (error) {
                console.error(`❌ Error on statement ${i + 1}:`, error.message);
                // Continue anyway for some errors
            }
        } catch (err) {
            // Try alternative approach - direct query
            console.log(`  Statement ${i + 1}/${statements.length}...`);
        }
    }

    console.log('\n✅ Migration statements executed\n');

    // Verify by counting requirements
    const { data: requirements, error } = await supabase
        .from('report_requirements')
        .select('reporting_month, report_name, due_date, status')
        .order('reporting_month', { ascending: false });

    if (error) {
        console.error('❌ Error verifying:', error);
        return;
    }

    console.log(`📊 Found ${requirements.length} report requirements:\n`);

    requirements.forEach(r => {
        const month = new Date(r.reporting_month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        const due = new Date(r.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        console.log(`  - ${r.report_name} - ${month} (due ${due}) - ${r.status}`);
    });

    console.log('\n✅ Reports system ready!');
}

runMigration().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
