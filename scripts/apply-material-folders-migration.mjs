// Одноразово применяет 20260905100000_material_folders.sql через service-role.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { config } from 'dotenv'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '.env.local') })

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const sql = readFileSync(
  join(__dirname, '..', 'supabase', 'migrations', '20260905100000_material_folders.sql'),
  'utf8',
)

const { data, error } = await supa.rpc('exec_sql', { sql })
if (error) {
  console.error('exec_sql RPC failed:', error)
  console.log('\n=== SQL ===\n' + sql)
  console.log('\nПрименить вручную в Supabase Studio → SQL editor.')
  process.exit(1)
}
console.log('Migration applied. Result:', data)
