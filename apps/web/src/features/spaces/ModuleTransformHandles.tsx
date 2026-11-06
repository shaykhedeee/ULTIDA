import { useRef } from 'react';
import { transformModuleDraft } from './module-transform';
import type { ModuleDraft } from './module-edit-session';
type Point={xMm:number;yMm:number};
export function ModuleTransformHandles({draft,scale,rotationDeg,wallLengthMm,toWorld,onEdit,onActive,onCommit}:{draft:ModuleDraft;scale:number;rotationDeg:number;wallLengthMm:number;toWorld:(event:{clientX:number;clientY:number})=>Point;onEdit:(draft:ModuleDraft)=>void;onActive:(active:boolean)=>void;onCommit:()=>void}) {
 const drag=useRef<{start:Point;draft:ModuleDraft;mode:'width'|'depth'|'move';id:number}|null>(null);
 const width=Number(draft.widthMm)*scale,depth=Number(draft.depthMm)*scale;
 return <g onClick={event=>event.stopPropagation()} onMouseDown={event=>event.stopPropagation()}>
  {(['move','width','depth'] as const).map(mode=><rect key={mode} role="button" tabIndex={0} aria-label={`${mode==='move'?'Move furniture along wall':`Resize furniture ${mode}`} · arrow keys adjust 10 mm`}
    x={(mode==='width'?width:width/2)-7} y={(mode==='depth'?depth:mode==='move'?depth/2:depth/2)-7} width={14} height={14} rx={3} fill="white" stroke="#17669c" strokeWidth={2} style={{cursor:mode==='move'?'move':mode==='width'?'ew-resize':'ns-resize',touchAction:'none'}}
    onPointerDown={event=>{if(event.button!==0)return;event.stopPropagation();event.preventDefault();drag.current={start:toWorld(event),draft:{...draft},mode,id:event.pointerId};event.currentTarget.setPointerCapture(event.pointerId);onActive(true);}}
    onPointerMove={event=>{const current=drag.current;if(!current||current.id!==event.pointerId)return;event.stopPropagation();const point=toWorld(event);onEdit(transformModuleDraft(current.draft,{xMm:point.xMm-current.start.xMm,yMm:point.yMm-current.start.yMm},rotationDeg,mode,wallLengthMm));}}
    onPointerUp={event=>{if(!drag.current)return;event.stopPropagation();drag.current=null;onActive(false);event.currentTarget.releasePointerCapture(event.pointerId);onCommit();}}
    onPointerCancel={()=>{if(drag.current)onEdit(drag.current.draft);drag.current=null;onActive(false);}}
    onKeyDown={event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();event.stopPropagation();const amount=['ArrowLeft','ArrowUp'].includes(event.key)?-10:10;const angle=rotationDeg*Math.PI/180;const along=mode!=='depth';onEdit(transformModuleDraft(draft,{xMm:amount*(along?Math.cos(angle):-Math.sin(angle)),yMm:amount*(along?Math.sin(angle):Math.cos(angle))},rotationDeg,mode,wallLengthMm));onCommit();}}><title>{mode==='move'?'Move along wall':'Resize '+mode} · save on release</title></rect>)}
 </g>;
}
