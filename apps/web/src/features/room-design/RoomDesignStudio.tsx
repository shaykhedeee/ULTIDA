import { Boxes, CheckCircle2, ChevronRight, LayoutTemplate, Palette, Ruler, Sparkles } from 'lucide-react';
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
  { id: 'spaces', label: '1. Room Setup & Layout', help: 'Plan overlay, AI auto-layout & furniture arrangement', icon: LayoutTemplate },
  { id: 'modules', label: '2. Modules & Finishes', help: 'Wall elevation, door/window alignment & materials', icon: Boxes },
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
          <h1>Set up, arrange, and finish the room in two streamlined stages.</h1>
          <p>Overlay the measured floor plan, approve AI furniture placement on real wall geometry, then configure exact buildable modules with door/window alignments and finishes.</p>
        </div>
        <div className="room-design-authority">
          <CheckCircle2 size={16} />
          <span>
            <strong>Measured plan linked</strong>
            <small>Geometry locked · AI proposals reviewable</small>
          </span>
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

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg, #1c1917, #2c1e14)', padding: '12px 18px', borderRadius: 10, margin: '14px 0', border: '1px solid #44382e', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Sparkles size={18} style={{ color: 'var(--gold)', flexShrink: 0 }} />
          <div>
            <strong style={{ color: '#fff', fontSize: 13, display: 'block' }}>Full AI Automated Pipeline Active</strong>
            <small style={{ color: '#d6d3d1', fontSize: 11 }}>AI generates all 2D floorplan layouts, wall picks, and 3D scenes automatically without manual drafting.</small>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => selectTab('spaces')}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: 0,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              background: activeTab === 'spaces' ? 'var(--gold)' : 'rgba(255,255,255,0.1)',
              color: activeTab === 'spaces' ? '#1c1917' : '#fff',
            }}
          >
            1. AI Plan Enhancer
          </button>
          <button
            type="button"
            onClick={() => selectTab('modules')}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: 0,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              background: activeTab === 'modules' ? 'var(--gold)' : 'rgba(255,255,255,0.1)',
              color: activeTab === 'modules' ? '#1c1917' : '#fff',
            }}
          >
            2. AI Wall Picker &amp; Setup
          </button>
        </div>
      </div>

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
            {activeTab === 'spaces' ? 'Step 2 Complete: Room Geometry & 2D Layouts Ready' : 'Step 3 Complete: Modular Wall Elevations & Materials Configured'}
          </strong>
          <small style={{ color: '#a8a29e', fontSize: 11 }}>
            {activeTab === 'spaces' ? 'Continue to configure modular walls, System 32 cabinet units, and laminate finishes.' : 'Compile scene.v1 to generate 3D views, AI photorealistic renders, and interactive hotspots.'}
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
              Continue to Step 3: Modules &amp; Wall Elevations <ChevronRight size={16} />
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
              Proceed to Step 4: 3D Visualization &amp; AI Renders <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
