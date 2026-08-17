import { Box, Image, Palette, Sparkles } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import type { ReactNode } from 'react';
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
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const active: VisualizeTab = requested === 'render' || requested === 'laminate' || requested === 'interactive' ? requested : 'review';
  
  const tabs = [
    { id: 'review' as const, label: '3D Review', icon: Box, help: 'Inspect deterministic scene geometry' },
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
          onAddSceneToQuote={(items) => {
            alert(`Added ${items.length} detected modules and furniture to the active project dynamic quotation!`);
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
        <span className={sceneApproved ? 'ready' : sceneReady ? 'review' : 'blocked'}>
          {sceneApproved ? 'Scene approved' : sceneReady ? 'Scene needs approval' : 'Compile a room design first'}
        </span>
      </header>
      <nav aria-label="Visualize stages">
        {tabs.map(({ id, label, icon: Icon, help }) => (
          <button
            key={id}
            className={active === id ? 'active' : ''}
            onClick={() => select(id)}
            disabled={id !== 'review' && id !== 'interactive' && !sceneApproved}
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
    </section>
  );
}
