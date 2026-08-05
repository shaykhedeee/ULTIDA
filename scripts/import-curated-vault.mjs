import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const organizationId = process.env.ULTIDA_ORGANIZATION_ID || '5de916f3-59fe-43d6-9a21-cb22bdc433e2';
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Canonical Supabase server credentials are required.');
const manifest = JSON.parse(await readFile('docs/reference-vault-manifest.json', 'utf8'));
const client = createClient(url, key, { auth: { persistSession: false } });
const rows = manifest.entries.map((entry) => ({
  organization_id: organizationId,
  source_path: entry.source_path,
  sha256: entry.sha256,
  byte_size: entry.byte_size,
  file_extension: entry.source_path.split('.').pop()?.toLowerCase() || 'png',
  title: entry.title,
  room: entry.room,
  module_family: entry.module_family,
  style: entry.style,
  material_tags: entry.tags,
  viewpoint: entry.viewpoint,
  provenance: entry.provenance,
  license_state: entry.license_state,
  review_state: entry.review_state,
  metadata: entry.metadata,
}));
const { error } = await client.from('reference_vault_entries').upsert(rows, { onConflict: 'organization_id,sha256' });
if (error) throw error;
console.log(`Imported ${rows.length} curated reference entries into the canonical vault.`);
