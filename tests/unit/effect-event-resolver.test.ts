import { describe, expect, it } from 'vitest';
import { eventMechanicBaselines, gameConfig } from '../../src/config';
import { createInitialGameState, getEnemyStatusModifiers, resolveEffectEvent } from '../../src/domain';

const active = { ...createInitialGameState(), phase: 'active' as const, originId: 'venom' as const, activeSubtypeId: 'venom-kidney-x' };
const status = (statusId: string, stacks: number, tags: string[], magnitude?: number) => ({ statusId, stacks, tags, magnitude, remainingMs: 6_000 });

describe('generic Phase 4 effect event resolver', () => {
  it('resolves area paralysis, rapid/group root and copied muscle status effects without skill IDs', () => {
    const result = resolveEffectEvent(active, gameConfig, [
      { type: 'trigger', target: 'area', tags: ['area-paralysis-burst'] },
      { type: 'status', target: 'area', statusId: 'heart-erosion', stacks: 1, tags: ['group-rapid-stack'] },
      { type: 'status', target: 'area', statusId: 'root', stacks: 1, tags: ['group-root'] },
      { type: 'trigger', target: 'area', tags: ['copy-muscle-debuff'] },
    ], {
      kind: 'target-damage', targetIds: ['source'], sourceStatuses: [status('muscle-stiffness', 2, []), status('weakness', 3, [])],
      candidateTargets: [{ id: 'a', alive: true }, { id: 'b', alive: true }],
    });

    expect(result.effects).toEqual(expect.arrayContaining([
      expect.objectContaining({ statusId: 'paralysis', stacks: eventMechanicBaselines.areaParalysisBurstStacks, targetIds: ['a', 'b'] }),
      expect.objectContaining({ statusId: 'heart-erosion', stacks: eventMechanicBaselines.groupRapidStackCount, targetIds: ['a', 'b'] }),
      expect.objectContaining({ statusId: 'root', targetIds: ['a', 'b'] }),
      expect.objectContaining({ statusId: 'muscle-stiffness', stacks: 2, targetIds: ['a', 'b'] }),
      expect.objectContaining({ statusId: 'weakness', stacks: 3, targetIds: ['a', 'b'] }),
    ]));
  });

  it('spreads configured statuses, emits residual detonation and exposes tick scheduling', () => {
    const result = resolveEffectEvent(active, gameConfig, [
      { type: 'trigger', target: 'area', tags: ['spread:ulceration'] },
      { type: 'trigger', target: 'area', tags: ['spread:venom-corrosion'] },
      { type: 'trigger', target: 'area', tags: ['detonate-residual-mark:kidney-reprisal'] },
      { type: 'buff', target: 'area', magnitude: 2, tags: ['tick-rate-multiplier'] },
    ], {
      kind: 'target-damage', targetIds: ['source'], sourceStatuses: [status('ulceration', 4, []), status('kidney-reprisal', 2, [])],
      candidateTargets: [{ id: 'source', alive: true }, { id: 'a', alive: true }, { id: 'b', alive: true }],
    });

    expect(result.effects).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'status', statusId: 'ulceration', stacks: 4, targetIds: ['a'] }),
      expect.objectContaining({ type: 'damage', magnitude: eventMechanicBaselines.venomCorrosionDamage, tags: expect.arrayContaining(['per-second']), targetIds: ['a'] }),
      expect.objectContaining({ type: 'damage', magnitude: eventMechanicBaselines.residualMarkDetonationDamage, targetIds: ['source'] }),
    ]));
    expect(result.consumeStatusIds).toContain('kidney-reprisal');
    expect(result.tickRateMultiplier).toBe(2);
  });

  it('uses generic damage-taken modifiers and stack-and-detonate events', () => {
    expect(getEnemyStatusModifiers([status('bleed', 1, ['damage-taken'], 0.45)]).incomingDamageMultiplier).toBe(1.45);
    const result = resolveEffectEvent(active, gameConfig, [], {
      kind: 'enemy-skill-cast', targetIds: ['target'], targetStatuses: [status('kidney-reprisal', 2, ['charge-on-enemy-skill-cast', 'stack-and-detonate'])],
    });
    expect(result.effects).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'damage', magnitude: eventMechanicBaselines.chargedReprisalDamage })]));
    expect(result.consumeStatusIds).toEqual(['kidney-reprisal']);
  });
});
