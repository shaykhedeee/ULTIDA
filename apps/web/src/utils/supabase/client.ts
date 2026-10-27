import { createBrowserClient } from '@supabase/ssr';

const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
const supabaseUrl =
  metaEnv.VITE_SUPABASE_URL ||
  metaEnv.NEXT_PUBLIC_SUPABASE_URL ||
  'https://ichnyfuetcucxhxilnre.supabase.co';
const supabaseKey =
  metaEnv.VITE_SUPABASE_PUBLISHABLE_KEY ||
  metaEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  '';

export const createClient = () => createBrowserClient(supabaseUrl, supabaseKey);
