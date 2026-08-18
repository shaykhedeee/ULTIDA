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
              {activeTab === 'spaces' ? 'Stage 3: Room Setup & 2D Layouts' : 'Stage 4: Modular Units, Elevations & Finishes'}
            </strong>
            <span style={{ color: '#a8a29e', fontSize: 11.5 }}>
              • {activeTab === 'spaces' ? 'Proceed to configure modular runs and elevations.' : 'Compile scene.v1 to generate 3D solid geometry and AI photorealistic renders.'}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {activeTab === 'spaces' ? (
            <button
              type="button"
              onClick={() => selectTab('modules')}
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
              Continue to Step 4: Modules &amp; Wall Elevations <ChevronRight size={14} />
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
                borderRadius: 7,
                padding: '6px 16px',
                fontWeight: 800,
                fontSize: 12.5,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                height: 34,
                boxShadow: '0 2px 8px rgba(52,211,153,0.3)',
              }}
            >
              Proceed to Step 5: 3D Visualization &amp; AI Renders <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
