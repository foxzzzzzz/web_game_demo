/** 原稿未量化的范围、复制、扩散与残留事件的首版可执行基线。 */
export const eventMechanicBaselines = {
  /** 毒种范围引爆时施加的麻痹层数。 */
  areaParalysisBurstStacks: 5,
  /** “群体快速叠加”的单次层数。 */
  groupRapidStackCount: 3,
  /** “大量麻痹”的单次层数。 */
  largeParalysisStackCount: 5,
  /** 无明确数量的单次扩散目标数。 */
  spreadTargetCount: 1,
  /** 流血腐蚀扩散的每秒毒素伤害。 */
  venomCorrosionDamage: 8,
  /** 残留肾毒标记的引爆伤害。 */
  residualMarkDetonationDamage: 100,
  /** 蓄能肾毒达到阈值时的爆发伤害。 */
  chargedReprisalDamage: 90,
  /** 未量化反击伤害的首版点数。 */
  counterattackDamage: 90,
} as const;
