/**
 * Runtime-only status behavior. These mappings are intentionally separate from the content catalog:
 * they describe how an already-applied status drives generic scene adapters, not skill identity.
 */
export interface RuntimeStatusBehavior {
  randomTargeting?: boolean;
  passiveEffectsDisabled?: boolean;
  enemyActionDamagePerStack?: number;
}

export const runtimeStatusBehavior: Record<string, RuntimeStatusBehavior> = {
  confusion: { randomTargeting: true },
  'energy-seal': { passiveEffectsDisabled: true },
  /** 原稿未量化反噬伤害；首版基线为敌人每次动作每层 8 点，单位：伤害/层/动作。 */
  'kidney-reprisal': { enemyActionDamagePerStack: 8 },
} as const;

/**
 * 标签未携带量化参数时的 Runtime 通用基线；单位：米/个/毫秒。
 * 仅由 App 标签适配器消费，避免在技能名称分支中猜测范围或延时。
 */
export const runtimeTagBehavior = {
  spreadRadius: 6,
  spreadTargetCount: 2,
  delayedTriggerMs: 1000,
  /** 未量化的 high-chance 标签采用的统一概率，范围 [0, 1]。 */
  highChanceProbability: 0.8,
  /** 未量化持续场的默认作用半径、时长和结算间隔。 */
  areaHazardRadius: 6,
  areaHazardDurationMs: 4000,
  areaHazardIntervalMs: 1000,
  /** 未量化位移标签的通用安全位移距离（米）。 */
  defaultPounceDistance: 6,
  interruptActionGateMs: 800,
  knockupActionGateMs: 600,
  wanderDurationMs: 2000,
  baseDetectRadius: 8,
  smallKnockbackDistance: 3,
} as const;
