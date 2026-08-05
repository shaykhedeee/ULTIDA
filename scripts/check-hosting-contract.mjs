import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const canonicalSupabaseUrl = 'https://ichnyfuetcucxhxilnre.supabase.co';
const requiredVariableNames = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'VITE_API_BASE',
];

const failures = [];

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=');
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
}

function assertRequiredNames(path, label) {
  const content = existsSync(path) ? readFileSync(path, 'utf8') : '';
  for (const name of requiredVariableNames) {
    if (!content.includes(name)) failures.push(`${label} is missing ${name}`);
  }
}

assertRequiredNames(resolve(root, '.env.example'), '.env.example');
assertRequiredNames(resolve(root, 'docs/release/canonical-hosting.md'), 'docs/release/canonical-hosting.md');

for (const [label, env] of [
  ['.env.example', parseEnvFile(resolve(root, '.env.example'))],
  ['.env', parseEnvFile(resolve(root, '.env'))],
]) {
  for (const name of ['VITE_SUPABASE_URL', 'SUPABASE_URL']) {
    if (env[name] && env[name] !== canonicalSupabaseUrl) {
      failures.push(`${label} ${name} must point to ${canonicalSupabaseUrl}`);
    }
  }
}

if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exit(1);
}

console.log('PASS canonical hosting contract');
