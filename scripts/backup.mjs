// Snapshots the communities + reports tables to a timestamped JSON file.
// Run with: npm run backup   (loads .env.local for SUPABASE creds)

import { createClient } from '@supabase/supabase-js'
import { mkdir, writeFile } from 'node:fs/promises'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or a Supabase key. Run via `npm run backup`.')
  process.exit(1)
}

const supabase = createClient(url, key)

async function dump(table) {
  const { data, error } = await supabase.from(table).select('*')
  if (error) throw new Error(`Failed to read "${table}": ${error.message}`)
  return data
}

const communities = await dump('communities')
const reports = await dump('reports')

const stamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '')
await mkdir('backups', { recursive: true })
const file = `backups/communities-${stamp}.json`

await writeFile(
  file,
  JSON.stringify({ exported_at: new Date().toISOString(), communities, reports }, null, 2),
)

console.log(`Backed up ${communities.length} communities, ${reports.length} reports → ${file}`)
