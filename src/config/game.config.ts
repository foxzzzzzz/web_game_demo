import { branches, origins, passives, skills, statuses, subtypes } from './catalogs/content.config';
import type { GameConfig } from './types';

/**
 * 全量产品配置组合入口。数值含义、单位和范围见 types.ts；具体技能的原稿 CD/充能在 catalogs/content.config.ts。
 * 原稿没有给出数值的“小幅/少量/高额”等效果以 baseline-quantified 标签统一标识，避免效果处理器临时写死平衡值。
 */
export const gameConfig: GameConfig = {
  saveVersion: 1,
  levelXpThresholds: [0, 100, 250, 500, 900, 1400, 2000, 2800, 3700],
  skillUpgradeXpCost: 20,
  maxSkillLevel: 17,
  skillDamageGrowth: 0.06,
  maxSkillGoldReward: 1,
  largeHardControlMultiplier: 0.5,
  combatExitDelayMs: 5000,
  roundObjectiveLevel: 9,
  origins,
  branches,
  subtypes,
  passives,
  skills,
  statuses,
};
