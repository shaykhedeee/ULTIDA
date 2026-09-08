import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Download, Printer, ChevronLeft, ChevronRight,
  Layers, CheckCircle2, Home, ArrowRight, ShieldCheck, Sparkles,
  Palette, Grid, Maximize2, Compass, Box
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getApiBase } from '../../lib/api-base';
import { generateSketchUpRubyScript } from '../../lib/sketchup-exporter';
import { createDefaultDemoScene } from '../../features/scene/SceneStudio';
import ArchitecturalElevationSignOffSheet from '../modular/ArchitecturalElevationSignOffSheet';
import './working-drawings-dossier.css';

interface WorkingDrawingsProps {
  projectId: string | null;
  briefSaved?: boolean;
  planApproved?: boolean;
  sceneVersionId?: string | null;
  sceneApproved?: boolean;
  modules?: any[];
  materials?: any[];
}

export function WorkingDrawingsDossier({
  projectId,
  briefSaved = true,
  planApproved = true,
  sceneVersionId,
  sceneApproved = true,
  modules = [],
  materials = []
}: WorkingDrawingsProps) {
  const navigate = useNavigate();
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [projectData, setProjectData] = useState<{
    name: string;
    clientName: string;
    location: string;
    designerName: string;
    date: string;
  }>({
    name: 'SHARMA LUXURY RESIDENCE (3BHK)',
    clientName: 'MR. ROHIT & MRS. ANANYA SHARMA',
    location: 'Pali Hill, Bandra West, Mumbai 400050',
    designerName: 'MUSKAN PAREEK',
    date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (!projectId || !supabase) return;
    void (async () => {
      try {
        const { data } = await supabase.from('projects').select('*').eq('id', projectId).single();
        if (data) {
          setProjectData((prev) => ({
            ...prev,
            name: data.name || prev.name,
            clientName: data.client_name || prev.clientName,
            location: data.location || prev.location,
          }));
        }
      } catch {
        // use defaults
      }
    })();
  }, [projectId]);

  const SHEETS = [
    { id: 'cover', title: 'Cover & Sign-Off Approvals', room: 'OVERVIEW', code: 'DWG-001' },
    { id: 'floor-plan', title: 'Overall Measured Floor Plan', room: 'ALL ROOMS', code: 'DWG-002' },
    { id: 'finishes', title: 'Finishes & Material Palette', room: 'SPECIFICATION', code: 'DWG-003' },
    { id: 'kitchen', title: 'Modular Kitchen & Utility Suite', room: 'KITCHEN', code: 'DWG-004' },
    { id: 'master-bed', title: 'Master Bedroom Wardrobe & Dresser', room: 'MASTER BEDROOM', code: 'DWG-005' },
    { id: 'kids-bed', title: 'Kids Bedroom Wardrobe & Study Unit', room: 'KIDS BEDROOM', code: 'DWG-006' },
    { id: 'tv-pooja', title: 'Living TV Console & Backlit Mandir', room: 'LIVING & DINING', code: 'DWG-007' },
    { id: 'crockery', title: 'Dining Crockery & Bar Console', room: 'DINING AREA', code: 'DWG-008' },
    { id: 'vanity', title: 'Washroom Vanity & Cistern Box', room: 'BATHROOM SUITE', code: 'DWG-009' },
    { id: 'checklist', title: 'Execution & Installation Checklist', room: 'FACTORY RELEASE', code: 'DWG-010' },
  ];

  const currentSheet = SHEETS[activeSheetIndex] || SHEETS[0];

  function downloadCompleteDxfPackage() {
    // Generate comprehensive multi-entity AutoCAD DXF file (R12/2000 compliant)
    const lines = [
      '0', 'SECTION', '2', 'HEADER', '9', '$INSUNITS', '70', '4', '0', 'ENDSEC',
      '0', 'SECTION', '2', 'TABLES',
      '0', 'TABLE', '2', 'LAYER', '70', '7',
      '0', 'LAYER', '2', 'A-WALL', '70', '0', '62', '7', '6', 'CONTINUOUS', '0',
      '0', 'LAYER', '2', 'A-CABN-OUTLINE', '70', '0', '62', '4', '6', 'CONTINUOUS', '0',
      '0', 'LAYER', '2', 'A-CABN-INTERIOR', '70', '0', '62', '3', '6', 'CONTINUOUS', '0',
      '0', 'LAYER', '2', 'A-CABN-DIMS', '70', '0', '62', '1', '6', 'CONTINUOUS', '0',
      '0', 'LAYER', '2', 'A-CABN-TEXT', '70', '0', '62', '2', '6', 'CONTINUOUS', '0',
      '0', 'LAYER', '2', 'A-HARDWARE', '70', '0', '62', '5', '6', 'CONTINUOUS', '0',
      '0', 'LAYER', '2', 'A-CABN-SPEC', '70', '0', '62', '6', '6', 'CONTINUOUS', '0',
      '0', 'ENDTAB', '0', 'ENDSEC',
      '0', 'SECTION', '2', 'ENTITIES',
    ];

    function addLine(layer: string, x1: number, y1: number, x2: number, y2: number) {
      lines.push('0', 'LINE', '8', layer, '10', x1.toFixed(2), '20', y1.toFixed(2), '30', '0.0', '11', x2.toFixed(2), '21', y2.toFixed(2), '31', '0.0');
    }

    function addText(layer: string, text: string, x: number, y: number, heightMm: number) {
      lines.push('0', 'TEXT', '8', layer, '10', x.toFixed(2), '20', y.toFixed(2), '30', '0.0', '40', heightMm.toString(), '1', text);
    }

    // Sheet Border & Title Box at (0, 0)
    addLine('A-CABN-OUTLINE', 0, 0, 4200, 0);
    addLine('A-CABN-OUTLINE', 4200, 0, 4200, 2970);
    addLine('A-CABN-OUTLINE', 4200, 2970, 0, 2970);
    addLine('A-CABN-OUTLINE', 0, 2970, 0, 0);
    addText('A-CABN-TEXT', `PROJECT: ${projectData.name}`, 2600, 200, 60);
    addText('A-CABN-TEXT', `CLIENT: ${projectData.clientName}`, 2600, 120, 50);
    addText('A-CABN-TEXT', `DRAWING: ${currentSheet.code} - ${currentSheet.title}`, 2600, 50, 45);

    // Carcass Drafting entities for active sheet
    addLine('A-CABN-OUTLINE', 300, 400, 2400, 400);
    addLine('A-CABN-OUTLINE', 2400, 400, 2400, 2500);
    addLine('A-CABN-OUTLINE', 2400, 2500, 300, 2500);
    addLine('A-CABN-OUTLINE', 300, 2500, 300, 400);
    // 100mm Skirting
    addLine('A-CABN-INTERIOR', 300, 500, 2400, 500);
    addText('A-CABN-TEXT', 'SKIRTING 100mm', 1200, 430, 35);
    // Vertical Mullion
    addLine('A-CABN-INTERIOR', 1350, 500, 1350, 2500);
    // Shelves
    addLine('A-CABN-INTERIOR', 300, 1550, 1350, 1550);
    addLine('A-CABN-INTERIOR', 1350, 1550, 2400, 1550);
    addText('A-CABN-TEXT', '1050 MM CLEAR HANGING', 700, 1950, 40);
    addText('A-CABN-TEXT', 'AS / EQ SHELVING', 1750, 1950, 40);

    // Dimension lines (Red)
    addLine('A-CABN-DIMS', 300, 2600, 2400, 2600);
    addText('A-CABN-DIMS', '2100 mm', 1300, 2650, 45);
    addLine('A-CABN-DIMS', 2500, 400, 2500, 2500);
    addText('A-CABN-DIMS', '2100 mm', 2550, 1400, 45);

    lines.push('0', 'ENDSEC', '0', 'EOF');
    const dxfString = lines.join('\r\n');
    const blob = new Blob([dxfString], { type: 'application/dxf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectData.name.replace(/[^a-z0-9]+/gi, '-')}-${currentSheet.code}.dxf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadSketchUpModel() {
    try {
      const demo = createDefaultDemoScene();
      const sceneToExport = {
        ...demo,
        projectId: projectId || 'sharma-residence',
        modules: (modules && modules.length > 0) ? modules.map((m) => ({
          id: m.id,
          roomId: m.roomId || 'room-master-bed',
          family: m.family || m.label || 'Modular Casework',
          widthMm: m.widthMm || 1200,
          depthMm: m.depthMm || 600,
          heightMm: m.heightMm || 2100,
          position: { xMm: 500, yMm: 200 },
          rotationDeg: 0,
          anchor: 'floor',
          confidence: 1,
        })) : demo.modules,
      };

      const rubyScript = generateSketchUpRubyScript(sceneToExport as any);
      const blob = new Blob([rubyScript], { type: 'text/x-ruby;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectData.name.replace(/[^a-z0-9]+/gi, '-')}-3D-SketchUp-Model.rb`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to generate SketchUp Ruby script:', err);
    }
  }

  async function downloadCompleteProductionPdf() {
    try {
      const apiBase = getApiBase();
      const endpoint = (projectId && sceneVersionId)
        ? `${apiBase}/api/projects/${projectId}/scenes/${sceneVersionId}/production/package.pdf`
        : projectId
        ? `${apiBase}/api/projects/${projectId}/dossier.pdf`
        : null;

      if (endpoint) {
        const resp = await fetch(endpoint);
        if (resp.ok) {
          const blob = await resp.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${projectData.name.replace(/[^a-z0-9]+/gi, '-')}-Master-Sign-Off-Dossier.pdf`;
          a.click();
          URL.revokeObjectURL(url);
          return;
        }
      }
      window.print();
    } catch (err) {
      console.error('Failed to download PDF dossier from server, falling back to print dialog:', err);
      window.print();
    }
  }

  return (
    <main className="drawings-dossier-workspace">
      {/* Top Header Command Bar */}
      <header className="drawings-dossier-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ background: '#0284c7', color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 4, letterSpacing: '0.5px' }}>
              STEP 6: WORKING DRAWINGS &amp; CAD DOSSIER
            </span>
            <span style={{ color: '#34d399', fontSize: 11, fontWeight: 700 }}>
              ✓ IS 710 Marine / HDHMR &amp; System 32 Certified
            </span>
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: 0 }}>
            {projectData.name} — Production Sign-Off Dossier
          </h1>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: '#94a3b8' }}>
            Client: <strong style={{ color: '#e2e8f0' }}>{projectData.clientName}</strong> · Designer: <strong style={{ color: '#e2e8f0' }}>{projectData.designerName}</strong> · Sheet {activeSheetIndex + 1} of {SHEETS.length}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={downloadCompleteProductionPdf}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 18px',
              borderRadius: 8,
              background: 'linear-gradient(135deg, #c59c2d, #a17c18)',
              color: '#000',
              border: 0,
              fontSize: 12.5,
              fontWeight: 900,
              cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(197, 156, 45, 0.4)',
            }}
          >
            <FileText size={15} /> Download Master Sign-Off PDF
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: 8,
              background: '#334155',
              color: '#f8fafc',
              border: '1px solid #475569',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Printer size={14} /> Print
          </button>
          <button
            type="button"
            onClick={downloadCompleteDxfPackage}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              borderRadius: 8,
              background: 'linear-gradient(135deg, #0284c7, #0369a1)',
              color: '#fff',
              border: 0,
              fontSize: 12.5,
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(2, 132, 199, 0.4)',
            }}
          >
            <Download size={15} /> Download AutoCAD DXF
          </button>
          <button
            type="button"
            onClick={downloadSketchUpModel}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              borderRadius: 8,
              background: 'linear-gradient(135deg, #059669, #047857)',
              color: '#fff',
              border: 0,
              fontSize: 12.5,
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(5, 150, 105, 0.4)',
            }}
          >
            <Box size={15} /> Download SketchUp 3D (.rb)
          </button>
        </div>
      </header>

      {/* Sheet Navigation Strip */}
      <nav className="drawings-dossier-nav-strip" aria-label="Drawing Sheets">
        {SHEETS.map((sheet, index) => (
          <button
            key={sheet.id}
            type="button"
            className={`drawings-sheet-tab ${index === activeSheetIndex ? 'active' : ''}`}
            onClick={() => setActiveSheetIndex(index)}
          >
            <span className="drawings-sheet-num">{index + 1}</span>
            <span>{sheet.title}</span>
          </button>
        ))}
      </nav>

      {/* Main Drawing Viewport: White A3 Architectural Sheet */}
      <section className="drawings-dossier-viewport">
        <div className="drawings-paper-sheet">
          {/* SHEET 1: PROJECT SIGN-OFF COVER DOCUMENT */}
          {currentSheet.id === 'cover' && (
            <div style={{ padding: '60px 50px', minHeight: 760, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: '#1c1917', padding: '10px 24px', borderRadius: 8, marginBottom: 24 }}>
                  <Sparkles size={20} color="#c59c2d" />
                  <span style={{ color: '#fff', fontWeight: 900, fontSize: 16, letterSpacing: 1.5 }}>
                    CUBEDECORS × ULTIDA
                  </span>
                </div>
                <h1 style={{ fontSize: 32, fontWeight: 900, color: '#dc2626', margin: '0 0 16px', letterSpacing: 1, textDecoration: 'underline', textUnderlineOffset: 8 }}>
                  PROJECT SIGN OFF DOCUMENT
                </h1>
                <p style={{ fontSize: 14, color: '#64748b', margin: 0, fontWeight: 600 }}>
                  Turnkey Modular Interior Architecture · Precision CAD Execution Pack
                </p>
              </div>

              {/* Client & Project Credentials Grid */}
              <div style={{ margin: '40px auto', width: '100%', maxWidth: 780, border: '2px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', borderBottom: '1px solid #e2e8f0', padding: '14px 20px', background: '#f8fafc' }}>
                  <strong style={{ fontSize: 13, color: '#334155' }}>CLIENT NAME:</strong>
                  <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{projectData.clientName}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', borderBottom: '1px solid #e2e8f0', padding: '14px 20px' }}>
                  <strong style={{ fontSize: 13, color: '#334155' }}>MOBILE NUMBER:</strong>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>+91 98201 44521 / +91 98203 11842</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', borderBottom: '1px solid #e2e8f0', padding: '14px 20px', background: '#f8fafc' }}>
                  <strong style={{ fontSize: 13, color: '#334155' }}>PROJECT SITE ADDRESS:</strong>
                  <span style={{ fontSize: 13, color: '#334155' }}>{projectData.location}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', borderBottom: '1px solid #e2e8f0', padding: '14px 20px' }}>
                  <strong style={{ fontSize: 13, color: '#334155' }}>LEAD DESIGN ARCHITECT:</strong>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{projectData.designerName} (Ph: 6360240132)</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', padding: '14px 20px', background: '#f8fafc' }}>
                  <strong style={{ fontSize: 13, color: '#334155' }}>EXECUTION STANDARD:</strong>
                  <span style={{ fontSize: 13, color: '#059669', fontWeight: 800 }}>IS 710 Marine Grade BWP Plywood / Action TESA HDHMR · System 32 Drilling</span>
                </div>
              </div>

              {/* 5-Manager Approval Signature Line Block */}
              <div>
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <strong style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>
                    Final Production &amp; Installation Sign-Off Approvals
                  </strong>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, borderTop: '2px solid #cbd5e1', paddingTop: 30 }}>
                  {[
                    { role: 'Client Signature', name: 'Authorized Signatory' },
                    { role: 'Design Manager', name: 'Ar. Muskan Pareek' },
                    { role: 'Sales Manager', name: 'Kunal Sharma' },
                    { role: 'Execution Manager', name: 'Praveen Nair' },
                    { role: 'Operational Manager', name: 'Sanjay Reddy' },
                  ].map((sig, i) => (
                    <div key={i} style={{ textAlign: 'center' }}>
                      <div style={{ height: 40, borderBottom: '1.5px dashed #94a3b8', marginBottom: 8 }} />
                      <strong style={{ display: 'block', fontSize: 12, color: '#0f172a' }}>{sig.role}</strong>
                      <small style={{ fontSize: 10.5, color: '#64748b' }}>{sig.name}</small>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer metadata */}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: 12, marginTop: 30, fontSize: 11, color: '#94a3b8' }}>
                <span>Dossier Reference: ULT-DWG-2026-SHARMA-01</span>
                <span>Cube Decors &amp; Aakar Interior Solutions · Sheet 01 of 10</span>
              </div>
            </div>
          )}

          {/* SHEET 2: OVERALL MEASURED FLOOR PLAN */}
          {currentSheet.id === 'floor-plan' && (
            <div style={{ padding: '30px 40px', minHeight: 760, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #dc2626', paddingBottom: 10 }}>
                <h2 style={{ fontSize: 20, fontWeight: 900, color: '#dc2626', margin: 0 }}>
                  FLOOR PLAN: OVERALL 2D ARCHITECTURAL LAYOUT
                </h2>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>SHEET NO: 02</span>
              </div>

              {/* 2D Architectural Floor Plan Graphic */}
              <div style={{ margin: '20px 0', border: '1.5px solid #cbd5e1', borderRadius: 8, padding: 16, background: '#fafaf9' }}>
                <svg viewBox="0 0 1100 580" style={{ width: '100%', height: 'auto', background: '#fff' }}>
                  {/* Grid background */}
                  <defs>
                    <pattern id="cadGrid" width="30" height="30" patternUnits="userSpaceOnUse">
                      <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#f1f5f9" strokeWidth="1" />
                    </pattern>
                  </defs>
                  <rect width="1100" height="580" fill="url(#cadGrid)" />

                  {/* ROOM 1: Living & Dining */}
                  <rect x="60" y="50" width="460" height="320" fill="none" stroke="#0f172a" strokeWidth="4" />
                  <text x="290" y="210" textAnchor="middle" fontSize="13" fontWeight="800" fill="#0f172a">LIVING &amp; DINING ROOM</text>
                  <text x="290" y="230" textAnchor="middle" fontSize="11" fontWeight="700" fill="#64748b">4993 MM × 2893 MM</text>
                  {/* TV Console on North Wall */}
                  <rect x="180" y="52" width="220" height="35" fill="#fef3c7" stroke="#b45309" strokeWidth="1.5" />
                  <text x="290" y="74" textAnchor="middle" fontSize="9" fontWeight="700" fill="#92400e">TV CONSOLE &amp; MEDIA WALL</text>

                  {/* ROOM 2: Master Bedroom */}
                  <rect x="540" y="50" width="380" height="320" fill="none" stroke="#0f172a" strokeWidth="4" />
                  <text x="730" y="210" textAnchor="middle" fontSize="13" fontWeight="800" fill="#0f172a">MBR BED ROOM</text>
                  <text x="730" y="230" textAnchor="middle" fontSize="11" fontWeight="700" fill="#64748b">3768 MM × 3433 MM</text>
                  {/* 4-Door Wardrobe on East Wall */}
                  <rect x="883" y="100" width="35" height="240" fill="#ede9fe" stroke="#6d28d9" strokeWidth="1.5" />
                  <text x="900" y="225" textAnchor="middle" fontSize="9" fontWeight="700" fill="#5b21b6" transform="rotate(90, 900, 225)">WARDROBE + LOFTS</text>

                  {/* ROOM 3: Modular Kitchen & Utility */}
                  <rect x="60" y="380" width="380" height="170" fill="none" stroke="#0f172a" strokeWidth="4" />
                  <text x="250" y="470" textAnchor="middle" fontSize="13" fontWeight="800" fill="#0f172a">KITCHEN &amp; BREAKFAST COUNTER</text>
                  <text x="250" y="490" textAnchor="middle" fontSize="11" fontWeight="700" fill="#64748b">3378 MM × 2511 MM</text>
                  {/* L-Shape Kitchen Run */}
                  <rect x="62" y="382" width="280" height="40" fill="#e0f2fe" stroke="#0284c7" strokeWidth="1.5" />
                  <rect x="302" y="382" width="40" height="160" fill="#e0f2fe" stroke="#0284c7" strokeWidth="1.5" />

                  {/* ROOM 4: Kids Bedroom */}
                  <rect x="460" y="380" width="360" height="170" fill="none" stroke="#0f172a" strokeWidth="4" />
                  <text x="640" y="470" textAnchor="middle" fontSize="13" fontWeight="800" fill="#0f172a">KBR BED ROOM &amp; STUDY</text>
                  <text x="640" y="490" textAnchor="middle" fontSize="11" fontWeight="700" fill="#64748b">3397 MM × 3285 MM</text>

                  {/* Doors & Swings */}
                  <path d="M 520 200 A 70 70 0 0 1 520 270" fill="none" stroke="#dc2626" strokeWidth="1.5" strokeDasharray="3 2" />
                  <path d="M 440 430 A 60 60 0 0 1 440 490" fill="none" stroke="#dc2626" strokeWidth="1.5" strokeDasharray="3 2" />

                  {/* Overall Dimensions (Red chains) */}
                  <line x1="60" y1="30" x2="920" y2="30" stroke="#dc2626" strokeWidth="1.5" />
                  <text x="490" y="24" textAnchor="middle" fontSize="11" fontWeight="800" fill="#dc2626">10,240 MM OVERALL SPAN</text>
                </svg>
              </div>

              {/* Title Block */}
              <div style={{ border: '1.5px solid #0f172a', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', fontSize: 11, background: '#fff' }}>
                <div style={{ padding: '8px 12px', borderRight: '1px solid #0f172a' }}>
                  <strong style={{ display: 'block', fontSize: 12 }}>{projectData.name}</strong>
                  <span style={{ color: '#64748b' }}>Client: {projectData.clientName}</span>
                </div>
                <div style={{ padding: '8px 12px', borderRight: '1px solid #0f172a' }}>
                  <strong>DWG: DWG-FP-01</strong>
                  <span style={{ display: 'block', color: '#64748b' }}>SCALE: 1:50 @ A3</span>
                </div>
                <div style={{ padding: '8px 12px', borderRight: '1px solid #0f172a' }}>
                  <strong>DATE: {projectData.date}</strong>
                  <span style={{ display: 'block', color: '#64748b' }}>REV: 02 (APPROVED)</span>
                </div>
                <div style={{ padding: '8px 12px' }}>
                  <strong>DRAWN BY: CUBE DECORS</strong>
                  <span style={{ display: 'block', color: '#64748b' }}>CHECKED: AR. MUSKAN</span>
                </div>
              </div>
            </div>
          )}

          {/* SHEET 3: CURATED FINISHES & SWATCH BOARD */}
          {currentSheet.id === 'finishes' && (
            <div style={{ padding: '30px 40px', minHeight: 760, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #dc2626', paddingBottom: 10 }}>
                <h2 style={{ fontSize: 20, fontWeight: 900, color: '#dc2626', margin: 0 }}>
                  MATERIAL SPECIFICATIONS &amp; APPROVED LAMINATE PALETTE
                </h2>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>SHEET NO: 03</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, margin: '24px 0' }}>
                {[
                  { brand: 'OLIVIYA 800', code: 'GLE-3- GREY PEWTER', role: 'Kitchen Base, Lofts & Tall Unit', color: '#4a5568', desc: 'Anti-fingerprint suede finish, high moisture resistance' },
                  { brand: 'OLIVIYA 800', code: 'GLE-1- OFF WHITE PEARLS', role: 'Kitchen Wall Cabinets', color: '#f8fafc', desc: 'Reflective pearl gloss acrylic with UV stability' },
                  { brand: 'DORBY VESTA', code: 'SG 8110 - COOL BEIGE', role: 'Master Bedroom Wardrobe', color: '#c4b5a5', desc: 'Ultra-matte silky touch with warm neutral undertone' },
                  { brand: 'DORBY VESTA', code: 'SG 8160 - WINE ACCENT', role: 'KBR Loft & Study Facia', color: '#4a1d24', desc: 'Deep wine velvet matte contrast panel' },
                  { brand: 'DORBY MICA', code: 'HG 104 - FROSTY WHITE', role: 'All Exposed Carcasses & Drawers', color: '#ffffff', desc: 'High-gloss acrylic face for seamless reflection' },
                  { brand: 'MERINO LAMINATES', code: '21028 - CHOCOLATE', role: 'Pooja Unit Base & Gopuram', color: '#3e2723', desc: 'Rich chocolate woodgrain laminate' },
                  { brand: 'MERINO LAMINATES', code: '42004 SGL - WHITE MARBLE', role: 'Pooja Mandir Backdrop', color: '#f5f5f4', desc: 'Gold-veined statuario marble textured sheet' },
                  { brand: 'ADVANCE LAMINATES', code: 'SF 6163 - CLIFTON WALNUT', role: 'Shoe Rack & Foyer Partition', color: '#5d4037', desc: 'Quarter-cut natural walnut veneer finish' },
                ].map((swatch, idx) => (
                  <div key={idx} style={{ border: '1.5px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.05)' }}>
                    <div style={{ height: 110, background: swatch.color, borderBottom: '1px solid #e2e8f0' }} />
                    <div style={{ padding: 12 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#0284c7', textTransform: 'uppercase' }}>{swatch.brand}</span>
                      <strong style={{ display: 'block', fontSize: 12.5, color: '#0f172a', margin: '2px 0 4px' }}>{swatch.code}</strong>
                      <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#b45309' }}>{swatch.role}</span>
                      <p style={{ margin: '6px 0 0', fontSize: 10.5, color: '#64748b' }}>{swatch.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Title Block */}
              <div style={{ border: '1.5px solid #0f172a', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', fontSize: 11, background: '#fff' }}>
                <div style={{ padding: '8px 12px', borderRight: '1px solid #0f172a' }}>
                  <strong style={{ display: 'block', fontSize: 12 }}>{projectData.name}</strong>
                  <span style={{ color: '#64748b' }}>Client: {projectData.clientName}</span>
                </div>
                <div style={{ padding: '8px 12px', borderRight: '1px solid #0f172a' }}>
                  <strong>DWG: DWG-MAT-01</strong>
                  <span style={{ display: 'block', color: '#64748b' }}>SPECIFICATION BOARD</span>
                </div>
                <div style={{ padding: '8px 12px', borderRight: '1px solid #0f172a' }}>
                  <strong>DATE: {projectData.date}</strong>
                  <span style={{ display: 'block', color: '#64748b' }}>REV: 02 (APPROVED)</span>
                </div>
                <div style={{ padding: '8px 12px' }}>
                  <strong>DRAWN BY: CUBE DECORS</strong>
                  <span style={{ display: 'block', color: '#64748b' }}>CHECKED: AR. MUSKAN</span>
                </div>
              </div>
            </div>
          )}

          {/* SHEETS 4+: AUTHENTIC ARCHITECTURAL 5-ZONE DETAIL SHEETS */}
          {['kitchen', 'master-bed', 'kids-bed', 'tv-pooja', 'crockery', 'vanity'].includes(currentSheet.id) && (
            <div style={{ padding: '20px 24px' }}>
              <ArchitecturalElevationSignOffSheet
                module={
                  currentSheet.id === 'kitchen'
                    ? { id: 'kitchen-lshape-island-3600', family: 'kitchen-base', name: '3600 L-Shaped Modular Kitchen with Island Breakfast Counter', widthMm: 3600, depthMm: 2400, heightMm: 2700, sku: 'ULT-KIT-L-ISL-3600', tags: ['kitchen', 'island'] }
                    : currentSheet.id === 'master-bed'
                    ? { id: 'wardrobe-4s-bay-seating-3300', family: 'wardrobe', name: '3300 4-Door Master Wardrobe with Integrated Bay Seating', widthMm: 3300, depthMm: 580, heightMm: 2785, sku: 'ULT-WD-BAY-3300', tags: ['wardrobe', 'bay-seating'] }
                    : currentSheet.id === 'kids-bed'
                    ? { id: 'wardrobe-sliding-dresser-2700', family: 'wardrobe', name: '2700 Kids Sliding Wardrobe with Integrated Dresser', widthMm: 2700, depthMm: 650, heightMm: 2700, sku: 'ULT-WD-SLD-2700', tags: ['wardrobe', 'sliding'] }
                    : currentSheet.id === 'tv-pooja'
                    ? { id: 'tv-mandir-combo-3200', family: 'tv-unit', name: '3200 Living TV Console & Backlit CNC Mandir Suite', widthMm: 3200, depthMm: 450, heightMm: 2700, sku: 'ULT-TV-MND-3200', tags: ['tv-unit', 'mandir'] }
                    : currentSheet.id === 'crockery'
                    ? { id: 'crockery-bar-fluted-2100', family: 'crockery', name: '2100 Dining Crockery & Bar Console with Push-to-Open Shutters', widthMm: 2100, depthMm: 450, heightMm: 2400, sku: 'ULT-CR-FLT-2100', tags: ['crockery', 'bar'] }
                    : { id: 'vanity-suite-cistern-1200', family: 'utility', name: '1200 Master Washroom Vanity with Concealed Cistern & LED Capsule Mirror', widthMm: 1200, depthMm: 500, heightMm: 2100, sku: 'ULT-VN-CST-1200', tags: ['vanity', 'cistern'] }
                }
                projectMetadata={{
                  projectName: projectData.name,
                  clientName: projectData.clientName,
                  flatNo: 'FLAT T-402, TOWER 3',
                  roomName: currentSheet.room,
                  drawingCode: currentSheet.code,
                  sheetNo: `SHEET ${activeSheetIndex + 1} OF ${SHEETS.length}`,
                  scale: '1:25 @ A3',
                  revision: 'REV-02 (APPROVED)',
                  date: projectData.date,
                  drawnBy: 'CUBE DECORS / ULTIDA',
                  checkedBy: 'LEAD ARCHITECT',
                }}
              />
            </div>
          )}

          {/* SHEET 10: DESIGN & EXECUTION CHECKLIST */}
          {currentSheet.id === 'checklist' && (
            <div style={{ padding: '30px 40px', minHeight: 760, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #dc2626', paddingBottom: 10 }}>
                  <h2 style={{ fontSize: 20, fontWeight: 900, color: '#dc2626', margin: 0 }}>
                    DESIGN AND EXECUTION CHECKLIST
                  </h2>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>SHEET NO: 10</span>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 20, fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#0f172a', color: '#fff', textAlign: 'left' }}>
                      <th style={{ padding: '10px 14px', border: '1px solid #334155' }}>ROOM / MODULE</th>
                      <th style={{ padding: '10px 14px', border: '1px solid #334155' }}>MATERIAL / BRAND</th>
                      <th style={{ padding: '10px 14px', border: '1px solid #334155' }}>MEASUREMENTS</th>
                      <th style={{ padding: '10px 14px', border: '1px solid #334155' }}>SCOPE</th>
                      <th style={{ padding: '10px 14px', border: '1px solid #334155' }}>INSTALLATION BY</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { room: 'UTILITY', item: 'Handles & Hardware', m: 'On Actuals', scope: 'CLIENT', inst: 'CUBE DECORS' },
                      { room: 'UTILITY', item: 'Sink & Tap', m: 'On Actuals', scope: 'CLIENT', inst: 'CUBE DECORS' },
                      { room: 'UTILITY', item: 'Counter Top (Granite)', m: 'On Actuals', scope: 'CLIENT', inst: 'CLIENT' },
                      { room: 'KITCHEN', item: 'G-Profile Handles (Black)', m: 'On Actuals', scope: 'CUBE DECORS', inst: 'CUBE DECORS' },
                      { room: 'KITCHEN', item: 'Tandem Box & Cutlery Tray', m: 'On Actuals', scope: 'CUBE DECORS', inst: 'CUBE DECORS' },
                      { room: 'KITCHEN', item: 'Chimney & Hob Provision', m: '600MM / On Actuals', scope: 'CLIENT', inst: 'CLIENT' },
                      { room: 'MASTER BEDROOM', item: 'Sliding Wardrobe Soft-Close', m: '3300 × 2785 MM', scope: 'CUBE DECORS', inst: 'CUBE DECORS' },
                      { room: 'KIDS BEDROOM', item: 'Integrated Study & Drawers', m: '2700 × 2700 MM', scope: 'CUBE DECORS', inst: 'CUBE DECORS' },
                      { room: 'POOJA UNIT', item: 'CNC Jaali Shutter & Gopuram', m: 'On Actuals', scope: 'CUBE DECORS', inst: 'CUBE DECORS' },
                      { room: 'ALL ROOMS', item: 'Surface Protection Sheets', m: '740 SQ.FT', scope: 'CUBE DECORS', inst: 'CUBE DECORS' },
                      { room: 'ALL ROOMS', item: 'Deep Cleaning & Debris Removal', m: 'On Completion', scope: 'CUBE DECORS', inst: 'CUBE DECORS' },
                    ].map((row, idx) => (
                      <tr key={idx} style={{ background: idx % 2 === 0 ? '#f8fafc' : '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '8px 14px', fontWeight: 700, border: '1px solid #e2e8f0' }}>{row.room}</td>
                        <td style={{ padding: '8px 14px', border: '1px solid #e2e8f0' }}>{row.item}</td>
                        <td style={{ padding: '8px 14px', border: '1px solid #e2e8f0', color: '#64748b' }}>{row.m}</td>
                        <td style={{ padding: '8px 14px', border: '1px solid #e2e8f0', fontWeight: 800, color: row.scope === 'CLIENT' ? '#b45309' : '#0284c7' }}>{row.scope}</td>
                        <td style={{ padding: '8px 14px', border: '1px solid #e2e8f0', fontWeight: 700, color: '#059669' }}>{row.inst}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Title Block */}
              <div style={{ border: '1.5px solid #0f172a', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', fontSize: 11, background: '#fff', marginTop: 20 }}>
                <div style={{ padding: '8px 12px', borderRight: '1px solid #0f172a' }}>
                  <strong style={{ display: 'block', fontSize: 12 }}>{projectData.name}</strong>
                  <span style={{ color: '#64748b' }}>Client: {projectData.clientName}</span>
                </div>
                <div style={{ padding: '8px 12px', borderRight: '1px solid #0f172a' }}>
                  <strong>DWG: DWG-CHK-01</strong>
                  <span style={{ display: 'block', color: '#64748b' }}>FACTORY RELEASE</span>
                </div>
                <div style={{ padding: '8px 12px', borderRight: '1px solid #0f172a' }}>
                  <strong>DATE: {projectData.date}</strong>
                  <span style={{ display: 'block', color: '#64748b' }}>REV: 02 (APPROVED)</span>
                </div>
                <div style={{ padding: '8px 12px' }}>
                  <strong>DRAWN BY: CUBE DECORS</strong>
                  <span style={{ display: 'block', color: '#64748b' }}>CHECKED: AR. MUSKAN</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Fixed Bottom Progression Bar */}
      <footer
        className="drawings-bottom-bar"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 56,
          background: '#0f172a',
          borderTop: '1px solid #334155',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 24px',
          zIndex: 80,
          boxShadow: '0 -4px 16px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            disabled={activeSheetIndex === 0}
            onClick={() => setActiveSheetIndex((prev) => Math.max(0, prev - 1))}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              background: '#1e293b',
              border: '1px solid #334155',
              color: activeSheetIndex === 0 ? '#475569' : '#e2e8f0',
              fontSize: 12,
              fontWeight: 700,
              cursor: activeSheetIndex === 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <ChevronLeft size={14} /> Previous Sheet
          </button>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>
            Sheet <strong style={{ color: '#fff' }}>{activeSheetIndex + 1}</strong> of {SHEETS.length}: {currentSheet.title}
          </span>
          <button
            type="button"
            disabled={activeSheetIndex === SHEETS.length - 1}
            onClick={() => setActiveSheetIndex((prev) => Math.min(SHEETS.length - 1, prev + 1))}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              background: '#1e293b',
              border: '1px solid #334155',
              color: activeSheetIndex === SHEETS.length - 1 ? '#475569' : '#e2e8f0',
              fontSize: 12,
              fontWeight: 700,
              cursor: activeSheetIndex === SHEETS.length - 1 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            Next Sheet <ChevronRight size={14} />
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={() => navigate(projectId ? `/projects/${projectId}/production` : '/projects')}
            style={{
              padding: '7px 14px',
              borderRadius: 7,
              background: 'transparent',
              border: '1px solid #475569',
              color: '#cbd5e1',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ← Back to Step 5: Production
          </button>
          <button
            type="button"
            onClick={() => navigate(projectId ? `/projects/${projectId}/estimate` : '/projects')}
            style={{
              padding: '8px 18px',
              borderRadius: 7,
              background: 'linear-gradient(135deg, #c59c2d, #a88220)',
              color: '#0f172a',
              border: 0,
              fontSize: 12.5,
              fontWeight: 900,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 2px 8px rgba(197, 156, 45, 0.4)',
            }}
          >
            Continue to Step 7: Costing &amp; BOQ <ArrowRight size={14} />
          </button>
        </div>
      </footer>
    </main>
  );
}

export default WorkingDrawingsDossier;
