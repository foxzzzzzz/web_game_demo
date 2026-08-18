import { describe, expect, it } from 'vitest';
import { gameConfig, validateGameConfig } from '../../src/config';

describe('configuration contract', () => {
  it('loads the full typed configuration', () => {
    expect(validateGameConfig(gameConfig)).toEqual(gameConfig);
  });

  it('contains the complete 3-origin, 18-branch, 32-subtype, 168-skill and 42-passive catalog', () => {
    expect(gameConfig.origins).toHaveLength(3);
    expect(gameConfig.branches).toHaveLength(18);
    expect(gameConfig.subtypes).toHaveLength(32);
    expect(gameConfig.skills).toHaveLength(168);
    expect(gameConfig.passives).toHaveLength(42);
    expect(new Set(gameConfig.skills.map((skill) => skill.id)).size).toBe(168);
    expect(new Set(gameConfig.passives.map((passive) => passive.id)).size).toBe(42);
  });

  it('keeps four correctly ordered skills for every branch or venom subtype, with one valid cooldown model', () => {
    const expectedLevels = [3, 5, 7, 9];
    const groups = [
      ...gameConfig.branches.filter((branch) => branch.originId !== 'venom').map((branch) => gameConfig.skills.filter((skill) => skill.branchId === branch.id && !skill.subtypeId)),
      ...gameConfig.subtypes.map((subtype) => gameConfig.skills.filter((skill) => skill.subtypeId === subtype.id)),
    ];

    for (const groupedSkills of groups) {
      const skills = groupedSkills.sort((left, right) => left.order - right.order);
      expect(skills).toHaveLength(4);
      expect(skills.map((skill) => skill.unlockLevel)).toEqual(expectedLevels);
      for (const skill of skills) {
        expect(skill.effects.length).toBeGreaterThan(0);
        expect((skill.cooldownMs === undefined) === (skill.maxCharges !== undefined)).toBe(true);
      }
    }
  });

  it('keeps every passive documented and every skill traceable to at least one non-ambiguous source mechanic', () => {
    for (const passive of gameConfig.passives) {
      expect(passive.description.trim().length).toBeGreaterThan(0);
      expect(passive.effects.length).toBeGreaterThan(0);
    }
    for (const skill of gameConfig.skills) {
      expect(skill.effects.some((effect) => effect.tags?.some((tag) => tag !== 'baseline-quantified'))).toBe(true);
      if (skill.baseDamage > 0) expect(skill.effects.some((effect) => effect.type === 'damage' && effect.magnitude === skill.baseDamage)).toBe(true);
    }
  });

  it('copies every declared status stack count into its primary structured status effect', () => {
    for (const skill of gameConfig.skills.filter((entry) => entry.statusId && entry.statusStacks !== undefined)) {
      const primaryEffect = skill.effects.find((effect) => effect.type === 'status' && effect.statusId === skill.statusId);
      expect(primaryEffect?.stacks).toBe(skill.statusStacks);
    }
  });

  it('reports duplicate skill IDs', () => {
    const invalid = structuredClone(gameConfig);
    invalid.skills.push(structuredClone(invalid.skills[0]));
    expect(() => validateGameConfig(invalid)).toThrow(/重复技能 ID/);
  });

  it('reports missing status references and invalid cooldown/level values', () => {
    const invalid = structuredClone(gameConfig);
    invalid.skills[0].statusId = 'not-found';
    invalid.skills[0].unlockLevel = 4;
    invalid.skills[0].cooldownMs = -1;
    expect(() => validateGameConfig(invalid)).toThrow(/不存在的状态|开放等级|冷却/);
  });
});
