import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type RequestSupabaseClient = SupabaseClient;

const url = () => process.env.SUPABASE_URL;
// User-facing requests must use the request JWT with a valid client key.
// Keep the service role available for trusted worker paths, but do not let a
// stale SUPABASE_SECRET_KEY override a working publishable key.
const apiKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_SECRET_KEY;

let client: SupabaseClient | null = null;

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
