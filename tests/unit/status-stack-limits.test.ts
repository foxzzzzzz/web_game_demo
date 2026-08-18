import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../src/config';
import { applyEnemyResolvedEffects, createInitialGameState, createRun, getActiveStatusMaxStacks, isEffectConditionMet } from '../../src/domain';

describe('status stack-limit consistency', () => {
  it('never configures an applied status above its static stack cap', () => {
    for (const effect of gameConfig.skills.flatMap((skill) => skill.effects).filter((effect) => effect.type === 'status' && effect.statusId && effect.stacks !== undefined)) {
      expect(gameConfig.statuses[effect.statusId!].maxStacks).toBeGreaterThanOrEqual(effect.stacks!);
    }
  });

  it('keeps configured thresholds and per-stack detonation references on stackable statuses', () => {
    for (const status of Object.values(gameConfig.statuses)) {
      if (status.thresholdStacks !== undefined) expect(status.maxStacks).toBeGreaterThanOrEqual(status.thresholdStacks);
    }
    const perStackStatusIds = gameConfig.skills.flatMap((skill) => skill.effects).flatMap((effect) => effect.tags ?? [])
      .map((tag) => /^per-(.+)-stack$/.exec(tag)?.[1]).filter((statusId): statusId is string => statusId !== undefined);
    for (const statusId of perStackStatusIds) expect(gameConfig.statuses[statusId].maxStacks).toBeGreaterThan(1);
  });

  it('uses centralized multi-stack baselines for unquantified muscle, weakness and kidney status mechanics', () => {
    for (const statusId of ['muscle-stiffness', 'weakness', 'kidney-reprisal']) {
      expect(gameConfig.statuses[statusId].maxStacks).toBeGreaterThan(1);
    }
  });

  it('adds active max-stacks passives to the target status cap without passive-id branching', () => {
    let state = createRun(createInitialGameState(), gameConfig, 'venom', 'venom-hemorrhage');
    expect(getActiveStatusMaxStacks(state, gameConfig, 'bleed')).toBe(gameConfig.statuses.bleed.maxStacks + 3);

    state = applyEnemyResolvedEffects(state, gameConfig, 'target', false, [{ type: 'status', target: 'target', targetIds: ['target'], statusId: 'bleed', stacks: 8 }]);
    state = applyEnemyResolvedEffects(state, gameConfig, 'target', false, [{ type: 'status', target: 'target', targetIds: ['target'], statusId: 'bleed', stacks: 6 }]);
    expect(state.enemyStatuses.target.statuses.find((status) => status.statusId === 'bleed')?.stacks).toBe(11);
  });

  it('keeps threshold and large-target hard-control duration rules after stack-cap resolution', () => {
    let state = createRun(createInitialGameState(), gameConfig, 'venom', 'venom-neuro');
    state = applyEnemyResolvedEffects(state, gameConfig, 'elite', true, [{ type: 'status', target: 'target', targetIds: ['elite'], statusId: 'paralysis', stacks: 10 }]);
    const alphaStunDuration = gameConfig.passives.find((passive) => passive.id === 'venom-neuro-alpha-passive')!.effects[0].durationMs!;

    expect(state.enemyStatuses.elite.statuses).toEqual(expect.arrayContaining([
      expect.objectContaining({ statusId: 'paralysis', stacks: 10 }),
      expect.objectContaining({ statusId: 'stun', remainingMs: alphaStunDuration * gameConfig.largeHardControlMultiplier }),
    ]));
  });

  it('uses the configured three-weakness-stack condition for the conversion trigger', () => {
    const conversion = gameConfig.skills.find((skill) => skill.id === 'venom-muscle-gamma-4')!.effects[0];
    expect(conversion.tags).toContain('requires:weakness-stacks:3');
    expect(isEffectConditionMet(conversion, [{ statusId: 'weakness', stacks: 2, remainingMs: 1000 }])).toBe(false);
    expect(isEffectConditionMet(conversion, [{ statusId: 'weakness', stacks: 3, remainingMs: 1000 }])).toBe(true);
  });
});
