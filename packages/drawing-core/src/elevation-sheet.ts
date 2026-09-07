export type DimensionChainV1 = { axis: 'horizontal' | 'vertical'; originMm: number; segmentsMm: number[]; overallMm: number; label?: string };

export function buildDimensionChain(axis: DimensionChainV1['axis'], segmentsMm: number[], originMm = 0, label?: string): DimensionChainV1 {
  if (!segmentsMm.length || segmentsMm.some((value) => !Number.isFinite(value) || value <= 0)) throw new Error('Dimension chains require positive finite segments.');
  const overallMm = segmentsMm.reduce((sum, value) => sum + value, 0);
  return { axis, originMm, segmentsMm: [...segmentsMm], overallMm, label };
}

export type ElevationViewKindV1 = 'external' | 'internal' | 'top' | 'section';
export type ElevationElementV1 = {
  id: string;
  kind: 'wall' | 'loft' | 'shutter' | 'sliding-shutter' | 'open-unit' | 'drawer' | 'hanger-space' | 'shelf' | 'skirting' | 'filler' | 'profile-glass' | 'light' | 'appliance' | 'countertop';
  xMm: number; yMm: number; widthMm: number; heightMm: number;
  label?: string; materialSlot?: string; quantity?: number;
};
export type ElevationSheetSpecV1 = {
  schema: 'elevation.sheet.v1'; view: ElevationViewKindV1; title: string; units: 'mm';
  overallWidthMm: number; overallHeightMm: number; horizontalChain: DimensionChainV1; verticalChain: DimensionChainV1;
  elements: ElevationElementV1[]; sourceSceneVersionId: string; warnings: string[];
};

export function validateElevationSheet(spec: ElevationSheetSpecV1) {
  const issues: string[] = [];
  if (spec.horizontalChain.overallMm !== spec.overallWidthMm) issues.push('Horizontal dimension chain does not equal overall width.');
  if (spec.verticalChain.overallMm !== spec.overallHeightMm) issues.push('Vertical dimension chain does not equal overall height.');
  for (const element of spec.elements) {
    if (![element.xMm, element.yMm, element.widthMm, element.heightMm].every(Number.isFinite) || element.widthMm <= 0 || element.heightMm <= 0) issues.push(`Element ${element.id} has invalid geometry.`);
    if (element.xMm < 0 || element.yMm < 0 || element.xMm + element.widthMm > spec.overallWidthMm || element.yMm + element.heightMm > spec.overallHeightMm) issues.push(`Element ${element.id} exceeds the elevation boundary.`);
    if (element.kind === 'profile-glass' && !element.materialSlot) issues.push(`Profile-glass element ${element.id} requires a material slot.`);
  }
  return { valid: issues.length === 0, issues };
}
