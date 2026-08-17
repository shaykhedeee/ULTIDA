import { BookOpen, Boxes, CheckCircle2, ChevronRight, LayoutTemplate, Palette, Ruler, Sparkles } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { ReactNode } from 'react';
import './room-design.css';

export type RoomDesignTab = 'spaces' | 'modules';

type Props = {
  spaces: ReactNode;
  modules: ReactNode;
  // Legacy props kept for backward-compatibility if passed
  setup?: ReactNode;
  arrangement?: ReactNode;
  finishes?: ReactNode;
};

const TABS: Array<{ id: RoomDesignTab; label: string; help: string; icon: typeof Ruler }> = [
  { id: 'spaces', label: '1. Room Setup & 2D Layouts', help: 'Plan overlay, AI room boundaries, Vastu compliance & usable walls', icon: LayoutTemplate },
  { id: 'modules', label: '2. Modules, Wall Elevations & Finishes', help: 'Wall A/B/C/D elevations, System 32 cabinets & material swatches', icon: Boxes },
];

function normalizeTab(requested: string | null): RoomDesignTab {
  if (requested === 'modules' || requested === 'finishes' || requested === 'materials') {
    return 'modules';
  }
  return 'spaces';
}

export function RoomDesignStudio({ spaces, modules, setup, arrangement, finishes }: Props) {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('tab');
  const activeTab: RoomDesignTab = normalizeTab(requested);

  const panels: Record<RoomDesignTab, ReactNode> = {
    spaces: spaces ?? setup ?? arrangement,
    modules: modules ?? finishes,
  };

  function selectTab(tab: RoomDesignTab) {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next, { replace: true });
  }

  return (
    <section className="room-design-studio">
      <header className="room-design-hero">
        <div>
          <small>ROOM DESIGN STUDIO</small>
          <h1>Set up, arrange, and finish each space with precision.</h1>
          <p>Overlay the measured floor plan, verify AI layout proposals on real wall geometry, then configure exact buildable modular units with door/window clearances and finishes.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => navigate('/library')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 16px',
              borderRadius: 10,
              background: '#1c1917',
              color: '#fdfbf7',
              border: '1px solid #44382e',
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            }}
          >
            <BookOpen size={15} style={{ color: 'var(--gold)' }} />
            <span>Design Catalog</span>
          </button>
          <div className="room-design-authority">
            <CheckCircle2 size={16} />
            <span>
              <strong>Measured plan linked</strong>
              <small>Geometry locked · AI proposals reviewable</small>
            </span>
          </div>
        </div>
      </header>

      <nav className="room-design-tabs" aria-label="Room Design stages">
        {TABS.map(({ id, label, help, icon: Icon }, index) => (
          <button
            key={id}
            type="button"
            className={activeTab === id ? 'active' : ''}
            onClick={() => selectTab(id)}
            aria-current={activeTab === id ? 'step' : undefined}
          >
            <span className="room-design-step">{index + 1}</span>
            <Icon size={17} />
            <span>
              <strong>{label}</strong>
              <small>{help}</small>
            </span>
          </button>
        ))}
      </nav>

      <div className="room-design-current">
        <Sparkles size={15} />
        <span>
          Editing <strong>{TABS.find((tab) => tab.id === activeTab)?.label}</strong>. Your changes persist automatically across all downstream production and rendering outputs.
        </span>
      </div>

      <div className="room-design-panel" key={activeTab}>
        {panels[activeTab]}
      </div>

      {/* Bottom Stage Progression Bar */}
      <div style={{ marginTop: 24, padding: '16px 20px', background: '#1c1917', borderRadius: 12, border: '1px solid #332d29', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <strong style={{ color: '#fff', fontSize: 13, display: 'block' }}>
            {activeTab === 'spaces' ? 'Step 3: Room Setup & 2D Layouts Complete' : 'Step 4: Modular Units, Elevations & Finishes Configured'}
          </strong>
          <small style={{ color: '#a8a29e', fontSize: 11 }}>
            {activeTab === 'spaces' ? 'Proceed to configure modular wall runs, elevations, cabinet modules, and laminate swatches.' : 'Compile scene.v1 to generate 3D solid geometry, AI photorealistic renders, and technical CAD blueprints.'}
          </small>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {activeTab === 'spaces' ? (
            <button
              type="button"
              onClick={() => selectTab('modules')}
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
                boxShadow: '0 4px 14px rgba(197,156,45,0.3)',
              }}
            >
              Continue to Step 4: Modules &amp; Wall Elevations <ChevronRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (projectId) {
                  navigate(`/projects/${projectId}/3d`);
                }
              }}
              style={{
                background: 'linear-gradient(135deg, #34d399, #059669)',
                color: '#062817',
                border: 0,
                borderRadius: 8,
                padding: '10px 18px',
                fontWeight: 800,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 4px 14px rgba(52,211,153,0.3)',
              }}
            >
              Proceed to Step 5: 3D Visualization &amp; AI Renders <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
