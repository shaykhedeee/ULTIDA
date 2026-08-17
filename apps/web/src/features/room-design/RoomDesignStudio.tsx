import { Boxes, CheckCircle2, LayoutTemplate, Palette, Ruler, Sparkles } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
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
    </section>
  );
}
