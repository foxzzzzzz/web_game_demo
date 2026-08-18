import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../src/config';
import { consumeDetonatedStatuses, createInitialGameState, createRun, getContinuousDamage, resolveConditionalTargetEffects } from '../../src/domain';

describe('Phase 1 conditional effect resolution', () => {
  it('requires configured statuses and resolves then consumes paralysis detonation stacks', () => {
    const rootRequired = gameConfig.skills.find((skill) => skill.id === 'strength-force-burst')!.effects;
    expect(resolveConditionalTargetEffects(rootRequired, [])).toEqual([]);
    expect(resolveConditionalTargetEffects(rootRequired, [{ statusId: 'root', stacks: 1, remainingMs: 4000 }], { health: 50, maxHealth: 100 }).find((effect) => effect.type === 'damage')?.magnitude).toBe(224);

    const detonation = gameConfig.skills.find((skill) => skill.id === 'venom-neuro-alpha-4')!.effects;
    const statuses = [{ statusId: 'paralysis', stacks: 10, remainingMs: 6000 }];
    const resolved = resolveConditionalTargetEffects(detonation, statuses);
    expect(resolved.find((effect) => effect.type === 'damage')?.magnitude).toBe(140);
    expect(consumeDetonatedStatuses(statuses, resolved)).toEqual([]);
  });

  it('calculates configured per-second squeeze damage for the full duration', () => {
    const run = createRun(createInitialGameState(), gameConfig, 'strength', 'strength-ferocious');
    expect(run.phase).toBe('active');
    const dot = gameConfig.skills.find((skill) => skill.id === 'strength-lock-coil')!.effects.find((effect) => effect.tags?.includes('per-second'))!;
    expect(getContinuousDamage(dot, 4000)).toBe(208);
  });

  it('applies context-gated this-attack damage bonuses without skill IDs', () => {
    const effects = [
      { type: 'damage' as const, target: 'target' as const, magnitude: 100, tags: ['requires:back-attack'] },
      { type: 'buff' as const, target: 'self' as const, magnitude: 0.6, tags: ['requires:back-attack', 'this-attack-damage-bonus'] },
    ];
    expect(resolveConditionalTargetEffects(effects, [], undefined, { tags: [] })).toEqual([]);
    expect(resolveConditionalTargetEffects(effects, [], undefined, { tags: ['back-attack'] }).find((effect) => effect.type === 'damage')?.magnitude).toBe(160);
  });
});
