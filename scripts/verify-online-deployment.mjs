const deploymentUrl = String(process.argv[2] ?? '').replace(/\/$/, '');
const expectedEnvironment = process.argv[3] ?? 'preview';
const expectedCommit = process.argv[4] ?? '';

if (!/^https:\/\//.test(deploymentUrl)) {
  console.error('Usage: node scripts/verify-online-deployment.mjs <https-url> [preview|production] [commit-sha]');
  process.exit(1);
}

async function fetchChecked(path) {
  const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  const response = await fetch(`${deploymentUrl}${path}`, {
    headers: {
      accept: path === '/api/health' ? 'application/json' : 'text/html',
      ...(bypassSecret ? {
        'x-vercel-protection-bypass': bypassSecret,
        'x-vercel-set-bypass-cookie': 'true',
      } : {}),
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    const hint = response.status === 401 && !bypassSecret
      ? ' Set VERCEL_AUTOMATION_BYPASS_SECRET for protected Preview deployments.'
      : '';
    throw new Error(`${path} returned ${response.status} ${response.statusText}.${hint}`);
  }
  return response;
}

const health = await (await fetchChecked('/api/health')).json();
if (health.app !== 'ultida' || health.status !== 'ok') throw new Error('Health response does not identify a healthy ULTIDA deployment.');
if (health.deployment?.deploymentEnvironment !== expectedEnvironment) {
  throw new Error(`Expected ${expectedEnvironment}, received ${health.deployment?.deploymentEnvironment ?? 'unknown'} deployment environment.`);
}
if (expectedCommit && !String(health.deployment?.gitCommitSha ?? '').startsWith(expectedCommit)) {
  throw new Error(`Expected commit ${expectedCommit}, received ${health.deployment?.gitCommitSha ?? 'unknown'}.`);
}
if (expectedEnvironment === 'preview' && health.deployment?.previewDatabaseIsolated !== false) {
  throw new Error('Free-mode Preview must remain read-only unless a genuinely isolated database is configured.');
}

const html = await (await fetchChecked('/')).text();
if (!html.includes('id="root"')) throw new Error('Web entry point does not contain the React root element.');

console.log(JSON.stringify({
  status: 'PASS',
  deploymentUrl,
  deployment: health.deployment,
  readiness: health.readiness,
}, null, 2));
