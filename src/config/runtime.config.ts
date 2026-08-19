import type { RuntimeConfig } from '../game';
import { validateRuntimeConfig } from './runtime.validation';

/** Phase 1 三维场景与敌人首版平衡值；距离单位为米，时间单位为毫秒。 */
export const runtimeConfig: RuntimeConfig = validateRuntimeConfig({
  world: {
    groundSize: 80,
    boundaryRadius: 38,
    obstacleHeight: 3,
    obstacles: [
      { id: 'north-rock', x: 8, z: 4, width: 5, depth: 3 },
      { id: 'cave-wall', x: -10, z: -8, width: 4, depth: 9 },
      { id: 'old-stump', x: 2, z: -12, width: 3, depth: 3 },
    ],
  },
  player: { moveSpeed: 8, collisionRadius: 0.65, maxHealth: 100, attackRange: 4.5, primaryAttackDamage: 28, secondaryAttackDamage: 18 },
  domainTickIntervalMs: 100,
  camera: { alpha: -1.2, beta: 1.05, radius: 16, targetHeight: 1 },
  input: { pointerTurnSensitivity: 0.008 },
  enemies: [
    /** 小型近战：低防，便于新手验证物理与毒素路径。 */
    { id: 'marsh-rat', kind: 'smallMelee', bodySize: 'small', visual: { name: '沼泽鼠', model: 'marshRat', scale: 1, color: { r: 0.36, g: 0.2, b: 0.14 }, accentColor: { r: 0.62, g: 0.38, b: 0.3 }, detailColor: { r: 0.08, g: 0.04, b: 0.03 } }, spawn: { x: 10, z: 1 }, maxHealth: 70, moveSpeed: 3.2, collisionRadius: 0.55, aggroRange: 18, attackRange: 1.8, attackIntervalMs: 1200, attackDamage: 7, physicalDamageReduction: 0.08, venomDamageReduction: 0.04, characterXp: 350, skillXp: 35, respawnDelayMs: 5000 },
    /** 中型远程：中等防御，体现毒素与物理的差异。 */
    { id: 'thorn-lizard', kind: 'mediumRanged', bodySize: 'medium', visual: { name: '棘刺蜥', model: 'thornLizard', scale: 1, color: { r: 0.28, g: 0.42, b: 0.12 }, accentColor: { r: 0.64, g: 0.55, b: 0.16 }, detailColor: { r: 0.06, g: 0.08, b: 0.03 } }, spawn: { x: -12, z: 3 }, maxHealth: 110, moveSpeed: 2.2, collisionRadius: 0.75, aggroRange: 22, attackRange: 7, attackIntervalMs: 1800, attackDamage: 9, physicalDamageReduction: 0.18, venomDamageReduction: 0.12, characterXp: 650, skillXp: 55, respawnDelayMs: 7000 },
    /** 大型精英：高防但不超过配置上限，保留可感知的毒素路线优势。 */
    { id: 'ancient-monitor', kind: 'largeElite', bodySize: 'large', visual: { name: '荒野巨蜥王', model: 'ancientMonitor', scale: 1, color: { r: 0.24, g: 0.34, b: 0.1 }, accentColor: { r: 0.48, g: 0.47, b: 0.18 }, detailColor: { r: 0.05, g: 0.07, b: 0.02 } }, spawn: { x: 0, z: 15 }, maxHealth: 260, moveSpeed: 1.6, collisionRadius: 1.15, aggroRange: 25, attackRange: 2.8, attackIntervalMs: 2200, attackDamage: 15, physicalDamageReduction: 0.3, venomDamageReduction: 0.22, characterXp: 3000, skillXp: 140, respawnDelayMs: 15000, objectiveId: 'defeat-ancient-monitor' },
  ],
});
