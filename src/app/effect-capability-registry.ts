import type { EffectDefinition } from '../config';

/**
 * 配置标签不是实现本身。本表是 Phase1-4 的能力门禁：只有有通用处理器的标签
 * 才能被标记为已结算；其余机制保持显式未支持，供内容接入前审计。
 */
export type EffectCapability = 'domain-app' | 'runtime-visual' | 'metadata' | 'unsupported';

export interface EffectCapabilityAudit {
  readonly domainAppTags: string[];
  readonly runtimeVisualTags: string[];
  readonly metadataTags: string[];
  readonly unsupportedMechanicalTags: string[];
  readonly unclassifiedTags: string[];
}

const metadataTags = new Set([
  'baseline-quantified', 'direct-apply', 'toxin-bite', 'toxin-fang', 'toxin-fog', 'venom-corrosion',
  'bite', 'bite-base-damage', 'physical', 'single-target', 'multi-target', 'large-area', 'long-duration',
  'short-duration', 'high-stack', 'high-stacks', 'multiple-stacks', 'normal-attack-allowed', 'permanent',
  'permanent-reveal', 'self-cost', 'current-health-cost', 'of-this-damage', 'apply-status', 'apply-bleed',
  'apply:thrombosis', 'apply:weakness', 'status:root', 'root,bind', 'toxic-cloud', 'toxic-field',
  'toxin-apply-rate:x2', 'control-duration', 'duration-bonus', 'max-stacks', 'refresh-not-stack', 'blunt',
  'physical', 'venom', 'bite', 'impact',
  'high-cardiac-damage', 'high-venom-burst', 'high-visceral-damage', 'internal-burst', 'ram', 'squeeze',
  'refresh-status', 'retained-after-detonation', 'source-mechanic', 'environment:grass,cave',
]);

const domainAppTags = new Set([
  'per-second', 'detonate', 'extend-existing-status', 'decoy', 'stationary', 'this-attack-damage-bonus',
  'total-over-duration', 'knockback', 'pull-to-caster', 'spread', 'spread-target-count',
  'all-damage-reduction', 'damage-reduction', 'physical-damage-reduction', 'damage-taken-increase',
  'attack-damage', 'all-attack-damage', 'move-speed', 'move-speed-reduction', 'dodge', 'dodge-chance',
  'three-hits', 'two-pounces', 'rapid-bite-count', 'dash', 'pounce', 'forward-dash', 'forward-pounce',
  'chance', 'high-chance', 'healing-disabled', 'healing-reduction', 'attack-reduction', 'physical-defense-reduction',
  'extend-status', 'delay-status-expiry',
  'spread-stack-bonus',
  'control-immunity', 'slow-immunity', 'root-duration', 'paralysis-stack-rate', 'paralysis-duration-reduction',
  'stack-efficiency', 'muscle-debuff-stack-rate', 'move-speed-reduction-per-stack',
  'add-stacks', 'attack-speed-reduction', 'hit-chance-reduction', 'output-increase', 'cannot-move', 'max-health',
  'negative-debuff', 'physical-damage-taken', 'venom-damage-taken', 'place-ground-core', 'shield', 'on-contact',
  'per-stack', 'damage-split', 'mixed-physical-venom-damage',
  'interrupt-cast', 'taunt', 'knockback:small', 'knockup:small,medium',
  'after-expire', 'after-confusion-expire', 'backward-teleport', 'fast-pounce', 'long-range-pounce', 'short-pounce', 'forward',
  'charge-on-enemy-skill-cast', 'charge-rate-increase', 'locked-charge', 'damage-amplified-by-defense-loss', 'detonation-bonus',
  'damage-bonus', 'damage-taken', 'reprisal-damage-bonus', 'area-paralysis-burst', 'copy-muscle-debuff',
  'group-rapid-stack', 'group-root', 'large-paralysis-stacks', 'stack-and-detonate', 'tick-rate-multiplier',
  'counterattack', 'on-melee-hit', 'on-melee-hit:counterattack', 'on-counter-success',
  'effect-strength', 'heal-over-time', 'heal-over-time-multiplier', 'heart-erosion-control', 'heart-erosion-threshold',
  'paralysis-threshold', 'threshold-control-chance-increase', 'friendly-fire', 'hallucinogen-paralysis', 'on-confusion',
  'field-radius:7', 'lesion-mark', 'rapid-stack', 'toxic-fog', 'venom-residual', 'wander', 'wander-duration-bonus',
  'block-enemy-vision', 'short-stealth', 'bounce-target-count:1',
  'active-skill-blocked', 'on-venom-bite',
  'auto-lock', 'detect-radius-bonus', 'injured-target-reveal',
]);

const runtimeVisualTags = new Set([
  'line-wave', 'wave', 'ring-wave', 'shockwave', 'fan-wave', 'fan-spray', 'fan-projectile',
  'area-storm', 'field', 'impact', 'path-hit', 'toxic-cloud', 'toxic-field',
]);

const hasPrefix = (tag: string, prefix: string) => tag.startsWith(prefix);

/** Whether a tag describes gameplay beyond the EffectDefinition's native fields. */
export function isMechanicalTag(tag: string): boolean {
  return !metadataTags.has(tag) && !runtimeVisualTags.has(tag);
}

/**
 * Maps an individual tag use to the responsible layer. Prefix rules are
 * deliberately narrow; unrecognised tags fall through to unsupported rather
 * than becoming silently executable.
 */
export function classifyEffectTag(effect: Pick<EffectDefinition, 'type' | 'target' | 'tags' | 'magnitude' | 'stacks' | 'statusId'>, tag: string): EffectCapability {
  if (metadataTags.has(tag)) return 'metadata';
  if (runtimeVisualTags.has(tag)) return 'runtime-visual';
  if (domainAppTags.has(tag)) {
    if (tag === 'total-over-duration' && effect.type !== 'heal') return 'unsupported';
    if (['dash', 'pounce', 'forward-dash', 'forward-pounce'].includes(tag) && effect.type !== 'move') return 'unsupported';
    if (['three-hits', 'two-pounces', 'rapid-bite-count'].includes(tag) && (effect.type !== 'damage' || !effect.stacks)) return 'unsupported';
    if (tag === 'knockback' && (!effect.magnitude || effect.type !== 'trigger')) return 'unsupported';
    return 'domain-app';
  }
  if (hasPrefix(tag, 'requires:') || hasPrefix(tag, 'clear-status:') || /^per-.+-stack$/.test(tag)) return 'domain-app';
  if (hasPrefix(tag, 'spread:') || hasPrefix(tag, 'detonate-residual-mark:')) return 'domain-app';
  if (/^break-at-damage:\d+(?:\.\d+)?$/.test(tag) || /^break-on:[a-z,]+$/.test(tag)) return 'domain-app';
  if (/^cap:\d+(?:\.\d+)?$/.test(tag) || /^per-missing-health(?::|-)\d+/.test(tag)) return 'domain-app';
  if (/^continuous:[a-z,-]+$/.test(tag) || /^on-enter:[a-z-]+$/.test(tag) || /^detonate-mark:[a-z-]+$/.test(tag)) return 'domain-app';
  if (hasPrefix(tag, 'delayed-') || /^on-[a-z-]+-expire$/.test(tag)) return 'domain-app';
  if (tag === 'damage-split' || hasPrefix(tag, 'damage-split:') || hasPrefix(tag, 'ignore-physical-defense:')) return 'domain-app';
  if (['on-attack', 'on-enemy-skill-cast', 'on-hit', 'on-venom-hit', 'on-bleed-hit', 'on-heart-erosion', 'on-kidney-reprisal'].includes(tag)) return 'domain-app';
  if (hasPrefix(tag, 'copy-status:') && effect.type === 'trigger') return 'domain-app';
  if (hasPrefix(tag, 'convert:') && effect.statusId) return 'domain-app';
  if (/^radius:\d+(?:\.\d+)?$/.test(tag) && effect.target === 'area') return 'domain-app';
  if (/^(?:field-radius|smoke-radius|front-radius):\d+(?:\.\d+)?$/.test(tag) && effect.target === 'area') return 'domain-app';
  if (/^spread-target-count:\d+$/.test(tag)) return 'domain-app';
  if (tag === 'delayed' && effect.statusId) return 'domain-app';
  if (tag === 'damage-over-time-visual' || tag === 'status-visual') return 'runtime-visual';
  return 'unsupported';
}

export function auditEffectCapabilities(effects: readonly Pick<EffectDefinition, 'type' | 'target' | 'tags' | 'magnitude' | 'stacks' | 'statusId'>[]): EffectCapabilityAudit {
  const groups: Record<EffectCapability, Set<string>> = {
    'domain-app': new Set(),
    'runtime-visual': new Set(),
    metadata: new Set(),
    unsupported: new Set(),
  };
  for (const effect of effects) for (const tag of effect.tags ?? []) groups[classifyEffectTag(effect, tag)].add(tag);
  const sorted = (tags: Set<string>) => [...tags].sort();
  return {
    domainAppTags: sorted(groups['domain-app']),
    runtimeVisualTags: sorted(groups['runtime-visual']),
    metadataTags: sorted(groups.metadata),
    unsupportedMechanicalTags: sorted(new Set([...groups.unsupported].filter(isMechanicalTag))),
    // classifyEffectTag has an explicit unsupported fallback. This stays empty
    // unless a future capability category is added without audit wiring.
    unclassifiedTags: [],
  };
}
