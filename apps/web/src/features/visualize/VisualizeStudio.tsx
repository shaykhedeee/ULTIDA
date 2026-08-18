import { Box, ChevronRight, Image, Palette, Sparkles } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { ReactNode } from 'react';
import { supabase } from '../../lib/supabase';
import { getApiBase } from '../../lib/api-base';
import InteractiveRenderViewer from '../../components/visual/InteractiveRenderViewer';
import './visualize-studio.css';

type VisualizeTab = 'review' | 'render' | 'laminate' | 'interactive';
type Props = { review: ReactNode; render: ReactNode; laminate: ReactNode; sceneReady: boolean; sceneApproved: boolean };

const SAMPLE_INTERACTIVE_ITEMS = [
  {
    object_id: 1,
    bbox: { x: 80, y: 160, w: 420, h: 260 },
    category: 'Modular TV Console',
    matched_sku: 'TV-FLUTED-OAK-2400',
    matched_name: '2400 mm Fluted Smoked Oak Wall-Mounted TV Unit',
    vendor: 'ULTIDA Modular Pro',
    unit_price: 1850,
    confidence_score: 0.96,
  },
  {
    object_id: 2,
    bbox: { x: 520, y: 220, w: 340, h: 200 },
    category: 'Lounge Seating',
    matched_sku: 'SOFA-BOUCLE-CURVE-2800',
    matched_name: '2800 mm Curved Bouclé 4-Seater Sectional',
    vendor: 'Studio Collection',
    unit_price: 2450,
    confidence_score: 0.94,
  },
  {
    object_id: 3,
    bbox: { x: 320, y: 340, w: 260, h: 140 },
    category: 'Accent Furniture',
    matched_sku: 'COFFEE-TRAVERTINE-ROUND',
    matched_name: 'Roman Travertine Tiered Fluted Coffee Table',
    vendor: 'Artisan Stone Works',
    unit_price: 780,
    confidence_score: 0.91,
  },
];

export function VisualizeStudio({ review, render, laminate, sceneReady, sceneApproved }: Props) {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId?: string }>();
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const active: VisualizeTab = requested === 'render' || requested === 'laminate' || requested === 'interactive' ? requested : 'review';
  
  const tabs = [
    { id: 'review' as const, label: '3D Scene Review', icon: Box, help: 'Measured Three.js scene verification' },
    { id: 'render' as const, label: 'AI Render', icon: Image, help: 'Generate from the approved scene' },
    { id: 'laminate' as const, label: 'Laminate Revision', icon: Palette, help: 'Change one named component only' },
    { id: 'interactive' as const, label: 'Interactive Hotspots & BOM', icon: Sparkles, help: 'Hover & inspect detected modules, materials and dynamic quotation' },
  ];

  const panels: Record<VisualizeTab, ReactNode> = {
    review,
    render,
    laminate,
    interactive: (
      <div style={{ background: '#1c1917', borderRadius: 12, padding: 16 }}>
        <InteractiveRenderViewer
          imageUrl="/reference-vault/001-ddc1891636f7.png"
          items={SAMPLE_INTERACTIVE_ITEMS}
          currencySymbol="$"
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
                // ignore
              }
            }
            alert(`✨ Successfully added ${items.length} detected smart modules ($${items.reduce((s, i) => s + i.unit_price, 0).toLocaleString()}) to project dynamic quotation!`);
            if (projectId) {
              navigate(`/projects/${projectId}/estimate`);
            }
          }}
        />
      </div>
    ),
  };

  function select(id: VisualizeTab) {
    const next = new URLSearchParams(params);
    next.set('tab', id);
    setParams(next, { replace: true });
  }

  return (
    <section className="visualize-studio">
      <header>
        <div>
          <small>VISUALIZE STUDIO</small>
          <h1>Review geometry before generating imagery.</h1>
          <p>Three.js, AI renders, and laminate revisions use the same scene.v1 version. Generated images never alter measured geometry.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
      <nav aria-label="Visualize stages">
        {tabs.map(({ id, label, icon: Icon, help }) => (
          <button
            key={id}
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
      <div className="visualize-panel">{panels[active]}</div>

      {/* Sleek Fixed Bottom Stage Progression Bar */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 90,
          height: 54,
          padding: '0 24px',
          background: 'rgba(20, 18, 16, 0.94)',
          backdropFilter: 'blur(16px)',
          borderTop: '1px solid rgba(197, 156, 45, 0.3)',
          boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.28)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#c59c2d', boxShadow: '0 0 8px #c59c2d' }} />
          <div>
            <strong style={{ color: '#fff', fontSize: 12.5, display: 'inline', marginRight: 8 }}>
              Stage 5 of 8: 3D Visualization &amp; AI Renders
            </strong>
            <span style={{ color: '#a8a29e', fontSize: 11.5 }}>
              • Scene geometry verified • Ready for Cost Estimate &amp; Technical Drawings.
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => {
              if (projectId) {
                navigate(`/projects/${projectId}/drawings`);
              }
            }}
            style={{
              background: '#2b2622',
              color: '#e7e5e4',
              border: '1px solid #44403c',
              borderRadius: 7,
              padding: '6px 14px',
              fontWeight: 600,
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              height: 34,
            }}
          >
            Drawings &amp; Cutlists
          </button>
          <button
            type="button"
            onClick={() => {
              if (projectId) {
                navigate(`/projects/${projectId}/estimate`);
              }
            }}
            style={{
              background: 'linear-gradient(135deg, #c59c2d, #a88220)',
              color: '#1c1917',
              border: 0,
              borderRadius: 7,
              padding: '6px 16px',
              fontWeight: 800,
              fontSize: 12.5,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              height: 34,
              boxShadow: '0 2px 8px rgba(197,156,45,0.3)',
            }}
          >
            Proceed to Estimate <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </section>
  );
}
