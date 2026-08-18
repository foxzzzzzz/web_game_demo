import { describe, expect, it } from 'vitest';
import { gameConfig, type EffectDefinition } from '../../src/config';
import {
  auditEffectCapabilities,
  classifyEffectTag,
  isMechanicalTag,
} from '../../src/app/effect-capability-registry';

describe('effect capability audit gate', () => {
  it('classifies every configured effect tag without treating unknown mechanics as supported', () => {
    const audit = auditEffectCapabilities([
      ...gameConfig.skills.flatMap((skill) => skill.effects),
      ...gameConfig.passives.flatMap((passive) => passive.effects),
    ]);

    expect(audit.unclassifiedTags).toEqual([]);
    expect(audit.domainAppTags).toContain('chance');
    expect(audit.domainAppTags).toContain('copy-status:paralysis');
    expect(audit.domainAppTags).toContain('spread-stack-bonus');
    // Deliberate gaps stay visible in CI output instead of being silently
    // promoted merely because content configured a tag.
    console.info(`[effect-capability-audit] unsupported mechanical tags (${audit.unsupportedMechanicalTags.length}): ${audit.unsupportedMechanicalTags.join(', ')}`);
  });

  it('keeps a mechanical tag unsupported until a concrete handler is registered', () => {
    const effect: EffectDefinition = { type: 'trigger', target: 'target', tags: ['mechanical-no-handler'] };

    expect(isMechanicalTag('mechanical-no-handler')).toBe(true);
    expect(classifyEffectTag(effect, 'mechanical-no-handler')).toBe('unsupported');
  });

  it('calibrates classifications against existing generic resolvers', () => {
    const selfBuff: EffectDefinition = { type: 'buff', target: 'self', magnitude: 0.2 };
    const hit: EffectDefinition = { type: 'damage', target: 'target', magnitude: 10, stacks: 2 };
    const movement: EffectDefinition = { type: 'move', target: 'self', magnitude: 6 };

    ['all-damage-reduction', 'attack-damage', 'damage-taken-increase', 'move-speed', 'physical-damage-reduction', 'dodge'].forEach((tag) => {
      expect(classifyEffectTag(selfBuff, tag)).toBe('domain-app');
    });
    ['three-hits', 'two-pounces', 'detonate', 'per-bleed-stack', 'requires:bleed'].forEach((tag) => {
      expect(classifyEffectTag(hit, tag)).toBe('domain-app');
    });
    ['dash', 'pounce'].forEach((tag) => expect(classifyEffectTag(movement, tag)).toBe('domain-app'));
    expect(classifyEffectTag({ type: 'trigger', target: 'target', magnitude: 3 }, 'knockback')).toBe('domain-app');
    expect(classifyEffectTag(hit, 'blunt')).toBe('metadata');
    expect(classifyEffectTag(hit, 'physical')).toBe('metadata');
  });
});
