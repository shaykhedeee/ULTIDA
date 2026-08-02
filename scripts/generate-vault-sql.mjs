import { readFile, writeFile, mkdir } from 'node:fs/promises';
const data = JSON.parse(await readFile('docs/examples-inventory.json','utf8'));
const seen = new Set(); const files = data.files.filter((f) => !seen.has(f.sha256) && (seen.add(f.sha256), true));
const esc = (v) => `'${String(v).replaceAll("'", "''")}'`;
const org = '5de916f3-59fe-43d6-9a21-cb22bdc433e2'; await mkdir('docs/vault-sql',{recursive:true});
for (let i=0;i<files.length;i+=20) { const rows=files.slice(i,i+20).map((f)=>{const title=f.path.split('/').pop().replace(/\.[^.]+$/,''); return `(${esc(org)},${esc(f.path)},${esc(f.sha256)},${f.bytes},${esc(f.extension)},${esc(title)},'unclassified','unclassified','unclassified','{}','unclassified','internal_reference','internal_only','needs_review','{}')`;}); const sql=`insert into public.reference_vault_entries (organization_id,source_path,sha256,byte_size,file_extension,title,room,module_family,style,material_tags,viewpoint,provenance,license_state,review_state,metadata) values ${rows.join(',')} on conflict (organization_id,sha256) do update set source_path=excluded.source_path,updated_at=now();`; await writeFile(`docs/vault-sql/${String(i/20).padStart(2,'0')}.sql`,sql); }
console.log(files.length);
