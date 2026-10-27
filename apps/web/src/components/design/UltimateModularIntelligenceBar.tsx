import { useState, useMemo } from 'react';
import {
  solveEqualShutterWallFit,
  proposeModularRuns,
  runAiManufacturingPreflight,
  buildUnderCabinetLedDetail,
  validateHardwareCompatibility,
  VERIFIED_HARDWARE_REGISTRY,
  VENDOR_APPROVED_LAMINATES,
  IKEA_INDIA_RETAIL_CATALOG,
  type PreflightModuleInput,
} from '@ultida/catalog-core';
import { packLaminateRecipeSheets } from '@ultida/drawing-core/browser';
import { ModulePreview } from '../library/ModulePreview';

type ActiveDrawer =
  | 'none'
  | 'wall_fit'
  | 'ai_preflight'
  | 'led_detail'
  | 'hardware_catalog'
  | 'nesting_cam_quote';

export function UltimateModularIntelligenceBar({
  roomType = 'bedroom',
  roomModules = [],
}: {
  roomType?: string;
  roomModules?: Array<{
    id: string;
    label: string;
    family: string;
    widthMm: number;
    depthMm: number;
    heightMm: number;
  }>;
}) {
  const [activeDrawer, setActiveDrawer] = useState<ActiveDrawer>('none');

  // 1. Smart Wall-Fit state
  const [wallWidthMm, setWallWidthMm] = useState<number>(2600);
  const [wallHeightMm, setWallHeightMm] = useState<number>(2700);
  const [fillerMm, setFillerMm] = useState<number>(50);
  const [includeCurvedDisplayEnd, setIncludeCurvedDisplayEnd] = useState<boolean>(false);
  const [previewArchetype, setPreviewArchetype] = useState<
    'wardrobe-equal' | 'wardrobe-curved' | 'pooja-mandir' | 'kitchen-tandem'
  >('wardrobe-equal');

  const wallFitSolution = useMemo(
    () =>
      solveEqualShutterWallFit({
        wallWidthMm,
        totalHeightMm: wallHeightMm,
        depthMm: 600,
        leftScribingFillerMm: fillerMm,
        rightScribingFillerMm: includeCurvedDisplayEnd ? 0 : fillerMm,
        openDisplayEndShelfWidthMm: includeCurvedDisplayEnd ? 350 : 0,
      }),
    [wallWidthMm, wallHeightMm, fillerMm, includeCurvedDisplayEnd],
  );

  const runProposals = useMemo(
    () =>
      proposeModularRuns({
        wallWidthMm,
        wallHeightMm,
        roomType:
          roomType === 'kitchen'
            ? 'kitchen'
            : roomType === 'pooja'
              ? 'pooja'
              : roomType === 'living'
                ? 'living'
                : 'wardrobe',
      }),
    [wallWidthMm, wallHeightMm, roomType],
  );

  // 2. AI Manufacturing Preflight state
  const [normalizedToast, setNormalizedToast] = useState<string>('');
  const [preflightModules, setPreflightModules] = useState<PreflightModuleInput[]>(() => [
    {
      id: 'pf-1',
      title: '800mm Single-Shutter Base Unit (Oversized Leaf Test)',
      category: 'base',
      widthMm: 800,
      heightMm: 850,
      depthMm: 600,
      shutterCount: 1,
      isCornerAdjacent: true,
      hasCornerScribingFiller: false,
    },
    {
      id: 'pf-2',
      title: '900mm Waterproof Sink Base',
      category: 'base',
      widthMm: 900,
      heightMm: 850,
      depthMm: 600,
      shutterCount: 2,
      isWetSinkZone: true,
      coreMaterialSku: 'standard-mdf-18mm',
    },
    {
      id: 'pf-3',
      title: '900mm Overhead AVENTOS Wall Unit w/ Task LED',
      category: 'wall',
      widthMm: 900,
      heightMm: 720,
      depthMm: 350,
      shutterCount: 2,
      hasUnderCabinetLedStrip: true,
      hasConcealedLedDriverCavity: false,
    },
  ]);

  const preflightReport = useMemo(
    () => runAiManufacturingPreflight(preflightModules),
    [preflightModules],
  );

  const handleAutoNormalize = () => {
    setPreflightModules(preflightReport.normalizedModules);
    setNormalizedToast(
      'All blocking shutter widths (>600mm), missing 50mm corner fillers, wet-zone IS:710 BWP cores, and 18×8mm LED grooves have been auto-normalized.',
    );
  };

  // 3. Under-Cabinet LED Detail
  const ledSchedule = useMemo(
    () => buildUnderCabinetLedDetail({ wallRunWidthMm: wallWidthMm, upperCabinetDepthMm: 350 }),
    [wallWidthMm],
  );

  // 4. Hardware Validator state
  const [selectedHardwareId, setSelectedHardwareId] = useState<string>(
    'ebco-esoft-linear-hinge-3d-105',
  );
  const [testShutterThickMm, setTestShutterThickMm] = useState<number>(18);
  const [testShutterWidthMm, setTestShutterWidthMm] = useState<number>(500);
  const [testCarcassDepthMm, setTestCarcassDepthMm] = useState<number>(550);

  const hardwareValidation = useMemo(
    () =>
      validateHardwareCompatibility(
        {
          shutterThicknessMm: testShutterThickMm,
          shutterWidthMm: testShutterWidthMm,
          shutterHeightMm: 2100,
          internalCarcassDepthMm: testCarcassDepthMm,
          expectedDrawerLoadKg: 28,
        },
        selectedHardwareId,
      ),
    [selectedHardwareId, testShutterThickMm, testShutterWidthMm, testCarcassDepthMm],
  );

  // 5. Laminate-Aware Nesting & Instant Quote
  const nestingResult = useMemo(
    () =>
      packLaminateRecipeSheets([
        {
          partId: 'WD-SHT',
          moduleId: 'ULT-WD-2600',
          moduleTitle: 'Equal-Shutter Wardrobe',
          partLabel: 'Equal Shutter Leaf',
          coreSubstrate: 'Action TESA 18mm HDHMR Pro',
          thicknessMm: 18,
          frontLaminateSku: '14149-RS Alameda Oak Dune (Merino Senses)',
          backLinerSku: '21091-MR Frosty White Liner 0.8mm',
          finishedLengthMm: wallFitSolution.lowerUnitHeightMm,
          finishedWidthMm: Math.round(wallFitSolution.finishedShutterWidthMm),
          edgeTopMm: 2,
          edgeBottomMm: 2,
          edgeLeftMm: 2,
          edgeRightMm: 2,
          grainDirection: 'vertical',
          quantity: wallFitSolution.equalShutterCount,
        },
        {
          partId: 'WD-GBL',
          moduleId: 'ULT-WD-2600',
          moduleTitle: 'Equal-Shutter Wardrobe',
          partLabel: 'Carcass Structural Gable',
          coreSubstrate: 'Action TESA 18mm HDHMR Pro',
          thicknessMm: 18,
          frontLaminateSku: '21091-MR Frosty White Liner 0.8mm',
          backLinerSku: '21091-MR Frosty White Liner 0.8mm',
          finishedLengthMm: wallFitSolution.lowerUnitHeightMm,
          finishedWidthMm: 580,
          edgeTopMm: 0.8,
          edgeBottomMm: 0.8,
          edgeLeftMm: 0.8,
          edgeRightMm: 2,
          grainDirection: 'none',
          quantity: wallFitSolution.carcassBays.length * 2,
        },
      ]),
    [wallFitSolution],
  );

  const toggleDrawer = (drawer: ActiveDrawer) => {
    setActiveDrawer((prev) => (prev === drawer ? 'none' : drawer));
  };

  const previewModuleData = useMemo(() => {
    if (previewArchetype === 'pooja-mandir') {
      return {
        id: 'pooja-mandir-mandapa-1500',
        family: 'pooja',
        name: `${wallWidthMm} Sacred Gopuram Pooja Mandir w/ Backlit CNC Om Jaali`,
        widthMm: wallWidthMm,
        depthMm: 450,
        heightMm: wallHeightMm,
        tags: ['pooja', 'mandir', 'cnc-jaali', 'brass-bells', 'bhog-tray'],
      };
    }
    if (previewArchetype === 'wardrobe-curved') {
      return {
        id: 'wardrobe-2600-curved-display',
        family: 'wardrobe',
        name: `${wallWidthMm} R120 Curved-Edge Open Display & Equal-Shutter Wardrobe`,
        widthMm: wallWidthMm,
        depthMm: 600,
        heightMm: wallHeightMm,
        tags: ['wardrobe', 'curved-edge', 'open-display', 'equal-shutters', 'loft'],
      };
    }
    if (previewArchetype === 'kitchen-tandem') {
      return {
        id: 'kit-base-cutlery-600',
        family: 'kitchen-base',
        name: `${wallWidthMm} 3-Drawer Heavy Tandem Base (Cutlery + Thali + Pot)`,
        widthMm: wallWidthMm,
        depthMm: 600,
        heightMm: 850,
        tags: ['kitchen', 'base', 'cutlery', 'tandem', 'drawers'],
      };
    }
    return {
      id: 'wardrobe-2100-four-shutter',
      family: 'wardrobe',
      name: `${wallWidthMm} Equal-Shutter Wardrobe (${wallFitSolution.equalShutterCount} × ${wallFitSolution.nominalShutterWidthMm}mm)`,
      widthMm: wallWidthMm,
      depthMm: 600,
      heightMm: wallHeightMm,
      tags: ['wardrobe', 'equal-shutters', 'loft'],
    };
  }, [previewArchetype, wallWidthMm, wallHeightMm, wallFitSolution]);

  return (
    <div
      style={{
        margin: '8px 0 12px',
        padding: '10px 14px',
        borderRadius: 10,
        background: 'linear-gradient(135deg, #171412, #26201b)',
        border: '1px solid rgba(212, 175, 55, 0.45)',
        color: '#f8fafc',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: 99,
              background: 'rgba(212, 175, 55, 0.2)',
              color: '#e8c96a',
              border: '1px solid rgba(212, 175, 55, 0.4)',
            }}
          >
            ULTIDA v4.0 PARAMETRIC &amp; CAM ENGINE
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#e7e5e4' }}>
            Equal-Shutter Wall Solver · Ebco/Hettich/Blum · Merino &amp; IKEA · Laminate Nesting
          </span>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => toggleDrawer('wall_fit')}
            style={{
              padding: '5px 11px',
              borderRadius: 6,
              fontSize: 11.5,
              fontWeight: 800,
              border:
                activeDrawer === 'wall_fit'
                  ? '1.5px solid #e8c96a'
                  : '1px solid rgba(255,255,255,0.18)',
              background: activeDrawer === 'wall_fit' ? '#3d2a1a' : '#262320',
              color: '#e8c96a',
              cursor: 'pointer',
            }}
          >
            📐 Smart Wall-Fit ({wallFitSolution.equalShutterCount}×{wallFitSolution.nominalShutterWidthMm}mm)
          </button>

          <button
            type="button"
            onClick={() => toggleDrawer('ai_preflight')}
            style={{
              padding: '5px 11px',
              borderRadius: 6,
              fontSize: 11.5,
              fontWeight: 800,
              border:
                activeDrawer === 'ai_preflight'
                  ? '1.5px solid #f59e0b'
                  : '1px solid rgba(255,255,255,0.18)',
              background:
                preflightReport.blockingCount > 0 ? 'rgba(180, 83, 9, 0.35)' : '#064e3b',
              color: preflightReport.blockingCount > 0 ? '#fde68a' : '#6ee7b7',
              cursor: 'pointer',
            }}
          >
            ⚠️ AI Detection ({preflightReport.detections.length})
          </button>

          <button
            type="button"
            onClick={() => toggleDrawer('led_detail')}
            style={{
              padding: '5px 11px',
              borderRadius: 6,
              fontSize: 11.5,
              fontWeight: 800,
              border:
                activeDrawer === 'led_detail'
                  ? '1.5px solid #fde047'
                  : '1px solid rgba(255,255,255,0.18)',
              background: activeDrawer === 'led_detail' ? '#3d2a1a' : '#262320',
              color: '#fde047',
              cursor: 'pointer',
            }}
          >
            💡 18×8mm LED Detail
          </button>

          <button
            type="button"
            onClick={() => toggleDrawer('hardware_catalog')}
            style={{
              padding: '5px 11px',
              borderRadius: 6,
              fontSize: 11.5,
              fontWeight: 800,
              border:
                activeDrawer === 'hardware_catalog'
                  ? '1.5px solid #38bdf8'
                  : '1px solid rgba(255,255,255,0.18)',
              background: activeDrawer === 'hardware_catalog' ? '#1e293b' : '#262320',
              color: '#bae6fd',
              cursor: 'pointer',
            }}
          >
            🔩 Ebco / Hettich / Merino / IKEA
          </button>

          <button
            type="button"
            onClick={() => toggleDrawer('nesting_cam_quote')}
            style={{
              padding: '5px 11px',
              borderRadius: 6,
              fontSize: 11.5,
              fontWeight: 800,
              border:
                activeDrawer === 'nesting_cam_quote'
                  ? '1.5px solid #34d399'
                  : '1px solid rgba(255,255,255,0.18)',
              background: activeDrawer === 'nesting_cam_quote' ? '#064e3b' : '#262320',
              color: '#6ee7b7',
              cursor: 'pointer',
            }}
          >
            ⚡ Design to Quote &amp; Nesting ({nestingResult.totalSheets} Sheets)
          </button>
        </div>
      </div>

      {/* DRAWER 1: SMART WALL-FIT & EQUAL-SHUTTER SOLVER */}
      {activeDrawer === 'wall_fit' && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 8,
            background: '#1e1b18',
            border: '1px solid rgba(212,175,55,0.3)',
            display: 'grid',
            gridTemplateColumns: '1.35fr 1fr',
            gap: 14,
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#e8c96a', marginBottom: 6 }}>
              Equal-Shutter Wall Auto-Divider &amp; Transportable Carcass Solver (≤1200mm Boxes)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 10 }}>
              <label style={{ fontSize: 10.5, color: '#d6d3d1' }}>
                Wall Width (mm)
                <input
                  type="number"
                  min={1200}
                  max={5400}
                  step={50}
                  value={wallWidthMm}
                  onChange={(e) => setWallWidthMm(Number(e.target.value) || 2600)}
                  style={{ width: '100%', padding: '4px 6px', marginTop: 2, borderRadius: 4, border: '1px solid #57534e', background: '#111', color: '#fff', fontSize: 12 }}
                />
              </label>
              <label style={{ fontSize: 10.5, color: '#d6d3d1' }}>
                Total Height (mm)
                <input
                  type="number"
                  min={750}
                  max={3000}
                  step={50}
                  value={wallHeightMm}
                  onChange={(e) => setWallHeightMm(Number(e.target.value) || 2700)}
                  style={{ width: '100%', padding: '4px 6px', marginTop: 2, borderRadius: 4, border: '1px solid #57534e', background: '#111', color: '#fff', fontSize: 12 }}
                />
              </label>
              <label style={{ fontSize: 10.5, color: '#d6d3d1' }}>
                Wall Fillers (mm)
                <select
                  value={fillerMm}
                  onChange={(e) => setFillerMm(Number(e.target.value))}
                  style={{ width: '100%', padding: '4px 6px', marginTop: 2, borderRadius: 4, border: '1px solid #57534e', background: '#111', color: '#fff', fontSize: 12 }}
                >
                  <option value={50}>50mm L + 50mm R (Recommended)</option>
                  <option value={0}>0mm Zero-Filler Flush Fit</option>
                  <option value={35}>35mm Scribing Fillers</option>
                </select>
              </label>
              <label style={{ fontSize: 10.5, color: '#d6d3d1', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <span style={{ marginBottom: 4 }}>R120 Curved Display End</span>
                <button
                  type="button"
                  onClick={() => {
                    const next = !includeCurvedDisplayEnd;
                    setIncludeCurvedDisplayEnd(next);
                    if (next) setPreviewArchetype('wardrobe-curved');
                  }}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 4,
                    border: '1px solid #e8c96a',
                    background: includeCurvedDisplayEnd ? '#e8c96a' : 'transparent',
                    color: includeCurvedDisplayEnd ? '#1c1917' : '#e8c96a',
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  {includeCurvedDisplayEnd ? '✓ 350mm R120 Active' : '+ Add 350mm R120 End'}
                </button>
              </label>
            </div>

            <div style={{ padding: '8px 10px', borderRadius: 6, background: '#141210', border: '1px solid #44403c', fontSize: 11.5, marginBottom: 10 }}>
              <div style={{ fontWeight: 800, color: '#fde68a' }}>{wallFitSolution.summaryFormula}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                {wallFitSolution.carcassBays.map((bay) => (
                  <span
                    key={bay.bayIndex}
                    style={{
                      padding: '3px 8px',
                      borderRadius: 4,
                      background: '#292524',
                      border: '1px solid #57534e',
                      fontSize: 10.5,
                      color: '#f5f5f4',
                    }}
                  >
                    <b>{bay.label}</b> · {bay.shutterCount > 0 ? `${bay.shutterCount}×${bay.finishedShutterWidthMm}mm leaf (${bay.hingesPerShutter} Ebco 3D hinges/door)` : '5 R120 Open Shelves'}
                  </span>
                ))}
              </div>
            </div>

            {/* 3 Constrained AI Furnishing Run Options */}
            <div style={{ fontSize: 11, fontWeight: 800, color: '#a8a29e', marginBottom: 4 }}>
              3 CONSTRAINED MODULAR RUN PROPOSALS (REAL ULTIDA CATALOG SKUs):
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {runProposals.map((opt) => (
                <div
                  key={opt.optionId}
                  style={{
                    padding: 8,
                    borderRadius: 6,
                    background: '#262320',
                    border: '1px solid #44403c',
                    fontSize: 10.5,
                  }}
                >
                  <div style={{ fontWeight: 800, color: '#e8c96a' }}>{opt.title}</div>
                  <div style={{ color: '#d6d3d1', marginTop: 2 }}>{opt.equalShutterSummary}</div>
                  <div style={{ color: '#6ee7b7', fontWeight: 800, marginTop: 4 }}>
                    Est. ₹{opt.estimatedPriceInr.toLocaleString('en-IN')} ({opt.units.length} units)
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* True-Silhouette Live Parametric Preview */}
          <div style={{ background: '#141210', borderRadius: 8, padding: 10, border: '1px solid #44403c' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#e8c96a' }}>
                TRUE-SILHOUETTE PARAMETRIC PREVIEW
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                {[
                  { id: 'wardrobe-equal', label: 'Equal Wardrobe' },
                  { id: 'wardrobe-curved', label: 'R120 Curved' },
                  { id: 'pooja-mandir', label: 'Pooja Mandir' },
                  { id: 'kitchen-tandem', label: '3-Drawer Base' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPreviewArchetype(tab.id as typeof previewArchetype)}
                    style={{
                      padding: '2px 6px',
                      fontSize: 9.5,
                      fontWeight: 700,
                      borderRadius: 4,
                      border: previewArchetype === tab.id ? '1px solid #e8c96a' : '1px solid #44403c',
                      background: previewArchetype === tab.id ? '#3d2a1a' : 'transparent',
                      color: '#f5f5f4',
                      cursor: 'pointer',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ background: '#fff', borderRadius: 6, padding: 6 }}>
              <ModulePreview module={previewModuleData} defaultView="vector" compact />
            </div>
          </div>
        </div>
      )}

      {/* DRAWER 2: AI DETECTION & MANUFACTURING PREFLIGHT */}
      {activeDrawer === 'ai_preflight' && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 8,
            background: '#1e1b18',
            border: '1px solid #f59e0b',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: '#fde68a' }}>
                ⚠️ AI Manufacturing Preflight &amp; Collision Detector (Coohom-Beating Engineering Gate)
              </div>
              <div style={{ fontSize: 11, color: '#d6d3d1' }}>
                Checks single shutter anti-sag width (≤600mm), 50mm corner scribing fillers, wet-zone IS:710 BWP marine ply, and 18×8mm LED grooves.
              </div>
            </div>
            <button
              type="button"
              onClick={handleAutoNormalize}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: '1px solid #10b981',
                background: '#065f46',
                color: '#ecfdf5',
                fontSize: 11.5,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              ⚡ 1-Click Auto-Normalize All Issues
            </button>
          </div>

          {normalizedToast && (
            <div style={{ padding: '6px 10px', borderRadius: 6, background: '#064e3b', color: '#6ee7b7', fontSize: 11.5, fontWeight: 700, marginBottom: 8 }}>
              ✓ {normalizedToast}
            </div>
          )}

          {preflightReport.detections.length === 0 ? (
            <div style={{ padding: 10, borderRadius: 6, background: '#064e3b', color: '#ecfdf5', fontSize: 12, fontWeight: 700 }}>
              ✓ 0 Blocking Manufacturing Issues — All shutters ≤600mm, 50mm corner fillers verified, IS:710 BWP wet-zone core active, and 18×8mm LED channels routed.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              {preflightReport.detections.map((det) => (
                <div
                  key={det.id}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 6,
                    background: '#292524',
                    borderLeft: `4px solid ${det.severity === 'blocking' ? '#ef4444' : '#f59e0b'}`,
                    fontSize: 11.5,
                  }}
                >
                  <div style={{ fontWeight: 800, color: '#fef3c7' }}>
                    [{det.severity.toUpperCase()}] {det.moduleTitle} — {det.issueTitle}
                  </div>
                  <div style={{ color: '#d6d3d1', marginTop: 2 }}>{det.technicalReason}</div>
                  <div style={{ color: '#6ee7b7', fontWeight: 700, marginTop: 3 }}>
                    Auto-Fix: {det.autoFixDescription}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* DRAWER 3: 5-STEP UNDER-CABINET LED ELECTRICAL & CNC DETAILER */}
      {activeDrawer === 'led_detail' && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 8,
            background: '#1e1b18',
            border: '1px solid #fde047',
          }}
        >
          <div style={{ fontSize: 12.5, fontWeight: 800, color: '#fde047', marginBottom: 6 }}>
            💡 5-Step Under-Cabinet LED Task Lighting &amp; Electrical Site Execution Detail ({ledSchedule.wallRunWidthMm}mm Run)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
            {ledSchedule.steps.map((st) => (
              <div
                key={st.stepNumber}
                style={{
                  padding: 8,
                  borderRadius: 6,
                  background: '#292524',
                  border: '1px solid #44403c',
                  fontSize: 10.5,
                }}
              >
                <div style={{ fontWeight: 800, color: '#fde047' }}>
                  Step {st.stepNumber} · {st.trade}
                </div>
                <div style={{ fontWeight: 700, color: '#fff', marginTop: 2 }}>{st.title}</div>
                <div style={{ color: '#38bdf8', fontWeight: 700, marginTop: 3 }}>
                  {st.elevationCalloutMm}
                </div>
                <div style={{ color: '#d6d3d1', marginTop: 3 }}>{st.dimensionSpec}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DRAWER 4: EBCO / HETTICH / BLUM & MERINO / IKEA REGISTRY */}
      {activeDrawer === 'hardware_catalog' && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 8,
            background: '#1e1b18',
            border: '1px solid #38bdf8',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#bae6fd', marginBottom: 6 }}>
              🔩 Ebco, Hettich &amp; Blum Compatibility Validator
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
              <select
                value={selectedHardwareId}
                onChange={(e) => setSelectedHardwareId(e.target.value)}
                style={{ padding: '4px 6px', fontSize: 11, borderRadius: 4, background: '#111', color: '#fff', border: '1px solid #475569' }}
              >
                {VERIFIED_HARDWARE_REGISTRY.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.supplier} — {h.modelName}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={testShutterThickMm}
                onChange={(e) => setTestShutterThickMm(Number(e.target.value) || 18)}
                title="Shutter thickness in mm"
                style={{ padding: '4px 6px', fontSize: 11, borderRadius: 4, background: '#111', color: '#fff', border: '1px solid #475569' }}
              />
              <input
                type="number"
                value={testShutterWidthMm}
                onChange={(e) => setTestShutterWidthMm(Number(e.target.value) || 500)}
                title="Shutter width in mm"
                style={{ padding: '4px 6px', fontSize: 11, borderRadius: 4, background: '#111', color: '#fff', border: '1px solid #475569' }}
              />
              <input
                type="number"
                value={testCarcassDepthMm}
                onChange={(e) => setTestCarcassDepthMm(Number(e.target.value) || 550)}
                title="Internal carcass depth in mm"
                style={{ padding: '4px 6px', fontSize: 11, borderRadius: 4, background: '#111', color: '#fff', border: '1px solid #475569' }}
              />
            </div>
            <div
              style={{
                padding: 8,
                borderRadius: 6,
                background: hardwareValidation.compatible ? '#064e3b' : '#7f1d1d',
                color: '#fff',
                fontSize: 11,
              }}
            >
              <div style={{ fontWeight: 800 }}>
                {hardwareValidation.fitting.supplier} {hardwareValidation.fitting.modelName} ({hardwareValidation.fitting.skuCode}) —{' '}
                {hardwareValidation.compatible ? '✓ COMPATIBLE' : '✗ INCOMPATIBLE'}
              </div>
              <div style={{ marginTop: 2 }}>{hardwareValidation.fitting.engineeringNotes}</div>
              {hardwareValidation.issues.map((iss, idx) => (
                <div key={idx} style={{ color: '#fde68a', marginTop: 3 }}>
                  • {iss.message} ({iss.remediation})
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#fde047', marginBottom: 6 }}>
              🇸🇪 Authorized IKEA India Retail SKUs ({IKEA_INDIA_RETAIL_CATALOG.length}) &amp; Merino Senses ({VENDOR_APPROVED_LAMINATES.length})
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5, maxHeight: 135, overflowY: 'auto' }}>
              {IKEA_INDIA_RETAIL_CATALOG.map((item) => (
                <div
                  key={item.id}
                  style={{
                    padding: 6,
                    borderRadius: 5,
                    background: '#292524',
                    border: '1px solid #44403c',
                    fontSize: 10,
                  }}
                >
                  <div style={{ fontWeight: 800, color: '#fde047' }}>
                    IKEA {item.seriesName} ({item.articleNumber})
                  </div>
                  <div style={{ color: '#e7e5e4' }}>
                    {item.widthMm}×{item.depthMm}×{item.heightMm}mm · ₹{item.priceInr.toLocaleString('en-IN')}
                  </div>
                  <div style={{ color: '#38bdf8', fontSize: 9.5 }}>Retail BOQ Only (No Cutlist)</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* DRAWER 5: LAMINATE-AWARE NESTING, 4-WALL ELEVATIONS & INSTANT QUOTE */}
      {activeDrawer === 'nesting_cam_quote' && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 8,
            background: '#1e1b18',
            border: '1px solid #34d399',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: '#6ee7b7' }}>
              🪚 Laminate-Recipe-Aware 2D Guillotine Nesting (2440×1220mm, 10mm Trim, 4mm Kerf, Pre-Mill 4-Edge Deduction)
            </div>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: '#fde68a' }}>
              Avg Yield: {nestingResult.averageUtilizationPercent}% · Reusable Offcuts: {nestingResult.totalReusableOffcutAreaSqm} m²
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 8 }}>
            {nestingResult.sheets.map((sht) => (
              <div
                key={sht.sheetId}
                style={{
                  padding: 8,
                  borderRadius: 6,
                  background: '#292524',
                  border: '1px solid #44403c',
                  fontSize: 10.5,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, color: '#6ee7b7' }}>
                  <span>{sht.sheetId} — {sht.coreSubstrate}</span>
                  <span>{sht.utilizationPercent}% Yield</span>
                </div>
                <div style={{ color: '#e8c96a', marginTop: 2 }}>
                  Face: {sht.frontLaminateSku} | Back: {sht.backLinerSku}
                </div>
                <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {sht.placements.slice(0, 4).map((pl) => (
                    <span
                      key={pl.partId}
                      style={{
                        padding: '2px 5px',
                        borderRadius: 3,
                        background: '#1c1917',
                        border: '1px solid #57534e',
                        fontSize: 9.5,
                      }}
                    >
                      {pl.partId}: Fin {pl.finishedLengthMm}×{pl.finishedWidthMm} → Cut <b>{pl.cutLengthMm}×{pl.cutWidthMm}mm</b> {pl.stickerEdgeMap}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
