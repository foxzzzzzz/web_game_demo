import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../src/config';
import { applyEnemyResolvedEffects, applyPlayerResolvedEffects, createInitialGameState, createRun, selectSubtype, unlockSubtype } from '../../src/domain';

const targetStatus = (statusId: string, stacks = 1, durationMs?: number, magnitude?: number, tags?: string[]) => ({
  type: 'status' as const, target: 'target' as const, targetIds: ['target'], statusId, stacks, durationMs, magnitude, tags,
});

describe('configuration-driven status traits and passive application modifiers', () => {
  it('declares control, mobility, paralysis and muscle classification on the status directory', () => {
    expect(gameConfig.statuses.root).toMatchObject({ families: expect.arrayContaining(['control']), traits: expect.arrayContaining(['root']) });
    expect(gameConfig.statuses.paralysis).toMatchObject({ families: expect.arrayContaining(['control']), traits: expect.arrayContaining(['paralysis']) });
    expect(gameConfig.statuses.slow).toMatchObject({ traits: expect.arrayContaining(['slow']) });
    expect(gameConfig.statuses['muscle-stiffness']).toMatchObject({ families: expect.arrayContaining(['muscle']) });
  });

  it('modifies root, paralysis, thrombosis and muscle status application from active passive tags', () => {
    let rootState = createRun(createInitialGameState(), gameConfig, 'strength', 'strength-strangle');
    rootState = applyEnemyResolvedEffects(rootState, gameConfig, 'target', false, [targetStatus('root')]);
    expect(rootState.enemyStatuses.target.statuses.find((status) => status.statusId === 'root')?.remainingMs).toBe(8100);

    let paralysisState = createRun(createInitialGameState(), gameConfig, 'venom', 'venom-neuro');
    paralysisState = unlockSubtype(paralysisState, gameConfig, 'venom-neuro-beta');
    paralysisState = selectSubtype(paralysisState, gameConfig, 'venom-neuro-beta');
    paralysisState = applyEnemyResolvedEffects(paralysisState, gameConfig, 'target', false, [targetStatus('paralysis', 4)]);
    expect(paralysisState.enemyStatuses.target.statuses.find((status) => status.statusId === 'paralysis')).toMatchObject({ stacks: 6, remainingMs: 3600 });

    let thrombosisState = createRun(createInitialGameState(), gameConfig, 'venom', 'venom-coagulation');
    thrombosisState = applyEnemyResolvedEffects(thrombosisState, gameConfig, 'target', false, [targetStatus('thrombosis', 5)]);
    expect(thrombosisState.enemyStatuses.target.statuses.find((status) => status.statusId === 'thrombosis')?.stacks).toBe(7);

    let muscleState = createRun(createInitialGameState(), gameConfig, 'venom', 'venom-muscle');
    muscleState = unlockSubtype(muscleState, gameConfig, 'venom-muscle-delta');
    muscleState = selectSubtype(muscleState, gameConfig, 'venom-muscle-delta');
    muscleState = applyEnemyResolvedEffects(muscleState, gameConfig, 'target', false, [targetStatus('weakness', 2)]);
    expect(muscleState.enemyStatuses.target.statuses.find((status) => status.statusId === 'weakness')?.stacks).toBe(3);
  });

  it('preserves per-stack magnitude for runtime snapshot calculation and blocks trait-matched immunity', () => {
    let state = createRun(createInitialGameState(), gameConfig, 'size', 'size-thick-armor');
    const quakeWeakness = gameConfig.skills.find((skill) => skill.id === 'size-chain-quake')!.effects.find((effect) => effect.statusId === 'weakness')!;
    state = applyEnemyResolvedEffects(state, gameConfig, 'target', false, [{ ...quakeWeakness, targetIds: ['target'] }]);
    expect(state.enemyStatuses.target.statuses.find((status) => status.statusId === 'weakness')).toMatchObject({
      stacks: 3, magnitude: 0.18, tags: expect.arrayContaining(['move-speed-reduction-per-stack']),
    });

    let player = createRun(createInitialGameState(), gameConfig, 'size', 'size-thick-armor');
    player = applyPlayerResolvedEffects(player, gameConfig, [{ type: 'status', target: 'self', targetIds: ['player'], statusId: 'escape-immunity' }]);
    player = applyPlayerResolvedEffects(player, gameConfig, [{ type: 'status', target: 'self', targetIds: ['player'], statusId: 'root' }]);
    expect(player.playerStatuses.map((status) => status.statusId)).toEqual(['escape-immunity']);

    player = applyPlayerResolvedEffects({ ...player, playerStatuses: [] }, gameConfig, [{ type: 'status', target: 'self', targetIds: ['player'], statusId: 'slow-immunity' }]);
    player = applyPlayerResolvedEffects(player, gameConfig, [{ type: 'status', target: 'self', targetIds: ['player'], statusId: 'slow' }]);
    expect(player.playerStatuses.map((status) => status.statusId)).toEqual(['slow-immunity']);
  });
});
