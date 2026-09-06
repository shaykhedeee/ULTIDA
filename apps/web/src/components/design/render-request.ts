export type RenderRequestIdentity = {
  sceneVersionId: string;
  roomId: string;
  operation: 'generate' | 'material-swap';
  style: string;
  quality: string;
  targetModuleId?: string | null;
  targetMaterialId?: string;
  targetSemanticSlot?: string;
};

/** Exact inputs identify retries; prompt punctuation and long suffixes matter. */
export async function renderRequestKey(input: RenderRequestIdentity): Promise<string> {
  const swap = input.operation === 'material-swap';
  const canonical = JSON.stringify([
    input.sceneVersionId, input.roomId, input.operation, input.style, input.quality,
    swap ? input.targetModuleId ?? null : null,
    swap ? input.targetMaterialId ?? null : null,
    swap ? input.targetSemanticSlot ?? null : null,
  ]);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return `render-v2:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}
