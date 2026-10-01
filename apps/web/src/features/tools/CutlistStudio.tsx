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
import {
  calculateSlidingDoorDeductions,
  SLIDING_HARDWARE_PRESETS,
  type SlidingDoorInput,
  type SlidingDoorResult,
} from './sliding-door-calculator';
import { QrCode, Tag, Sparkles, AlertTriangle } from 'lucide-react';
import './cutlist-studio.css';
import { buildMeasuredUnitParts, readDxfRectangles, type MeasuredUnit } from './measured-unit-cutlist';
import { buildCutlistDraftWorkbook } from './cutlist-draft-workbook';
import { readCutlistDraft } from './cutlist-draft';

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
  const [statusMessage, setStatusMessage] = useState('Cutlist & Nesting Studio ready. Review the fit and material warnings before exporting.');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [units, setUnits] = useState<MeasuredUnit[]>([]);
  const [unitName, setUnitName] = useState('Unit 1');
  const [unitWidth, setUnitWidth] = useState('');
  const [unitHeight, setUnitHeight] = useState('');
  const [unitDepth, setUnitDepth] = useState('');
  const [unitStyle, setUnitStyle] = useState<'open' | 'swing'>('swing');
  const [unitShelves, setUnitShelves] = useState('2');
  const [unitBack, setUnitBack] = useState<6 | 18>(6);
  const [referenceUrl, setReferenceUrl] = useState<string | null>(null);
  const [cadOutlines, setCadOutlines] = useState<ReturnType<typeof readDxfRectangles>>([]);
  const [draftLoading, setDraftLoading] = useState(true);
  const [draftKey, setDraftKey] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void (async () => {
      const session = supabase ? (await supabase.auth.getSession()).data.session : null;
      const key = `ultida.cutlist-draft.v1.${session?.user.id ?? 'offline'}`;
      try {
        const saved = localStorage.getItem(key);
        if (!live) return;
        if (saved) { const draft = readCutlistDraft(saved); setParts(draft.parts); setUnits(draft.units); setSpaceTitle(draft.title); if (draft.settings) { setKerfMm(draft.settings.kerfMm); setTrimMm(draft.settings.trimMm); setSheetSizePreset(draft.settings.sheetSizePreset); } setStatusMessage('Your local cutlist draft was restored. It is not an approved production release.'); }
        setDraftKey(key);
      } catch { if (live) setStatusMessage('Saved draft could not be restored. It has been preserved in this browser; export or inspect it before replacing it.'); }
    })().catch(() => { if (live) setStatusMessage('Could not initialize draft recovery. Keep this screen open until you export your work.'); }).finally(() => { if (live) setDraftLoading(false); });
    return () => { live = false; };
  }, []);
  useEffect(() => {
    if (!draftKey) return;
    try { localStorage.setItem(draftKey, JSON.stringify({ version: 1, parts, units, title: spaceTitle, settings: { kerfMm, trimMm, sheetSizePreset } })); }
    catch { setStatusMessage('The browser could not save this draft. Export your workbook before leaving.'); }
  }, [draftKey, parts, units, spaceTitle, kerfMm, trimMm, sheetSizePreset]);
  useEffect(() => () => { if (referenceUrl) URL.revokeObjectURL(referenceUrl); }, [referenceUrl]);
  const previewUnit: MeasuredUnit = { id: 'preview', name: unitName, widthMm: Number(unitWidth), heightMm: Number(unitHeight), depthMm: Number(unitDepth), shelves: Number(unitShelves), doors: unitStyle === 'swing' ? 2 : 0, backThicknessMm: unitBack };
  const previewValidation = useMemo(() => { try { return { parts: buildMeasuredUnitParts(previewUnit, materialPreset), error: null }; } catch (error) { return { parts: [], error: error instanceof Error ? error.message : 'Confirm unit dimensions.' }; } }, [unitWidth, unitHeight, unitDepth, unitShelves, unitStyle, unitBack, materialPreset]);
  function addMeasuredUnit() {
    if (draftLoading) { setStatusMessage('Restoring your draft. Please wait before adding panels.'); return; }
    if (!unitName.trim() || !unitShelves.trim() || previewValidation.error) { setStatusMessage(previewValidation.error ?? 'Enter a unit name and shelf count.'); return; }
    const unit = { ...previewUnit, id: crypto.randomUUID(), name: unitName.trim() };
    setParts(current => [...current, ...buildMeasuredUnitParts(unit, materialPreset)]);
    setUnits(current => [...current, unit]);
    setSpaceTitle('Measured multi-unit cutlist');
    setUnitName(`Unit ${units.length + 2}`);
    setStatusMessage(`${unit.name} added without replacing earlier units. Review the draft construction and laminate allowances before manufacture.`);
  }

  // Sliding Door Deduction State
  const [slidingModalOpen, setSlidingModalOpen] = useState(false);
  const [slidingOpeningW, setSlidingOpeningW] = useState('');
  const [slidingOpeningH, setSlidingOpeningH] = useState('');
  const [slidingDoorCount, setSlidingDoorCount] = useState(2);
  const [slidingPresetId, setSlidingPresetId] = useState('hafele-aluflex-45');
  const [slidingMaterial, setSlidingMaterial] = useState<SlidingDoorInput['materialType']>('hdhmr_18');
  const [slidingLaminate, setSlidingLaminate] = useState('');
  const [slidingCustomOverlap, setSlidingCustomOverlap] = useState(30);
  const [slidingCustomDh, setSlidingCustomDh] = useState(50);
  const [slidingIsProfile, setSlidingIsProfile] = useState(true);
  const [slidingSideAllowance, setSlidingSideAllowance] = useState(35);
  const [slidingTopAllowance, setSlidingTopAllowance] = useState(50);
  const [slidingBottomAllowance, setSlidingBottomAllowance] = useState(50);

  // Sticker Print Modal State
  const [stickerModalOpen, setStickerModalOpen] = useState(false);
  const [stickerLayoutMode, setStickerLayoutMode] = useState<'a4_grid' | 'thermal'>('a4_grid');

  // Compute live sliding deductions
  const activeSlidingCalculation = useMemo((): { result: SlidingDoorResult | null; error: string | null } => {
    try {
      return { result: calculateSlidingDoorDeductions({
      openingWidthMm: Number(slidingOpeningW),
      openingHeightMm: Number(slidingOpeningH),
      doorCount: slidingDoorCount,
      hardwarePresetId: slidingPresetId,
      customOverlapMm: slidingCustomOverlap,
      customHeightDeductionMm: slidingCustomDh,
      isProfileFrame: slidingIsProfile,
      sideProfileAllowanceMm: slidingSideAllowance,
      topProfileAllowanceMm: slidingTopAllowance,
      bottomProfileAllowanceMm: slidingBottomAllowance,
      materialType: slidingMaterial,
      decorativeLaminateCode: slidingLaminate,
      wardrobeModuleName: spaceTitle || 'Custom Sliding Wardrobe',
      roomName: 'Selected room',
    }), error: null };
    } catch (error) {
      return { result: null, error: error instanceof Error ? error.message : 'Review the dimensions and hardware setup.' };
    }
  }, [
    slidingOpeningW, slidingOpeningH, slidingDoorCount, slidingPresetId,
    slidingCustomOverlap, slidingCustomDh, slidingIsProfile,
    slidingSideAllowance, slidingTopAllowance, slidingBottomAllowance,
    slidingMaterial, slidingLaminate, spaceTitle
  ]);
  const activeSlidingResult = activeSlidingCalculation.result;
  const [verifiedSlidingSignature, setVerifiedSlidingSignature] = useState('');
  const slidingSpecSignature = JSON.stringify([slidingOpeningW, slidingOpeningH, slidingDoorCount, slidingPresetId, slidingMaterial, slidingLaminate, slidingCustomOverlap, slidingCustomDh, slidingIsProfile, slidingSideAllowance, slidingTopAllowance, slidingBottomAllowance]);
  const slidingSpecConfirmed = verifiedSlidingSignature === slidingSpecSignature;

  function appendSlidingPanels() {
    if (draftLoading) { setStatusMessage('Restoring your draft. Please wait before adding panels.'); return; }
    if (!activeSlidingResult || !slidingSpecConfirmed) return;
    const calculationId = globalThis.crypto?.randomUUID?.() ?? `batch-${Date.now()}`;
    const batch = calculateSlidingDoorDeductions({
      openingWidthMm: Number(slidingOpeningW), openingHeightMm: Number(slidingOpeningH), doorCount: slidingDoorCount,
      hardwarePresetId: slidingPresetId, customOverlapMm: slidingCustomOverlap, customHeightDeductionMm: slidingCustomDh,
      isProfileFrame: slidingIsProfile, sideProfileAllowanceMm: slidingSideAllowance, topProfileAllowanceMm: slidingTopAllowance,
      bottomProfileAllowanceMm: slidingBottomAllowance, materialType: slidingMaterial,
      ...(slidingLaminate ? { decorativeLaminateCode: slidingLaminate } : {}), wardrobeModuleName: spaceTitle, roomName: 'Selected room', calculationId,
    });
    setParts((current) => [...current, ...batch.cutlistParts]);
    setActiveSheetIndex(0);
    setSlidingModalOpen(false);
    setVerifiedSlidingSignature('');
    setStatusMessage(`Added ${batch.cutlistParts.length} sliding-door infill panels as a draft. Verify the supplier deductions and complete hardware schedule before release.`);
  }

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

  // No automatic sample panels. Material changes apply to the next unit only.

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
          blockingIssues: [],
          totalAreaRequiredSqm: 0,
          totalBoardAreaPurchasedSqm: 0,
          overallYieldPct: 0,
          overallWastePct: 0,
          totalSheetsCount: 0,
          unplacedParts: [],
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
            otherMeters: 0,
            totalMeters: 0,
          },
        },
      };
    }

    try {
      return optimizeGuillotineNesting(parts, {
        sheetWidthMm: sheetDimensions.w,
        sheetHeightMm: sheetDimensions.h,
        trimMm,
        kerfMm,
        allowGrainRotationForSolid: true,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The selected nesting settings are invalid.';
      return {
        sheets: [],
        summary: {
          totalPartsPlaced: 0, blockingIssues: [message], unplacedParts: [], totalAreaRequiredSqm: 0, totalBoardAreaPurchasedSqm: 0,
          overallYieldPct: 0, overallWastePct: 0, totalSheetsCount: 0, sheetsByMaterial: {},
          laminateRequirement: { externalDecorativeSheets: 0, internalLinerSheets: 0, backingPlySheets: 0, carcassPlySheets: 0 },
          edgeBandingRequirement: { pvc2mmMeters: 0, pvc08mmMeters: 0, otherMeters: 0, totalMeters: 0 },
        },
      };
    }
  }, [parts, sheetDimensions, trimMm, kerfMm]);

  // Active sheet to render in SVG
  const activeSheet: OptimizedSheet | null = nestingResult.sheets[activeSheetIndex] ?? nestingResult.sheets[0] ?? null;
  const expectedPanelCount = parts.reduce((total, part) => total + part.quantity, 0);
  const nestingComplete = parts.length > 0 && nestingResult.summary.blockingIssues.length === 0 && nestingResult.summary.unplacedParts.length === 0 && nestingResult.summary.totalPartsPlaced === expectedPanelCount;

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
    const preset = MODULAR_PRESETS[key];
    if (preset) { setUnitName(preset.label); setUnitWidth(String(preset.width)); setUnitHeight(String(preset.height)); setUnitDepth(String(preset.depth)); }
    setStatusMessage('Suggested dimensions loaded into the unit form. Review construction and add explicitly; existing units are unchanged.');
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (draftLoading) { setStatusMessage('Restoring your draft. Please wait before adding panels.'); return; }
    const file = e.target.files?.[0];
    if (!file) return;
    if (/\.dwg$/i.test(file.name)) { setStatusMessage('DWG is a binary AutoCAD format. Export a millimetre DXF with closed unit outlines, then upload it for review. No panels were inferred.'); return; }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = String(event.target?.result ?? '');
      try {
        if (/\.dxf$/i.test(file.name)) { setCadOutlines(readDxfRectangles(content)); setStatusMessage('DXF outlines loaded for review only. Choose the actual unit outline and confirm depth, boards and internals before adding it.'); return; }
        const parsed = parse2DDrawingFile(content, file.name, materialPreset);
        setParts(current => [...current, ...parsed.parts.map(part => ({ ...part, id: `${crypto.randomUUID()}:${part.id}`, partInstanceId: `${crypto.randomUUID()}:${part.partInstanceId}` }))]);
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
    if (draftLoading) { setStatusMessage('Restoring your draft. Please wait before adding panels.'); return; }
    if (!uploadText.trim()) return;
    try {
      const parsed = parse2DDrawingFile(uploadText, 'Pasted-2D-Drawing', materialPreset);
      setParts(current => [...current, ...parsed.parts.map(part => ({ ...part, id: `${crypto.randomUUID()}:${part.id}`, partInstanceId: `${crypto.randomUUID()}:${part.partInstanceId}` }))]);
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
    if (!nestingComplete) { setStatusMessage('Export blocked: at least one listed part does not fit the selected sheet with its grain constraints. Resolve the unplaced parts first.'); return; }
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
  function downloadWorkbook() {
    try {
      const bytes = buildCutlistDraftWorkbook(nestingResult, units, spaceTitle);
      const url = URL.createObjectURL(new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'ULTIDA-cutlist-DRAFT.xlsx'; anchor.click(); URL.revokeObjectURL(url);
    } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Workbook export failed.'); }
  }

  function downloadDxf() {
    if (!nestingComplete) { setStatusMessage('Export blocked: resolve every unplaced part before generating CNC sheet layouts.'); return; }
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
    if (!nestingComplete) { setStatusMessage('Print blocked: resolve every unplaced part before printing the cutting dossier.'); return; }
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
            Import measured panel schedules, group compatible materials, and calculate sheet layouts with kerf, trim, and part-level grain constraints. Waste is reported from the selected layout; it is not guaranteed.
          </p>
        </div>

        <div className="cs-hero-actions">
          <button type="button" className="cs-btn" onClick={() => fileInputRef.current?.click()} title="Upload a JSON or CSV panel schedule with measured part sizes">
            <Upload size={14} />
            <span>Import DXF / panel list</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept=".json,.csv,.dxf,.dwg"
            onChange={handleFileUpload}
          />

          <button type="button" className="cs-btn" onClick={() => setUploadModalOpen(true)} title="Paste a JSON or CSV panel schedule">
            <Layers size={14} />
            <span>Paste Panel Schedule</span>
          </button>

          <button
            type="button"
            className="cs-btn"
            onClick={() => setSlidingModalOpen(true)}
            style={{ background: '#fdf4ff', borderColor: '#f0abfc', color: '#86198f', fontWeight: 700 }}
            title="Calculate exact panel deductions for sliding wardrobe shutters"
          >
            <Sliders size={14} />
            <span>Sliding Door Deductions</span>
          </button>

          <button
            type="button"
            className="cs-btn"
            onClick={() => setStickerModalOpen(true)}
            style={{ background: '#ecfdf5', borderColor: '#a7f3d0', color: '#065f46', fontWeight: 700 }}
            title="Print workshop part labels and stickers with QR/Barcodes"
          >
            <Tag size={14} />
            <span>Print Part Stickers</span>
          </button>

          <button type="button" className="cs-btn primary" disabled={!nestingComplete} onClick={downloadWorkbook}><Download size={14} /> Excel workbook (draft)</button>
          <button type="button" className="cs-btn" onClick={downloadCsv} disabled={!nestingComplete} title={nestingComplete ? 'Download CSV cutlist with laminate schedules' : 'Resolve unplaced parts before export'}>
            <Download size={14} />
            <span>Export CSV Cutlist</span>
          </button>

          <button type="button" className="cs-btn" onClick={downloadDxf} disabled={!nestingComplete} title={nestingComplete ? 'Download AutoCAD CNC / Saw sheet nesting DXF' : 'Resolve unplaced parts before export'}>
            <Scissors size={14} />
            <span>Export CNC DXF</span>
          </button>

          <button type="button" className="cs-btn" onClick={printCuttingDossier} disabled={!nestingComplete} title={nestingComplete ? 'Print production cutting ticket & part labels' : 'Resolve unplaced parts before printing'}>
            <Printer size={14} />
            <span>Print Dossier</span>
          </button>
        </div>
      </section>

      <section className="cs-card cs-unit-builder" aria-label="Measured multi-unit builder">
        <h2>Build your unit cutlist</h2>
        <p>Enter overall millimetre dimensions. Add as many units as needed; compatible boards are nested together. This recipe uses butt joints, inset fronts and a surface-mounted back.</p>
        <div className="cs-unit-fields">
          <label>Unit name<input value={unitName} onChange={event => setUnitName(event.target.value)} /></label>
          <label>Width (mm)<input type="number" value={unitWidth} onChange={event => setUnitWidth(event.target.value)} /></label>
          <label>Height (mm)<input type="number" value={unitHeight} onChange={event => setUnitHeight(event.target.value)} /></label>
          <label>Depth (mm)<input type="number" value={unitDepth} onChange={event => setUnitDepth(event.target.value)} /></label>
          <label>Front style<select value={unitStyle} onChange={event => setUnitStyle(event.target.value as 'open' | 'swing')}><option value="swing">Two inset swing doors</option><option value="open">Open shelving</option></select></label>
          <label>Shelves<input type="number" min="0" max="20" step="1" value={unitShelves} onChange={event => setUnitShelves(event.target.value)} /></label>
          <label>Back plywood<select value={unitBack} onChange={event => setUnitBack(Number(event.target.value) as 6 | 18)}><option value="6">6 mm surface-mounted back</option><option value="18">18 mm surface-mounted back</option></select></label>
          <label>Optional style photo<input type="file" accept="image/*" onChange={event => { const file = event.target.files?.[0]; setReferenceUrl(file ? URL.createObjectURL(file) : null); }} /></label>
        </div>
        {cadOutlines.length > 0 && <div><strong>Review CAD outlines — not all rectangles represent units</strong>{cadOutlines.map((outline, index) => <button type="button" key={index} onClick={() => { setUnitWidth(String(outline.widthMm)); setUnitHeight(String(outline.heightMm)); setUnitDepth(''); setStatusMessage('Outline dimensions copied. Confirm orientation, depth, construction and internal layout before adding this unit.'); }}>Layer {outline.layer}: {outline.widthMm} × {outline.heightMm} mm</button>)}</div>}
        <div className="cs-unit-previews">
          <div><strong>2D front · measured envelope</strong>{!previewValidation.error && <svg viewBox={`-30 -30 ${previewUnit.widthMm + 60} ${previewUnit.heightMm + 60}`} aria-label="Unit elevation preview"><rect width={previewUnit.widthMm} height={previewUnit.heightMm} fill="#eadcc5" stroke="#53422e" strokeWidth="5" />{unitStyle === 'swing' && <line x1={previewUnit.widthMm / 2} y1="0" x2={previewUnit.widthMm / 2} y2={previewUnit.heightMm} stroke="#53422e" strokeWidth="4" />}{Array.from({ length: previewUnit.shelves }, (_, index) => <line key={index} x1="18" x2={previewUnit.widthMm - 18} y1={(index + 1) * previewUnit.heightMm / (previewUnit.shelves + 1)} y2={(index + 1) * previewUnit.heightMm / (previewUnit.shelves + 1)} stroke="#53422e" strokeDasharray="10 10" strokeWidth="3" />)}</svg>}</div>
          <div><strong>3D schematic · same overall dimensions</strong>{!previewValidation.error && <svg viewBox={`-30 -${previewUnit.depthMm * .4 + 30} ${previewUnit.widthMm + previewUnit.depthMm * .4 + 60} ${previewUnit.heightMm + previewUnit.depthMm * .4 + 60}`} aria-label="Unit axonometric preview"><polygon points={`0,0 ${previewUnit.depthMm * .4},${-previewUnit.depthMm * .4} ${previewUnit.widthMm + previewUnit.depthMm * .4},${-previewUnit.depthMm * .4} ${previewUnit.widthMm},0`} fill="#cdbb9f" stroke="#53422e" strokeWidth="4" /><polygon points={`${previewUnit.widthMm},0 ${previewUnit.widthMm + previewUnit.depthMm * .4},${-previewUnit.depthMm * .4} ${previewUnit.widthMm + previewUnit.depthMm * .4},${previewUnit.heightMm - previewUnit.depthMm * .4} ${previewUnit.widthMm},${previewUnit.heightMm}`} fill="#ac9472" stroke="#53422e" strokeWidth="4" /><rect width={previewUnit.widthMm} height={previewUnit.heightMm} fill="#eadcc5" stroke="#53422e" strokeWidth="4" /></svg>}</div>
          {referenceUrl && <div><strong>Style reference only</strong><img src={referenceUrl} alt="Selected unit style reference" /></div>}
        </div>
        {previewValidation.error && <p role="status">{previewValidation.error}</p>}
        <button type="button" className="cs-btn" disabled={!!previewValidation.error} onClick={addMeasuredUnit}>Add unit to cutlist</button>
        <p>Materials below apply to the next unit. Already-added units retain their specifications. Laminate sheet figures are area estimates, not a separate laminate cutting plan.</p>
        {units.map(unit => <div key={unit.id}>{unit.name} · {unit.widthMm} × {unit.depthMm} × {unit.heightMm} mm · {unit.backThicknessMm} mm back <button type="button" onClick={() => { setUnits(current => current.filter(item => item.id !== unit.id)); setParts(current => current.filter(part => !part.id.startsWith(`${unit.id}:`))); }}>Remove unit</button></div>)}
      </section>

      {/* ─── Key Metrics Strip ─── */}
      <section className="cs-metrics-strip">
        <div className="cs-metric-card green">
          <span className="cs-metric-label">Overall Board Yield</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span className="cs-metric-val">{nestingResult.summary.overallYieldPct}%</span>
            <span className={`cs-pill-badge ${nestingComplete ? 'green' : 'red'}`}>
              {nestingComplete ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />} {nestingComplete ? 'All parts placed' : 'Layout incomplete'}
            </span>
          </div>
          <span className="cs-metric-sub">
            Calculated waste: <strong>{nestingResult.summary.overallWastePct}%</strong> for this layout
          </span>
        </div>

        <div className="cs-metric-card gold">
          <span className="cs-metric-label">Total Sheets Required</span>
          <span className="cs-metric-val">{nestingResult.summary.totalSheetsCount} Sheets</span>
          <span className="cs-metric-sub">Selected stock size {sheetDimensions.w} × {sheetDimensions.h} mm</span>
        </div>

        <div className="cs-metric-card">
          <span className="cs-metric-label">Laminate Procurement</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
            <span className="cs-metric-val" style={{ fontSize: 18 }}>
              {nestingResult.summary.laminateRequirement.externalDecorativeSheets} Ext / {nestingResult.summary.laminateRequirement.internalLinerSheets} Liner
            </span>
          </div>
          <span className="cs-metric-sub">
            Area-based lower bound: {nestingResult.summary.laminateRequirement.externalDecorativeSheets} decorative + {nestingResult.summary.laminateRequirement.internalLinerSheets} liner sheets; actual nesting and finish-specific stock may require more.
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
            2mm: <strong>{nestingResult.summary.edgeBandingRequirement.pvc2mmMeters}m</strong> | 0.8mm: <strong>{nestingResult.summary.edgeBandingRequirement.pvc08mmMeters}m</strong> | Other/unclassified: <strong>{nestingResult.summary.edgeBandingRequirement.otherMeters}m</strong>
          </span>
        </div>
      </section>

      {nestingResult.summary.blockingIssues.length > 0 && (
        <section role="alert" className="cs-card" style={{ borderColor: '#b91c1c', color: '#7f1d1d', marginBottom: 16 }}>
          <strong>The cutlist cannot be calculated with these settings.</strong>
          <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>{nestingResult.summary.blockingIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
        </section>
      )}
      {nestingResult.summary.unplacedParts.length > 0 && (
        <section role="alert" className="cs-card" style={{ borderColor: '#d97706', color: '#7c2d12', marginBottom: 16 }}>
          <strong>Some parts are missing from the sheet layout. Exports are paused.</strong>
          <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
            {nestingResult.summary.unplacedParts.map((part) => <li key={part.partInstanceId}>{part.partInstanceId} · {part.name} · {part.quantity} pc — {part.reason}</li>)}
          </ul>
        </section>
      )}

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
                <span>External Shutter (Decorative laminate (area estimate))</span>
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
                <span style={{ color: 'var(--text-muted)' }}>Backing plywood · actual stock</span>
                <strong>{nestingResult.summary.laminateRequirement.backingPlySheets} Sheets</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--line)', paddingBottom: 6 }}>
                <span style={{ color: 'var(--text-muted)' }}>Decorative laminate (area estimate)</span>
                <strong style={{ color: 'var(--gold-dim)' }}>
                  {nestingResult.summary.laminateRequirement.externalDecorativeSheets} Sheets
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--line)', paddingBottom: 6 }}>
                <span style={{ color: 'var(--text-muted)' }}>Internal liner (area estimate)</span>
                <strong>{nestingResult.summary.laminateRequirement.internalLinerSheets} Sheets</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--line)', paddingBottom: 6 }}>
                <span style={{ color: 'var(--text-muted)' }}>2.0mm PVC Edge Banding</span>
                <strong>{nestingResult.summary.edgeBandingRequirement.pvc2mmMeters} m</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>0.8mm PVC Edge Banding</span>
                <strong>{nestingResult.summary.edgeBandingRequirement.pvc08mmMeters} m</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Other / unclassified edge banding</span>
                <strong>{nestingResult.summary.edgeBandingRequirement.otherMeters} m</strong>
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
      {slidingModalOpen && (
        <div role="presentation" style={{ position: 'fixed', inset: 0, zIndex: 1050, background: 'rgba(18, 16, 13, .72)', display: 'grid', placeItems: 'center', padding: 16 }} onClick={(event) => event.target === event.currentTarget && setSlidingModalOpen(false)}>
          <section role="dialog" aria-modal="true" aria-labelledby="sliding-calculator-title" style={{ width: 'min(760px, 100%)', maxHeight: '90vh', overflow: 'auto', background: 'var(--surface, #fff)', color: 'var(--text, #211b15)', borderRadius: 14, padding: 22, boxShadow: '0 24px 80px rgba(0,0,0,.35)' }}>
            <h2 id="sliding-calculator-title" style={{ margin: '0 0 6px' }}>Sliding shutter calculator</h2>
            <p style={{ marginTop: 0, fontSize: 13, color: 'var(--text-secondary)' }}>Enter a measured clear opening and check deductions against the exact hardware supplier drawing. This creates draft infill panels; it does not certify the track, frame, or shutter assembly.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
              <label>Measured opening width (mm)<input type="number" min="1" value={slidingOpeningW} onChange={(e) => setSlidingOpeningW(e.target.value)} style={{ display: 'block', width: '100%' }} /></label>
              <label>Measured opening height (mm)<input type="number" min="1" value={slidingOpeningH} onChange={(e) => setSlidingOpeningH(e.target.value)} style={{ display: 'block', width: '100%' }} /></label>
              <label>Door count<select value={slidingDoorCount} onChange={(e) => setSlidingDoorCount(Number(e.target.value))} style={{ display: 'block', width: '100%' }}>{[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} doors</option>)}</select></label>
              <label>Hardware reference<select value={slidingPresetId} onChange={(e) => setSlidingPresetId(e.target.value)} style={{ display: 'block', width: '100%' }}>{SLIDING_HARDWARE_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}</select></label>
              <label>Panel material<select value={slidingMaterial} onChange={(e) => setSlidingMaterial(e.target.value as SlidingDoorInput['materialType'])} style={{ display: 'block', width: '100%' }}><option value="hdhmr_18">18 mm HDHMR</option><option value="plywood_18">18 mm plywood</option><option value="mdf_18">18 mm MDF</option><option value="glass_fluted_8">8 mm fluted glass</option><option value="mirror_6">6 mm mirror</option><option value="acrylic_12">12 mm acrylic composite</option></select></label>
              {slidingMaterial !== 'glass_fluted_8' && slidingMaterial !== 'mirror_6' && <label>Decorative laminate code (optional)<input value={slidingLaminate} onChange={(e) => setSlidingLaminate(e.target.value)} placeholder="Enter verified material code" style={{ display: 'block', width: '100%' }} /></label>}
              <label>Door overlap (mm)<input type="number" min="0" value={slidingCustomOverlap} onChange={(e) => setSlidingCustomOverlap(Number(e.target.value))} style={{ display: 'block', width: '100%' }} /></label>
              <label>Track/roller height deduction (mm)<input type="number" min="0" value={slidingCustomDh} onChange={(e) => setSlidingCustomDh(Number(e.target.value))} style={{ display: 'block', width: '100%' }} /></label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={slidingIsProfile} onChange={(e) => setSlidingIsProfile(e.target.checked)} /> Four-sided profile frame</label>
              {slidingIsProfile && <>
                <label>Side profile allowance per side (mm)<input type="number" min="0" value={slidingSideAllowance} onChange={(e) => setSlidingSideAllowance(Number(e.target.value))} style={{ display: 'block', width: '100%' }} /></label>
                <label>Top rail allowance (mm)<input type="number" min="0" value={slidingTopAllowance} onChange={(e) => setSlidingTopAllowance(Number(e.target.value))} style={{ display: 'block', width: '100%' }} /></label>
                <label>Bottom rail allowance (mm)<input type="number" min="0" value={slidingBottomAllowance} onChange={(e) => setSlidingBottomAllowance(Number(e.target.value))} style={{ display: 'block', width: '100%' }} /></label>
              </>}
            </div>
            {activeSlidingCalculation.error && <p role="alert" style={{ color: '#9a3412', background: '#fff7ed', border: '1px solid #fdba74', padding: 10, borderRadius: 8 }}>{activeSlidingCalculation.error}</p>}
            {activeSlidingResult && <div style={{ marginTop: 14, padding: 14, border: '1px solid var(--line)', borderRadius: 10 }}>
              <strong>Draft dimensions per door</strong>
              <p style={{ margin: '8px 0' }}>Shutter: {activeSlidingResult.finishedShutterWidthMm} × {activeSlidingResult.finishedShutterHeightMm} mm · Infill: {activeSlidingResult.infillWidthMm} × {activeSlidingResult.infillHeightMm} mm</p>
              <small>{activeSlidingResult.formulas.widthFormula}<br />{activeSlidingResult.formulas.heightFormula}</small>
              <p style={{ marginBottom: 4, fontSize: 12 }}>Estimated infill weight: {activeSlidingResult.weightPerDoorKg} kg each ({activeSlidingResult.weightCapacityStatus}); frame, handle, rollers, and fittings are excluded. Verify total assembly weight against the exact hardware rating.</p>
              {activeSlidingResult.hardwareChecklist.map((item) => <div key={item.name} style={{ fontSize: 12 }}>{item.name}: {item.quantity} {item.unit ?? 'pc'} — {item.notes}</div>)}
              <p style={{ fontSize: 12, color: '#9a3412', marginBottom: 0 }}>Preset values are reference starting values. No supplier specification has been independently verified by this calculator.</p>
            </div>}
            <label style={{ display: 'flex', gap: 9, alignItems: 'flex-start', margin: '16px 0', fontSize: 13 }}>
              <input type="checkbox" checked={slidingSpecConfirmed} onChange={(e) => setVerifiedSlidingSignature(e.target.checked ? slidingSpecSignature : '')} />
              I checked this opening and each overlap, height, and profile deduction against the exact supplier drawing for this hardware.
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="button" className="cs-btn" onClick={() => setSlidingModalOpen(false)}>Cancel</button><button type="button" className="cs-btn primary" disabled={!activeSlidingResult || !slidingSpecConfirmed} onClick={appendSlidingPanels}>Add draft panels to cutlist</button></div>
          </section>
        </div>
      )}

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
              Import JSON or CSV panel schedules with measured sizes. DXF/vector drawings are not converted to cabinet sizes here; use an approved scene or prepare a panel list. Layout yield reflects the selected sheet, trim, kerf, and part grain constraints; review unplaced panels before export.
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
