import { describe, expect, it } from 'vitest';

import { resolveCastTargetIds } from '../../src/app/cast-targeting';

describe('resolveCastTargetIds', () => {
  const runtime = {
    playerPosition: { x: 0, z: 0 },
    currentTarget: { id: 'current-target' },
    queryAliveEnemies: () => ['current-target', 'area-target'],
  };

  it('keeps the current target for mixed target and area effects even when area has no radius', () => {
    expect(resolveCastTargetIds(runtime, [
      { target: 'target' },
      { target: 'area', tags: ['spread-target-count:2'] },
    ])).toEqual(['current-target']);
  });

  it('adds only explicit finite-area targets and removes duplicates', () => {
    expect(resolveCastTargetIds(runtime, [
      { target: 'target' },
      { target: 'area', tags: ['radius:5'] },
    ])).toEqual(['current-target', 'area-target']);
  });

  it('does not turn a pure area effect with no declared radius into a full-map cast', () => {
    expect(resolveCastTargetIds(runtime, [{ target: 'area' }])).toEqual([]);
  });

  it('uses finite circles for field/smoke and a forward cone for front-radius', () => {
    const queries: unknown[] = [];
    const spatialRuntime = { ...runtime, playerFacingRadians: 1.2, queryAliveEnemies: (query: unknown) => { queries.push(query); return ['area-target']; } };
    expect(resolveCastTargetIds(spatialRuntime, [{ target: 'area', tags: ['field-radius:6'] }, { target: 'area', tags: ['smoke-radius:9'] }, { target: 'area', tags: ['front-radius:5'] }])).toEqual(['area-target']);
    expect(queries).toContainEqual({ shape: 'circle', center: { x: 0, z: 0 }, radius: 9 });
    expect(queries).toContainEqual({ shape: 'cone', origin: { x: 0, z: 0 }, directionRadians: 1.2, radius: 5, halfAngleRadians: Math.PI / 3 });
  });
});
