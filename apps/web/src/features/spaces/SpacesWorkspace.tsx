/* ═══════════════════════════════════════════════
   SPACES WORKSPACE — Room Identification & Settings
═══════════════════════════════════════════════ */

import {
  Home, CheckCircle2, Circle, Edit3, ArrowRight, AlertTriangle,
  Plus, Settings2, Sparkles, Layers, Sliders, Check, Wand2
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge, Button } from '../../components/ui/primitives';
import { supabase } from '../../lib/supabase';
import './spaces.css';

// ─── Types ────────────────────────────────────────────────────────
export type SpaceRoom = {
  id: string;
  name: string;
  roomType: 'living' | 'bedroom' | 'kitchen' | 'dining' | 'utility' | 'pooja' | 'bathroom' | 'other';
  areaSqm: number;
  dimensionsText: string;
  ceilingHeightMm: number;
  usableWalls: number;
  floorFinish: string;
  falseCeiling: string;
  requiredFurniture: string[];
  budgetInr?: number;
  isConfigured: boolean;
};

const ROOM_TYPES = [
  { id: 'living', label: 'Living Room' },
  { id: 'bedroom', label: 'Bedroom' },
  { id: 'kitchen', label: 'Kitchen' },
  { id: 'dining', label: 'Dining Room' },
  { id: 'utility', label: 'Utility Room' },
  { id: 'pooja', label: 'Pooja Room' },
  { id: 'bathroom', label: 'Bathroom' },
  { id: 'other', label: 'Other' },
];

const FURNITURE_OPTIONS: Record<string, string[]> = {
  living: ['TV Unit', 'Crockery Unit', 'Sofa', 'Display Storage', 'Pooja Shrine', 'Shoe Rack'],
  bedroom: ['Wardrobe (Hinged)', 'Wardrobe (Sliding)', 'Bed Unit', 'Study Desk', 'Dresser', 'TV Unit'],
  kitchen: ['L-Shape Cabinets', 'Parallel Cabinets', 'Tall Pantry', 'Appliance Tower', 'Breakfast Counter'],
  dining: ['Crockery Cabinet', 'Dining Table', 'Bar Unit', 'Wash Basin Vanity'],
  pooja: ['Pooja Shrine', 'Drawer Console', 'Jaali Backdrop'],
  other: ['Storage Unit', 'Study Unit', 'Utility Counter'],
};

const DEFAULT_CEILING = 2700;
const DEFAULT_FINISH = 'Vitrified Tiles';
const DEFAULT_FALSE_CEILING = 'Peripheral Cove Lighting';

function deriveDefaults(space: { roomType?: string; areaSqm?: number; budgetInr?: number }): Partial<SpaceRoom> {
  const budgetInr = typeof space.budgetInr === 'number' ? space.budgetInr : undefined;
  const areaSqm = typeof space.areaSqm === 'number' ? space.areaSqm : 0;
  const budgetPerSqm = budgetInr && areaSqm ? budgetInr / areaSqm : undefined;
  const suggestedFurniture = FURNITURE_OPTIONS[space.roomType ?? 'living'] ?? FURNITURE_OPTIONS.living;
  const recommended = budgetPerSqm && budgetPerSqm < 3500
    ? suggestedFurniture.slice(0, 2)
    : suggestedFurniture.slice(0, 4);
  return {
    ceilingHeightMm: DEFAULT_CEILING,
    floorFinish: DEFAULT_FINISH,
    falseCeiling: DEFAULT_FALSE_CEILING,
    requiredFurniture: recommended,
  };
}

export function SpacesWorkspace() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [spaces, setSpaces] = useState<SpaceRoom[]>([]);
  const [activeSpace, setActiveSpace] = useState<SpaceRoom | null>(null);
  const [saveState, setSaveState] = useState('');
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'blocked' | 'empty' | 'error'>('loading');

  // Modal form
  const [editForm, setEditForm] = useState<Partial<SpaceRoom>>({});
  const [autoApply, setAutoApply] = useState(false);

  useEffect(() => {
    if (!supabase || !projectId) return;
    let live = true;
    void (async () => {
      setLoadState('loading');
      const session = (await supabase.auth.getSession()).data.session;
      if (!session?.access_token) { if (live) { setLoadState('error'); setSaveState('Your session expired. Sign in again.'); } return; }
      const apiBase = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8800/api';
      const response = await fetch(`${apiBase}/projects/${projectId}/spaces`, { headers: { 'Content-Type': 'application/json', authorization: `Bearer ${session.access_token}` } });
      const payload = await response.json().catch(() => null);
      if (!live) return;
      if (!response.ok) {
        setLoadState(response.status === 409 ? 'blocked' : 'error');
        setSaveState(payload?.message ?? 'Spaces could not be loaded.');
        return;
      }
      const mapped = (payload.spaces ?? []).map((row: any): SpaceRoom => {
        const requirements = row.requirements_json ?? {};
        const settings = row.settings_json ?? {};
        return {
          id: row.id,
          name: row.name,
          roomType: row.room_type,
          areaSqm: Number(row.area_sqm ?? 0),
          dimensionsText: requirements.dimensionsText ?? 'Measured from approved plan',
          ceilingHeightMm: Number(row.ceiling_height_mm ?? 0),
          usableWalls: Number(requirements.usableWalls ?? 0),
          floorFinish: settings.floorFinish ?? 'Not specified',
          falseCeiling: settings.falseCeiling ?? 'Not specified',
          requiredFurniture: Array.isArray(requirements.requiredFurniture) ? requirements.requiredFurniture : [],
          budgetInr: typeof requirements.budgetInr === 'number' ? requirements.budgetInr : undefined,
          isConfigured: row.status === 'configured' && row.verification_status === 'verified'
        };
      });
      setSpaces(mapped);
      setLoadState(mapped.length ? 'ready' : 'empty');
      if (!mapped.length) setSaveState('The approved plan contains no derived spaces. Return to Floor Plan Intelligence and review room polygons.');
    })();
    return () => { live = false; };
  }, [projectId]);

  function openEditModal(space: SpaceRoom) {
    setActiveSpace(space);
    setEditForm({ ...space });
  }

  async function saveSpaceEdit() {
    if (!activeSpace) return;
    const nextSpace = { ...activeSpace, ...editForm, isConfigured: true } as SpaceRoom;
    if (supabase && projectId) {
      setSaveState('Saving space...');
      const session = (await supabase.auth.getSession()).data.session;
      if (!session?.access_token) { setSaveState('Your session expired. Sign in again.'); return; }
      const apiBase = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8800/api';
      const response = await fetch(`${apiBase}/projects/${projectId}/spaces/${activeSpace.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ name: nextSpace.name, roomType: nextSpace.roomType, ceilingHeightMm: nextSpace.ceilingHeightMm, requiredFurniture: nextSpace.requiredFurniture, floorFinish: nextSpace.floorFinish, falseCeiling: nextSpace.falseCeiling, budgetInr: nextSpace.budgetInr })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setSaveState(payload?.message ?? 'Space requirements could not be saved.');
        return;
      }
      setSaveState('Space saved.');
    }
    setSpaces((prev) => prev.map((s) => (s.id === activeSpace.id ? nextSpace : s)));
    setActiveSpace(null);
  }

  function toggleFurniture(item: string) {
    const current = editForm.requiredFurniture ?? [];
    const next = current.includes(item) ? current.filter((x) => x !== item) : [...current, item];
    setEditForm({ ...editForm, requiredFurniture: next });
  }

  async function handleApproveSpaces() {
    if (!spaces.length || spaces.some((space) => !space.isConfigured || !space.requiredFurniture.length)) {
      setSaveState('Configure every space and its required furniture before approving.');
      return;
    }
    if (supabase && projectId) {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session?.access_token) { setSaveState('Your session expired. Sign in again.'); return; }
      const apiBase = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8800/api';
      const response = await fetch(`${apiBase}/projects/${projectId}/spaces/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json', authorization: `Bearer ${session.access_token}` } });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setSaveState(payload?.message ?? 'Spaces could not be approved.');
        return;
      }
    }
    navigate(`/projects/${projectId}/layouts`);
  }

  return (
    <div className="spaces-workspace">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-text">
          <small>Phase 3 — Space Identification & Requirements</small>
          <h1>Configured Spaces ({spaces.length})</h1>
          <p>
            Review each room detected from your floor plan. Configure ceiling height, floor finish, and specific modular furniture requirements before generating layouts.
          </p>
        </div>
        <div className="page-header-actions">
          <button
            onClick={handleApproveSpaces}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 20px',
              background: 'var(--gold)', color: '#fff', border: 0, borderRadius: 8,
              fontSize: 14, fontWeight: 800, cursor: 'pointer'
            }}
          >
            Approve Spaces & Open Layout Studio →
          </button>
        </div>
      </div>
      {saveState && <p role="status" style={{ margin: '0 0 16px', color: saveState.includes('saved') ? 'var(--success)' : 'var(--danger)', fontSize: 13 }}>{saveState}</p>}

      {loadState === 'loading' && <div className="spaces-empty"><Layers size={22} /><strong>Loading approved plan spaces...</strong></div>}
      {loadState === 'blocked' && <div className="spaces-empty"><AlertTriangle size={22} /><strong>Floor Plan approval required</strong><Button variant="outline" onClick={() => navigate(`/projects/${projectId}/plan`)}>Open Floor Plan Intelligence</Button></div>}
      {loadState === 'empty' && <div className="spaces-empty"><Home size={22} /><strong>No valid room polygons were derived</strong><Button variant="outline" onClick={() => navigate(`/projects/${projectId}/plan`)}>Review plan geometry</Button></div>}

      {/* Room Cards Grid */}
      <div className="spaces-grid">
        {spaces.map((space) => {
          const isReady = space.isConfigured && space.requiredFurniture.length > 0;
          return (
            <div key={space.id} className="space-card">
              <div className="space-card-header">
                <div>
                  <div className="space-title-row">
                    <h3>{space.name}</h3>
                    <span className="space-type-badge">{space.roomType}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {space.dimensionsText} • {areaSqmText(space)}
                  </div>
                </div>
                <Badge tone={isReady ? 'success' : 'warn'}>
                  {isReady ? 'Ready for Layout' : 'Config Incomplete'}
                </Badge>
              </div>

              {/* Metrics */}
              <div className="space-metrics-row">
                <div className="space-metric-item">
                  <small>Ceiling Ht</small>
                  <strong>{space.ceilingHeightMm} mm</strong>
                </div>
                <div className="space-metric-item">
                  <small>Usable Walls</small>
                  <strong>{space.usableWalls} walls</strong>
                </div>
                <div className="space-metric-item">
                  <small>Floor Finish</small>
                  <strong>{space.floorFinish.split(' ')[0]}</strong>
                </div>
              </div>

              {/* Readiness Checklist */}
              <div className="readiness-box">
                <div className="readiness-title">Space Readiness Check</div>
                <div className="readiness-list">
                  <div className="readiness-item checked">
                    <CheckCircle2 size={13} /> Scale Confirmed (mm)
                  </div>
                  <div className="readiness-item checked">
                    <CheckCircle2 size={13} /> Boundaries & Openings Confirmed
                  </div>
                  <div className={`readiness-item${space.ceilingHeightMm ? ' checked' : ''}`}>
                    {space.ceilingHeightMm ? <CheckCircle2 size={13} /> : <Circle size={13} />} Ceiling Height ({space.ceilingHeightMm} mm)
                  </div>
                  <div className={`readiness-item${space.requiredFurniture.length > 0 ? ' checked' : ''}`}>
                    {space.requiredFurniture.length > 0 ? <CheckCircle2 size={13} /> : <Circle size={13} />} Furniture Requirements ({space.requiredFurniture.length} items)
                  </div>
                </div>
              </div>

              {/* Furniture List Tags */}
              <div>
                <small style={{ marginBottom: 4 }}>Suggested modules</small>
                <div className="furniture-tags">
                  {space.requiredFurniture.map((f, i) => (
                    <span key={i} className="furniture-tag">{f}</span>
                  ))}
                </div>
              </div>

              {/* Card Actions */}
              <div className="space-actions">
                <button className="space-btn" onClick={() => openEditModal(space)}>
                  <Edit3 size={13} /> Configure Room
                </button>
                <button
                  className="space-btn primary"
                  onClick={() => navigate(`/projects/${projectId}/layouts`)}
                >
                  Open Layout Studio →
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Room Modal */}
      {activeSpace && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setActiveSpace(null)}>
          <div className="modal-card" style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <div>
                <small>Configure Space</small>
                <h2>{activeSpace.name} Settings</h2>
              </div>
              <button className="modal-close" onClick={() => setActiveSpace(null)}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-grid-2">
                <div className="form-field">
                  <label>Room Name</label>
                  <input
                    type="text"
                    value={editForm.name ?? ''}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  />
                </div>
                <div className="form-field">
                  <label>Room Type</label>
                  <select
                    value={editForm.roomType ?? 'living'}
                    onChange={(e) => setEditForm({ ...editForm, roomType: e.target.value as any })}
                  >
                    {ROOM_TYPES.map((rt) => (
                      <option key={rt.id} value={rt.id}>{rt.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label>Ceiling Height (mm)</label>
                  <input
                    type="number"
                    value={editForm.ceilingHeightMm ?? DEFAULT_CEILING}
                    onChange={(e) => setEditForm({ ...editForm, ceilingHeightMm: parseInt(e.target.value, 10) || DEFAULT_CEILING })}
                  />
                </div>
                <div className="form-field">
                  <label>Floor Finish</label>
                  <input
                    type="text"
                    value={editForm.floorFinish ?? DEFAULT_FINISH}
                    onChange={(e) => setEditForm({ ...editForm, floorFinish: e.target.value })}
                    placeholder="e.g. Vitrified Tiles"
                  />
                </div>

                <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                  <label>False Ceiling Type</label>
                  <select
                    value={editForm.falseCeiling ?? DEFAULT_FALSE_CEILING}
                    onChange={(e) => setEditForm({ ...editForm, falseCeiling: e.target.value })}
                  >
                    <option value="Peripheral Cove Lighting">Peripheral Cove Lighting</option>
                    <option value="Flat Gypsum Board">Flat Gypsum Board</option>
                    <option value="Tray / Island Ceiling">Tray / Island Ceiling</option>
                    <option value="Coffered Wooden Ceiling">Coffered Wooden Ceiling</option>
                    <option value="No False Ceiling (Exposed Slates)">No False Ceiling</option>
                  </select>
                </div>
              </div>

              {/* Smart Recommendations */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button type="button" onClick={() => setAutoApply((v) => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 7, border: '1px solid var(--line)', background: autoApply ? 'rgba(197,156,45,.12)' : 'var(--surface)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  <Wand2 size={13} /> Recommend modules
                </button>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Suggests a starting furniture set from the brief.</span>
              </div>

              {/* Furniture selector */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                  Required Furniture Modules
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                  {(FURNITURE_OPTIONS[editForm.roomType ?? 'living'] ?? FURNITURE_OPTIONS.living).map((item) => {
                    const selected = (editForm.requiredFurniture ?? []).includes(item);
                    const recommended = autoApply && deriveDefaults(editForm).requiredFurniture?.includes(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => toggleFurniture(item)}
                        style={{
                          padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          border: recommended ? '1px solid var(--gold)' : selected ? '1px solid var(--gold)' : '1px solid var(--line)',
                          background: recommended ? 'rgba(197,156,45,.18)' : selected ? 'rgba(197,156,45,.15)' : 'var(--surface)',
                          color: recommended ? 'var(--gold-dim)' : selected ? 'var(--gold-dim)' : 'var(--text-secondary)'
                        }}
                      >
                        {selected && <Check size={11} style={{ display: 'inline', marginRight: 4 }} />}
                        {item}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button className="btn-primary" onClick={saveSpaceEdit} style={{ marginTop: 10 }}>
                Save Space Settings →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function areaSqmText(space: SpaceRoom) {
  if (!space.areaSqm) return '0 m²';
  return `${space.areaSqm} m²`;
}
