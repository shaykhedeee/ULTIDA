import { Calculator, ChevronRight, CircleAlert, FileText, LockKeyhole, ArrowLeft, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Card, CardContent, CardHeader, WorkflowDock } from '../ui/primitives';
import { getSupabaseBrowserClient } from '../../lib/supabase';
import { getApiBase } from '../../lib/api-base';

type Props = { projectId: string | null; briefSaved: boolean; planApproved: boolean; sceneVersionId: string | null; moduleCount: number };
type Totals = { grandTotalInr: number; subtotalInr: number; gstInr: number };

export function CommercialWorkspace({ projectId, briefSaved, planApproved, sceneVersionId, moduleCount }: Props) {
  const navigate = useNavigate();
  const ready = Boolean(briefSaved && planApproved && sceneVersionId && moduleCount);
  const [presetMode, setPresetMode] = useState<'apartment' | 'villa'>('villa');
  const [unitRate, setUnitRate] = useState('38500');
  const [labour, setLabour] = useState('6500');
  const [gstRate, setGstRate] = useState('0.18');
  const [marginRate, setMarginRate] = useState('0.12');
  const [quote, setQuote] = useState<Totals | null>(null);
  const [quoteState, setQuoteState] = useState('✨ 5BHK Singhania Royal Villa preset loaded: HDHMR + Acrylic + Fluted PU + Blum soft-close.');

  function switchPreset(mode: 'apartment' | 'villa') {
    setPresetMode(mode);
    if (mode === 'villa') {
      setUnitRate('38500');
      setLabour('6500');
      setMarginRate('0.15');
      setQuoteState('✨ 5BHK Royal Villa preset loaded: German CNC joinery, acrylic & fluted PU finishes.');
    } else {
      setUnitRate('24500');
      setLabour('4200');
      setMarginRate('0.12');
      setQuoteState('Standard 3BHK apartment preset loaded: 18mm HDHMR carcass + standard laminates.');
    }
    setQuote(null);
  }

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
    const mRate = Number(unitRate) || (presetMode === 'villa' ? 38500 : 24500);
    const lRate = Number(labour) || (presetMode === 'villa' ? 6500 : 4200);

    const rows: Array<Array<string | number>> = [
      ['Item #', 'Category', 'Description', 'Qty', 'Unit', 'Rate (INR)', 'Labour (INR)', 'Amount (INR)'],
    ];

    if (presetMode === 'villa') {
      rows.push(
        ['1', 'Formal Living & Foyer', '5,030mm TV Media Wall (Backlit Onyx + Fluted Acoustic Walnut + Console)', 1, 'Suite', 145000, 22000, 167000],
        ['2', 'Master Bedroom Suite', '2,977mm Master 4-Shutter Wardrobe & Vanity (Smoked Oak + Profile Glass)', 1, 'Suite', 185000, 28000, 213000],
        ['3', 'Sacred Sanctuary (Pooja)', '1,775mm Walk-In Mandir (Makrana Marble Altar + CNC Brass Jaali + Thali)', 1, 'Sanctuary', 95000, 18000, 113000],
        ['4', 'Gourmet Show Kitchen', '6,669mm Continuous Wall Run (HDHMR Carcass + Acrylic Shutters + Tandem)', 1, 'Kitchen', 265000, 35000, 300000],
        ['5', 'System 32 Hardware', 'Blum Obsidian 110° hinges, tandembox runners, push-to-open latches', effectiveModules, 'Sets', 12500, 2500, effectiveModules * 15000],
        ['6', 'Architectural Finishes', 'Italian Botticino marble cladding, 75mm shadowline skirting & trims', 1, 'Lumpsum', 85000, 25000, 110000],
        ['7', 'White-Glove Logistics', 'Air-cushioned factory crating, transit insurance & turnkey site installation', 1, 'Job', 35000, 15000, 50000]
      );
    } else {
      rows.push(
        ['1', 'Modular Cabinetry', 'Approved modular units (18mm HDHMR carcass + shutters)', effectiveModules, 'Modules', mRate, lRate, effectiveModules * (mRate + lRate)],
        ['2', 'Architectural Hardware', 'System 32 soft-close hinges, tandembox runners', effectiveModules, 'Sets', 6800, 1200, effectiveModules * 8000],
        ['3', 'Civil & Surface Finishes', 'Curated floor finishes, skirting & surface treatments', 1, 'Lumpsum', 45000, 15000, 60000],
        ['4', 'Site Delivery & Assembly', 'Factory crating, logistics & on-site erection', 1, 'Job', 18000, 8000, 26000]
      );
    }

    const subtotal = rows.slice(1).reduce((sum, r) => sum + Number(r[7]), 0);
    const margin = subtotal * (Number(marginRate) || (presetMode === 'villa' ? 0.15 : 0.12));
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
    link.setAttribute('download', `ULTIDA_Turnkey_BOM_${presetMode === 'villa' ? '5BHK_Villa_' : ''}${projectId ?? 'Project'}.csv`);
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
            {/* Preset Toggle */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 14, background: '#f5eee3', padding: 4, borderRadius: 8 }}>
              <button
                type="button"
                onClick={() => switchPreset('villa')}
                style={{
                  flex: 1,
                  padding: '7px 10px',
                  borderRadius: 6,
                  border: 'none',
                  background: presetMode === 'villa' ? '#1c1917' : 'transparent',
                  color: presetMode === 'villa' ? '#fdfbf7' : '#57534e',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                👑 5BHK Singhania Villa
              </button>
              <button
                type="button"
                onClick={() => switchPreset('apartment')}
                style={{
                  flex: 1,
                  padding: '7px 10px',
                  borderRadius: 6,
                  border: 'none',
                  background: presetMode === 'apartment' ? '#1c1917' : 'transparent',
                  color: presetMode === 'apartment' ? '#fdfbf7' : '#57534e',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                🏢 Standard 3BHK
              </button>
            </div>

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
              {presetMode === 'villa' ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f0eae1' }}>
                    <span>📺 5030mm TV Media Wall Suite</span>
                    <strong>INR 1,67,000</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f0eae1' }}>
                    <span>🚪 2977mm Master Wardrobe Suite</span>
                    <strong>INR 2,13,000</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f0eae1' }}>
                    <span>🛕 1775mm Sacred Walk-In Mandir</span>
                    <strong>INR 1,13,000</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f0eae1' }}>
                    <span>🍳 6669mm Gourmet Show Kitchen</span>
                    <strong>INR 3,00,000</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f0eae1' }}>
                    <span>🔩 Blum Obsidian Hardware ({Math.max(1, moduleCount)} sets)</span>
                    <strong>INR {(15000 * Math.max(1, moduleCount)).toLocaleString('en-IN')}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f0eae1' }}>
                    <span>🏛 Botticino Marble &amp; Civil Trims</span>
                    <strong>INR 1,10,000</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f0eae1' }}>
                    <span>📦 White-Glove Factory Crating</span>
                    <strong>INR 50,000</strong>
                  </div>
                </>
              ) : (
                <>
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
                </>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', marginTop: 6, fontWeight: 700, color: 'var(--text-primary)' }}>
                <span>Estimated Turnkey Cost:</span>
                <span>INR {quote ? quote.grandTotalInr.toLocaleString('en-IN') : (presetMode === 'villa' ? '11,24,540 (Est.)' : 'Click Calculate')}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Stage Progression */}
      <WorkflowDock
        currentStageIndex={6}
        stageTitle="Commercial Turnkey BOM & Pricing"
        stageSummary="BOM calculated · Ready for Client Presentation or Technical Drawings"
        beaconTone="gold"
        prevAction={{
          label: 'Drawings & Cutlists',
          icon: <ArrowLeft size={14} />,
          onClick: () => {
            if (projectId) navigate(`/projects/${projectId}/drawings`);
          },
        }}
        nextAction={{
          label: 'Client Presentation & Delivery',
          icon: <ArrowRight size={14} />,
          onClick: () => {
            if (projectId) navigate(`/projects/${projectId}/presentation`);
          },
        }}
      />
    </section>
  );
}
