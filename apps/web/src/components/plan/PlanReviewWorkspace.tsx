import { Check, Crosshair, Download, MousePointer2, PanelsTopLeft, Ruler, SquareDashedMousePointer, Undo2, Wand2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge, Button, Card, CardContent, CardHeader } from '../ui/primitives';

type Point = { x: number; y: number };
type Wall = { id: string; start: Point; end: Point };
type Zone = { id: string; x: number; y: number; name: string };
type Opening = { id: string; x: number; y: number; kind: 'door' | 'window' };
type Dimension = { id: string; start: Point; end: Point; mm: number };
type Intent = { id: string; x: number; y: number; label: string };
export type ReviewSnapshot = { walls: Wall[]; zones: Zone[]; openings: Opening[]; dimensions: Dimension[]; intents: Intent[]; scaleMmPerUnit: number };
type Proposal = { id: string; kind: string; confidence: number; status: string; note: string };
type Tool = 'select' | 'wall' | 'zone' | 'opening' | 'dimension' | 'intent' | 'calibrate';
type Props = { fileName?: string; preview: string | null; status: string; analysed: boolean; proposals?: Proposal[]; onFile: (event: React.ChangeEvent<HTMLInputElement>) => void; onAnalyze: () => void; onApprove: (snapshot: ReviewSnapshot) => void; };
const toolLabels: Record<Tool, string> = { select: 'Select', wall: 'Wall', zone: 'Room zone', opening: 'Door / window', dimension: 'Dimension', intent: 'Design intent', calibrate: 'Calibrate' };

export function PlanReviewWorkspace({ fileName, preview, status, analysed, proposals = [], onFile, onAnalyze, onApprove }: Props) {
  const [tool, setTool] = useState<Tool>('select');
  const [pendingPoint, setPendingPoint] = useState<Point | null>(null);
  const [walls, setWalls] = useState<Wall[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [openings, setOpenings] = useState<Opening[]>([]);
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [intents, setIntents] = useState<Intent[]>([]);
  const [calibration, setCalibration] = useState<Point[]>([]);
  const [knownLength, setKnownLength] = useState('3000');
  const [scale, setScale] = useState<number | null>(null);
  const [notice, setNotice] = useState('Upload a plan, run intake, then review or draw the measured geometry.');
  const canApprove = analysed && Boolean(scale) && (walls.length > 0 || zones.length > 0);
  const proposalState = useMemo(() => analysed ? `${proposals.length} proposals ready for review` : 'No proposals until plan intake runs', [analysed, proposals.length]);

  function pointerToPlan(event: React.MouseEvent<SVGSVGElement>) { const rect = event.currentTarget.getBoundingClientRect(); return { x: ((event.clientX - rect.left) / rect.width) * 1000, y: ((event.clientY - rect.top) / rect.height) * 1000 }; }
  function handleCanvasClick(event: React.MouseEvent<SVGSVGElement>) {
    if (!preview) return setNotice('Choose an image floor plan before editing.');
    const point = pointerToPlan(event);
    if (tool === 'wall') { if (!pendingPoint) { setPendingPoint(point); setNotice('Click the other end of the wall.'); return; } setWalls((items) => [...items, { id: crypto.randomUUID(), start: pendingPoint, end: point }]); setPendingPoint(null); setNotice('Wall added. Continue drawing or switch tools.'); return; }
    if (tool === 'zone') { const name = window.prompt('Room name', `Room ${zones.length + 1}`)?.trim(); if (!name) return; setZones((items) => [...items, { id: crypto.randomUUID(), x: Math.max(0, point.x - 85), y: Math.max(0, point.y - 60), name }]); setNotice('Room zone added.'); return; }
    if (tool === 'opening') { const kind = window.prompt('Opening type: door or window', 'door')?.trim().toLowerCase(); if (kind !== 'door' && kind !== 'window') return setNotice('Opening must be a door or window.'); setOpenings((items) => [...items, { id: crypto.randomUUID(), x: point.x, y: point.y, kind }]); setNotice(`${kind} opening added.`); return; }
    if (tool === 'intent') { const label = window.prompt('Design intent', 'Kitchen run')?.trim(); if (!label) return; setIntents((items) => [...items, { id: crypto.randomUUID(), x: point.x, y: point.y, label }]); setNotice('Design intent marker added.'); return; }
    if (tool === 'dimension') { if (!pendingPoint) { setPendingPoint(point); setNotice('Click the other end of the measured dimension.'); return; } const mm = Number(window.prompt('Measured length in millimetres', '3000')); if (!mm || mm <= 0) return setNotice('Enter a positive dimension.'); setDimensions((items) => [...items, { id: crypto.randomUUID(), start: pendingPoint, end: point, mm }]); setPendingPoint(null); setNotice('Dimension added.'); return; }
    if (tool === 'calibrate') { const next = [...calibration, point].slice(-2); setCalibration(next); if (next.length === 2) { const pixelDistance = Math.hypot(next[1].x - next[0].x, next[1].y - next[0].y); const value = Number(knownLength); if (!pixelDistance || !value) return setNotice('Enter a valid known wall length in millimetres.'); setScale(value / pixelDistance); setNotice(`Scale calibrated from ${Math.round(value)} mm known wall.`); } else setNotice('Click the other end of a known wall.'); }
  }
  function undo() { if (intents.length) return setIntents((items) => items.slice(0, -1)); if (dimensions.length) return setDimensions((items) => items.slice(0, -1)); if (openings.length) return setOpenings((items) => items.slice(0, -1)); if (walls.length) return setWalls((items) => items.slice(0, -1)); if (zones.length) setZones((items) => items.slice(0, -1)); }
  function approve() { if (!scale) return; onApprove({ walls, zones, openings, dimensions, intents, scaleMmPerUnit: scale }); }
  function exportDraft() {
    const snapshot: ReviewSnapshot = { walls, zones, openings, dimensions, intents, scaleMmPerUnit: scale ?? 0 };
    const blob = new Blob([JSON.stringify({ fileName, status, snapshot }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(fileName ?? 'floor-plan').replace(/\.[^.]+$/, '')}-review.json`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice('Review draft exported. Your source file remains unchanged.');
  }

  return <section className="plan-review-workspace">
    <div className="workspace-heading"><div><small>PLAN INTELLIGENCE / REVIEW</small><h2>Make the plan trustworthy before design begins.</h2><p>The source stays visible. Automation proposes; the designer confirms the measured truth.</p></div><Badge tone={canApprove ? 'success' : 'accent'}>{canApprove ? 'Ready for approval' : 'Review required'}</Badge></div>
    <div className="plan-review-layout">
      <Card className="plan-tool-rail"><CardHeader><small>TOOLS</small><h3>Draft on top of the source</h3></CardHeader><CardContent>{(Object.keys(toolLabels) as Tool[]).map((item) => <Button key={item} variant={tool === item ? 'default' : 'outline'} className="tool-button" onClick={() => { setTool(item); setPendingPoint(null); }}>{item === 'select' ? <MousePointer2 size={16}/> : item === 'wall' ? <PanelsTopLeft size={16}/> : item === 'zone' ? <SquareDashedMousePointer size={16}/> : <Ruler size={16}/>} {toolLabels[item]}</Button>)}<div className="calibration-control"><label>Known wall length (mm)<input value={knownLength} type="number" min="1" onChange={(event) => setKnownLength(event.target.value)} /></label><span>{scale ? `${Math.round(scale * 100) / 100} mm per plan unit` : 'Use Calibrate, then click both wall ends.'}</span></div><Button variant="outline" className="tool-button" onClick={undo}><Undo2 size={16}/> Undo last</Button><Button variant="outline" className="tool-button" onClick={onAnalyze} disabled={!fileName}><Wand2 size={16}/> {analysed ? 'Refresh proposals' : 'Run plan intake'}</Button></CardContent></Card>
      <Card className="plan-canvas-card"><CardHeader className="canvas-header"><div><small>SOURCE + REVIEW LAYER</small><h3>{fileName ?? 'No floor plan selected'}</h3></div><Badge>{toolLabels[tool]}</Badge></CardHeader><CardContent><div className="canvas-frame">{preview ? <><img src={preview} alt="Floor plan source" /><svg viewBox="0 0 1000 1000" aria-label="Editable floor plan review canvas" onClick={handleCanvasClick}>{walls.map((wall) => <line key={wall.id} x1={wall.start.x} y1={wall.start.y} x2={wall.end.x} y2={wall.end.y} className="review-wall" />)}{pendingPoint && <circle cx={pendingPoint.x} cy={pendingPoint.y} r="8" className="review-pending" />}{zones.map((zone) => <g key={zone.id}><rect x={zone.x} y={zone.y} width="170" height="120" className="review-zone"/><text x={zone.x + 12} y={zone.y + 28} className="review-zone-label">{zone.name}</text></g>)}{calibration.map((point) => <circle key={`${point.x}-${point.y}`} cx={point.x} cy={point.y} r="9" className="review-calibration" />)}{calibration.length === 2 && <line x1={calibration[0].x} y1={calibration[0].y} x2={calibration[1].x} y2={calibration[1].y} className="review-calibration-line" />}</svg></> : <div className="canvas-empty"><Crosshair size={28}/><p>Choose a PNG or JPEG plan to start the review canvas.</p><label><span>Choose plan</span><input type="file" accept="image/png,image/jpeg,application/pdf" onChange={onFile}/></label></div>}</div><p className="canvas-notice">{notice} {status}</p></CardContent></Card>
      <Card className="plan-review-rail"><CardHeader><small>REVIEW QUEUE</small><h3>{proposalState}</h3></CardHeader><CardContent><div className="review-metric"><span>Manual walls</span><strong>{walls.length}</strong></div><div className="review-metric"><span>Room zones</span><strong>{zones.length}</strong></div><div className="review-metric"><span>Openings / dimensions</span><strong>{openings.length} / {dimensions.length}</strong></div><div className="review-metric"><span>Scale</span><strong>{scale ? 'Set' : 'Required'}</strong></div><div className="proposal-box"><Badge tone={analysed ? 'accent' : 'neutral'}>{analysed ? '0 automatic proposals' : 'Waiting for intake'}</Badge><p>{analysed ? 'AI/CV proposals will appear here with confidence and a review action. Manual items are retained independently.' : 'Run plan intake after uploading to prepare the source for detection.'}</p></div><Button className="full" disabled={!canApprove} onClick={approve}><Check size={16}/> Approve reviewed plan</Button><Button variant="outline" className="full"><Download size={16}/> Export review draft</Button></CardContent></Card>
    </div>
  </section>;
}
