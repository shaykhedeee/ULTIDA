import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateJaaliDxf,
  JAALI_PATTERNS,
  type JaaliPattern,
} from '../src/features/tools/jaali-motifs';

describe('CNC Jaali & Sacred Pooja Motifs DXF Generator', () => {
  const patterns: JaaliPattern[] = [
    'ganesha',
    'bells',
    'om',
    'lotus',
    'moroccan_star',
    'chevron',
    'diamond',
    'arch',
    'circle',
    'floral',
  ];

  for (const pattern of patterns) {
    it(`generates valid AutoCAD DXF for pattern: ${pattern}`, () => {
      const width = 600;
      const height = 1200;
      const spacing = JAALI_PATTERNS[pattern].recommendedSpacingMm;
      const dxf = generateJaaliDxf(pattern, width, height, spacing, 6);

      // Verify basic DXF structure
      assert.ok(dxf.includes('SECTION\n2\nHEADER'), 'Must have DXF HEADER section');
      assert.ok(dxf.includes('9\n$INSUNITS\n70\n4'), 'Must set INSUNITS to 4 (millimetres)');
      assert.ok(dxf.includes('SECTION\n2\nTABLES'), 'Must have TABLES section with layers');
      assert.ok(dxf.includes('SECTION\n2\nENTITIES'), 'Must have ENTITIES section');
      assert.ok(dxf.includes('0\nEOF'), 'Must end with EOF marker');
      assert.ok(dxf.includes('A-OUTLINE-BORDER'), 'Must have panel perimeter boundary');

      // Pattern-specific verifications
      if (pattern === 'ganesha') {
        assert.ok(dxf.includes('A-CUT-GANESHA'), 'Must include Ganesha silhouette cutpaths');
        assert.ok(dxf.includes('A-CUT-SANCTUM'), 'Must include Sanctum arch frame');
      } else if (pattern === 'bells') {
        assert.ok(dxf.includes('A-CUT-BELL'), 'Must include bell geometry');
        assert.ok(dxf.includes('A-CUT-CHAIN'), 'Must include hanging link chains');
      } else if (pattern === 'lotus') {
        assert.ok(dxf.includes('A-CUT-LOTUS'), 'Must include lotus petal cutpaths');
      } else if (pattern === 'moroccan_star') {
        assert.ok(dxf.includes('A-CUT-STAR'), 'Must include 8-point geometric star vertices');
      } else if (pattern === 'chevron') {
        assert.ok(dxf.includes('A-CUT-CHEVRON'), 'Must include V-groove chevron toolpaths');
      } else if (pattern === 'om') {
        assert.ok(dxf.includes('A-CUT-OM'), 'Must include sacred Om toolpaths');
      }
    });
  }
});
