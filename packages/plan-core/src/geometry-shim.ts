/**
 * Re-export the canonical shared geometry package (@ultida/geometry-core) from
 * plan-core under a namespace, so downstream code has a single import surface
 * and there is no symbol collision with plan-core's own coordinate-system /
 * scale-engine modules.
 */
export * as geometryCore from '@ultida/geometry-core';
