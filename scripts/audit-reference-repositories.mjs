import { readFile, mkdir, writeFile } from 'node:fs/promises';

// Read-only GitHub metadata inventory. Never downloads or executes repository code.
const input = process.argv[2];
if (!input) throw new Error('Usage: node scripts/audit-reference-repositories.mjs <reference-text-file>');
const source = await readFile(input, 'utf8');
const repos = new Set([...source.matchAll(/https:\/\/github\.com\/([\w.-]+\/[\w.-]+)/g)].map(match => match[1]));
for (const match of source.matchAll(/\]\s*:\s*([\w.-]+\/[\w.-]+)\s*$/gm)) repos.add(match[1]);
const results = [];
for (const repo of repos) {
  const url = `https://api.github.com/repos/${repo}`;
  try {
    const response = await fetch(url, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'ULTIDA-reference-audit' }, signal: AbortSignal.timeout(15000) });
    const body = await response.json();
    results.push({ repo, url: `https://github.com/${repo}`, checkedAt: new Date().toISOString(), httpStatus: response.status,
      ...(response.ok ? { description: body.description, defaultBranch: body.default_branch, licenseReportedByGitHub: body.license?.spdx_id ?? null,
        archived: body.archived, language: body.language, pushedAt: body.pushed_at,
        decision: 'Source, dependencies and asset rights review required before reuse; metadata is not integration approval.' }
        : { error: body.message, decision: 'Unresolved; no code imported.' }) });
  } catch (error) { results.push({ repo, url, error: error.message, decision: 'Unresolved; no code imported.' }); }
  console.log(`${results.length}/${repos.size} ${repo}: ${results.at(-1).httpStatus ?? 'unavailable'}`);
}
await mkdir('docs/research', { recursive: true });
await writeFile('docs/research/repository-inventory.json', JSON.stringify({
  scope: 'Availability and GitHub-reported license metadata only; not a source audit or proof of compatibility.',
  unresolvedNames: source.includes('awesome-nano-banana-spatial-design') ? ['awesome-nano-banana-spatial-design: repository owner missing from supplied list'] : [], results,
}, null, 2) + '\n');
