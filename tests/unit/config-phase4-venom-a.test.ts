import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../src/config';

const subtypes = ['venom-neuro-beta', 'venom-neuro-kappa', 'venom-neuro-delta', 'venom-hemorrhage-b', 'venom-hemorrhage-c', 'venom-hemorrhage-d', 'venom-coagulation-small', 'venom-coagulation-diffuse'];

describe('Phase 4 venom batch A contract', () => {
  it('provides explicit effects for 32 skills and eight passives without generator placeholders', () => {
    for (const subtypeId of subtypes) {
      const skills = gameConfig.skills.filter((skill) => skill.subtypeId === subtypeId);
      expect(skills).toHaveLength(4);
      expect(skills.every((skill) => skill.effects.every((effect) => !effect.tags?.includes('source-mechanic')))).toBe(true);
      expect(gameConfig.passives.some((passive) => passive.subtypeId === subtypeId && passive.effects.length > 0)).toBe(true);
    }
  });

  it('keeps the specified sealing, seed delay, corrosion, anti-heal, tracking and spread mechanics', () => {
    expect(gameConfig.skills.find((skill) => skill.id === 'venom-neuro-kappa-4')!.effects).toEqual(expect.arrayContaining([expect.objectContaining({ magnitude: 220, tags: expect.arrayContaining(['requires:energy-seal']) })]));
    expect(gameConfig.skills.find((skill) => skill.id === 'venom-neuro-delta-1')!.effects).toEqual(expect.arrayContaining([expect.objectContaining({ durationMs: 8000, stacks: 5, statusId: 'paralysis' })]));
    expect(gameConfig.skills.find((skill) => skill.id === 'venom-hemorrhage-c-1')!.effects).toEqual(expect.arrayContaining([expect.objectContaining({ statusId: 'anti-heal', durationMs: 4000 })]));
    expect(gameConfig.skills.find((skill) => skill.id === 'venom-coagulation-small-1')!.effects).toEqual(expect.arrayContaining([expect.objectContaining({ statusId: 'thrombosis', stacks: 4 }), expect.objectContaining({ tags: expect.arrayContaining(['spread-target-count:2']) })]));
  });

  it('places ground toxin cores at the caster when no ground pointer is available', () => {
    for (const id of ['venom-coagulation-diffuse-1', 'venom-coagulation-diffuse-2']) {
      expect(gameConfig.skills.find((skill) => skill.id === id)!.effects).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'mark', target: 'self', statusId: 'toxin-core', tags: expect.arrayContaining(['place-ground-core']) }),
      ]));
    }
    expect(gameConfig.skills.find((skill) => skill.id === 'venom-coagulation-diffuse-4')!.effects).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'damage', target: 'self', tags: expect.arrayContaining(['detonate-mark:toxin-core']) }),
    ]));
  });
});
