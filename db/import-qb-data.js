/**
 * QB P&L CSV Importer
 * Parses QuickBooks Profit & Loss by Class reports and imports to Supabase
 *
 * Usage: node import-qb-data.js
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Hardcoded Supabase credentials (same as app.js)
const SUPABASE_URL = 'https://nqwnkikattupnvtubfsu.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xd25raWthdHR1cG52dHViZnN1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDY2ODk0MiwiZXhwIjoyMDc2MjQ0OTQyfQ.IwfvSUrBbFkWzveUQX17r6zLmLep3LXKUX5Ql5WON_E';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Vanguard organization ID (updated to current org)
const ORG_ID = '6b784659-250f-46a5-9b61-7bd4666e30af';

// QB CSV files and their months
const QB_FILES = [
  { file: 'Vanguard Music and Performing Arts_Profit and Loss by Class (3)1.csv', month: '2024-09-01' },
  { file: 'Vanguard Music and Performing Arts_Profit and Loss by Class (2)1.csv', month: '2024-10-01' },
  { file: 'Vanguard Music and Performing Arts_Profit and Loss by Class (1)9.csv', month: '2024-11-01' },
  { file: 'Vanguard Music and Performing Arts_Profit and Loss by Class  8.csv', month: '2024-12-01' },
  { file: 'Vanguard Music and Performing Arts_Profit and Loss by Class (6).csv', month: '2025-01-01' },
  { file: 'Vanguard Music and Performing Arts_Profit and Loss by Class (5).csv', month: '2025-02-01' },
  { file: 'Vanguard Music and Performing Arts_Profit and Loss by Class (4).csv', month: '2025-03-01' },
  { file: 'Vanguard Music and Performing Arts_Profit and Loss by Class (3).csv', month: '2025-04-01' },
  { file: 'Vanguard Music and Performing Arts_Profit and Loss by Class.csv', month: '2025-05-01' },
  { file: 'Vanguard Music and Performing Arts_Profit and Loss by Class (1).csv', month: '2025-06-01' },
  { file: 'Vanguard Music and Performing Arts_Profit and Loss by Class (2).csv', month: '2025-07-01' },
  { file: 'Vanguard Music and Performing Arts_Profit and Loss by ClassA.csv', month: '2025-08-01' },
  { file: 'Vanguard Music and Performing Arts_Profit and Loss by Class-Sept2025.csv', month: '2025-09-01' },
];

const QB_DIR = '/mnt/c/Users/aring/NewCo/SAR/Vangaurd Reports/';

/**
 * Parse a QB P&L by Class CSV file
 */
function parseQBCSV(filePath, month) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  if (lines.length < 5) {
    throw new Error(`Invalid QB CSV format: ${filePath}`);
  }

  // Line 4 has the class headers
  const headerLine = lines[4];
  const headers = headerLine.split(',').map(h => h.trim());

  // Extract class names (skip first column which is "Distribution account")
  const classes = headers.slice(1, -1); // Skip "Total" column too

  console.log(`  Classes found: ${classes.join(', ')}`);

  const records = [];

  // Parse data rows (starting from line 5)
  for (let i = 5; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCSVLine(line);
    const accountName = cols[0]?.trim();

    if (!accountName) continue;

    // Skip section headers and total lines
    if (accountName === 'Income' ||
        accountName === 'Cost of Goods Sold' ||
        accountName === 'Expenses' ||
        accountName === 'Other Income' ||
        accountName === 'Other Expenses' ||
        accountName.startsWith('Total for') ||
        accountName.startsWith('Gross Profit') ||
        accountName.startsWith('Net Operating') ||
        accountName.startsWith('Net Other') ||
        accountName.startsWith('Net Income')) {
      continue;
    }

    // Extract account number and name (e.g., "6020 Hourly" → number="6020", name="Hourly")
    const accountMatch = accountName.match(/^([\d.]+)\s+(.+)$/);
    if (!accountMatch) continue; // Skip non-account lines

    const accountNumber = accountMatch[1];
    const accountDesc = accountMatch[2];

    // Extract amounts for each class
    for (let j = 0; j < classes.length; j++) {
      const amountStr = cols[j + 1]?.trim().replace(/[",]/g, '');
      if (!amountStr || amountStr === '0.00' || amountStr === '0') continue;

      const amount = parseFloat(amountStr);
      if (isNaN(amount) || amount === 0) continue;

      records.push({
        organization_id: ORG_ID,
        month,
        account_number: accountNumber,
        account_name: accountDesc,
        class_name: classes[j],
        amount,
        import_file_name: path.basename(filePath)
      });
    }
  }

  return records;
}

/**
 * Parse a CSV line handling quoted values
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

/**
 * Import QB data for one month
 */
async function importMonth(fileInfo) {
  const filePath = path.join(QB_DIR, fileInfo.file);
  const startTime = Date.now();

  if (!fs.existsSync(filePath)) {
    console.log(`  ⚠️  File not found: ${fileInfo.file}`);

    // Log failed upload to history
    await logUploadHistory(fileInfo, 0, 'failed', 'File not found', Date.now() - startTime);

    return { success: false, message: 'File not found' };
  }

  console.log(`\n📊 Processing ${fileInfo.month} (${fileInfo.file})`);

  try {
    const records = parseQBCSV(filePath, fileInfo.month);
    console.log(`  ✓ Parsed ${records.length} records`);

    if (records.length === 0) {
      // Log upload with 0 records
      await logUploadHistory(fileInfo, 0, 'success', 'No records to import', Date.now() - startTime);

      return { success: true, inserted: 0, message: 'No records to import' };
    }

    // Delete existing records for this month (in case of re-import)
    const { error: deleteError } = await supabase
      .from('qb_monthly_imports')
      .delete()
      .eq('organization_id', ORG_ID)
      .eq('month', fileInfo.month);

    if (deleteError) {
      console.log(`  ⚠️  Warning: Could not delete existing records: ${deleteError.message}`);
    }

    // Insert new records in batches (Supabase has 1000 row limit)
    const batchSize = 500;
    let inserted = 0;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);

      const { data, error } = await supabase
        .from('qb_monthly_imports')
        .insert(batch);

      if (error) {
        throw new Error(`Supabase insert error: ${error.message}`);
      }

      inserted += batch.length;
      console.log(`  ✓ Inserted batch ${Math.floor(i / batchSize) + 1} (${batch.length} records)`);
    }

    // Log successful upload to history
    await logUploadHistory(fileInfo, inserted, 'success', null, Date.now() - startTime);

    return { success: true, inserted };

  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);

    // Log failed upload to history
    await logUploadHistory(fileInfo, 0, 'failed', error.message, Date.now() - startTime);

    return { success: false, message: error.message };
  }
}

/**
 * Log upload to qb_upload_history table
 */
async function logUploadHistory(fileInfo, recordsImported, status, errorMessage, durationMs) {
  try {
    // Delete existing history for this month/file (in case of re-import)
    await supabase
      .from('qb_upload_history')
      .delete()
      .eq('organization_id', ORG_ID)
      .eq('month', fileInfo.month)
      .eq('file_name', fileInfo.file);

    // Insert new history record
    const { error } = await supabase
      .from('qb_upload_history')
      .insert({
        organization_id: ORG_ID,
        file_name: fileInfo.file,
        month: fileInfo.month,
        records_imported: recordsImported,
        status: status,
        error_message: errorMessage,
        processed_by: 'system',
        processing_duration_ms: durationMs
      });

    if (error) {
      console.log(`  ⚠️  Warning: Could not log upload history: ${error.message}`);
    }
  } catch (err) {
    console.log(`  ⚠️  Warning: Upload history logging failed: ${err.message}`);
  }
}

/**
 * Main import function
 */
async function main() {
  console.log('🚀 QB P&L Data Importer');
  console.log('=======================\n');
  console.log(`Organization ID: ${ORG_ID}`);
  console.log(`Supabase URL: ${SUPABASE_URL}`);
  console.log(`QB Directory: ${QB_DIR}`);
  console.log(`Files to import: ${QB_FILES.length}\n`);

  // Test Supabase connection
  const { data, error } = await supabase
    .from('qb_monthly_imports')
    .select('count')
    .limit(1);

  if (error) {
    console.error('❌ Failed to connect to Supabase:', error.message);
    process.exit(1);
  }

  console.log('✓ Supabase connection successful\n');
  console.log('Starting import...\n');

  const results = {
    success: 0,
    failed: 0,
    totalRecords: 0
  };

  for (const fileInfo of QB_FILES) {
    const result = await importMonth(fileInfo);

    if (result.success) {
      results.success++;
      results.totalRecords += result.inserted || 0;
    } else {
      results.failed++;
    }
  }

  console.log('\n\n📈 IMPORT SUMMARY');
  console.log('==================');
  console.log(`✓ Successful: ${results.success}/${QB_FILES.length} months`);
  console.log(`❌ Failed: ${results.failed}/${QB_FILES.length} months`);
  console.log(`📊 Total Records Imported: ${results.totalRecords.toLocaleString()}`);
  console.log('\n✅ Import complete!');
}

// Run the import
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
