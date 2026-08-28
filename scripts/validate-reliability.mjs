import { existsSync, readFileSync } from 'node:fs';

const requiredFiles = [
  '.github/workflows/reliability.yml',
  '.github/workflows/online-smoke.yml',
  'docs/ONLINE_ONLY_DEVELOPMENT.md',
  'docs/RELEASE_CANDIDATE_CHECKLIST.md',
  'package-lock.json',
  'requirements.txt',
];

const failures = [];

for (const file of requiredFiles) {
  if (!existsSync(file)) failures.push(`missing required reliability file: ${file}`);
}

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const packageLock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const rootLock = packageLock.packages?.[''];

if (packageLock.lockfileVersion !== 3) failures.push('package-lock.json must use lockfileVersion 3');
if (!rootLock) failures.push('package-lock.json is missing the root workspace entry');
if (rootLock?.name !== packageJson.name || rootLock?.version !== packageJson.version) {
  failures.push('package.json and package-lock.json root identity do not match');
}
if (packageJson.engines?.node !== '24.x' || rootLock?.engines?.node !== '24.x') {
  failures.push('Node.js must be pinned to 24.x in package.json and package-lock.json');
}

for (const script of ['check', 'build', 'test', 'preflight', 'reliability']) {
  if (!packageJson.scripts?.[script]) failures.push(`package.json is missing the ${script} script`);
}

const browserTest = readFileSync('apps/api/test/browser-e2e.test.ts', 'utf8');
if (!browserTest.includes('ULTIDA_REQUIRE_BROWSER_E2E')) {
  failures.push('browser E2E cannot be made mandatory in CI');
}

const workflow = readFileSync('.github/workflows/reliability.yml', 'utf8');
for (const requiredStep of [
  'npm ci --include=optional --no-audit --no-fund',
  'python -m pip install -r requirements.txt',
  'npx playwright install --with-deps chromium',
  'node-version: 24',
  "ULTIDA_REQUIRE_BROWSER_E2E: 'true'",
  'npm run reliability',
]) {
  if (!workflow.includes(requiredStep)) failures.push(`reliability workflow is missing: ${requiredStep}`);
}

const onlineSmoke = readFileSync('.github/workflows/online-smoke.yml', 'utf8');
if (!onlineSmoke.includes('scripts/verify-online-deployment.mjs')) {
  failures.push('online smoke workflow does not verify the exact Vercel deployment');
}

if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exit(1);
}

console.log('PASS reliability contract');
