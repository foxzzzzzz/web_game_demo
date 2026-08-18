import type { EffectDefinition } from './types';
import { numericMechanicBaselines } from './numeric-mechanic-baselines.config';
import { eventMechanicBaselines } from './event-mechanic-baselines.config';

/**
 * 原稿仅描述机制、未给参数时的首版机械基线。
 * 单位：概率为 [0,1] 小数，距离为米，时间为毫秒，增减益为比例，层数为层。
 */
export const mechanicBaselines = {
  /** 普通“概率”标签的默认命中概率。 */
  chanceProbability: 0.3,
  /** “高概率”标签的默认命中概率。 */
  highChanceProbability: 0.8,
  /** 未量化范围、领域、烟雾或扇形的统一半径。 */
  areaRadius: 6,
  /** 未量化位移/扑击的统一距离。 */
  moveDistance: 6,
  /** 未量化延时、延续或到期链的默认时长。 */
  delayedDurationMs: 3000,
  /** 状态未写持续时间时的统一首版持续时间。 */
  statusDurationMs: 6000,
  /** 未量化减伤、易伤、减速等修正的统一比例。 */
  modifierRatio: 0.2,
  /** 未量化状态默认施加层数。 */
  statusStacks: 1,
} as const;

/** 以效果类型和标签族补齐运行时必需参数；明确参数保持原值，绝不按技能 ID 分支。 */
export function applyMechanicalBaselines(effects: EffectDefinition[]): EffectDefinition[] {
  return effects.map((effect) => {
    const tags = [...(effect.tags ?? [])];
    let magnitude = effect.magnitude;
    let durationMs = effect.durationMs;
    let stacks = effect.stacks;
    if (effect.target === 'area' && !tags.some((tag) => /^(?:radius|field-radius|front-radius|smoke-radius|area-radius):\d+(?:\.\d+)?$/.test(tag))) tags.push(`radius:${mechanicBaselines.areaRadius}`);
    if ((tags.includes('chance') || tags.includes('high-chance')) && magnitude === undefined) magnitude = tags.includes('high-chance') ? mechanicBaselines.highChanceProbability : mechanicBaselines.chanceProbability;
    if (tags.some((tag) => tag.includes('delayed') || tag.includes('expire') || tag === 'extend-status' || tag === 'delay-status-expiry') && durationMs === undefined) durationMs = mechanicBaselines.delayedDurationMs;
    if (effect.type === 'move' && magnitude === undefined) magnitude = mechanicBaselines.moveDistance;
    if (effect.type === 'damage' && magnitude === undefined && tags.includes('counterattack')) magnitude = eventMechanicBaselines.counterattackDamage;
    if (effect.type === 'status') {
      if (durationMs === undefined) durationMs = mechanicBaselines.statusDurationMs;
      if (stacks === undefined) stacks = mechanicBaselines.statusStacks;
    }
    if (magnitude === undefined) {
      const numericBaseline = tags.includes('damage-amplified-by-defense-loss') ? numericMechanicBaselines.damageAmplifiedByDefenseLoss
        : tags.includes('detonation-bonus') ? numericMechanicBaselines.detonationBonus
          : tags.includes('reprisal-damage-bonus') ? numericMechanicBaselines.reprisalDamageBonus
            : tags.includes('effect-strength') ? numericMechanicBaselines.effectStrength
              : tags.includes('charge-rate-increase') ? numericMechanicBaselines.chargeRateIncrease
                : tags.includes('threshold-control-chance-increase') ? numericMechanicBaselines.thresholdControlChanceIncrease
                  : tags.includes('damage-bonus') ? numericMechanicBaselines.damageBonus : undefined;
      if (numericBaseline !== undefined) magnitude = numericBaseline;
    }
    if (magnitude === undefined && tags.some((tag) => /(?:reduction|damage-taken|damage-bonus|amplified|amplification|attack-reduction|attack-speed-reduction|hit-chance-reduction)/.test(tag))) magnitude = mechanicBaselines.modifierRatio;
    const sameTags = tags.length === (effect.tags?.length ?? 0);
    return sameTags && magnitude === effect.magnitude && durationMs === effect.durationMs && stacks === effect.stacks ? effect : { ...effect, ...(tags.length ? { tags } : {}), ...(magnitude === undefined ? {} : { magnitude }), ...(durationMs === undefined ? {} : { durationMs }), ...(stacks === undefined ? {} : { stacks }) };
  });
}
