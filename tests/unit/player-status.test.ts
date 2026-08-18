import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../src/config';
import {
  applyDamage,
  applyPlayerResolvedEffects,
  castSkill,
  createInitialGameState,
  createRun,
  getActivePassiveModifiers,
  shouldEvadeAttack,
  tick,
  unlockBranch,
} from '../../src/domain';

describe('player status and passive modifiers', () => {
  it('refreshes self statuses, dispels configured matching debuffs, and pauses their expiry', () => {
    let state = createRun(createInitialGameState(), gameConfig, 'size', 'size-thick-armor');
    const slow = { type: 'status' as const, target: 'self' as const, targetIds: ['player'], statusId: 'slow', stacks: 1 };
    state = applyPlayerResolvedEffects(state, gameConfig, [slow]);
    state = tick(state, gameConfig, 1000);
    state = applyPlayerResolvedEffects(state, gameConfig, [slow]);
    expect(state.playerStatuses).toEqual([{ statusId: 'slow', stacks: 1, remainingMs: 6000 }]);
    expect(tick({ ...state, paused: true }, gameConfig, 6000).playerStatuses).toEqual(state.playerStatuses);
    state = applyPlayerResolvedEffects(state, gameConfig, [{ type: 'dispel', target: 'self', targetIds: ['player'], stacks: 1, tags: ['kind:debuff'] }]);
    expect(state.playerStatuses).toEqual([]);
  });

  it('blocks skill casting under silence or hard control without changing cooldown/charge state', () => {
    let state = createRun(createInitialGameState(), gameConfig, 'size', 'size-thick-armor');
    state = { ...state, openSkillIds: ['size-gale-glide'], loadout: { 1: 'size-gale-glide', 2: null, 3: null, 4: null } };
    state = applyPlayerResolvedEffects(state, gameConfig, [{ type: 'status', target: 'self', targetIds: ['player'], statusId: 'silence', stacks: 1 }]);
    expect(castSkill(state, gameConfig, 1, ['enemy-a'])).toEqual(state);
    const hardControlled = applyPlayerResolvedEffects({ ...state, playerStatuses: [] }, gameConfig, [{ type: 'status', target: 'self', targetIds: ['player'], statusId: 'stun', stacks: 1 }]);
    expect(castSkill(hardControlled, gameConfig, 1, ['enemy-a'])).toEqual(hardControlled);
  });

  it('applies active passives to health, physical mitigation, and reusable attack modifiers', () => {
    let size = createRun(createInitialGameState(), gameConfig, 'size', 'size-thick-armor');
    size = unlockBranch(size, gameConfig, 'size-oppression');
    expect(size.player).toMatchObject({ maxHealth: 320, health: 320 });
    expect(applyDamage(size, 100, 'physical', gameConfig).player.health).toBe(232);
    expect(getActivePassiveModifiers(size, gameConfig)).toMatchObject({ maxHealth: 220, physicalDamageReduction: 0.12, biteBaseDamage: 0 });

    const strength = createRun(createInitialGameState(), gameConfig, 'strength', 'strength-ferocious');
    expect(getActivePassiveModifiers(strength, gameConfig).biteBaseDamage).toBe(25);
  });

  it('applies configured temporary keratin mitigation while its buff is active', () => {
    let state = createRun(createInitialGameState(), gameConfig, 'size', 'size-thick-armor');
    const keratin = gameConfig.skills.find((skill) => skill.id === 'size-hide-harden')!.effects;
    state = applyPlayerResolvedEffects(state, gameConfig, keratin.map((effect) => ({ ...effect, targetIds: ['player'] })));

    expect(applyDamage(state, 100, 'physical', gameConfig).player.health).toBe(47);
  });

  it('uses the configured dodge buff chance against a deterministic roll', () => {
    let state = createRun(createInitialGameState(), gameConfig, 'size', 'size-thick-armor');
    const dodge = gameConfig.skills.find((skill) => skill.id === 'size-flexible-dodge')!.effects;
    state = applyPlayerResolvedEffects(state, gameConfig, dodge.map((effect) => ({ ...effect, targetIds: ['player'] })));
    expect(shouldEvadeAttack(state, 0.44)).toBe(true);
    expect(shouldEvadeAttack(state, 0.45)).toBe(false);
  });
});
