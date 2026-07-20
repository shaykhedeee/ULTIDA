import { Check, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge, Button, Card, CardContent, CardHeader } from '../ui/primitives';

export type ClientBrief = {
  clientName: string; projectName: string; propertyType: string; rooms: string;
  lifestyle: string; storageNeeds: string; kitchenRequirements: string; style: string;
  materials: string; budgetRange: string; timeline: string; appliancesServices: string;
  vastuPreference: string; referenceAssets: string; approvalNotes: string;
};

export const emptyBrief: ClientBrief = { clientName: '', projectName: '', propertyType: '', rooms: '', lifestyle: '', storageNeeds: '', kitchenRequirements: '', style: '', materials: '', budgetRange: '', timeline: '', appliancesServices: '', vastuPreference: '', referenceAssets: '', approvalNotes: '' };

type Props = { initialBrief: ClientBrief; onSave: (brief: ClientBrief) => Promise<void> };

export function BriefWorkspace({ initialBrief, onSave }: Props) {
  const [brief, setBrief] = useState(initialBrief);
  const [state, setState] = useState('');
  const [editing, setEditing] = useState(true);
  useEffect(() => setBrief(initialBrief), [initialBrief]);
  const update = (key: keyof ClientBrief, value: string) => setBrief((current) => ({ ...current, [key]: value }));
  const valid = brief.clientName.trim() && brief.projectName.trim() && brief.propertyType && brief.rooms.trim() && brief.budgetRange && brief.timeline;
  const summary = [brief.propertyType, brief.rooms && `${brief.rooms} rooms`, brief.style, brief.budgetRange].filter(Boolean).join(' | ') || 'Complete the brief to create a useful project summary.';
  async function save() { if (!valid) { setState('Add client, project, property, rooms, budget and timeline before saving.'); return; } setState('Saving brief...'); try { await onSave(brief); setState('Brief saved.'); setEditing(false); } catch { setState('Brief could not be saved.'); } }
  const field = (key: keyof ClientBrief, label: string, placeholder: string, wide = false) => <label className={wide ? 'brief-field brief-field-wide' : 'brief-field'}>{label}<input value={brief[key]} onChange={(event) => update(key, event.target.value)} placeholder={placeholder} disabled={!editing} /></label>;
  return <section className="brief-workspace"><div className="workspace-heading"><div><small>CLIENT BRIEF / PROJECT CONTEXT</small><h2>Capture the decisions that guide the design.</h2><p>A concise brief keeps the plan, scene, visuals and production outputs aligned.</p></div><Badge tone={valid ? 'success' : 'accent'}>{valid ? 'Ready to save' : 'Incomplete'}</Badge></div><Card><CardHeader><div><small>PROJECT SUMMARY</small><h3>{brief.projectName || 'Untitled project'}</h3></div><span className="brief-summary">{summary}</span></CardHeader><CardContent><div className="brief-grid">{field('clientName', 'Client name', 'e.g. Mehta family')}{field('projectName', 'Project name', 'e.g. Mehta Residence')}{field('propertyType', 'Property type', 'Apartment, villa, office...')}{field('rooms', 'Rooms / scope', 'e.g. kitchen, living, 3 bedrooms', true)}{field('lifestyle', 'Lifestyle', 'How the home is used', true)}{field('storageNeeds', 'Storage needs', 'Wardrobes, pantry, utility, display...')}{field('kitchenRequirements', 'Modular kitchen', 'Layout, finish, counter, workflow', true)}{field('style', 'Preferred style', 'Contemporary, classic, minimal...')}{field('materials', 'Preferred materials', 'Laminate, veneer, stone, hardware...')}{field('budgetRange', 'Budget range', 'e.g. INR 12-18 lakh')}{field('timeline', 'Timeline', 'e.g. design by August, install by October')}{field('appliancesServices', 'Appliances and services', 'Appliances, lighting, plumbing, electrical...', true)}{field('vastuPreference', 'Vastu preference', 'Required, preferred, not required')}{field('referenceAssets', 'Reference assets', 'Links, filenames or shared reference notes', true)}{field('approvalNotes', 'Approval notes', 'Decisions, exclusions and client sign-off notes', true)}</div><div className="brief-actions"><Button onClick={save} disabled={!editing}><Save size={16} /> Save brief</Button>{!editing && <Button variant="outline" onClick={() => setEditing(true)}>Edit brief</Button>}<span role="status">{state}</span></div></CardContent></Card></section>;
}
