import { Box, CheckCircle2, Image, Palette } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import './visualize-studio.css';

type VisualizeTab = 'review' | 'render' | 'laminate';

type Props = {
  review: ReactNode;
  render: ReactNode;
  laminate: ReactNode;
  sceneReady: boolean;
  sceneApproved: boolean;
  onApproveScene?: () => Promise<boolean>;
  projectId?: string | null;
};

export function VisualizeStudio({ review, render, laminate, sceneReady, sceneApproved, onApproveScene }: Props) {
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const active: VisualizeTab = requested === 'render' || requested === 'laminate' ? requested : 'review';
  const [approving, setApproving] = useState(false);

  const tabs: Array<{ id: VisualizeTab; label: string; help: string; icon: typeof Box }> = [
    { id: 'review', label: '3D scene', help: 'Inspect the saved room and modules', icon: Box },
    { id: 'render', label: 'AI render', help: 'Create a presentation image from the approved scene', icon: Image },
    { id: 'laminate', label: 'Finish revision', help: 'Preview a finish change on a selected component', icon: Palette },
  ];

  function select(id: VisualizeTab) {
    const next = new URLSearchParams(params);
    next.set('tab', id);
    setParams(next, { replace: true });
  }

  const panels: Record<VisualizeTab, ReactNode> = { review, render, laminate };

  return (
    <section className="visualize-studio" style={{ maxWidth: 1440, margin: '0 auto', padding: '0 1rem' }}>
      <header>
        <div>
          <h1>Review the room, then create its visual.</h1>
          <p>Measurements and materials come from the saved scene. AI images are for presentation; they do not change construction geometry.</p>
        </div>
        <div className="visualize-scene-state" role="status">
          <CheckCircle2 size={15} aria-hidden="true" />
          {sceneApproved ? 'Saved scene approved' : sceneReady ? 'Saved scene needs approval' : 'Compile a scene to begin'}
        </div>
      </header>

      <nav aria-label="3D and render steps" role="tablist">
        {tabs.map(({ id, label, icon: Icon, help }) => (
          <button key={id} type="button" role="tab" aria-selected={active === id} className={active === id ? 'active' : ''} onClick={() => select(id)}>
            <Icon size={17} aria-hidden="true" />
            <span><strong>{label}</strong><small>{help}</small></span>
          </button>
        ))}
      </nav>

      {!sceneApproved && active !== 'review' && (
        <div className="visualize-approval-note" role="note">
          {sceneReady
            ? <>Approve the saved scene in 3D scene review before generating or revising an image. The review tab shows the scene and its current checks.</>
            : <>Compile and review a saved scene before generating an image. A room screenshot or sample render cannot stand in for saved project geometry.</>}
        </div>
      )}

      {active === 'review' && !sceneApproved && sceneReady && onApproveScene && (
        <div className="visualize-approval-action">
          <span>Approval checks use the persisted room and module revision.</span>
          <button type="button" disabled={approving} onClick={async () => {
            setApproving(true);
            try { await onApproveScene(); }
            finally { setApproving(false); }
          }}>
            {approving ? 'Checking scene…' : 'Approve saved scene'}
          </button>
        </div>
      )}

      <div className="visualize-panel">{panels[active]}</div>
    </section>
  );
}
