import { createClient } from '@supabase/supabase-js';

// Vite exposes browser-safe configuration exclusively through import.meta.env.
// Referencing process.env here crashes the whole client before React can mount.
const url = import.meta.env.VITE_SUPABASE_URL || '';
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

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
