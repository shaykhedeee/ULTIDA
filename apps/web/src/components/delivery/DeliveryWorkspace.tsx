import {
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  LockKeyhole,
  Save,
  ArrowLeft,
  Check,
  Palette,
  Sparkles,
  Maximize2,
  X,
  SlidersHorizontal,
  Award,
  ShieldCheck,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Card, CardContent, CardHeader, Button } from '../ui/primitives';
import { supabase } from '../../lib/supabase';

type Props = { 
  briefSaved: boolean; 
  planApproved: boolean; 
  sceneVersionId: string | null; 
  moduleCount: number; 
  providerReady: boolean;
  projectId: string | null;
};

type DeliveryData = {
  productionReleased: boolean;
  clientApproved: boolean;
  installationStatus: 'not_started' | 'ongoing' | 'completed';
  snaggingStatus: 'none' | 'active_snags' | 'resolved';
  warrantyActive: boolean;
  notes: string;
};

const defaultDelivery: DeliveryData = {
  productionReleased: false,
  clientApproved: false,
  installationStatus: 'not_started',
  snaggingStatus: 'none',
  warrantyActive: false,
  notes: ''
};

interface RoomPresentationCard {
  id: string;
  name: string;
  areaSqm: number;
  renderUrl: string;
  tagline: string;
  cabinetry: string;
  finishes: {
    carcass: string;
    shutter: string;
    countertop: string;
    hardware: string;
  };
  flooring: {
    material: string;
    grout: string;
    skirting: string;
  };
}

const PRESENTATION_ROOMS: RoomPresentationCard[] = [
  {
    id: 'room-living',
    name: 'Living & Dining Great Room',
    areaSqm: 38.4,
    renderUrl: '/reference-vault/002-cab37cfa0bb2.png',
    tagline: 'Warm Amber Daylight · Smoked Oak Fluting · 3000K Architectural Cove Lighting',
    cabinetry: '3200mm Full-Height Fluted TV Console & Bar Cabinet with 30mm Dummy Fillers',
    finishes: {
      carcass: '18mm HDHMR Smoked Oak (#654321)',
      shutter: 'High-Gloss Champagne Acrylic & Fluted Wood Louvers (#F7F7F2)',
      countertop: '40mm Calacatta Honed Quartz Slab (#F3EDE2)',
      hardware: 'Blum Clip-Top 110° Soft-Close Hinges + Concealed Gola Profiles',
    },
    flooring: {
      material: '1200×600mm Statuario Polished Porcelain Slab',
      grout: 'Titanium Grey 2mm Flush',
      skirting: '100mm Flush Aluminium Shadowline Skirting (34.2m net)',
    },
  },
  {
    id: 'room-kitchen',
    name: 'Architectural Modular Kitchen',
    areaSqm: 19.8,
    renderUrl: '/reference-vault/001-ddc1891636f7.png',
    tagline: 'Dual-Tone Ergonomics · Deep Drawers & Lift-Up Bi-Fold Wall Units',
    cabinetry: '5400mm Total Base + Wall Run, 850mm Countertop Datum, 100mm Waterproof PVC Plinth',
    finishes: {
      carcass: '18mm Marine Grade BWP Plywood with 0.8mm Inner Liner',
      shutter: 'Ultra-Matte Anti-Fingerprint Acrylic Shutters',
      countertop: '40mm Calacatta Gold Engineered Quartz with 20mm Bullnose Bevel',
      hardware: 'Hettich Atira Double-Walled Soft-Close Drawers (40kg Rating)',
    },
    flooring: {
      material: '600×600mm Anti-Skid Flamed Slate Vitrified Tiles',
      grout: 'Charcoal Noir 3mm',
      skirting: '100mm Vitrified Skirting with Silicone Expansion Joint (18.6m net)',
    },
  },
  {
    id: 'room-master',
    name: 'Master Bedroom Suite',
    areaSqm: 26.5,
    renderUrl: '/reference-vault/006-e36e2c7c9b1a.png',
    tagline: 'Anodized Profile-Glass Wardrobe · Floating Headboard & Integrated Dressing Alcove',
    cabinetry: '2800mm 4-Door Full-Height Wardrobe with 2100mm Lintel & 600mm Top Lofts',
    finishes: {
      carcass: '18mm HDHMR Natural Teak Grain',
      shutter: 'Bronze Tinted Profile-Glass with Concealed 4000K Vertical LED Channels',
      countertop: 'Solid American Walnut Dressing Vanity Counter',
      hardware: 'Blum Tip-On Push-to-Open + Long-Profile Brushed Brass Handles',
    },
    flooring: {
      material: '190×1200mm Engineered Smoked French Oak Herringbone Parquet',
      grout: 'Seamless Micro-Bevel Interlock',
      skirting: '75mm Natural Walnut Solid Wood Skirting (24.0m net)',
    },
  },
  {
    id: 'room-study',
    name: 'Executive Study & Library',
    areaSqm: 15.2,
    renderUrl: '/reference-vault/011-6c55d3439149.png',
    tagline: 'Floating Cantilever Desk · Open Acoustic Book Niche · Wire Management Glands',
    cabinetry: '2400mm Wall-Hung Bookshelf Unit with Acoustic Felt Backing',
    finishes: {
      carcass: '18mm Birch Plywood Core with Matte Polyurethane Seal',
      shutter: 'Super-Matte Charcoal Suede Doors (#2B2622)',
      countertop: '36mm Solid Oak Finger-Joint Desk Slab with Rounded Chamfer',
      hardware: 'Blum Aventos HF Bi-Fold Lift Mechanisms',
    },
    flooring: {
      material: '600×1200mm Ash Grey Honed Vitrified Tiles',
      grout: 'Titanium Grey 2mm',
      skirting: '75mm Anodized Black Metal Skirting (16.4m net)',
    },
  },
];

export function DeliveryWorkspace({ briefSaved, planApproved, sceneVersionId, moduleCount, providerReady, projectId }: Props) {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'presentation' | 'comparison' | 'gates'>('presentation');
  const [delivery, setDelivery] = useState<DeliveryData>(defaultDelivery);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const [hasApprovedQuote, setHasApprovedQuote] = useState(false);
  const [approvedStages, setApprovedStages] = useState<string[]>([]);

  const [selectedScheme, setSelectedScheme] = useState<'A' | 'B'>(() => {
    if (!projectId) return 'A';
    try {
      return (window.localStorage.getItem(`ultida.activeScheme.${projectId}`) as 'A' | 'B') || 'A';
    } catch {
      return 'A';
    }
  });

  const [lightboxRoom, setLightboxRoom] = useState<RoomPresentationCard | null>(null);
  const [showSignOffModal, setShowSignOffModal] = useState(false);
  const [clientSignName, setClientSignName] = useState('');
  const [signedTimestamp, setSignedTimestamp] = useState<string | null>(() => {
    if (!projectId) return null;
    try {
      return window.localStorage.getItem(`ultida.signedTimestamp.${projectId}`);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (!supabase || !projectId) return;
    supabase
      .from('projects')
      .select('delivery_records')
      .eq('id', projectId)
      .single()
      .then(({ data }) => {
        if (data?.delivery_records) {
          setDelivery({ ...defaultDelivery, ...data.delivery_records });
        }
      });

    supabase
      .from('quotes')
      .select('status')
      .eq('project_id', projectId)
      .eq('status', 'approved')
      .then(({ data }) => {
        if (data && data.length > 0) {
          setHasApprovedQuote(true);
        }
      });
    supabase.auth.getSession().then(async ({ data: session }) => {
      if (!session.session) return;
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/operations`, { headers: { authorization: `Bearer ${session.session.access_token}` } });
      if (!response.ok) return;
      const payload = await response.json();
      setApprovedStages((payload.reviews ?? []).filter((review: any) => review.status === 'approved').map((review: any) => review.stage));
    });
  }, [projectId]);

  async function handleSave() {
    if (!supabase || !projectId) return;
    setSaving(true);
    setStatusMsg('');
    const { error } = await supabase
      .from('projects')
      .update({ delivery_records: delivery })
      .eq('id', projectId);
    setSaving(false);
    if (error) {
      setStatusMsg(`Error: ${error.message}`);
    } else {
      setStatusMsg('Delivery records saved successfully.');
    }
  }

  const handleSelectScheme = (scheme: 'A' | 'B') => {
    setSelectedScheme(scheme);
    if (projectId) {
      try {
        window.localStorage.setItem(`ultida.activeScheme.${projectId}`, scheme);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleConfirmSignOff = async () => {
    if (!clientSignName.trim()) return;
    const nowIso = new Date().toISOString();
    setSignedTimestamp(nowIso);
    const updated = { ...delivery, clientApproved: true };
    setDelivery(updated);
    if (projectId) {
      try {
        window.localStorage.setItem(`ultida.signedTimestamp.${projectId}`, nowIso);
        window.localStorage.setItem(`ultida.signedClientName.${projectId}`, clientSignName.trim());
      } catch (err) {
        console.error(err);
      }
      if (supabase) {
        await supabase.from('projects').update({ delivery_records: updated }).eq('id', projectId);
      }
    }
    setShowSignOffModal(false);
  };

  const savedClientName = (() => {
    if (!projectId) return 'Authorized Client';
    try {
      return window.localStorage.getItem(`ultida.signedClientName.${projectId}`) || 'Authorized Client';
    } catch {
      return 'Authorized Client';
    }
  })();

  const gates = [
    { label: 'Client brief', detail: 'Scope, budget and approval notes are saved.', ready: briefSaved, status: briefSaved ? 'Ready' : 'Blocked' },
    { label: 'Approved plan', detail: 'Measured geometry is approved for downstream work.', ready: planApproved, status: planApproved ? 'Ready' : 'Blocked' },
    { label: 'Scene version', detail: moduleCount ? `${moduleCount} modules are linked to the current scene.` : 'A scene with approved modules is required.', ready: Boolean(sceneVersionId && moduleCount), status: sceneVersionId && moduleCount ? 'Ready' : 'Blocked' },
    { label: 'Visual provenance', detail: providerReady ? 'At least one visual provider is configured.' : 'No configured provider; visual output remains unavailable.', ready: providerReady, status: providerReady ? 'Ready' : 'Blocked' },
    { label: 'Production release', detail: (delivery.productionReleased && hasApprovedQuote) ? 'Drawings, cutlist and quote approved for release.' : 'Drawings, cutlist and quote require designer and quote confirmation.', ready: delivery.productionReleased && hasApprovedQuote, status: (delivery.productionReleased && hasApprovedQuote) ? 'Ready' : 'Needs review' },
    { label: 'Client handover', detail: delivery.clientApproved && delivery.installationStatus === 'completed' && delivery.snaggingStatus === 'resolved' && delivery.warrantyActive ? 'Handover completed, warranty active.' : 'Installation, snagging and warranty records are pending.', ready: delivery.clientApproved && delivery.installationStatus === 'completed' && delivery.snaggingStatus === 'resolved' && delivery.warrantyActive, status: (delivery.clientApproved && delivery.installationStatus === 'completed' && delivery.snaggingStatus === 'resolved' && delivery.warrantyActive) ? 'Ready' : 'Blocked' }
  ];

  const blockers = gates.filter((gate) => !gate.ready);

  return (
    <section className="delivery-workspace" style={{ maxWidth: 1400, margin: '0 auto', padding: '1.5rem' }}>
      {/* Workspace Header & Sign-Off Banner */}
      <div className="workspace-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: '#c59c2d', textTransform: 'uppercase' }}>
              STAGE 8: CLIENT PRESENTATION &amp; HANDOVER
            </span>
            <span style={{ background: selectedScheme === 'A' ? '#c59c2d25' : '#38bdf825', color: selectedScheme === 'A' ? '#eab308' : '#38bdf8', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, border: `1px solid ${selectedScheme === 'A' ? '#c59c2d66' : '#38bdf866'}` }}>
              Scheme {selectedScheme} Active
            </span>
            {signedTimestamp && (
              <span style={{ background: '#10b98125', color: '#34d399', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, border: '1px solid #10b98166', display: 'flex', alignItems: 'center', gap: 4 }}>
                <ShieldCheck size={12} /> Sign-off Verified
              </span>
            )}
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: '#f5f5f4', margin: '0 0 6px 0' }}>
            Luxury Villa Master Presentation &amp; Release Control
          </h2>
          <p style={{ fontSize: 14, color: '#a8a29e', margin: 0 }}>
            Curated 4K architectural render walkthroughs, interactive Scheme A/B material selections, and digital milestone handover sign-offs.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {signedTimestamp ? (
            <div style={{ background: '#1c1917', border: '1px solid #059669', padding: '8px 14px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Award size={18} color="#10b981" />
              <div style={{ textAlign: 'left' }}>
                <small style={{ color: '#10b981', fontWeight: 800, fontSize: 10, textTransform: 'uppercase', display: 'block' }}>Digitally Approved</small>
                <strong style={{ color: '#f5f5f4', fontSize: 12 }}>{savedClientName}</strong>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowSignOffModal(true)}
              style={{
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: '#fff',
                border: 0,
                borderRadius: 8,
                padding: '10px 18px',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.25)',
              }}
            >
              <Award size={16} /> Digital Client Sign-Off
            </button>
          )}

          <Badge tone={blockers.length ? 'accent' : 'success'}>
            {blockers.length ? `${blockers.length} blockers` : 'Ready to release'}
          </Badge>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid #332d29', paddingBottom: 12 }}>
        <button
          type="button"
          onClick={() => setViewMode('presentation')}
          style={{
            background: viewMode === 'presentation' ? '#c59c2d' : '#231f1c',
            color: viewMode === 'presentation' ? '#1c1917' : '#d6d3d1',
            border: `1px solid ${viewMode === 'presentation' ? '#c59c2d' : '#3a342f'}`,
            borderRadius: 6,
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.15s ease',
          }}
        >
          <Sparkles size={15} /> 4K Client Presentation Deck
        </button>

        <button
          type="button"
          onClick={() => setViewMode('comparison')}
          style={{
            background: viewMode === 'comparison' ? '#c59c2d' : '#231f1c',
            color: viewMode === 'comparison' ? '#1c1917' : '#d6d3d1',
            border: `1px solid ${viewMode === 'comparison' ? '#c59c2d' : '#3a342f'}`,
            borderRadius: 6,
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.15s ease',
          }}
        >
          <SlidersHorizontal size={15} /> Material Scheme A/B Options
        </button>

        <button
          type="button"
          onClick={() => setViewMode('gates')}
          style={{
            background: viewMode === 'gates' ? '#c59c2d' : '#231f1c',
            color: viewMode === 'gates' ? '#1c1917' : '#d6d3d1',
            border: `1px solid ${viewMode === 'gates' ? '#c59c2d' : '#3a342f'}`,
            borderRadius: 6,
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.15s ease',
          }}
        >
          <ClipboardCheck size={15} /> Release Checklist &amp; Gates ({blockers.length} pending)
        </button>
      </div>

      {/* VIEW MODE 1: CLIENT PRESENTATION DECK */}
      {viewMode === 'presentation' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(620px, 1fr))', gap: 24 }}>
            {PRESENTATION_ROOMS.map((room) => (
              <div
                key={room.id}
                style={{
                  background: '#1c1917',
                  border: '1px solid #332d29',
                  borderRadius: 12,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                }}
              >
                {/* 4K Image Preview Container */}
                <div style={{ position: 'relative', height: 320, background: '#12100e', overflow: 'hidden' }}>
                  <img
                    src={room.renderUrl}
                    alt={room.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.3s ease' }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/reference-vault/001-ddc1891636f7.png';
                    }}
                  />
                  <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 8 }}>
                    <span style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', color: '#eab308', padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      4K RENDER
                    </span>
                    <span style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', color: '#f5f5f4', padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                      {room.areaSqm} m²
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLightboxRoom(room)}
                    style={{
                      position: 'absolute',
                      top: 12,
                      right: 12,
                      background: 'rgba(28,25,23,0.85)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      color: '#fff',
                      padding: '6px 12px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      backdropFilter: 'blur(4px)',
                    }}
                  >
                    <Maximize2 size={13} /> Fullscreen
                  </button>
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '24px 16px 12px', background: 'linear-gradient(to top, rgba(18,16,14,0.95), transparent)' }}>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: 20, fontWeight: 800, color: '#f5f5f4' }}>{room.name}</h3>
                    <p style={{ margin: 0, fontSize: 12, color: '#d6d3d1', fontStyle: 'italic' }}>{room.tagline}</p>
                  </div>
                </div>

                {/* Specs & Finishes Grid */}
                <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16, flex: 1, justifyContent: 'space-between' }}>
                  {/* System 32 Cabinetry Detail */}
                  <div style={{ background: '#24201c', padding: '12px 14px', borderRadius: 8, border: '1px solid #38332e' }}>
                    <small style={{ color: '#c59c2d', fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                      System 32 Modular Cabinetry
                    </small>
                    <p style={{ margin: 0, fontSize: 13, color: '#f5f5f4', fontWeight: 600 }}>{room.cabinetry}</p>
                  </div>

                  {/* Finishes Breakdown */}
                  <div>
                    <small style={{ color: '#a8a29e', fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                      Engineered Material Finishes (Scheme {selectedScheme})
                    </small>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                      <div style={{ background: '#171513', padding: '8px 10px', borderRadius: 6, border: '1px solid #2d2824' }}>
                        <span style={{ fontSize: 10, color: '#a8a29e', display: 'block' }}>Carcass Substrate:</span>
                        <strong style={{ fontSize: 12, color: '#e7e5e4' }}>{room.finishes.carcass}</strong>
                      </div>
                      <div style={{ background: '#171513', padding: '8px 10px', borderRadius: 6, border: '1px solid #2d2824' }}>
                        <span style={{ fontSize: 10, color: '#a8a29e', display: 'block' }}>Shutter Facia:</span>
                        <strong style={{ fontSize: 12, color: '#eab308' }}>{room.finishes.shutter}</strong>
                      </div>
                      <div style={{ background: '#171513', padding: '8px 10px', borderRadius: 6, border: '1px solid #2d2824' }}>
                        <span style={{ fontSize: 10, color: '#a8a29e', display: 'block' }}>Countertop / Slab:</span>
                        <strong style={{ fontSize: 12, color: '#e7e5e4' }}>{room.finishes.countertop}</strong>
                      </div>
                      <div style={{ background: '#171513', padding: '8px 10px', borderRadius: 6, border: '1px solid #2d2824' }}>
                        <span style={{ fontSize: 10, color: '#a8a29e', display: 'block' }}>Hardware &amp; Runners:</span>
                        <strong style={{ fontSize: 12, color: '#e7e5e4' }}>{room.finishes.hardware}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Flooring Studio Integration */}
                  <div style={{ background: '#1a1816', padding: '10px 12px', borderRadius: 6, border: '1px dashed #443c34', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <small style={{ color: '#78716c', fontSize: 10, textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>
                        Flooring &amp; Skirting Takeoff
                      </small>
                      <span style={{ fontSize: 12, color: '#d6d3d1' }}>{room.flooring.material}</span>
                    </div>
                    <span style={{ fontSize: 11, color: '#a8a29e', background: '#292524', padding: '3px 8px', borderRadius: 4 }}>
                      {room.flooring.skirting}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW MODE 2: MATERIAL SCHEME A/B COMPARISON */}
      {viewMode === 'comparison' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ background: '#1c1917', border: '1px solid #332d29', padding: '16px 20px', borderRadius: 10 }}>
            <h3 style={{ margin: '0 0 6px 0', fontSize: 18, fontWeight: 800, color: '#f5f5f4' }}>
              Material Scheme Comparison &amp; Mood Board Selection
            </h3>
            <p style={{ margin: 0, fontSize: 13, color: '#a8a29e' }}>
              Toggle between Scheme A (Warm Amber &amp; Smoked Oak) and Scheme B (Contemporary Fluted Suede &amp; Noir Slate). The active scheme propagates across all wall elevations, cutlists, and client deliverables.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: 24 }}>
            {/* SCHEME A */}
            <div
              style={{
                background: selectedScheme === 'A' ? '#211d18' : '#171513',
                border: `2px solid ${selectedScheme === 'A' ? '#c59c2d' : '#2d2824'}`,
                borderRadius: 12,
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
                gap: 18,
                position: 'relative',
              }}
            >
              {selectedScheme === 'A' && (
                <div style={{ position: 'absolute', top: 16, right: 16, background: '#c59c2d', color: '#1c1917', padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 900, textTransform: 'uppercase' }}>
                  ✓ Currently Active
                </div>
              )}
              <div>
                <small style={{ color: '#c59c2d', fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  SCHEME A: SIGNATURE LUXURY
                </small>
                <h3 style={{ fontSize: 22, fontWeight: 800, color: '#f5f5f4', margin: '4px 0 6px 0' }}>
                  Warm Amber &amp; Smoked French Oak
                </h3>
                <p style={{ fontSize: 13, color: '#a8a29e', margin: 0 }}>
                  Warm natural tones, architectural fluted solid oak elements, champagne bronze hardware, and Italian Calacatta Gold stone.
                </p>
              </div>

              {/* Color Swatches */}
              <div>
                <small style={{ color: '#78716c', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                  Palette Color Swatches
                </small>
                <div style={{ display: 'flex', gap: 10 }}>
                  {[
                    { name: 'Smoked Oak', hex: '#634b35' },
                    { name: 'Warm Amber', hex: '#b5793d' },
                    { name: 'Calacatta Gold', hex: '#f0ece1' },
                    { name: 'Champagne Bronze', hex: '#c5a059' },
                    { name: 'Birch Core', hex: '#d9c5a0' },
                  ].map((swatch) => (
                    <div key={swatch.name} style={{ textAlign: 'center' }}>
                      <div style={{ width: 42, height: 42, borderRadius: 8, background: swatch.hex, border: '2px solid rgba(255,255,255,0.15)', margin: '0 auto 4px' }} />
                      <span style={{ fontSize: 9, color: '#a8a29e', display: 'block', maxWidth: 44, lineHeight: 1.1 }}>{swatch.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Spec Details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: '#1c1917', padding: 14, borderRadius: 8, border: '1px solid #2d2824' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: '#a8a29e' }}>Carcass Substrate:</span>
                  <strong style={{ color: '#f5f5f4' }}>18mm Marine Grade Birch Plywood</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: '#a8a29e' }}>Shutter Facade:</span>
                  <strong style={{ color: '#eab308' }}>Amber Fluted Solid Oak &amp; Matte Champagne</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: '#a8a29e' }}>Countertop Slab:</span>
                  <strong style={{ color: '#f5f5f4' }}>20mm Calacatta Gold Honed Quartz</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: '#a8a29e' }}>Hardware Spec:</span>
                  <strong style={{ color: '#f5f5f4' }}>Blum Aventos HF + Blum Legrabox Orion Grey</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: '#a8a29e' }}>Flooring System:</span>
                  <strong style={{ color: '#f5f5f4' }}>190×1200mm Smoked French Oak Herringbone</strong>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleSelectScheme('A')}
                disabled={selectedScheme === 'A'}
                style={{
                  background: selectedScheme === 'A' ? '#2d2824' : 'linear-gradient(135deg, #c59c2d, #a88220)',
                  color: selectedScheme === 'A' ? '#78716c' : '#1c1917',
                  border: 0,
                  borderRadius: 8,
                  padding: '12px 18px',
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: selectedScheme === 'A' ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                {selectedScheme === 'A' ? 'Selected Scheme' : 'Activate Scheme A for All Elevations'}
              </button>
            </div>

            {/* SCHEME B */}
            <div
              style={{
                background: selectedScheme === 'B' ? '#182026' : '#171513',
                border: `2px solid ${selectedScheme === 'B' ? '#38bdf8' : '#2d2824'}`,
                borderRadius: 12,
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
                gap: 18,
                position: 'relative',
              }}
            >
              {selectedScheme === 'B' && (
                <div style={{ position: 'absolute', top: 16, right: 16, background: '#38bdf8', color: '#0c4a6e', padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 900, textTransform: 'uppercase' }}>
                  ✓ Currently Active
                </div>
              )}
              <div>
                <small style={{ color: '#38bdf8', fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  SCHEME B: CONTEMPORARY MINIMALIST
                </small>
                <h3 style={{ fontSize: 22, fontWeight: 800, color: '#f5f5f4', margin: '4px 0 6px 0' }}>
                  Fluted Suede &amp; Noir Slate Monolith
                </h3>
                <p style={{ fontSize: 13, color: '#a8a29e', margin: 0 }}>
                  Tactile super-matte charcoal suede, deep noir slate stone textures, anodized gunmetal profiles, and Statuario porcelain slabs.
                </p>
              </div>

              {/* Color Swatches */}
              <div>
                <small style={{ color: '#78716c', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                  Palette Color Swatches
                </small>
                <div style={{ display: 'flex', gap: 10 }}>
                  {[
                    { name: 'Charcoal Suede', hex: '#2b2622' },
                    { name: 'Noir Slate', hex: '#1c1b1a' },
                    { name: 'Gunmetal', hex: '#4a4d52' },
                    { name: 'Statuario', hex: '#ebecee' },
                    { name: 'Silver Ash', hex: '#8a8d91' },
                  ].map((swatch) => (
                    <div key={swatch.name} style={{ textAlign: 'center' }}>
                      <div style={{ width: 42, height: 42, borderRadius: 8, background: swatch.hex, border: '2px solid rgba(255,255,255,0.15)', margin: '0 auto 4px' }} />
                      <span style={{ fontSize: 9, color: '#a8a29e', display: 'block', maxWidth: 44, lineHeight: 1.1 }}>{swatch.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Spec Details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: '#1c1917', padding: 14, borderRadius: 8, border: '1px solid #2d2824' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: '#a8a29e' }}>Carcass Substrate:</span>
                  <strong style={{ color: '#f5f5f4' }}>18mm Boiling Water Resistant (BWR) Plywood</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: '#a8a29e' }}>Shutter Facade:</span>
                  <strong style={{ color: '#38bdf8' }}>Super-Matte Charcoal Suede &amp; Noir Slate</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: '#a8a29e' }}>Countertop Slab:</span>
                  <strong style={{ color: '#f5f5f4' }}>20mm Silestone Iconic Black Suede Quartz</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: '#a8a29e' }}>Hardware Spec:</span>
                  <strong style={{ color: '#f5f5f4' }}>Hafele Matrix Box Slim Anodized Gunmetal</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: '#a8a29e' }}>Flooring System:</span>
                  <strong style={{ color: '#f5f5f4' }}>800×1600mm Statuario Michelangelo Satin Vitrified</strong>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleSelectScheme('B')}
                disabled={selectedScheme === 'B'}
                style={{
                  background: selectedScheme === 'B' ? '#1e293b' : 'linear-gradient(135deg, #0284c7, #0369a1)',
                  color: selectedScheme === 'B' ? '#64748b' : '#fff',
                  border: 0,
                  borderRadius: 8,
                  padding: '12px 18px',
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: selectedScheme === 'B' ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                {selectedScheme === 'B' ? 'Selected Scheme' : 'Activate Scheme B for All Elevations'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODE 3: ORIGINAL GATES & DELIVERY WORKSPACE */}
      {viewMode === 'gates' && (
        <div className="delivery-layout">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <Card>
              <CardHeader>
                <div>
                  <small>RELEASE CHECKLIST</small>
                  <h3>Project readiness</h3>
                </div>
                <ClipboardCheck size={20} />
              </CardHeader>
              <CardContent>
                <div className="delivery-gates">
                  {gates.map((gate) => (
                    <article key={gate.label}>
                      <div className={`delivery-icon delivery-${gate.status.toLowerCase().replace(' ', '-')}`}>
                        {gate.ready ? <CheckCircle2 size={16} /> : <CircleAlert size={16} />}
                      </div>
                      <div>
                        <strong>{gate.label}</strong>
                        <p>{gate.detail}</p>
                      </div>
                      <Badge tone={gate.ready ? 'success' : 'accent'}>{gate.status}</Badge>
                    </article>
                  ))}
                </div>
              </CardContent>
            </Card>

            {projectId && (
              <Card>
                <CardHeader>
                  <div>
                    <small>UPDATE RECORDS</small>
                    <h3>Delivery &amp; Handover Records</h3>
                  </div>
                </CardHeader>
                <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={delivery.productionReleased} 
                      onChange={(e) => {
                        if (e.target.checked && !(briefSaved && planApproved && sceneVersionId && moduleCount && hasApprovedQuote && ['plan', 'scene', 'cutlist', 'quote'].every((stage) => approvedStages.includes(stage)))) {
                          setStatusMsg('Production release is locked until plan, scene, cutlist, and quote approvals are recorded.');
                          return;
                        }
                        setDelivery({ ...delivery, productionReleased: e.target.checked });
                      }}
                    />
                    <strong>Production Released (Approve drawings, DXF, cutlist, quote)</strong>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={delivery.clientApproved} 
                      onChange={(e) => setDelivery({ ...delivery, clientApproved: e.target.checked })} 
                    />
                    <strong>Client Approval Records Signed</strong>
                  </label>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <strong>Installation Status</strong>
                    <select 
                      value={delivery.installationStatus} 
                      onChange={(e: any) => setDelivery({ ...delivery, installationStatus: e.target.value })}
                      style={{ padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid #ccc' }}
                    >
                      <option value="not_started">Not Started</option>
                      <option value="ongoing">Ongoing</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <strong>Snagging Records</strong>
                    <select 
                      value={delivery.snaggingStatus} 
                      onChange={(e: any) => setDelivery({ ...delivery, snaggingStatus: e.target.value })}
                      style={{ padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid #ccc' }}
                    >
                      <option value="none">No Snags Recorded</option>
                      <option value="active_snags">Active Snags (Pending Action)</option>
                      <option value="resolved">All Snags Resolved</option>
                    </select>
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={delivery.warrantyActive} 
                      onChange={(e) => setDelivery({ ...delivery, warrantyActive: e.target.checked })} 
                    />
                    <strong>Warranty Active &amp; Registered</strong>
                  </label>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <strong>Delivery Notes</strong>
                    <textarea 
                      value={delivery.notes} 
                      onChange={(e) => setDelivery({ ...delivery, notes: e.target.value })}
                      placeholder="Enter site installation details, warranty registration codes, or snagging lists..."
                      style={{ padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid #ccc', minHeight: '80px' }}
                    />
                  </div>

                  <Button onClick={handleSave} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                    <Save size={16} />
                    {saving ? 'Saving...' : 'Save Records'}
                  </Button>
                  {statusMsg && <p style={{ fontSize: '0.85rem', color: statusMsg.startsWith('Error') ? 'red' : 'green' }}>{statusMsg}</p>}
                </CardContent>
              </Card>
            )}
          </div>

          <Card className="delivery-side">
            <CardHeader>
              <div>
                <small>NEXT ACTION</small>
                <h3>{blockers[0]?.label ?? 'Release project'}</h3>
              </div>
              <LockKeyhole size={20} />
            </CardHeader>
            <CardContent>
              <p>{blockers[0]?.detail ?? 'All known gates are ready for release review.'}</p>
              <div className="delivery-summary">
                <span>Open blockers</span>
                <strong>{blockers.length}</strong>
              </div>
              <div className="delivery-summary">
                <span>Scene modules</span>
                <strong>{moduleCount}</strong>
              </div>
              <div className="delivery-summary">
                <span>Release state</span>
                <strong>{blockers.length ? 'Blocked' : 'Ready'}</strong>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 4K LIGHTBOX MODAL */}
      {lightboxRoom && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setLightboxRoom(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.92)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: 1200,
              width: '100%',
              background: '#1c1917',
              border: '1px solid #38332e',
              borderRadius: 12,
              overflow: 'hidden',
              boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
            }}
          >
            <div style={{ position: 'relative', height: '65vh', background: '#0c0a09' }}>
              <img
                src={lightboxRoom.renderUrl}
                alt={lightboxRoom.name}
                style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
              />
              <button
                type="button"
                onClick={() => setLightboxRoom(null)}
                style={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  background: 'rgba(0,0,0,0.75)',
                  border: 0,
                  color: '#fff',
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: 20, color: '#f5f5f4' }}>{lightboxRoom.name}</h3>
                <p style={{ margin: 0, fontSize: 13, color: '#a8a29e' }}>{lightboxRoom.tagline}</p>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#c59c2d', background: '#26221c', padding: '6px 12px', borderRadius: 6, border: '1px solid #3d3529' }}>
                  {lightboxRoom.cabinetry}
                </span>
                <button
                  type="button"
                  onClick={() => setLightboxRoom(null)}
                  style={{ background: '#332d29', color: '#fff', border: 0, borderRadius: 6, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DIGITAL SIGN-OFF MODAL */}
      {showSignOffModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#1c1917',
              border: '1px solid #3a342f',
              borderRadius: 12,
              maxWidth: 520,
              width: '100%',
              padding: 24,
              boxShadow: '0 20px 50px rgba(0,0,0,0.7)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Award size={20} color="#10b981" />
                <h3 style={{ margin: 0, fontSize: 18, color: '#f5f5f4' }}>Digital Client Handover Sign-Off</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSignOffModal(false)}
                style={{ background: 'transparent', border: 0, color: '#a8a29e', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: 13, color: '#d6d3d1', lineHeight: 1.5, marginBottom: 16 }}>
              By signing below, you approve the architectural layout, System 32 wall elevations, selected <strong>Material Scheme {selectedScheme}</strong>, and commercial estimate for production release.
            </p>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#a8a29e', marginBottom: 6 }}>
                Full Legal Name of Client / Authorized Representative:
              </label>
              <input
                type="text"
                value={clientSignName}
                onChange={(e) => setClientSignName(e.target.value)}
                placeholder="e.g. Vikramaditya Singhania"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: '#24201c',
                  border: '1px solid #443c34',
                  borderRadius: 6,
                  padding: '10px 12px',
                  color: '#f5f5f4',
                  fontSize: 14,
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowSignOffModal(false)}
                style={{
                  background: '#2b2622',
                  border: '1px solid #443c34',
                  color: '#d6d3d1',
                  borderRadius: 6,
                  padding: '8px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSignOff}
                disabled={!clientSignName.trim()}
                style={{
                  background: clientSignName.trim() ? 'linear-gradient(135deg, #10b981, #059669)' : '#2e3a34',
                  color: clientSignName.trim() ? '#fff' : '#6b7280',
                  border: 0,
                  borderRadius: 6,
                  padding: '8px 18px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: clientSignName.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                Confirm Sign-Off &amp; Release
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Stage Progression Bar */}
      <div style={{ marginTop: 28, padding: '16px 20px', background: '#1c1917', borderRadius: 12, border: '1px solid #332d29', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <strong style={{ color: '#fff', fontSize: 13, display: 'block' }}>
            Step 8 of 8: Client Presentation, Handover &amp; Production Release
          </strong>
          <small style={{ color: '#a8a29e', fontSize: 11 }}>
            Project design gates, commercial approvals, and delivery records are tracked in real-time.
          </small>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={() => {
              if (projectId) {
                navigate(`/projects/${projectId}/estimate`);
              }
            }}
            style={{
              background: '#2b2622',
              color: '#e7e5e4',
              border: '1px solid #44403c',
              borderRadius: 8,
              padding: '10px 16px',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <ArrowLeft size={15} /> Back to Commercial Estimate
          </button>
          <button
            type="button"
            onClick={() => {
              if (projectId) {
                navigate(`/projects/${projectId}/drawings`);
              }
            }}
            style={{
              background: 'linear-gradient(135deg, #c59c2d, #a88220)',
              color: '#1c1917',
              border: 0,
              borderRadius: 8,
              padding: '10px 18px',
              fontWeight: 800,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Check size={15} /> View Technical CAD Drawings
          </button>
        </div>
      </div>
    </section>
  );
}

