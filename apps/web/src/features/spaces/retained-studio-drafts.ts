export type RetainedStudioDraft = {key:string;kind:'furniture'|'finish'|'placement';roomId:string};
/** Review must inspect retained state even when its inspector has never been opened. */
export function retainedStudioDraft(storage:Pick<Storage,'length'|'key'|'getItem'>,userId:string,projectId:string):RetainedStudioDraft|null {
 for(let index=0;index<storage.length;index++){
  const key=storage.key(index);if(!key||!storage.getItem(key))continue;
  for(const [prefix,kind] of [['ultida.module-draft.v1:','furniture'],['ultida.finish-draft.v1:','finish']] as const){
   const scope=prefix+userId+'/'+projectId+'/';
   if(key.startsWith(scope))return {key,kind,roomId:key.slice(scope.length).split('/')[0]};
  }
  if(key.startsWith('ultida.pending-placement.v1:')){
   try{const fingerprint=JSON.parse(key.slice('ultida.pending-placement.v1:'.length));if(Array.isArray(fingerprint)&&fingerprint[0]===userId&&fingerprint[1]===projectId)return {key,kind:'placement',roomId:String(fingerprint[2])};}catch{/* Ignore keys that are not placement fingerprints. */}
  }
 }
 return null;
}
