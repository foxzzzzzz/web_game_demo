import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../src/config';
import {
  applyStatus,
  consumeEnemyDetonation,
  convertStatus,
  filterEffectsForContext,
  resolveConditionalTargetEffects,
  resolveSkillEffects,
} from '../../src/domain';
import { createGameStore } from '../../src/store';

const paidSubtypes = gameConfig.subtypes.filter((subtype) => subtype.unlockGold > 0);
const paidSkills = gameConfig.skills.filter((skill) => skill.subtypeId && paidSubtypes.some((subtype) => subtype.id === skill.subtypeId));

describe('Phase 4 paid venom catalogue domain/store acceptance', () => {
  it('contains 24 paid subtypes and their 96 skills', () => {
    expect(paidSubtypes).toHaveLength(24);
    expect(paidSkills).toHaveLength(96);
  });

  it.each(paidSkills.map((skill) => [skill.id, skill] as const))('%s follows create→unlock→select→equip→cast', (_skillId, skill) => {
    const subtype = paidSubtypes.find((entry) => entry.id === skill.subtypeId)!;
    const store = createGameStore(gameConfig);
    store.getState().createRun('venom', subtype.branchId);
    store.getState().unlockSubtype(subtype.id);
    store.getState().selectSubtype(subtype.id);
    store.getState().gainReward(3_700, 0);
    store.getState().equipSkill(skill.id, 1);

    expect(store.getState().run.activeSubtypeId).toBe(subtype.id);
    expect(store.getState().run.loadout[1]).toBe(skill.id);
    store.getState().castSkill(1, ['ancient-monitor']);
    expect(store.getState().run.skillRuntime[skill.id]).toBeDefined();
    expect(resolveSkillEffects(store.getState().run, gameConfig, skill.id, ['ancient-monitor'])).not.toEqual([]);
  });

  it('keeps old target debuffs when selecting another unlocked subtype', () => {
    const store = createGameStore(gameConfig);
    store.getState().createRun('venom', 'venom-neuro');
    store.getState().gainReward(300, 0);
    const alphaEffects = resolveSkillEffects(store.getState().run, gameConfig, 'venom-neuro-needle', ['ancient-monitor']);
    store.getState().applyResolvedStatusEffects('ancient-monitor', false, alphaEffects);
    store.getState().unlockSubtype('venom-neuro-beta');
    store.getState().selectSubtype('venom-neuro-beta');

    expect(store.getState().run.activeSubtypeId).toBe('venom-neuro-beta');
    expect(store.getState().getTargetStatuses('ancient-monitor')).toEqual(expect.arrayContaining([expect.objectContaining({ statusId: 'paralysis' })]));
  });

  it('applies venom enhancement to both numeric damage and status stacks', () => {
    const stackStore = createGameStore(gameConfig);
    stackStore.getState().createRun('venom', 'venom-neuro');
    stackStore.getState().gainReward(300, 0);
    const unenhancedStacks = resolveSkillEffects(stackStore.getState().run, gameConfig, 'venom-neuro-needle', ['target']).find((effect) => effect.statusId === 'paralysis')!.stacks;
    stackStore.getState().assignVenomPoint('venom-neuro-alpha');
    const enhancedStacks = resolveSkillEffects(stackStore.getState().run, gameConfig, 'venom-neuro-needle', ['target']).find((effect) => effect.statusId === 'paralysis')!.stacks;

    const store = createGameStore(gameConfig);
    store.getState().createRun('venom', 'venom-neuro');
    store.getState().unlockSubtype('venom-neuro-kappa');
    store.getState().selectSubtype('venom-neuro-kappa');
    store.getState().gainReward(3_700, 0);
    const before = resolveSkillEffects(store.getState().run, gameConfig, 'venom-neuro-kappa-4', ['target']).find((effect) => effect.type === 'damage')!.magnitude;
    store.getState().assignVenomPoint('venom-neuro-kappa');
    const after = resolveSkillEffects(store.getState().run, gameConfig, 'venom-neuro-kappa-4', ['target']).find((effect) => effect.type === 'damage')!.magnitude;

    expect(enhancedStacks).toBe(7);
    expect(unenhancedStacks).toBe(6);
    expect(after).toBe(Math.round(before! * 1.15));
  });

  it('keeps only core thresholds on status definitions while retaining detonations and conversions', () => {
    expect(applyStatus([], gameConfig.statuses.thrombosis, { isLarge: false, stacks: 12 }, gameConfig).some((status) => status.statusId === 'root')).toBe(true);
    expect(applyStatus([], gameConfig.statuses['heart-erosion'], { isLarge: false, stacks: 12 }, gameConfig).some((status) => status.statusId === 'stun')).toBe(false);
    expect(convertStatus([{ statusId: 'weakness', stacks: 3, remainingMs: 1000 }], 'weakness', 'muscle-stiffness', 1, 6000)).toEqual([{ statusId: 'muscle-stiffness', stacks: 1, remainingMs: 6000 }]);

    const detonated = consumeEnemyDetonation({
      ...createGameStore(gameConfig).getState().run,
      enemyStatuses: { target: { isLarge: false, statuses: [{ statusId: 'bleed', stacks: 4, remainingMs: 6000 }, { statusId: 'kidney-reprisal', stacks: 1, remainingMs: 6000 }] } },
    }, 'target', gameConfig.skills.find((skill) => skill.id === 'venom-kidney-l-4')!.effects);
    expect(detonated.enemyStatuses.target).toBeUndefined();
  });

  it('enforces dual-status and negated conditions from effect tags', () => {
    const dual = gameConfig.skills.find((skill) => skill.id === 'venom-kidney-l-3')!.effects;
    expect(filterEffectsForContext(dual, [{ statusId: 'bleed', stacks: 1, remainingMs: 1000 }, { statusId: 'kidney-reprisal', stacks: 1, remainingMs: 1000 }], { tags: [] })).toHaveLength(1);
    expect(filterEffectsForContext(dual, [{ statusId: 'bleed', stacks: 1, remainingMs: 1000 }], { tags: [] })).toEqual([]);

    const seal = gameConfig.skills.find((skill) => skill.id === 'venom-neuro-kappa-4')!.effects;
    expect(resolveConditionalTargetEffects(seal, [], undefined).find((effect) => effect.type === 'damage')?.magnitude).toBe(110);
    expect(resolveConditionalTargetEffects(seal, [{ statusId: 'energy-seal', stacks: 1, remainingMs: 1000 }], undefined).find((effect) => effect.type === 'damage')?.magnitude).toBe(220);
  });

  it('awards max-level gold once even after snapshot restore', () => {
    const store = createGameStore(gameConfig);
    store.getState().createRun('venom', 'venom-neuro');
    store.getState().gainReward(3_700, 2_000);
    for (let index = 0; index < 16; index += 1) store.getState().upgradeSkill('venom-neuro-needle');
    const snapshot = store.getState().snapshot();
    const restored = createGameStore(gameConfig, snapshot);
    const before = restored.getState().run.gold;
    restored.getState().upgradeSkill('venom-neuro-needle');

    expect(restored.getState().run.skillLevels['venom-neuro-needle']).toBe(17);
    expect(restored.getState().run.gold).toBe(before);
  });
});
