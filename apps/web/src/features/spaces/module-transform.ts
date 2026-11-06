import type { ModuleDraft } from './module-edit-session';
export function transformModuleDraft(draft: ModuleDraft, delta: {xMm:number;yMm:number}, rotationDeg:number, mode:'width'|'depth'|'move', wallLengthMm:number): ModuleDraft {
 const angle=rotationDeg*Math.PI/180;
 const along=delta.xMm*Math.cos(angle)+delta.yMm*Math.sin(angle);
 const across=-delta.xMm*Math.sin(angle)+delta.yMm*Math.cos(angle);
 const round=(n:number)=>String(Math.round(n));
 if (mode==='move') return {...draft,offsetMm:round(Math.max(0,Math.min(wallLengthMm-Number(draft.widthMm),Number(draft.offsetMm)+along)))};
 if (mode==='width') return {...draft,widthMm:round(Math.max(1,Math.min(wallLengthMm-Number(draft.offsetMm),Number(draft.widthMm)+along)))};
 return {...draft,depthMm:round(Math.max(1,Number(draft.depthMm)+across))};
}
