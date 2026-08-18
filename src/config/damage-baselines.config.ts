import type { EffectDefinition } from './types';

/**
 * 原稿未给出伤害数字时的首版可执行基线，单位：伤害点。
 * 明确伤害数值绝不经过此表覆盖；按层伤害使用 perStackDetonation 作为“每层”值。
 */
export const damageBaselines = {
  /** 未量化的普通直伤（毒波、打断、背刺等）。 */
  directHit: 90,
  /** 未量化的按状态层数引爆，每层造成的伤害。 */
  perStackDetonation: 14,
  /** 未量化的标记/毒核/内脏爆发。 */
  burstDetonation: 100,
  /** 未量化的状态到期残留伤害，每个结算周期。 */
  residualTick: 8,
} as const;

const mixedDamageSplitTag = 'damage-split:physical:0.5,venom:0.5';

/** 将内容目录中的未量化伤害归入语义档位；不依赖任何技能 ID。 */
export function applyDamageBaselines(effects: EffectDefinition[]): EffectDefinition[] {
  return effects.map((effect) => {
    if (effect.type !== 'damage') return effect;
    const tags = effect.tags?.includes('mixed-physical-venom-damage') && !effect.tags.includes(mixedDamageSplitTag)
      ? [...effect.tags, mixedDamageSplitTag]
      : effect.tags;
    if (effect.magnitude !== undefined && effect.magnitude > 0) return tags === effect.tags ? effect : { ...effect, tags };
    return { ...effect, magnitude: damageBaselineFor(tags ?? []), ...(tags ? { tags } : {}) };
  });
}

function damageBaselineFor(tags: string[]): number {
  if (tags.some((tag) => /^per-.+-stack$/.test(tag))) return damageBaselines.perStackDetonation;
  if (tags.some((tag) => tag === 'after-expire' || tag === 'venom-residual')) return damageBaselines.residualTick;
  if (tags.some((tag) => tag === 'detonate' || tag.startsWith('detonate-mark:') || tag === 'high-visceral-damage' || tag === 'high-cardiac-damage' || tag === 'high-venom-burst' || tag === 'internal-burst')) return damageBaselines.burstDetonation;
  return damageBaselines.directHit;
}
