/**
 * Run SQL Migration via Supabase Client
 */

import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nqwnkikattupnvtubfsu.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xd25raWthdHR1cG52dHViZnN1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDY2ODk0MiwiZXhwIjoyMDc2MjQ0OTQyfQ.IwfvSUrBbFkWzveUQX17r6zLmLep3LXKUX5Ql5WON_E';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function runMigration() {
  const sqlFile = process.argv[2];

  if (!sqlFile) {
    console.error('Usage: node run-migration.js <sql-file-path>');
    process.exit(1);
  }

  console.log(`📜 Reading SQL file: ${sqlFile}`);
  const sql = fs.readFileSync(sqlFile, 'utf-8');

  console.log(`🔄 Executing SQL migration...`);

  const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });

  if (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Details:', error);
    process.exit(1);
  }

  console.log('✅ Migration completed successfully!');
  if (data) {
    console.log('Result:', data);
  }
}

runMigration().catch(err => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
