import { describe, expect, it } from 'vitest';
import { getEnemyStatusModifiers, type ActiveStatus } from '../../src/domain';

const status = (statusId: string, magnitude: number, stacks: number, tags: string[]): ActiveStatus => ({
  statusId, magnitude, stacks, tags, remainingMs: 5_000,
});

describe('enemy status numeric snapshot', () => {
  it('derives all six combat values from status metadata, including per-stack values and caps', () => {
    const modifiers = getEnemyStatusModifiers([
      status('slow', 0.18, 3, ['move-speed-reduction-per-stack']),
      status('stiffness', 0.2, 1, ['attack-speed-reduction']),
      status('confusion', 0.3, 1, ['hit-chance-reduction']),
      status('weakness', 0.25, 2, ['attack-reduction', 'per-stack', 'cap:0.4']),
      status('frenzy', 0.1, 2, ['output-increase', 'per-stack', 'cap:0.15']),
      status('ulceration', 0.22, 1, ['physical-damage-taken']),
      status('lesion', 0.3, 1, ['venom-damage-taken']),
    ]);

    expect(modifiers).toEqual({
      moveSpeedMultiplier: 0.46,
      attackSpeedMultiplier: 0.8,
      hitChance: 0.7,
      outgoingDamageMultiplier: 0.69,
      physicalDamageTakenMultiplier: 1.22,
      venomDamageTakenMultiplier: 1.3,
      incomingDamageMultiplier: 1,
    });
  });

  it('clamps malformed or excessive reductions and damage modifiers to safe combat ranges', () => {
    const modifiers = getEnemyStatusModifiers([
      status('overload', 2, 1, ['move-speed-reduction', 'attack-speed-reduction', 'hit-chance-reduction', 'attack-reduction']),
      status('surge', 5, 1, ['output-increase', 'physical-damage-taken', 'venom-damage-taken']),
    ]);

    expect(modifiers).toMatchObject({
      moveSpeedMultiplier: 0.1,
      attackSpeedMultiplier: 0.1,
      hitChance: 0.05,
      outgoingDamageMultiplier: 0.3,
      physicalDamageTakenMultiplier: 3,
      venomDamageTakenMultiplier: 3,
      incomingDamageMultiplier: 1,
    });
  });
});
