import { Check, FileUp, Save, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Badge, Button, Card, CardContent, CardHeader } from '../ui/primitives';

export type ClientBrief = {
  clientName: string; projectName: string; propertyType: string; rooms: string;
  lifestyle: string; storageNeeds: string; kitchenRequirements: string; style: string;
  materials: string; budgetRange: string; timeline: string; appliancesServices: string;
  vastuPreference: string; referenceAssets: string; approvalNotes: string;
};

export const emptyBrief: ClientBrief = { clientName: '', projectName: '', propertyType: '', rooms: '', lifestyle: '', storageNeeds: '', kitchenRequirements: '', style: '', materials: '', budgetRange: '', timeline: '', appliancesServices: '', vastuPreference: '', referenceAssets: '', approvalNotes: '' };

type Props = {
  initialBrief: ClientBrief;
  fileName?: string;
  status?: string;
  onSave: (brief: ClientBrief) => Promise<void>;
  onFile?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onAnalyze?: () => void;
};

export function BriefWorkspace({ initialBrief, fileName, status, onSave, onFile, onAnalyze }: Props) {
  const [brief, setBrief] = useState(initialBrief);
  const [state, setState] = useState('');
  const [editing, setEditing] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setBrief(initialBrief), [initialBrief]);
  const update = (key: keyof ClientBrief, value: string) => setBrief((current) => ({ ...current, [key]: value }));
  const valid = brief.clientName.trim() && brief.projectName.trim() && brief.propertyType && brief.rooms.trim() && brief.budgetRange && brief.timeline;
  const summary = [brief.propertyType, brief.rooms && `${brief.rooms} rooms`, brief.style, brief.budgetRange].filter(Boolean).join(' | ') || 'Complete the brief to create a useful project summary.';
  async function save() { if (!valid) { setState('Add client, project, property, rooms, budget and timeline before saving.'); return; } setState('Saving brief...'); try { await onSave(brief); setState('Brief saved.'); setEditing(false); } catch { setState('Brief could not be saved.'); } }
  const field = (key: keyof ClientBrief, label: string, placeholder: string, wide = false, options?: string[]) => <label className={wide ? 'brief-field brief-field-wide' : 'brief-field'}>{label}{options ? <select value={brief[key]} onChange={(event) => update(key, event.target.value)} disabled={!editing}><option value="">Select an option</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select> : <input value={brief[key]} onChange={(event) => update(key, event.target.value)} placeholder={placeholder} disabled={!editing} />}</label>;
  
  return <section className="brief-workspace">
    <div className="workspace-heading">
      <div>
        <small>CLIENT BRIEF / PROJECT CONTEXT</small>
        <h2>Capture the decisions that guide the design.</h2>
        <p>A concise brief keeps the plan, scene, visuals and production outputs aligned.</p>
      </div>
      <Badge tone={valid ? 'success' : 'accent'}>{valid ? 'Ready to save' : 'Incomplete'}</Badge>
    </div>
    <div className="content-grid">
      <Card className="workflow">
        <CardHeader>
          <div>
            <small>PROJECT SUMMARY</small>
            <h3>{brief.projectName || 'Untitled project'}</h3>
          </div>
          <span className="brief-summary">{summary}</span>
        </CardHeader>
        <CardContent>
          <div className="brief-grid">
            {field('clientName', 'Client name', 'e.g. Mehta family')}
            {field('projectName', 'Project name', 'e.g. Mehta Residence')}
            {field('propertyType', 'Property type', 'Apartment, villa, office...', false, ['Apartment','Villa','Independent home','Office','Retail'])}
            {field('rooms', 'Rooms / scope', 'e.g. kitchen, living, 3 bedrooms', true)}
            {field('lifestyle', 'Lifestyle', 'How the home is used', true)}
            {field('storageNeeds', 'Storage needs', 'Wardrobes, pantry, utility, display...')}
            {field('kitchenRequirements', 'Modular kitchen', 'Layout, finish, counter, workflow', true)}
            {field('style', 'Preferred style', 'Contemporary, classic, minimal...', false, ['Contemporary','Minimal','Modern classic','Traditional','Japandi','Industrial'])}
            {field('materials', 'Preferred materials', 'Laminate, veneer, stone, hardware...')}
            {field('budgetRange', 'Budget range', 'e.g. INR 12-18 lakh', false, ['Under INR 5 lakh','INR 5-10 lakh','INR 10-20 lakh','INR 20-40 lakh','Above INR 40 lakh'])}
            {field('timeline', 'Timeline', 'e.g. design by August, install by October')}
            {field('appliancesServices', 'Appliances and services', 'Appliances, lighting, plumbing, electrical...', true)}
            {field('vastuPreference', 'Vastu preference', 'Required, preferred, not required', false, ['Required','Preferred','Not required','Discuss later'])}
            {field('referenceAssets', 'Reference assets', 'Links, filenames or shared reference notes', true)}
            {field('approvalNotes', 'Approval notes', 'Decisions, exclusions and client sign-off notes', true)}
          </div>
          <div className="brief-actions">
            <Button onClick={save} disabled={!editing}><Save size={16} /> Save brief</Button>
            {!editing && <Button variant="outline" onClick={() => setEditing(true)}>Edit brief</Button>}
            <span role="status">{state}</span>
          </div>
        </CardContent>
      </Card>
      <Card className="side-panel">
        <small>ATTACHMENT</small>
        <FileUp size={24}/>
        <h2>Attach Floor Plan</h2>
        <p>Upload a PNG, JPEG, WEBP, PDF, DXF, or DWG floor plan directly to this project.</p>
        <div 
          onClick={() => fileInputRef.current?.click()} 
          className="dropzone" 
          style={{ cursor: 'pointer', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', border: '2px dashed #bfae9c', borderRadius: '8px', background: '#fbf6ef' }}
        >
          <Upload size={24} style={{ color: '#8a7762' }} />
          <strong style={{ color: '#4d3428' }}>{fileName ? fileName : 'Click to select floor plan'}</strong>
          <span style={{ fontSize: '12px', color: '#746b62' }}>PNG, JPG, WEBP, PDF, DXF, DWG</span>
          <input 
            ref={fileInputRef}
            type="file" 
            accept="image/*,.pdf,.dxf,.dwg" 
            onChange={onFile} 
            style={{ display: 'none' }} 
          />
        </div>
        {status && <p className="inline-message" role="status" style={{ fontSize: '12px', margin: '8px 0' }}>{status}</p>}
        {onAnalyze && fileName && (
          <Button variant="outline" className="full" onClick={onAnalyze} style={{ marginTop: '8px' }}>
            Run Plan Intake & Analyze
          </Button>
        )}
      </Card>
    </div>
  </section>;
}
