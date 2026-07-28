import { Check, FileUp, Save, Sparkles, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Badge, Button, Card, CardContent, CardHeader } from '../ui/primitives';

export type ClientBrief = {
  clientName: string;
  projectName: string;
  propertyType: string;
  rooms: string;
  style: string;
  budgetRange: string;
  lifestyle?: string;
  storageNeeds?: string;
  kitchenRequirements?: string;
  materials?: string;
  appliancesServices?: string;
  vastuPreference?: string;
  approvalNotes?: string;
};

export const emptyBrief: ClientBrief = { clientName: '', projectName: '', propertyType: '', rooms: '', style: '', budgetRange: '', lifestyle: '', storageNeeds: '', kitchenRequirements: '', materials: '', appliancesServices: '', vastuPreference: '', approvalNotes: '' };

type Props = {
  initialBrief: ClientBrief;
  fileName?: string;
  status?: string;
  onSave: (brief: ClientBrief, isComplete?: boolean) => Promise<void>;
  onFile?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onAnalyze?: () => void;
};

type StyleOption = 'Contemporary' | 'Minimal' | 'Modern classic' | 'Traditional' | 'Japandi' | 'Industrial';
type PropertyOption = 'Apartment' | 'Villa' | 'Independent home' | 'Office' | 'Retail';
type BudgetOption = 'Under INR 5 lakh' | 'INR 5-10 lakh' | 'INR 10-20 lakh' | 'INR 20-40 lakh' | 'Above INR 40 lakh';
const roomOptions = ['Living room', 'Kitchen', 'Master bedroom', 'Bedroom', 'Study', 'Pooja', 'Dining', 'Utility'];
const lifestyleOptions = ['Family living', 'Frequent hosting', 'Work from home', 'Young children', 'Pets at home', 'Rental / flexible use'];
const storageOptions = ['Minimal and open', 'Balanced concealed storage', 'Maximum storage', 'Wardrobes and dressing', 'Books and display', 'Kitchen-heavy storage'];
const materialOptions = ['Warm laminates', 'Wood veneer', 'Matte neutral laminates', 'Stone and fluted panels', 'Glass and metal accents', 'Designer to recommend'];
const vastuOptions = ['No preference', 'Follow vastu principles', 'Pooja direction matters', 'Kitchen direction matters'];

export function BriefWorkspace({ initialBrief, fileName, status, onSave, onFile, onAnalyze }: Props) {
  const [brief, setBrief] = useState(initialBrief);
  const [state, setState] = useState('');
  const [editing, setEditing] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setBrief(initialBrief), [initialBrief]);
  const update = (key: keyof ClientBrief, value: string) => setBrief((current) => ({ ...current, [key]: value }));
  const valid = brief.clientName.trim() && brief.projectName.trim() && brief.propertyType && brief.rooms.trim() && brief.style && brief.budgetRange;
  const summary = [brief.propertyType, brief.rooms && `${brief.rooms} rooms`, brief.style, brief.budgetRange].filter(Boolean).join(' | ') || 'Complete the brief to create a useful project summary.';
  async function save(isComplete: boolean) {
    if (isComplete && !valid) { setState('Choose the property, rooms, style and budget, then complete the brief.'); return; }
    setState(isComplete ? 'Completing brief...' : 'Saving draft...');
    try {
      await onSave(brief, isComplete);
      setState(isComplete ? 'Brief completed.' : 'Draft saved.');
      if (isComplete) setEditing(false);
    } catch (error) {
      setState(error instanceof Error ? error.message : 'Brief could not be saved.');
    }
  }
  const field = (key: keyof ClientBrief, label: string, placeholder: string, options?: readonly string[]) => (
    <label className="brief-field">
      <span>{label}</span>
      {options ? (
        <select value={brief[key]} onChange={(event) => update(key, event.target.value)} disabled={!editing}>
          <option value="">Select an option</option>
          {(options as readonly string[]).map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      ) : (
        <input value={brief[key]} onChange={(event) => update(key, event.target.value)} placeholder={placeholder} disabled={!editing} />
      )}
    </label>
  );
  const choiceField = (key: keyof ClientBrief, label: string, options: readonly string[], multiple = false) => {
    const selected = String(brief[key] ?? '').split('|').map((value) => value.trim()).filter(Boolean);
    return <div className="brief-choice-field"><span>{label}</span><div className="brief-choice-grid">{options.map((option) => {
      const active = selected.includes(option);
      return <button key={option} type="button" disabled={!editing} className={active ? 'brief-choice active' : 'brief-choice'} onClick={() => {
        const next = multiple ? (active ? selected.filter((value) => value !== option) : [...selected, option]) : [option];
        update(key, next.join(' | '));
      }} aria-pressed={active}><Check size={14} />{option}</button>;
    })}</div></div>;
  };

  return (
    <section className="brief-workspace">
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
              {field('propertyType', 'Property type', 'Apartment, villa, office...', ['Apartment','Villa','Independent home','Office','Retail'] as PropertyOption[])}
              {choiceField('rooms', 'Rooms in scope', roomOptions, true)}
              {field('style', 'Preferred style', 'e.g. warm contemporary Indian', ['Contemporary','Minimal','Modern classic','Traditional','Japandi','Industrial'] as StyleOption[])}
              {field('budgetRange', 'Budget range', 'e.g. INR 12-18 lakh', ['Under INR 5 lakh','INR 5-10 lakh','INR 10-20 lakh','INR 20-40 lakh','Above INR 40 lakh'] as BudgetOption[])}
              {choiceField('lifestyle', 'How will the home be used?', lifestyleOptions, true)}
              {choiceField('storageNeeds', 'Storage priority', storageOptions)}
              {choiceField('materials', 'Material direction', materialOptions, true)}
              {choiceField('vastuPreference', 'Cultural / vastu preference', vastuOptions)}
            </div>
            <div className="brief-actions">
              <Button variant="outline" onClick={() => void save(false)} disabled={!editing}><Save size={16} /> Save draft</Button>
              <Button onClick={() => void save(true)} disabled={!editing || !valid}><Sparkles size={16} /> Complete brief</Button>
              {!editing && <Button variant="outline" onClick={() => setEditing(true)}>Edit brief</Button>}
              <span role="status">{state}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="side-panel">
          <small>ATTACHMENT</small>
          <FileUp size={24}/>
          <h2>Attach Floor Plan</h2>
          <p>Attach the source now. Analysis starts only when you explicitly request it.</p>
          <div 
            onClick={() => fileInputRef.current?.click()} 
            className="dropzone" 
            style={{ cursor: 'pointer', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', border: '2px dashed #bfae9c', borderRadius: '8px', background: '#fbf6ef' }}
          >
            <Upload size={24} style={{ color: '#8a7762' }} />
            <strong style={{ color: '#4d3428' }}>{fileName ? fileName : 'Click to select floor plan'}</strong>
            <span style={{ fontSize: '12px', color: '#746b62' }}>PNG, JPG, WEBP, PDF</span>
            <input 
              ref={fileInputRef}
              type="file" 
              accept="image/png,image/jpeg,image/webp,application/pdf" 
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
    </section>
  );
}
