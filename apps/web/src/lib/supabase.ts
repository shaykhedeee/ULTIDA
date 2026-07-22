import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';

export const supabaseConfigured = Boolean(url && anon);

export function createSupabaseBrowserClient() {
  if (!supabaseConfigured) return null;
  try {
    return createClient(url, anon, { auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true } });
  } catch {
    return null;
  }
}

let client: ReturnType<typeof createSupabaseBrowserClient> = null;
export function getSupabaseBrowserClient() {
  if (!client) client = createSupabaseBrowserClient();
  return client;
}

export const supabase = getSupabaseBrowserClient();
