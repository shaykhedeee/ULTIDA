import { useEffect, useMemo, useRef, useState } from 'react';
import { Layers, RefreshCcw, AlertTriangle, Check, Palette } from 'lucide-react';
import { buildRoomMoodboard, type RoomBoardMaterial, type RoomBoardModule, type RoomBoardAssignment } from './room-moodboard';
import { supabase } from '../../lib/supabase';
import { getApiBase } from '../../lib/api-base';
import './room-material-board.css';
import { VERIFIED_MERINO_REFERENCES, STARTER_FITTINGS } from '@ultida/catalog-core';
import MoodboardMaker from './MoodboardMaker';

type Props = {
  projectId: string | null;
  roomId: string | null;
  roomName: string;
  sceneVersionId?: string | null;
  modules: RoomBoardModule[];
  materials: RoomBoardMaterial[];
  refreshToken?: number;
  onMaterialImported?: (material: RoomBoardMaterial) => void;
  onAssignmentSaved?: () => void;
};
export default function RoomMaterialBoard({projectId,roomId,roomName,sceneVersionId,modules,materials,refreshToken,onMaterialImported,onAssignmentSaved}: Props) {
  const [assignments,setAssignments] = useState<RoomBoardAssignment[]>([]);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState('');
  const [truncated,setTruncated] = useState(false);
  const [refresh,setRefresh] = useState(0);
  const [roomFinishSlot,setRoomFinishSlot] = useState<'wall'|'flooring'|'ceiling'|'lighting'>('wall');
  const [roomMaterialId,setRoomMaterialId] = useState('');
  const [savingRoomFinish,setSavingRoomFinish] = useState(false);
  const [sourceId, setSourceId] = useState('');
  const [importing, setImporting] = useState(false);
  const contextKey = `${projectId}:${roomId}`;
  const activeContext = useRef(contextKey);
  activeContext.current = contextKey;
  useEffect(() => { setRoomMaterialId(''); setSourceId(''); }, [projectId, roomId]);
  async function importSource() {
    if (!projectId || !sourceId || !supabase) return;
    const startedContext = contextKey;
    setImporting(true); setError('');
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) throw new Error('Sign in to import supplier references.');
      const response = await fetch(`${getApiBase()}/projects/${encodeURIComponent(projectId)}/material-library/supplier-reference`, {
        method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success || !payload.material?.id) throw new Error(payload.message ?? 'Supplier reference could not be imported.');
      if (activeContext.current !== startedContext) return;
      onMaterialImported?.(payload.material);
      setRoomMaterialId(payload.material.id);
    } catch (err) { setError(err instanceof Error ? err.message : 'Supplier import failed.'); }
    finally { setImporting(false); }
  }
  useEffect(()=>{
    if (!projectId || !roomId) { setAssignments([]);setLoading(false);return; }
    let live=true;
    setLoading(true);setError('');
    void (async()=>{
      try {
        if (!supabase) throw new Error('Sign-in is unavailable. Check the application configuration.');
        const {data:{session}}=await supabase.auth.getSession();
        if (!session?.access_token) throw new Error('Sign in to view the saved room materials.');
        const response=await fetch(`${getApiBase()}/projects/${encodeURIComponent(projectId)}/material-assignments`,{
          headers:{Authorization:`Bearer ${session.access_token}`}
        });
        const payload=await response.json().catch(()=>null);
        if (!response.ok || !Array.isArray(payload?.assignments)) throw new Error(payload?.message ?? 'Cannot load material assignments.');
        if(live){setAssignments(payload.assignments);setTruncated(Boolean(payload.truncated));}
      } catch(err) { if(live){setAssignments([]);setError(err instanceof Error?err.message:'Material board unavailable.');} }
      finally{if(live)setLoading(false);}
    })();
    return ()=>{live=false;};
  },[projectId,roomId,refresh,refreshToken]);
  const board=useMemo(()=>buildRoomMoodboard({projectId:projectId??'',roomId:roomId??'',modules,materials,assignments}),
    [projectId,roomId,modules,materials,assignments]);
  const uniqueMaterials=new Set(board.items.map(i=>i.materialId)).size;
  async function assignRoomFinish() {
    if(!projectId||!roomId||!roomMaterialId) {setError('Select an actual library material and room before saving.');return;}
    setSavingRoomFinish(true);setError('');
    const startedContext = contextKey;
    try {
      if (!supabase) throw new Error('Sign-in is unavailable. Check the application configuration.');
      const {data:{session}}=await supabase.auth.getSession();
      if(!session?.access_token) throw new Error('Sign in to change room materials.');
      const response=await fetch(`${getApiBase()}/projects/${encodeURIComponent(projectId)}/material-assignments`,{
        method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},
        body:JSON.stringify({materialId:roomMaterialId,targetKind:'room',targetId:roomId,semanticSlot:roomFinishSlot,status:'draft'})
      });
      const payload=await response.json().catch(()=>null);
      if(!response.ok||!payload?.success) throw new Error(payload?.message??'Could not save room finish.');
      if (activeContext.current !== startedContext) return;
      onAssignmentSaved?.();
      setRefresh(n=>n+1);
    }catch(err){setError(err instanceof Error?err.message:'Unable to save room material.');}
    finally{setSavingRoomFinish(false);}
  }
  return <section className="ultida-material-board" aria-label="Materials assigned to this room">
    <div className="ultida-material-board-head">
      <div><span className="ultida-board-kicker">LIVE ROOM MATERIAL BOARD</span><h3>{roomName || 'Select a room'} · Look &amp; feel</h3>
        <p>Built from the actual saved room and module material assignments; starter inspiration never appears as a selected finish.</p></div>
      <div className="ultida-material-board-tools">
        <button type="button" onClick={()=>setRefresh(n=>n+1)} disabled={loading||!projectId||!roomId}><RefreshCcw size={14}/> Refresh</button>
      </div>
    </div>
    <div className="ultida-board-stats"><span><Layers size={13}/> {board.moduleCount} room modules</span>
      <span><Palette size={13}/> {uniqueMaterials} assigned materials</span>
      <span>{loading ? 'Updating…' : error ? 'Read unavailable' : 'Saved assignments loaded'}</span></div>
    {truncated ? <div className="ultida-board-alert" role="alert">This project has more than 1,000 saved assignments. The board may be incomplete until pagination is enabled.</div>:null}
    {error ? <div className="ultida-board-alert" role="alert"><AlertTriangle size={15}/> {error}</div>:null}
    {board.incompleteMaterialIds.length>0?<div className="ultida-board-alert" role="alert">{board.incompleteMaterialIds.length} assigned material record(s) missing from the organization library. Verify access before exporting.</div>:null}
    {projectId && roomId && <MoodboardMaker projectId={projectId} roomId={roomId} roomName={roomName} sceneVersionId={sceneVersionId ?? null} items={board.items} refreshToken={refresh + (refreshToken ?? 0)} />}
    {!board.items.length && !loading ? <div className="ultida-board-empty">
      <Palette size={24}/><strong>No saved materials for this room yet</strong><span>Place a module and save its carcass, shutter and hardware assignments. The board will populate from those records.</span>
    </div>:null}
    {board.items.length>0 && <>
      <details><summary>Assigned material specifications · {board.items.length} references</summary>
      <div className="ultida-board-cards is-tiles">
        {board.items.map(item=><article key={item.key} className="ultida-board-material">
          <div className="ultida-board-material-swatch" style={{background:item.hex??'repeating-linear-gradient(45deg,#d8d0c4,#d8d0c4 10px,#ede8de 10px,#ede8de 20px)'}} title={item.hex?'Approximate color only':'No verified swatch color'}>
            <span>{item.hex?'COLOR APPROXIMATION':'SWATCH UNAVAILABLE'}</span>
          </div>
          <div className="ultida-board-material-info"><small>{item.targetName} · {item.slot}</small><strong>{item.name}</strong>
          <p>{item.brand||'Supplier not specified'}{item.code?` · ${item.code}`:' · SKU missing'}</p>
          {item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">Supplier specification</a>}
          <span>{item.thicknessMm?`${item.thicknessMm} mm · `:''}{item.finish||item.category} · Rev {item.revision}</span>
          <div className={`ultida-board-source-status ${item.skuVerified?'has-reference':'needs-reference'}`}>
            {item.skuVerified?<Check size={12}/>:<AlertTriangle size={12}/>}{item.skuVerified?'Supplier reference present — confirm datasheet':'Supplier / SKU verification needed'}
          </div></div>
        </article>)}
      </div></details>
    </>}
    <div className="ultida-board-room-editor">
      <details>
        <summary>Add a supplier reference to the shared material library</summary>
        <select aria-label="Supplier reference" value={sourceId} onChange={e => setSourceId(e.target.value)}>
          <option value="">Choose a manufacturer record…</option>
          <optgroup label="Merino finishes and decorative boards">{VERIFIED_MERINO_REFERENCES.map(m => <option key={m.id} value={m.id}>{m.name} · {m.decorCode} · {m.kind}</option>)}</optgroup>
          <optgroup label="Ebco / Hettich fittings">{STARTER_FITTINGS.map(f => <option key={f.id} value={f.id}>{f.brand} · {f.code} · {f.label}</option>)}</optgroup>
        </select>
        <button type="button" disabled={!sourceId || importing || !projectId} onClick={() => void importSource()}>{importing ? 'Importing…' : 'Add reference'}</button>
        <p>Imports the source identity and specifications. Confirm the physical sample, fitting compatibility and current price before approval.</p>
      </details>
      <div><strong>Assign a finish to the room</strong><p>Walls, flooring, ceiling or lighting material. Saving creates a draft revision and invalidates older approved render/quote outputs.</p></div>
      <div className="ultida-board-room-editor-fields">
        <select aria-label="Room material role" value={roomFinishSlot} onChange={e=>setRoomFinishSlot(e.target.value as typeof roomFinishSlot)}>
          <option value="wall">Walls</option><option value="flooring">Flooring</option><option value="ceiling">Ceiling</option><option value="lighting">Lighting</option>
        </select>
        <select aria-label="Material library selection" value={roomMaterialId} onChange={e=>setRoomMaterialId(e.target.value)}>
          <option value="">Select verified library material…</option>
          {materials.map(m=><option key={m.id} value={m.id}>{m.name}{m.code?` · ${m.code}`:''}</option>)}
        </select>
        <button type="button" onClick={()=>void assignRoomFinish()} disabled={loading||savingRoomFinish||!roomMaterialId||!roomId||!projectId}>{savingRoomFinish?'Saving…':'Save draft finish'}</button>
      </div>
      <small>Availability in the library is not supplier approval. Confirm exact SKU, surface suitability and site conditions before construction.</small>
    </div>
    <p className="ultida-board-disclaimer">This board is a traceable design reference. A hex swatch is not a licensed manufacturer texture or a verified print color. Factory approval requires independent material and fitting validation.</p>
  </section>;
}
