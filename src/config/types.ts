export type OriginId = 'size' | 'strength' | 'venom';
export type SkillSlot = 1 | 2 | 3 | 4;
export type DamageType = 'physical' | 'venom';
export type StatusKind = 'buff' | 'debuff' | 'control';
/** 状态的广义机制家族；用于配置化免疫与被动修正。 */
export type StatusFamily = 'control' | 'mobility' | 'muscle';
/** 状态的细粒度机制特征；用于精确叠层、时长与免疫规则。 */
export type StatusTrait = 'hard-control' | 'slow' | 'root' | 'paralysis';
export type EffectType = 'damage' | 'heal' | 'shield' | 'status' | 'move' | 'buff' | 'dispel' | 'mark' | 'trigger';
export type EffectTarget = 'self' | 'target' | 'area';

/** 可组合技能/被动效果；数值均由配置维护，单位随 effect type（伤害/治疗/护盾为点，位移为米，状态为层）。 */
export interface EffectDefinition {
  type: EffectType;
  target: EffectTarget;
  /** 效果基础数值；原稿未量化的效果采用目录文件中的统一首版可玩值。 */
  magnitude?: number;
  /** 效果持续时间，单位：毫秒。 */
  durationMs?: number;
  /** 状态层数，单位：层。 */
  stacks?: number;
  /** 被施加或引用的状态 ID。 */
  statusId?: string;
  /** 用于运行时效果处理器识别专属机制的配置标签。 */
  tags?: string[];
}

export interface PassiveDefinition {
  id: string;
  name: string;
  /** 原始设计整理的中文机制说明，供 UI 与测试追溯。 */
  description: string;
  branchId: string;
  subtypeId?: string;
  /** 被动常驻或条件效果，至少一个。 */
  effects: EffectDefinition[];
}

export interface OriginDefinition {
  id: OriginId;
  name: string;
}

export interface BranchDefinition {
  id: string;
  originId: OriginId;
  name: string;
  /** 解锁此大分支所需金币，单位：枚。 */
  unlockGold: number;
  /** 毒素大分支自动解锁的默认亚型；非毒素分支为 undefined。 */
  defaultSubtypeId?: string;
}

export interface SubtypeDefinition {
  id: string;
  branchId: string;
  name: string;
  /** 解锁该亚型所需金币，单位：枚；默认亚型为 0。 */
  unlockGold: number;
}

export interface SkillDefinition {
  id: string;
  branchId: string;
  subtypeId?: string;
  name: string;
  /** 对应分支第几项主动技能，范围：1-4。 */
  order: SkillSlot;
  /** 角色达到该等级时开放，限定为 3/5/7/9。 */
  unlockLevel: number;
  /** 普通技能的独立冷却，单位：毫秒；充能技能不填写。 */
  cooldownMs?: number;
  /** 充能技能最大可储存层数，单位：层；普通技能不填写。 */
  maxCharges?: number;
  /** 充能技能串行恢复一层的时间，单位：毫秒；普通技能不填写。 */
  rechargeMs?: number;
  /** 技能 1 级基础伤害，单位：点；无伤害技能为 0。 */
  baseDamage: number;
  damageType: DamageType;
  /** 技能命中后施加的状态 ID；无状态效果时不填写。 */
  statusId?: string;
  /** 一次命中施加的状态层数，单位：层。 */
  statusStacks?: number;
  /** 标记该字段会受技能等级的 6% 伤害成长影响。 */
  scalesDamageWithLevel: boolean;
  /** 技能结算的可组合效果，至少一个。 */
  effects: EffectDefinition[];
}

export interface StatusDefinition {
  id: string;
  name: string;
  kind: StatusKind;
  /** 状态默认持续时间，单位：毫秒。 */
  durationMs: number;
  /** 同名状态最大层数，单位：层。 */
  maxStacks: number;
  /** 同名状态刷新策略：刷新剩余时间并累加到最大层数。 */
  stackMode: 'refresh-and-stack';
  /** 是否属于会阻止行动的硬控制。 */
  hardControl: boolean;
  /** 可组合机制家族；不通过状态或技能名称推断。 */
  families: StatusFamily[];
  /** 可组合细粒度特征；不通过状态或技能名称推断。 */
  traits: StatusTrait[];
  /** 此状态提供的家族免疫，例如逃脱免疫阻止 control 家族。 */
  immunityFamilies?: StatusFamily[];
  /** 此状态提供的特征免疫，例如减速免疫阻止 slow 特征。 */
  immunityTraits?: StatusTrait[];
  /** 阻止移动；禁锢可只配置此项而不禁止攻击。 */
  blocksMovement?: boolean;
  /** 阻止普通攻击及敌方 AI 攻击。 */
  blocksActions?: boolean;
  /** 阻止主动技能；沉默只配置此项。 */
  blocksSkills?: boolean;
  /** 达到层数阈值时施加的状态 ID；无阈值时不填写。 */
  thresholdStatusId?: string;
  /** 触发阈值所需层数，单位：层。 */
  thresholdStacks?: number;
}

export interface GameConfig {
  /** 存档结构版本；版本不匹配时拒绝读取。 */
  saveVersion: 1;
  /** 每一级所需累计角色经验，数组索引即等级减一，单位：经验点。 */
  levelXpThresholds: number[];
  /** 技能升级每一级的技能经验花费，单位：经验点。 */
  skillUpgradeXpCost: number;
  /** 技能等级上限，单位：级。 */
  maxSkillLevel: number;
  /** 每次技能等级提升的伤害增幅，单位：小数比例。 */
  skillDamageGrowth: number;
  /** 首次技能满级奖励金币数量，单位：枚。 */
  maxSkillGoldReward: number;
  /** 大型单位受到硬控制的时长乘数，范围：(0, 1]。 */
  largeHardControlMultiplier: number;
  /** 最后一次交战事件后保持战斗锁定的时长，单位：毫秒。 */
  combatExitDelayMs: number;
  /** 击败大型精英可完成本轮目标所需角色等级。 */
  roundObjectiveLevel: number;
  origins: OriginDefinition[];
  branches: BranchDefinition[];
  subtypes: SubtypeDefinition[];
  passives: PassiveDefinition[];
  skills: SkillDefinition[];
  statuses: Record<string, StatusDefinition>;
}
