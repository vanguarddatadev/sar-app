/**
 * Run Manual Journals Schema
 * Creates journal_templates table and seeds templates
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nqwnkikattupnvtubfsu.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xd25raWthdHR1cG52dHViZnN1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDY2ODk0MiwiZXhwIjoyMDc2MjQ0OTQyfQ.IwfvSUrBbFkWzveUQX17r6zLmLep3LXKUX5Ql5WON_E';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const ORG_ID = '6b784659-250f-46a5-9b61-7bd4666e30af';

async function main() {
    console.log('🚀 Running Manual Journals Schema...\n');

    // Check if journal_templates table exists
    console.log('1. Checking if journal_templates table exists...');
    const { data: existingTable, error: checkError } = await supabase
        .from('journal_templates')
        .select('id')
        .limit(1);

    if (checkError && checkError.code === '42P01') {
        console.log('  ⚠️  Table does not exist. Please create it manually via Supabase SQL Editor.');
        console.log('  📋 Copy and paste 03-MANUAL-JOURNALS-SCHEMA.sql into the SQL Editor.');
        return;
    } else if (checkError) {
        console.log(`  ⚠️  Error checking table: ${checkError.message}`);
    } else {
        console.log('  ✓ journal_templates table exists');
    }

    // Seed SC Session Template
    console.log('\n2. Seeding SC - Session template...');
    const scFields = [
        {"name": "date", "label": "Session Date", "type": "date", "required": true},
        {"name": "late", "label": "Late Session", "type": "checkbox", "required": false},
        {"name": "flash", "label": "Flash", "type": "number", "required": false},
        {"name": "cherries", "label": "Cherries", "type": "number", "required": false},
        {"name": "paper", "label": "Paper", "type": "number", "required": false},
        {"name": "strips", "label": "Strips", "type": "number", "required": false},
        {"name": "merch_other", "label": "Merch/Other", "type": "number", "required": false},
        {"name": "total_sales", "label": "Total Sales", "type": "number", "required": false},
        {"name": "strip_payouts", "label": "Strip Payouts", "type": "number", "required": false},
        {"name": "paper_game_payouts", "label": "Paper Game Payouts", "type": "number", "required": false},
        {"name": "flash_payouts", "label": "Flash Payouts", "type": "number", "required": false},
        {"name": "all_numbers_games", "label": "All Numbers Games", "type": "number", "required": false},
        {"name": "double_action", "label": "Double Action", "type": "number", "required": false},
        {"name": "winnemucca", "label": "Winnemucca", "type": "number", "required": false},
        {"name": "rwb", "label": "RWB", "type": "number", "required": false},
        {"name": "cherry_redeemed", "label": "Cherry Redeemed", "type": "number", "required": false},
        {"name": "cherry_from_winn", "label": "Cherry from Winn game", "type": "number", "required": false},
        {"name": "gift_cert", "label": "Gift Cert", "type": "number", "required": false},
        {"name": "refund_other", "label": "Refund/Other", "type": "number", "required": false},
        {"name": "flash_redeemed", "label": "Flash Redeemed", "type": "number", "required": false},
        {"name": "total_payouts", "label": "Total Payouts", "type": "number", "required": false},
        {"name": "hotball_hit", "label": "Hotball Hit", "type": "checkbox", "required": false},
        {"name": "hotball_change", "label": "Hotball Change", "type": "number", "required": false},
        {"name": "hotball_total", "label": "Hotball Total", "type": "number", "required": false},
        {"name": "hotball_participation", "label": "Hotball Participation", "type": "number", "required": false},
        {"name": "attendance", "label": "SC Attendance", "type": "number", "required": false}
    ];

    const { data: scData, error: scError } = await supabase
        .from('journal_templates')
        .upsert({
            organization_id: ORG_ID,
            name: 'SC - Session',
            description: 'Santa Clara bingo session data entry',
            fields: scFields
        }, {
            onConflict: 'organization_id,name'
        })
        .select();

    if (scError) {
        console.log(`  ❌ Error: ${scError.message}`);
    } else {
        console.log('  ✓ SC - Session template seeded');
    }

    // Seed RWC Session Template
    console.log('\n3. Seeding RWC - Session template...');
    const rwcFields = [
        {"name": "date", "label": "Session Date", "type": "date", "required": true},
        {"name": "late", "label": "Late Session", "type": "checkbox", "required": false},
        {"name": "flash", "label": "Flash", "type": "number", "required": false},
        {"name": "cherries", "label": "Cherries", "type": "number", "required": false},
        {"name": "paper", "label": "Paper", "type": "number", "required": false},
        {"name": "strips", "label": "Strips", "type": "number", "required": false},
        {"name": "merch_other", "label": "Merch/Other", "type": "number", "required": false},
        {"name": "total_sales", "label": "Total Sales", "type": "number", "required": false},
        {"name": "strip_payouts", "label": "Strip Payouts", "type": "number", "required": false},
        {"name": "paper_game_payouts", "label": "Paper Game Payouts", "type": "number", "required": false},
        {"name": "flash_payouts", "label": "Flash Payouts", "type": "number", "required": false},
        {"name": "all_numbers_games", "label": "All Numbers Games", "type": "number", "required": false},
        {"name": "double_action", "label": "Double Action", "type": "number", "required": false},
        {"name": "winnemucca", "label": "Winnemucca", "type": "number", "required": false},
        {"name": "rwb", "label": "RWB", "type": "number", "required": false},
        {"name": "cherry_redeemed", "label": "Cherry Redeemed", "type": "number", "required": false},
        {"name": "cherry_from_winn", "label": "Cherry from Winn game", "type": "number", "required": false},
        {"name": "gift_cert", "label": "Gift Cert", "type": "number", "required": false},
        {"name": "refund_other", "label": "Refund/Other", "type": "number", "required": false},
        {"name": "flash_redeemed", "label": "Flash Redeemed", "type": "number", "required": false},
        {"name": "total_payouts", "label": "Total Payouts", "type": "number", "required": false},
        {"name": "hotball_hit", "label": "Hotball Hit", "type": "checkbox", "required": false},
        {"name": "hotball_change", "label": "Hotball Change", "type": "number", "required": false},
        {"name": "hotball_total", "label": "Hotball Total", "type": "number", "required": false},
        {"name": "hotball_participation", "label": "Hotball Participation", "type": "number", "required": false},
        {"name": "attendance", "label": "RWC Attendance", "type": "number", "required": false}
    ];

    const { data: rwcData, error: rwcError } = await supabase
        .from('journal_templates')
        .upsert({
            organization_id: ORG_ID,
            name: 'RWC - Session',
            description: 'Redwood City bingo session data entry',
            fields: rwcFields
        }, {
            onConflict: 'organization_id,name'
        })
        .select();

    if (rwcError) {
        console.log(`  ❌ Error: ${rwcError.message}`);
    } else {
        console.log('  ✓ RWC - Session template seeded');
    }

    console.log('\n✅ Schema seeding complete!');
}

main().catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
});
