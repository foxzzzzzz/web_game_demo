import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../src/config';
import type { EffectDefinition } from '../../src/config';

const effects = [...gameConfig.skills, ...gameConfig.passives].flatMap((entry) => entry.effects);
const hasTag = (effect: EffectDefinition, predicate: (tag: string) => boolean) => effect.tags?.some(predicate) ?? false;
const hasFiniteAreaRange = (effect: EffectDefinition) => hasTag(effect, (tag) => /^(?:radius|field-radius|front-radius|smoke-radius|area-radius):\d+(?:\.\d+)?$/.test(tag));

describe('mechanical parameter completeness audit', () => {
  it('provides a probability for chance tags and finite ranges for area effects', () => {
    for (const effect of effects.filter((entry) => hasTag(entry, (tag) => tag === 'chance' || tag === 'high-chance'))) expect(effect.magnitude).toBeGreaterThan(0);
    for (const effect of effects.filter((entry) => entry.target === 'area')) expect(hasFiniteAreaRange(effect)).toBe(true);
  });

  it('provides duration for delayed or extension semantics and magnitude for movement', () => {
    for (const effect of effects.filter((entry) => hasTag(entry, (tag) => tag.includes('delayed') || tag.includes('expire') || tag === 'extend-status' || tag === 'delay-status-expiry'))) expect(effect.durationMs).toBeGreaterThan(0);
    for (const effect of effects.filter((entry) => entry.type === 'move')) expect(effect.magnitude).toBeGreaterThan(0);
  });

  it('provides magnitude for reductions/amplifications and usable duration plus stacks for statuses', () => {
    for (const effect of effects.filter((entry) => hasTag(entry, (tag) => /(?:reduction|damage-taken|damage-bonus|amplified|amplification|attack-reduction|attack-speed-reduction|hit-chance-reduction)/.test(tag)))) expect(effect.magnitude).toBeGreaterThan(0);
    for (const effect of effects.filter((entry) => entry.type === 'status')) {
      expect(effect.durationMs).toBeGreaterThan(0);
      expect(effect.stacks).toBeGreaterThan(0);
    }
  });
});
