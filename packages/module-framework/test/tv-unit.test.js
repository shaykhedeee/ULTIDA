import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileTvUnit } from '../src/tv-unit-compiler.js';
test('compileTvUnit compiles modular parts with finger-groove gaps and profile lighting', () => {
    const result = compileTvUnit({
        templateVersionId: 'tpl-tv-v1',
        instanceId: 'test-tv-1',
        parameters: {
            totalWidthMm: 1800,
            totalDepthMm: 450,
            totalHeightMm: 600,
            shutterCount: 3,
            fingerGrooveGapMm: 20
        },
        wall: { widthMm: 3000, heightMm: 2700, depthMm: 150 }
    });
    assert.strictEqual(result.valid, true);
    assert.ok(result.parts.length >= 6); // Bottom, Top, Back, 3 Shutters, LED profile
    const shutters = result.parts.filter(p => p.meta.semanticType === 'shutter');
    assert.strictEqual(shutters.length, 3);
    // Each shutter width = (1800 - 2*20) / 3 = 1760 / 3 = 586.66mm
    const shutterWidth = shutters[0].size.widthMm;
    assert.strictEqual(Math.round(shutterWidth), 587);
    const led = result.parts.find(p => p.meta.semanticType === 'lighting_channel');
    assert.ok(led);
    assert.strictEqual(led.size.widthMm, 1800);
});
