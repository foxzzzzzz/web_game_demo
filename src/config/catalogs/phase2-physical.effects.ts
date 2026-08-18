import type { EffectDefinition } from '../types';

/** Phase 2 体型/力量剩余分支的附件精确效果；字段单位沿用 EffectDefinition。 */
export const phase2PhysicalEffects: Record<string, EffectDefinition[]> = {
  'size-force-molt': [{ type: 'dispel', target: 'self', stacks: 3, tags: ['negative-debuff'] }, { type: 'buff', target: 'self', statusId: 'life-surge', durationMs: 8000, tags: ['heal-over-time'] }, { type: 'heal', target: 'self', magnitude: 120, durationMs: 8000, tags: ['total-over-duration'] }],
  'size-molt-shock': [{ type: 'damage', target: 'area', magnitude: 60, tags: ['radius:5', 'blunt'] }, { type: 'trigger', target: 'area', tags: ['knockback:small'] }],
  'size-wound-surge': [{ type: 'heal', target: 'self', magnitude: 22, durationMs: 7000, tags: ['per-second', 'field-radius:7'] }],
  'size-rotting-smoke': [{ type: 'buff', target: 'self', statusId: 'dodge', magnitude: 0.3, durationMs: 5000, tags: ['dodge-chance'] }, { type: 'trigger', target: 'area', tags: ['smoke-radius:9', 'block-enemy-vision'] }],
  'size-body-compress': [{ type: 'buff', target: 'self', statusId: 'semi-stealth', durationMs: 4000, tags: ['break-on:attack,skill'] }, { type: 'buff', target: 'self', magnitude: 0.15, durationMs: 4000, tags: ['move-speed-reduction'] }],
  'size-ground-hide': [{ type: 'buff', target: 'self', statusId: 'stealth', durationMs: 12000, tags: ['break-on:move,attack,skill', 'stationary'] }],
  'size-burrow-ambush': [{ type: 'move', target: 'self', magnitude: 6, tags: ['requires:stealth', 'forward-pounce'] }, { type: 'damage', target: 'target', magnitude: 130, tags: ['bite'] }, { type: 'buff', target: 'self', magnitude: 0.4, tags: ['requires:stealth', 'this-attack-damage-bonus'] }],
  'size-ground-root': [{ type: 'status', target: 'target', statusId: 'root', stacks: 1, durationMs: 4000, tags: ['break-at-damage:160'] }, { type: 'damage', target: 'target', magnitude: 45, durationMs: 4000, tags: ['per-second', 'squeeze'] }],
  'size-mountain-crush': [{ type: 'damage', target: 'area', magnitude: 140, tags: ['front-radius:5', 'blunt'] }, { type: 'status', target: 'area', statusId: 'slow', stacks: 1, durationMs: 3000, magnitude: 0.3, tags: ['move-speed-reduction'] }],
  'size-chain-quake': [{ type: 'damage', target: 'area', magnitude: 55, stacks: 3, tags: ['radius:7', 'three-hits'] }, { type: 'status', target: 'area', statusId: 'weakness', stacks: 3, durationMs: 4000, magnitude: 0.18, tags: ['move-speed-reduction-per-stack'] }],
  'size-brutal-ram': [{ type: 'move', target: 'self', magnitude: 11, tags: ['dash'] }, { type: 'damage', target: 'target', magnitude: 200, tags: ['impact'] }, { type: 'trigger', target: 'target', tags: ['knockup:small,medium'] }],
  'size-hold-stance': [{ type: 'shield', target: 'self', magnitude: 240, durationMs: 5000, statusId: 'shield', tags: ['cannot-move'] }, { type: 'buff', target: 'self', magnitude: 0.42, durationMs: 5000, tags: ['physical-damage-reduction'] }],
  'size-escape': [{ type: 'dispel', target: 'self', tags: ['status:root', 'negative-debuff'] }, { type: 'buff', target: 'self', statusId: 'escape-immunity', durationMs: 3000, tags: ['control-immunity'] }],
  'size-pain-endure': [{ type: 'buff', target: 'self', magnitude: 0.32, durationMs: 4000, tags: ['all-damage-reduction'] }, { type: 'buff', target: 'self', statusId: 'slow-immunity', durationMs: 4000, tags: ['slow-immunity'] }],
  'size-tail-decoy': [{ type: 'move', target: 'self', magnitude: 7, tags: ['backward-teleport'] }, { type: 'trigger', target: 'area', durationMs: 6000, tags: ['decoy', 'taunt'] }, { type: 'shield', target: 'self', magnitude: 110, statusId: 'shield', tags: ['shield'] }],
  'size-life-overdraw': [{ type: 'damage', target: 'self', magnitude: 0.22, tags: ['current-health-cost'] }, { type: 'buff', target: 'self', magnitude: 0.35, durationMs: 6000, tags: ['move-speed'] }, { type: 'buff', target: 'self', magnitude: 0.28, durationMs: 6000, tags: ['attack-damage'] }],
  'strength-defensive-stance': [{ type: 'buff', target: 'self', magnitude: 0.3, durationMs: 3500, tags: ['damage-reduction'] }, { type: 'damage', target: 'target', magnitude: 90, tags: ['on-melee-hit', 'counterattack'] }],
  'strength-swing-bite': [{ type: 'damage', target: 'target', magnitude: 120, tags: ['bite'] }, { type: 'status', target: 'target', statusId: 'bleed', stacks: 5, durationMs: 6000, tags: ['apply-bleed'] }, { type: 'damage', target: 'target', magnitude: 12, stacks: 5, durationMs: 6000, statusId: 'bleed', tags: ['per-second', 'per-stack'] }],
  'strength-chain-pounce': [{ type: 'damage', target: 'target', magnitude: 100, stacks: 2, tags: ['two-pounces'] }],
  'strength-armor-break-ram': [{ type: 'damage', target: 'target', magnitude: 150, tags: ['ram', 'ignore-physical-defense:0.35'] }],
  'strength-rage-form': [{ type: 'buff', target: 'self', statusId: 'rage', magnitude: 0.4, durationMs: 5000, tags: ['attack-damage'] }, { type: 'buff', target: 'self', magnitude: 0.25, durationMs: 5000, tags: ['damage-taken-increase'] }],
  'strength-rage-charge': [{ type: 'move', target: 'self', magnitude: 12, tags: ['requires:rage', 'dash'] }, { type: 'damage', target: 'area', magnitude: 140, tags: ['requires:rage', 'path-hit', 'radius:12'] }],
  'strength-blood-bite': [{ type: 'damage', target: 'target', magnitude: 180, tags: ['bite'] }, { type: 'heal', target: 'self', magnitude: 0.35, tags: ['of-this-damage'] }],
  'strength-anger-shock': [{ type: 'damage', target: 'area', magnitude: 110, tags: ['shockwave', 'radius:6'] }, { type: 'buff', target: 'target', magnitude: 0.45, statusId: 'bleed', tags: ['requires:bleed', 'damage-taken'] }],
  'strength-multi-coil': [{ type: 'move', target: 'self', tags: ['pounce'] }, { type: 'status', target: 'target', statusId: 'root', stacks: 1, tags: ['single-target'] }],
  'strength-choke': [{ type: 'damage', target: 'target', magnitude: 60, durationMs: 1000, tags: ['per-second', 'requires:root', 'squeeze'] }],
  'strength-drag-tear': [{ type: 'move', target: 'target', tags: ['requires:root', 'pull-to-caster'] }],
  'strength-tight-root': [{ type: 'status', target: 'target', statusId: 'root', stacks: 1, tags: ['break-at-damage:240'] }],
  'strength-low-flight': [{ type: 'move', target: 'self', magnitude: 7, tags: ['fast-pounce'] }, { type: 'damage', target: 'target', magnitude: 110, tags: ['physical'] }],
  'strength-ambush-bite': [{ type: 'damage', target: 'target', tags: ['bite', 'requires:back-attack'] }, { type: 'buff', target: 'self', magnitude: 0.6, tags: ['requires:back-attack', 'this-attack-damage-bonus'] }],
  'strength-rapid-bite': [{ type: 'damage', target: 'target', magnitude: 95, stacks: 2, tags: ['rapid-bite-count'] }],
  'strength-hunt-charge': [{ type: 'move', target: 'self', magnitude: 14, tags: ['requires:injured-target', 'locked-charge'] }, { type: 'damage', target: 'target', magnitude: 175, tags: ['requires:injured-target'] }],
};

export const phase2PhysicalMetadata: Record<string, { baseDamage?: number; statusId?: string | null; statusStacks?: number }> = {
  'size-force-molt': { baseDamage: 0, statusId: null }, 'size-molt-shock': { baseDamage: 60, statusId: null }, 'size-wound-surge': { baseDamage: 0, statusId: null }, 'size-rotting-smoke': { baseDamage: 0, statusId: null },
  'size-body-compress': { baseDamage: 0, statusId: null }, 'size-ground-hide': { baseDamage: 0, statusId: null }, 'size-burrow-ambush': { baseDamage: 130, statusId: null }, 'size-ground-root': { baseDamage: 45, statusId: 'root', statusStacks: 1 },
  'size-mountain-crush': { baseDamage: 140, statusId: 'slow', statusStacks: 1 }, 'size-chain-quake': { baseDamage: 55, statusId: 'weakness', statusStacks: 3 }, 'size-brutal-ram': { baseDamage: 200, statusId: null }, 'size-hold-stance': { baseDamage: 0, statusId: null },
  'size-escape': { baseDamage: 0, statusId: null }, 'size-pain-endure': { baseDamage: 0, statusId: null }, 'size-tail-decoy': { baseDamage: 0, statusId: null }, 'size-life-overdraw': { baseDamage: 0, statusId: null },
  'strength-defensive-stance': { baseDamage: 90, statusId: null }, 'strength-swing-bite': { baseDamage: 120, statusId: 'bleed', statusStacks: 5 }, 'strength-chain-pounce': { baseDamage: 100, statusId: null }, 'strength-armor-break-ram': { baseDamage: 150, statusId: null },
  'strength-rage-form': { baseDamage: 0, statusId: null }, 'strength-rage-charge': { baseDamage: 140, statusId: null }, 'strength-blood-bite': { baseDamage: 180, statusId: null }, 'strength-anger-shock': { baseDamage: 110, statusId: null },
  'strength-multi-coil': { baseDamage: 0, statusId: 'root', statusStacks: 1 }, 'strength-choke': { baseDamage: 60, statusId: null }, 'strength-drag-tear': { baseDamage: 0, statusId: null }, 'strength-tight-root': { baseDamage: 0, statusId: 'root', statusStacks: 1 },
  'strength-low-flight': { baseDamage: 110, statusId: null }, 'strength-ambush-bite': { baseDamage: 0, statusId: null }, 'strength-rapid-bite': { baseDamage: 95, statusId: null }, 'strength-hunt-charge': { baseDamage: 175, statusId: null },
};

/** Phase 2 八个分支被动的附件说明与可执行修正，供内容组合入口复用。 */
export const phase2PhysicalPassiveDescriptions: Record<string, string> = {
  'size-regeneration-passive': '自身所有持续回血治疗量永久提高30%。', 'size-stealth-passive': '草丛、洞穴环境移动速度永久提高22%。', 'size-oppression-passive': '自身最大生命值永久增加220点。', 'size-adversity-passive': '每损失10%生命提高4.5%物理减伤，最高36%。',
  'strength-counter-passive': '格挡反击成功后获得5秒锐化，攻击伤害提高26%。', 'strength-rage-passive': '每损失10%生命提高7%攻击伤害，最高35%。', 'strength-strangle-passive': '缠绕、禁锢类控制持续时间提高35%。', 'strength-hunt-passive': '永久拥有猎手感知，可透视周围受伤猎物位置。',
};

export const phase2PhysicalPassiveEffects: Record<string, EffectDefinition[]> = {
  'size-regeneration-passive': [{ type: 'buff', target: 'self', magnitude: 0.3, tags: ['heal-over-time-multiplier', 'permanent'] }],
  'size-stealth-passive': [{ type: 'buff', target: 'self', magnitude: 0.22, tags: ['move-speed', 'environment:grass,cave', 'permanent'] }],
  'size-oppression-passive': [{ type: 'buff', target: 'self', magnitude: 220, tags: ['max-health', 'permanent'] }],
  'size-adversity-passive': [{ type: 'trigger', target: 'self', magnitude: 0.045, stacks: 8, tags: ['per-missing-health-10-percent', 'physical-damage-reduction', 'cap:0.36'] }],
  'strength-counter-passive': [{ type: 'trigger', target: 'self', magnitude: 0.26, durationMs: 5000, statusId: 'sharpen', tags: ['on-counter-success', 'attack-damage'] }],
  'strength-rage-passive': [{ type: 'trigger', target: 'self', magnitude: 0.07, stacks: 5, tags: ['per-missing-health-10-percent', 'attack-damage', 'cap:0.35'] }],
  'strength-strangle-passive': [{ type: 'buff', target: 'self', magnitude: 0.35, tags: ['root-duration', 'control-duration'] }],
  'strength-hunt-passive': [{ type: 'buff', target: 'self', statusId: 'hunter-sense', tags: ['permanent', 'injured-target-reveal'] }],
};
