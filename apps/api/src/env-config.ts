export type ServerEnvConfig = {
  port: number;
  supabaseUrl: string | null;
  supabaseServiceRoleKeyConfigured: boolean;
  databaseUrlConfigured: boolean;
  openAiKeyConfigured: boolean;
  comfyUiUrlConfigured: boolean;
  isProduction: boolean;
};

export function validateServerEnvironment(): ServerEnvConfig {
  const port = Number(process.env.PORT) || 8800;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || null;
  const supabaseServiceRoleKeyConfigured = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const databaseUrlConfigured = Boolean(process.env.DATABASE_URL || process.env.SUPABASE_DB_URL);
  const openAiKeyConfigured = Boolean(process.env.OPENAI_API_KEY);
  const comfyUiUrlConfigured = Boolean(process.env.COMFYUI_URL);
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    port,
    supabaseUrl,
    supabaseServiceRoleKeyConfigured,
    databaseUrlConfigured,
    openAiKeyConfigured,
    comfyUiUrlConfigured,
    isProduction
  };
}
