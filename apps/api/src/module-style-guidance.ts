import { MODULE_STYLE_REFERENCES } from '@ultida/catalog-core';
import type { SceneV1 } from '@ultida/scene-core';
/** Only bundled studio references are resolved; caller URLs never become provider inputs. */
export function moduleStyleGuidance(scene: SceneV1, roomId: string) {
  const entries = scene.modules.filter(module => module.roomId === roomId && module.designIntent).flatMap(module => {
    const intent = module.designIntent!;
    const reference = MODULE_STYLE_REFERENCES.find(item => intent.referenceAssetIds.includes(item.id) && (item.family === module.family || (module.family.startsWith('kitchen-') && item.family === 'kitchen')));
    return [{ moduleId: module.id, style: intent.style, reference }];
  });
  const refs = [...new Map(entries.flatMap(entry => entry.reference ? [[entry.reference.id, entry.reference] as const] : [])).values()].slice(0, 2);
  return {
    prompt: entries.length ? '\nUNIT APPEARANCE (visual guidance only):\n' + entries.map(entry => `Module ${entry.moduleId}: ${entry.style}${entry.reference && refs.some(reference => reference.id === entry.reference!.id) ? `; attached style reference ${entry.reference.id}` : '; textual appearance guidance only'}. Keep its saved dimensions, location and component count; do not copy the reference room or invent structural features.`).join('\n') : '',
    referenceAssets: refs.map(reference => `https://ultida.vercel.app${reference.imagePath}`),
    referenceIds: refs.map(reference => reference.id),
  };
}