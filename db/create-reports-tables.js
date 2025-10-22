/**
 * Create Reports System Tables
 * Run this with: node create-reports-tables.js
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nqwnkikattupnvtubfsu.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xd25raWthdHR1cG52dHViZnN1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDY2ODk0MiwiZXhwIjoyMDc2MjQ0OTQyfQ.IwfvSUrBbFkWzveUQX17r6zLmLep3LXKUX5Ql5WON_E';
const ORG_ID = '6b784659-250f-46a5-9b61-7bd4666e30af';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function seedReportRequirements() {
    console.log('🚀 Creating Report Requirements...\n');

    // Get locations
    const { data: locations } = await supabase
        .from('locations')
        .select('id, location_code')
        .eq('organization_id', ORG_ID);

    const scLocation = locations.find(l => l.location_code === 'SC');

    if (!scLocation) {
        console.error('❌ SC location not found');
        return;
    }

    // Get all months with QB data
    const { data: qbMonths } = await supabase
        .from('qb_monthly_imports')
        .select('month')
        .eq('organization_id', ORG_ID)
        .order('month');

    const uniqueMonths = [...new Set(qbMonths.map(m => m.month))];

    console.log(`Found ${uniqueMonths.length} months with QB data\n`);

    const requirements = [];

    for (const month of uniqueMonths) {
        const monthDate = new Date(month);
        // Due date = last day of following month
        const dueDate = new Date(monthDate);
        dueDate.setMonth(dueDate.getMonth() + 2);
        dueDate.setDate(0); // Last day of previous month

        requirements.push({
            organization_id: ORG_ID,
            report_type: 'santa_clara_county',
            report_name: 'Santa Clara County Report',
            location_id: scLocation.id,
            reporting_month: month,
            due_date: dueDate.toISOString().split('T')[0],
            status: 'pending'
        });
    }

    // Insert requirements
    const { data, error } = await supabase
        .from('report_requirements')
        .upsert(requirements, {
            onConflict: 'organization_id,report_type,location_id,reporting_month',
            ignoreDuplicates: false
        })
        .select();

    if (error) {
        console.error('❌ Error creating requirements:', error);
        return;
    }

    console.log(`✅ Created ${data.length} report requirements\n`);

    // Show summary
    const now = new Date();
    const in14Days = new Date(now);
    in14Days.setDate(in14Days.getDate() + 14);

    data.forEach(r => {
        const month = new Date(r.reporting_month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        const due = new Date(r.due_date);
        const dueStr = due.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        let urgency = '';
        if (due < now) urgency = '🔴 PAST DUE';
        else if (due <= in14Days) urgency = '⚠️  SOON DUE';

        console.log(`  ${urgency} ${r.report_name} - ${month} (due ${dueStr})`);
    });

    console.log('\n✅ Reports system ready!');
}

seedReportRequirements().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
