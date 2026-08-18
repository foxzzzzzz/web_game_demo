import { describe, expect, it } from 'vitest';
import { gameConfig, numericMechanicBaselines } from '../../src/config';
import {
  applyEnemyResolvedEffects,
  createInitialGameState,
  createRun,
  gainReward,
  getEffectTargetingBehavior,
  getThresholdControlChance,
  resolveEffectEvent,
  resolveSkillEffects,
  tick,
} from '../../src/domain';

describe('numeric and charge mechanic family', () => {
  it('uses centralized baselines for otherwise unquantified numeric mechanics', () => {
    expect(gameConfig.passives.find((entry) => entry.id === 'venom-muscle-gamma-passive')!.effects[0].magnitude).toBe(numericMechanicBaselines.effectStrength);
    expect(gameConfig.skills.find((entry) => entry.id === 'venom-kidney-x-3')!.effects[0].magnitude).toBe(numericMechanicBaselines.chargeRateIncrease);
    expect(gameConfig.skills.find((entry) => entry.id === 'venom-necrosis-alpha-4')!.effects.find((effect) => effect.tags?.includes('damage-amplified-by-defense-loss'))!.magnitude).toBe(numericMechanicBaselines.damageAmplifiedByDefenseLoss);
  });

  it('applies heal-over-time passive and effect-strength through skill/status resolution', () => {
    let regeneration = createRun(createInitialGameState(), gameConfig, 'size', 'size-regeneration');
    regeneration = gainReward(regeneration, gameConfig, { characterXp: 2_000, skillXp: 0 });
    expect(resolveSkillEffects(regeneration, gameConfig, 'size-wound-surge', ['target']).find((effect) => effect.type === 'heal')?.magnitude).toBe(29);

    const gamma = {
      ...createInitialGameState(), phase: 'active' as const, originId: 'venom' as const, activeSubtypeId: 'venom-muscle-gamma', unlockedBranchIds: ['venom-muscle'], unlockedSubtypeIds: ['venom-muscle-gamma'],
    };
    const next = applyEnemyResolvedEffects(gamma, gameConfig, 'target', false, [{ type: 'status', target: 'target', targetIds: ['target'], statusId: 'weakness', stacks: 1, magnitude: 0.2, tags: ['move-speed-reduction'] }]);
    expect(next.enemyStatuses.target.statuses[0]).toMatchObject({ magnitude: 0.25 });
  });

  it('resolves defense-loss, detonation and enemy-skill-cast charge events without skill IDs', () => {
    const generic = createInitialGameState();
    const defenseResult = resolveEffectEvent(generic, gameConfig, [
      { type: 'damage', target: 'target', magnitude: 100 },
      { type: 'trigger', target: 'target', magnitude: numericMechanicBaselines.damageAmplifiedByDefenseLoss, tags: ['damage-amplified-by-defense-loss'] },
    ], { kind: 'target-damage', targetIds: ['target'], targetStatuses: [{ statusId: 'ulceration', stacks: 1, remainingMs: 5_000, magnitude: 0.18, tags: ['physical-defense-reduction'] }] });
    expect(defenseResult.effects.find((effect) => effect.type === 'damage')?.magnitude).toBe(104);

    const detonationResult = resolveEffectEvent(generic, gameConfig, [{ type: 'damage', target: 'target', magnitude: 100, tags: ['detonate'] }], {
      kind: 'target-damage', targetIds: ['target'], targetStatuses: [{ statusId: 'lesion-mark', stacks: 1, remainingMs: 5_000, magnitude: numericMechanicBaselines.detonationBonus, tags: ['detonation-bonus'] }],
    });
    expect(detonationResult.effects.find((effect) => effect.type === 'damage')?.magnitude).toBe(125);

    const chargeResult = resolveEffectEvent(generic, gameConfig, [], {
      kind: 'enemy-skill-cast', targetIds: ['target'], targetStatuses: [{ statusId: 'kidney-reprisal', stacks: 2, remainingMs: 5_000, magnitude: numericMechanicBaselines.chargeRateIncrease, tags: ['charge-on-enemy-skill-cast', 'charge-rate-increase'] }],
    });
    expect(chargeResult.effects).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'damage', magnitude: numericMechanicBaselines.chargedReprisalDamage })]));
    expect(chargeResult.consumeStatusIds).toEqual(['kidney-reprisal']);
  });

  it('exposes threshold chance and locked-charge targeting, and accelerates generic skill recharge', () => {
    const epsilon = { ...createInitialGameState(), phase: 'active' as const, originId: 'venom' as const, activeSubtypeId: 'venom-heart-epsilon' };
    expect(getThresholdControlChance(epsilon, gameConfig, 'heart-erosion', [{ statusId: 'heart-erosion', stacks: 12, remainingMs: 5_000, magnitude: numericMechanicBaselines.thresholdControlChanceIncrease, tags: ['threshold-control-chance-increase'] }])).toBe(0.5);
    expect(getEffectTargetingBehavior({ type: 'move', target: 'self', tags: ['locked-charge'] })).toEqual({ requiresLockedTarget: true });

    const charging = { ...createInitialGameState(), phase: 'active' as const, playerStatuses: [{ statusId: 'charge-boost', stacks: 1, remainingMs: 5_000, magnitude: 0.5, tags: ['charge-rate-increase'] }], skillRuntime: { 'size-gale-glide': { cooldownRemainingMs: 0, charges: 0, rechargeRemainingMs: 8_000 } } };
    expect(tick(charging, gameConfig, 5_334).skillRuntime['size-gale-glide'].charges).toBe(1);
  });
});
