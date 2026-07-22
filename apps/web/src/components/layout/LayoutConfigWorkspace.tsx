import { ArrowRight, Box, Layers3, Sofa, Tv, UtensilsCrossed, BookOpen, ChevronRight, Sparkles, LayoutGrid, GaugeCircle, ShieldCheck, TriangleAlert, RotateCw, Replace } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import './layout-config.css';
import { shapeCatalogFor, generateCandidates, validatePlacements, approveLayout, invalidateDownstream, type LayoutCandidate, type CandidateScore } from '@ultida/layout-core';

// ─── Types ───────────────────────────────────────────────────────
export type RoomShape = 'rectangular' | 'l-shape' | 'u-shape' | 'irregular';
export type FurnitureTemplate = 'tv-unit' | 'kitchen-l' | 'kitchen-u' | 'kitchen-straight' | 'wardrobe' | 'dining' | 'study';
export type StylePreset = 'japandi' | 'contemporary-indian' | 'industrial' | 'parisian' | 'coastal';
export type WallOrientation = 'north' | 'south' | 'east' | 'west';

export type LayoutConfig = {
  shape: RoomShape;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  template: FurnitureTemplate;
  style: StylePreset;
  wallOrientation: WallOrientation;
};

export type RoomCategory = 'kitchen' | 'tv_unit' | 'wardrobe' | 'living' | 'bedroom' | 'other';

// ─── Existing room shape + template catalog ──────────────────────
const ROOM_SHAPES: Array<{ id: RoomShape; label: string; sub: string; svgPath: string }> = [
  { id: 'rectangular', label: 'Rectangular', sub: 'Standard four-wall room', svgPath: 'M 10 10 L 90 10 L 90 70 L 10 70 Z' },
  { id: 'l-shape', label: 'L-Shape', sub: 'Open-plan living/dining', svgPath: 'M 10 10 L 90 10 L 90 45 L 55 45 L 55 70 L 10 70 Z' },
  { id: 'u-shape', label: 'U-Shape', sub: 'Three-wall kitchen or suite', svgPath: 'M 10 10 L 35 10 L 35 55 L 65 55 L 65 10 L 90 10 L 90 70 L 10 70 Z' },
  { id: 'irregular', label: 'Irregular', sub: 'Custom boundaries from plan', svgPath: 'M 20 10 L 90 10 L 90 55 L 70 70 L 10 60 L 10 30 Z' },
];

const TEMPLATES: Array<{ id: FurnitureTemplate; label: string; sub: string; icon: ReactNode; bg: string; svgPreview: ReactNode }> = [
  { id: 'tv-unit', label: 'TV Unit & Entertainment', sub: 'Base cabinet · Back panel · Tall unit · Overhead shelf', icon: <Tv size={20} />, bg: '#1f2937', svgPreview: (<svg viewBox="0 0 200 100" style={{ width: '100%', height: '100%' }}><rect x="10" y="55" width="140" height="28" fill="#374151" /><rect x="35" y="15" width="90" height="36" fill="#111827" stroke="#4b5563" strokeWidth="1.5" /><rect x="155" y="20" width="32" height="63" fill="#451a03" /><rect x="35" y="9" width="90" height="5" fill="#d7a15c" /><text x="100" y="95" fill="#9ca3af" fontSize="9" textAnchor="middle">TV ENTERTAINMENT UNIT</text></svg>) },
  { id: 'kitchen-l', label: 'Kitchen — L-Shape', sub: 'Base + wall units · Corner + tall unit', icon: <UtensilsCrossed size={20} />, bg: '#fff7ed', svgPreview: (<svg viewBox="0 0 200 100" style={{ width: '100%', height: '100%' }}><rect x="10" y="55" width="100" height="28" fill="#d97706" opacity="0.7" /><rect x="10" y="30" width="100" height="20" fill="#fbbf24" opacity="0.6" /><rect x="114" y="20" width="28" height="63" fill="#d97706" opacity="0.8" /><rect x="10" y="20" width="28" height="68" fill="#b45309" opacity="0.6" /><text x="100" y="95" fill="#92400e" fontSize="9" textAnchor="middle">L-SHAPE KITCHEN</text></svg>) },
  { id: 'kitchen-u', label: 'Kitchen — U-Shape', sub: 'Three-wall · Island option · Full galley', icon: <UtensilsCrossed size={20} />, bg: '#fef3c7', svgPreview: (<svg viewBox="0 0 200 100" style={{ width: '100%', height: '100%' }}><rect x="10" y="55" width="180" height="22" fill="#d97706" opacity="0.7" /><rect x="10" y="25" width="30" height="30" fill="#b45309" opacity="0.7" /><rect x="160" y="25" width="30" height="30" fill="#b45309" opacity="0.7" /><rect x="10" y="15" width="180" height="8" fill="#fbbf24" opacity="0.6" /><text x="100" y="95" fill="#92400e" fontSize="9" textAnchor="middle">U-SHAPE KITCHEN</text></svg>) },
  { id: 'wardrobe', label: 'Wardrobe & Storage', sub: 'Sliding doors · Shelves · Drawers · Loft', icon: <Layers3 size={20} />, bg: '#f5f5f4', svgPreview: (<svg viewBox="0 0 200 100" style={{ width: '100%', height: '100%' }}><rect x="10" y="15" width="180" height="68" fill="#292524" /><line x1="73" y1="15" x2="73" y2="83" stroke="#57534e" strokeWidth="2" /><line x1="127" y1="15" x2="127" y2="83" stroke="#57534e" strokeWidth="2" /><circle cx="70" cy="50" r="4" fill="#a8a29e" /><circle cx="130" cy="50" r="4" fill="#a8a29e" /><text x="100" y="96" fill="#78716c" fontSize="9" textAnchor="middle">3-DOOR WARDROBE</text></svg>) },
  { id: 'dining', label: 'Dining & Seating', sub: 'Table · 4/6 chairs · Sideboard · Bar', icon: <Sofa size={20} />, bg: '#fdf2f8', svgPreview: (<svg viewBox="0 0 200 100" style={{ width: '100%', height: '100%' }}><rect x="55" y="35" width="90" height="40" fill="#7c3aed" opacity="0.6" rx="3" /><rect x="30" y="40" width="22" height="30" fill="#6d28d9" opacity="0.5" rx="2" /><rect x="148" y="40" width="22" height="30" fill="#6d28d9" opacity="0.5" rx="2" /><rect x="65" y="17" width="20" height="15" fill="#6d28d9" opacity="0.4" rx="2" /><rect x="115" y="17" width="20" height="15" fill="#6d28d9" opacity="0.4" rx="2" /><text x="100" y="96" fill="#5b21b6" fontSize="9" textAnchor="middle">DINING SET</text></svg>) },
  { id: 'study', label: 'Study / Home Office', sub: 'Wall desk · Overhead · Bookshelf · Chair', icon: <BookOpen size={20} />, bg: '#eff6ff', svgPreview: (<svg viewBox="0 0 200 100" style={{ width: '100%', height: '100%' }}><rect x="10" y="50" width="140" height="22" fill="#1d4ed8" opacity="0.6" /><rect x="10" y="15" width="50" height="32" fill="#2563eb" opacity="0.5" /><rect x="65" y="15" width="85" height="12" fill="#2563eb" opacity="0.4" /><rect x="155" y="15" width="35" height="57" fill="#1e40af" opacity="0.5" /><text x="95" y="96" fill="#1e3a8a" fontSize="9" textAnchor="middle">STUDY / HOME OFFICE</text></svg>) },
];

const STYLES: Array<{ id: StylePreset; label: string; sub: string; palette: string[] }> = [
  { id: 'japandi', label: 'Minimalist Japandi', sub: 'Serene · Warm wood · Clean lines', palette: ['#D4C5B9', '#E6DFD9', '#8C7B70', '#5C524A'] },
  { id: 'contemporary-indian', label: 'Warm Contemporary Indian', sub: 'Rich wood · Brass · Terracotta', palette: ['#C05C3E', '#F4E4C1', '#A67B5B', '#4E3629'] },
  { id: 'industrial', label: 'Industrial Loft', sub: 'Concrete · Matte black · Dark walnut', palette: ['#3E3D3C', '#2B2B2A', '#8F8E8C', '#54463C'] },
  { id: 'parisian', label: 'Classic Parisian', sub: 'White panelling · Marble · Rose gold', palette: ['#F3EBE9', '#D9C3C0', '#4A3B39', '#FFFFFF'] },
  { id: 'coastal', label: 'Coastal Modern', sub: 'Light oak · Sandy tones · Blue accents', palette: ['#E0EAF4', '#C8D8E8', '#8BADBF', '#F5F0E8'] },
];

const ORIENTATIONS: Array<{ id: WallOrientation; label: string; icon: string; desc: string }> = [
  { id: 'north', label: 'North Wall', icon: '↑', desc: 'Primary feature wall' },
  { id: 'south', label: 'South Wall', icon: '↓', desc: 'Window-facing wall' },
  { id: 'east', label: 'East Wall', icon: '→', desc: 'Entry-adjacent wall' },
  { id: 'west', label: 'West Wall', icon: '←', desc: 'Balcony-facing wall' },
];

const DEFAULT_CONFIG: LayoutConfig = {
  shape: 'rectangular',
  lengthMm: 5200,
  widthMm: 3800,
  heightMm: 2700,
  template: 'tv-unit',
  style: 'contemporary-indian',
  wallOrientation: 'north',
};

type Props = {
  initialConfig?: Partial<LayoutConfig>;
  detectedDimensions?: { lengthMm: number; widthMm: number; heightMm: number } | null;
  roomCategory?: RoomCategory;
  roomRequirements?: Record<string, unknown>;
  onGenerate?: (config: LayoutConfig) => void;
  onApproveCandidate?: (candidate: LayoutCandidate, config: LayoutConfig) => Promise<void> | void;
};

export function LayoutConfigWorkspace({ initialConfig, detectedDimensions, roomCategory = 'other', roomRequirements = {}, onGenerate, onApproveCandidate }: Props) {
  const [config, setConfig] = useState<LayoutConfig>({
    ...DEFAULT_CONFIG,
    ...(detectedDimensions ? { lengthMm: detectedDimensions.lengthMm, widthMm: detectedDimensions.widthMm, heightMm: detectedDimensions.heightMm } : {}),
    ...initialConfig,
  });
  const [activeStep, setActiveStep] = useState<'shape' | 'dimensions' | 'template' | 'style' | 'orientation' | 'candidates' | 'review'>('shape');
  const [candidates, setCandidates] = useState<LayoutCandidate[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [showClearances, setShowClearances] = useState(false);
  const [showViolations, setShowViolations] = useState(false);
  const [approvalState, setApprovalState] = useState('');

  function update<K extends keyof LayoutConfig>(key: K, value: LayoutConfig[K]) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  const selectedTemplate = TEMPLATES.find((t) => t.id === config.template);
  const selectedStyle = STYLES.find((s) => s.id === config.style);
  const categoryShapes = roomCategory ? shapeCatalogFor(roomCategory) : [];
  const selectedCandidate = candidates.find((c) => c.id === selectedCandidateId) ?? candidates[0] ?? null;
  const categoryTemplates = roomCategory ? templatesForCategory(roomCategory) : TEMPLATES;

  function templatesForCategory(cat: RoomCategory) {
    if (cat === 'kitchen') return TEMPLATES.filter((t) => ['kitchen-l', 'kitchen-u'].includes(t.id));
    if (cat === 'tv_unit') return TEMPLATES.filter((t) => ['tv-unit'].includes(t.id));
    if (cat === 'wardrobe') return TEMPLATES.filter((t) => ['wardrobe'].includes(t.id));
    if (cat === 'living') return TEMPLATES.filter((t) => ['tv-unit', 'dining'].includes(t.id));
    if (cat === 'bedroom') return TEMPLATES.filter((t) => ['wardrobe', 'study'].includes(t.id));
    return TEMPLATES;
  }

  async function generateLayoutCandidates() {
    const category = roomCategory || inferCategoryFromTemplate(config.template);
    const shapes = categoryShapes.length ? categoryShapes.map((s) => s.id) : ['balanced'];
    const generated = generateCandidates({
      projectId: 'project-local',
      spaceId: 'space-local',
      roomCategory: category,
      floorPlanVersionId: 'fpv-local',
      shape: shapes[0] ?? 'balanced',
      candidateTypes: ['maximum_storage', 'best_circulation', 'balanced', 'cost_efficient'],
      requirements: roomRequirements ?? {},
      roomBoundingBoxMm: { minX: 0, minY: 0, maxX: config.lengthMm, maxY: config.widthMm },
      usableWalls: [],
      openings: [],
      servicePoints: [],
      structuralElements: [],
      companyRules: {},
    });
    const unique = Array.from(new Map(generated.map((item) => [item.candidateType, item])).values());
    setCandidates(unique);
    setSelectedCandidateId(unique[0]?.id ?? null);
    setActiveStep('candidates');
  }

  async function handleApprove() {
    if (!selectedCandidate) return;
    if (!onApproveCandidate) {
      setApprovalState('Approval connection is unavailable.');
      return;
    }
    setApprovalState('Saving and approving layout...');
    try {
      await onApproveCandidate(selectedCandidate, config);
      setApprovalState('Layout approved. Downstream outputs are marked for recompilation.');
      setActiveStep('review');
    } catch (error) {
      setApprovalState(error instanceof Error ? error.message : 'Layout approval failed.');
    }
  }

  return (
    <div className="layout-config-workspace">
      <div className="layout-config-header">
        <div>
          <small>LAYOUT STUDIO</small>
          <h2>Symbolic Layout &amp; Candidate Review</h2>
          <p>Choose a room-specific shape, review deterministic symbolic candidates, then approve an immutable layout version.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {roomCategory && <span className="tag">{String(roomCategory).replace('_', ' ')}</span>}
          {detectedDimensions && (<span style={{ fontSize: '12px', color: 'var(--success)', background: 'var(--success-bg)', border: '1px solid var(--success-line)', padding: '4px 10px', borderRadius: '20px', fontWeight: 700 }}>✓ Dimensions detected from floor plan</span>)}
        </div>
      </div>

      <div className="layout-steps">
        {(['shape', 'dimensions', 'template', 'style', 'orientation', 'candidates', 'review'] as const).map((step, i) => (
          <div key={step} className={`layout-step ${activeStep === step ? 'active' : ''}`} onClick={() => setActiveStep(step)}>
            <span className="step-num">{i + 1}</span>
            <span style={{ textTransform: 'capitalize' }}>{step === 'candidates' ? 'candidates' : step === 'review' ? 'approve' : step}</span>
          </div>
        ))}
      </div>

      {/* Shape */}
      {activeStep === 'shape' && (
        <div className="layout-section">
          <div className="layout-section-header">
            <div className="section-icon"><LayoutGrid size={16} /></div>
            <div>
              <strong style={{ fontSize: '14px' }}>Room Layout Shape</strong>
              <p style={{ margin: 0, fontSize: '12px' }}>Pick the layout shape for {roomCategory || 'this room'} before generating candidates.</p>
            </div>
          </div>
          <div className="layout-section-body">
            <div className="shape-grid">
              {(categoryShapes.length ? categoryShapes : ROOM_SHAPES).map((shape) => (
                <div key={shape.id} className={`shape-card`}>
                  <div style={{ padding: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>{shape.label}</div>
                  <div style={{ padding: '0 12px 12px', fontSize: '11px', color: 'var(--text-muted)' }}>{shape.sub}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button className="btn-generate" style={{ fontSize: '13px', padding: '10px 20px' }} onClick={() => setActiveStep('dimensions')}>Next: Dimensions <ChevronRight size={16} /></button>
            </div>
          </div>
        </div>
      )}

      {/* Dimensions */}
      {activeStep === 'dimensions' && (
        <div className="layout-section">
          <div className="layout-section-header">
            <div className="section-icon"><Layers3 size={16} /></div>
            <div>
              <strong style={{ fontSize: '14px' }}>Room Dimensions</strong>
              <p style={{ margin: 0, fontSize: '12px' }}>Verified room dimensions in millimetres. These boxes constrain candidate placement.</p>
            </div>
          </div>
          <div className="layout-section-body">
            <div className="dimension-grid">
              <div className="dim-field"><label>Length <span className="dim-unit">(mm)</span></label><input type="number" value={config.lengthMm} onChange={(e) => update('lengthMm', Number(e.target.value) || 5200)} min="1000" max="20000" step="50" /><span className="dim-unit">{(config.lengthMm / 1000).toFixed(2)} m</span></div>
              <div className="dim-field"><label>Width <span className="dim-unit">(mm)</span></label><input type="number" value={config.widthMm} onChange={(e) => update('widthMm', Number(e.target.value) || 3800)} min="1000" max="20000" step="50" /><span className="dim-unit">{(config.widthMm / 1000).toFixed(2)} m</span></div>
              <div className="dim-field"><label>Ceiling Height <span className="dim-unit">(mm)</span></label><input type="number" value={config.heightMm} onChange={(e) => update('heightMm', Number(e.target.value) || 2700)} min="2100" max="5000" step="50" /><span className="dim-unit">{(config.heightMm / 1000).toFixed(2)} m</span></div>
            </div>
            <div style={{ marginTop: '16px', padding: '14px 18px', background: 'var(--cream-mid)', borderRadius: '8px', border: '1px solid var(--line)', display: 'flex', gap: '24px' }}>
              <div><div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '2px' }}>FLOOR AREA</div><strong style={{ fontSize: '18px' }}>{((config.lengthMm * config.widthMm) / 1000000).toFixed(2)} m²</strong></div>
              <div><div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '2px' }}>VOLUME</div><strong style={{ fontSize: '18px' }}>{((config.lengthMm * config.widthMm * config.heightMm) / 1e9).toFixed(2)} m³</strong></div>
              <div><div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '2px' }}>PERIMETER</div><strong style={{ fontSize: '18px' }}>{((config.lengthMm * 2 + config.widthMm * 2) / 1000).toFixed(2)} m</strong></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
              <button className="btn-generate" style={{ fontSize: '13px', padding: '10px 20px', background: 'var(--surface-raised)', color: 'var(--brown-mid)', border: '1px solid var(--line)', boxShadow: 'none' }} onClick={() => setActiveStep('shape')}>← Back</button>
              <button className="btn-generate" style={{ fontSize: '13px', padding: '10px 20px' }} onClick={() => setActiveStep('template')}>Next: Template <ChevronRight size={16} /></button>
            </div>
          </div>
        </div>
      )}

      {/* Template */}
      {activeStep === 'template' && (
        <div className="layout-section">
          <div className="layout-section-header">
            <div className="section-icon"><Box size={16} /></div>
            <div>
              <strong style={{ fontSize: '14px' }}>Furniture Template</strong>
              <p style={{ margin: 0, fontSize: '12px' }}>Choose the symbolic furniture system. Candidates will derive from this family.</p>
            </div>
          </div>
          <div className="layout-section-body">
            <div className="template-grid">
              {categoryTemplates.map((tmpl) => (
                <div key={tmpl.id} className={`template-card ${config.template === tmpl.id ? 'selected' : ''}`} onClick={() => update('template', tmpl.id)}>
                  <div className="template-thumb" style={{ background: tmpl.bg }}>{tmpl.svgPreview}</div>
                  <div className="template-info"><strong>{tmpl.label}</strong><span>{tmpl.sub}</span></div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
              <button className="btn-generate" style={{ fontSize: '13px', padding: '10px 20px', background: 'var(--surface-raised)', color: 'var(--brown-mid)', border: '1px solid var(--line)', boxShadow: 'none' }} onClick={() => setActiveStep('dimensions')}>← Back</button>
              <button className="btn-generate" style={{ fontSize: '13px', padding: '10px 20px' }} onClick={() => setActiveStep('style')}>Next: Style <ChevronRight size={16} /></button>
            </div>
          </div>
        </div>
      )}

      {/* Style */}
      {activeStep === 'style' && (
        <div className="layout-section">
          <div className="layout-section-header">
            <div className="section-icon"><Sparkles size={16} /></div>
            <div>
              <strong style={{ fontSize: '14px' }}>Design Style</strong>
              <p style={{ margin: 0, fontSize: '12px' }}>Style palette guides material finish and render direction.</p>
            </div>
          </div>
          <div className="layout-section-body">
            <div className="style-grid">
              {STYLES.map((style) => (
                <div key={style.id} className={`style-card ${config.style === style.id ? 'selected' : ''}`} onClick={() => update('style', style.id)}>
                  <div className="style-palette">{style.palette.map((color, i) => (<span key={i} style={{ background: color }} />))}</div>
                  <div className="style-info"><strong>{style.label}</strong><small>{style.sub}</small></div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
              <button className="btn-generate" style={{ fontSize: '13px', padding: '10px 20px', background: 'var(--surface-raised)', color: 'var(--brown-mid)', border: '1px solid var(--line)', boxShadow: 'none' }} onClick={() => setActiveStep('template')}>← Back</button>
              <button className="btn-generate" style={{ fontSize: '13px', padding: '10px 20px' }} onClick={() => setActiveStep('orientation')}>Next: Orientation <ChevronRight size={16} /></button>
            </div>
          </div>
        </div>
      )}

      {/* Orientation */}
      {activeStep === 'orientation' && (
        <div className="layout-section">
          <div className="layout-section-header">
            <div className="section-icon"><ArrowRight size={16} /></div>
            <div>
              <strong style={{ fontSize: '14px' }}>Primary Wall Orientation</strong>
              <p style={{ margin: 0, fontSize: '12px' }}>Select the primary wall anchor. Deterministic candidates use this to avoid door/window conflicts.</p>
            </div>
          </div>
          <div className="layout-section-body">
            <div className="orientation-grid">
              {ORIENTATIONS.map((ori) => (
                <button key={ori.id} className={`orientation-btn ${config.wallOrientation === ori.id ? 'selected' : ''}`} onClick={() => update('wallOrientation', ori.id)}>
                  <span style={{ fontSize: '24px', lineHeight: 1 }}>{ori.icon}</span>
                  <strong>{ori.label}</strong><span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>{ori.desc}</span>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '20px' }}>
              <button className="btn-generate" style={{ fontSize: '13px', padding: '10px 20px', background: 'var(--surface-raised)', color: 'var(--brown-mid)', border: '1px solid var(--line)', boxShadow: 'none' }} onClick={() => setActiveStep('style')}>← Back</button>
              <button className="btn-generate" style={{ fontSize: '13px', padding: '10px 20px', marginLeft: '10px' }} onClick={generateLayoutCandidates}>Generate symbolic candidates <Sparkles size={18} /></button>
            </div>
          </div>
        </div>
      )}

      {/* Candidates */}
      {activeStep === 'candidates' && (
        <div className="layout-section">
          <div className="layout-section-header">
            <div className="section-icon"><GaugeCircle size={16} /></div>
            <div>
              <strong style={{ fontSize: '14px' }}>Deterministic Candidates</strong>
              <p style={{ margin: 0, fontSize: '12px' }}>Symbolic placements validated against wall fit, door swing, window blockage, circulation, collisions, and structural/AC/service constraints.</p>
            </div>
          </div>
          <div className="layout-section-body">
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <button className="btn-generate" style={{ fontSize: '12px', padding: '8px 12px' }} onClick={() => setShowClearances((v) => !v)}>{showClearances ? 'Hide clearances' : 'Show clearances'}</button>
              <button className="btn-generate" style={{ fontSize: '12px', padding: '8px 12px' }} onClick={() => setShowViolations((v) => !v)}>{showViolations ? 'Hide violations' : 'Show violations'}</button>
              <button className="btn-generate" style={{ fontSize: '12px', padding: '8px 12px', background: 'var(--surface-raised)', color: 'var(--brown-mid)', border: '1px solid var(--line)', boxShadow: 'none' }} onClick={generateLayoutCandidates}><RotateCw size={16} /> Regenerate</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
              {candidates.map((candidate) => (
                <CandidateCard
                  key={candidate.id}
                  candidate={candidate}
                  selected={candidate.id === selectedCandidateId}
                  showClearances={showClearances}
                  showViolations={showViolations}
                  onSelect={() => { setSelectedCandidateId(candidate.id); }}
                />
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
              <button className="btn-generate" style={{ fontSize: '13px', padding: '10px 20px', background: 'var(--surface-raised)', color: 'var(--brown-mid)', border: '1px solid var(--line)', boxShadow: 'none' }} onClick={() => setActiveStep('orientation')}>← Back</button>
              <button className="btn-generate" style={{ fontSize: '13px', padding: '10px 20px' }} disabled={!selectedCandidateId} onClick={handleApprove}><ShieldCheck size={18} /> Approve layout version</button>
            </div>
            {approvalState && <p role="status" style={{ margin: '12px 0 0', fontSize: '12px', color: approvalState.startsWith('Layout approved') ? 'var(--success)' : 'var(--danger)' }}>{approvalState}</p>}
          </div>
        </div>
      )}

      {/* Review / Approve */}
      {activeStep === 'review' && selectedCandidate && (
        <div className="layout-section">
          <div className="layout-section-header">
            <div className="section-icon"><ShieldCheck size={16} /></div>
            <div>
              <strong style={{ fontSize: '14px' }}>Approved Layout Version</strong>
              <p style={{ margin: 0, fontSize: '12px' }}>This symbolic placement snapshot is immutable. Downstream scene, modules, render, drawings, and estimates are invalidated when approved through the API.</p>
            </div>
          </div>
          <div className="layout-section-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              <InfoTile label="Shape" value={selectedCandidate.shape.replace(/_/g, ' ')} />
              <InfoTile label="Candidate type" value={selectedCandidate.candidateType.replace(/_/g, ' ')} />
              <InfoTile label="Placements" value={String(selectedCandidate.placements.length)} />
              <InfoTile label="Weighted score" value={`${(selectedCandidate.score.weighted * 100).toFixed(0)}%`} />
              <InfoTile label="Status" value={selectedCandidate.validation.valid ? 'Valid ✅' : 'Has issues'} />
            </div>

            <div style={{ marginTop: '18px' }}>
              <h4 style={{ margin: '0 0 8px' }}>Placements</h4>
              <div style={{ display: 'grid', gap: '8px' }}>
                {selectedCandidate.placements.map((placement) => (
                  <div key={placement.id} style={{ padding: '10px 12px', background: 'var(--surface-raised)', border: '1px solid var(--line)', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong>{placement.templateFamily}</strong>
                      <span className="tag">{placement.anchor}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                      {placement.widthMm} × {placement.depthMm} × {placement.heightMm} mm &nbsp;|&nbsp; clearance {placement.clearanceMm} mm &nbsp;|&nbsp; rotation {placement.rotationYawDeg}°
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                      Position {placement.positionMm.map((n: number) => `${n} mm`).join(', ')} &nbsp;|&nbsp; services: {placement.requiredServicePoints.join(', ') || 'none'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: '18px', display: 'flex', justifyContent: 'space-between' }}>
              <button className="btn-generate" style={{ fontSize: '13px', padding: '10px 20px', background: 'var(--surface-raised)', color: 'var(--brown-mid)', border: '1px solid var(--line)', boxShadow: 'none' }} onClick={() => setActiveStep('candidates')}>← Back to candidates</button>
              {onGenerate && (<button className="btn-generate" style={{ fontSize: '13px', padding: '10px 20px' }} onClick={() => onGenerate(config)}>Proceed to render <ArrowRight size={16} /></button>)}
            </div>
          </div>
        </div>
      )}

      {/* Legacy summary + generate CTA */}
      <div className="generate-cta">
        <div className="generate-cta-info">
          <h3>Generate 3D Design Render</h3>
          <p>Use approved symbolic layout to drive deterministic scene compilation and production render pipeline.</p>
          <div className="generate-summary">
            <span className="gen-tag">📐 {ROOM_SHAPES.find((s) => s.id === config.shape)?.label}</span>
            <span className="gen-tag">📏 {config.lengthMm} × {config.widthMm} mm</span>
            <span className="gen-tag">🪑 {selectedTemplate?.label}</span>
            <span className="gen-tag">🎨 {selectedStyle?.label}</span>
            <span className="gen-tag">🧭 {config.wallOrientation.charAt(0).toUpperCase() + config.wallOrientation.slice(1)} Wall</span>
          </div>
        </div>
        {onGenerate && (
          <button className="btn-generate" onClick={() => onGenerate(config)}>
            <Sparkles size={18} /> Generate 3D Render <ArrowRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

function inferCategoryFromTemplate(template: FurnitureTemplate): RoomCategory {
  if (template.startsWith('kitchen')) return 'kitchen';
  if (template === 'tv-unit') return 'tv_unit';
  if (template === 'wardrobe') return 'wardrobe';
  if (template === 'dining') return 'living';
  if (template === 'study') return 'bedroom';
  return 'other';
}

type InfoTileProps = { label: string; value: string };

function InfoTile({ label, value }: InfoTileProps) {
  return (
    <div style={{ padding: '10px 12px', background: 'var(--surface-raised)', border: '1px solid var(--line)', borderRadius: '8px' }}>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: '14px', fontWeight: 600 }}>{value}</div>
    </div>
  );
}

type CandidateCardProps = {
  candidate: LayoutCandidate;
  selected: boolean;
  showClearances: boolean;
  showViolations: boolean;
  onSelect: () => void;
};

function CandidateCard({ candidate, selected, showClearances, showViolations, onSelect }: CandidateCardProps) {
  const blocking = candidate.validation.issues.filter((i) => i.severity === 'blocking');
  const warnings = candidate.validation.issues.filter((i) => i.severity === 'warning');
  return (
    <div style={{ padding: '12px', border: selected ? '2px solid var(--gold)' : '1px solid var(--line)', borderRadius: '10px', background: 'var(--surface)', boxShadow: selected ? '0 0 0 3px rgba(197,156,45,0.12)' : 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <strong>{candidate.candidateType.replace(/_/g, ' ')}</strong>
        <span className="tag">{candidate.shape}</span>
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
        {candidate.placements.length} placements &nbsp;|&nbsp; score {(candidate.score.weighted * 100).toFixed(0)}% &nbsp;|&nbsp; {candidate.validation.valid ? 'Valid ✅' : `${blocking.length} blocking`}
      </div>

      {showClearances && (
        <div style={{ fontSize: '12px', marginBottom: '8px' }}>
          {candidate.placements.map((p) => (<div key={p.id}>• {p.templateFamily}: clearance {p.clearanceMm} mm</div>))}
        </div>
      )}

      {showViolations && (
        <div style={{ fontSize: '12px', marginBottom: '8px' }}>
          {candidate.validation.issues.length === 0 && <div>No violations</div>}
          {candidate.validation.issues.map((issue) => (
            <div key={`${issue.code}-${issue.message}`} style={{ color: issue.severity === 'blocking' ? 'var(--danger)' : 'var(--warn)' }}>
              {issue.severity === 'blocking' ? <TriangleAlert size={14} /> : <ShieldCheck size={14} />} {issue.code}: {issue.message}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
        <button onClick={onSelect} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid var(--line)', background: selected ? 'var(--gold)' : 'var(--surface-raised)', color: selected ? '#fff' : 'var(--brown-mid)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>{selected ? 'Selected' : 'Select'}</button>
      </div>
    </div>
  );
}
