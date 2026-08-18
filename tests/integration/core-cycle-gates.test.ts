import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../src/config';
import { createGameStore } from '../../src/store';

describe('core cycle gates from TEST_CASES', () => {
  it('rejects an empty slot, an empty-target cast, and a skill already on cooldown without changing the run', () => {
    const store = createGameStore(gameConfig);
    store.getState().createRun('strength', 'strength-ferocious');
    const beforeEmptySlot = store.getState().run;
    store.getState().castSkill(1, ['target']);
    expect(store.getState().run).toBe(beforeEmptySlot);

    store.getState().gainReward(600, 0);
    store.getState().equipSkill('strength-force-burst', 1);
    const beforeEmptyTarget = store.getState().run;
    store.getState().castSkill(1, []);
    expect(store.getState().run).toBe(beforeEmptyTarget);

    store.getState().castSkill(1, ['target']);
    const onCooldown = store.getState().run;
    store.getState().castSkill(1, ['target']);
    expect(store.getState().run).toBe(onCooldown);
  });

  it('falls back to creation for an old or malformed save snapshot', () => {
    const oldVersion = createGameStore(gameConfig, { version: 0 as 1, run: createGameStore(gameConfig).getState().run });
    const malformed = createGameStore(gameConfig, { version: gameConfig.saveVersion, run: undefined } as unknown as Parameters<typeof createGameStore>[1]);

    expect(oldVersion.getState().run.phase).toBe('creation');
    expect(malformed.getState().run).toEqual(oldVersion.getState().run);
  });

  it('keeps a death snapshot for reload and clears all run progress after R reset', () => {
    const store = createGameStore(gameConfig);
    store.getState().createRun('venom', 'venom-neuro');
    store.getState().applyPlayerDamage(10_000);
    const deathSnapshot = store.getState().snapshot();
    const reloaded = createGameStore(gameConfig, deathSnapshot);

    expect(reloaded.getState().run.phase).toBe('dead');
    expect(reloaded.getState().run.unlockedBranchIds).toEqual(['venom-neuro']);
    reloaded.getState().resetRun();
    expect(reloaded.getState().snapshot().run).toEqual(expect.objectContaining({ phase: 'creation', gold: 0, venomPoints: 0, unlockedBranchIds: [], unlockedSubtypeIds: [] }));
  });

  it('continues an active run after the round objective is completed', () => {
    const store = createGameStore(gameConfig);
    store.getState().createRun('size', 'size-thick-armor');
    store.getState().gainReward(3_700, 0);
    store.getState().completeRoundObjective();
    const before = store.getState().run.characterXp;
    store.getState().gainReward(10, 0);

    expect(store.getState().run.objectiveCompleted).toBe(true);
    expect(store.getState().run.phase).toBe('active');
    expect(store.getState().run.characterXp).toBe(before + 10);
  });
});
