import { createStore } from 'zustand/vanilla';
import type { EffectDefinition, GameConfig, OriginId, SkillSlot } from '../config';
import {
  applyDamage, applyEnemyResolvedEffects, applyPlayerResolvedEffects, assignVenomPoint, castSkill, completeRoundObjective, consumeEnemyDetonation, createInitialGameState, createRun as createDomainRun, createSnapshot, equipSkill, gainReward, getStatusRestrictionFlags, resetRun, resolveCounterEffects as resolveDomainCounterEffects, resolveEffectEvent as resolveDomainEffectEvent, restoreSnapshot, selectSubtype, setCombatState, tick, unlockBranch, unlockSubtype, upgradeSkill,
} from '../domain';
import type { ActiveStatus, EffectEvent, EffectEventResult, GameState, ResolvedEffect, SaveSnapshot, StatusApplicationOptions } from '../domain';

/**
 * UI 和 Babylon 适配器共享的低频产品状态入口。
 * 逐帧坐标、粒子和网格对象不得存入此 store。
 */
export interface GameStoreState {
  run: GameState;
  createRun: (originId: OriginId, branchId: string) => void;
  gainReward: (characterXp: number, skillXp: number) => void;
  unlockBranch: (branchId: string) => void;
  unlockSubtype: (subtypeId: string) => void;
  assignVenomPoint: (subtypeId: string) => void;
  selectSubtype: (subtypeId: string) => void;
  equipSkill: (skillId: string, slot: SkillSlot) => void;
  upgradeSkill: (skillId: string) => void;
  castSkill: (slot: SkillSlot, targetIds: string[]) => void;
  tick: (deltaMs: number) => void;
  setPaused: (paused: boolean) => void;
  setInCombat: (inCombat: boolean) => void;
  applyPlayerDamage: (damage: number) => void;
  /** 供 GameApp/Runtime 结算通用自身治疗与护盾效果。 */
  applyPlayerResolvedEffects: (effects: ResolvedEffect[]) => void;
  /** UI adapter 的稳定玩家状态快照读取入口。 */
  getPlayerStatuses: () => ActiveStatus[];
  /** Runtime 可读取的完整状态限制快照。 */
  getStatusRestrictions: () => { activeSkillBlocked: boolean; movementBlocked: boolean; actionsBlocked: boolean };
  /** 按目标 ID 写入运行时已解析的敌方状态效果。 */
  applyResolvedStatusEffects: (targetId: string, isLarge: boolean, effects: ResolvedEffect[], options?: StatusApplicationOptions) => void;
  /** UI adapter 的稳定敌方状态快照读取入口。 */
  getTargetStatuses: (targetId: string) => ActiveStatus[];
  /** Only extends an existing status; unknown target/status IDs are a no-op. */
  extendExistingTargetStatus: (targetId: string, statusId: string, durationMs: number) => void;
  /** Atomically consumes source status then applies a resolved replacement effect. */
  replaceTargetStatus: (targetId: string, sourceStatusId: string, effect: ResolvedEffect) => void;
  /** Removes only statuses selected by the caller's resolved rule. */
  removeTargetStatuses: (targetId: string, shouldRemove: (status: ActiveStatus) => boolean) => void;
  consumeTargetDetonation: (targetId: string, effects: ResolvedEffect[]) => void;
  /** 读取当前局面下的通用事件效果；外层提供敌方施法或概率时机后再结算。 */
  resolveEffectEvent: (effects: EffectDefinition[], event: EffectEvent) => EffectEventResult;
  /** Runtime 命中近战攻击后读取的通用反击效果。 */
  resolveCounterEffects: (effects: EffectDefinition[], targetIds: string[]) => ResolvedEffect[];
  completeRoundObjective: () => void;
  markDead: () => void;
  resetRun: () => void;
  snapshot: () => SaveSnapshot;
}

/** 创建不耦合浏览器存储的 vanilla store，持久化由 app 层在关键动作后调用 snapshot。 */
export function createGameStore(config: GameConfig, snapshot?: SaveSnapshot) {
  const initialRun = restoreSnapshot(snapshot, config);
  return createStore<GameStoreState>((set, get) => ({
    run: initialRun,
    createRun: (originId, branchId) => set((current) => ({ run: createDomainRun(current.run, config, originId, branchId) })),
    gainReward: (characterXp, skillXp) => set((current) => ({ run: gainReward(current.run, config, { characterXp, skillXp }) })),
    unlockBranch: (branchId) => set((current) => ({ run: unlockBranch(current.run, config, branchId) })),
    unlockSubtype: (subtypeId) => set((current) => ({ run: unlockSubtype(current.run, config, subtypeId) })),
    assignVenomPoint: (subtypeId) => set((current) => ({ run: assignVenomPoint(current.run, config, subtypeId) })),
    selectSubtype: (subtypeId) => set((current) => ({ run: selectSubtype(current.run, config, subtypeId) })),
    equipSkill: (skillId, slot) => set((current) => ({ run: equipSkill(current.run, config, skillId, slot) })),
    upgradeSkill: (skillId) => set((current) => ({ run: upgradeSkill(current.run, config, skillId) })),
    castSkill: (slot, targetIds) => set((current) => ({ run: castSkill(current.run, config, slot, targetIds) })),
    tick: (deltaMs) => set((current) => ({ run: tick(current.run, config, deltaMs) })),
    setPaused: (paused) => set((current) => ({ run: { ...current.run, paused } })),
    setInCombat: (inCombat) => set((current) => ({ run: setCombatState(current.run, config, inCombat) })),
    applyPlayerDamage: (damage) => set((current) => ({ run: applyDamage(current.run, damage, 'physical', config) })),
    applyPlayerResolvedEffects: (effects) => set((current) => ({ run: applyPlayerResolvedEffects(current.run, config, effects) })),
    getPlayerStatuses: () => get().run.playerStatuses,
    getStatusRestrictions: () => getStatusRestrictionFlags(get().run.playerStatuses, config),
    applyResolvedStatusEffects: (targetId, isLarge, effects, options) => set((current) => ({ run: applyEnemyResolvedEffects(current.run, config, targetId, isLarge, effects, options) })),
    getTargetStatuses: (targetId) => get().run.enemyStatuses[targetId]?.statuses ?? [],
    extendExistingTargetStatus: (targetId, statusId, durationMs) => set((current) => {
      if (!Number.isFinite(durationMs) || durationMs <= 0) return current;
      const target = current.run.enemyStatuses[targetId];
      if (!target || !target.statuses.some((status) => status.statusId === statusId)) return current;
      return {
        run: {
          ...current.run,
          enemyStatuses: {
            ...current.run.enemyStatuses,
            [targetId]: {
              ...target,
              statuses: target.statuses.map((status) => status.statusId === statusId ? { ...status, remainingMs: status.remainingMs + durationMs } : status),
            },
          },
        },
      };
    }),
    replaceTargetStatus: (targetId, sourceStatusId, effect) => set((current) => {
      const target = current.run.enemyStatuses[targetId];
      if (!target || !target.statuses.some((status) => status.statusId === sourceStatusId) || effect.type !== 'status' || !effect.statusId) return current;
      const statuses = target.statuses.filter((status) => status.statusId !== sourceStatusId);
      const run = {
        ...current.run,
        enemyStatuses: { ...current.run.enemyStatuses, [targetId]: { ...target, statuses } },
      };
      return { run: applyEnemyResolvedEffects(run, config, targetId, target.isLarge, [{ ...effect, targetIds: [targetId] }]) };
    }),
    removeTargetStatuses: (targetId, shouldRemove) => set((current) => {
      const target = current.run.enemyStatuses[targetId];
      if (!target) return current;
      const statuses = target.statuses.filter((status) => !shouldRemove(status));
      if (statuses.length === target.statuses.length) return current;
      const enemyStatuses = { ...current.run.enemyStatuses };
      if (statuses.length) enemyStatuses[targetId] = { ...target, statuses };
      else delete enemyStatuses[targetId];
      return { run: { ...current.run, enemyStatuses } };
    }),
    consumeTargetDetonation: (targetId, effects) => set((current) => ({ run: consumeEnemyDetonation(current.run, targetId, effects) })),
    resolveEffectEvent: (effects, event) => resolveDomainEffectEvent(get().run, config, effects, event),
    resolveCounterEffects: (effects, targetIds) => resolveDomainCounterEffects(get().run, config, effects, targetIds),
    completeRoundObjective: () => set((current) => ({ run: completeRoundObjective(current.run, config) })),
    markDead: () => set((current) => ({ run: current.run.phase === 'active' ? { ...current.run, phase: 'dead' } : current.run })),
    resetRun: () => set((current) => ({ run: resetRun(current.run) })),
    snapshot: () => createSnapshot(get().run, config),
  }));
}

export const emptyGameState = createInitialGameState;
