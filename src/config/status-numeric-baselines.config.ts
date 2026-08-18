/**
 * 敌方状态数值快照的安全边界。所有字段都是最终战斗乘数的上下限，
 * 避免异常状态配置让敌人完全静止、无法命中，或使伤害溢出到不可控范围。
 */
export const enemyStatusNumericBaselines = {
  /** 移速、攻速与输出伤害最低保留 10%，确保战斗循环仍可推进。 */
  minimumMultiplier: 0.1,
  /** 输出伤害和承伤倍率最多为基础值的 3 倍。 */
  maximumMultiplier: 3,
  /** 命中率最低保留 5%，最高不能超过 100%。 */
  minimumHitChance: 0.05,
  maximumHitChance: 1,
  /** 移速、攻速、攻击伤害等减益单项最多削减 90%。 */
  maximumReductionContribution: 0.9,
  /** 命中率减益可降到 0，最终仍由 minimumHitChance 保底。 */
  maximumHitChanceReduction: 1,
  /** 增伤和易伤单项最多增加 200%，配合最终上限即最多 3 倍。 */
  maximumIncreaseContribution: 2,
} as const;
