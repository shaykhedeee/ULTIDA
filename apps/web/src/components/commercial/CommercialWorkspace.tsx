import { Calculator, ChevronRight, CircleAlert, FileText, LockKeyhole } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Card, CardContent, CardHeader } from '../ui/primitives';
import { getSupabaseBrowserClient } from '../../lib/supabase';
import { getApiBase } from '../../lib/api-base';

type Props = { projectId: string | null; briefSaved: boolean; planApproved: boolean; sceneVersionId: string | null; moduleCount: number };
type Totals = { grandTotalInr: number; subtotalInr: number; gstInr: number };

export function CommercialWorkspace({ projectId, briefSaved, planApproved, sceneVersionId, moduleCount }: Props) {
  const navigate = useNavigate();
  const ready = Boolean(briefSaved && planApproved && sceneVersionId && moduleCount);
  const [unitRate, setUnitRate] = useState('24500');
  const [labour, setLabour] = useState('4200');
  const [gstRate, setGstRate] = useState('0.18');
  const [marginRate, setMarginRate] = useState('0.12');
  const [quote, setQuote] = useState<Totals | null>(null);
  const [quoteState, setQuoteState] = useState('Industry standard rate preset loaded. Click calculate to generate the verified BOM.');

  async function calculateEstimate() {
    if (!ready || !sceneVersionId || !projectId) return;
    setQuoteState('Calculating verified BOM and estimate...');
    try {
      const browserClient = getSupabaseBrowserClient();
      if (!browserClient) return setQuoteState('Supabase is not configured in this browser.');
      const session = await browserClient.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) return setQuoteState('Sign in again before calculating an estimate.');
      const response = await fetch(`${getApiBase()}/commercial/estimates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          projectId,
          sceneVersionId,
          lines: [
            {
              id: 'scene-modules',
              description: 'Approved modular cabinetry (HDHMR/Plywood carcass + acrylic shutters)',
              category: 'modular_unit',
              quantity: Math.max(1, moduleCount),
              unit: 'module',
              unitRateInr: Number(unitRate) || 24500,
              labourInr: Number(labour) || 4200,
            },
            {
              id: 'hardware-motion',
              description: 'System 32 hardware, soft-close hinges, tandembox channels & handles',
              category: 'hardware',
              quantity: Math.max(1, moduleCount),
              unit: 'set',
              unitRateInr: 6800,
              labourInr: 1200,
            },
          ],
          gstRate: Number(gstRate) || 0.18,
          marginRate: Number(marginRate) || 0.12,
        }),
      });
      const payload = await response.json();
      if (!response.ok) return setQuoteState(payload.message ?? 'Estimate could not be calculated.');
      setQuote(payload.estimate.totals);
      setQuoteState('✨ Verified turnkey BOM and commercial estimate calculated successfully.');
    } catch {
      setQuoteState('Commercial service unavailable. The scene is unchanged.');
    }
  }

  function downloadBomCsv() {
    const effectiveModules = Math.max(1, moduleCount);
    const mRate = Number(unitRate) || 24500;
    const lRate = Number(labour) || 4200;
    const rows = [
      ['Item #', 'Category', 'Description', 'Qty', 'Unit', 'Rate (INR)', 'Labour (INR)', 'Amount (INR)'],
      ['1', 'Modular Cabinetry', 'Approved modular units (18mm HDHMR carcass + shutters)', effectiveModules, 'Modules', mRate, lRate, effectiveModules * (mRate + lRate)],
      ['2', 'Architectural Hardware', 'System 32 soft-close hinges, tandembox runners', effectiveModules, 'Sets', 6800, 1200, effectiveModules * 8000],
      ['3', 'Civil & Surface Finishes', 'Curated floor finishes, skirting & surface treatments', 1, 'Lumpsum', 45000, 15000, 60000],
      ['4', 'Site Delivery & Assembly', 'Factory crating, logistics & on-site erection', 1, 'Job', 18000, 8000, 26000],
    ];
    const subtotal = rows.slice(1).reduce((sum, r) => sum + Number(r[7]), 0);
    const margin = subtotal * (Number(marginRate) || 0.12);
    const gst = (subtotal + margin) * (Number(gstRate) || 0.18);
    const grandTotal = subtotal + margin + gst;
    rows.push([]);
    rows.push(['', '', '', '', '', '', 'Subtotal:', Math.round(subtotal)]);
    rows.push(['', '', '', '', '', '', `Studio Margin (${((Number(marginRate) || 0.12) * 100).toFixed(0)}%):`, Math.round(margin)]);
    rows.push(['', '', '', '', '', '', `GST (${((Number(gstRate) || 0.18) * 100).toFixed(0)}%):`, Math.round(gst)]);
    rows.push(['', '', '', '', '', '', 'Grand Total (INR):', Math.round(grandTotal)]);

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ULTIDA_Turnkey_BOM_${projectId ?? 'Project'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <section className="commercial-workspace">
      <div className="workspace-heading">
        <div>
          <small>COMMERCIAL / BILL OF MATERIALS (BOM)</small>
          <h2>Turnkey BOM &amp; Project Commercial Estimation</h2>
          <p>Itemized panel cutlists, architectural hardware schedules, labour rates, and client-ready estimates.</p>
        </div>
        <Badge tone={ready ? 'success' : 'accent'}>{ready ? 'Ready for pricing' : 'Blocked'}</Badge>
      </div>
      <div className="commercial-layout">
        <Card>
          <CardHeader>
            <div>
              <small>QUOTE &amp; BOM CONFIGURATION</small>
              <h3>Turnkey INR Rates</h3>
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
              <span className={planApproved && sceneVersionId ? 'commercial-ready' : 'commercial-blocked'}>{planApproved && sceneVersionId ? 'Approved plan & scene linked' : 'Approved plan & scene required'}</span>
            </div>
            <div className="commercial-check">
              <strong>Scene modules</strong>
              <span className={moduleCount ? 'commercial-ready' : 'commercial-blocked'}>{moduleCount} modular units</span>
            </div>
            {ready && (
              <div className="quote-inputs" style={{ marginTop: 16 }}>
                <label>
                  Avg Module Rate (INR)
                  <input type="number" min="0" value={unitRate} onChange={(event) => setUnitRate(event.target.value)} />
                </label>
                <label>
                  Installation Labour / Unit (INR)
                  <input type="number" min="0" value={labour} onChange={(event) => setLabour(event.target.value)} />
                </label>
                <label>
                  GST Rate (0.18 = 18%)
                  <input type="number" min="0" step="0.01" value={gstRate} onChange={(event) => setGstRate(event.target.value)} />
                </label>
                <label>
                  Studio Margin (0.12 = 12%)
                  <input type="number" min="0" step="0.01" value={marginRate} onChange={(event) => setMarginRate(event.target.value)} />
                </label>
                <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                  <button className="primary" onClick={() => void calculateEstimate()} style={{ flex: 1 }}>
                    ✨ Calculate Turnkey BOM
                  </button>
                  <button
                    type="button"
                    onClick={downloadBomCsv}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 8,
                      border: '1px solid #c59c2d',
                      background: 'rgba(197,156,45,0.1)',
                      color: 'var(--gold-dim)',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontSize: 12,
                    }}
                  >
                    📥 Export CSV
                  </button>
                </div>
              </div>
            )}
            {quote && (
              <div className="commercial-empty" style={{ marginTop: 20, background: '#fdfbf7', border: '1.5px solid #ebdccb', borderRadius: 10, padding: 18 }}>
                <FileText size={32} style={{ color: 'var(--gold)' }} />
                <h3 style={{ margin: '8px 0 4px', fontSize: 20, color: 'var(--text-primary)' }}>Grand Total: INR {quote.grandTotalInr.toLocaleString('en-IN')}</h3>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
                  Subtotal: INR {quote.subtotalInr.toLocaleString('en-IN')} · GST (18%): INR {quote.gstInr.toLocaleString('en-IN')}
                </p>
              </div>
            )}
            <p className="inline-message" style={{ marginTop: 12 }}>{quoteState}</p>
          </CardContent>
        </Card>
        <Card className="commercial-side">
          <CardHeader>
            <div>
              <small>ITEMIZED SCHEDULE</small>
              <h3>Bill of Materials Preview</h3>
            </div>
            <LockKeyhole size={20} />
          </CardHeader>
          <CardContent>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f0eae1' }}>
                <span>🪵 Modular Cabinetry ({moduleCount} units)</span>
                <strong>INR {((Number(unitRate) || 24500) * Math.max(1, moduleCount)).toLocaleString('en-IN')}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f0eae1' }}>
                <span>🔩 Hardware &amp; Blum Tandembox</span>
                <strong>INR {(6800 * Math.max(1, moduleCount)).toLocaleString('en-IN')}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f0eae1' }}>
                <span>🔨 Factory Fabrication &amp; Labour</span>
                <strong>INR {(((Number(labour) || 4200) + 1200) * Math.max(1, moduleCount)).toLocaleString('en-IN')}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f0eae1' }}>
                <span>📦 Crating &amp; Site Logistics</span>
                <strong>INR 26,000</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', marginTop: 6, fontWeight: 700, color: 'var(--text-primary)' }}>
                <span>Estimated Turnkey Cost:</span>
                <span>INR {quote ? quote.grandTotalInr.toLocaleString('en-IN') : 'Click Calculate'}</span>
              </div>
            </div>
          </CardContent>
        </Card>
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
              Stage 6 of 8: Commercial Turnkey BOM &amp; Pricing
            </strong>
            <span style={{ color: '#a8a29e', fontSize: 11.5 }}>
              • BOM calculated • Ready for Client Presentation or Technical Drawings.
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => {
              if (projectId) {
                navigate(`/projects/${projectId}/drawings`);
              }
            }}
            style={{
              background: '#2b2622',
              color: '#e7e5e4',
              border: '1px solid #44403c',
              borderRadius: 7,
              padding: '6px 14px',
              fontWeight: 600,
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              height: 34,
            }}
          >
            Drawings &amp; Cutlists
          </button>
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
            Client Presentation &amp; Delivery <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </section>
  );
}
