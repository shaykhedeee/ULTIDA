import { enqueueRoomSave } from './room-save-queue';

export type ModuleDraft = { widthMm: string; depthMm: string; heightMm: string; offsetMm: string };
export type ModuleRow = { id: string; updated_at: string; config_json: Record<string, any>; position_json: Record<string, any>; [key: string]: any };
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;
type State = { base: ModuleRow; draft: ModuleDraft; status: 'saved' | 'unsaved' | 'saving' | 'attention' | 'conflict'; error: string; storageWarning: string; conflict: ModuleRow | null; canUndo: boolean; canRedo: boolean };
export const moduleDraftFromRow = (row: ModuleRow): ModuleDraft => ({ widthMm: String(row.config_json.widthMm), depthMm: String(row.config_json.depthMm), heightMm: String(row.config_json.heightMm), offsetMm: String(row.position_json.offsetMm) });
const equal = (a: ModuleDraft, b: ModuleDraft) => (Object.keys(a) as (keyof ModuleDraft)[]).every(key => a[key] === b[key]);
export function validModuleDraft(draft: ModuleDraft) {
 return Object.entries(draft).every(([key,value]) => value.trim() !== '' && Number.isFinite(Number(value)) && (key === 'offsetMm' ? Number(value) >= 0 : Number(value) > 0));
}

/** A retained edit belongs to one user, project, room and module. No automatic conflict rebasing. */
export class ModuleEditSession {
 private state: State;
 private listeners = new Set<() => void>();
 private past: ModuleDraft[] = [];
 private future: ModuleDraft[] = [];
 private inFlight: Promise<boolean> | null = null;
 private replay = false;
 private key: string;
 private originRevision: string;
 constructor(base: ModuleRow, private scope: string, private storage: Storage, private persist: (base: ModuleRow, draft: ModuleDraft) => Promise<ModuleRow | { conflict: ModuleRow }>) {
  this.key = `ultida.module-draft.v1:${scope}`;
  this.originRevision = base.updated_at;
  this.state = { base, draft: moduleDraftFromRow(base), status:'saved', error:'', storageWarning:'', conflict:null, canUndo:false, canRedo:false };
  try {
   const retained = JSON.parse(storage.getItem(this.key) ?? 'null');
   if (retained && retained.baseUpdatedAt && retained.draft && Object.keys(this.state.draft).every(key => typeof retained.draft[key] === 'string')) {
    this.state.draft = retained.draft;
    this.originRevision = retained.baseUpdatedAt;
    if (!equal(retained.draft,moduleDraftFromRow(base))) {
     this.state.status = retained.baseUpdatedAt === base.updated_at ? 'attention' : 'conflict';
     this.state.error = 'Recovered furniture changes. Review them before saving.';
     if (this.state.status === 'conflict') this.state.conflict = base;
    } else storage.removeItem(this.key);
   }
  } catch { this.state.storageWarning = 'This browser could not recover furniture drafts.'; }
 }
 snapshot = () => this.state;
 subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
 private publish(next: Partial<State>) {
  this.state = { ...this.state, ...next, canUndo:this.past.length > 0, canRedo:this.future.length > 0 };
  try {
   if (this.state.status === 'saved') this.storage.removeItem(this.key);
   else this.storage.setItem(this.key, JSON.stringify({ baseUpdatedAt:this.originRevision, draft:this.state.draft }));
  } catch { this.state = { ...this.state, storageWarning:'This browser cannot retain drafts. Keep this page open until saving succeeds.' }; }
  this.listeners.forEach(listener => listener());
 }
 edit(patch: Partial<ModuleDraft>) {
  this.replay = false;
  this.publish({ draft:{ ...this.state.draft,...patch }, status:this.state.conflict ? 'conflict' : 'unsaved', error:'' });
 }
 save(): Promise<boolean> {
  if (this.inFlight) return this.inFlight;
  if (this.state.conflict) return Promise.resolve(false);
  const draft = { ...this.state.draft };
  if (!validModuleDraft(draft)) { this.publish({status:'attention', error:'Enter positive width, depth and height, and a wall offset of zero or more.'}); return Promise.resolve(false); }
  if (equal(draft,moduleDraftFromRow(this.state.base))) {this.publish({status:'saved',error:''}); return Promise.resolve(true);}
  const replay = this.replay;
  this.publish({status:'saving',error:''});
  this.inFlight = enqueueRoomSave(this.scope.split('/').slice(1,-1).join('/'), async () => {
   const base = this.state.base;
   try {
    const result = await this.persist(base,draft);
    if ('conflict' in result) { this.publish({status:'conflict',conflict:result.conflict,error:'Another edit was saved. Compare both versions before continuing.'}); return false; }
    if (!replay) { this.past.push(moduleDraftFromRow(base)); this.future = []; }
    this.replay = false;
    this.originRevision = result.updated_at;
    const unchanged = equal(this.state.draft,draft);
    this.publish({base:result,draft:unchanged ? moduleDraftFromRow(result) : this.state.draft,status:unchanged ? 'saved' : 'unsaved',error:''});
    return true;
   } catch(error) {this.publish({status:'attention',error:error instanceof Error ? error.message : 'Furniture could not be saved. Retry when connected.'});return false;}
  }).finally(()=>{this.inFlight=null;});
  return this.inFlight;
 }
 resolve(choice:'saved'|'proposed') {
  const base = this.state.conflict; if (!base || this.inFlight) return;
  this.past=[];this.future=[];this.originRevision=base.updated_at;
  this.publish({base,conflict:null,draft:choice==='saved'?moduleDraftFromRow(base):this.state.draft,status:choice==='saved'?'saved':'unsaved',error:''});
 }
 undo() {
  if (this.inFlight || this.state.conflict) return;
  const draft=this.past.pop(); if (!draft) return;
  this.future.push({...this.state.draft});this.replay=true;
  this.publish({draft,status:'unsaved',error:''});
 }
 redo() {
  if (this.inFlight || this.state.conflict) return;
  const draft=this.future.pop();if (!draft) return;
  this.past.push({...this.state.draft});this.replay=true;
  this.publish({draft,status:'unsaved',error:''});
 }
}
