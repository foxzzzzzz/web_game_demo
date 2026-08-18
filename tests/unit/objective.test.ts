import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../src/config';
import { completeRoundObjective, createInitialGameState, createRun, gainReward } from '../../src/domain';

describe('round objective', () => {
  it('completes only after the configured character level is reached and remains idempotent', () => {
    let state = createRun(createInitialGameState(), gameConfig, 'size', 'size-thick-armor');
    expect(completeRoundObjective(state, gameConfig)).toEqual(state);

    state = gainReward(state, gameConfig, { characterXp: 3700, skillXp: 0 });
    const completed = completeRoundObjective(state, gameConfig);
    expect(completed.objectiveCompleted).toBe(true);
    expect(completeRoundObjective(completed, gameConfig)).toEqual(completed);
  });
});
