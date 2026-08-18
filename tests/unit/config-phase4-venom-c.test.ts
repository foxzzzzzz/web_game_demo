import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../src/config';

const subtypes = ['venom-muscle-gamma', 'venom-muscle-delta', 'venom-kidney-l', 'venom-kidney-m', 'venom-kidney-x', 'venom-heart-delta', 'venom-heart-epsilon', 'venom-heart-zeta'];

describe('Phase 4 venom batch C contract', () => {
  it('replaces the final 32 skill placeholders and provides all eight passives', () => {
    for (const subtypeId of subtypes) {
      expect(gameConfig.skills.filter((skill) => skill.subtypeId === subtypeId)).toHaveLength(4);
      expect(gameConfig.passives.some((passive) => passive.subtypeId === subtypeId && passive.effects.length > 0)).toBe(true);
    }
    expect(gameConfig.skills.flatMap((skill) => skill.effects).some((effect) => effect.tags?.includes('source-mechanic'))).toBe(false);
  });

  it('captures explicit stacking, duration, dual-debuff and cardiac-control semantics', () => {
    expect(gameConfig.skills.find((skill) => skill.id === 'venom-muscle-delta-1')!.maxCharges).toBe(3);
    expect(gameConfig.passives.find((passive) => passive.id === 'venom-muscle-delta-passive')!.effects).toEqual(expect.arrayContaining([expect.objectContaining({ magnitude: 0.5, tags: expect.arrayContaining(['muscle-debuff-stack-rate']) })]));
    expect(gameConfig.passives.find((passive) => passive.id === 'venom-kidney-m-passive')!.effects).toEqual(expect.arrayContaining([expect.objectContaining({ durationMs: 3000, statusId: 'kidney-reprisal' })]));
    expect(gameConfig.skills.find((skill) => skill.id === 'venom-kidney-m-3')!.effects).toEqual(expect.arrayContaining([expect.objectContaining({ durationMs: 3000, statusId: 'kidney-reprisal', tags: expect.arrayContaining(['delay-status-expiry', 'baseline-quantified']) })]));
    expect(gameConfig.skills.find((skill) => skill.id === 'venom-kidney-l-1')!.effects).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'status', statusId: 'kidney-reprisal' }), expect.objectContaining({ type: 'status', statusId: 'bleed' })]));
    expect(gameConfig.skills.find((skill) => skill.id === 'venom-muscle-gamma-4')!.effects).toEqual(expect.arrayContaining([expect.objectContaining({ statusId: 'muscle-stiffness', tags: expect.arrayContaining(['convert:weakness']) })]));
    expect(gameConfig.skills.find((skill) => skill.id === 'venom-muscle-gamma-1')!.effects).toEqual(expect.arrayContaining([expect.objectContaining({ statusId: 'weakness', stacks: 3, tags: expect.arrayContaining(['high-stack', 'baseline-quantified']) })]));
    expect(gameConfig.statuses['heart-erosion'].thresholdStatusId).toBeUndefined();
    expect(gameConfig.passives.find((passive) => passive.id === 'venom-heart-epsilon-passive')!.effects).toEqual(expect.arrayContaining([
      expect.objectContaining({ statusId: 'stun', stacks: 12, tags: expect.arrayContaining(['heart-erosion-threshold', 'chance']) }),
    ]));
    expect(gameConfig.skills.find((skill) => skill.id === 'venom-heart-zeta-3')!.effects).toEqual(expect.arrayContaining([expect.objectContaining({ durationMs: 3000, statusId: 'heart-erosion' })]));
    const residuals = [
      ...gameConfig.skills.find((skill) => skill.id === 'venom-heart-zeta-4')!.effects,
      ...gameConfig.passives.find((passive) => passive.id === 'venom-heart-zeta-passive')!.effects,
    ].filter((effect) => effect.tags?.includes('after-expire') && effect.tags.includes('venom-residual'));
    expect(residuals).toHaveLength(2);
    for (const effect of residuals) expect(effect).toMatchObject({ type: 'damage', magnitude: 8, durationMs: 2000, tags: expect.arrayContaining(['per-second']) });
  });
});
