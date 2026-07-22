import { CanonicalPlanModelSchema } from './dist/plan-schema.js';
const approved = {
  schemaVersion: 'plan.v1',
  source: {
    schemaVersion: 'plan.v1', sourceAssetId: '00000000-0000-0000-0000-000000000001',
    sourceType: 'raster_image', sourceWidth: 1000, sourceHeight: 800, sourceRotation: 0,
    coordinateSystem: 'millimetres', scaleResolution: 'two_point_calibration',
    verifiedDimensionMm: 3800, scaleObservations: [], mmPerPixel: 5.84, scaleObservedMm: 3800
  },
  state: 'approved', ceilingHeightMm: 2700,
  spaces: [{ id:'s', sourcePolygon:[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}], worldPolygon:[{xMm:0,yMm:0},{xMm:1,yMm:0},{xMm:1,yMm:1},{xMm:0,yMm:1}], roomType:'living', wallRefs:[], openingRefs:[], verification:'verified' }],
  walls: [{ id:'w1', sourceStart:{x:0,y:0}, sourceEnd:{x:1,y:0}, worldStart:{xMm:0,yMm:0}, worldEnd:{xMm:1,yMm:0}, thicknessMm:150, heightMm:2700, interiorNormal:{x:0,y:-1}, adjacentSpaces:[], wallType:'load_bearing', verification:'verified', confidence:1 }],
  openings: [], columns: [], beams: [], servicePoints: [], annotations: [],
  issues: [], assumptions: [], validation: { isValid:true, blockingIssueCount:0, issues:[], ruleVersion:'1' },
  approval: { approvedBy:'u1', approvedAt: new Date().toISOString(), changeReason:'x' }
};
const result = CanonicalPlanModelSchema.safeParse(approved);
console.log('success', result.success);
if (!result.success) console.log(JSON.stringify(result.error.issues.map(i => ({path:i.path, msg:i.message})), null, 2));
