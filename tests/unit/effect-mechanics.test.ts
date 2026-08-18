import { describe, expect, it } from 'vitest';
import type { EffectDefinition } from '../../src/config';
import type { ActiveStatus } from '../../src/domain';
import { filterEffectsByChance, getEnemyCombatModifiers, isDelayedStatusCarrier, materializeCopiedStatus, materializeSpreadStackBonus, shouldBreakStatus } from '../../src/app/effect-mechanics';

describe('generic effect mechanics', () => {
  it('uses injected randomness and configured high-chance baseline', () => {
    const effects: EffectDefinition[] = [
      { type: 'status', target: 'target', magnitude: 0.3, tags: ['chance'] },
      { type: 'status', target: 'target', tags: ['high-chance'] },
    ];
    expect(filterEffectsByChance(effects, () => 0.9, 0.8)).toEqual([]);
    expect(filterEffectsByChance(effects, () => 0.2, 0.8)).toEqual(effects);
  });

  it('copies the configured source status without a skill-id branch', () => {
    const copied = materializeCopiedStatus(
      { type: 'trigger', target: 'area', tags: ['copy-status:thrombosis'] },
      [{ statusId: 'thrombosis', stacks: 4, remainingMs: 1500 }],
    );
    expect(copied).toMatchObject({ type: 'status', statusId: 'thrombosis', stacks: 4, durationMs: 1500 });
  });

  it('turns target reductions into actual attack, healing and physical damage multipliers', () => {
    const statuses: ActiveStatus[] = [
      { statusId: 'weakness', stacks: 1, remainingMs: 1000, magnitude: 0.25, tags: ['attack-reduction'] },
      { statusId: 'anti-heal', stacks: 1, remainingMs: 1000, magnitude: 0.5, tags: ['healing-reduction'] },
      { statusId: 'ulceration', stacks: 1, remainingMs: 1000, magnitude: 0.18, tags: ['physical-defense-reduction'] },
    ];
    expect(getEnemyCombatModifiers(statuses)).toEqual({ attackMultiplier: 0.75, healingMultiplier: 0.5, physicalDamageMultiplier: 1.18 });
  });

  it('copies the source stack count plus configured spread bonus', () => {
    expect(materializeSpreadStackBonus({ type: 'trigger', target: 'area', statusId: 'thrombosis', stacks: 2, tags: ['spread-stack-bonus'] }, [{ statusId: 'thrombosis', stacks: 4, remainingMs: 1500 }]))
      .toMatchObject({ type: 'status', statusId: 'thrombosis', stacks: 6, durationMs: 1500 });
  });

  it('breaks tagged statuses only for their configured damage threshold or action', () => {
    const status: ActiveStatus = { statusId: 'root', stacks: 1, remainingMs: 1000, tags: ['break-at-damage:50', 'break-on:move,attack,skill'] };
    expect(shouldBreakStatus(status, { damage: 49 })).toBe(false);
    expect(shouldBreakStatus(status, { damage: 50 })).toBe(true);
    expect(shouldBreakStatus(status, { action: 'attack' })).toBe(true);
    expect(shouldBreakStatus(status, { action: 'move' })).toBe(true);
  });

  it('delays status-bearing triggers but persists markers immediately', () => {
    expect(isDelayedStatusCarrier({ type: 'trigger', target: 'target', statusId: 'thrombosis', tags: ['delayed-coagulation'] })).toBe(true);
    expect(isDelayedStatusCarrier({ type: 'mark', target: 'target', statusId: 'toxin-seed', tags: ['delayed'] })).toBe(false);
  });
});
