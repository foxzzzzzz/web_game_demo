import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../src/config';

const phase3Ids = ['venom-hemorrhage-a', 'venom-coagulation-oscutarin-c', 'venom-necrosis-beta', 'venom-hallucinogen-i', 'venom-muscle-alpha', 'venom-kidney-s', 'venom-heart-gamma'];

describe('Phase 3 default venom contract', () => {
  it('replaces all seven default subtype skill placeholders with explicit effects', () => {
    for (const subtypeId of phase3Ids) for (const skill of gameConfig.skills.filter((entry) => entry.subtypeId === subtypeId)) expect(skill.effects.some((effect) => effect.tags?.includes('source-mechanic'))).toBe(false);
  });

  it('records specified dot, stack, detonation, confusion and kidney-reprisal values', () => {
    expect(gameConfig.skills.find((skill) => skill.id === 'venom-hemorrhage-a-1')!.effects).toEqual(expect.arrayContaining([expect.objectContaining({ statusId: 'bleed', stacks: 6 }), expect.objectContaining({ type: 'damage', magnitude: 11, durationMs: 5000, tags: expect.arrayContaining(['per-second', 'per-stack']) })]));
    expect(gameConfig.skills.find((skill) => skill.id === 'venom-coagulation-oscutarin-c-4')!.effects).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'status', statusId: 'root', durationMs: 3000, tags: expect.arrayContaining(['requires:thrombosis-stacks:12']) })]));
    expect(gameConfig.skills.find((skill) => skill.id === 'venom-hallucinogen-i-1')!.effects).toEqual(expect.arrayContaining([expect.objectContaining({ statusId: 'confusion', durationMs: 2500 })]));
    expect(gameConfig.skills.find((skill) => skill.id === 'venom-kidney-s-1')!.effects).toEqual(expect.arrayContaining([expect.objectContaining({ statusId: 'kidney-reprisal', durationMs: 6000 })]));
  });
});
