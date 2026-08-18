import { enemyStatusNumericBaselines, eventMechanicBaselines, numericMechanicBaselines } from '../config';
import type { DamageType, EffectDefinition, GameConfig, OriginId, SkillDefinition, SkillSlot, StatusDefinition } from '../config';
import type { ActiveStatus, ApplyStatusTarget, EffectEvent, EffectEventResult, EnemyDamageInput, EnemyStatusModifiers, GainRewardInput, GameState, PassiveModifiers, ResolvedEffect, SaveSnapshot, SkillRuntime, StatusApplicationOptions } from './types';

/** 返回未创建局面的稳定初始快照。 */
export function createInitialGameState(): GameState {
  return {
    phase: 'creation', characterXp: 0, characterLevel: 1, skillXp: 0, gold: 0, venomPoints: 0, objectiveCompleted: false,
    unlockedBranchIds: [], unlockedSubtypeIds: [], enhancedSubtypeIds: [], skillLevels: {}, rewardedSkillIds: [],
    openSkillIds: [], loadout: { 1: null, 2: null, 3: null, 4: null }, skillRuntime: {}, inCombat: false, combatRemainingMs: 0, paused: false,
    player: { maxHealth: 100, health: 100, shield: 0 }, enemyStatuses: {}, playerStatuses: [],
  };
}

/** 创建本局角色；已创建时保持幂等，避免刷新或重复点击重复发放资源。 */
export function createRun(state: GameState, config: GameConfig, originId: OriginId, branchId: string): GameState {
  if (state.phase !== 'creation') return state;
  const branch = config.branches.find((entry) => entry.id === branchId && entry.originId === originId);
  if (!branch) return state;
  const defaultSubtypeIds = branch.defaultSubtypeId ? [branch.defaultSubtypeId] : [];
  return applyPassiveVitals(refreshOpenSkills({
    ...state,
    phase: 'active', originId, gold: 1, venomPoints: originId === 'venom' ? 1 : 0,
    unlockedBranchIds: [branchId], unlockedSubtypeIds: defaultSubtypeIds,
    activeSubtypeId: branch.defaultSubtypeId,
  }, config), config);
}

/** 增加两类独立经验，并由累计角色经验重新计算等级。 */
export function gainReward(state: GameState, config: GameConfig, reward: GainRewardInput): GameState {
  if (state.phase !== 'active' || reward.characterXp < 0 || reward.skillXp < 0) return state;
  const characterXp = state.characterXp + reward.characterXp;
  const characterLevel = levelForXp(characterXp, config);
  return refreshOpenSkills({ ...state, characterXp, characterLevel, skillXp: state.skillXp + reward.skillXp }, config);
}

/** 消耗金币解锁本源内大分支；毒素分支同时赠送默认亚型。 */
export function unlockBranch(state: GameState, config: GameConfig, branchId: string): GameState {
  const branch = config.branches.find((entry) => entry.id === branchId);
  if (!branch || state.phase !== 'active' || branch.originId !== state.originId || state.unlockedBranchIds.includes(branchId) || state.gold < branch.unlockGold) return state;
  return applyPassiveVitals(refreshOpenSkills({
    ...state, gold: state.gold - branch.unlockGold, unlockedBranchIds: [...state.unlockedBranchIds, branchId],
    unlockedSubtypeIds: branch.defaultSubtypeId ? addUnique(state.unlockedSubtypeIds, branch.defaultSubtypeId) : state.unlockedSubtypeIds,
  }, config), config);
}

/** 消耗金币解锁已拥有毒素分支下的非默认亚型。 */
export function unlockSubtype(state: GameState, config: GameConfig, subtypeId: string): GameState {
  const subtype = config.subtypes.find((entry) => entry.id === subtypeId);
  if (!subtype || state.phase !== 'active' || state.originId !== 'venom' || !state.unlockedBranchIds.includes(subtype.branchId) || state.unlockedSubtypeIds.includes(subtypeId) || state.gold < subtype.unlockGold) return state;
  return { ...state, gold: state.gold - subtype.unlockGold, unlockedSubtypeIds: [...state.unlockedSubtypeIds, subtypeId] };
}

/** 给一个已解锁毒素亚型分配不可撤销的毒液强化点。 */
export function assignVenomPoint(state: GameState, _config: GameConfig, subtypeId: string): GameState {
  if (state.phase !== 'active' || state.originId !== 'venom' || state.venomPoints < 1 || !state.unlockedSubtypeIds.includes(subtypeId) || state.enhancedSubtypeIds.includes(subtypeId)) return state;
  return { ...state, venomPoints: state.venomPoints - 1, enhancedSubtypeIds: [...state.enhancedSubtypeIds, subtypeId] };
}

/** 脱战时切换已解锁毒素亚型；已施加在敌人身上的状态由战斗目标自行保留。 */
export function selectSubtype(state: GameState, config: GameConfig, subtypeId: string): GameState {
  if (state.phase !== 'active' || state.originId !== 'venom' || state.inCombat || !state.unlockedSubtypeIds.includes(subtypeId)) return state;
  const subtype = config.subtypes.find((entry) => entry.id === subtypeId);
  if (!subtype || !state.unlockedBranchIds.includes(subtype.branchId)) return state;
  return applyPassiveVitals(refreshOpenSkills({ ...state, activeSubtypeId: subtypeId, loadout: { 1: null, 2: null, 3: null, 4: null } }, config), config);
}

/** 仅允许把当前已开放技能放入一个空或替换槽；同技能不可重复装备。 */
export function equipSkill(state: GameState, _config: GameConfig, skillId: string, slot: SkillSlot): GameState {
  if (state.phase !== 'active' || state.inCombat || !state.openSkillIds.includes(skillId) || (state.loadout[slot] !== skillId && Object.values(state.loadout).includes(skillId))) return state;
  return { ...state, loadout: { ...state.loadout, [slot]: skillId } };
}

/** 技能升级消耗独立技能经验，仅伤害倍率参与等级成长。 */
export function upgradeSkill(state: GameState, config: GameConfig, skillId: string): GameState {
  if (state.phase !== 'active' || !state.openSkillIds.includes(skillId) || state.skillXp < config.skillUpgradeXpCost) return state;
  const currentLevel = state.skillLevels[skillId] ?? 1;
  if (currentLevel >= config.maxSkillLevel) return state;
  const nextLevel = currentLevel + 1;
  const firstMax = nextLevel === config.maxSkillLevel && !state.rewardedSkillIds.includes(skillId);
  return {
    ...state, skillXp: state.skillXp - config.skillUpgradeXpCost, skillLevels: { ...state.skillLevels, [skillId]: nextLevel },
    gold: state.gold + (firstMax ? config.maxSkillGoldReward : 0), rewardedSkillIds: firstMax ? [...state.rewardedSkillIds, skillId] : state.rewardedSkillIds,
  };
}

/** 释放装备技能。无目标、CD、空充能或死亡时完全不改变状态。 */
export function castSkill(state: GameState, config: GameConfig, slot: SkillSlot, targetIds: string[]): GameState {
  const skillId = state.loadout[slot];
  if (!skillId || state.phase !== 'active' || state.paused || isPlayerSkillBlocked(state, config)) return state;
  const skill = config.skills.find((entry) => entry.id === skillId);
  if (!skill || !state.openSkillIds.includes(skillId)) return state;
  if (skill.effects.some((effect) => effect.target !== 'self') && targetIds.length === 0) return state;
  const runtime = getSkillRuntime(state, skill);
  if (runtime.cooldownRemainingMs > 0 || (runtime.charges !== undefined && runtime.charges < 1)) return state;
  const nextRuntime: SkillRuntime = skill.maxCharges
    ? { ...runtime, charges: runtime.charges! - 1, rechargeRemainingMs: runtime.rechargeRemainingMs || skill.rechargeMs }
    : { ...runtime, cooldownRemainingMs: skill.cooldownMs! };
  return { ...state, inCombat: true, combatRemainingMs: config.combatExitDelayMs, skillRuntime: { ...state.skillRuntime, [skillId]: nextRuntime } };
}

/** 交战事件刷新脱战倒计时；显式清除时同时归零。 */
export function setCombatState(state: GameState, config: GameConfig, inCombat: boolean): GameState {
  if (state.phase !== 'active') return state;
  return { ...state, inCombat, combatRemainingMs: inCombat ? config.combatExitDelayMs : 0 };
}

/** 达到配置等级并击败精英后完成本轮目标；完成后仍保留局面继续游玩。 */
export function completeRoundObjective(state: GameState, config: GameConfig): GameState {
  if (state.phase !== 'active' || state.characterLevel < config.roundObjectiveLevel || state.objectiveCompleted) return state;
  return { ...state, objectiveCompleted: true };
}

/** 推进独立 CD 与按队列串行恢复的充能；暂停或非活动局面不推进。 */
export function tick(state: GameState, config: GameConfig, deltaMs: number): GameState {
  if (state.phase !== 'active' || state.paused || deltaMs <= 0) return state;
  let changed = false;
  const advancedPlayerStatuses = tickPlayerStatuses(state, deltaMs);
  const playerStatuses = advancedPlayerStatuses.playerStatuses;
  if (playerStatuses !== state.playerStatuses) changed = true;
  const advancedEnemyStatuses = tickEnemyStatuses(state, deltaMs);
  const enemyStatuses = advancedEnemyStatuses.enemyStatuses;
  if (enemyStatuses !== state.enemyStatuses) changed = true;
  const combatRemainingMs = state.inCombat ? Math.max(0, (state.combatRemainingMs || config.combatExitDelayMs) - deltaMs) : 0;
  const inCombat = state.inCombat && combatRemainingMs > 0;
  if (combatRemainingMs !== state.combatRemainingMs || inCombat !== state.inCombat) changed = true;
  const skillRuntime: Record<string, SkillRuntime> = { ...state.skillRuntime };
  for (const skill of config.skills) {
    const existing = skillRuntime[skill.id];
    if (!existing) continue;
    if (skill.maxCharges) {
      let charges = existing.charges ?? skill.maxCharges;
      let remaining = existing.rechargeRemainingMs ?? 0;
      let elapsed = deltaMs * getPlayerChargeRateMultiplier(state.playerStatuses);
      while (charges < skill.maxCharges && elapsed > 0) {
        const needed = remaining || skill.rechargeMs!;
        if (elapsed < needed) { remaining = needed - elapsed; elapsed = 0; }
        else { elapsed -= needed; charges += 1; remaining = charges < skill.maxCharges ? skill.rechargeMs! : 0; }
      }
      if (charges !== existing.charges || remaining !== existing.rechargeRemainingMs) {
        skillRuntime[skill.id] = { ...existing, charges, rechargeRemainingMs: remaining };
        changed = true;
      }
    } else if (existing.cooldownRemainingMs > 0) {
      const cooldownRemainingMs = Math.max(0, existing.cooldownRemainingMs - deltaMs);
      skillRuntime[skill.id] = { ...existing, cooldownRemainingMs };
      changed = true;
    }
  }
  return changed ? { ...state, inCombat, combatRemainingMs, skillRuntime, enemyStatuses, playerStatuses } : state;
}

/** 伤害先消耗护盾，再以溢出伤害扣除生命。 */
export function applyDamage(state: GameState, amount: number, damageType: DamageType = 'physical', config?: GameConfig): GameState {
  if (amount <= 0 || state.phase === 'dead') return state;
  const modifiers = config ? getActivePassiveModifiers(state, config) : undefined;
  const reduction = Math.min(0.9, (modifiers?.allDamageReduction ?? 0) + (damageType === 'physical' ? modifiers?.physicalDamageReduction ?? 0 : 0));
  const reducedAmount = Math.max(0, Math.round(amount * (1 - reduction) * (1 + (modifiers?.damageTakenIncrease ?? 0))));
  const shieldDamage = Math.min(state.player.shield, reducedAmount);
  const healthDamage = Math.max(0, reducedAmount - shieldDamage);
  const health = Math.max(0, state.player.health - healthDamage);
  return { ...state, phase: health === 0 ? 'dead' : state.phase, player: { ...state.player, shield: state.player.shield - shieldDamage, health } };
}

/**
 * 解析目标外部防御、穿透、状态易伤与混合伤害分配；供 App/Runtime 结算，不依赖技能 ID。
 * 伤害按分项四舍五入后合计，负数、无效输入与超额减免都安全归零。
 */
export function resolveEnemyDamage(input: EnemyDamageInput): number {
  const amount = Math.max(0, input.amount);
  if (amount === 0) return 0;
  const tags = input.tags ?? [];
  const split = parseDamageSplit(tags);
  const physicalShare = split?.physical ?? (input.damageType === 'physical' ? 1 : 0);
  const venomShare = split?.venom ?? (input.damageType === 'venom' ? 1 : 0);
  const statuses = input.targetStatuses ?? [];
  const physicalDefenseReduction = statuses.filter((status) => status.tags?.includes('physical-defense-reduction')).reduce((sum, status) => sum + Math.max(0, status.magnitude ?? 0), 0);
  const venomDamageTaken = statuses.filter((status) => status.tags?.includes('venom-damage-taken')).reduce((sum, status) => sum + Math.max(0, status.magnitude ?? 0), 0);
  const genericDamageTaken = statuses.filter((status) => status.tags?.includes('damage-taken')).reduce((sum, status) => sum + Math.max(0, status.magnitude ?? 0), 0);
  const penetration = tags.map((tag) => /^ignore-physical-defense:(0(?:\.\d+)?|1(?:\.0+)?)$/.exec(tag)?.[1]).find((value): value is string => value !== undefined);
  const physicalReduction = Math.max(0, clampReduction(input.target.physicalDamageReduction) - physicalDefenseReduction) * (1 - (penetration === undefined ? 0 : Math.min(1, Number(penetration))));
  const venomReduction = clampReduction(input.target.venomDamageReduction);
  return Math.max(0, Math.round((amount * physicalShare * (1 - physicalReduction) + amount * venomShare * (1 - venomReduction) * (1 + venomDamageTaken)) * (1 + genericDamageTaken)));
}

/**
 * 从敌方已生效状态生成可直接用于移动、攻击与伤害结算的数值快照。
 * 每层数值只在带 per-stack 语义的标签上累计；cap:N 限制该状态单类贡献，
 * 不依赖状态或技能 ID。
 */
export function getEnemyStatusModifiers(statuses: ActiveStatus[]): EnemyStatusModifiers {
  const moveReduction = sumStatusContributions(statuses, 'move-speed-reduction', enemyStatusNumericBaselines.maximumReductionContribution);
  const attackSpeedReduction = sumStatusContributions(statuses, 'attack-speed-reduction', enemyStatusNumericBaselines.maximumReductionContribution);
  const hitChanceReduction = sumStatusContributions(statuses, 'hit-chance-reduction', enemyStatusNumericBaselines.maximumHitChanceReduction);
  const attackReduction = sumStatusContributions(statuses, 'attack-reduction', enemyStatusNumericBaselines.maximumReductionContribution);
  const outputIncrease = sumStatusContributions(statuses, 'output-increase', enemyStatusNumericBaselines.maximumIncreaseContribution);
  const physicalDamageTaken = sumStatusContributions(statuses, 'physical-damage-taken', enemyStatusNumericBaselines.maximumIncreaseContribution);
  const venomDamageTaken = sumStatusContributions(statuses, 'venom-damage-taken', enemyStatusNumericBaselines.maximumIncreaseContribution);
  const incomingDamageTaken = sumStatusContributions(statuses, 'damage-taken', enemyStatusNumericBaselines.maximumIncreaseContribution);
  return {
    moveSpeedMultiplier: clampStatusMultiplier(1 - moveReduction),
    attackSpeedMultiplier: clampStatusMultiplier(1 - attackSpeedReduction),
    hitChance: clampValue(1 - hitChanceReduction, enemyStatusNumericBaselines.minimumHitChance, enemyStatusNumericBaselines.maximumHitChance),
    outgoingDamageMultiplier: clampStatusMultiplier((1 - attackReduction) * (1 + outputIncrease)),
    physicalDamageTakenMultiplier: clampStatusMultiplier(1 + physicalDamageTaken),
    venomDamageTakenMultiplier: clampStatusMultiplier(1 + venomDamageTaken),
    incomingDamageMultiplier: clampStatusMultiplier(1 + incomingDamageTaken),
  };
}

/** 结算可复用的自身治疗/护盾效果；治疗不超过最大生命，护盾按效果数值累加。 */
export function applyPlayerResolvedEffects(state: GameState, config: GameConfig, effects: ResolvedEffect[]): GameState {
  if (state.phase !== 'active') return state;
  let health = state.player.health;
  let shield = state.player.shield;
  let playerStatuses = state.playerStatuses;
  for (const effect of effects) {
    if (effect.target !== 'self' || !effect.targetIds.includes('player')) continue;
    if (effect.type === 'heal' && effect.magnitude !== undefined) health = Math.min(state.player.maxHealth, health + Math.round(effect.magnitude));
    if (effect.type === 'shield' && effect.magnitude !== undefined) shield += Math.round(effect.magnitude);
    if (effect.type === 'damage' && effect.magnitude !== undefined && effect.tags?.includes('current-health-cost')) health = Math.max(1, health - Math.round(health * effect.magnitude));
    if ((effect.type === 'status' || effect.type === 'buff' || effect.type === 'shield') && effect.statusId) {
      const definition = config.statuses[effect.statusId];
      const application = definition ? resolveStatusApplication(state, config, effect) : undefined;
      if (definition && application && !isStatusImmune(playerStatuses, config, definition)) {
        playerStatuses = applyStatus(playerStatuses, { ...definition, durationMs: application.durationMs }, { isLarge: false, stacks: application.stacks }, config)
          .map((status) => status.statusId === effect.statusId ? { ...status, ...(application.magnitude !== undefined ? { magnitude: application.magnitude } : {}), ...(effect.tags ? { tags: effect.tags } : {}) } : status);
      }
    }
    if (effect.type === 'buff' && !effect.statusId && effect.durationMs && effect.tags?.length) {
      const statusId = `effect:${effect.tags[0]}`;
      playerStatuses = [...playerStatuses.filter((status) => status.statusId !== statusId), { statusId, stacks: 1, remainingMs: effect.durationMs, ...(effect.magnitude !== undefined ? { magnitude: effect.magnitude } : {}), tags: effect.tags }];
    }
    if (effect.type === 'dispel') playerStatuses = dispelPlayerStatuses(playerStatuses, config, effect.tags ?? [], effect.stacks);
  }
  return health === state.player.health && shield === state.player.shield && playerStatuses === state.playerStatuses ? state : { ...state, player: { ...state.player, health, shield }, playerStatuses };
}

/** 施加同名状态：刷新持续时间、叠层至上限，并在跨阈值时只生成一次硬控。 */
export function applyStatus(current: ActiveStatus[], definition: StatusDefinition, target: ApplyStatusTarget, config: GameConfig): ActiveStatus[] {
  const existing = current.find((entry) => entry.statusId === definition.id);
  const priorStacks = existing?.stacks ?? 0;
  const stacks = Math.min(definition.maxStacks, priorStacks + target.stacks);
  const entries = current.filter((entry) => entry.statusId !== definition.id);
  entries.push({ statusId: definition.id, stacks, remainingMs: definition.durationMs });
  if (definition.thresholdStatusId && definition.thresholdStacks && priorStacks < definition.thresholdStacks && stacks >= definition.thresholdStacks) {
    const threshold = config.statuses[definition.thresholdStatusId];
    if (threshold) entries.push({ statusId: threshold.id, stacks: 1, remainingMs: threshold.hardControl && target.isLarge ? threshold.durationMs * config.largeHardControlMultiplier : threshold.durationMs });
  }
  return entries;
}

/** 返回当前局面实际生效的被动数值修正，不依赖被动 ID。 */
export function getActivePassiveModifiers(state: GameState, config: GameConfig): PassiveModifiers {
  const modifiers: PassiveModifiers = { maxHealth: 0, physicalDamageReduction: 0, allDamageReduction: 0, damageTakenIncrease: 0, biteBaseDamage: 0, attackDamage: 0, moveSpeed: 0 };
  for (const passive of getActivePassives(state, config)) {
    for (const effect of passive.effects) {
      if (effect.target !== 'self' || effect.magnitude === undefined) continue;
      if (effect.type === 'trigger' && effect.tags?.includes('per-missing-health-10-percent')) {
        const stacks = Math.min(effect.stacks ?? Number.POSITIVE_INFINITY, Math.floor((1 - state.player.health / state.player.maxHealth) * 10 + 1e-9));
        if (effect.tags.includes('physical-damage-reduction')) modifiers.physicalDamageReduction += effect.magnitude * stacks;
        if (effect.tags.includes('attack-damage')) modifiers.attackDamage += effect.magnitude * stacks;
        continue;
      }
      if (effect.type !== 'buff') continue;
      if (effect.tags?.includes('max-health')) modifiers.maxHealth += effect.magnitude;
      if (effect.tags?.includes('physical-damage-reduction')) modifiers.physicalDamageReduction += effect.magnitude;
      if (effect.tags?.includes('bite-base-damage')) modifiers.biteBaseDamage += effect.magnitude;
      if (effect.tags?.includes('attack-damage')) modifiers.attackDamage += effect.magnitude;
      if (effect.tags?.includes('move-speed')) modifiers.moveSpeed += effect.magnitude;
    }
  }
  for (const status of state.playerStatuses) {
    if (status.magnitude === undefined) continue;
    if (status.tags?.includes('physical-damage-reduction')) modifiers.physicalDamageReduction += status.magnitude;
    if (status.tags?.includes('all-damage-reduction') || status.tags?.includes('damage-reduction')) modifiers.allDamageReduction += status.magnitude;
    if (status.tags?.includes('damage-taken-increase')) modifiers.damageTakenIncrease += status.magnitude;
    if (status.tags?.includes('attack-damage')) modifiers.attackDamage += status.magnitude;
    if (status.tags?.includes('move-speed')) modifiers.moveSpeed += status.magnitude;
    if (status.tags?.includes('move-speed-reduction')) modifiers.moveSpeed -= status.magnitude;
  }
  return modifiers;
}

/** 当前生效被动可配置地提高指定敌方状态上限，例如流血 A 的 +3 层。 */
export function getActiveStatusMaxStacks(state: GameState, config: GameConfig, statusId: string): number {
  const baseMaxStacks = config.statuses[statusId]?.maxStacks;
  if (baseMaxStacks === undefined) return 0;
  return getActivePassives(state, config).flatMap((passive) => passive.effects)
    .filter((effect) => effect.type === 'buff' && effect.target === 'target' && effect.statusId === statusId && effect.tags?.includes('max-stacks'))
    .reduce((maxStacks, effect) => maxStacks + (effect.stacks ?? effect.magnitude ?? 0), baseMaxStacks);
}

/** 按当前激活被动和状态 traits 解析待施加状态；结果可由 Store、App 或 Runtime 复用。 */
export function resolveStatusApplication(state: GameState, config: GameConfig, effect: ResolvedEffect): { stacks: number; durationMs: number; magnitude?: number } | undefined {
  if (!effect.statusId) return undefined;
  const definition = config.statuses[effect.statusId];
  if (!definition) return undefined;
  let stacks = effect.stacks ?? 1;
  let durationMs = effect.durationMs ?? definition.durationMs;
  for (const passiveEffect of getActivePassives(state, config).flatMap((passive) => passive.effects)) {
    const magnitude = passiveEffect.magnitude ?? 0;
    if (definition.traits.includes('root') && passiveEffect.tags?.includes('root-duration')) durationMs *= 1 + magnitude;
    if (definition.traits.includes('paralysis') && passiveEffect.tags?.includes('paralysis-stack-rate')) stacks *= 1 + magnitude;
    if (definition.traits.includes('paralysis') && passiveEffect.tags?.includes('paralysis-duration-reduction')) durationMs *= Math.max(0, 1 - magnitude);
    if (passiveEffect.statusId === effect.statusId && passiveEffect.tags?.includes('stack-efficiency')) stacks *= 1 + magnitude;
    if (definition.families.includes('muscle') && passiveEffect.tags?.includes('muscle-debuff-stack-rate')) stacks *= 1 + magnitude;
  }
  // 保留单层数值和实际层数，避免 Runtime/App 使用状态快照时重复或遗漏按层折算。
  let magnitude = effect.magnitude;
  for (const passiveEffect of getActivePassives(state, config).flatMap((passive) => passive.effects)) {
    if (magnitude !== undefined && passiveEffect.statusId === effect.statusId && passiveEffect.tags?.includes('effect-strength')) magnitude *= 1 + (passiveEffect.magnitude ?? 0);
  }
  return { stacks: Math.max(1, Math.round(stacks)), durationMs: Math.max(1, Math.round(durationMs)), ...(magnitude === undefined ? {} : { magnitude }) };
}

/** 供基础攻击与技能结算层复用的全部攻击伤害倍率。 */
export function getAttackDamageMultiplier(state: GameState, config: GameConfig): number {
  return 1 + getActivePassiveModifiers(state, config).attackDamage;
}

/** 供 Runtime 移动控制复用的永久移速倍率。 */
export function getMoveSpeedMultiplier(state: GameState, config: GameConfig): number {
  return 1 + getActivePassiveModifiers(state, config).moveSpeed;
}

/** 玩家身上的通用充能加速状态会同步作用于所有可充能技能。 */
export function getPlayerChargeRateMultiplier(statuses: ActiveStatus[]): number {
  const increase = statuses.filter((status) => status.tags?.includes('charge-rate-increase')).reduce((sum, status) => sum + Math.max(0, status.magnitude ?? 0), 0);
  return Math.max(0.1, 1 + increase);
}

/** 将完整状态快照与状态目录共同映射为 Runtime 可直接消费的行动限制。 */
export function getStatusRestrictionFlags(statuses: ActiveStatus[], config: GameConfig): { activeSkillBlocked: boolean; movementBlocked: boolean; actionsBlocked: boolean } {
  const has = (definitionKey: 'blocksSkills' | 'blocksMovement' | 'blocksActions', tag: string) => statuses.some((status) => config.statuses[status.statusId]?.[definitionKey] || status.tags?.includes(tag) || status.tags?.includes('hard-control'));
  return {
    activeSkillBlocked: has('blocksSkills', 'active-skill-blocked'),
    movementBlocked: has('blocksMovement', 'movement-blocked'),
    actionsBlocked: has('blocksActions', 'actions-blocked'),
  };
}

/** 在防御姿态等状态已生效时，解析反击伤害和当前分支被动的后续效果。 */
export function resolveCounterEffects(state: GameState, config: GameConfig, effects: EffectDefinition[], targetIds: string[]): ResolvedEffect[] {
  const armed = state.playerStatuses.some((status) => status.tags?.some((tag) => tag === 'counterattack' || tag === 'on-melee-hit:counterattack'));
  if (!armed || targetIds.length === 0) return [];
  const counterEffects = effects.filter((effect) => effect.type === 'damage' && effect.tags?.some((tag) => tag === 'counterattack' || tag === 'on-melee-hit'))
    .map((effect) => ({ ...effect, magnitude: effect.magnitude ?? eventMechanicBaselines.counterattackDamage, targetIds: [...new Set(targetIds)] }));
  if (counterEffects.length === 0) return [];
  const followUps = getActivePassives(state, config).flatMap((passive) => passive.effects)
    .filter((effect) => effect.tags?.includes('on-counter-success'))
    .map((effect) => ({ ...effect, targetIds: ['player'] }));
  return [...counterEffects, ...followUps];
}

/** 锁定冲刺只声明目标选择约束，坐标追踪仍由 App/Runtime 负责。 */
export function getEffectTargetingBehavior(effect: EffectDefinition): { requiresLockedTarget: boolean } {
  return { requiresLockedTarget: effect.tags?.includes('locked-charge') ?? false };
}

/** 返回状态阈值控制的最终概率；随机判定由调用方提供 roll 后在事件接口中执行。 */
export function getThresholdControlChance(state: GameState, config: GameConfig, statusId: string, statuses: ActiveStatus[]): number {
  const thresholdEffects = getPassiveThresholdEffects(state, config, statusId);
  if (thresholdEffects.length === 0) return 0;
  const passiveChance = thresholdEffects.reduce((sum, effect) => sum + (effect.tags?.includes('chance') ? effect.magnitude ?? 0 : 1), 0);
  const statusIncrease = statuses.filter((status) => status.statusId === statusId && status.tags?.includes('threshold-control-chance-increase'))
    .reduce((sum, status) => sum + (status.magnitude ?? 0), 0);
  return Math.min(1, Math.max(0, passiveChance + statusIncrease));
}

/** 以外部提供的 [0,1) 随机值判定闪避，便于浏览器与测试共用确定性规则。 */
export function shouldEvadeAttack(state: GameState, roll: number): boolean {
  if (roll < 0 || roll >= 1) return false;
  const dodgeChance = Math.min(1, state.playerStatuses.filter((status) => status.tags?.includes('dodge-chance')).reduce((sum, status) => sum + (status.magnitude ?? 0), 0));
  return roll < dodgeChance;
}

/** 推进玩家状态，暂停规则由外层 tick 在调用前处理。 */
export function tickPlayerStatuses(state: GameState, deltaMs: number): GameState {
  if (deltaMs <= 0 || state.playerStatuses.length === 0) return state;
  const playerStatuses = state.playerStatuses.map((status) => ({ ...status, remainingMs: Math.max(0, status.remainingMs - deltaMs) })).filter((status) => status.remainingMs > 0);
  return playerStatuses.length === state.playerStatuses.length && playerStatuses.every((status, index) => status.remainingMs === state.playerStatuses[index]?.remainingMs) ? state : { ...state, playerStatuses };
}

/** 按配置化状态 ID 延长持续时间；用于“延续/后遗”类效果，不依赖技能名称。 */
export function extendStatusDuration(statuses: ActiveStatus[], statusId: string, additionalMs: number): ActiveStatus[] {
  if (additionalMs <= 0 || !statuses.some((status) => status.statusId === statusId)) return statuses;
  return statuses.map((status) => status.statusId === statusId ? { ...status, remainingMs: status.remainingMs + additionalMs } : status);
}

/** 取得某状态到期后应处理的配置效果，供运行时按状态事件结算，而非按技能 ID 分支。 */
export function getStatusExpiryEffects<T extends EffectDefinition>(effects: T[], statusId: string): T[] {
  return effects.filter((effect) => effect.tags?.some((tag) => tag === `on-${statusId}-expire` || tag === `after-${statusId}-expire`) ?? false);
}

/** 将已有来源状态消费为一个目标状态；转换条件和层数由效果配置决定，不依赖技能名称。 */
export function convertStatus(statuses: ActiveStatus[], sourceStatusId: string, targetStatusId: string, targetStacks: number, durationMs: number): ActiveStatus[] {
  if (!statuses.some((status) => status.statusId === sourceStatusId) || targetStacks < 1 || durationMs <= 0) return statuses;
  return [...statuses.filter((status) => status.statusId !== sourceStatusId && status.statusId !== targetStatusId), { statusId: targetStatusId, stacks: targetStacks, remainingMs: durationMs }];
}

function applyPassiveVitals(state: GameState, config: GameConfig): GameState {
  const maxHealth = 100 + getActivePassiveModifiers(state, config).maxHealth;
  if (maxHealth === state.player.maxHealth) return state;
  const health = maxHealth > state.player.maxHealth ? state.player.health + (maxHealth - state.player.maxHealth) : Math.min(state.player.health, maxHealth);
  return { ...state, player: { ...state.player, maxHealth, health } };
}

function isPlayerSkillBlocked(state: GameState, config: GameConfig): boolean {
  return getStatusRestrictionFlags(state.playerStatuses, config).activeSkillBlocked;
}

function dispelPlayerStatuses(statuses: ActiveStatus[], config: GameConfig, tags: string[], count: number | undefined): ActiveStatus[] {
  const limit = count ?? Number.POSITIVE_INFINITY;
  let removed = 0;
  const remaining = statuses.filter((status) => {
    const definition = config.statuses[status.statusId];
    const matches = tags.includes(`status:${status.statusId}`) || tags.includes(status.statusId) || (tags.includes('kind:debuff') && definition?.kind === 'debuff') || (tags.includes('negative-debuff') && definition?.kind !== 'buff');
    if (matches && removed < limit) { removed += 1; return false; }
    return true;
  });
  return removed > 0 ? remaining : statuses;
}

/**
 * 将已解析的配置效果施加到一个敌方目标。只识别 effect.type/statusId，不依赖任何技能名称。
 * 同名状态由 applyStatus 统一处理刷新、上限和阈值硬控；传入的效果持续时间可覆盖状态默认值。
 */
export function applyEnemyResolvedEffects(state: GameState, config: GameConfig, targetId: string, isLarge: boolean, effects: ResolvedEffect[], options: StatusApplicationOptions = {}): GameState {
  if (state.phase !== 'active' || !targetId) return state;
  const target = state.enemyStatuses[targetId] ?? { isLarge, statuses: [] };
  let statuses = target.statuses;
  for (const effect of effects) {
    if ((effect.type !== 'status' && effect.type !== 'buff' && effect.type !== 'mark') || !effect.statusId || !effect.targetIds.includes(targetId)) continue;
    const definition = config.statuses[effect.statusId];
    const application = resolveStatusApplication(state, config, effect);
    if (!definition || !application || isStatusImmune(statuses, config, definition)) continue;
    const beforeApplication = statuses;
    if (effect.type === 'status' || effect.type === 'mark' || !statuses.some((status) => status.statusId === effect.statusId)) {
      statuses = applyStatus(statuses, { ...definition, durationMs: application.durationMs, maxStacks: getActiveStatusMaxStacks(state, config, effect.statusId) }, { isLarge, stacks: application.stacks }, config);
      statuses = applyPassiveThresholdControls(state, config, beforeApplication, statuses, effect.statusId, isLarge, options);
    }
    statuses = statuses.map((status) => status.statusId === effect.statusId ? { ...status, ...(application.magnitude !== undefined ? { magnitude: application.magnitude } : {}), ...(effect.tags ? { tags: [...new Set([...(status.tags ?? []), ...effect.tags])] } : {}) } : status);
  }
  if (statuses === target.statuses) return state;
  return { ...state, enemyStatuses: { ...state.enemyStatuses, [targetId]: { isLarge, statuses } } };
}

/** 推进每个敌方状态的剩余时间，状态耗尽后移除；空目标快照一并删除。 */
export function tickEnemyStatuses(state: GameState, deltaMs: number): GameState {
  if (deltaMs <= 0 || Object.keys(state.enemyStatuses).length === 0) return state;
  let changed = false;
  const enemyStatuses: GameState['enemyStatuses'] = {};
  for (const [targetId, snapshot] of Object.entries(state.enemyStatuses)) {
    const statuses = snapshot.statuses.map((status) => ({ ...status, remainingMs: Math.max(0, status.remainingMs - deltaMs) })).filter((status) => status.remainingMs > 0);
    if (statuses.length !== snapshot.statuses.length || statuses.some((status, index) => status.remainingMs !== snapshot.statuses[index]?.remainingMs)) changed = true;
    if (statuses.length > 0) enemyStatuses[targetId] = changed ? { ...snapshot, statuses } : snapshot;
    else if (snapshot.statuses.length > 0) changed = true;
  }
  return changed ? { ...state, enemyStatuses } : state;
}

/** 死亡界面的重置命令；存活时拒绝，避免误按 R 丢失本局。 */
export function resetRun(state: GameState): GameState {
  return state.phase === 'dead' ? createInitialGameState() : state;
}

/** 序列化为带版本的本地存档快照。 */
export function createSnapshot(state: GameState, config: GameConfig): SaveSnapshot {
  return { version: config.saveVersion, run: state };
}

/** 仅接受当前版本存档，防止旧结构静默污染局面。 */
export function restoreSnapshot(snapshot: SaveSnapshot | undefined, config: GameConfig): GameState {
  if (snapshot?.version !== config.saveVersion || !snapshot.run || typeof snapshot.run !== 'object') return createInitialGameState();
  return applyPassiveVitals({ ...snapshot.run, objectiveCompleted: snapshot.run.objectiveCompleted ?? false, enemyStatuses: snapshot.run.enemyStatuses ?? {}, playerStatuses: snapshot.run.playerStatuses ?? [], combatRemainingMs: snapshot.run.combatRemainingMs ?? 0, inCombat: snapshot.run.inCombat && (snapshot.run.combatRemainingMs ?? 0) > 0 }, config);
}

/** 返回技能的等级伤害倍率；无伤害成长字段固定为 1。 */
export function skillDamageMultiplier(state: GameState, config: GameConfig, skill: SkillDefinition): number {
  if (!skill.scalesDamageWithLevel) return 1;
  return 1 + config.skillDamageGrowth * ((state.skillLevels[skill.id] ?? 1) - 1);
}

/** 把数据驱动技能配置解析为确定性效果；表现层只消费结果，不再按技能名称分支。 */
export function resolveSkillEffects(state: GameState, config: GameConfig, skillId: string, targetIds: string[]): ResolvedEffect[] {
  const skill = config.skills.find((entry) => entry.id === skillId);
  if (!skill || !state.openSkillIds.includes(skillId)) return [];
  const uniqueTargets = [...new Set(targetIds)];
  const venomMultiplier = skill.subtypeId && state.enhancedSubtypeIds.includes(skill.subtypeId) ? 1.15 : 1;
  const levelMultiplier = skillDamageMultiplier(state, config, skill);
  const attackMultiplier = getAttackDamageMultiplier(state, config);
  const healOverTimeMultiplier = getActivePassives(state, config).flatMap((passive) => passive.effects)
    .filter((effect) => effect.tags?.includes('heal-over-time-multiplier')).reduce((sum, effect) => sum + (effect.magnitude ?? 0), 0);
  return skill.effects.map((effect) => {
    const magnitudeMultiplier = effect.type === 'damage' ? levelMultiplier * venomMultiplier * attackMultiplier
      : effect.type === 'heal' && effect.durationMs && (effect.tags?.includes('per-second') || effect.tags?.includes('total-over-duration')) ? venomMultiplier * (1 + healOverTimeMultiplier) : venomMultiplier;
    const keepsFraction = effect.type === 'buff' || effect.type === 'trigger' || effect.type === 'move' || effect.tags?.some((tag) => ['current-health-cost', 'of-this-damage'].includes(tag));
    return {
      ...effect,
      targetIds: effect.target === 'self' ? ['player'] : uniqueTargets,
      ...(effect.magnitude !== undefined ? { magnitude: keepsFraction ? effect.magnitude * magnitudeMultiplier : Math.round(effect.magnitude * magnitudeMultiplier) } : {}),
      ...(effect.stacks !== undefined ? { stacks: Math.max(1, Math.round(effect.stacks * venomMultiplier)) } : {}),
    };
  });
}

/** 结算配置为每秒伤害的持续效果；不依赖技能 ID。 */
export function getContinuousDamage(effect: EffectDefinition, elapsedMs: number): number {
  if (effect.type !== 'damage' || effect.magnitude === undefined || !effect.tags?.includes('per-second') || elapsedMs <= 0) return 0;
  return Math.floor(elapsedMs / 1000) * effect.magnitude;
}

/** 检查配置化 requires 状态条件，例如 requires:root、requires:paralysis-stacks:10。 */
export function isEffectConditionMet(effect: EffectDefinition, statuses: ActiveStatus[], context: { tags: string[] } = { tags: [] }): boolean {
  const requirements = (effect.tags ?? []).filter((tag) => tag.startsWith('requires:'));
  return requirements.every((tag) => {
    const requirement = tag.slice('requires:'.length);
    if (requirement.startsWith('not-')) {
      const excluded = requirement.slice('not-'.length);
      return !statuses.some((status) => status.statusId === excluded) && !context.tags.includes(excluded);
    }
    const stackMatch = requirement.match(/^(.+)-stacks:(\d+)$/);
    if (stackMatch) return (statuses.find((status) => status.statusId === stackMatch[1])?.stacks ?? 0) >= Number(stackMatch[2]);
    return statuses.some((status) => status.statusId === requirement) || context.tags.includes(requirement);
  });
}

/** 依据状态与调用方上下文（背刺、受伤目标、近战命中等）过滤可执行效果。 */
export function filterEffectsForContext<T extends EffectDefinition>(effects: T[], statuses: ActiveStatus[], context: { tags: string[] }): T[] {
  return effects.filter((effect) => isEffectConditionMet(effect, statuses, context));
}

/** 结算按指定状态层数缩放的引爆伤害，例如 per-paralysis-stack。 */
export function getDetonationDamage(effect: EffectDefinition, statuses: ActiveStatus[]): number {
  if (effect.type !== 'damage' || effect.magnitude === undefined || !effect.tags?.includes('detonate')) return 0;
  const stackTag = effect.tags.find((tag) => tag.startsWith('per-') && tag.endsWith('-stack'));
  if (!stackTag) return effect.magnitude;
  const statusId = stackTag.slice('per-'.length, -'-stack'.length);
  return effect.magnitude * (statuses.find((status) => status.statusId === statusId)?.stacks ?? 0);
}

/** 结算配置化引爆，并按 clear-status 标签移除被引爆状态。 */
export function detonateStatus(effect: EffectDefinition, statuses: ActiveStatus[]): { damage: number; statuses: ActiveStatus[] } {
  const damage = getDetonationDamage(effect, statuses);
  const clearTag = effect.tags?.find((tag) => tag.startsWith('clear-status:'));
  const statusId = clearTag?.slice('clear-status:'.length);
  return { damage, statuses: statusId ? statuses.filter((status) => status.statusId !== statusId) : statuses };
}

/** 扩散只选择存活且非来源目标的前 N 个合法单位，调用方可在此之前按距离过滤。 */
export function selectSpreadTargets(sourceId: string, candidates: Array<{ id: string; alive: boolean }>, count: number): string[] {
  return candidates.filter((candidate) => candidate.alive && candidate.id !== sourceId).slice(0, count).map((candidate) => candidate.id);
}

/** 混乱目标从合法存活单位中选择，绝不攻击自己或死亡单位。 */
export function selectConfusionTarget(actorId: string, candidates: Array<{ id: string; alive: boolean }>, random: () => number): string | undefined {
  const valid = candidates.filter((candidate) => candidate.alive && candidate.id !== actorId);
  return valid.length ? valid[Math.min(valid.length - 1, Math.floor(random() * valid.length))]?.id : undefined;
}

/** 按目标当前状态过滤 requires 条件，并把引爆类伤害解析为最终数值。 */
export function resolveConditionalTargetEffects(effects: EffectDefinition[], statuses: ActiveStatus[], target?: { health: number; maxHealth: number }, context: { tags: string[] } = { tags: [] }): EffectDefinition[] {
  const eligible = effects.filter((effect) => isEffectConditionMet(effect, statuses, context));
  const conditionalDamageBonus = eligible.filter((effect) => effect.magnitude !== undefined && effect.tags?.includes('damage-bonus')).reduce((sum, effect) => {
    const tag = effect.tags?.find((entry) => entry.startsWith('per-missing-health:'));
    const step = tag ? Number(tag.slice('per-missing-health:'.length)) : 0;
    return sum + (step > 0 && target && target.maxHealth > 0 ? Math.floor((1 - target.health / target.maxHealth) / step + 1e-9) * effect.magnitude! : effect.magnitude!);
  }, 0);
  const thisAttackDamageBonus = eligible.filter((effect) => effect.type === 'buff' && effect.tags?.includes('this-attack-damage-bonus')).reduce((sum, effect) => sum + (effect.magnitude ?? 0), 0);
  const defenseLossBonus = eligible.filter((effect) => effect.tags?.includes('damage-amplified-by-defense-loss')).reduce((sum, effect) => sum + (effect.magnitude ?? 0), 0)
    * statuses.filter((status) => status.tags?.includes('physical-defense-reduction')).reduce((sum, status) => sum + (status.magnitude ?? 0), 0);
  const detonationBonus = statuses.filter((status) => status.tags?.includes('detonation-bonus')).reduce((sum, status) => sum + (status.magnitude ?? 0), 0);
  return eligible.map((effect) => {
    const detonationDamage = getDetonationDamage(effect, statuses);
    if (detonationDamage > 0) return { ...effect, magnitude: Math.round(detonationDamage * (1 + conditionalDamageBonus + thisAttackDamageBonus + defenseLossBonus + detonationBonus)) };
    if (effect.type === 'damage' && effect.magnitude !== undefined) {
      const hitCount = effect.tags?.some((tag) => ['two-pounces', 'rapid-bite-count', 'three-hits'].includes(tag)) ? effect.stacks ?? 1 : 1;
      const bonus = conditionalDamageBonus + thisAttackDamageBonus + defenseLossBonus + (effect.tags?.includes('detonate') ? detonationBonus : 0);
      return { ...effect, magnitude: Math.round(effect.magnitude * hitCount * (1 + bonus)) };
    }
    return effect;
  });
}

/**
 * 解析需要外部时机的数值、蓄积与概率机制。它不读取技能 ID，也不修改状态；
 * App/Runtime 按 effects 结算并按 consumeStatusIds 消费，因而可安全接入真实敌方施法事件。
 */
export function resolveEffectEvent(state: GameState, config: GameConfig, effects: EffectDefinition[], event: EffectEvent): EffectEventResult {
  const statuses = event.targetStatuses ?? [];
  const sourceStatuses = event.sourceStatuses ?? statuses;
  const targetIds = [...new Set(event.targetIds)];
  const conditional = resolveConditionalTargetEffects(effects, statuses);
  const candidateIds = event.candidateTargets?.filter((target) => target.alive).map((target) => target.id) ?? targetIds;
  const spreadCandidates = event.candidateTargets ? selectSpreadTargets(targetIds[0] ?? '', event.candidateTargets, eventMechanicBaselines.spreadTargetCount) : targetIds;
  const directiveTags = new Set(['area-paralysis-burst', 'copy-muscle-debuff', 'group-rapid-stack', 'group-root', 'large-paralysis-stacks', 'tick-rate-multiplier']);
  const resolved = conditional.filter((effect) => !effect.tags?.some((tag) => directiveTags.has(tag) || tag.startsWith('spread:') || tag.startsWith('detonate-residual-mark:')))
    .map((effect) => ({ ...effect, targetIds: effect.target === 'self' ? ['player'] : targetIds }));
  const consumeStatusIds: string[] = [];
  let tickRateMultiplier = 1;
  for (const effect of conditional) {
    const tags = effect.tags ?? [];
    if (tags.includes('area-paralysis-burst')) resolved.push({ type: 'status', target: 'area', statusId: 'paralysis', stacks: eventMechanicBaselines.areaParalysisBurstStacks, targetIds: candidateIds });
    if (effect.type === 'status' && effect.statusId && tags.includes('group-rapid-stack')) resolved.push({ ...effect, stacks: eventMechanicBaselines.groupRapidStackCount, targetIds: candidateIds });
    if (effect.type === 'status' && effect.statusId && tags.includes('large-paralysis-stacks')) resolved.push({ ...effect, stacks: eventMechanicBaselines.largeParalysisStackCount, targetIds: candidateIds });
    if (effect.type === 'status' && effect.statusId && tags.includes('group-root')) resolved.push({ ...effect, targetIds: candidateIds });
    if (tags.includes('copy-muscle-debuff')) {
      for (const source of sourceStatuses.filter((status) => config.statuses[status.statusId]?.families.includes('muscle'))) {
        resolved.push({ type: 'status', target: 'area', statusId: source.statusId, stacks: source.stacks, durationMs: source.remainingMs, ...(source.magnitude === undefined ? {} : { magnitude: source.magnitude }), ...(source.tags ? { tags: source.tags } : {}), targetIds: candidateIds });
      }
    }
    for (const tag of tags.filter((entry) => entry.startsWith('spread:'))) {
      const spreadStatusId = tag.slice('spread:'.length);
      if (spreadStatusId === 'venom-corrosion') {
        resolved.push({ type: 'damage', target: 'area', magnitude: eventMechanicBaselines.venomCorrosionDamage, durationMs: 1000, tags: ['per-second', 'venom-corrosion'], targetIds: spreadCandidates });
      } else {
        const source = sourceStatuses.find((status) => status.statusId === spreadStatusId);
        if (source) resolved.push({ type: 'status', target: 'area', statusId: source.statusId, stacks: source.stacks, durationMs: source.remainingMs, ...(source.magnitude === undefined ? {} : { magnitude: source.magnitude }), ...(source.tags ? { tags: source.tags } : {}), targetIds: spreadCandidates });
      }
    }
    for (const tag of tags.filter((entry) => entry.startsWith('detonate-residual-mark:'))) {
      const statusId = tag.slice('detonate-residual-mark:'.length);
      if (sourceStatuses.some((status) => status.statusId === statusId)) {
        resolved.push({ type: 'damage', target: 'area', magnitude: eventMechanicBaselines.residualMarkDetonationDamage, tags: ['residual-mark-detonation'], targetIds });
        consumeStatusIds.push(statusId);
      }
    }
    if (tags.includes('tick-rate-multiplier')) tickRateMultiplier = Math.max(tickRateMultiplier, effect.magnitude ?? 1);
  }

  if (event.kind === 'status-threshold' && event.statusId) {
    const thresholdEffects = getPassiveThresholdEffects(state, config, event.statusId);
    const thresholdControlChance = getThresholdControlChance(state, config, event.statusId, statuses);
    const sourceStacks = statuses.find((status) => status.statusId === event.statusId)?.stacks ?? 0;
    if (event.roll !== undefined && event.roll >= 0 && event.roll < thresholdControlChance) {
      for (const effect of thresholdEffects) {
        if (effect.statusId && sourceStacks >= (effect.stacks ?? config.statuses[event.statusId]?.maxStacks ?? Number.POSITIVE_INFINITY)) {
          resolved.push({ type: 'status', target: 'target', statusId: effect.statusId, stacks: 1, durationMs: effect.durationMs, targetIds });
        }
      }
    }
    return { effects: resolved, consumeStatusIds, thresholdControlChance, ...(tickRateMultiplier === 1 ? {} : { tickRateMultiplier }) };
  }

  if (event.kind !== 'enemy-skill-cast') return { effects: resolved, consumeStatusIds: [...new Set(consumeStatusIds)], ...(tickRateMultiplier === 1 ? {} : { tickRateMultiplier }) };

  const chargedStatuses = statuses.filter((status) => status.tags?.includes('charge-on-enemy-skill-cast'));
  const chargeRate = statuses.filter((status) => status.tags?.includes('charge-rate-increase')).reduce((sum, status) => sum + Math.max(0, status.magnitude ?? 0), 0);
  const chargeStacks = Math.max(1, Math.round(1 + chargeRate));
  for (const status of chargedStatuses) {
    if (status.stacks + chargeStacks >= numericMechanicBaselines.chargedReprisalThreshold) {
      resolved.push({ type: 'damage', target: 'target', magnitude: eventMechanicBaselines.chargedReprisalDamage, tags: ['charged-reprisal-burst'], targetIds });
      consumeStatusIds.push(status.statusId);
    } else {
      resolved.push({ type: 'status', target: 'target', statusId: status.statusId, stacks: chargeStacks, tags: ['charge-on-enemy-skill-cast'], targetIds });
    }
  }

  const activeEventEffects = getActivePassives(state, config).flatMap((passive) => passive.effects)
    .filter((effect) => effect.tags?.includes('on-enemy-skill-cast') && effect.statusId && statuses.some((status) => status.statusId === effect.statusId));
  const reprisalBonus = statuses.filter((status) => status.tags?.includes('reprisal-damage-bonus')).reduce((sum, status) => sum + (status.magnitude ?? 0), 0)
    + activeEventEffects.filter((effect) => effect.tags?.includes('damage-bonus') || effect.tags?.includes('reprisal-damage-bonus')).reduce((sum, effect) => sum + (effect.magnitude ?? 0), 0);
  for (const effect of activeEventEffects.filter((entry) => entry.tags?.includes('damage-bonus') || entry.tags?.includes('reprisal-damage-bonus'))) {
    resolved.push({ type: 'damage', target: 'target', magnitude: Math.round(numericMechanicBaselines.reprisalDamage * (1 + reprisalBonus)), statusId: effect.statusId, tags: ['reprisal-damage'], targetIds });
  }
  return { effects: resolved, consumeStatusIds: [...new Set(consumeStatusIds)], ...(tickRateMultiplier === 1 ? {} : { tickRateMultiplier }) };
}

/** 引爆完成后消费配置中 `per-<status>-stack` 指向的全部状态层。 */
export function consumeDetonatedStatuses(statuses: ActiveStatus[], effects: EffectDefinition[]): ActiveStatus[] {
  const consumed = new Set(effects.filter((effect) => effect.tags?.includes('detonate')).flatMap((effect) => effect.tags ?? [])
    .flatMap((tag) => {
      const match = /^per-(.+)-stack$/.exec(tag);
      return match ? [match[1]] : [];
    }));
  return consumed.size === 0 ? statuses : statuses.filter((status) => !consumed.has(status.statusId));
}

/** 将一次已完成的引爆消费写回指定敌方目标快照。 */
export function consumeEnemyDetonation(state: GameState, targetId: string, effects: EffectDefinition[]): GameState {
  const snapshot = state.enemyStatuses[targetId];
  if (!snapshot) return state;
  const statuses = consumeDetonatedStatuses(snapshot.statuses, effects);
  if (statuses === snapshot.statuses) return state;
  const enemyStatuses = { ...state.enemyStatuses };
  if (statuses.length > 0) enemyStatuses[targetId] = { ...snapshot, statuses };
  else delete enemyStatuses[targetId];
  return { ...state, enemyStatuses };
}

function refreshOpenSkills(state: GameState, config: GameConfig): GameState {
  const openSkillIds = config.skills.filter((skill) => {
    const ownsBranch = state.unlockedBranchIds.includes(skill.branchId);
    const ownsSubtype = !skill.subtypeId || state.activeSubtypeId === skill.subtypeId;
    return ownsBranch && ownsSubtype && state.characterLevel >= skill.unlockLevel;
  }).map((skill) => skill.id);
  return { ...state, openSkillIds };
}

function getActivePassives(state: GameState, config: GameConfig) {
  return config.passives.filter((passive) => state.originId === 'venom'
    ? passive.subtypeId === state.activeSubtypeId
    : !passive.subtypeId && state.unlockedBranchIds.includes(passive.branchId));
}

/** 当前亚型/分支的被动显式声明阈值控制；全局状态目录不承担专属亚型效果。 */
function getPassiveThresholdEffects(state: GameState, config: GameConfig, sourceStatusId: string): EffectDefinition[] {
  return getActivePassives(state, config).flatMap((passive) => passive.effects)
    .filter((effect) => effect.type === 'trigger' && Boolean(effect.statusId) && effect.tags?.includes(`${sourceStatusId}-threshold`));
}

function applyPassiveThresholdControls(state: GameState, config: GameConfig, before: ActiveStatus[], current: ActiveStatus[], sourceStatusId: string, isLarge: boolean, options: StatusApplicationOptions): ActiveStatus[] {
  const priorStacks = before.find((status) => status.statusId === sourceStatusId)?.stacks ?? 0;
  const currentStacks = current.find((status) => status.statusId === sourceStatusId)?.stacks ?? 0;
  if (currentStacks <= priorStacks) return current;
  const chance = getThresholdControlChance(state, config, sourceStatusId, current);
  const rollSucceeded = chance >= 1 || (options.thresholdRoll !== undefined && options.thresholdRoll >= 0 && options.thresholdRoll < chance);
  if (!rollSucceeded) return current;
  return getPassiveThresholdEffects(state, config, sourceStatusId).reduce((statuses, effect) => {
    const thresholdStacks = effect.stacks ?? config.statuses[sourceStatusId]?.maxStacks ?? Number.POSITIVE_INFINITY;
    const definition = effect.statusId ? config.statuses[effect.statusId] : undefined;
    if (!definition || priorStacks >= thresholdStacks || currentStacks < thresholdStacks) return statuses;
    const durationMs = effect.durationMs ?? definition.durationMs;
    return applyStatus(statuses, { ...definition, durationMs: definition.hardControl && isLarge ? durationMs * config.largeHardControlMultiplier : durationMs }, { isLarge, stacks: 1 }, config);
  }, current);
}

function isStatusImmune(current: ActiveStatus[], config: GameConfig, incoming: StatusDefinition): boolean {
  return current.some((status) => {
    const immunity = config.statuses[status.statusId];
    return immunity?.immunityFamilies?.some((family) => incoming.families.includes(family)) || immunity?.immunityTraits?.some((trait) => incoming.traits.includes(trait));
  });
}

function clampReduction(value: number): number {
  return Number.isFinite(value) ? Math.min(0.9, Math.max(0, value)) : 0;
}

function sumStatusContributions(statuses: ActiveStatus[], tag: string, maximumContribution: number): number {
  return statuses.filter((status) => status.tags?.includes(tag) || status.tags?.includes(`${tag}-per-stack`))
    .reduce((sum, status) => sum + getStatusContribution(status, maximumContribution), 0);
}

function getStatusContribution(status: ActiveStatus, maximumContribution: number): number {
  const magnitude = Number.isFinite(status.magnitude) ? Math.max(0, status.magnitude ?? 0) : 0;
  const tags = status.tags ?? [];
  const perStack = tags.includes('per-stack') || tags.some((tag) => tag.endsWith('-per-stack'));
  const raw = magnitude * (perStack ? Math.max(0, status.stacks) : 1);
  const cap = tags.map((tag) => /^cap:(\d*\.?\d+)$/.exec(tag)?.[1]).find((value): value is string => value !== undefined);
  return Math.min(raw, maximumContribution, cap === undefined ? Number.POSITIVE_INFINITY : Math.max(0, Number(cap)));
}

function clampStatusMultiplier(value: number): number {
  return clampValue(value, enemyStatusNumericBaselines.minimumMultiplier, enemyStatusNumericBaselines.maximumMultiplier);
}

function clampValue(value: number, minimum: number, maximum: number): number {
  const clamped = Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, value)) : minimum;
  return Math.round(clamped * 10_000) / 10_000;
}

function parseDamageSplit(tags: string[]): { physical: number; venom: number } | undefined {
  const tag = tags.find((entry) => entry.startsWith('damage-split:'));
  if (!tag) return undefined;
  const entries = tag.slice('damage-split:'.length).split(',').map((entry) => entry.split(':'));
  const physical = Number(entries.find(([kind]) => kind === 'physical')?.[1]);
  const venom = Number(entries.find(([kind]) => kind === 'venom')?.[1]);
  return Number.isFinite(physical) && Number.isFinite(venom) && physical >= 0 && venom >= 0 ? { physical, venom } : undefined;
}

function levelForXp(xp: number, config: GameConfig): number {
  let level = 1;
  config.levelXpThresholds.forEach((threshold, index) => { if (xp >= threshold) level = index + 1; });
  return level;
}

function getSkillRuntime(state: GameState, skill: SkillDefinition): SkillRuntime {
  return state.skillRuntime[skill.id] ?? { cooldownRemainingMs: 0, ...(skill.maxCharges ? { charges: skill.maxCharges, rechargeRemainingMs: 0 } : {}) };
}

function addUnique(items: string[], item: string): string[] {
  return items.includes(item) ? items : [...items, item];
}
