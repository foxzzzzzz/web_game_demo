import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../src/config';
import {
  applyDamage,
  applyEnemyResolvedEffects,
  assignVenomPoint,
  castSkill,
  createInitialGameState,
  createRun,
  equipSkill,
  gainReward,
  resetRun,
  resolveSkillEffects,
  tick,
  unlockBranch,
  upgradeSkill,
} from '../../src/domain';

describe('Phase 1 domain rules', () => {
  it('creates a venom run once, with its free branch, default subtype and resources', () => {
    const created = createRun(createInitialGameState(), gameConfig, 'venom', 'venom-neuro');

    expect(created.originId).toBe('venom');
    expect(created.gold).toBe(1);
    expect(created.venomPoints).toBe(1);
    expect(created.unlockedBranchIds).toEqual(['venom-neuro']);
    expect(created.unlockedSubtypeIds).toEqual(['venom-neuro-alpha']);
    expect(createRun(created, gameConfig, 'size', 'size-thick-armor')).toEqual(created);
  });

  it('levels from character XP without spending it, and opens skills at their configured level', () => {
    let state = createRun(createInitialGameState(), gameConfig, 'size', 'size-thick-armor');
    state = gainReward(state, gameConfig, { characterXp: 260, skillXp: 30 });

    expect(state.characterLevel).toBe(3);
    expect(state.characterXp).toBe(260);
    expect(state.skillXp).toBe(30);
    expect(state.openSkillIds).toContain('size-gale-glide');
    expect(state.openSkillIds).not.toContain('size-flexible-dodge');
  });

  it('upgrades damage skills, caps at 17, and awards its gold reward once', () => {
    let state = createRun(createInitialGameState(), gameConfig, 'size', 'size-thick-armor');
    state = gainReward(state, gameConfig, { characterXp: 4000, skillXp: 2000 });
    for (let attempt = 0; attempt < 16; attempt += 1) state = upgradeSkill(state, gameConfig, 'size-gale-glide');

    expect(state.skillLevels['size-gale-glide']).toBe(17);
    expect(state.gold).toBe(2);
    expect(upgradeSkill(state, gameConfig, 'size-gale-glide')).toEqual(state);
  });

  it('only unlocks same-origin branches with enough gold and venom branches unlock their default subtype', () => {
    let state = createRun(createInitialGameState(), gameConfig, 'venom', 'venom-neuro');
    state = unlockBranch(state, gameConfig, 'size-thick-armor');
    expect(state.unlockedBranchIds).toEqual(['venom-neuro']);
    state = unlockBranch(state, gameConfig, 'venom-hemorrhage');
    expect(state.unlockedBranchIds).toContain('venom-hemorrhage');
    expect(state.unlockedSubtypeIds).toContain('venom-hemorrhage-a');
  });

  it('equips only open skills once and blocks changes during combat', () => {
    let state = createRun(createInitialGameState(), gameConfig, 'strength', 'strength-ferocious');
    state = gainReward(state, gameConfig, { characterXp: 300, skillXp: 0 });
    state = equipSkill(state, gameConfig, 'strength-lock-coil', 1);
    expect(state.loadout[1]).toBe('strength-lock-coil');
    expect(equipSkill(state, gameConfig, 'strength-lock-coil', 2)).toEqual(state);
    expect(equipSkill({ ...state, inCombat: true }, gameConfig, 'strength-lock-coil', 2)).toEqual({ ...state, inCombat: true });
  });

  it('uses ordinary cooldowns and serially restores charge skills while respecting pause', () => {
    let state = createRun(createInitialGameState(), gameConfig, 'size', 'size-thick-armor');
    state = gainReward(state, gameConfig, { characterXp: 1400, skillXp: 0 });
    state = equipSkill(state, gameConfig, 'size-gale-glide', 1);
    state = castSkill(state, gameConfig, 1, ['enemy-a']);
    state = castSkill(state, gameConfig, 1, ['enemy-a']);
    expect(state.skillRuntime['size-gale-glide'].charges).toBe(0);
    expect(castSkill(state, gameConfig, 1, ['enemy-a'])).toEqual(state);
    expect(tick({ ...state, paused: true }, gameConfig, 9000)).toEqual({ ...state, paused: true });
    state = tick(state, gameConfig, 8000);
    expect(state.skillRuntime['size-gale-glide'].charges).toBe(1);
    state = tick(state, gameConfig, 8000);
    expect(state.skillRuntime['size-gale-glide'].charges).toBe(2);
  });

  it('applies damage to shield before health and applies large-target hard-control reduction without shortening dot', () => {
    const damaged = applyDamage({ ...createInitialGameState(), player: { maxHealth: 100, health: 100, shield: 30 } }, 50);
    expect(damaged.player).toEqual({ maxHealth: 100, health: 80, shield: 0 });
    const alpha = { ...createInitialGameState(), phase: 'active' as const, originId: 'venom' as const, activeSubtypeId: 'venom-neuro-alpha' };
    const status = applyEnemyResolvedEffects(alpha, gameConfig, 'target', true, [{ type: 'status', target: 'target', targetIds: ['target'], statusId: 'paralysis', stacks: 10 }]).enemyStatuses.target.statuses;
    expect(status.find((entry) => entry.statusId === 'stun')?.remainingMs).toBe(1000);
    expect(status.find((entry) => entry.statusId === 'paralysis')?.remainingMs).toBe(6000);
  });

  it('assigns venom points only to unlocked subtypes and resets only a dead run', () => {
    let state = createRun(createInitialGameState(), gameConfig, 'venom', 'venom-neuro');
    state = assignVenomPoint(state, gameConfig, 'venom-neuro-alpha');
    expect(state.enhancedSubtypeIds).toEqual(['venom-neuro-alpha']);
    expect(resetRun(state)).toEqual(state);
    expect(resetRun({ ...state, phase: 'dead' })).toEqual(createInitialGameState());
  });

  it('resolves configured effects with level growth, unique targets, and venom enhancement', () => {
    let strength = createRun(createInitialGameState(), gameConfig, 'strength', 'strength-ferocious');
    strength = gainReward(strength, gameConfig, { characterXp: 900, skillXp: 20 });
    strength = upgradeSkill(strength, gameConfig, 'strength-force-burst');
    const damage = resolveSkillEffects(strength, gameConfig, 'strength-force-burst', ['enemy-a', 'enemy-a']);
    expect(damage.find((effect) => effect.type === 'damage')?.magnitude).toBe(170);
    expect(damage.find((effect) => effect.type === 'damage')?.targetIds).toEqual(['enemy-a']);

    let venom = createRun(createInitialGameState(), gameConfig, 'venom', 'venom-neuro');
    venom = gainReward(venom, gameConfig, { characterXp: 250, skillXp: 0 });
    venom = assignVenomPoint(venom, gameConfig, 'venom-neuro-alpha');
    const status = resolveSkillEffects(venom, gameConfig, 'venom-neuro-needle', ['enemy-a']);
    expect(status.find((effect) => effect.statusId === 'paralysis')?.stacks).toBe(7);
  });
});
