/**
 * Spreadsheet Data Importer
 * Imports manually entered spreadsheet actuals from CSV
 *
 * Usage: node import-spreadsheet-data.js
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Hardcoded Supabase credentials
const SUPABASE_URL = 'https://nqwnkikattupnvtubfsu.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xd25raWthdHR1cG52dHViZnN1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDY2ODk0MiwiZXhwIjoyMDc2MjQ0OTQyfQ.IwfvSUrBbFkWzveUQX17r6zLmLep3LXKUX5Ql5WON_E';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Vanguard organization ID (hardcoded for MVP)
const ORG_ID = '123e4567-e89b-12d3-a456-426614174000';

const CSV_FILE = 'spreadsheet-data.csv';

/**
 * Parse CSV file
 */
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  if (lines.length < 2) {
    throw new Error('CSV file is empty or invalid');
  }

  // Parse header
  const header = lines[0].split(',').map(h => h.trim());
  const records = [];

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split(',').map(c => c.trim());

    if (cols.length < 4) continue; // Skip invalid rows

    const record = {
      organization_id: ORG_ID,
      month: cols[0],
      location: cols[1],
      category: cols[2],
      amount: parseFloat(cols[3]),
      notes: cols[4] || '',
      data_source: 'csv_import',
      entered_by: 'import-script',
      entered_at: new Date().toISOString()
    };

    if (isNaN(record.amount)) {
      console.log(`  ⚠️  Skipping invalid amount: ${line}`);
      continue;
    }

    records.push(record);
  }

  return records;
}

/**
 * Main import function
 */
async function main() {
  console.log('🚀 Spreadsheet Data Importer');
  console.log('============================\n');
  console.log(`Organization ID: ${ORG_ID}`);
  console.log(`Supabase URL: ${SUPABASE_URL}`);
  console.log(`CSV File: ${CSV_FILE}\n`);

  const filePath = path.join(process.cwd(), CSV_FILE);

  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }

  // Test Supabase connection
  const { error: testError } = await supabase
    .from('spreadsheet_monthly_actuals')
    .select('count')
    .limit(1);

  if (testError) {
    console.error('❌ Failed to connect to Supabase:', testError.message);
    process.exit(1);
  }

  console.log('✓ Supabase connection successful\n');

  try {
    const records = parseCSV(filePath);
    console.log(`✓ Parsed ${records.length} records from CSV\n`);

    // Group by month for reporting
    const byMonth = {};
    records.forEach(r => {
      if (!byMonth[r.month]) byMonth[r.month] = [];
      byMonth[r.month].push(r);
    });

    console.log(`Months found: ${Object.keys(byMonth).sort().join(', ')}\n`);

    // Delete existing records (to allow re-import)
    console.log('Deleting existing spreadsheet data...');
    const { error: deleteError } = await supabase
      .from('spreadsheet_monthly_actuals')
      .delete()
      .eq('organization_id', ORG_ID);

    if (deleteError) {
      console.log(`⚠️  Warning: Could not delete existing records: ${deleteError.message}`);
    } else {
      console.log('✓ Existing data cleared\n');
    }

    // Insert new records in batches
    console.log('Inserting new data...\n');
    const batchSize = 500;
    let inserted = 0;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);

      const { error } = await supabase
        .from('spreadsheet_monthly_actuals')
        .insert(batch);

      if (error) {
        throw new Error(`Supabase insert error: ${error.message}`);
      }

      inserted += batch.length;
      console.log(`✓ Inserted batch ${Math.floor(i / batchSize) + 1} (${batch.length} records)`);
    }

    console.log('\n📈 IMPORT SUMMARY');
    console.log('==================');
    console.log(`✓ Total Records: ${inserted.toLocaleString()}`);
    console.log(`✓ Months: ${Object.keys(byMonth).length}`);
    console.log(`✓ Categories: ${[...new Set(records.map(r => r.category))].length}`);
    console.log('\n✅ Import complete!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the import
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
