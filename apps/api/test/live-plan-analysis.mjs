import { config } from 'dotenv';
config();
import { readFile } from 'node:fs/promises';
import { analyzePlanFile } from '../src/plan-analysis-service.js';

const imgPath = 'floorplan analyser/ultida-flow-kit/proof/test_floorplan_input.png';
const buffer = await readFile(imgPath);
const dataUrl = `data:image/png;base64,${buffer.toString('base64')}`;

console.log('=== LIVE PLAN ANALYSIS INTEGRATION TEST ===');
console.log('Image bytes:', buffer.length);
console.log('Input hash (first 16):', Buffer.from(buffer).toString('hex').slice(0, 32));

try {
  const result = await analyzePlanFile({
    projectId: '11111111-1111-1111-1111-111111111111',
    organizationId: '00000000-0000-0000-0000-000000000000',
    fileName: 'test_floorplan_input.png',
    mimeType: 'image/png',
    buffer,
    accessToken: '',
  });

  console.log('\n=== RESULT ===');
  console.log('provider:', result.provider);
  console.log('model:', result.model);
  console.log('latencyMs:', result.latencyMs);
  console.log('usage:', JSON.stringify(result.usage));
  console.log('inputSha256:', result.inputSha256);
  console.log('previewSha256:', result.previewSha256);
  console.log('deterministic.lineWallCount:', result.deterministic.lineWallCount);
  console.log('deterministic.openingCount:', result.deterministic.openingCount);
  console.log('deterministic.ocrText (first 120):', JSON.stringify(result.deterministic.ocrText.slice(0, 120)));
  console.log('elements:', result.elements.length);
  console.log('  walls:', result.elements.filter((e) => e.kind === 'wall').length);
  console.log('  rooms:', result.elements.filter((e) => e.kind === 'room').length);
  console.log('  doors:', result.elements.filter((e) => e.kind === 'door').length);
  console.log('  windows:', result.elements.filter((e) => e.kind === 'window').length);
  console.log('  dimensions:', result.elements.filter((e) => e.kind === 'dimension').length);
  console.log('  mixed-source elements:', result.elements.filter((e) => e.source === 'mixed').length);
  console.log('issues:', result.issues.length);
  console.log('responseValidated.documentType:', result.responseValidated.documentType);
  console.log('responseValidated.unitSuggestion:', result.responseValidated.unitSuggestion);
  console.log('previewDataUrl length:', result.previewDataUrl.length);
  console.log('\n=== PROOF: real image submitted to', result.provider, '/', result.model, '===');
} catch (err) {
  console.error('ANALYSIS_ERROR:', err.code || '', err.message);
  process.exitCode = 1;
}
