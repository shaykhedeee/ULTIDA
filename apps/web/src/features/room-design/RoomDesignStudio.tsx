import { BookOpen, Boxes, CheckCircle2, LayoutTemplate, Ruler, Sparkles } from 'lucide-react';
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
            onClick={() => selectTab('modules')}
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
          <button
            type="button"
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.set('tab', 'modules');
              next.set('mode', 'elevations');
              setSearchParams(next, { replace: true });
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 16px',
              borderRadius: 10,
              background: '#292524',
              color: '#fdfbf7',
              border: '1px solid #57534e',
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            }}
          >
            <Ruler size={15} style={{ color: 'var(--gold)' }} />
            <span>Wall Elevations (A/B/C/D)</span>
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

      {activeTab === 'modules' && (
        <div
          className="room-design-subnav"
          style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            alignItems: 'center',
            background: '#faf7f2',
            padding: '10px 16px',
            borderRadius: '12px',
            border: '1px solid #e7dcce',
          }}
          aria-label="Tab 2 Design Modes"
        >
          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--gold-dim)', letterSpacing: '0.06em', textTransform: 'uppercase', marginRight: '6px' }}>
            STUDIO SUB-STAGES:
          </span>
          {[
            { id: 'elevations', label: '📐 Wall Elevations (A/B/C/D)', desc: 'System 32 Datums, SVG Elevations & Interactive Material Swatches' },
            { id: 'layout', label: '📦 Cabinet Catalog & Bay Layout', desc: 'Parametric Modular Units, Anchor Walls & Clearances' },
            { id: 'moodboard', label: '🎨 Finishes, Swatches & Moodboard', desc: 'Curated Acrylic, Laminate, Veneer & Hardware Schedules' },
            { id: 'flooring', label: '🪵 Flooring & Skirting Studio', desc: 'Tile Grid/Herringbone, Grout Lines & Automatic Skirting Takeoff' },
          ].map((mode) => {
            const currentMode = searchParams.get('mode') ?? 'layout';
            const isActive = currentMode === mode.id || (mode.id === 'elevations' && currentMode === 'elevation');
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => {
                  const next = new URLSearchParams(searchParams);
                  next.set('tab', 'modules');
                  next.set('mode', mode.id);
                  setSearchParams(next, { replace: true });
                }}
                title={mode.desc}
                style={{
                  padding: '7px 15px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: isActive ? 800 : 600,
                  background: isActive ? 'linear-gradient(135deg, #1c1917, #3d2a1a)' : '#fff',
                  color: isActive ? '#e8c96a' : '#44403c',
                  border: isActive ? '1.5px solid var(--gold)' : '1px solid #dcd3c5',
                  cursor: 'pointer',
                  boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.12)' : 'none',
                  transition: 'all 0.15s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>{mode.label}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="room-design-panel" key={activeTab}>
        {panels[activeTab]}
      </div>

    </section>
  );
}
