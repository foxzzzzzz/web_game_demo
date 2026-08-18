import type { DamageType, EffectDefinition, GameConfig, OriginId, SkillSlot, StatusDefinition } from '../config';

export type RunPhase = 'creation' | 'active' | 'dead';

export interface SkillRuntime {
  cooldownRemainingMs: number;
  charges?: number;
  rechargeRemainingMs?: number;
}

export interface ActiveStatus {
  statusId: string;
  stacks: number;
  remainingMs: number;
  magnitude?: number;
  tags?: string[];
}

/** 单个敌人的低频状态快照；由 UI 直接读取，运行时实体仍由 Babylon 层持有。 */
export interface EnemyStatusSnapshot {
  isLarge: boolean;
  statuses: ActiveStatus[];
}

/** 敌方当前状态聚合出的战斗数值快照，供 App 与 Runtime 同步消费。 */
export interface EnemyStatusModifiers {
  moveSpeedMultiplier: number;
  attackSpeedMultiplier: number;
  hitChance: number;
  outgoingDamageMultiplier: number;
  physicalDamageTakenMultiplier: number;
  venomDamageTakenMultiplier: number;
  incomingDamageMultiplier: number;
}

/** 领域可解析、但需要 App/Runtime 提供时机或随机数的效果事件。 */
export interface EffectEvent {
  kind: 'target-damage' | 'enemy-skill-cast' | 'status-threshold';
  targetIds: string[];
  targetStatuses?: ActiveStatus[];
  /** Runtime 提供的候选目标；领域只返回目标 ID，不处理坐标或距离。 */
  candidateTargets?: Array<{ id: string; alive: boolean }>;
  /** 触发扩散/复制的来源状态。 */
  sourceStatuses?: ActiveStatus[];
  /** status-threshold 事件所检查的状态。 */
  statusId?: string;
  /** 外层提供的 [0,1) 随机值；缺失时仅返回概率，不实际触发概率控制。 */
  roll?: number;
}

/** 事件解析的稳定输出，外层按 effects 结算并按 consumeStatusIds 消费状态。 */
export interface EffectEventResult {
  effects: ResolvedEffect[];
  consumeStatusIds: string[];
  thresholdControlChance?: number;
  /** 领域/毒核等定时效果的调度倍率，由 Runtime 自己驱动计时器。 */
  tickRateMultiplier?: number;
}

/** Runtime 敌人外部防御配置的领域最小视图。 */
export interface EnemyDamageProfile {
  physicalDamageReduction: number;
  venomDamageReduction: number;
}

/** App/Runtime 调用的稳定敌方伤害解析输入。 */
export interface EnemyDamageInput {
  amount: number;
  damageType: DamageType;
  target: EnemyDamageProfile;
  tags?: string[];
  targetStatuses?: ActiveStatus[];
}

export interface PlayerVitals {
  maxHealth: number;
  health: number;
  shield: number;
}

export interface GameState {
  phase: RunPhase;
  originId?: OriginId;
  characterXp: number;
  characterLevel: number;
  skillXp: number;
  gold: number;
  venomPoints: number;
  objectiveCompleted: boolean;
  unlockedBranchIds: string[];
  unlockedSubtypeIds: string[];
  activeSubtypeId?: string;
  enhancedSubtypeIds: string[];
  skillLevels: Record<string, number>;
  rewardedSkillIds: string[];
  openSkillIds: string[];
  loadout: Record<SkillSlot, string | null>;
  skillRuntime: Record<string, SkillRuntime>;
  inCombat: boolean;
  combatRemainingMs: number;
  paused: boolean;
  /** 以目标 ID 索引的敌方 Debuff/控制，切换毒素亚型不会清空。 */
  enemyStatuses: Record<string, EnemyStatusSnapshot>;
  /** 玩家自身 Buff/Debuff/控制快照；暂停时与 CD 同步冻结。 */
  playerStatuses: ActiveStatus[];
  player: PlayerVitals;
}

export interface GainRewardInput {
  characterXp: number;
  skillXp: number;
}

export interface ApplyStatusTarget {
  isLarge: boolean;
  stacks: number;
}

/** 概率阈值控制由外层注入随机值，领域层不依赖全局随机源。 */
export interface StatusApplicationOptions {
  thresholdRoll?: number;
}

export interface SaveSnapshot {
  version: GameConfig['saveVersion'];
  run: GameState;
}

export interface ResolvedEffect extends EffectDefinition {
  targetIds: string[];
}

/** 可供基础攻击、技能和移动层复用的当前被动修正。比例字段使用 0.12 代表 12%。 */
export interface PassiveModifiers {
  maxHealth: number;
  physicalDamageReduction: number;
  allDamageReduction: number;
  damageTakenIncrease: number;
  biteBaseDamage: number;
  attackDamage: number;
  moveSpeed: number;
}

export type { DamageType, OriginId, SkillSlot, StatusDefinition };
