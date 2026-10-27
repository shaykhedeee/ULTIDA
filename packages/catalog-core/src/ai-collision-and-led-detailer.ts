export interface PreflightModuleInput {
  id: string;
  title: string;
  category: 'base' | 'wall' | 'tall' | 'wardrobe' | 'pooja' | 'retail';
  widthMm: number;
  heightMm: number;
  depthMm: number;
  shutterCount: number;
  shutterThicknessMm?: number;
  xOffsetMm?: number;
  isCornerAdjacent?: boolean;
  hasCornerScribingFiller?: boolean;
  cornerFillerWidthMm?: number;
  hasUnderCabinetLedStrip?: boolean;
  hasConcealedLedDriverCavity?: boolean;
  ledGrooveWidthMm?: number;
  ledGrooveDepthMm?: number;
  isWetSinkZone?: boolean;
  coreMaterialSku?: string;
}

export interface AiPreflightDetection {
  id: string;
  moduleId: string;
  moduleTitle: string;
  code:
    | 'OVERSIZED_HINGED_SHUTTER'
    | 'MISSING_CORNER_SCRIBING_FILLER'
    | 'MISSING_LED_DRIVER_CAVITY'
    | 'NON_BWP_CORE_IN_WET_SINK_ZONE';
  severity: 'blocking' | 'warning';
  issueTitle: string;
  technicalReason: string;
  autoFixDescription: string;
}

export interface AiManufacturingPreflightReport {
  totalModulesChecked: number;
  blockingCount: number;
  warningCount: number;
  factoryReady: boolean;
  detections: AiPreflightDetection[];
  normalizedModules: PreflightModuleInput[];
}

export function runAiManufacturingPreflight(
  modules: readonly PreflightModuleInput[],
): AiManufacturingPreflightReport {
  const detections: AiPreflightDetection[] = [];
  const normalizedModules: PreflightModuleInput[] = modules.map((mod) => ({ ...mod }));

  normalizedModules.forEach((mod) => {
    if (mod.category === 'retail') return;

    const shutterCount = Math.max(1, mod.shutterCount || 1);
    const singleShutterWidthMm = Math.round(mod.widthMm / shutterCount);

    // 1. Check oversized hinged shutter (>600mm)
    if (
      (mod.category === 'base' || mod.category === 'wall' || mod.category === 'wardrobe' || mod.category === 'tall') &&
      singleShutterWidthMm > 600
    ) {
      const fixedShutterCount = Math.max(2, Math.ceil(mod.widthMm / 550));
      const newSingleWidth = Math.round(mod.widthMm / fixedShutterCount);
      detections.push({
        id: `det-shutter-${mod.id}`,
        moduleId: mod.id,
        moduleTitle: mod.title,
        code: 'OVERSIZED_HINGED_SHUTTER',
        severity: 'blocking',
        issueTitle: `Shutter Width ${singleShutterWidthMm}mm Exceeds 600mm Anti-Sag Limit`,
        technicalReason: `${mod.title} (${mod.widthMm}mm wide with ${shutterCount} door) produces a ${singleShutterWidthMm}mm leaf that exceeds Ebco/Hettich Ø35mm cup hinge torque limits.`,
        autoFixDescription: `Auto-split into ${fixedShutterCount} equal shutters of ${newSingleWidth}mm (${newSingleWidth - 3}mm finished leaf with 3mm reveal).`,
      });
      mod.shutterCount = fixedShutterCount;
    }

    // 2. Check corner scribing filler
    if (mod.isCornerAdjacent && !mod.hasCornerScribingFiller) {
      detections.push({
        id: `det-filler-${mod.id}`,
        moduleId: mod.id,
        moduleTitle: mod.title,
        code: 'MISSING_CORNER_SCRIBING_FILLER',
        severity: 'blocking',
        issueTitle: 'Missing 50mm Wall / Corner Scribing Filler',
        technicalReason: `${mod.title} abuts a raw masonry wall or 90° return corner without a scribing filler. A 105° door swing or full-extension drawer will strike adjacent handles or out-of-plumb plaster.`,
        autoFixDescription: 'Insert a 50mm L-return scribing filler and recalculate equal shutter widths.',
      });
      mod.hasCornerScribingFiller = true;
      mod.cornerFillerWidthMm = 50;
    }

    // 3. Check Under-Cabinet LED groove & 24V driver cavity
    if (
      (mod.category === 'wall' || mod.category === 'pooja') &&
      mod.hasUnderCabinetLedStrip &&
      !mod.hasConcealedLedDriverCavity
    ) {
      detections.push({
        id: `det-led-${mod.id}`,
        moduleId: mod.id,
        moduleTitle: mod.title,
        code: 'MISSING_LED_DRIVER_CAVITY',
        severity: 'warning',
        issueTitle: 'Missing 18×8mm CNC LED Groove & 24V SMPS Driver Cavity',
        technicalReason: `${mod.title} specifies task/jaali LED lighting without a routed bottom-panel aluminium profile channel or concealed 24V driver housing.`,
        autoFixDescription:
          'Add 18×8mm CNC bottom-panel groove (60mm front setback), concealed 24V SMPS driver cavity, and FFL +2050mm / +1050mm electrical callout.',
      });
      mod.hasConcealedLedDriverCavity = true;
      mod.ledGrooveWidthMm = 18;
      mod.ledGrooveDepthMm = 8;
    }

    // 4. Check Wet Sink Zone BWP Core
    if (
      mod.isWetSinkZone &&
      mod.coreMaterialSku &&
      !mod.coreMaterialSku.toLowerCase().includes('710') &&
      !mod.coreMaterialSku.toLowerCase().includes('bwp')
    ) {
      detections.push({
        id: `det-bwp-${mod.id}`,
        moduleId: mod.id,
        moduleTitle: mod.title,
        code: 'NON_BWP_CORE_IN_WET_SINK_ZONE',
        severity: 'blocking',
        issueTitle: 'Wet Sink Carcass Requires IS:710 BWP Marine Plywood',
        technicalReason: `${mod.title} is in a wet plumbing zone but specifies "${mod.coreMaterialSku}". Standard MDF/particle board swells under sink condensation or trap leaks.`,
        autoFixDescription:
          'Upgrade carcass core substrate to CenturyPly 18mm Sainik 710 IS:710 BWP Marine Plywood.',
      });
      mod.coreMaterialSku = 'centuryply-18mm-sainik-710-bwp';
    }
  });

  const blockingCount = detections.filter((d) => d.severity === 'blocking').length;
  const warningCount = detections.filter((d) => d.severity === 'warning').length;

  return {
    totalModulesChecked: modules.length,
    blockingCount,
    warningCount,
    factoryReady: blockingCount === 0,
    detections,
    normalizedModules,
  };
}

export interface UnderCabinetLedDetailStep {
  stepNumber: 1 | 2 | 3 | 4 | 5;
  trade: 'CNC Carpentry' | 'Lighting & Glazing' | 'Electrical & Driver' | 'Civil Conduit' | 'Switchgear';
  title: string;
  dimensionSpec: string;
  elevationCalloutMm: string;
  siteExecutionInstruction: string;
}

export interface UnderCabinetLedExecutionSchedule {
  wallRunWidthMm: number;
  upperCabinetDepthMm: number;
  cncGrooveWidthMm: number;
  cncGrooveDepthMm: number;
  frontSetbackMm: number;
  ledStripSpec: string;
  recommendedDriverWatts: number;
  wallPointElevationFflMm: number;
  switchElevationFflMm: number;
  conduitDiameterMm: number;
  steps: UnderCabinetLedDetailStep[];
}

export function buildUnderCabinetLedDetail(input: {
  wallRunWidthMm: number;
  upperCabinetDepthMm?: number;
}): UnderCabinetLedExecutionSchedule {
  const wallRunWidthMm = Math.max(600, Math.round(input.wallRunWidthMm));
  const upperCabinetDepthMm = Math.max(300, Math.round(input.upperCabinetDepthMm ?? 350));
  const linearMeters = wallRunWidthMm / 1000;
  // 10W/m COB strip with 25% safety headroom on 24V SMPS driver
  const rawWatts = linearMeters * 12.5;
  const recommendedDriverWatts = rawWatts <= 36 ? 36 : rawWatts <= 60 ? 60 : 100;

  return {
    wallRunWidthMm,
    upperCabinetDepthMm,
    cncGrooveWidthMm: 18,
    cncGrooveDepthMm: 8,
    frontSetbackMm: 60,
    ledStripSpec: '24V DC 10W/m 3000K Warm White COB Dotless LED (CRI > 90)',
    recommendedDriverWatts,
    wallPointElevationFflMm: 2050,
    switchElevationFflMm: 1050,
    conduitDiameterMm: 20,
    steps: [
      {
        stepNumber: 1,
        trade: 'CNC Carpentry',
        title: '18×8mm CNC Bottom-Panel Profile Groove',
        dimensionSpec: '18mm (W) × 8mm (D) × Continuous Run, 60mm setback from front shutter face',
        elevationCalloutMm: 'FFL +1450mm (Underside of Upper Wall Cabinet)',
        siteExecutionInstruction:
          'Route 18mm wide × 8mm deep stop-groove into the 18mm HDHMR/BWP bottom panel prior to edge-banding. Leave 15mm solid shoulder at gable joints.',
      },
      {
        stepNumber: 2,
        trade: 'Lighting & Glazing',
        title: 'Flush Anodized Aluminium Profile + Frosted PC Diffuser',
        dimensionSpec: '17.6×7.8mm Recessed Extrusion + 24V COB 3000K LED Strip',
        elevationCalloutMm: 'FFL +1450mm',
        siteExecutionInstruction:
          'Press-fit anodized aluminium heat-sink profile with silicone adhesive, adhere 24V COB strip, and snap in anti-glare opal polycarbonate diffuser.',
      },
      {
        stepNumber: 3,
        trade: 'Electrical & Driver',
        title: `Concealed 24V ${recommendedDriverWatts}W Slim SMPS Driver Housing`,
        dimensionSpec: `24V DC ${recommendedDriverWatts}W Constant-Voltage Slim Driver + Ø10mm Rear Cable Riser`,
        elevationCalloutMm: 'FFL +2020mm (Top Shelf / Utility Hood Cavity)',
        siteExecutionInstruction:
          'Route low-voltage 2-core 1.0 sq.mm twin-flat cable through a 10×10mm rear gable rebate up to the ventilated top-shelf driver box.',
      },
      {
        stepNumber: 4,
        trade: 'Civil Conduit',
        title: '20mm Concealed PVC Wall Conduit & AC Feed Point',
        dimensionSpec: 'Ø20mm Medium-Duty PVC Conduit w/ 3×1.5 sq.mm FRLS Copper Wire',
        elevationCalloutMm: 'FFL +2050mm (Behind Upper Cabinet Top Rail)',
        siteExecutionInstruction:
          'Terminate 230V AC switched phase, neutral, and earth inside a flush junction box at FFL +2050mm before hanging wall cabinets.',
      },
      {
        stepNumber: 5,
        trade: 'Switchgear',
        title: 'Dedicated 6A Backsplash Switch / IR Hand-Wave Dimmer',
        dimensionSpec: '6A 1-Way Modular Switch (or Touchless IR Wave Sensor)',
        elevationCalloutMm: 'FFL +1050mm (Above Countertop Backsplash)',
        siteExecutionInstruction:
          'Wire dedicated 6A switch at FFL +1050mm on the kitchen appliance switchboard so task lighting operates independently of ceiling ambient lights.',
      },
    ],
  };
}
