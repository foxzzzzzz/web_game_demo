import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../src/config';
import { resolveSkillEffects } from '../../src/domain';
import { createGameStore } from '../../src/store';

const phaseOneBranches = new Set(['size-thick-armor', 'strength-ferocious']);
const phaseTwoBranches = gameConfig.branches.filter((branch) =>
  (branch.originId === 'size' || branch.originId === 'strength') && !phaseOneBranches.has(branch.id),
);
const phaseTwoSkills = gameConfig.skills.filter((skill) => phaseTwoBranches.some((branch) => branch.id === skill.branchId));

describe('Phase 2 physical skill integration catalog', () => {
  it('contains exactly 32 skills across the eight new branches', () => {
    expect(phaseTwoBranches).toHaveLength(8);
    expect(phaseTwoSkills).toHaveLength(32);
    for (const branch of phaseTwoBranches) expect(phaseTwoSkills.filter((skill) => skill.branchId === branch.id)).toHaveLength(4);
  });

  it.each(phaseTwoSkills.map((skill) => [skill.id, skill] as const))('%s can be opened, equipped and cast through the real store command path', (_skillId, skill) => {
    const branch = phaseTwoBranches.find((entry) => entry.id === skill.branchId)!;
    const store = createGameStore(gameConfig);
    store.getState().createRun(branch.originId, branch.id);
    store.getState().gainReward(3_700, 600);

    expect(store.getState().run.openSkillIds).toContain(skill.id);
    store.getState().equipSkill(skill.id, 1);
    expect(store.getState().run.loadout[1]).toBe(skill.id);

    const before = store.getState().run.skillRuntime[skill.id];
    store.getState().castSkill(1, ['ancient-monitor']);
    const after = store.getState().run.skillRuntime[skill.id];
    expect(after).not.toEqual(before);
    expect(resolveSkillEffects(store.getState().run, gameConfig, skill.id, ['ancient-monitor']).length).toBeGreaterThan(0);
  });
});
