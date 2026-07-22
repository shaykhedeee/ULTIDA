import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { NextFunction, Request, Response } from 'express';

export type AuthenticatedRequest = Request & { ultidaUser?: { id: string; projectId: string; organizationId?: string } };
export type AuthenticatedResponse = Response & { locals?: { user?: { id: string } } };

export async function authenticateProjectUser(request: Request, response: Response, projectId: string): Promise<{ userId: string; projectId: string; organizationId?: string; client: SupabaseClient } | null> {
  const url = process.env.SUPABASE_URL;
  const apiKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !apiKey) {
    response.status(503).json({ success: false, code: 'AUTH_UNAVAILABLE', message: 'Supabase is not configured on the server.' });
    return null;
  }
  const authorization = request.header('authorization') ?? '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : authorization.trim();
  if (!token) {
    response.status(401).json({ success: false, code: 'AUTH_REQUIRED', message: 'Sign in before using this project operation.' });
    return null;
  }
  const client = createClient(url, apiKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
  const { data: userData, error: userError } = await client.auth.getUser(token);
  if (userError || !userData.user) {
    response.status(401).json({ success: false, code: 'INVALID_SESSION', message: 'The session is invalid or expired.' });
    return null;
  }
  const userId = userData.user.id;
  const { data: project, error: projectError } = await client.from('projects').select('id, organization_id').eq('id', projectId).maybeSingle();
  if (projectError || !project) {
    response.status(403).json({ success: false, code: 'PROJECT_ACCESS_DENIED', message: 'This user cannot access the requested project.' });
    return null;
  }
  const { data: membership, error: membershipError } = await client
    .from('organization_members')
    .select('organization_id')
    .eq('organization_id', project.organization_id)
    .eq('user_id', userId)
    .maybeSingle();
  if (membershipError || !membership) {
    response.status(403).json({ success: false, code: 'PROJECT_ACCESS_DENIED', message: 'This user is not a member of the project organization.' });
    return null;
  }
  return { userId, projectId, organizationId: project.organization_id, client };
}

export async function requireProjectUser(request: AuthenticatedRequest, response: Response, next: NextFunction) {
  const projectId = String(request.body?.projectId ?? request.params.projectId ?? request.query.projectId ?? '');
  if (!projectId) return response.status(400).json({ success: false, code: 'PROJECT_REQUIRED', message: 'A project id is required.' });
  const actor = await authenticateProjectUser(request, response, projectId);
  if (!actor) return;
  request.ultidaUser = { id: actor.userId, projectId: actor.projectId, organizationId: actor.organizationId };
  response.locals = { ...(response.locals ?? {}), user: { id: actor.userId } };
  next();
}
