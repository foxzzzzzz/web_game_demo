import { describe, expect, it } from 'vitest';
import { gameConfig, validateGameConfig } from '../../src/config';

const phaseOneSkillIds = [
  'size-gale-glide', 'size-flexible-dodge', 'size-hide-harden', 'size-colossus-shock',
  'strength-lock-coil', 'strength-force-burst', 'strength-savage-charge', 'strength-pounce-bite',
  'venom-neuro-needle', 'venom-neuro-alpha-2', 'venom-neuro-alpha-3', 'venom-neuro-alpha-4',
];

describe('Phase 1 exact effect contract', () => {
  it('keeps the 12 vertical-slice skills free of generic trigger/default-bleed effects', () => {
    for (const skillId of phaseOneSkillIds) {
      const skill = gameConfig.skills.find((entry) => entry.id === skillId)!;
      expect(skill.effects.some((effect) => effect.tags?.includes('source-mechanic') || effect.statusId === 'bleed')).toBe(false);
    }
  });

  it('records the attachment values for movement, mitigation, dots, status duration and detonation conditions', () => {
    const gale = gameConfig.skills.find((entry) => entry.id === 'size-gale-glide')!;
    expect(gale.effects).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'move', magnitude: 8, target: 'self' }),
      expect.objectContaining({ type: 'buff', statusId: 'dodge', magnitude: 0.25, durationMs: 3000 }),
    ]));
    const coil = gameConfig.skills.find((entry) => entry.id === 'strength-lock-coil')!;
    expect(coil.effects).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'status', statusId: 'root', durationMs: 4000 }),
      expect.objectContaining({ type: 'damage', magnitude: 52, durationMs: 4000, tags: expect.arrayContaining(['per-second']) }),
    ]));
    const burst = gameConfig.skills.find((entry) => entry.id === 'venom-neuro-alpha-4')!;
    expect(burst.baseDamage).toBe(0);
    expect(burst.effects).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'damage', magnitude: 14, tags: expect.arrayContaining(['per-paralysis-stack', 'detonate']) }),
      expect.objectContaining({ type: 'status', statusId: 'stun', durationMs: 2500, tags: expect.arrayContaining(['requires:paralysis-stacks:10']) }),
    ]));
  });

  it('rejects effects with an unregistered type/tag mechanism', () => {
    const invalid = structuredClone(gameConfig);
    invalid.skills.find((entry) => entry.id === 'size-gale-glide')!.effects[0].tags = ['unregistered-mechanic'];
    expect(() => validateGameConfig(invalid)).toThrow(/未注册/);
  });
});
