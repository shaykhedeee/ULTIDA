export type CalibrationPoint = { x: number; y: number };
export type CalibrationWall = { id:string; label:string; status:string; geometry:{x1?:number;y1?:number;x2?:number;y2?:number} };
export type ScaleCrossCheck = { measuredPixels:number; predictedMm:number; discrepancyPct:number; state:'consistent'|'advisory'|'conflict'|'invalid' };
/** Independent measurement is designer-entered. This only compares two pieces of evidence; it does not approve a drawing. */
export function calculateScaleCrossCheck(wall:CalibrationWall,mmPerPixel:number,knownMm:number):ScaleCrossCheck {
  const g=wall.geometry;
  const coords=[g.x1,g.y1,g.x2,g.y2];
  const valid=coords.every(n=>typeof n==='number'&&Number.isFinite(n))&&Number.isFinite(mmPerPixel)&&mmPerPixel>0&&Number.isFinite(knownMm)&&knownMm>0;
  const measuredPixels=valid?Math.hypot(g.x2!-g.x1!,g.y2!-g.y1!):0;
  if(!valid||measuredPixels<2) return {measuredPixels,predictedMm:0,discrepancyPct:0,state:'invalid'};
  const predictedMm=measuredPixels*mmPerPixel;
  const discrepancyPct=100*Math.abs(predictedMm-knownMm)/knownMm;
  return {measuredPixels,predictedMm,discrepancyPct,state:discrepancyPct>=5?'conflict':discrepancyPct>=2?'advisory':'consistent'};
}
