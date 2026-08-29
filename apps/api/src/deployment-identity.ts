export type DeploymentIdentity = {
  deploymentEnvironment: 'production' | 'preview' | 'development' | 'unknown';
  databaseEnvironment: 'production' | 'preview' | 'development' | 'unknown';
  databaseProjectRef: string | null;
  gitBranch: string | null;
  gitCommitSha: string | null;
  deploymentUrl: string | null;
  previewDatabaseIsolated: boolean;
};

type Environment = Record<string, string | undefined>;

function deploymentEnvironment(value: string | undefined): DeploymentIdentity['deploymentEnvironment'] {
  if (value === 'production' || value === 'preview' || value === 'development') return value;
  return 'unknown';
}

function databaseEnvironment(value: string | undefined): DeploymentIdentity['databaseEnvironment'] {
  if (value === 'production' || value === 'preview' || value === 'development') return value;
  return 'unknown';
}

function supabaseProjectRef(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const hostname = new URL(url).hostname;
    const suffix = '.supabase.co';
    return hostname.endsWith(suffix) ? hostname.slice(0, -suffix.length) || null : null;
  } catch {
    return null;
  }
}

export function getDeploymentIdentity(env: Environment = process.env): DeploymentIdentity {
  const deployedAs = deploymentEnvironment(env.VERCEL_ENV);
  const databaseAs = databaseEnvironment(env.ULTIDA_DATABASE_ENVIRONMENT);
  return {
    deploymentEnvironment: deployedAs,
    databaseEnvironment: databaseAs,
    databaseProjectRef: supabaseProjectRef(env.SUPABASE_URL || env.VITE_SUPABASE_URL),
    gitBranch: env.VERCEL_GIT_COMMIT_REF || null,
    gitCommitSha: env.VERCEL_GIT_COMMIT_SHA || null,
    deploymentUrl: env.VERCEL_URL || null,
    previewDatabaseIsolated: deployedAs !== 'preview' || databaseAs === 'preview',
  };
}

export function isPreviewWriteAllowed(identity: DeploymentIdentity): boolean {
  return identity.deploymentEnvironment !== 'preview' || identity.previewDatabaseIsolated;
}
