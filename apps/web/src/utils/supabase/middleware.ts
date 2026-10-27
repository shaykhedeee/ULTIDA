import { createServerClient, type CookieOptions } from '@supabase/ssr';

export interface MiddlewareRequestAdapter {
  headers: Headers;
  cookies: {
    getAll(): { name: string; value: string }[];
    set(name: string, value: string): void;
  };
}

export interface MiddlewareResponseAdapter {
  cookies: {
    set(name: string, value: string, options?: CookieOptions): void;
  };
}

const getEnv = (key: string): string | undefined => {
  const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  if (metaEnv && metaEnv[key]) return metaEnv[key];
  if (typeof globalThis !== 'undefined' && 'process' in globalThis) {
    return (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[key];
  }
  return undefined;
};

export const createClient = <TResponse extends MiddlewareResponseAdapter>(
  request: MiddlewareRequestAdapter,
  createResponse: (req: MiddlewareRequestAdapter) => TResponse,
) => {
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

  let supabaseResponse = createResponse(request);

  createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = createResponse(request);
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  return supabaseResponse;
};
