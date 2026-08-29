import { BookOpen, Boxes, CheckCircle2, LayoutTemplate, Ruler, Sparkles } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  { id: 'spaces', label: '1. Rooms & 2D Layout', help: 'Measured plan overlay, openings, furniture brief & usable walls', icon: LayoutTemplate },
  { id: 'modules', label: '2. Design Library Modules & Elevations', help: 'Catalog-backed modules, Wall A/B/C/D elevations and finish schedules', icon: Boxes },
];

function normalizeTab(requested: string | null): RoomDesignTab {
  if (requested === 'modules' || requested === 'finishes' || requested === 'materials') {
    return 'modules';
  }
  return 'spaces';
}

export function RoomDesignStudio({ spaces, modules, setup, arrangement, finishes }: Props) {
  const navigate = useNavigate();
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
          <p>Start with measured geometry and a furniture brief, then select catalog-backed buildable modules, finishes and wall elevations that flow directly into the 3D scene.</p>
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

    </section>
  );
}
