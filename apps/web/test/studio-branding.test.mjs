import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

/**
 * Third-party studio names must never be baked into shipped source. Branding
 * on a drawing, dossier or screen belongs to the studio identity record so a
 * different studio can issue its own documents. This guards a specific brand
 * that was previously hardcoded into the working-drawings dossier and the
 * production dossier PDF header.
 */
const FORBIDDEN_BRAND = 'CUBEDECOR';

test('no third-party studio brand is hardcoded into shipped source', () => {
  let matches = '';
  try {
    matches = execFileSync(
      'git',
      [
        'grep',
        '--ignore-case',
        '--line-number',
        '--fixed-strings',
        FORBIDDEN_BRAND,
        '--',
        'apps',
        'packages',
        'scripts',
        'api',
      ],
      { encoding: 'utf8' },
    );
  } catch (error) {
    // `git grep` exits 1 when there are no matches, which is the passing case.
    if (error.status === 1) return;
    throw error;
  }

  assert.fail(
    `Studio branding must come from the studio identity record, not hardcoded source. Found:\n${matches}`,
  );
});
