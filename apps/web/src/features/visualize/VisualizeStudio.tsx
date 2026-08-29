import { Box, Image, Palette, Sparkles } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useState } from 'react';
import './visualize-studio.css';

type VisualizeTab = 'review' | 'render' | 'laminate';
type Props = { review: ReactNode; render: ReactNode; laminate: ReactNode; sceneReady: boolean; sceneApproved: boolean; onApproveScene?: () => Promise<boolean> };

export function VisualizeStudio({ review, render, laminate, sceneReady, sceneApproved, onApproveScene }: Props) {
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const active: VisualizeTab = requested === 'render' || requested === 'laminate' ? requested : 'review';
  const [approving, setApproving] = useState(false);
  
  const tabs = [
    { id: 'review' as const, label: '3D Scene Review', icon: Box, help: 'Measured Three.js scene verification' },
    { id: 'render' as const, label: 'AI Render', icon: Image, help: 'Generate from the approved scene' },
    { id: 'laminate' as const, label: 'Laminate Revision', icon: Palette, help: 'Change one named component only' },
  ];

  const panels: Record<VisualizeTab, ReactNode> = {
    review,
    render,
    laminate,
    /* Historical static hotspot demo intentionally disabled: inspection must
       be sourced from a real, approved scene-linked render artifact. */
    /*
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
    */
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
          {!sceneApproved && sceneReady && onApproveScene && (
            <button
              type="button"
              disabled={approving}
              onClick={async () => {
                setApproving(true);
                try {
                  const approved = await onApproveScene();
                  if (approved) select('render');
                } finally {
                  setApproving(false);
                }
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#1c1917', color: '#fff', fontWeight: 800, fontSize: 12, padding: '7px 14px', borderRadius: 8, border: 0, cursor: approving ? 'wait' : 'pointer' }}
            >
              {approving ? 'Approving scene…' : 'Approve scene for AI render'}
            </button>
          )}
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
    </section>
  );
}
