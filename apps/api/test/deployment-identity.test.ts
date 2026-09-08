import assert from 'node:assert/strict';
import test from 'node:test';
import { getDeploymentIdentity, isPreviewWriteAllowed } from '../src/deployment-identity.js';

test('preview writes require an explicitly isolated preview database', () => {
  const unsafe = getDeploymentIdentity({
    VERCEL_ENV: 'preview',
    VERCEL_GIT_COMMIT_SHA: 'abc123',
    SUPABASE_URL: 'https://production-ref.supabase.co',
    ULTIDA_DATABASE_ENVIRONMENT: 'production',
  });

  assert.equal(unsafe.deploymentEnvironment, 'preview');
  assert.equal(unsafe.databaseEnvironment, 'production');
  assert.equal(unsafe.databaseProjectRef, 'production-ref');
  assert.equal(unsafe.previewDatabaseIsolated, false);
  assert.equal(isPreviewWriteAllowed(unsafe), false);
});

test('preview writes are allowed for an explicitly isolated preview database', () => {
  const safe = getDeploymentIdentity({
    VERCEL_ENV: 'preview',
    VERCEL_GIT_COMMIT_REF: 'codex/release-recovery-20260728',
    SUPABASE_URL: 'https://preview-ref.supabase.co',
    ULTIDA_DATABASE_ENVIRONMENT: 'preview',
  });

  assert.equal(safe.previewDatabaseIsolated, true);
  assert.equal(isPreviewWriteAllowed(safe), true);
});

test('production and local writes are not affected by the preview guard', () => {
  assert.equal(isPreviewWriteAllowed(getDeploymentIdentity({ VERCEL_ENV: 'production' })), true);
  assert.equal(isPreviewWriteAllowed(getDeploymentIdentity({})), true);
});
