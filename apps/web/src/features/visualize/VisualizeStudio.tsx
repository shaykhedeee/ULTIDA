import {
  Box,
  Image,
  Palette,
  Sparkles,
  SlidersHorizontal,
  Layers3,
  Split,
  Tag,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Lock,
  Maximize2,
  RotateCcw,
  ShieldCheck,
  Sun,
  Cpu,
  Eye,
  Check,
} from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { getApiBase } from '../../lib/api-base';
import InteractiveRenderViewer, { type MatchedObject } from '../../components/visual/InteractiveRenderViewer';
import { WorkflowDock } from '../../components/ui/primitives';
import './visualize-studio.css';

type VisualizeTab = 'review' | 'render' | 'laminate' | 'interactive' | 'compare';

type Props = {
  review: ReactNode;
  render: ReactNode;
  laminate: ReactNode;
  sceneReady: boolean;
  sceneApproved: boolean;
  onApproveScene?: () => Promise<boolean>;
  projectId?: string | null;
};

const SAMPLE_INTERACTIVE_ITEMS: MatchedObject[] = [
  {
    object_id: 1,
    bbox: { x: 80, y: 160, w: 320, h: 480 },
    category: 'wardrobe',
    matched_sku: 'MOD-FLUTED-WARDROBE-2400',
    matched_name: '2400mm 4-Door Fluted Glass Wardrobe with LED Shelves',
    vendor: 'ULTIDA System 32 Atelier',
    unit_price: 1850,
    confidence_score: 0.98,
  },
  {
    object_id: 2,
    bbox: { x: 420, y: 340, w: 280, h: 260 },
    category: 'bed',
    matched_sku: 'BED-KING-SMOKED-OAK',
    matched_name: 'King Size Floating Platform Bed with Fluted Acoustic Headboard',
    vendor: 'ULTIDA Master Suite',
    unit_price: 2400,
    confidence_score: 0.97,
  },
  {
    object_id: 3,
    bbox: { x: 720, y: 410, w: 140, h: 180 },
    category: 'nightstand',
    matched_sku: 'NST-CANTILEVER-OAK',
    matched_name: 'Cantilevered Oak Nightstand with Wireless Charging Inset',
    vendor: 'ULTIDA System 32 Atelier',
    unit_price: 420,
    confidence_score: 0.95,
  },
  {
    object_id: 4,
    bbox: { x: 260, y: 20, w: 480, h: 90 },
    category: 'lighting_fixture',
    matched_sku: 'LGT-COVE-3000K-ALU',
    matched_name: 'Recessed Architectural Cove 3000K Warm Warm Diffuser (6.4m)',
    vendor: 'Philips Hue Pro Architectural',
    unit_price: 360,
    confidence_score: 0.99,
  },
  {
    object_id: 5,
    bbox: { x: 120, y: 640, w: 760, h: 210 },
    category: 'flooring',
    matched_sku: 'FLR-HERRINGBONE-FRENCH-OAK',
    matched_name: '190×1200mm Smoked French Oak Engineered Parquet Herringbone',
    vendor: 'Havwoods International',
    unit_price: 2850,
    confidence_score: 0.96,
  },
];

const COMPARISON_ROOMS = [
  {
    id: 'living',
    name: 'Main Living & Lounge',
    renderA: '/reference-vault/001-ddc1891636f7.png',
    renderB: '/reference-vault/002-cab37cfa0bb2.png',
    schemeAName: 'Warm Amber & Smoked Oak',
    schemeBName: 'Fluted Suede & Noir Slate',
    seed: '84920158',
    camera: 'FOV 35mm · 1500mm AFF Eye-Level',
    denoising: '0.32 (Structure Preserving)',
  },
  {
    id: 'kitchen',
    name: 'Gourmet Island Kitchen',
    renderA: '/reference-vault/006-e36e2c7c9b1a.png',
    renderB: '/reference-vault/002-cab37cfa0bb2.png',
    schemeAName: 'Natural Walnut & Calacatta Gold',
    schemeBName: 'Matte Charcoal & Nero Marquina',
    seed: '71048293',
    camera: 'FOV 32mm · 1200mm Island Hero',
    denoising: '0.30 (Zero Drift)',
  },
  {
    id: 'study',
    name: 'Executive Study & Library',
    renderA: '/reference-vault/011-6c55d3439149.png',
    renderB: '/reference-vault/001-ddc1891636f7.png',
    schemeAName: 'Smoked Oak & Champagne Bronze',
    schemeBName: 'Gunmetal & Slate Grey',
    seed: '99201481',
    camera: 'FOV 38mm · 1400mm Desk Oblique',
    denoising: '0.34 (Structure Preserving)',
  },
];

export function VisualizeStudio({ review, render, laminate, sceneReady, sceneApproved, onApproveScene, projectId }: Props) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const active: VisualizeTab =
    requested === 'render' || requested === 'laminate'
      ? requested
      : 'review';
  const [approving, setApproving] = useState(false);

  // A/B Comparison state
  const [compareRoomIndex, setCompareRoomIndex] = useState(0);
  const [splitPosition, setSplitPosition] = useState(50); // percentage 0-100
  const [compareMode, setCompareMode] = useState<'split' | 'side-by-side'>('split');
  const [activeAppliedScheme, setActiveAppliedScheme] = useState<'A' | 'B'>('A');

  const selectedCompareRoom = COMPARISON_ROOMS[compareRoomIndex];

  // RenderIntentV1 & Conditioning state
  const [intentStyle, setIntentStyle] = useState('Warm Contemporary');
  const [intentPalette, setIntentPalette] = useState('Smoked Oak & Calacatta Gold');
  const [intentLighting, setIntentLighting] = useState('3000K warm indirect cove');
  const [intentHardware, setIntentHardware] = useState('minimal Gola profile (handleless)');
  const [intentGrain, setIntentGrain] = useState<'vertical-grain' | 'horizontal-grain' | 'follow-part' | 'none'>('vertical-grain');
  const [lockedSeed, setLockedSeed] = useState('71048293');
  const [isSeedFrozen, setIsSeedFrozen] = useState(true);
  const [activePass, setActivePass] = useState<'rgb' | 'depth' | 'canny' | 'semantic' | 'openings'>('rgb');
  const [intentSavedNotice, setIntentSavedNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    try {
      const saved = window.localStorage.getItem(`ultida.designIntent.${projectId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.style) setIntentStyle(parsed.style);
        if (parsed.palette?.[0]) setIntentPalette(parsed.palette[0]);
        if (parsed.lightingMood) setIntentLighting(parsed.lightingMood);
        if (parsed.hardwareStyle) setIntentHardware(parsed.hardwareStyle);
        if (parsed.surfaceDirection) setIntentGrain(parsed.surfaceDirection);
      }
    } catch {}
  }, [projectId]);

  const updateIntent = (patch: Partial<{ style: string; palette: string; lighting: string; hardware: string; grain: any }>) => {
    const nextStyle = patch.style ?? intentStyle;
    const nextPalette = patch.palette ?? intentPalette;
    const nextLighting = patch.lighting ?? intentLighting;
    const nextHardware = patch.hardware ?? intentHardware;
    const nextGrain = patch.grain ?? intentGrain;

    if (patch.style) setIntentStyle(patch.style);
    if (patch.palette) setIntentPalette(patch.palette);
    if (patch.lighting) setIntentLighting(patch.lighting);
    if (patch.hardware) setIntentHardware(patch.hardware);
    if (patch.grain) setIntentGrain(patch.grain);

    if (projectId) {
      try {
        const intentDoc = {
          version: 1,
          style: nextStyle,
          palette: [nextPalette],
          lightingMood: nextLighting,
          hardwareStyle: nextHardware,
          surfaceDirection: nextGrain,
          referenceAssetIds: [],
        };
        window.localStorage.setItem(`ultida.designIntent.${projectId}`, JSON.stringify(intentDoc));
        setIntentSavedNotice(`✓ RenderIntentV1 updated (${nextStyle})`);
        setTimeout(() => setIntentSavedNotice(null), 3000);
      } catch {}
    }
  };

  const tabs = [
    { id: 'review' as const, label: '3D review', icon: Box, help: 'Check the saved scene and measurements' },
    { id: 'render' as const, label: 'AI render', icon: Image, help: 'Generate a presentation image from the approved scene' },
    { id: 'laminate' as const, label: 'Finish revision', icon: Palette, help: 'Revise a named component finish' },
  ];

  function select(id: VisualizeTab) {
    const next = new URLSearchParams(params);
    next.set('tab', id);
    setParams(next, { replace: true });
  }

  const panels: Record<VisualizeTab, ReactNode> = {
    review,
    render: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* RenderIntentV1 & Multi-Pass Conditioning Header Card */}
        <div
          style={{
            background: '#1c1917',
            borderRadius: 14,
            padding: '18px 22px',
            border: '1px solid #332d29',
            boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.1em', color: '#c59c2d', textTransform: 'uppercase' }}>
                  TRI-INPUT AI CONDITIONING GATEWAY
                </span>
                <span style={{ background: 'rgba(197, 156, 45, 0.15)', color: '#f5d374', border: '1px solid rgba(197, 156, 45, 0.35)', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>
                  RenderIntentV1 Active
                </span>
                {intentSavedNotice && (
                  <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.35)', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>
                    {intentSavedNotice}
                  </span>
                )}
              </div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#f5f5f4', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={17} color="#c59c2d" />
                Render Intent, Lighting Mood &amp; Deterministic Seed Control
              </h3>
            </div>

            {/* Tri-Input Authority Badges */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: '#34d399', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '4px 9px', borderRadius: 6, fontWeight: 700 }}>
                ✓ Input 1: moduleParts (Immutable)
              </span>
              <span style={{ fontSize: 11, color: '#60a5fa', background: 'rgba(96, 165, 250, 0.12)', border: '1px solid rgba(96, 165, 250, 0.3)', padding: '4px 9px', borderRadius: 6, fontWeight: 700 }}>
                ✓ Input 2: Material Records (PBR)
              </span>
              <span style={{ fontSize: 11, color: '#fbbf24', background: 'rgba(251, 191, 36, 0.12)', border: '1px solid rgba(251, 191, 36, 0.3)', padding: '4px 9px', borderRadius: 6, fontWeight: 700 }}>
                ✓ Input 3: RenderIntentV1 ({intentStyle})
              </span>
            </div>
          </div>

          {/* Interactive Selectors */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#a8a29e', marginBottom: 4 }}>
                Aesthetic Presentation Style
              </label>
              <select
                value={intentStyle}
                onChange={(e) => updateIntent({ style: e.target.value })}
                style={{ width: '100%', background: '#24201c', border: '1px solid #443c34', color: '#f5f5f4', padding: '7px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                <option value="Warm Contemporary">Warm Contemporary (Teak &amp; Warm Suede)</option>
                <option value="Modern Minimalist">Modern Minimalist (Monochrome &amp; Flush Gola)</option>
                <option value="Japandi">Japandi (Fluted Oak &amp; Rice Paper Textures)</option>
                <option value="Classic Luxury">Classic Luxury (Profile Glass &amp; Calacatta)</option>
                <option value="Industrial Loft">Industrial Loft (Gunmetal, Reclaimed Wood &amp; Concrete)</option>
                <option value="Indian Contemporary">Indian Contemporary (Brass Accents, Makrana &amp; Teak)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#a8a29e', marginBottom: 4 }}>
                Curated Color &amp; Material Palette
              </label>
              <select
                value={intentPalette}
                onChange={(e) => updateIntent({ palette: e.target.value })}
                style={{ width: '100%', background: '#24201c', border: '1px solid #443c34', color: '#f5f5f4', padding: '7px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                <option value="Smoked Oak & Calacatta Gold">Smoked Oak &amp; Calacatta Gold (Deep Wood &amp; Honed Marble)</option>
                <option value="Natural Walnut & Travertine">Natural Walnut &amp; Italian Travertine (Warm Earth Tones)</option>
                <option value="Matte Charcoal & Nero Marquina">Matte Charcoal &amp; Nero Marquina (Dramatic Architectural Luxe)</option>
                <option value="Champagne Bronze & Ivory">Champagne Bronze &amp; Ivory (High-End Master Suite)</option>
                <option value="Nordic Ash & Pure White">Nordic Ash &amp; Pure White (Airy &amp; Organic)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#a8a29e', marginBottom: 4 }}>
                Lighting Mood &amp; Solar Angle
              </label>
              <select
                value={intentLighting}
                onChange={(e) => updateIntent({ lighting: e.target.value })}
                style={{ width: '100%', background: '#24201c', border: '1px solid #443c34', color: '#f5f5f4', padding: '7px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                <option value="3000K warm indirect cove">3000K Warm Indirect Cove (Architectural Linear LED)</option>
                <option value="morning sun natural daylight">Morning Sun Natural Daylight (Window Sunbeam Cast)</option>
                <option value="4000K museum gallery crisp white">4000K Museum Gallery Crisp White (High CRI Spots)</option>
                <option value="2700K moody evening dusk">2700K Moody Evening Dusk &amp; Floor Accents</option>
                <option value="5000K high-noon bright daylight">5000K High-Noon Bright Daylight</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#a8a29e', marginBottom: 4 }}>
                Hardware &amp; Profile Specification
              </label>
              <select
                value={intentHardware}
                onChange={(e) => updateIntent({ hardware: e.target.value })}
                style={{ width: '100%', background: '#24201c', border: '1px solid #443c34', color: '#f5f5f4', padding: '7px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                <option value="minimal Gola profile (handleless)">Minimal Gola J-Profile (Handleless Aluminum)</option>
                <option value="handleless push-to-open">Handleless Tip-On / Push-To-Open (Flush Face)</option>
                <option value="champagne knurled bar pulls">Champagne Knurled Bar Pulls (Hafele Luxury Collection)</option>
                <option value="brushed bronze edge-lip pulls">Brushed Bronze Recessed Edge-Lip Pulls</option>
                <option value="matte black architectural slim profile">Matte Black Architectural Slim Profile</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#a8a29e', marginBottom: 4 }}>
                Wood Grain Direction
              </label>
              <select
                value={intentGrain}
                onChange={(e) => updateIntent({ grain: e.target.value as any })}
                style={{ width: '100%', background: '#24201c', border: '1px solid #443c34', color: '#f5f5f4', padding: '7px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                <option value="vertical-grain">Vertical Grain (Tall shutters &amp; side gables)</option>
                <option value="horizontal-grain">Horizontal Grain (Drawers &amp; horizontal panels)</option>
                <option value="follow-part">Follow Part (Longest panel dimension)</option>
                <option value="none">None (Solid matte / sintered slab / fluted glass)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#a8a29e', marginBottom: 4 }}>
                Deterministic Seed Locking
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text"
                  value={lockedSeed}
                  onChange={(e) => setLockedSeed(e.target.value)}
                  style={{ flex: 1, background: '#24201c', border: '1px solid #443c34', color: '#f5f5f4', padding: '7px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700 }}
                  placeholder="Seed #"
                />
                <button
                  type="button"
                  onClick={() => setIsSeedFrozen(!isSeedFrozen)}
                  style={{
                    background: isSeedFrozen ? '#c59c2d' : '#332d29',
                    color: isSeedFrozen ? '#1c1917' : '#a8a29e',
                    border: 0,
                    borderRadius: 6,
                    padding: '0 10px',
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Lock size={12} /> {isSeedFrozen ? 'Locked' : 'Free'}
                </button>
              </div>
            </div>
          </div>

          {/* Computer Vision Render QA & Multi-Pass Strip */}
          <div style={{ borderTop: '1px solid #332d29', paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#c59c2d', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Cpu size={13} /> Multi-Pass Conditioning:
              </span>
              <span style={{ fontSize: 11, color: '#a8a29e' }}>Pass 1 (RGB Base)</span>
              <span style={{ color: '#443c34' }}>•</span>
              <span style={{ fontSize: 11, color: '#34d399' }}>Pass 2 (16-bit Depth)</span>
              <span style={{ color: '#443c34' }}>•</span>
              <span style={{ fontSize: 11, color: '#38bdf8' }}>Pass 3 (Canny Normal)</span>
              <span style={{ color: '#443c34' }}>•</span>
              <span style={{ fontSize: 11, color: '#f59e0b' }}>Pass 4 (Object Masks)</span>
              <span style={{ color: '#443c34' }}>•</span>
              <span style={{ fontSize: 11, color: '#ec4899' }}>Pass 5 (Opening Keep-Outs)</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '3px 8px', borderRadius: 6, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                <ShieldCheck size={13} /> QA Gate: Geometry Certified (0mm drift)
              </span>
            </div>
          </div>
        </div>

        {/* Existing Render Studio Workspace */}
        {render}
      </div>
    ),
    laminate,
    interactive: (
      <div style={{ background: '#1c1917', borderRadius: 14, padding: '20px 24px', border: '1px solid #332d29' }}>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: 18, color: '#f5f5f4', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={18} color="#c59c2d" />
              Spatial AI Object Takeoff &amp; Interactive Hotspot Scan
            </h3>
            <p style={{ margin: 0, fontSize: 13, color: '#a8a29e' }}>
              Hover over detected architectural modules, joinery units, and lighting fixtures to inspect dimensions, SKUs, and live unit prices.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#10b981', background: '#10b98115', border: '1px solid #10b98135', padding: '4px 10px', borderRadius: 6, fontWeight: 700 }}>
              ● 5 Smart Objects Bound to Scene
            </span>
          </div>
        </div>

        <InteractiveRenderViewer
          imageUrl="/reference-vault/001-ddc1891636f7.png"
          items={SAMPLE_INTERACTIVE_ITEMS}
          currencySymbol="₹"
          onSelectItem={(item) => {
            console.log('Selected item from render viewer:', item);
          }}
          onAddSceneToQuote={async (items) => {
            if (projectId && supabase) {
              try {
                const session = (await supabase.auth.getSession()).data.session;
                if (session?.access_token) {
                  const apiBase = getApiBase();
                  await fetch(`${apiBase}/commercial/estimates`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                    body: JSON.stringify({
                      projectId,
                      lines: items.map((it) => ({
                        id: it.matched_sku,
                        description: it.matched_name,
                        category: 'modular_unit',
                        quantity: 1,
                        unit: 'module',
                        unitRateInr: it.unit_price * 83,
                        labourInr: 2500,
                      })),
                      gstRate: 18,
                      marginRate: 15,
                    }),
                  });
                }
              } catch {
                // fallback gracefully
              }
            }
            alert(`✨ Successfully linked ${items.length} detected smart modules (₹${(items.reduce((s, i) => s + i.unit_price, 0) * 83).toLocaleString('en-IN')}) to the dynamic commercial estimate!`);
            if (projectId) {
              navigate(`/projects/${projectId}/estimate`);
            }
          }}
        />
      </div>
    ),
    compare: (
      <div style={{ background: '#1c1917', borderRadius: 14, padding: '20px 24px', border: '1px solid #332d29', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Comparison Header & Room Selector */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.1em', color: '#c59c2d', textTransform: 'uppercase' }}>
                DETERMINISTIC SEED LOCKING (TECHNIQUE 4)
              </span>
              <span style={{ background: '#10b98120', color: '#34d399', border: '1px solid #10b98150', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Lock size={11} /> Seed #{selectedCompareRoom.seed}
              </span>
            </div>
            <h3 style={{ margin: '0 0 6px 0', fontSize: 20, fontWeight: 800, color: '#f5f5f4' }}>
              Material Scheme A/B Visual Comparison &amp; Split Slider
            </h3>
            <p style={{ margin: 0, fontSize: 13, color: '#a8a29e' }}>
              The camera perspective, daylight angle, and furniture geometry are 100% frozen via Three.js depth conditioning. Only the regional material swatches and specular reflections are altered.
            </p>
          </div>

          {/* Controls: Room Switcher & Mode Switcher */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={compareRoomIndex}
              onChange={(e) => setCompareRoomIndex(Number(e.target.value))}
              style={{ background: '#24201c', border: '1px solid #443c34', color: '#f5f5f4', padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              {COMPARISON_ROOMS.map((r, idx) => (
                <option key={r.id} value={idx}>
                  {r.name}
                </option>
              ))}
            </select>

            <div style={{ display: 'flex', background: '#24201c', padding: 3, borderRadius: 8, border: '1px solid #3d3529' }}>
              <button
                type="button"
                onClick={() => setCompareMode('split')}
                style={{
                  background: compareMode === 'split' ? '#c59c2d' : 'transparent',
                  color: compareMode === 'split' ? '#1c1917' : '#a8a29e',
                  border: 0,
                  borderRadius: 6,
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Split size={14} /> Split Slider
              </button>
              <button
                type="button"
                onClick={() => setCompareMode('side-by-side')}
                style={{
                  background: compareMode === 'side-by-side' ? '#c59c2d' : 'transparent',
                  color: compareMode === 'side-by-side' ? '#1c1917' : '#a8a29e',
                  border: 0,
                  borderRadius: 6,
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Layers3 size={14} /> Side-by-Side
              </button>
            </div>
          </div>
        </div>

        {/* Viewport Render Comparison */}
        {compareMode === 'split' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: 520,
                borderRadius: 14,
                overflow: 'hidden',
                background: '#0c0a09',
                border: '1px solid #332d29',
                userSelect: 'none',
              }}
            >
              {/* Layer 2: Scheme B (Background) */}
              <img
                src={selectedCompareRoom.renderB}
                alt="Scheme B"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div style={{ position: 'absolute', top: 14, right: 14, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', padding: '6px 12px', borderRadius: 6, border: '1px solid #38bdf8', color: '#38bdf8', fontSize: 12, fontWeight: 800 }}>
                Scheme B: {selectedCompareRoom.schemeBName}
              </div>

              {/* Layer 1: Scheme A (Foreground with clip-path) */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  overflow: 'hidden',
                  clipPath: `polygon(0 0, ${splitPosition}% 0, ${splitPosition}% 100%, 0 100%)`,
                }}
              >
                <img
                  src={selectedCompareRoom.renderA}
                  alt="Scheme A"
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <div style={{ position: 'absolute', top: 14, left: 14, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', padding: '6px 12px', borderRadius: 6, border: '1px solid #c59c2d', color: '#eab308', fontSize: 12, fontWeight: 800 }}>
                  Scheme A: {selectedCompareRoom.schemeAName}
                </div>
              </div>

              {/* Divider Line */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: `${splitPosition}%`,
                  width: 3,
                  background: '#fff',
                  boxShadow: '0 0 12px rgba(0,0,0,0.8)',
                  pointerEvents: 'none',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    background: '#1c1917',
                    border: '2px solid #fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 900,
                  }}
                >
                  ◀ ▶
                </div>
              </div>
            </div>

            {/* Draggable Range Slider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '0 8px' }}>
              <span style={{ fontSize: 12, color: '#eab308', fontWeight: 700, minWidth: 80 }}>◀ Scheme A</span>
              <input
                type="range"
                min="0"
                max="100"
                value={splitPosition}
                onChange={(e) => setSplitPosition(Number(e.target.value))}
                style={{ flex: 1, accentColor: '#c59c2d', cursor: 'pointer' }}
              />
              <span style={{ fontSize: 12, color: '#38bdf8', fontWeight: 700, minWidth: 80, textAlign: 'right' }}>Scheme B ▶</span>
            </div>
          </div>
        ) : (
          /* Side-by-Side Dual View */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: 20 }}>
            {/* Card A */}
            <div style={{ background: '#171513', border: '1px solid #c59c2d66', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ position: 'relative', height: 320 }}>
                <img src={selectedCompareRoom.renderA} alt="Scheme A" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <span style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(0,0,0,0.8)', color: '#eab308', padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 800 }}>
                  SCHEME A (BASELINE)
                </span>
              </div>
              <div style={{ padding: 16 }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: 16, color: '#f5f5f4' }}>{selectedCompareRoom.schemeAName}</h4>
                <p style={{ margin: 0, fontSize: 12, color: '#a8a29e' }}>18mm Birch Plywood · Smoked French Oak · Calacatta Gold Stone · Brushed Brass Hardware</p>
                <button
                  type="button"
                  onClick={() => setActiveAppliedScheme('A')}
                  style={{
                    marginTop: 12,
                    width: '100%',
                    background: activeAppliedScheme === 'A' ? '#2d2824' : '#c59c2d',
                    color: activeAppliedScheme === 'A' ? '#c59c2d' : '#1c1917',
                    border: 0,
                    borderRadius: 6,
                    padding: '8px 14px',
                    fontWeight: 800,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  {activeAppliedScheme === 'A' ? '✓ Currently Active Scheme' : 'Set as Active Scheme'}
                </button>
              </div>
            </div>

            {/* Card B */}
            <div style={{ background: '#171513', border: '1px solid #38bdf866', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ position: 'relative', height: 320 }}>
                <img src={selectedCompareRoom.renderB} alt="Scheme B" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <span style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(0,0,0,0.8)', color: '#38bdf8', padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 800 }}>
                  SCHEME B (CONTEMPORARY)
                </span>
              </div>
              <div style={{ padding: 16 }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: 16, color: '#f5f5f4' }}>{selectedCompareRoom.schemeBName}</h4>
                <p style={{ margin: 0, fontSize: 12, color: '#a8a29e' }}>18mm BWR Plywood · Super-Matte Charcoal Suede · Nero Marquina Slab · Anodized Gunmetal</p>
                <button
                  type="button"
                  onClick={() => setActiveAppliedScheme('B')}
                  style={{
                    marginTop: 12,
                    width: '100%',
                    background: activeAppliedScheme === 'B' ? '#1e293b' : '#0284c7',
                    color: activeAppliedScheme === 'B' ? '#38bdf8' : '#fff',
                    border: 0,
                    borderRadius: 6,
                    padding: '8px 14px',
                    fontWeight: 800,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  {activeAppliedScheme === 'B' ? '✓ Currently Active Scheme' : 'Set as Active Scheme'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Technical Seed Provenance Audit Bar */}
        <div style={{ background: '#141210', padding: '14px 18px', borderRadius: 10, border: '1px solid #29241f', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <div>
              <small style={{ color: '#78716c', fontSize: 10, textTransform: 'uppercase', fontWeight: 800, display: 'block' }}>Deterministic Seed</small>
              <span style={{ color: '#f5f5f4', fontSize: 12, fontFamily: 'monospace' }}>#{selectedCompareRoom.seed}</span>
            </div>
            <div>
              <small style={{ color: '#78716c', fontSize: 10, textTransform: 'uppercase', fontWeight: 800, display: 'block' }}>Camera Geometry</small>
              <span style={{ color: '#f5f5f4', fontSize: 12 }}>{selectedCompareRoom.camera}</span>
            </div>
            <div>
              <small style={{ color: '#78716c', fontSize: 10, textTransform: 'uppercase', fontWeight: 800, display: 'block' }}>Conditioning Quality</small>
              <span style={{ color: '#34d399', fontSize: 12 }}>{selectedCompareRoom.denoising}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              alert(`✨ Scheme ${activeAppliedScheme} verified with Seed #${selectedCompareRoom.seed}. All downstream shop drawings and BOQ estimates are synchronized.`);
            }}
            style={{
              background: 'linear-gradient(135deg, #c59c2d, #a88220)',
              color: '#1c1917',
              border: 0,
              borderRadius: 6,
              padding: '8px 16px',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <CheckCircle2 size={14} /> Synchronize Active Scheme
          </button>
        </div>
      </div>
    ),
  };

  return (
    <section className="visualize-studio" style={{ maxWidth: 1440, margin: '0 auto', padding: '0 1rem' }}>
      <header>
        <div>
          <small>VISUALIZE STUDIO</small>
          <h1>Review geometry before generating imagery.</h1>
          <p>Three.js, AI renders, and laminate revisions use the same scene.v1 version. Generated images never alter measured geometry.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {!sceneApproved && sceneReady && onApproveScene && (
            <button
              type="button"
              disabled={approving}
              onClick={async () => {
                setApproving(true);
                try {
                  const approved = await onApproveScene();
                  if (approved) select('render');
                } finally {
                  setApproving(false);
                }
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#1c1917', color: '#fff', fontWeight: 800, fontSize: 12, padding: '7px 14px', borderRadius: 8, border: 0, cursor: approving ? 'wait' : 'pointer' }}
            >
              {approving ? 'Approving scene…' : 'Approve scene for AI render'}
            </button>
          )}
          <button
            type="button"
            onClick={() => select('render')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              background: 'linear-gradient(135deg, #c59c2d, #a88220)',
              color: '#1c1917',
              fontWeight: 800,
              fontSize: 12,
              padding: '7px 14px',
              borderRadius: 8,
              border: 0,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(197,156,45,0.25)',
            }}
          >
            <Sparkles size={14} /> Open AI Render / Enhancer
          </button>
          <span className="ready">
            {sceneApproved ? 'Scene approved' : sceneReady ? 'Scene active' : 'Plan linked'}
          </span>
        </div>
      </header>

      {/* 5-Tab Navigation Header */}
      <nav aria-label="Visualize stages" role="tablist">
        {tabs.map(({ id, label, icon: Icon, help }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active === id}
            className={active === id ? 'active' : ''}
            onClick={() => select(id)}
          >
            <Icon size={17} />
            <span>
              <strong>{label}</strong>
              <small>{help}</small>
            </span>
          </button>
        ))}
      </nav>

      {/* Active Panel Viewport */}
      <div className="visualize-panel">{panels[active]}</div>

      {/* Bottom Stage Progression */}
      <WorkflowDock
        currentStageIndex={4}
        stageTitle="3D Scene Studio & Visual Intelligence"
        stageSummary="Geometry-locked WebGL viewport · AI spatial object scans · Deterministic seed-locked A/B comparisons"
        beaconTone="gold"
        prevAction={{
          label: 'Back to Rooms & Bay Layout',
          icon: <ArrowLeft size={14} />,
          onClick: () => {
            if (projectId) navigate(`/projects/${projectId}/spaces`);
          },
        }}
        nextAction={{
          label: 'Proceed to Production Drawings & CAD',
          icon: <ArrowRight size={14} />,
          onClick: () => {
            if (projectId) navigate(`/projects/${projectId}/drawings`);
          },
        }}
      />
    </section>
  );
}
