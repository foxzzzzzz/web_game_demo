import type { EffectDefinition } from '../config';

export type EffectEvent = 'attack' | 'hit' | 'venom-bite' | 'venom-hit' | 'bleed-hit' | 'melee-hit' | 'confusion' | 'heart-erosion' | 'kidney-reprisal' | 'enemy-action' | 'counter-success';

const eventTag: Record<EffectEvent, string> = {
  attack: 'on-attack', hit: 'on-hit', 'venom-bite': 'on-venom-bite', 'venom-hit': 'on-venom-hit', 'bleed-hit': 'on-bleed-hit', 'melee-hit': 'on-melee-hit', confusion: 'on-confusion', 'heart-erosion': 'on-heart-erosion', 'kidney-reprisal': 'on-kidney-reprisal', 'enemy-action': 'on-enemy-skill-cast', 'counter-success': 'on-counter-success',
};

export function resolveEventEffects<T extends EffectDefinition>(effects: readonly T[], event: EffectEvent): T[] {
  return effects.filter((effect) => effect.tags?.includes(eventTag[event]));
}
