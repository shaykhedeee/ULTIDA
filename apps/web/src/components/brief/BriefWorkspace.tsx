import { Check, Download, FileUp, Save, Sparkles, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Badge, Button, Card, CardContent, CardHeader } from '../ui/primitives';
import type { ClientBrief } from '../../features/project-types';
export type { ClientBrief } from '../../features/project-types';

type Props = {
  projectId: string;
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

type BriefTemplate = {
  id: string;
  name: string;
  description: string;
  values: Partial<ClientBrief>;
};

const briefTemplates: BriefTemplate[] = [
  { id: 'work-from-home-couple', name: 'Work-from-home couple', description: 'Two focused work zones, calm shared spaces, and concealed storage.', values: { propertyType: 'Apartment', rooms: 'Living room | Kitchen | Master bedroom | Study', style: 'Minimal', budgetRange: 'INR 10-20 lakh', lifestyle: 'Work from home', storageNeeds: 'Balanced concealed storage', materials: 'Matte neutral laminates | Warm laminates' } },
  { id: 'family-of-four', name: 'Family of four in a 3BHK', description: 'Practical circulation, durable finishes, and storage for daily family life.', values: { propertyType: 'Apartment', rooms: 'Living room | Kitchen | Master bedroom | Bedroom | Dining | Utility', style: 'Contemporary', budgetRange: 'INR 10-20 lakh', lifestyle: 'Family living | Young children', storageNeeds: 'Maximum storage', materials: 'Matte neutral laminates | Stone and fluted panels' } },
  { id: 'adventurous-family', name: 'The adventurous family', description: 'Flexible hosting, display space, easy-clean materials, and adaptable storage.', values: { propertyType: 'Independent home', rooms: 'Living room | Kitchen | Master bedroom | Bedroom | Study | Dining | Utility', style: 'Modern classic', budgetRange: 'INR 20-40 lakh', lifestyle: 'Family living | Frequent hosting | Pets at home', storageNeeds: 'Balanced concealed storage', materials: 'Warm laminates | Stone and fluted panels | Glass and metal accents' } },
  { id: 'best-without-compromise', name: 'Best without compromise', description: 'Premium detailing, tailored modular units, and material-led visual direction.', values: { propertyType: 'Villa', rooms: 'Living room | Kitchen | Master bedroom | Bedroom | Study | Pooja | Dining | Utility', style: 'Modern classic', budgetRange: 'Above INR 40 lakh', lifestyle: 'Family living | Frequent hosting', storageNeeds: 'Maximum storage', materials: 'Wood veneer | Stone and fluted panels | Glass and metal accents', vastuPreference: 'Follow vastu principles' } }
];

export function BriefWorkspace({ projectId, initialBrief, fileName, status, onSave, onFile, onAnalyze }: Props) {
  const [brief, setBrief] = useState(initialBrief);
  const [state, setState] = useState('');
  const [editing, setEditing] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setBrief(initialBrief), [initialBrief]);
  const update = (key: keyof ClientBrief, value: string) => setBrief((current) => ({ ...current, [key]: value }));
  const applyTemplate = (template: BriefTemplate) => {
    setBrief((current) => ({ ...current, ...template.values }));
    setState(template.name + ' applied. You can adjust the core project details before saving.');
  };
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
  async function downloadBrief() {
    setState('Preparing project brief PDF...');
    try {
      const { supabase } = await import('../../lib/supabase');
      const token = (await supabase?.auth.getSession())?.data.session?.access_token;
      if (!token) throw new Error('Sign in again before downloading the brief.');
      const apiBase = String(import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
      const response = await fetch(`${apiBase}/projects/${projectId}/brief.pdf`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) { const error = await response.json().catch(() => null); throw new Error(error?.message ?? 'Brief PDF could not be created.'); }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a'); link.href = url; link.download = `ultida-${projectId}-brief.pdf`; link.click(); URL.revokeObjectURL(url);
      setState('Brief PDF downloaded.');
    } catch (error) { setState(error instanceof Error ? error.message : 'Brief PDF could not be created.'); }
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
            <div className="brief-choice-field">
              <span>Start with a household profile</span>
              <div className="brief-choice-grid">
                {briefTemplates.map((template) => (
                  <button key={template.id} type="button" disabled={!editing} className="brief-choice" onClick={() => applyTemplate(template)} title={template.description}>
                    <Sparkles size={14} />
                    <span>{template.name}</span>
                  </button>
                ))}
              </div>
              <p className="brief-template-copy">This sets a starting direction. Floor Plan and Spaces collect room-specific requirements after geometry is available.</p>
            </div>
            <div className="brief-grid">
              {field('clientName', 'Client name', 'e.g. Mehta family')}
              {field('projectName', 'Project name', 'e.g. Mehta Residence')}
              {field('propertyType', 'Property type', 'Apartment, villa, office...', ['Apartment','Villa','Independent home','Office','Retail'] as PropertyOption[])}
              {choiceField('rooms', 'Rooms in scope', roomOptions, true)}
              {field('style', 'Preferred style', 'e.g. warm contemporary Indian', ['Contemporary','Minimal','Modern classic','Traditional','Japandi','Industrial'] as StyleOption[])}
              {field('budgetRange', 'Budget range', 'e.g. INR 12-18 lakh', ['Under INR 5 lakh','INR 5-10 lakh','INR 10-20 lakh','INR 20-40 lakh','Above INR 40 lakh'] as BudgetOption[])}
            </div>
            <div className="brief-actions">
              <Button variant="outline" onClick={() => void save(false)} disabled={!editing}><Save size={16} /> Save draft</Button>
              <Button onClick={() => void save(true)} disabled={!editing || !valid}><Sparkles size={16} /> Complete brief</Button>
              {!editing && <Button variant="outline" onClick={() => setEditing(true)}>Edit brief</Button>}
              {!editing && <Button variant="outline" onClick={() => void downloadBrief()}><Download size={16} /> Download brief PDF</Button>}
              <span role="status">{state}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="side-panel">
          <small>ATTACHMENT</small>
          <FileUp size={24}/>
          <h2>Attach Floor Plan</h2>
          <p>Attach the source, then open Guided Plan to calibrate or outline rough rooms before analysis.</p>
          <div 
            onClick={() => fileInputRef.current?.click()} 
            className="dropzone" 
            style={{ cursor: 'pointer', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', border: '2px dashed #bfae9c', borderRadius: '8px', background: '#fbf6ef' }}
          >
            <Upload size={24} style={{ color: '#8a7762' }} />
            <strong style={{ color: '#4d3428' }}>{fileName ? fileName : 'Click to select floor plan'}</strong>
            <span style={{ fontSize: '12px', color: '#746b62' }}>Images, SVG and PDF (up to 25 MB)</span>
            <input 
              ref={fileInputRef}
              type="file" 
              accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,image/tiff,image/avif,image/heic,image/heif,image/svg+xml,application/pdf,.tif,.tiff,.heic,.heif" 
              onChange={onFile} 
              style={{ display: 'none' }}
            />
          </div>
          {status && <p className="inline-message" role="status" style={{ fontSize: '12px', margin: '8px 0' }}>{status}</p>}
          {onAnalyze && fileName && (
            <Button variant="outline" className="full" onClick={onAnalyze} style={{ marginTop: '8px' }}>
              Open Guided Plan
            </Button>
          )}
        </Card>
      </div>
    </section>
  );
}
