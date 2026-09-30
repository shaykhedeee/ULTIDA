export type CncPanelHole = { id: string; x: number; y: number; diameter: number; depth: number };
export type CncPanelGroove = { id: string; x1: number; y1: number; x2: number; y2: number; width: number; depth: number };

export function clipCncLineToPanel(x1: number, y1: number, x2: number, y2: number, widthMm: number, lengthMm: number): [number, number, number, number] | null {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let low = 0;
  let high = 1;
  const bounds: Array<[number, number]> = [[-dx, x1], [dx, widthMm - x1], [-dy, y1], [dy, lengthMm - y1]];
  for (const [p, q] of bounds) {
    if (p === 0) { if (q < 0) return null; continue; }
    const t = q / p;
    if (p < 0) low = Math.max(low, t);
    else high = Math.min(high, t);
    if (low > high) return null;
  }
  return [x1 + low * dx, y1 + low * dy, x1 + high * dx, y1 + high * dy];
}

export function validateCncPanelOperations(
  panel: { widthMm: number; lengthMm: number; thicknessMm: number },
  operations: { holes: CncPanelHole[]; grooves: CncPanelGroove[] },
): string[] {
  const issues: string[] = [];
  const { widthMm, lengthMm, thicknessMm } = panel;
  if (!Number.isFinite(widthMm) || widthMm < 100 || widthMm > 6000) issues.push('Panel width must be between 100 and 6,000 mm.');
  if (!Number.isFinite(lengthMm) || lengthMm < 100 || lengthMm > 6000) issues.push('Panel length must be between 100 and 6,000 mm.');
  if (!Number.isFinite(thicknessMm) || thicknessMm < 6 || thicknessMm > 60) issues.push('Board thickness must be between 6 and 60 mm.');
  for (const hole of operations.holes) {
    const radius = hole.diameter / 2;
    if (![hole.x, hole.y, hole.diameter, hole.depth].every(Number.isFinite) || hole.diameter <= 0 || hole.depth <= 0) {
      issues.push(`${hole.id}: drill diameter, depth, and position must be positive measured values.`);
      continue;
    }
    if (hole.x - radius < 0 || hole.x + radius > widthMm || hole.y - radius < 0 || hole.y + radius > lengthMm) {
      issues.push(`${hole.id}: Ø${hole.diameter} mm drill is outside the ${widthMm} × ${lengthMm} mm panel.`);
    }
    if (hole.depth > thicknessMm) issues.push(`${hole.id}: ${hole.depth} mm drilling depth exceeds the ${thicknessMm} mm board thickness.`);
  }
  for (const groove of operations.grooves) {
    if (![groove.x1, groove.y1, groove.x2, groove.y2, groove.width, groove.depth].every(Number.isFinite) || groove.width <= 0 || groove.depth <= 0) {
      issues.push(`${groove.id}: groove dimensions and coordinates must be positive finite values.`);
      continue;
    }
    const half = groove.width / 2;
    if (Math.min(groove.x1, groove.x2) - half < 0 || Math.max(groove.x1, groove.x2) + half > widthMm
      || Math.min(groove.y1, groove.y2) - half < 0 || Math.max(groove.y1, groove.y2) + half > lengthMm) {
      issues.push(`${groove.id}: groove tool path leaves the panel edge.`);
    }
    if (groove.depth > thicknessMm) issues.push(`${groove.id}: ${groove.depth} mm groove depth exceeds the ${thicknessMm} mm board thickness.`);
  }
  return [...new Set(issues)];
}

export function jaaliInputIssues(input: { widthMm: number; heightMm: number; spacingMm: number; toolDiameterMm: number; materialThicknessMm: number; minimumBridgeMm: number; pattern: string }): string[] {
  const issues: string[] = [];
  const { widthMm, heightMm, spacingMm, toolDiameterMm, materialThicknessMm, minimumBridgeMm } = input;
  if (![widthMm, heightMm].every((value) => Number.isFinite(value) && value >= 100 && value <= 3000)) issues.push('Jaali panel width and height must be between 100 and 3,000 mm.');
  if (!Number.isFinite(spacingMm) || spacingMm < 30 || spacingMm > Math.min(widthMm, heightMm)) issues.push('Pattern pitch must be at least 30 mm and fit inside the panel.');
  if (!Number.isFinite(toolDiameterMm) || toolDiameterMm <= 0 || toolDiameterMm > 30) issues.push('Enter a valid router tool diameter.');
  if (!Number.isFinite(materialThicknessMm) || materialThicknessMm < 3 || materialThicknessMm > 60) issues.push('Enter a valid stock thickness from 3 to 60 mm.');
  if (!Number.isFinite(minimumBridgeMm) || minimumBridgeMm < 1 || minimumBridgeMm > 100) issues.push('Minimum material bridge must be between 1 and 100 mm.');
  if (input.pattern === 'circle' && Number.isFinite(spacingMm) && Number.isFinite(toolDiameterMm)) {
    const holeRadius = Math.max(8, spacingMm * 0.28);
    const remainingWeb = spacingMm - 2 * holeRadius - toolDiameterMm;
    if (remainingWeb < minimumBridgeMm) issues.push(`Circle pattern leaves only ${Math.max(0, remainingWeb).toFixed(1)} mm between tool paths; increase pitch or reduce the tool diameter to meet the ${minimumBridgeMm} mm bridge target.`);
  }
  return issues;
}
