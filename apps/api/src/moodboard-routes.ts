import type { Express, Request } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireProjectUser, type AuthenticatedRequest } from './api-auth.js';
import { loadMoodboardContext, signedMoodboardAssets, saveMoodboard, attachMoodboardSwatch, MoodboardError } from './moodboard-store.js';
export function registerMoodboardRoutes(app: Express, getClient: (request: Request) => SupabaseClient) {
  const route = '/api/projects/:projectId/rooms/:roomId/moodboard';
  app.get(route,requireProjectUser,async(request,response)=>{
    try {
      const client=getClient(request);
      const context=await loadMoodboardContext(client,String(request.params.projectId),String(request.params.roomId));
      const assets=await signedMoodboardAssets(client,context);
      return response.json({success:true,document:context.latest?.document ?? null,revision:context.latest?.revision ?? 0,currentSourceFingerprint:context.fingerprint,...assets,materialSources:context.materials.map(m=>({materialId:m.id,textureAssetId:m.texture_asset_id ?? null,updatedAt:m.updated_at ?? null})),stale:context.sceneStale || (!!context.latest && context.latest.document?.sourceFingerprint !== context.fingerprint)});
    } catch(error) { const e=error instanceof MoodboardError?error:new MoodboardError(503,'MOODBOARD_UNAVAILABLE','Moodboard could not be loaded.'); return response.status(e.status).json({success:false,code:e.code,message:e.message}); }
  });
  app.put(route,requireProjectUser,async(request,response)=>{
    try {
      const result=await saveMoodboard(getClient(request),String(request.params.projectId),String(request.params.roomId),(request as AuthenticatedRequest).ultidaUser!.id,request.body);
      return response.json({success:true,...result});
    } catch(error) { const e=error instanceof MoodboardError?error:new MoodboardError(503,'MOODBOARD_UNAVAILABLE','Moodboard could not be saved.'); return response.status(e.status).json({success:false,code:e.code,message:e.message}); }
  });
  app.post(`${route}/swatch`,requireProjectUser,async(request,response)=>{
    try { const result=await attachMoodboardSwatch(getClient(request),String(request.params.projectId),String(request.params.roomId),request.body);return response.json({success:true,...result}); }
    catch(error) { const e=error instanceof MoodboardError?error:new MoodboardError(503,'SWATCH_UNAVAILABLE','Swatch could not be saved.');return response.status(e.status).json({success:false,code:e.code,message:e.message}); }
  });

}
