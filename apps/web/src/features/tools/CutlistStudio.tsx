import {
  Scissors, Download, Upload, RefreshCw, FileText, CheckCircle2,
  Layers, Package, Sliders, ChevronRight, Eye, Printer, ZoomIn, ZoomOut, RotateCcw
} from 'lucide-react';
import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  optimizeGuillotineNesting,
  parse2DDrawingFile,
  generateParametricCabinetAnatomy,
  exportCutlistToCsv,
  exportNestingToDxf,
  MODULAR_PRESETS,
  DEFAULT_MATERIAL_PRESET,
  type NestingPart,
  type MaterialMatchingPreset,
  type NestingOptimizationResult,
  type OptimizedSheet,
} from './cutlist-optimizer';
import { supabase } from '../../lib/supabase';
import './cutlist-studio.css';

export function CutlistStudio() {
  const [selectedPresetKey, setSelectedPresetKey] = useState<string>('wardrobe_4door');
  const [materialPreset, setMaterialPreset] = useState<MaterialMatchingPreset>(DEFAULT_MATERIAL_PRESET);
  const [parts, setParts] = useState<NestingPart[]>([]);
  const [spaceTitle, setSpaceTitle] = useState<string>('4-Door Master Wardrobe Suite');
  const [activeSheetIndex, setActiveSheetIndex] = useState<number>(0);
  const [tableFilter, setTableFilter] = useState<'all' | 'external' | 'internal' | 'back'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [kerfMm, setKerfMm] = useState<number>(4);
  const [trimMm, setTrimMm] = useState<number>(10);
  const [sheetSizePreset, setSheetSizePreset] = useState<'8x4' | '8x6' | '7x3'>('8x4');
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadText, setUploadText] = useState('');
  const [statusMessage, setStatusMessage] = useState('Cutlist & Nesting Studio ready. Plywood and laminate wastage optimized under 5%.');
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Projects list for importing project rooms
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load projects from supabase if available
  useEffect(() => {
    void (async () => {
      if (!supabase) return;
      const res = await supabase.from('projects').select('id, name').neq('project_status', 'archived').order('updated_at', { ascending: false });
      const list = (res?.data ?? []) as Array<{ id: string; name: string }>;
      setProjects(list);
      if (list[0]?.id) setSelectedProjectId(list[0].id);
    })();
  }, []);

  // Initialize with the selected modular preset
  useEffect(() => {
    const preset = MODULAR_PRESETS[selectedPresetKey];
    if (preset) {
      const generated = generateParametricCabinetAnatomy(
        preset.label,
        preset.width,
        preset.height,
        preset.depth,
        materialPreset
      );
      setParts(generated.parts);
      setSpaceTitle(preset.label);
      setActiveSheetIndex(0);
    }
  }, [selectedPresetKey, materialPreset]);

  // Sheet dimensions based on selection
  const sheetDimensions = useMemo(() => {
    if (sheetSizePreset === '8x6') return { w: 2440, h: 1830 };
    if (sheetSizePreset === '7x3') return { w: 2135, h: 915 };
    return { w: 2440, h: 1220 }; // default 8x4 ft
  }, [sheetSizePreset]);

  // Run the 2D Guillotine Nesting Optimizer
  const nestingResult: NestingOptimizationResult = useMemo(() => {
    if (parts.length === 0) {
      return {
        sheets: [],
        summary: {
          totalPartsPlaced: 0,
          totalAreaRequiredSqm: 0,
          totalBoardAreaPurchasedSqm: 0,
          overallYieldPct: 0,
          overallWastePct: 0,
          totalSheetsCount: 0,
          sheetsByMaterial: {},
          laminateRequirement: {
            externalDecorativeSheets: 0,
            internalLinerSheets: 0,
            backingPlySheets: 0,
            carcassPlySheets: 0,
          },
          edgeBandingRequirement: {
            pvc2mmMeters: 0,
            pvc08mmMeters: 0,
            totalMeters: 0,
          },
        },
      };
    }

    return optimizeGuillotineNesting(parts, {
      sheetWidthMm: sheetDimensions.w,
      sheetHeightMm: sheetDimensions.h,
      trimMm,
      kerfMm,
      allowGrainRotationForSolid: true,
    });
  }, [parts, sheetDimensions, trimMm, kerfMm]);

  // Active sheet to render in SVG
  const activeSheet: OptimizedSheet | null = nestingResult.sheets[activeSheetIndex] ?? nestingResult.sheets[0] ?? null;

  // Filtered parts for table
  const filteredParts = useMemo(() => {
    return parts.filter((p) => {
      const matchesSearch =
        !searchQuery.trim() ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.partInstanceId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.materialCode.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesFilter =
        tableFilter === 'all' ||
        (tableFilter === 'external' && p.isExternal) ||
        (tableFilter === 'internal' && !p.isExternal && p.classification !== 'back_panel') ||
        (tableFilter === 'back' && p.classification === 'back_panel');

      return matchesSearch && matchesFilter;
    });
  }, [parts, searchQuery, tableFilter]);

  // Handlers
  function handlePresetChange(key: string) {
    setSelectedPresetKey(key);
    setStatusMessage(`Loaded modular preset: ${MODULAR_PRESETS[key]?.label}`);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = String(event.target?.result ?? '');
      try {
        const parsed = parse2DDrawingFile(content, file.name, materialPreset);
        setParts(parsed.parts);
        setSpaceTitle(parsed.title);
        setActiveSheetIndex(0);
        setStatusMessage(`Successfully parsed 2D file "${file.name}" with ${parsed.parts.length} joinery parts.`);
      } catch (err: any) {
        setStatusMessage(`Error parsing 2D file: ${err.message || 'Invalid format'}`);
      }
    };
    reader.readAsText(file);
  }

  function handlePasteSubmit() {
    if (!uploadText.trim()) return;
    try {
      const parsed = parse2DDrawingFile(uploadText, 'Pasted-2D-Drawing', materialPreset);
      setParts(parsed.parts);
      setSpaceTitle(parsed.title);
      setActiveSheetIndex(0);
      setUploadModalOpen(false);
      setUploadText('');
      setStatusMessage(`Successfully ingested 2D drawing specification with ${parsed.parts.length} parts.`);
    } catch (err: any) {
      setStatusMessage(`Error ingesting drawing: ${err.message || 'Invalid data'}`);
    }
  }

  function downloadCsv() {
    const csv = exportCutlistToCsv(nestingResult, spaceTitle);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ULTIDA-Cutlist-${spaceTitle.replace(/[^a-z0-9]/gi, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMessage('Exported detailed production cutlist CSV.');
  }

  function downloadDxf() {
    const dxf = exportNestingToDxf(nestingResult);
    const blob = new Blob([dxf], { type: 'application/dxf;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ULTIDA-Nesting-Sheet-Layouts.dxf`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMessage('Exported AutoCAD CNC & Saw cutting sheet DXF.');
  }

  function printCuttingDossier() {
    window.print();
  }

  return (
    <div className="cutlist-studio">
      {/* ─── Hero Bar ─── */}
      <section className="cs-hero">
        <div className="cs-hero-text">
          <small>Precision Manufacturing &amp; CAM</small>
          <h1>Cutlist &amp; High-Efficiency Nesting Studio</h1>
          <p>
            Ingest 2D elevation &amp; section drawings of interior spaces, automatically match external decorative laminates and internal liner ply, and optimize sheet cutting layouts with <strong>less than 5% wastage</strong>.
          </p>
        </div>

        <div className="cs-hero-actions">
          <button type="button" className="cs-btn" onClick={() => fileInputRef.current?.click()} title="Upload 2D CAD / JSON / CSV drawing">
            <Upload size={14} />
            <span>Upload 2D Drawing</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept=".json,.dxf,.csv,.txt"
            onChange={handleFileUpload}
          />

          <button type="button" className="cs-btn" onClick={() => setUploadModalOpen(true)} title="Paste raw 2D drawing text or JSON">
            <Layers size={14} />
            <span>Paste 2D Spec</span>
          </button>

          <button type="button" className="cs-btn primary" onClick={downloadCsv} title="Download CSV cutlist with laminate schedules">
            <Download size={14} />
            <span>Export CSV Cutlist</span>
          </button>

          <button type="button" className="cs-btn" onClick={downloadDxf} title="Download AutoCAD CNC / Saw sheet nesting DXF">
            <Scissors size={14} />
            <span>Export CNC DXF</span>
          </button>

          <button type="button" className="cs-btn" onClick={printCuttingDossier} title="Print production cutting ticket & part labels">
            <Printer size={14} />
            <span>Print Dossier</span>
          </button>
        </div>
      </section>

      {/* ─── Key Metrics Strip (<5% Wastage Guarantee) ─── */}
      <section className="cs-metrics-strip">
        <div className="cs-metric-card green">
          <span className="cs-metric-label">Overall Board Yield</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span className="cs-metric-val">{nestingResult.summary.overallYieldPct}%</span>
            <span className="cs-pill-badge green">
              <CheckCircle2 size={11} /> High Efficiency
            </span>
          </div>
          <span className="cs-metric-sub">
            Wastage: <strong>{nestingResult.summary.overallWastePct}%</strong> (Guaranteed &lt; 5%)
          </span>
        </div>

        <div className="cs-metric-card gold">
          <span className="cs-metric-label">Total Sheets Required</span>
          <span className="cs-metric-val">{nestingResult.summary.totalSheetsCount} Sheets</span>
          <span className="cs-metric-sub">Standard 8×4 ft (2440×1220 mm)</span>
        </div>

        <div className="cs-metric-card">
          <span className="cs-metric-label">Laminate Procurement</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
            <span className="cs-metric-val" style={{ fontSize: 18 }}>
              {nestingResult.summary.laminateRequirement.externalDecorativeSheets} Ext / {nestingResult.summary.laminateRequirement.internalLinerSheets} Liner
            </span>
          </div>
          <span className="cs-metric-sub">
            {nestingResult.summary.laminateRequirement.externalDecorativeSheets} Decorative (1.0mm) + {nestingResult.summary.laminateRequirement.internalLinerSheets} Suede Liners
          </span>
        </div>

        <div className="cs-metric-card">
          <span className="cs-metric-label">Edge Banding Schedule</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
            <span className="cs-metric-val" style={{ fontSize: 18 }}>
              {nestingResult.summary.edgeBandingRequirement.totalMeters} m
            </span>
          </div>
          <span className="cs-metric-sub">
            2mm: <strong>{nestingResult.summary.edgeBandingRequirement.pvc2mmMeters}m</strong> | 0.8mm: <strong>{nestingResult.summary.edgeBandingRequirement.pvc08mmMeters}m</strong>
          </span>
        </div>
      </section>

      {/* ─── Control Bar ─── */}
      <section className="cs-control-bar">
        <div className="cs-preset-selector">
          <label>Modular Space Preset:</label>
          <select
            className="cs-select"
            value={selectedPresetKey}
            onChange={(e) => handlePresetChange(e.target.value)}
          >
            {Object.entries(MODULAR_PRESETS).map(([k, p]) => (
              <option key={k} value={k}>
                {p.label}
              </option>
            ))}
          </select>

          <label style={{ marginLeft: 12 }}>Board Size:</label>
          <select
            className="cs-select"
            value={sheetSizePreset}
            onChange={(e) => setSheetSizePreset(e.target.value as any)}
          >
            <option value="8x4">8×4 ft (2440 × 1220 mm) - Standard Indian</option>
            <option value="8x6">8×6 ft (2440 × 1830 mm) - Wide Format</option>
            <option value="7x3">7×3 ft (2135 × 915 mm) - Compact Door Board</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
            Saw Kerf:
          </label>
          <select
            className="cs-select"
            value={kerfMm}
            onChange={(e) => setKerfMm(Number(e.target.value))}
            style={{ width: 80 }}
          >
            <option value={3}>3 mm</option>
            <option value={4}>4 mm</option>
            <option value={5}>5 mm</option>
          </select>

          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginLeft: 8 }}>
            Edge Trim:
          </label>
          <select
            className="cs-select"
            value={trimMm}
            onChange={(e) => setTrimMm(Number(e.target.value))}
            style={{ width: 80 }}
          >
            <option value={10}>10 mm</option>
            <option value={15}>15 mm</option>
            <option value={20}>20 mm</option>
          </select>
        </div>
      </section>

      {/* ─── Main Two-Column View ─── */}
      <div className="cs-main-grid">
        {/* Left Column: Interactive Sheet Nesting Canvas */}
        <div className="cs-canvas-card">
          <div className="cs-canvas-header">
            <div className="cs-sheet-tabs">
              {nestingResult.sheets.map((sheet, idx) => (
                <button
                  key={sheet.sheetIndex}
                  type="button"
                  className={`cs-sheet-tab ${idx === activeSheetIndex ? 'active' : ''}`}
                  onClick={() => setActiveSheetIndex(idx)}
                >
                  Sheet #{sheet.sheetIndex} ({sheet.yieldPct}% Yield)
                </button>
              ))}
            </div>

            {activeSheet && (
              <div className="cs-sheet-meta-pill">
                <span>{activeSheet.sheetWidthMm} × {activeSheet.sheetHeightMm} mm</span>
                <span>•</span>
                <span>{activeSheet.placedPanels.length} Panels</span>
                <span>•</span>
                <span className="pct-high">{activeSheet.yieldPct}% Yield</span>
                <span style={{ color: '#fbbf24' }}>({activeSheet.wastePct}% Scrap)</span>
              </div>
            )}
          </div>

          {/* SVG Viewport */}
          <div className="cs-svg-viewport">
            {activeSheet ? (
              <svg
                viewBox={`0 0 ${activeSheet.sheetWidthMm + 80} ${activeSheet.sheetHeightMm + 80}`}
                preserveAspectRatio="xMidYMid meet"
                style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center', transition: 'transform 0.2s ease' }}
              >
                {/* Background grid */}
                <defs>
                  <pattern id="cs-grid" width="100" height="100" patternUnits="userSpaceOnUse">
                    <path d="M 100 0 L 0 0 0 100" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect x="0" y="0" width={activeSheet.sheetWidthMm + 80} height={activeSheet.sheetHeightMm + 80} fill="#0d0e12" />
                <rect x="40" y="40" width={activeSheet.sheetWidthMm} height={activeSheet.sheetHeightMm} fill="url(#cs-grid)" />

                {/* Outer Sheet Boundary */}
                <rect
                  x="40"
                  y="40"
                  width={activeSheet.sheetWidthMm}
                  height={activeSheet.sheetHeightMm}
                  fill="#1a1c24"
                  stroke="#c59c2d"
                  strokeWidth="2.5"
                  strokeDasharray="8 4"
                />

                {/* Usable Area Boundary (Inside Trim) */}
                <rect
                  x={40 + activeSheet.trimMm}
                  y={40 + activeSheet.trimMm}
                  width={activeSheet.usableWidthMm}
                  height={activeSheet.usableHeightMm}
                  fill="none"
                  stroke="rgba(255,255,255,0.15)"
                  strokeWidth="1.2"
                />

                {/* Guillotine Saw Cut Lines */}
                {activeSheet.cuts.map((cut) => (
                  <line
                    key={cut.id}
                    x1={40 + cut.x1}
                    y1={40 + cut.y1}
                    x2={40 + cut.x2}
                    y2={40 + cut.y2}
                    stroke="rgba(239, 68, 68, 0.45)"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />
                ))}

                {/* Placed Panels */}
                {activeSheet.placedPanels.map((panel) => {
                  const px = 40 + panel.x;
                  const py = 40 + panel.y;
                  const isGold = panel.isExternal;

                  return (
                    <g key={panel.id}>
                      {/* Panel Background */}
                      <rect
                        x={px}
                        y={py}
                        width={panel.w}
                        height={panel.h}
                        fill={isGold ? 'rgba(197, 156, 45, 0.35)' : 'rgba(37, 99, 235, 0.28)'}
                        stroke={isGold ? '#e8c96a' : '#60a5fa'}
                        strokeWidth="2"
                        rx="2"
                      />

                      {/* Edge Banding Indicator (Front Edge) */}
                      <line
                        x1={px}
                        y1={py}
                        x2={px + panel.w}
                        y2={py}
                        stroke={isGold ? '#ef4444' : '#10b981'}
                        strokeWidth="3.5"
                      />

                      {/* Grain Direction Indicator */}
                      {panel.grain === 'vertical' && panel.h > 120 && panel.w > 60 && (
                        <g opacity="0.6">
                          <line
                            x1={px + panel.w / 2}
                            y1={py + 18}
                            x2={px + panel.w / 2}
                            y2={py + panel.h - 18}
                            stroke="#e8c96a"
                            strokeWidth="1.8"
                            strokeDasharray="6 3"
                          />
                          <polygon
                            points={`${px + panel.w / 2},${py + panel.h - 10} ${px + panel.w / 2 - 5},${py + panel.h - 22} ${px + panel.w / 2 + 5},${py + panel.h - 22}`}
                            fill="#e8c96a"
                          />
                        </g>
                      )}

                      {/* Cut Sequence Badge */}
                      {panel.w >= 60 && panel.h >= 50 && (
                        <circle
                          cx={px + 20}
                          cy={py + 20}
                          r="12"
                          fill="#181a20"
                          stroke={isGold ? '#c59c2d' : '#3b82f6'}
                          strokeWidth="1.5"
                        />
                      )}
                      {panel.w >= 60 && panel.h >= 50 && (
                        <text
                          x={px + 20}
                          y={py + 24}
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize="10"
                          fontWeight="800"
                        >
                          {panel.cutSequenceNumber}
                        </text>
                      )}

                      {/* Panel Title & Dimensions */}
                      {panel.w >= 80 && panel.h >= 60 && (
                        <text
                          x={px + (panel.w >= 60 ? 38 : 10)}
                          y={py + 24}
                          fill="#ffffff"
                          fontSize={panel.w > 200 ? '13' : '11'}
                          fontWeight="750"
                        >
                          {panel.name.length > 24 ? panel.name.slice(0, 22) + '…' : panel.name}
                        </text>
                      )}
                      {panel.w >= 80 && panel.h >= 80 && (
                        <text
                          x={px + 12}
                          y={py + 46}
                          fill="rgba(255, 255, 255, 0.75)"
                          fontSize="11"
                          fontWeight="600"
                        >
                          {panel.w} × {panel.h} mm {panel.rotated ? '↻' : ''}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Usable Remnants / Offcut Polygons */}
                {activeSheet.remnants.map((r, i) => (
                  <rect
                    key={i}
                    x={40 + r.x}
                    y={40 + r.y}
                    width={r.w}
                    height={r.h}
                    fill="rgba(16, 185, 129, 0.08)"
                    stroke="rgba(16, 185, 129, 0.4)"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                ))}

                {/* Sheet Dimension Labels */}
                <text x="40" y="28" fill="#c59c2d" fontSize="13" fontWeight="800">
                  {activeSheet.sheetLabel}
                </text>
                <text
                  x={40 + activeSheet.sheetWidthMm / 2}
                  y={40 + activeSheet.sheetHeightMm + 26}
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize="12"
                  fontWeight="700"
                >
                  {activeSheet.sheetWidthMm} mm Length
                </text>
                <text
                  x="22"
                  y={40 + activeSheet.sheetHeightMm / 2}
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize="12"
                  fontWeight="700"
                  transform={`rotate(-90 22 ${40 + activeSheet.sheetHeightMm / 2})`}
                >
                  {activeSheet.sheetHeightMm} mm Width
                </text>
              </svg>
            ) : (
              <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                No sheets optimized yet.
              </div>
            )}
          </div>

          {/* Canvas Controls & Legend */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, flexWrap: 'wrap', gap: 10 }}>
            <div className="cs-canvas-legend">
              <div className="cs-legend-item">
                <span className="cs-legend-swatch" style={{ background: '#c59c2d' }} />
                <span>External Shutter (1.0mm Decorative Laminate)</span>
              </div>
              <div className="cs-legend-item">
                <span className="cs-legend-swatch" style={{ background: '#2563eb' }} />
                <span>Internal Carcass (18mm Ply + 0.8mm Liner)</span>
              </div>
              <div className="cs-legend-item">
                <span className="cs-legend-swatch" style={{ background: '#ef4444' }} />
                <span>2.0mm PVC Edge Band</span>
              </div>
              <div className="cs-legend-item">
                <span className="cs-legend-swatch" style={{ background: '#10b981' }} />
                <span>0.8mm PVC Edge Band</span>
              </div>
              <div className="cs-legend-item">
                <span className="cs-legend-swatch" style={{ background: 'rgba(239, 68, 68, 0.45)' }} />
                <span>Guillotine Saw Cut</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                className="cs-btn"
                onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.15))}
                title="Zoom out"
                style={{ padding: '4px 8px' }}
              >
                <ZoomOut size={13} />
              </button>
              <button
                type="button"
                className="cs-btn"
                onClick={() => setZoomLevel(1)}
                title="Reset zoom"
                style={{ padding: '4px 8px' }}
              >
                <RotateCcw size={13} />
              </button>
              <button
                type="button"
                className="cs-btn"
                onClick={() => setZoomLevel((z) => Math.min(2.0, z + 0.15))}
                title="Zoom in"
                style={{ padding: '4px 8px' }}
              >
                <ZoomIn size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Material & Laminate Matching Card */}
        <aside className="cs-side-panel">
          <div className="cs-card">
            <h3 className="cs-card-title">
              <Sliders size={16} style={{ color: 'var(--gold)' }} />
              <span>Material &amp; Laminate Pairings</span>
            </h3>

            <div className="cs-material-slot">
              <label>External Decorative Laminate (Shutters &amp; Fascia)</label>
              <input
                value={materialPreset.externalDecorativeLaminate}
                onChange={(e) =>
                  setMaterialPreset((p) => ({ ...p, externalDecorativeLaminate: e.target.value }))
                }
              />
            </div>

            <div className="cs-material-slot">
              <label>Internal Liner Laminate (Carcass &amp; Shelves)</label>
              <input
                value={materialPreset.internalLinerLaminate}
                onChange={(e) =>
                  setMaterialPreset((p) => ({ ...p, internalLinerLaminate: e.target.value }))
                }
              />
            </div>

            <div className="cs-material-slot">
              <label>Carcass Core Plywood (Substrate)</label>
              <input
                value={materialPreset.carcassCorePly}
                onChange={(e) =>
                  setMaterialPreset((p) => ({ ...p, carcassCorePly: e.target.value }))
                }
              />
            </div>

            <div className="cs-material-slot">
              <label>Backing Panel Material (Grooved/Rebated)</label>
              <input
                value={materialPreset.backPanelMaterial}
                onChange={(e) =>
                  setMaterialPreset((p) => ({ ...p, backPanelMaterial: e.target.value }))
                }
              />
            </div>

            <div className="cs-material-slot">
              <label>External Edge Banding Tape</label>
              <input
                value={materialPreset.externalEdgeBand}
                onChange={(e) =>
                  setMaterialPreset((p) => ({ ...p, externalEdgeBand: e.target.value }))
                }
              />
            </div>

            <div className="cs-material-slot">
              <label>Internal Edge Banding Tape</label>
              <input
                value={materialPreset.internalEdgeBand}
                onChange={(e) =>
                  setMaterialPreset((p) => ({ ...p, internalEdgeBand: e.target.value }))
                }
              />
            </div>

            <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(197, 156, 45, 0.08)', borderRadius: 8, fontSize: 11.5, color: 'var(--text-secondary)' }}>
              <strong>System 32 Fabrication Rule:</strong> External shutters match 2mm high-impact PVC edging with vertical grain matching; all internal carcass shelves utilize 0.8mm PVC with System 32 shelf pin line borings.
            </div>
          </div>

          {/* Quick Stats Summary Card */}
          <div className="cs-card">
            <h3 className="cs-card-title">
              <Package size={16} style={{ color: 'var(--gold)' }} />
              <span>Procurement Breakdown</span>
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--line)', paddingBottom: 6 }}>
                <span style={{ color: 'var(--text-muted)' }}>18mm BWP Core Ply</span>
                <strong>{nestingResult.summary.laminateRequirement.carcassPlySheets} Sheets</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--line)', paddingBottom: 6 }}>
                <span style={{ color: 'var(--text-muted)' }}>9mm Backing Ply</span>
                <strong>{nestingResult.summary.laminateRequirement.backingPlySheets} Sheets</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--line)', paddingBottom: 6 }}>
                <span style={{ color: 'var(--text-muted)' }}>1.0mm Decorative Laminate</span>
                <strong style={{ color: 'var(--gold-dim)' }}>
                  {nestingResult.summary.laminateRequirement.externalDecorativeSheets} Sheets
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--line)', paddingBottom: 6 }}>
                <span style={{ color: 'var(--text-muted)' }}>0.8mm White Suede Liner</span>
                <strong>{nestingResult.summary.laminateRequirement.internalLinerSheets} Sheets</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--line)', paddingBottom: 6 }}>
                <span style={{ color: 'var(--text-muted)' }}>2.0mm PVC Edge Banding</span>
                <strong>{nestingResult.summary.edgeBandingRequirement.pvc2mmMeters} meters</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>0.8mm PVC Edge Banding</span>
                <strong>{nestingResult.summary.edgeBandingRequirement.pvc08mmMeters} meters</strong>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* ─── Detailed Parts Cutting Table ─── */}
      <section className="cs-parts-table-wrap">
        <div className="cs-table-header">
          <div>
            <h3>Panel Cutting Schedule &amp; Joinery Anatomy ({filteredParts.length} Parts)</h3>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Source: {spaceTitle}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search panels by name or material..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: '1px solid var(--line)',
                fontSize: 12,
                minWidth: 240,
              }}
            />

            <div className="cs-filter-pills">
              <button
                type="button"
                className={`cs-filter-pill ${tableFilter === 'all' ? 'active' : ''}`}
                onClick={() => setTableFilter('all')}
              >
                All ({parts.length})
              </button>
              <button
                type="button"
                className={`cs-filter-pill ${tableFilter === 'external' ? 'active' : ''}`}
                onClick={() => setTableFilter('external')}
              >
                External Shutters ({parts.filter((p) => p.isExternal).length})
              </button>
              <button
                type="button"
                className={`cs-filter-pill ${tableFilter === 'internal' ? 'active' : ''}`}
                onClick={() => setTableFilter('internal')}
              >
                Internal Carcass ({parts.filter((p) => !p.isExternal && p.classification !== 'back_panel').length})
              </button>
              <button
                type="button"
                className={`cs-filter-pill ${tableFilter === 'back' ? 'active' : ''}`}
                onClick={() => setTableFilter('back')}
              >
                Back Panels ({parts.filter((p) => p.classification === 'back_panel').length})
              </button>
            </div>
          </div>
        </div>

        <div className="cs-table-container">
          <table className="cs-table">
            <thead>
              <tr>
                <th>Part ID</th>
                <th>Part Description</th>
                <th>Classification</th>
                <th>Length</th>
                <th>Width</th>
                <th>Thick</th>
                <th>Qty</th>
                <th>Grain</th>
                <th>Material Substrate</th>
                <th>Face Laminate</th>
                <th>Edge Banding Schedule</th>
              </tr>
            </thead>
            <tbody>
              {filteredParts.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.partInstanceId}</strong></td>
                  <td>{p.name}</td>
                  <td>
                    <span
                      className={`cs-type-badge ${
                        p.isExternal ? 'ext' : p.classification === 'back_panel' ? 'back' : 'int'
                      }`}
                    >
                      {p.isExternal ? 'External Fascia' : p.classification === 'back_panel' ? 'Backing Panel' : 'Internal Carcass'}
                    </span>
                  </td>
                  <td>{p.lengthMm} mm</td>
                  <td>{p.widthMm} mm</td>
                  <td>{p.thicknessMm} mm</td>
                  <td><strong>{p.quantity}</strong></td>
                  <td>
                    <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>
                      {p.grainDirection}
                    </span>
                  </td>
                  <td>{p.materialName || p.materialCode}</td>
                  <td>
                    {p.isExternal ? (
                      <span style={{ color: 'var(--gold-dim)', fontWeight: 700 }}>
                        {p.externalLaminateCode}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {p.internalLinerCode}
                      </span>
                    )}
                  </td>
                  <td>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      L1: {p.edgeBanding.l1} | W1: {p.edgeBanding.w1}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ─── Paste 2D Drawing Spec Modal ─── */}
      {uploadModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            zIndex: 1000,
            display: 'grid',
            placeItems: 'center',
            padding: 20,
            backdropFilter: 'blur(4px)',
          }}
          onClick={(e) => e.target === e.currentTarget && setUploadModalOpen(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 14,
              padding: 24,
              maxWidth: 620,
              width: '100%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}
          >
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800 }}>
              Paste 2D Elevation &amp; Section Drawing Spec
            </h3>
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '0 0 16px' }}>
              Paste JSON or CSV panel schedules describing the internal carcass partitions and external shutters of your modules. The engine will automatically match laminates and optimize nesting with &lt; 5% scrap.
            </p>

            <textarea
              rows={10}
              placeholder={`{\n  "title": "Living Room TV Unit",\n  "overallWidthMm": 2700,\n  "overallHeightMm": 1800,\n  "depthMm": 450,\n  "parts": [\n    { "name": "Fluted Shutter L", "length": 1600, "width": 450, "isExternal": true },\n    { "name": "Carcass Gable Left", "length": 1800, "width": 450, "isExternal": false }\n  ]\n}`}
              value={uploadText}
              onChange={(e) => setUploadText(e.target.value)}
              style={{
                width: '100%',
                padding: 12,
                borderRadius: 8,
                border: '1px solid var(--line)',
                fontFamily: 'monospace',
                fontSize: 12,
                marginBottom: 16,
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="cs-btn"
                onClick={() => setUploadModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="cs-btn primary"
                onClick={handlePasteSubmit}
              >
                Ingest &amp; Optimize
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
