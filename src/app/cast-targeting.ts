import type { EffectDefinition } from '../config';
import type { RuntimePosition } from '../game';

interface CastTargetingRuntime {
  playerPosition: RuntimePosition;
  playerFacingRadians?: number;
  currentTarget?: { id: string };
  queryAliveEnemies: (query: { shape: 'circle'; center: RuntimePosition; radius: number } | { shape: 'cone'; origin: RuntimePosition; directionRadians: number; radius: number; halfAngleRadians: number }) => string[];
}

/** Merges explicitly-targeted and explicitly-ranged area targets without skill identity branches. */
export function resolveCastTargetIds(runtime: CastTargetingRuntime, effects: ReadonlyArray<Pick<EffectDefinition, 'target' | 'tags'>>): string[] {
  const targetIds = new Set<string>();
  if (effects.some((effect) => effect.target === 'target') && runtime.currentTarget) targetIds.add(runtime.currentTarget.id);

  const radius = effects
    .filter((effect) => effect.target === 'area')
    .flatMap((effect) => effect.tags ?? [])
    .map((tag) => /^(?:radius|field-radius|smoke-radius):(\d+(?:\.\d+)?)$/.exec(tag)?.[1])
    .filter((value): value is string => value !== undefined)
    .map(Number)
    .filter((value) => Number.isFinite(value) && value > 0)
    .reduce((maximum, value) => Math.max(maximum, value), 0);

  if (radius > 0) runtime.queryAliveEnemies({ shape: 'circle', center: runtime.playerPosition, radius }).forEach((targetId) => targetIds.add(targetId));
  const frontRadius = effects.filter((effect) => effect.target === 'area').flatMap((effect) => effect.tags ?? [])
    .map((tag) => /^front-radius:(\d+(?:\.\d+)?)$/.exec(tag)?.[1]).find((value): value is string => value !== undefined);
  if (frontRadius && runtime.playerFacingRadians !== undefined) runtime.queryAliveEnemies({ shape: 'cone', origin: runtime.playerPosition, directionRadians: runtime.playerFacingRadians, radius: Number(frontRadius), halfAngleRadians: Math.PI / 3 }).forEach((targetId) => targetIds.add(targetId));
  return [...targetIds];
}
