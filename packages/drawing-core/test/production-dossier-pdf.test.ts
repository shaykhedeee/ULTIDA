import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import {
  generateProductionDossierPdf,
  type ProductionDossierSpecV1,
} from '../src/production-dossier-pdf.ts';

test('generateProductionDossierPdf generates an authoritative multi-sheet architectural manufacturing dossier', async () => {
  const spec: ProductionDossierSpecV1 = {
    schema: 'production.dossier.v1',
    project: {
      name: 'SHARMA LUXURY RESIDENCE (3BHK)',
      clientName: 'MR. ROHIT & MRS. ANANYA SHARMA',
      location: 'Pali Hill, Bandra West, Mumbai 400050',
      phone: '+91 98201 44521 / +91 98203 11842',
      designerName: 'MUSKAN PAREEK',
      factoryManager: 'VIKRAM SINGH',
      date: '2026-09-07',
      revision: 'REV-02 (APPROVED)',
      status: 'approved',
    },
    brief: {
      lifestyleBrief: 'Modern Warm Minimalist luxury residence with 600mm lofts and warm 3000K LED lighting.',
      roomsScope: [
        { name: 'Modular Kitchen & Utility Suite', areaSqm: 14.8, areaSqFt: 159.3, modulesCount: 6, scopeSummary: 'L-Shaped Counter + Breakfast Island' },
        { name: 'Master Bedroom Suite', areaSqm: 24.5, areaSqFt: 263.7, modulesCount: 5, scopeSummary: '4-Door Wardrobe + Integrated Bay Seating' },
      ],
      appliances: [
        { name: 'Kitchen Hob', brand: 'Bosch', model: 'Serie 6 4-Burner', dimensionsMm: '780x510mm', status: 'client_provided' },
        { name: 'Kitchen Chimney', brand: 'Faber', model: 'Primus Plus 90cm', dimensionsMm: '900x500mm', status: 'studio_supplied' },
      ],
    },
    elevations: [], // Defaults will generate kitchen, master-bed, and living/dining
  };

  const stream = new PassThrough();
  const chunks: Buffer[] = [];
  stream.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));

  const completed = new Promise<void>((resolve, reject) => {
    stream.on('end', resolve);
    stream.on('error', reject);
  });

  generateProductionDossierPdf(spec, stream);
  await completed;

  const pdfBuffer = Buffer.concat(chunks);
  assert.ok(pdfBuffer.length > 30000, `PDF buffer length should exceed 30KB, got ${pdfBuffer.length}`);

  const pdfText = pdfBuffer.toString('utf-8');
  assert.ok(pdfText.startsWith('%PDF-1.4'), 'PDF header must be %PDF-1.4');
  assert.ok(pdfText.includes('%%EOF'), 'PDF must terminate with %%EOF');

  // Verify Mandatory Sheets
  assert.ok(pdfText.includes('DWG-001'), 'Must include Sheet 1: Cover Sheet & Approvals');
  assert.ok(pdfText.includes('DWG-002'), 'Must include Sheet 2: Design Brief');
  assert.ok(pdfText.includes('DWG-003'), 'Must include Sheet 3: Key Plan & Floor Plan');
  assert.ok(pdfText.includes('DWG-004'), 'Must include Sheet 4: Master Finishes Matrix');
  assert.ok(pdfText.includes('DWG-005'), 'Must include Sheet 5: Kitchen Elevation & Joinery');
  assert.ok(pdfText.includes('DWG-006'), 'Must include Sheet 6: Master Bed Elevation & Joinery');
  assert.ok(pdfText.includes('DWG-008'), 'Must include Sheet 8: Production BOM & Nesting');
  assert.ok(pdfText.includes('DWG-009'), 'Must include Sheet 9: Commercial BOQ');
  assert.ok(pdfText.includes('DWG-010'), 'Must include Sheet 10: 10-Point Site Checklist & Handover');

  // Verify Credentials & Content
  assert.ok(pdfText.includes('SHARMA LUXURY RESIDENCE'), 'Must contain project name');
  assert.ok(pdfText.includes('MR. ROHIT'), 'Must contain client name');
  assert.ok(pdfText.includes('MUSKAN PAREEK'), 'Must contain designer name');
  assert.ok(pdfText.includes('VIKRAM SINGH'), 'Must contain factory production manager');
  assert.ok(pdfText.includes('SYSTEM 32 JOINERY'), 'Must enforce System 32 joinery standard');
  assert.ok(pdfText.includes('IS 710'), 'Must cite IS 710 Marine standard');
});
