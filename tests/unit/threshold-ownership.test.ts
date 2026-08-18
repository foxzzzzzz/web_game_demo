import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../src/config';
import { applyEnemyResolvedEffects, createInitialGameState } from '../../src/domain';

const venomState = (subtypeId: string) => ({
  ...createInitialGameState(), phase: 'active' as const, originId: 'venom' as const,
  activeSubtypeId: subtypeId, unlockedBranchIds: [subtypeId.replace(/-(?:alpha|beta|gamma|delta|epsilon|zeta)$/, '')], unlockedSubtypeIds: [subtypeId],
});

const status = (statusId: string, stacks: number) => ({ type: 'status' as const, target: 'target' as const, targetIds: ['target'], statusId, stacks });

describe('threshold control ownership', () => {
  it('keeps thrombosis as a global core threshold but removes paralysis and heart thresholds from the status directory', () => {
    expect(gameConfig.statuses.thrombosis).toMatchObject({ thresholdStatusId: 'root', thresholdStacks: 12 });
    expect(gameConfig.statuses.paralysis.thresholdStatusId).toBeUndefined();
    expect(gameConfig.statuses['heart-erosion'].thresholdStatusId).toBeUndefined();
  });

  it('only alpha neuro passive turns ten paralysis stacks into stun', () => {
    const alpha = applyEnemyResolvedEffects(venomState('venom-neuro-alpha'), gameConfig, 'target', false, [status('paralysis', 10)]);
    expect(alpha.enemyStatuses.target.statuses.map((entry) => entry.statusId)).toEqual(expect.arrayContaining(['paralysis', 'stun']));

    const beta = applyEnemyResolvedEffects(venomState('venom-neuro-beta'), gameConfig, 'target', false, [status('paralysis', 10)]);
    expect(beta.enemyStatuses.target.statuses.map((entry) => entry.statusId)).toEqual(['paralysis']);
  });

  it('only epsilon heart passive can resolve the twelve-stack stun, using injected random rolls', () => {
    const gamma = applyEnemyResolvedEffects(venomState('venom-heart-gamma'), gameConfig, 'target', false, [status('heart-erosion', 12)], { thresholdRoll: 0 });
    expect(gamma.enemyStatuses.target.statuses.map((entry) => entry.statusId)).toEqual(['heart-erosion']);

    const epsilonSuccess = applyEnemyResolvedEffects(venomState('venom-heart-epsilon'), gameConfig, 'target', false, [status('heart-erosion', 12)], { thresholdRoll: 0.2 });
    expect(epsilonSuccess.enemyStatuses.target.statuses.map((entry) => entry.statusId)).toEqual(expect.arrayContaining(['heart-erosion', 'stun']));

    const epsilonMiss = applyEnemyResolvedEffects(venomState('venom-heart-epsilon'), gameConfig, 'target', false, [status('heart-erosion', 12)], { thresholdRoll: 0.8 });
    expect(epsilonMiss.enemyStatuses.target.statuses.map((entry) => entry.statusId)).toEqual(['heart-erosion']);
  });
});
