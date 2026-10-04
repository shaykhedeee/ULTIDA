import React, { useState, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ShieldCheck, CheckCircle2, FileText, Compass, Download, Share2,
  Sparkles, Layers, Check, AlertCircle, ArrowRight, Eye, Printer, Award
} from 'lucide-react';
import { PanoramaViewer360, ROOM_PRESETS } from '../../components/visual/PanoramaViewer360';
import './client-portal.css';

interface SignOffRecord {
  clientName: string;
  clientEmail: string;
  approvalDate: string;
  timestamp: string;
  signatureDataUrl: string;
  projectId: string;
  scopeApproved: boolean;
  certificateId: string;
}

export function ClientPresentationPortal() {
  const { projectId = 'villa-5bhk-master' } = useParams<{ projectId: string }>();

  // State
  const [activeTab, setActiveTab] = useState<'walkthrough360' | 'elevations' | 'finishes' | 'commercial' | 'approval'>('walkthrough360');
  const [watermarkEnabled, setWatermarkEnabled] = useState<boolean>(true);
  const [selectedRoomIndex, setSelectedRoomIndex] = useState<number>(0);

  // Digital Signature State
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [hasSignature, setHasSignature] = useState<boolean>(false);
  const [clientName, setClientName] = useState<string>('Mr. & Mrs. R. Singhania');
  const [clientEmail, setClientEmail] = useState<string>('client@luxuryvillas.in');
  const [agreeTerms, setAgreeTerms] = useState<boolean>(false);
  const [signOffRecord, setSignOffRecord] = useState<SignOffRecord | null>(() => {
    const saved = localStorage.getItem(`ultida_client_approval_${projectId}`);
    if (saved) {
      try { return JSON.parse(saved); } catch { return null; }
    }
    return null;
  });

  const activePreset = ROOM_PRESETS[selectedRoomIndex] ?? ROOM_PRESETS[0];

  // Setup Canvas
  useEffect(() => {
    if (activeTab !== 'approval' || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1c1917';
  }, [activeTab]);

  // Canvas Drawing Handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setHasSignature(false);
  };

  // Submit Approval
  const handleSubmitApproval = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canvasRef.current || !hasSignature || !agreeTerms || !clientName.trim()) return;

    const signatureData = canvasRef.current.toDataURL('image/png');
    const now = new Date();
    const certId = `ULT-${projectId.slice(0, 6).toUpperCase()}-${now.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const record: SignOffRecord = {
      clientName: clientName.trim(),
      clientEmail: clientEmail.trim(),
      approvalDate: now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      timestamp: now.toISOString(),
      signatureDataUrl: signatureData,
      projectId,
      scopeApproved: true,
      certificateId: certId,
    };

    setSignOffRecord(record);
    localStorage.setItem(`ultida_client_approval_${projectId}`, JSON.stringify(record));
  };

  return (
    <div className="client-portal-root">
      {/* ── Top Header ── */}
      <header className="client-portal-header">
        <div className="portal-brand">
          <div className="portal-logo">U</div>
          <div>
            <h1>ULTIDA DESIGN OS</h1>
            <p>Authoritative Client Presentation &amp; Digital Sign-Off</p>
          </div>
        </div>

        <div className="portal-header-actions">
          <div className="portal-project-badge">
            <span className="badge-tag">PROJECT</span>
            <strong>{projectId.toUpperCase()}</strong>
          </div>

          {signOffRecord ? (
            <div className="approval-status-pill approved">
              <CheckCircle2 size={15} />
              <span>APPROVED &amp; RELEASED ({signOffRecord.approvalDate})</span>
            </div>
          ) : (
            <div className="approval-status-pill pending">
              <ShieldCheck size={15} />
              <span>PENDING CLIENT SIGN-OFF</span>
            </div>
          )}

          <button
            type="button"
            className="portal-watermark-toggle"
            onClick={() => setWatermarkEnabled((v) => !v)}
            title="Toggle presentation watermark overlay"
          >
            {watermarkEnabled ? 'Watermark: ON' : 'Watermark: OFF'}
          </button>
        </div>
      </header>

      {/* ── Sub-Nav Tabs ── */}
      <nav className="portal-tabs-bar" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'walkthrough360'}
          className={`portal-tab ${activeTab === 'walkthrough360' ? 'active' : ''}`}
          onClick={() => setActiveTab('walkthrough360')}
        >
          <Compass size={15} /> 360° VR Walkthrough
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'elevations'}
          className={`portal-tab ${activeTab === 'elevations' ? 'active' : ''}`}
          onClick={() => setActiveTab('elevations')}
        >
          <FileText size={15} /> Joinery Elevations
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'finishes'}
          className={`portal-tab ${activeTab === 'finishes' ? 'active' : ''}`}
          onClick={() => setActiveTab('finishes')}
        >
          <Sparkles size={15} /> Material Finishes
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'commercial'}
          className={`portal-tab ${activeTab === 'commercial' ? 'active' : ''}`}
          onClick={() => setActiveTab('commercial')}
        >
          <Layers size={15} /> Estimate Summary
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'approval'}
          className={`portal-tab highlight ${activeTab === 'approval' ? 'active' : ''}`}
          onClick={() => setActiveTab('approval')}
        >
          <Award size={15} /> Digital Sign-Off
        </button>
      </nav>

      {/* ── Main Viewport Content ── */}
      <main className="client-portal-body">
        {/* ══════ TAB 1: 360° VIRTUAL WALKTHROUGH ══════ */}
        {activeTab === 'walkthrough360' && (
          <div className="portal-view-section">
            <div className="room-nav-carousel">
              {ROOM_PRESETS.map((p, idx) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedRoomIndex(idx)}
                  className={`room-pill ${selectedRoomIndex === idx ? 'active' : ''}`}
                >
                  <span className="room-num">0{idx + 1}</span>
                  <div className="room-info">
                    <strong>{p.name}</strong>
                    <small>{p.category}</small>
                  </div>
                </button>
              ))}
            </div>

            <PanoramaViewer360
              roomTitle={activePreset.name}
              watermarkText={watermarkEnabled ? 'ULTIDA LUXURY INTERIORS · CLIENT PRESENTATION' : undefined}
              showWatermarkDefault={watermarkEnabled}
              hotspots={activePreset.defaultHotspots}
            />
          </div>
        )}

        {/* ══════ TAB 2: JOINERY ELEVATIONS ══════ */}
        {activeTab === 'elevations' && (
          <div className="portal-view-section elevations-grid">
            <div className="portal-card">
              <h3>System 32 Architectural Shop Elevations</h3>
              <p>Millimetre-accurate manufacturing drawings calibrated to site surveys with dummy fillers and System 32 joinery.</p>

              <div className="elevation-svg-preview">
                <svg viewBox="0 0 1000 500" className="preview-svg">
                  <rect width="1000" height="500" fill="#181411" />
                  {/* Floor datum */}
                  <line x1="50" y1="420" x2="950" y2="420" stroke="#c59c2d" strokeWidth="3" />
                  <text x="50" y="445" fill="#a8a29e" fontSize="12">FFL ±0.00 (Finished Floor Level)</text>

                  {/* Ceiling datum */}
                  <line x1="50" y1="80" x2="950" y2="80" stroke="#a8a29e" strokeDasharray="6 4" strokeWidth="1.5" />
                  <text x="50" y="70" fill="#a8a29e" fontSize="12">CEILING DATUM +2700mm</text>

                  {/* Wardrobe Outline */}
                  <rect x="180" y="80" width="640" height="340" fill="#292524" stroke="#c59c2d" strokeWidth="2" />

                  {/* 4 Shutter Bays */}
                  <line x1="340" y1="80" x2="340" y2="420" stroke="#78716c" strokeWidth="1.5" />
                  <line x1="500" y1="80" x2="500" y2="420" stroke="#78716c" strokeWidth="1.5" />
                  <line x1="660" y1="80" x2="660" y2="420" stroke="#78716c" strokeWidth="1.5" />

                  {/* Dimension Annotations */}
                  <line x1="180" y1="50" x2="820" y2="50" stroke="#c59c2d" strokeWidth="1.2" />
                  <text x="500" y="42" fill="#fbbf24" fontSize="13" fontWeight="bold" textAnchor="middle">CLEAR WIDTH: 2400mm (4 × 600mm Bays)</text>

                  <line x1="860" y1="80" x2="860" y2="420" stroke="#c59c2d" strokeWidth="1.2" />
                  <text x="880" y="250" fill="#fbbf24" fontSize="13" fontWeight="bold">HEIGHT: 2400mm</text>

                  {/* 30mm Fillers */}
                  <rect x="150" y="80" width="30" height="340" fill="#44403c" stroke="#78716c" />
                  <text x="165" y="260" fill="#a8a29e" fontSize="9" textAnchor="middle" transform="rotate(-90 165 260)">30mm FILLER</text>
                  <rect x="820" y="80" width="30" height="340" fill="#44403c" stroke="#78716c" />
                  <text x="835" y="260" fill="#a8a29e" fontSize="9" textAnchor="middle" transform="rotate(-90 835 260)">30mm FILLER</text>
                </svg>
              </div>

              <div className="elevation-details-table">
                <table>
                  <thead>
                    <tr><th>Room Area</th><th>Casework Type</th><th>Dimensions (W×H×D)</th><th>Hardware System</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    <tr><td>Master Suite</td><td>Fluted Glass Wardrobe</td><td>2400 × 2400 × 600 mm</td><td>Blum Sensys Soft-Close + Hafele Profile</td><td><span className="badge-verified">Verified</span></td></tr>
                    <tr><td>Living Room</td><td>Floating TV Console</td><td>3000 × 450 × 400 mm</td><td>Hettich Push-to-Open Undermount</td><td><span className="badge-verified">Verified</span></td></tr>
                    <tr><td>Kitchen</td><td>Tall Pantry + Island</td><td>3600 × 2700 × 650 mm</td><td>Servo-Drive Electric Lift-Up</td><td><span className="badge-verified">Verified</span></td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══════ TAB 3: MATERIAL FINISHES ══════ */}
        {activeTab === 'finishes' && (
          <div className="portal-view-section">
            <div className="finishes-palette-grid">
              <div className="finish-card">
                <div className="finish-swatch" style={{ background: 'linear-gradient(135deg, #3d2b1f, #221710)' }} />
                <div className="finish-meta">
                  <span className="finish-category">Veneer / Surface</span>
                  <h4>Smoked Royal Walnut</h4>
                  <p>Open-pore natural timber veneer with ultra-matte polyurethane protective lacquer.</p>
                </div>
              </div>

              <div className="finish-card">
                <div className="finish-swatch" style={{ background: 'linear-gradient(135deg, #e5e5e5, #ffffff, #d4d4d4)' }} />
                <div className="finish-meta">
                  <span className="finish-category">Countertop / Altar</span>
                  <h4>Italian Calacatta Quartz</h4>
                  <p>Seamless non-porous engineered stone with warm gold and charcoal veining.</p>
                </div>
              </div>

              <div className="finish-card">
                <div className="finish-swatch" style={{ background: 'linear-gradient(135deg, #383431, #1e1b18)' }} />
                <div className="finish-meta">
                  <span className="finish-category">Cabinetry Shutter</span>
                  <h4>Satin Matt Charcoal</h4>
                  <p>Anti-fingerprint thermal laminate with 2.0mm color-matched bevelled PVC edge banding.</p>
                </div>
              </div>

              <div className="finish-card">
                <div className="finish-swatch" style={{ background: 'linear-gradient(135deg, #d97706, #92400e)' }} />
                <div className="finish-meta">
                  <span className="finish-category">Architectural Metal</span>
                  <h4>Brushed Champagne Bronze</h4>
                  <p>Anodized aluminum profiles for sliding tracks, gola handles, and door frames.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════ TAB 4: COMMERCIAL ESTIMATE SUMMARY ══════ */}
        {activeTab === 'commercial' && (
          <div className="portal-view-section">
            <div className="commercial-summary-card">
              <div className="comm-header">
                <div>
                  <h3>Turnkey Manufacturing &amp; Installation Estimate</h3>
                  <p>Transparent Bill of Quantities (BOQ) with factory System 32 joinery and warranty.</p>
                </div>
                <div className="comm-total-badge">
                  <span>Grand Total (incl. GST)</span>
                  <strong>₹ 16,85,000</strong>
                </div>
              </div>

              <table className="comm-table">
                <thead>
                  <tr><th>Scope Area</th><th>Casework Modules</th><th>Hardware &amp; Surface</th><th>Taxable (INR)</th><th>GST (18%)</th><th>Total (INR)</th></tr>
                </thead>
                <tbody>
                  <tr><td>Master Suite</td><td>Wardrobe &amp; Floating Bed Back</td><td>Blum Sensys + Smoked Walnut</td><td>₹ 5,20,000</td><td>₹ 93,600</td><td>₹ 6,13,600</td></tr>
                  <tr><td>Living &amp; Foyer</td><td>TV Console &amp; Acoustic Wall</td><td>Travertine &amp; Travertine Sintered</td><td>₹ 4,10,000</td><td>₹ 73,800</td><td>₹ 4,83,800</td></tr>
                  <tr><td>Modular Kitchen</td><td>Island, Tall Pantry &amp; Counters</td><td>Hafele Matrix &amp; Quartz 40mm</td><td>₹ 4,95,000</td><td>₹ 89,100</td><td>₹ 5,84,100</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══════ TAB 5: DIGITAL APPROVAL & SIGN-OFF ══════ */}
        {activeTab === 'approval' && (
          <div className="portal-view-section approval-pane">
            {signOffRecord ? (
              <div className="certificate-card">
                <div className="cert-header">
                  <Award size={48} color="#c59c2d" />
                  <div>
                    <span className="cert-tag">CERTIFICATE OF CLIENT APPROVAL</span>
                    <h2>Design Package Formally Approved</h2>
                    <p>Certificate ID: <strong>{signOffRecord.certificateId}</strong></p>
                  </div>
                </div>

                <div className="cert-grid">
                  <div className="cert-col">
                    <span className="col-label">Approved By</span>
                    <strong>{signOffRecord.clientName}</strong>
                    <small>{signOffRecord.clientEmail}</small>
                  </div>
                  <div className="cert-col">
                    <span className="col-label">Approval Date</span>
                    <strong>{signOffRecord.approvalDate}</strong>
                    <small>{new Date(signOffRecord.timestamp).toLocaleTimeString()}</small>
                  </div>
                  <div className="cert-col">
                    <span className="col-label">Project Scope</span>
                    <strong>{projectId.toUpperCase()}</strong>
                    <small>System 32 Modular Joinery</small>
                  </div>
                </div>

                <div className="cert-signature-preview">
                  <span className="col-label">Digital Signature on Record</span>
                  <img src={signOffRecord.signatureDataUrl} alt="Client Signature" className="cert-signature-img" />
                </div>

                <div className="cert-actions">
                  <button
                    type="button"
                    className="portal-btn primary"
                    onClick={() => window.print()}
                  >
                    <Printer size={15} /> Print / Save Certificate PDF
                  </button>
                  <button
                    type="button"
                    className="portal-btn secondary"
                    onClick={() => {
                      if (confirm('Revoke sign-off and re-enable signature capture?')) {
                        localStorage.removeItem(`ultida_client_approval_${projectId}`);
                        setSignOffRecord(null);
                        setHasSignature(false);
                      }
                    }}
                  >
                    Revoke &amp; Re-sign
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitApproval} className="signoff-form-card">
                <div className="signoff-header">
                  <ShieldCheck size={28} color="#c59c2d" />
                  <div>
                    <h3>Client Digital Sign-Off &amp; Production Release</h3>
                    <p>Review the presentation tabs above, confirm client details, and provide your digital signature below.</p>
                  </div>
                </div>

                <div className="form-row-grid">
                  <label className="form-field">
                    <span>Client Full Name</span>
                    <input
                      type="text"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="e.g. Mr. & Mrs. R. Singhania"
                      required
                    />
                  </label>

                  <label className="form-field">
                    <span>Contact Email Address</span>
                    <input
                      type="email"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      placeholder="client@domain.com"
                      required
                    />
                  </label>
                </div>

                {/* Signature Canvas */}
                <div className="signature-area">
                  <div className="sig-label-row">
                    <span>Digital Signature (Draw with mouse or finger)</span>
                    <button type="button" onClick={clearSignature} className="clear-sig-btn">
                      Clear Signature
                    </button>
                  </div>
                  <canvas
                    ref={canvasRef}
                    width={600}
                    height={160}
                    className="signature-canvas"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                  />
                </div>

                <label className="terms-checkbox">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    required
                  />
                  <span>
                    I confirm that I have reviewed the 360° walkthrough, joinery elevations, material finishes, and estimate summary. I hereby authorize factory procurement and fabrication release for this project.
                  </span>
                </label>

                <div className="form-submit-row">
                  <button
                    type="submit"
                    disabled={!hasSignature || !agreeTerms || !clientName.trim()}
                    className="portal-btn primary large"
                  >
                    <CheckCircle2 size={18} /> Confirm &amp; Sign-Off Production Release
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
