import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../src/config';

const subtypes = ['venom-coagulation-delayed', 'venom-necrosis-alpha', 'venom-necrosis-gamma', 'venom-necrosis-epsilon', 'venom-hallucinogen-ii', 'venom-hallucinogen-iii', 'venom-hallucinogen-iv', 'venom-muscle-beta'];

describe('Phase 4 venom batch B contract', () => {
  it('maps all 32 skills and eight passives without generated placeholders', () => {
    for (const subtypeId of subtypes) {
      expect(gameConfig.skills.filter((skill) => skill.subtypeId === subtypeId)).toHaveLength(4);
      expect(gameConfig.skills.filter((skill) => skill.subtypeId === subtypeId).every((skill) => skill.effects.every((effect) => !effect.tags?.includes('source-mechanic')))).toBe(true);
      expect(gameConfig.passives.some((passive) => passive.subtypeId === subtypeId && passive.effects.length > 0)).toBe(true);
    }
  });
  it('retains delayed coagulation, defense reduction, residual durations and specified percentages', () => {
    expect(gameConfig.skills.find((skill) => skill.id === 'venom-coagulation-delayed-1')!.effects).toEqual(expect.arrayContaining([expect.objectContaining({ durationMs: 3000, stacks: 7, statusId: 'thrombosis' })]));
    expect(gameConfig.skills.find((skill) => skill.id === 'venom-necrosis-alpha-1')!.effects).toEqual(expect.arrayContaining([expect.objectContaining({ magnitude: 0.18, tags: expect.arrayContaining(['physical-defense-reduction']) })]));
    expect(gameConfig.skills.find((skill) => skill.id === 'venom-necrosis-gamma-3')!.effects).toEqual(expect.arrayContaining([expect.objectContaining({ durationMs: 4000, statusId: 'ulceration' })]));
    expect(gameConfig.skills.find((skill) => skill.id === 'venom-muscle-beta-3')!.effects).toEqual(expect.arrayContaining([expect.objectContaining({ tags: expect.arrayContaining(['requires:muscle-stiffness']) })]));
    expect(gameConfig.passives.find((passive) => passive.id === 'venom-necrosis-gamma-passive')!.effects).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'damage', magnitude: 8, durationMs: 2000, tags: expect.arrayContaining(['after-expire', 'venom-residual', 'per-second']) }),
    ]));
  });
});
