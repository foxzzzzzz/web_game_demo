import { describe, expect, it } from 'vitest';
import { gameConfig } from '../config';
import { createInitialGameState, createRun, gainReward } from '../domain';
import { buildGameViewModel } from './game-adapter';

describe('game UI adapter', () => {
  it('maps configuration into the three-origin creation screen', () => {
    const view = buildGameViewModel(createInitialGameState(), gameConfig, {
      selectedOriginId: null,
      selectedBranchId: null,
      activePanel: null,
    });
    expect(view.screen).toBe('creation');
    expect(view.origins).toHaveLength(3);
    expect(view.origins.find((origin) => origin.id === 'venom')?.branches).toHaveLength(8);
  });

  it('exposes opened skills and the four-slot loadout for an active run', () => {
    const created = createRun(createInitialGameState(), gameConfig, 'size', 'size-thick-armor');
    const levelThree = gainReward(created, gameConfig, { characterXp: 250, skillXp: 20 });
    const view = buildGameViewModel(levelThree, gameConfig, {
      selectedOriginId: 'size',
      selectedBranchId: 'size-thick-armor',
      activePanel: 'skills',
    });
    expect(view.screen).toBe('game');
    expect(view.loadout).toHaveLength(4);
    expect(view.skills.find((skill) => skill.id === 'size-gale-glide')?.unlocked).toBe(true);
  });
});
