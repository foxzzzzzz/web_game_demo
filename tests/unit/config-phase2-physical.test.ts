import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../src/config';

const phase2PhysicalIds = [
  'size-force-molt', 'size-molt-shock', 'size-wound-surge', 'size-rotting-smoke', 'size-body-compress', 'size-ground-hide', 'size-burrow-ambush', 'size-ground-root', 'size-mountain-crush', 'size-chain-quake', 'size-brutal-ram', 'size-hold-stance', 'size-escape', 'size-pain-endure', 'size-tail-decoy', 'size-life-overdraw',
  'strength-defensive-stance', 'strength-swing-bite', 'strength-chain-pounce', 'strength-armor-break-ram', 'strength-rage-form', 'strength-rage-charge', 'strength-blood-bite', 'strength-anger-shock', 'strength-multi-coil', 'strength-choke', 'strength-drag-tear', 'strength-tight-root', 'strength-low-flight', 'strength-ambush-bite', 'strength-rapid-bite', 'strength-hunt-charge',
];

describe('Phase 2 physical effect contract', () => {
  it('replaces all generated placeholder effects with explicit Phase 2 effects', () => {
    for (const skillId of phase2PhysicalIds) {
      const skill = gameConfig.skills.find((entry) => entry.id === skillId)!;
      expect(skill.effects.some((effect) => effect.tags?.includes('source-mechanic') || (effect.statusId === 'bleed' && effect.tags?.includes('apply-status')))).toBe(false);
    }
  });

  it('preserves attachment values for dispel/heal, stealth, dot, counter, pull and back-attack', () => {
    const forceMolt = gameConfig.skills.find((entry) => entry.id === 'size-force-molt')!;
    expect(forceMolt.effects).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'dispel', stacks: 3 }),
      expect.objectContaining({ type: 'heal', magnitude: 120, durationMs: 8000 }),
    ]));
    expect(gameConfig.skills.find((entry) => entry.id === 'size-ground-hide')!.effects).toEqual(expect.arrayContaining([expect.objectContaining({ statusId: 'stealth', durationMs: 12000 })]));
    expect(gameConfig.skills.find((entry) => entry.id === 'strength-swing-bite')!.effects).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'damage', magnitude: 12, durationMs: 6000, stacks: 5, tags: expect.arrayContaining(['per-second']) })]));
    expect(gameConfig.skills.find((entry) => entry.id === 'strength-defensive-stance')!.effects).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'damage', magnitude: 90, tags: expect.arrayContaining(['on-melee-hit']) })]));
    expect(gameConfig.skills.find((entry) => entry.id === 'strength-drag-tear')!.effects).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'move', target: 'target', tags: expect.arrayContaining(['requires:root', 'pull-to-caster']) })]));
    expect(gameConfig.skills.find((entry) => entry.id === 'strength-ambush-bite')!.effects).toEqual(expect.arrayContaining([expect.objectContaining({ magnitude: 0.6, tags: expect.arrayContaining(['requires:back-attack']) })]));
  });
});
