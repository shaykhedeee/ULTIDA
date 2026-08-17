import { Calculator, ChevronRight, CircleAlert, FileText, LockKeyhole } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Card, CardContent, CardHeader } from '../ui/primitives';
import { getSupabaseBrowserClient } from '../../lib/supabase';

type Props = { projectId: string | null; briefSaved: boolean; planApproved: boolean; sceneVersionId: string | null; moduleCount: number };
type Totals = { grandTotalInr: number; subtotalInr: number; gstInr: number };

export function CommercialWorkspace({ projectId, briefSaved, planApproved, sceneVersionId, moduleCount }: Props) {
  const navigate = useNavigate();
  const ready = Boolean(briefSaved && planApproved && sceneVersionId && moduleCount);
  const [unitRate, setUnitRate] = useState('0'); const [labour, setLabour] = useState('0'); const [gstRate, setGstRate] = useState('0.18'); const [marginRate, setMarginRate] = useState('0.1');
  const [quote, setQuote] = useState<Totals | null>(null); const [quoteState, setQuoteState] = useState('Enter studio rates to calculate an estimate.');
  async function calculateEstimate() {
    if (!ready || !sceneVersionId || !projectId) return;
    setQuoteState('Calculating estimate...');
    try {
      const browserClient = getSupabaseBrowserClient();
      if (!browserClient) return setQuoteState('Supabase is not configured in this browser.');
      const session = await browserClient.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) return setQuoteState('Sign in again before calculating an estimate.');
      const response = await fetch(`${import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8800/api'}/commercial/estimates`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ projectId, sceneVersionId, lines: [{ id: 'scene-modules', description: 'Approved modular scene scope', category: 'modular_unit', quantity: moduleCount, unit: 'module', unitRateInr: Number(unitRate), labourInr: Number(labour) }], gstRate: Number(gstRate), marginRate: Number(marginRate) }) });
      const payload = await response.json(); if (!response.ok) return setQuoteState(payload.message ?? 'Estimate could not be calculated.');
      setQuote(payload.estimate.totals); setQuoteState('Draft estimate calculated. Review rates before issuing.');
    } catch { setQuoteState('Commercial service unavailable. The scene is unchanged.'); }
  }
  return (
    <section className="commercial-workspace">
      <div className="workspace-heading">
        <div>
          <small>COMMERCIAL / CONTROLLED ESTIMATE</small>
          <h2>Price only what the approved scene can prove.</h2>
          <p>Rates remain studio inputs; zero-rate lines are visibly review-required.</p>
        </div>
        <Badge tone={ready ? 'success' : 'accent'}>{ready ? 'Ready for pricing' : 'Blocked'}</Badge>
      </div>
      <div className="commercial-layout">
        <Card>
          <CardHeader>
            <div>
              <small>QUOTE WORKSPACE</small>
              <h3>INR estimate</h3>
            </div>
            <Calculator size={20} />
          </CardHeader>
          <CardContent>
            <div className="commercial-check">
              <strong>Source context</strong>
              <span className={briefSaved ? 'commercial-ready' : 'commercial-blocked'}>{briefSaved ? 'Brief saved' : 'Brief required'}</span>
            </div>
            <div className="commercial-check">
              <strong>Measured design</strong>
              <span className={planApproved && sceneVersionId ? 'commercial-ready' : 'commercial-blocked'}>{planApproved && sceneVersionId ? 'Approved plan and scene linked' : 'Approved plan and scene required'}</span>
            </div>
            <div className="commercial-check">
              <strong>Scene modules</strong>
              <span className={moduleCount ? 'commercial-ready' : 'commercial-blocked'}>{moduleCount} modules</span>
            </div>
            {ready && (
              <div className="quote-inputs">
                <label>
                  Module rate (INR)
                  <input type="number" min="0" value={unitRate} onChange={(event) => setUnitRate(event.target.value)} />
                </label>
                <label>
                  Labour/module (INR)
                  <input type="number" min="0" value={labour} onChange={(event) => setLabour(event.target.value)} />
                </label>
                <label>
                  GST rate
                  <input type="number" min="0" step="0.01" value={gstRate} onChange={(event) => setGstRate(event.target.value)} />
                </label>
                <label>
                  Margin rate
                  <input type="number" min="0" step="0.01" value={marginRate} onChange={(event) => setMarginRate(event.target.value)} />
                </label>
                <button className="primary" onClick={() => void calculateEstimate()}>Calculate draft estimate</button>
              </div>
            )}
            {quote && (
              <div className="commercial-empty">
                <FileText size={28} />
                <h3>Draft total: INR {quote.grandTotalInr.toLocaleString('en-IN')}</h3>
                <p>Subtotal INR {quote.subtotalInr.toLocaleString('en-IN')} · GST INR {quote.gstInr.toLocaleString('en-IN')}</p>
              </div>
            )}
            <p className="inline-message">{quoteState}</p>
          </CardContent>
        </Card>
        <Card className="commercial-side">
          <CardHeader>
            <div>
              <small>NEXT ACTION</small>
              <h3>{ready ? 'Review and approve estimate' : 'Complete source gates'}</h3>
            </div>
            <LockKeyhole size={20} />
          </CardHeader>
          <CardContent>
            <p>{ready ? 'The draft is calculated from the approved scene. Approval and version persistence remain the next release gate.' : 'Complete the brief, approve the plan and create a scene before pricing.'}</p>
            <div className="commercial-note">
              <CircleAlert size={16} />
              <span>{quote ? 'Draft estimate ready for review.' : 'No quote has been generated.'}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Stage Progression Bar */}
      <div style={{ marginTop: 24, padding: '16px 20px', background: '#1c1917', borderRadius: 12, border: '1px solid #332d29', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <strong style={{ color: '#fff', fontSize: 13, display: 'block' }}>
            Commercial Scope &amp; Pricing Configured
          </strong>
          <small style={{ color: '#a8a29e', fontSize: 11 }}>
            Proceed to client presentation and formal sign-off, or inspect technical manufacturing drawings.
          </small>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={() => {
              if (projectId) {
                navigate(`/projects/${projectId}/presentation`);
              }
            }}
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
            Proceed to Client Presentation &amp; Delivery <ChevronRight size={16} />
          </button>
          <button
            type="button"
            onClick={() => {
              if (projectId) {
                navigate(`/projects/${projectId}/drawings`);
              }
            }}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              color: '#f5f5f4',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: 8,
              padding: '10px 16px',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            Production Drawings &amp; Cutlists ➔
          </button>
        </div>
      </div>
    </section>
  );
}
