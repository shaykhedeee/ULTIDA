import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateRules, scoreCandidateLayout, type CandidateLayout } from '../src/index.js';

test('Floating TV unit floor clearance rule flags elevations below 200 mm', () => {
  const invalidLayout: CandidateLayout = {
    id: 'layout-tv-invalid',
    modules: [{
      id: 'tv-1',
      templateId: 'tpl-tv-floating',
      category: 'tv-unit',
      mounting: 'floating',
      position: { xMm: 100, yMm: 0, elevationMm: 100 }, // invalid 100 mm < 200 mm
      dimensions: { widthMm: 1800, depthMm: 400, heightMm: 450 }
    }]
  };

  const violations = evaluateRules(invalidLayout);
  assert.ok(violations.some((v) => v.code === 'COMPANY_FLOATING_TV_FLOOR_GAP'));
  const score = scoreCandidateLayout(invalidLayout);
  assert.equal(score.passed, false);
  assert.ok(score.hardViolationsCount >= 1);
});

test('Valid Floating TV unit elevation passes clearance rule', () => {
  const validLayout: CandidateLayout = {
    id: 'layout-tv-valid',
    modules: [{
      id: 'tv-1',
      templateId: 'tpl-tv-floating',
      category: 'tv-unit',
      mounting: 'floating',
      position: { xMm: 100, yMm: 0, elevationMm: 200 }, // valid 200 mm
      dimensions: { widthMm: 1800, depthMm: 400, heightMm: 450 }
    }]
  };

  const violations = evaluateRules(validLayout);
  assert.equal(violations.some((v) => v.code === 'COMPANY_FLOATING_TV_FLOOR_GAP'), false);
  const score = scoreCandidateLayout(validLayout);
  assert.equal(score.passed, true);
});

test('Study desk legroom clearance flags low surface elevation', () => {
  const invalidStudy: CandidateLayout = {
    id: 'layout-study-invalid',
    modules: [{
      id: 'study-1',
      templateId: 'tpl-study-desk',
      category: 'study-unit',
      position: { xMm: 0, yMm: 0, elevationMm: 0 },
      dimensions: { widthMm: 1200, depthMm: 600, heightMm: 650 } // underClearance = 550 mm < 650 mm
    }]
  };

  const violations = evaluateRules(invalidStudy);
  assert.ok(violations.some((v) => v.code === 'STUDY_LEG_ROOM_MIN'));
});

test('Crockery unit glass door span limit flags door width > 450 mm', () => {
  const invalidCrockery: CandidateLayout = {
    id: 'layout-crockery-invalid',
    modules: [{
      id: 'crockery-1',
      templateId: 'tpl-crockery-wall',
      category: 'crockery-unit',
      shutterType: 'glass',
      shutterCount: 1,
      position: { xMm: 0, yMm: 0, elevationMm: 900 },
      dimensions: { widthMm: 600, depthMm: 350, heightMm: 1200 } // 600 / 1 = 600 mm > 450 mm
    }]
  };

  const violations = evaluateRules(invalidCrockery);
  assert.ok(violations.some((v) => v.code === 'CROCKERY_GLASS_SHUTTER_SPAN'));
});

test('Module 3D spatial collision detects overlapping module bounding boxes', () => {
  const collidingLayout: CandidateLayout = {
    id: 'layout-collision',
    modules: [
      {
        id: 'mod-1',
        templateId: 'tpl-1',
        category: 'storage',
        position: { xMm: 100, yMm: 0, elevationMm: 0 },
        dimensions: { widthMm: 800, depthMm: 400, heightMm: 800 }
      },
      {
        id: 'mod-2',
        templateId: 'tpl-2',
        category: 'storage',
        position: { xMm: 500, yMm: 0, elevationMm: 200 }, // overlaps x: 500-1300 vs 100-900 & elevation: 200-1000 vs 0-800
        dimensions: { widthMm: 800, depthMm: 400, heightMm: 800 }
      }
    ]
  };

  const violations = evaluateRules(collidingLayout);
  assert.ok(violations.some((v) => v.code === 'MODULE_COLLISION'));
});
