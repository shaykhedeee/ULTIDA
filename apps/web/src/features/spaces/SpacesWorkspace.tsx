/* ═══════════════════════════════════════════════
   SPACES WORKSPACE — Room Identification & Settings
═══════════════════════════════════════════════ */

import {
  Home, CheckCircle2, Circle, Edit3, ArrowRight,
  Plus, Settings2, Sparkles, Layers, Sliders, Check
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

const DEFAULT_SPACES: SpaceRoom[] = [
  {
    id: 'space-living',
    name: 'Living Room',
    roomType: 'living',
    areaSqm: 19.8,
    dimensionsText: '5.2m × 3.8m',
    ceilingHeightMm: 2700,
    usableWalls: 3,
    floorFinish: 'Vitrified Tiles (800×800)',
    falseCeiling: 'Peripheral Cove Lighting',
    requiredFurniture: ['TV Unit', 'Crockery Unit', 'Sofa', 'Pooja Unit'],
    budgetInr: 350000,
    isConfigured: true,
  },
  {
    id: 'space-bed',
    name: 'Master Bedroom',
    roomType: 'bedroom',
    areaSqm: 14.4,
    dimensionsText: '4.2m × 3.4m',
    ceilingHeightMm: 2700,
    usableWalls: 3,
    floorFinish: 'Laminated Wooden Flooring',
    falseCeiling: 'Flat Gypsum Board',
    requiredFurniture: ['Sliding Wardrobe', 'King Bed', 'Dresser', 'Study Desk'],
    budgetInr: 280000,
    isConfigured: true,
  },
  {
    id: 'space-kitchen',
    name: 'Kitchen & Utility',
    roomType: 'kitchen',
    areaSqm: 9.5,
    dimensionsText: '3.8m × 2.5m',
    ceilingHeightMm: 2700,
    usableWalls: 2,
    floorFinish: 'Anti-Skid Matte Tiles',
    falseCeiling: 'Moisture-Resistant Board',
    requiredFurniture: ['L-Shape Modular Cabinets', 'Tall Appliance Unit', 'Pantry'],
    budgetInr: 250000,
    isConfigured: true,
  },
];

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

export function SpacesWorkspace() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [spaces, setSpaces] = useState<SpaceRoom[]>(DEFAULT_SPACES);
  const [activeSpace, setActiveSpace] = useState<SpaceRoom | null>(null);
  const [saveState, setSaveState] = useState('');

  // Modal form
  const [editForm, setEditForm] = useState<Partial<SpaceRoom>>({});

  useEffect(() => {
    if (!supabase || !projectId) return;
    let live = true;
    void supabase.from('spaces').select('*').eq('project_id', projectId).order('created_at').then(({ data, error }) => {
      if (!live) return;
      if (error) {
        setSaveState(error.message);
        return;
      }
      const mapped = (data ?? []).map((row: any): SpaceRoom => {
        const requirements = row.requirements_json ?? {};
        const settings = row.settings_json ?? {};
        return {
          id: row.id,
          name: row.name,
          roomType: row.room_type,
          areaSqm: Number(row.area_sqm ?? 0),
          dimensionsText: requirements.dimensionsText ?? 'Measured from approved plan',
          ceilingHeightMm: Number(row.ceiling_height_mm ?? 2700),
          usableWalls: Number(requirements.usableWalls ?? 0),
          floorFinish: settings.floorFinish ?? 'Not specified',
          falseCeiling: settings.falseCeiling ?? 'Not specified',
          requiredFurniture: Array.isArray(requirements.requiredFurniture) ? requirements.requiredFurniture : [],
          budgetInr: typeof requirements.budgetInr === 'number' ? requirements.budgetInr : undefined,
          isConfigured: row.status === 'configured' || row.verification_status === 'verified'
        };
      });
      setSpaces(mapped);
      if (!mapped.length) setSaveState('No spaces were derived yet. Approve the reviewed floor plan first.');
    });
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
      const { error } = await supabase.from('spaces').update({
        name: nextSpace.name,
        room_type: nextSpace.roomType,
        area_sqm: nextSpace.areaSqm || null,
        ceiling_height_mm: nextSpace.ceilingHeightMm,
        requirements_json: { dimensionsText: nextSpace.dimensionsText, usableWalls: nextSpace.usableWalls, requiredFurniture: nextSpace.requiredFurniture, budgetInr: nextSpace.budgetInr ?? null },
        settings_json: { floorFinish: nextSpace.floorFinish, falseCeiling: nextSpace.falseCeiling },
        status: 'configured',
        verification_status: nextSpace.requiredFurniture.length ? 'verified' : 'pending',
        updated_at: new Date().toISOString()
      }).eq('id', activeSpace.id).eq('project_id', projectId);
      if (error) {
        setSaveState(error.message);
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
      const { error } = await supabase.from('projects').update({ workflow_stage: 'layouts', current_step: 'layouts', updated_at: new Date().toISOString() }).eq('id', projectId);
      if (error) {
        setSaveState(error.message);
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
                    {space.dimensionsText} • {space.areaSqm} m²
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
                <small style={{ marginBottom: 4 }}>Required Furniture</small>
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
                    value={editForm.ceilingHeightMm ?? 2700}
                    onChange={(e) => setEditForm({ ...editForm, ceilingHeightMm: parseInt(e.target.value, 10) || 2700 })}
                  />
                </div>
                <div className="form-field">
                  <label>Floor Finish</label>
                  <input
                    type="text"
                    value={editForm.floorFinish ?? ''}
                    onChange={(e) => setEditForm({ ...editForm, floorFinish: e.target.value })}
                    placeholder="e.g. Vitrified Tiles"
                  />
                </div>

                <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                  <label>False Ceiling Type</label>
                  <select
                    value={editForm.falseCeiling ?? 'Peripheral Cove Lighting'}
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

              {/* Furniture selector */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                  Required Furniture Modules
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                  {(FURNITURE_OPTIONS[editForm.roomType ?? 'living'] ?? FURNITURE_OPTIONS.living).map((item) => {
                    const selected = (editForm.requiredFurniture ?? []).includes(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => toggleFurniture(item)}
                        style={{
                          padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          border: selected ? '1px solid var(--gold)' : '1px solid var(--line)',
                          background: selected ? 'rgba(197,156,45,.15)' : 'var(--surface)',
                          color: selected ? 'var(--gold-dim)' : 'var(--text-secondary)'
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
