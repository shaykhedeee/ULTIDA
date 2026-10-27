export interface EqualShutterWallFitInput {
  wallWidthMm: number;
  totalHeightMm?: number;
  depthMm?: number;
  leftScribingFillerMm?: number;
  rightScribingFillerMm?: number;
  openDisplayEndShelfWidthMm?: number;
  minShutterWidthMm?: number;
  maxShutterWidthMm?: number;
  shutterRevealGapMm?: number;
  maxTransportableCarcassWidthMm?: number;
}

export interface TransportableCarcassBay {
  bayIndex: number;
  label: string;
  carcassType: '2_door_carcass' | '1_door_carcass' | 'curved_open_display_end';
  widthMm: number;
  heightMm: number;
  loftHeightMm: number;
  depthMm: number;
  shutterCount: number;
  nominalShutterWidthMm: number;
  finishedShutterWidthMm: number;
  hingeSkuId: string;
  hingesPerShutter: number;
}

export interface EqualShutterWallFitSolution {
  wallWidthMm: number;
  leftScribingFillerMm: number;
  rightScribingFillerMm: number;
  openDisplayEndShelfWidthMm: number;
  netShutterRunWidthMm: number;
  equalShutterCount: number;
  nominalShutterWidthMm: number;
  finishedShutterWidthMm: number;
  shutterRevealGapMm: number;
  lowerUnitHeightMm: number;
  topLoftHeightMm: number;
  depthMm: number;
  carcassBays: TransportableCarcassBay[];
  summaryFormula: string;
  engineeringCheckPassed: boolean;
}

export function solveEqualShutterWallFit(
  input: EqualShutterWallFitInput,
): EqualShutterWallFitSolution {
  const wallWidthMm = Math.max(600, Math.round(input.wallWidthMm));
  const totalHeightMm = Math.max(720, Math.round(input.totalHeightMm ?? 2400));
  const depthMm = Math.max(300, Math.round(input.depthMm ?? 600));
  const leftScribingFillerMm = Math.max(0, Math.round(input.leftScribingFillerMm ?? 50));
  const rightScribingFillerMm = Math.max(0, Math.round(input.rightScribingFillerMm ?? 50));
  const openDisplayEndShelfWidthMm = Math.max(
    0,
    Math.round(input.openDisplayEndShelfWidthMm ?? 0),
  );
  const minShutterWidthMm = input.minShutterWidthMm ?? 400;
  const maxShutterWidthMm = input.maxShutterWidthMm ?? 600;
  const shutterRevealGapMm = input.shutterRevealGapMm ?? 3;
  const maxCarcassWidthMm = input.maxTransportableCarcassWidthMm ?? 1200;

  const netShutterRunWidthMm = Math.max(
    minShutterWidthMm,
    wallWidthMm - leftScribingFillerMm - rightScribingFillerMm - openDisplayEndShelfWidthMm,
  );

  // Minimum doors required so each shutter <= maxShutterWidthMm (600mm)
  const minDoors = Math.max(1, Math.ceil(netShutterRunWidthMm / maxShutterWidthMm));
  const maxDoors = Math.max(minDoors, Math.floor(netShutterRunWidthMm / minShutterWidthMm));

  // Prefer a door count that yields an integer/clean multiple of 5mm or 10mm around 500mm
  let bestDoorCount = minDoors;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let n = minDoors; n <= maxDoors; n += 1) {
    const w = netShutterRunWidthMm / n;
    const distanceFromIdeal500 = Math.abs(w - 500);
    const nonIntegerPenalty = Number.isInteger(w) ? 0 : 25;
    const nonMultipleOf10Penalty = w % 10 === 0 ? 0 : 8;
    const score = distanceFromIdeal500 + nonIntegerPenalty + nonMultipleOf10Penalty;
    if (score < bestScore) {
      bestScore = score;
      bestDoorCount = n;
    }
  }

  const nominalShutterWidthMm = Number((netShutterRunWidthMm / bestDoorCount).toFixed(1));
  const finishedShutterWidthMm = Number(
    Math.max(100, nominalShutterWidthMm - shutterRevealGapMm).toFixed(1),
  );

  const hasLoft = totalHeightMm > 2150;
  const lowerUnitHeightMm = hasLoft ? 2100 : totalHeightMm;
  const topLoftHeightMm = hasLoft ? totalHeightMm - 2100 : 0;
  const hingesPerShutter = lowerUnitHeightMm > 1600 ? 4 : lowerUnitHeightMm > 900 ? 3 : 2;

  const carcassBays: TransportableCarcassBay[] = [];
  let remainingDoors = bestDoorCount;
  let bayIndex = 1;

  while (remainingDoors > 0) {
    const canPairTwoDoors =
      remainingDoors >= 2 && nominalShutterWidthMm * 2 <= maxCarcassWidthMm;
    const doorsInBay = canPairTwoDoors ? 2 : 1;
    const bayWidthMm = Number((nominalShutterWidthMm * doorsInBay).toFixed(1));

    carcassBays.push({
      bayIndex,
      label:
        doorsInBay === 2
          ? `Carcass Bay ${bayIndex} (${bayWidthMm}mm 2-Door)`
          : `Carcass Bay ${bayIndex} (${bayWidthMm}mm 1-Door)`,
      carcassType: doorsInBay === 2 ? '2_door_carcass' : '1_door_carcass',
      widthMm: bayWidthMm,
      heightMm: lowerUnitHeightMm,
      loftHeightMm: topLoftHeightMm,
      depthMm,
      shutterCount: doorsInBay,
      nominalShutterWidthMm,
      finishedShutterWidthMm,
      hingeSkuId: 'ebco-esoft-linear-hinge-3d-105',
      hingesPerShutter,
    });

    remainingDoors -= doorsInBay;
    bayIndex += 1;
  }

  if (openDisplayEndShelfWidthMm > 0) {
    carcassBays.push({
      bayIndex,
      label: `Carcass Bay ${bayIndex} (${openDisplayEndShelfWidthMm}mm R120 Curved Open Display End)`,
      carcassType: 'curved_open_display_end',
      widthMm: openDisplayEndShelfWidthMm,
      heightMm: lowerUnitHeightMm,
      loftHeightMm: topLoftHeightMm,
      depthMm,
      shutterCount: 0,
      nominalShutterWidthMm: 0,
      finishedShutterWidthMm: 0,
      hingeSkuId: 'ebco-esoft-linear-hinge-3d-105',
      hingesPerShutter: 0,
    });
  }

  const fillerSummary =
    leftScribingFillerMm + rightScribingFillerMm > 0
      ? `${leftScribingFillerMm}mm L + ${rightScribingFillerMm}mm R Fillers`
      : '0mm Zero-Filler Flush Fit';
  const displaySummary =
    openDisplayEndShelfWidthMm > 0
      ? ` + ${openDisplayEndShelfWidthMm}mm R120 Curved Display`
      : '';

  return {
    wallWidthMm,
    leftScribingFillerMm,
    rightScribingFillerMm,
    openDisplayEndShelfWidthMm,
    netShutterRunWidthMm,
    equalShutterCount: bestDoorCount,
    nominalShutterWidthMm,
    finishedShutterWidthMm,
    shutterRevealGapMm,
    lowerUnitHeightMm,
    topLoftHeightMm,
    depthMm,
    carcassBays,
    summaryFormula: `${wallWidthMm}mm Wall = ${bestDoorCount} Equal Shutters × ${nominalShutterWidthMm}mm (${finishedShutterWidthMm}mm finished door w/ ${shutterRevealGapMm}mm reveal)${displaySummary} (${fillerSummary})`,
    engineeringCheckPassed:
      nominalShutterWidthMm >= minShutterWidthMm &&
      nominalShutterWidthMm <= maxShutterWidthMm &&
      carcassBays.every((bay) => bay.widthMm <= maxCarcassWidthMm),
  };
}

export interface ProposedModularRunUnit {
  instanceId: string;
  catalogModuleId: string;
  title: string;
  zone: 'base' | 'wall' | 'tall' | 'wardrobe' | 'loft' | 'end_display' | 'pooja';
  xOffsetMm: number;
  yElevationMm: number;
  widthMm: number;
  heightMm: number;
  depthMm: number;
  shutterCount: number;
  verifiedHardwareId: string;
  exteriorLaminateSku: string;
  coreMaterialSku: string;
}

export interface ModularRunProposalOption {
  optionId: 'option-a-balanced' | 'option-b-max-storage' | 'option-c-luxury-display';
  title: string;
  subtitle: string;
  wallWidthMm: number;
  totalHeightMm: number;
  leftFillerMm: number;
  rightFillerMm: number;
  equalShutterSummary: string;
  estimatedPriceInr: number;
  units: ProposedModularRunUnit[];
}

export function proposeModularRuns(input: {
  wallWidthMm: number;
  wallHeightMm?: number;
  roomType: 'kitchen' | 'wardrobe' | 'living' | 'pooja';
  plumbingCenterMm?: number;
}): ModularRunProposalOption[] {
  const wallWidthMm = Math.max(1200, Math.round(input.wallWidthMm));
  const wallHeightMm = Math.max(2100, Math.round(input.wallHeightMm ?? 2400));

  if (input.roomType === 'wardrobe') {
    const fitA = solveEqualShutterWallFit({
      wallWidthMm,
      totalHeightMm: 2100,
      depthMm: 600,
      leftScribingFillerMm: 50,
      rightScribingFillerMm: 50,
    });
    const fitB = solveEqualShutterWallFit({
      wallWidthMm,
      totalHeightMm: wallHeightMm,
      depthMm: 600,
      leftScribingFillerMm: 50,
      rightScribingFillerMm: 50,
    });
    const fitC = solveEqualShutterWallFit({
      wallWidthMm,
      totalHeightMm: wallHeightMm,
      depthMm: 600,
      leftScribingFillerMm: 50,
      rightScribingFillerMm: 0,
      openDisplayEndShelfWidthMm: 350,
    });

    const buildWardrobeUnits = (
      fit: EqualShutterWallFitSolution,
      laminateSku: string,
      tag: string,
    ): ProposedModularRunUnit[] => {
      const units: ProposedModularRunUnit[] = [];
      let cursorX = fit.leftScribingFillerMm;
      fit.carcassBays.forEach((bay, idx) => {
        const isDisplay = bay.carcassType === 'curved_open_display_end';
        units.push({
          instanceId: `${tag}-lower-${idx + 1}`,
          catalogModuleId: isDisplay
            ? 'mod-wardrobe-3d-combo'
            : bay.shutterCount === 2
              ? 'mod-wardrobe-2d-hang'
              : 'mod-wardrobe-3d-combo',
          title: bay.label,
          zone: isDisplay ? 'end_display' : 'wardrobe',
          xOffsetMm: cursorX,
          yElevationMm: 0,
          widthMm: bay.widthMm,
          heightMm: bay.heightMm,
          depthMm: bay.depthMm,
          shutterCount: bay.shutterCount,
          verifiedHardwareId: 'ebco-esoft-linear-hinge-3d-105',
          exteriorLaminateSku: laminateSku,
          coreMaterialSku: 'action-tesa-18mm-hdhmr-pro',
        });
        if (bay.loftHeightMm > 0) {
          units.push({
            instanceId: `${tag}-loft-${idx + 1}`,
            catalogModuleId: 'mod-wardrobe-loft',
            title: `Aligned Top Loft ${idx + 1} (${bay.widthMm}mm)`,
            zone: 'loft',
            xOffsetMm: cursorX,
            yElevationMm: bay.heightMm,
            widthMm: bay.widthMm,
            heightMm: bay.loftHeightMm,
            depthMm: bay.depthMm,
            shutterCount: bay.shutterCount,
            verifiedHardwareId: 'ebco-esoft-linear-hinge-3d-105',
            exteriorLaminateSku: 'greenlam-afx-9851-white-x',
            coreMaterialSku: 'action-tesa-18mm-hdhmr-pro',
          });
        }
        cursorX += bay.widthMm;
      });
      return units;
    };

    return [
      {
        optionId: 'option-a-balanced',
        title: 'Option A — Equal-Shutter Precision Run (50mm Scribing Fillers)',
        subtitle: fitA.summaryFormula,
        wallWidthMm,
        totalHeightMm: 2100,
        leftFillerMm: fitA.leftScribingFillerMm,
        rightFillerMm: fitA.rightScribingFillerMm,
        equalShutterSummary: `${fitA.equalShutterCount} × ${fitA.nominalShutterWidthMm}mm Shutters`,
        estimatedPriceInr: Math.round(wallWidthMm * 44),
        units: buildWardrobeUnits(fitA, 'merino-14149-rs-alameda-oak-dune', 'opt-a'),
      },
      {
        optionId: 'option-b-max-storage',
        title: 'Option B — Floor-to-Ceiling Equal-Shutter + Aligned Loft',
        subtitle: fitB.summaryFormula,
        wallWidthMm,
        totalHeightMm: wallHeightMm,
        leftFillerMm: fitB.leftScribingFillerMm,
        rightFillerMm: fitB.rightScribingFillerMm,
        equalShutterSummary: `${fitB.equalShutterCount} × ${fitB.nominalShutterWidthMm}mm + ${fitB.topLoftHeightMm}mm Loft`,
        estimatedPriceInr: Math.round(wallWidthMm * 56),
        units: buildWardrobeUnits(fitB, 'merino-14172-light-drift-oak', 'opt-b'),
      },
      {
        optionId: 'option-c-luxury-display',
        title: 'Option C — R120 Curved-Edge Open Display End + Equal Shutters',
        subtitle: fitC.summaryFormula,
        wallWidthMm,
        totalHeightMm: wallHeightMm,
        leftFillerMm: fitC.leftScribingFillerMm,
        rightFillerMm: fitC.rightScribingFillerMm,
        equalShutterSummary: `${fitC.equalShutterCount} × ${fitC.nominalShutterWidthMm}mm + 350mm Curved Display`,
        estimatedPriceInr: Math.round(wallWidthMm * 62),
        units: buildWardrobeUnits(fitC, 'merino-14101-ns-cinder-walnut', 'opt-c'),
      },
    ];
  }

  // Default Kitchen / Living / Pooja 3-option constrained run generator
  const usableRunMm = Math.max(1200, wallWidthMm - 100);
  const tallWidthMm = usableRunMm >= 2400 ? 600 : 0;
  const sinkWidthMm = 900;
  const drawerWidthMm = Math.min(900, Math.max(600, Math.floor((usableRunMm - tallWidthMm - sinkWidthMm) / 2)));
  const base2dWidthMm = Math.max(450, usableRunMm - tallWidthMm - sinkWidthMm - drawerWidthMm);

  return [
    {
      optionId: 'option-a-balanced',
      title: 'Option A — Ergonomic Work-Triangle Run (BWP Wet Zone + Tandem Hob)',
      subtitle: `${usableRunMm}mm Net Run + 2×50mm Scribing Fillers`,
      wallWidthMm,
      totalHeightMm: wallHeightMm,
      leftFillerMm: 50,
      rightFillerMm: 50,
      equalShutterSummary: 'Aligned Upper & Lower Stile Grid',
      estimatedPriceInr: Math.round(wallWidthMm * 58),
      units: [
        {
          instanceId: 'kit-a-sink',
          catalogModuleId: 'mod-kitchen-sink-2d',
          title: 'IS:710 BWP Sink Base 2-Door',
          zone: 'base',
          xOffsetMm: 50,
          yElevationMm: 0,
          widthMm: sinkWidthMm,
          heightMm: 850,
          depthMm: 600,
          shutterCount: 2,
          verifiedHardwareId: 'ebco-esoft-linear-hinge-3d-105',
          exteriorLaminateSku: 'merino-14149-rs-alameda-oak-dune',
          coreMaterialSku: 'centuryply-18mm-sainik-710-bwp',
        },
        {
          instanceId: 'kit-a-tandem',
          catalogModuleId: 'mod-kitchen-drawer-3',
          title: '3-Drawer Heavy Tandem Hob Base (Cutlery + Thali + Pot)',
          zone: 'base',
          xOffsetMm: 50 + sinkWidthMm,
          yElevationMm: 0,
          widthMm: drawerWidthMm,
          heightMm: 850,
          depthMm: 600,
          shutterCount: 3,
          verifiedHardwareId: 'blum-tandembox-antaro-500-65kg',
          exteriorLaminateSku: 'merino-14149-rs-alameda-oak-dune',
          coreMaterialSku: 'action-tesa-18mm-hdhmr-pro',
        },
        {
          instanceId: 'kit-a-base2d',
          catalogModuleId: 'mod-kitchen-base-2d',
          title: 'Prep Base 2-Door Cabinet',
          zone: 'base',
          xOffsetMm: 50 + sinkWidthMm + drawerWidthMm,
          yElevationMm: 0,
          widthMm: base2dWidthMm,
          heightMm: 850,
          depthMm: 600,
          shutterCount: 2,
          verifiedHardwareId: 'ebco-esoft-linear-hinge-3d-105',
          exteriorLaminateSku: 'merino-14149-rs-alameda-oak-dune',
          coreMaterialSku: 'action-tesa-18mm-hdhmr-pro',
        },
        {
          instanceId: 'kit-a-wall1',
          catalogModuleId: 'mod-kitchen-wall-2d',
          title: 'AVENTOS Bi-Fold Overhead Cabinet (w/ 18×8mm LED Groove)',
          zone: 'wall',
          xOffsetMm: 50,
          yElevationMm: 1450,
          widthMm: sinkWidthMm,
          heightMm: 700,
          depthMm: 350,
          shutterCount: 2,
          verifiedHardwareId: 'blum-aventos-hf-25',
          exteriorLaminateSku: 'greenlam-afx-9851-white-x',
          coreMaterialSku: 'action-tesa-18mm-hdhmr-pro',
        },
      ],
    },
    {
      optionId: 'option-b-max-storage',
      title: 'Option B — Full Tall Pantry + Dual Hettich Quadro V6 Drawer Banks',
      subtitle: `${usableRunMm}mm Net Run w/ 2100mm Tall Appliance & Larder Unit`,
      wallWidthMm,
      totalHeightMm: wallHeightMm,
      leftFillerMm: 50,
      rightFillerMm: 50,
      equalShutterSummary: '600mm Tall Pantry + Equal 450mm Shutter Rhythm',
      estimatedPriceInr: Math.round(wallWidthMm * 68),
      units: [
        {
          instanceId: 'kit-b-tall',
          catalogModuleId: 'mod-kitchen-tall-pantry',
          title: '600mm Tall Larder & Oven Tower',
          zone: 'tall',
          xOffsetMm: 50,
          yElevationMm: 0,
          widthMm: 600,
          heightMm: 2100,
          depthMm: 600,
          shutterCount: 2,
          verifiedHardwareId: 'hettich-sensys-8645i-110',
          exteriorLaminateSku: 'merino-14101-ns-cinder-walnut',
          coreMaterialSku: 'action-tesa-18mm-hdhmr-pro',
        },
        {
          instanceId: 'kit-b-sink',
          catalogModuleId: 'mod-kitchen-sink-2d',
          title: 'IS:710 BWP Wet Sink Base',
          zone: 'base',
          xOffsetMm: 650,
          yElevationMm: 0,
          widthMm: sinkWidthMm,
          heightMm: 850,
          depthMm: 600,
          shutterCount: 2,
          verifiedHardwareId: 'ebco-esoft-linear-hinge-3d-105',
          exteriorLaminateSku: 'merino-14101-ns-cinder-walnut',
          coreMaterialSku: 'centuryply-18mm-sainik-710-bwp',
        },
        {
          instanceId: 'kit-b-tandem',
          catalogModuleId: 'mod-kitchen-drawer-3',
          title: 'Quadro V6 Silent System 3-Drawer Bank',
          zone: 'base',
          xOffsetMm: 650 + sinkWidthMm,
          yElevationMm: 0,
          widthMm: Math.max(600, usableRunMm - 600 - sinkWidthMm),
          heightMm: 850,
          depthMm: 600,
          shutterCount: 3,
          verifiedHardwareId: 'hettich-quadro-v6-500-silent',
          exteriorLaminateSku: 'merino-14101-ns-cinder-walnut',
          coreMaterialSku: 'action-tesa-18mm-hdhmr-pro',
        },
      ],
    },
    {
      optionId: 'option-c-luxury-display',
      title: 'Option C — Handleless Gola Profile + Royale Touche Acrylic & Fluted Glass',
      subtitle: `${usableRunMm}mm Architectural Run w/ LeMans II Corner & COB Task Lighting`,
      wallWidthMm,
      totalHeightMm: wallHeightMm,
      leftFillerMm: 50,
      rightFillerMm: 50,
      equalShutterSummary: 'Handleless Ebco Gola J/C Extrusion +AVENTOS HF Upper',
      estimatedPriceInr: Math.round(wallWidthMm * 76),
      units: [
        {
          instanceId: 'kit-c-sink',
          catalogModuleId: 'mod-kitchen-sink-2d',
          title: 'Gola-Notched IS:710 BWP Sink Base',
          zone: 'base',
          xOffsetMm: 50,
          yElevationMm: 0,
          widthMm: sinkWidthMm,
          heightMm: 850,
          depthMm: 600,
          shutterCount: 2,
          verifiedHardwareId: 'ebco-gola-profile-j-c-set',
          exteriorLaminateSku: 'royale-touche-crystal-1181-ivory-acrylic',
          coreMaterialSku: 'centuryply-18mm-sainik-710-bwp',
        },
        {
          instanceId: 'kit-c-tandem',
          catalogModuleId: 'mod-kitchen-drawer-3',
          title: 'Actro 5D 70kg Heavy Pot Drawer Bank',
          zone: 'base',
          xOffsetMm: 50 + sinkWidthMm,
          yElevationMm: 0,
          widthMm: Math.max(600, usableRunMm - sinkWidthMm),
          heightMm: 850,
          depthMm: 600,
          shutterCount: 3,
          verifiedHardwareId: 'hettich-actro-5d-550-70kg',
          exteriorLaminateSku: 'royale-touche-crystal-1181-ivory-acrylic',
          coreMaterialSku: 'action-tesa-18mm-hdhmr-pro',
        },
      ],
    },
  ];
}
