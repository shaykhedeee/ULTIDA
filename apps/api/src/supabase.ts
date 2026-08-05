import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type RequestSupabaseClient = SupabaseClient;

const url = () => process.env.SUPABASE_URL;
// User-facing requests must use the request JWT with a valid client key.
// Service-role credentials are reserved for explicit trusted worker paths only.
const apiKey = () => process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_SECRET_KEY;
const serverKey = () => process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

let client: SupabaseClient | null = null;
let serverClient: SupabaseClient | null = null;

/**
 * Trusted server-only client. Callers must authenticate and authorize the
 * project member before using this client. It exists for private storage
 * signing and worker persistence, where Storage RLS must not make a valid
 * signed-upload handoff randomly fail after project authorization succeeded.
 */
export function getServerSupabaseClient(): SupabaseClient | null {
  const resolvedUrl = url();
  const resolvedKey = serverKey();
  if (!resolvedUrl || !resolvedKey) return null;
  if (!serverClient) {
    serverClient = createClient(resolvedUrl, resolvedKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return serverClient;
}

export function getRequestSupabaseClient(request?: any): SupabaseClient {
  const resolvedUrl = url();
  const resolvedKey = apiKey();
  
  if (request && typeof request.header === 'function') {
    const rawHeader = String(request.header('authorization') ?? '').trim();
    if (rawHeader) {
      const token = rawHeader.toLowerCase().startsWith('bearer ') ? rawHeader.slice(7).trim() : rawHeader;
      const normalizedAuthorization = `Bearer ${token}`;
      return createClient(resolvedUrl || 'https://placeholder.supabase.co', resolvedKey || 'placeholder', {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: normalizedAuthorization } }
      });
    }
  }

  if (!client) {
    client = createClient(resolvedUrl || 'https://placeholder.supabase.co', resolvedKey || 'placeholder', { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}
