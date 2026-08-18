import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../src/config';
import { resolveSkillEffects } from '../../src/domain';
import { createGameStore } from '../../src/store';

const batchSubtypeIds = [
  'venom-neuro-beta', 'venom-neuro-kappa', 'venom-neuro-delta',
  'venom-hemorrhage-b', 'venom-hemorrhage-c', 'venom-hemorrhage-d',
  'venom-coagulation-small', 'venom-coagulation-diffuse',
] as const;
const batchSubtypes = gameConfig.subtypes.filter((subtype) => batchSubtypeIds.includes(subtype.id as typeof batchSubtypeIds[number]));
const batchSkills = gameConfig.skills.filter((skill) => skill.subtypeId && batchSubtypeIds.includes(skill.subtypeId as typeof batchSubtypeIds[number]));

describe('Phase 4 batch A venom subtype integration catalog', () => {
  it('contains eight subtypes and exactly 32 skills', () => {
    expect(batchSubtypes).toHaveLength(8);
    expect(batchSkills).toHaveLength(32);
    for (const subtypeId of batchSubtypeIds) expect(batchSkills.filter((skill) => skill.subtypeId === subtypeId)).toHaveLength(4);
  });

  it.each(batchSkills.map((skill) => [skill.id, skill] as const))('%s follows create→unlock→select→equip→cast', (_skillId, skill) => {
    const subtype = batchSubtypes.find((entry) => entry.id === skill.subtypeId)!;
    const store = createGameStore(gameConfig);
    store.getState().createRun('venom', subtype.branchId);
    expect(store.getState().run.unlockedSubtypeIds).not.toContain(subtype.id);

    store.getState().unlockSubtype(subtype.id);
    expect(store.getState().run.unlockedSubtypeIds).toContain(subtype.id);
    store.getState().selectSubtype(subtype.id);
    expect(store.getState().run.activeSubtypeId).toBe(subtype.id);

    store.getState().gainReward(3_700, 600);
    expect(store.getState().run.openSkillIds).toContain(skill.id);
    store.getState().equipSkill(skill.id, 1);
    expect(store.getState().run.loadout[1]).toBe(skill.id);

    const before = store.getState().run.skillRuntime[skill.id];
    store.getState().castSkill(1, ['ancient-monitor']);
    expect(store.getState().run.skillRuntime[skill.id]).not.toEqual(before);
    expect(resolveSkillEffects(store.getState().run, gameConfig, skill.id, ['ancient-monitor']).length).toBeGreaterThan(0);
  });
});
