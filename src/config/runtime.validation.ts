import type { RuntimeConfig } from '../game';

/** 验证运行时敌人平衡字段，避免外部配置导致负伤害或无敌单位。 */
export function validateRuntimeConfig(config: RuntimeConfig): RuntimeConfig {
  for (const enemy of config.enemies) {
    validateReduction(enemy.id, '物理伤害减免', enemy.physicalDamageReduction);
    validateReduction(enemy.id, '毒素伤害减免', enemy.venomDamageReduction);
    if (!Number.isFinite(enemy.collisionRadius) || enemy.collisionRadius <= 0) throw new Error(`敌人 ${enemy.id} 的碰撞半径必须大于 0`);
    if (enemy.visual.name.trim().length === 0) throw new Error(`敌人 ${enemy.id} 的模型名称不能为空`);
    if (!Number.isFinite(enemy.visual.scale) || enemy.visual.scale <= 0) throw new Error(`敌人 ${enemy.id} 的模型缩放必须大于 0`);
    for (const value of [...Object.values(enemy.visual.color), ...Object.values(enemy.visual.accentColor), ...Object.values(enemy.visual.detailColor)]) {
      if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`敌人 ${enemy.id} 的模型颜色必须在 0 到 1 之间`);
    }
  }
  return config;
}

function validateReduction(enemyId: string, label: string, value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 0.9) throw new Error(`敌人 ${enemyId} 的${label}必须在 0 到 0.9 之间`);
}
