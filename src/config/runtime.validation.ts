import type { RuntimeConfig } from '../game';

/** 验证运行时敌人平衡字段，避免外部配置导致负伤害或无敌单位。 */
export function validateRuntimeConfig(config: RuntimeConfig): RuntimeConfig {
  for (const enemy of config.enemies) {
    validateReduction(enemy.id, '物理伤害减免', enemy.physicalDamageReduction);
    validateReduction(enemy.id, '毒素伤害减免', enemy.venomDamageReduction);
  }
  return config;
}

function validateReduction(enemyId: string, label: string, value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 0.9) throw new Error(`敌人 ${enemyId} 的${label}必须在 0 到 0.9 之间`);
}
