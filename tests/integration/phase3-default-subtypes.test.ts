import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../src/config';
import { resolveSkillEffects } from '../../src/domain';
import { createGameStore } from '../../src/store';

const venomBranches = gameConfig.branches.filter((branch) => branch.originId === 'venom');
const defaultSubtypeIds = venomBranches.map((branch) => branch.defaultSubtypeId!);
const defaultSubtypeSkills = gameConfig.skills.filter((skill) => skill.subtypeId && defaultSubtypeIds.includes(skill.subtypeId));

describe('Phase 3 default venom subtype integration catalog', () => {
  it('contains eight defaults with four skills each', () => {
    expect(defaultSubtypeIds).toHaveLength(8);
    expect(new Set(defaultSubtypeIds).size).toBe(8);
    expect(defaultSubtypeSkills).toHaveLength(32);
    for (const subtypeId of defaultSubtypeIds) expect(defaultSubtypeSkills.filter((skill) => skill.subtypeId === subtypeId)).toHaveLength(4);
  });

  it.each(defaultSubtypeSkills.map((skill) => [skill.id, skill] as const))('%s follows create→auto-unlock→select→equip→cast', (_skillId, skill) => {
    const branch = venomBranches.find((entry) => entry.id === skill.branchId)!;
    const store = createGameStore(gameConfig);
    store.getState().createRun('venom', branch.id);

    expect(store.getState().run.unlockedBranchIds).toContain(branch.id);
    expect(store.getState().run.unlockedSubtypeIds).toContain(skill.subtypeId);
    store.getState().selectSubtype(skill.subtypeId!);
    expect(store.getState().run.activeSubtypeId).toBe(skill.subtypeId);

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
