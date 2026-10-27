import { createServerClient, type CookieOptions } from '@supabase/ssr';

export interface CookieStoreAdapter {
  getAll(): { name: string; value: string }[];
  set(name: string, value: string, options?: CookieOptions): void;
}

const getEnv = (key: string): string | undefined => {
  const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  if (metaEnv && metaEnv[key]) return metaEnv[key];
  if (typeof globalThis !== 'undefined' && 'process' in globalThis) {
    return (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[key];
  }
  return undefined;
};

export const createClient = (cookieStore: CookieStoreAdapter) => {
  const supabaseUrl =
    getEnv('NEXT_PUBLIC_SUPABASE_URL') ||
    getEnv('VITE_SUPABASE_URL') ||
    getEnv('SUPABASE_URL') ||
    'https://ichnyfuetcucxhxilnre.supabase.co';
  const supabaseKey =
    getEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') ||
    getEnv('VITE_SUPABASE_PUBLISHABLE_KEY') ||
    getEnv('SUPABASE_PUBLISHABLE_KEY') ||
    '';

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Safe to ignore when invoked from a read-only server context while middleware refreshes sessions.
        }
      },
    },
  });
};
