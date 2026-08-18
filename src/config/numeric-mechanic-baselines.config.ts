/**
 * 数值与蓄积机制中原稿未量化部分的首版基线。
 * 比例字段使用小数；伤害为点数；层数为层，均由领域层统一读取。
 */
export const numericMechanicBaselines = {
  /** 破防越深伤害越高：每 100% 已降低物防额外提高的伤害比例。 */
  damageAmplifiedByDefenseLoss: 0.2,
  /** 未量化“伤害提高”的通用首版比例。 */
  damageBonus: 0.2,
  /** 病灶等标记对引爆伤害的未量化首版加成。 */
  detonationBonus: 0.25,
  /** 反噬伤害“再提高”的未量化首版比例。 */
  reprisalDamageBonus: 0.2,
  /** “Debuff 全部效果提升”的未量化首版比例。 */
  effectStrength: 0.25,
  /** 蓄积标记的未量化充能速度提高比例。 */
  chargeRateIncrease: 0.5,
  /** 心蚀阈值控制概率“提高”的未量化首版增量。 */
  thresholdControlChanceIncrease: 0.2,
  /** 蓄能肾毒触发爆发所需的敌方施法次数。 */
  chargedReprisalThreshold: 3,
  /** 蓄能肾毒爆发的首版内脏伤害。 */
  chargedReprisalDamage: 90,
  /** 常规肾毒反噬在敌方施法时造成的首版内脏伤害。 */
  reprisalDamage: 60,
} as const;
