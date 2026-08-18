import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import { gameConfig, runtimeConfig, runtimeStatusBehavior, runtimeTagBehavior, type EffectDefinition, type OriginId } from '../config';
import { damageBaselines } from '../config/damage-baselines.config';
import { getActivePassiveModifiers, getEnemyStatusModifiers, getMoveSpeedMultiplier, getStatusRestrictionFlags, resolveConditionalTargetEffects, resolveEnemyDamage, resolveSkillEffects, shouldEvadeAttack, type GameState, type ResolvedEffect, type SaveSnapshot } from '../domain';
import type { BabylonGameRuntime, RuntimeEvent, RuntimeTarget } from '../game';
import { createGameStore, type GameStoreState } from '../store';
import type { GameUiActions, PanelId } from '../ui/types';
import { App } from './App';
import { resolveCastTargetIds } from './cast-targeting';
import { filterEffectsByChance, isDelayedStatusCarrier, materializeCopiedStatus, materializeSpreadStackBonus, shouldBreakStatus } from './effect-mechanics';
import { resolveEventEffects, type EffectEvent } from './event-effect-resolver';
import { buildGameViewModel } from './game-adapter';
import { installGameE2eTestPort } from './e2e-test-port';
import { expiredEnemyStatusIds } from './status-expiry';

const saveKey = 'reborn-snake-run-v1';

export function GameApp() {
  const store = useMemo(() => createGameStore(gameConfig, loadSnapshot()), []);
  const run = useStore(store, (state) => state.run);
  const [selectedOriginId, setSelectedOriginId] = useState<OriginId | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<PanelId | null>(null);
  const [runtimeTarget, setRuntimeTarget] = useState<RuntimeTarget>();

  useEffect(() => applyDevelopmentFixture(store), [store]);
  useEffect(() => store.subscribe((state) => persistSnapshot(state)), [store]);

  const viewModel = buildGameViewModel(run, gameConfig, {
    selectedOriginId,
    selectedBranchId,
    activePanel,
    target: runtimeTarget ? {
      name: runtimeConfig.enemies.find((enemy) => enemy.id === runtimeTarget.id)?.kind === 'largeElite' ? '荒野巨蜥王' : '荒野猎物',
      health: runtimeTarget.health,
      maxHealth: runtimeTarget.maxHealth,
      statuses: (run.enemyStatuses[runtimeTarget.id]?.statuses ?? []).map((status) => ({
        id: status.statusId,
        name: gameConfig.statuses[status.statusId]?.name ?? status.statusId,
        stacks: status.stacks,
        remainingMs: status.remainingMs,
      })),
    } : null,
  });
  viewModel.playerStatuses = run.playerStatuses.map((status) => ({
    id: status.statusId,
    name: gameConfig.statuses[status.statusId]?.name ?? status.statusId,
    stacks: status.stacks,
    remainingMs: status.remainingMs,
  }));
  const actions = useMemo<GameUiActions>(() => ({
    chooseOrigin: (originId) => {
      setSelectedOriginId(originId as OriginId);
      setSelectedBranchId(null);
    },
    chooseBranch: setSelectedBranchId,
    createRun: (originId, branchId) => store.getState().createRun(originId as OriginId, branchId),
    equipSkill: (skillId, slot) => store.getState().equipSkill(skillId, slot),
    openPanel: (panelId) => {
      setActivePanel(panelId);
      store.getState().setPaused(true);
    },
    closePanel: () => {
      setActivePanel(null);
      store.getState().setPaused(false);
    },
    selectSubtype: (subtypeId) => store.getState().selectSubtype(subtypeId),
    unlockBranch: (branchId) => store.getState().unlockBranch(branchId),
    unlockSubtype: (subtypeId) => store.getState().unlockSubtype(subtypeId),
    assignVenomPoint: (subtypeId) => store.getState().assignVenomPoint(subtypeId),
    upgradeSkill: (skillId) => store.getState().upgradeSkill(skillId),
    resetRun: () => {
      store.getState().resetRun();
      if (store.getState().run.phase === 'creation') localStorage.removeItem(saveKey);
      setSelectedOriginId(null);
      setSelectedBranchId(null);
      setActivePanel(null);
    },
  }), [store]);

  return <div className="game-root">{run.phase === 'active' ? <GameCanvas onTargetChange={setRuntimeTarget} store={store} /> : null}<App viewModel={viewModel} actions={actions} /></div>;
}

function GameCanvas({ store, onTargetChange }: { store: StoreApi<GameStoreState>; onTargetChange: (target?: RuntimeTarget) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let disposed = false;
    let runtime: BabylonGameRuntime | undefined;
    let unsubscribe: (() => void) | undefined;
    let uninstallTestPort: (() => void) | undefined;
    const effectTimers = new Set<number>();
    const hazardPayloads = new Map<number, ResolvedEffect[]>();
    const domainClock = window.setInterval(() => store.getState().tick(runtimeConfig.domainTickIntervalMs), runtimeConfig.domainTickIntervalMs);
    const onSkillKey = (event: KeyboardEvent) => {
      if (!runtime) return;
      const activeRuntime = runtime;
      if (!['1', '2', '3', '4'].includes(event.key)) return;
      const slot = Number(event.key) as 1 | 2 | 3 | 4;
      if (store.getState().getStatusRestrictions().activeSkillBlocked) return;
      const skillId = store.getState().run.loadout[slot];
      if (!skillId) return;
      const skill = gameConfig.skills.find((entry) => entry.id === skillId);
      if (!skill) return;
      if (!runtime.currentTarget && skill.effects.some((effect) => effect.tags?.some((tag) => ['auto-lock', 'detect-radius-bonus', 'injured-target-reveal'].includes(tag)))) {
        const bonus = skill.effects.filter((effect) => effect.tags?.includes('detect-radius-bonus')).reduce((sum, effect) => sum + (effect.magnitude ?? 0), 0);
        const targetId = runtime.queryInjuredEnemies(runtime.playerPosition, runtimeTagBehavior.baseDetectRadius + bonus)[0];
        if (targetId) runtime.setCurrentTarget(targetId);
      }
      const initialTargets = resolveCastTargetIds(activeRuntime, skill.effects);
      const bounceCount = skill.effects.flatMap((effect) => effect.tags ?? []).map((tag) => /^bounce-target-count:(\d+)$/.exec(tag)?.[1]).find((value): value is string => value !== undefined);
      const targets = bounceCount && activeRuntime.currentTarget ? [...new Set([...initialTargets, ...activeRuntime.queryStatusSpreadTargets(activeRuntime.currentTarget.id, { radius: runtimeTagBehavior.spreadRadius, maxTargets: Number(bounceCount) })])] : initialTargets;
      const before = store.getState().run.skillRuntime[skillId];
      store.getState().castSkill(slot, targets);
      const after = store.getState().run.skillRuntime[skillId];
      if (after === before) return;
      const effects = resolveSkillEffects(store.getState().run, gameConfig, skillId, targets);
      const activePassiveEffects = gameConfig.passives.filter((passive) => store.getState().run.originId === 'venom' ? passive.subtypeId === store.getState().run.activeSubtypeId : !passive.subtypeId && store.getState().run.unlockedBranchIds.includes(passive.branchId)).flatMap((passive) => passive.effects);
      createConfiguredHazards(activeRuntime, effects, activePassiveEffects, hazardPayloads);
      const selfEffects = resolveConditionalTargetEffects(effects.filter((effect) => effect.target === 'self'), store.getState().run.playerStatuses) as ResolvedEffect[];
      const deferredHeals = selfEffects.filter((effect) => effect.type === 'heal' && effect.durationMs && effect.tags?.some((tag) => ['per-second', 'total-over-duration'].includes(tag)));
      store.getState().applyPlayerResolvedEffects(selfEffects.filter((effect) => !deferredHeals.includes(effect)));
      deferredHeals.forEach((effect) => schedulePeriodicHealing(activeRuntime, store, effect, effectTimers));
      activeRuntime.syncPlayerHealth(store.getState().run.player.health, store.getState().run.player.maxHealth);
      [...new Set(effects.flatMap((effect) => effect.tags ?? []).filter((tag) => tag.startsWith('detonate-mark:')).map((tag) => tag.slice('detonate-mark:'.length)))].forEach((markerId) => activeRuntime.removeAreaHazardsByMarker(markerId).forEach((id) => hazardPayloads.delete(id)));
      for (const targetId of targets) {
        store.getState().removeTargetStatuses(targetId, (status) => shouldBreakStatus(status, { action: 'skill' }));
        const targetVitals = activeRuntime.currentTarget?.id === targetId ? activeRuntime.currentTarget : undefined;
        const contextTags = [
          ...(activeRuntime.isPlayerBehindEnemy(targetId, Math.PI / 3) ? ['back-attack'] : []),
          ...(targetVitals && targetVitals.health < targetVitals.maxHealth ? ['injured-target'] : []),
        ];
        let targetEffects = resolveConditionalTargetEffects(effects.filter((effect) => effect.targetIds.includes(targetId) || effect.tags?.includes('this-attack-damage-bonus')), store.getState().getTargetStatuses(targetId), targetVitals, { tags: contextTags }) as ResolvedEffect[];
        const domainTargetEvent = store.getState().resolveEffectEvent(targetEffects, { kind: 'target-damage', targetIds: [targetId], targetStatuses: store.getState().getTargetStatuses(targetId), sourceStatuses: store.getState().getTargetStatuses(targetId), candidateTargets: activeRuntime.enemyIds.map((id) => ({ id, alive: true })) });
        targetEffects = domainTargetEvent.effects;
        if (domainTargetEvent.tickRateMultiplier && domainTargetEvent.tickRateMultiplier !== 1) activeRuntime.scaleAreaHazardIntervals(domainTargetEvent.tickRateMultiplier);
        targetEffects = filterEffectsByChance(targetEffects, Math.random, runtimeTagBehavior.highChanceProbability) as ResolvedEffect[];
        const bodySize = activeRuntime.currentTarget?.id === targetId
          ? activeRuntime.currentTarget.bodySize
          : runtimeConfig.enemies.find((enemy) => enemy.id === targetId)?.bodySize;
        const delayedStatuses = targetEffects.filter(isDelayedStatusCarrier);
        const expiryStatuses = targetEffects.filter((effect) => effect.type === 'status' && effect.statusId && effect.tags?.some((tag) => /^on-(.+)-expire$/.test(tag)));
        expiryStatuses.forEach((effect) => {
          const markerId = effect.tags?.map((tag) => /^on-(.+)-expire$/.exec(tag)?.[1]).find((value): value is string => value !== undefined);
          const marker = targetEffects.find((candidate) => candidate.type === 'mark' && candidate.statusId === markerId);
          if (markerId && marker) scheduleMarkerExpiry(store, targetId, bodySize === 'large', markerId, marker.durationMs ?? gameConfig.statuses[markerId]?.durationMs ?? runtimeTagBehavior.delayedTriggerMs, effect, effectTimers);
        });
        const conversions = targetEffects.filter((effect) => effect.statusId && effect.tags?.some((tag) => tag.startsWith('convert:')));
        conversions.forEach((effect) => effect.tags?.filter((tag) => tag.startsWith('convert:')).forEach((tag) => store.getState().replaceTargetStatus(targetId, tag.slice('convert:'.length), { ...effect, type: 'status', targetIds: [targetId] })));
        const statusCarriers = targetEffects.filter((effect) => !delayedStatuses.includes(effect) && !conversions.includes(effect) && (effect.type === 'buff' || effect.type === 'trigger' || effect.type === 'mark') && effect.statusId && !effect.tags?.some((tag) => tag.startsWith('copy-status:') || ['extend-existing-status', 'extend-status', 'delay-status-expiry'].includes(tag))).map((effect) => ({ ...effect, type: 'status' as const }));
        store.getState().applyResolvedStatusEffects(targetId, bodySize === 'large', [...targetEffects.filter((effect) => !delayedStatuses.includes(effect) && !expiryStatuses.includes(effect)), ...statusCarriers]);
        const eventKinds: EffectEvent[] = [skill.damageType === 'venom' ? 'venom-hit' : 'hit'];
        if (store.getState().getTargetStatuses(targetId).some((status) => status.statusId === 'bleed')) eventKinds.push('bleed-hit');
        const resolvedStatuses = store.getState().getTargetStatuses(targetId);
        if (targetEffects.some((effect) => effect.statusId === 'heart-erosion') && resolvedStatuses.some((status) => status.statusId === 'heart-erosion')) eventKinds.push('heart-erosion');
        if (targetEffects.some((effect) => effect.statusId === 'kidney-reprisal') && resolvedStatuses.some((status) => status.statusId === 'kidney-reprisal')) eventKinds.push('kidney-reprisal');
        if (targetEffects.some((effect) => effect.statusId === 'confusion') && resolvedStatuses.some((status) => status.statusId === 'confusion')) eventKinds.push('confusion');
        eventKinds.forEach((eventKind) => applyPassiveEventEffects(activeRuntime, store, targetId, eventKind));
        const copied = targetEffects.flatMap((effect) => [materializeCopiedStatus(effect, store.getState().getTargetStatuses(targetId)), materializeSpreadStackBonus(effect, store.getState().getTargetStatuses(targetId))]).filter((effect): effect is EffectDefinition => effect !== undefined);
        if (copied.length) {
          const copyCount = targetEffects.flatMap((effect) => effect.tags ?? []).map((tag) => /(?:bounce|spread)-target-count:(\d+)/.exec(tag)?.[1]).find((value): value is string => value !== undefined);
          runtime.queryStatusSpreadTargets(targetId, { radius: runtimeTagBehavior.spreadRadius, maxTargets: copyCount ? Number(copyCount) : runtimeTagBehavior.spreadTargetCount }).forEach((copyTargetId) => {
            store.getState().applyResolvedStatusEffects(copyTargetId, runtimeConfig.enemies.find((enemy) => enemy.id === copyTargetId)?.bodySize === 'large', copied.map((effect) => ({ ...effect, targetIds: [copyTargetId] })));
          });
        }
        delayedStatuses.forEach((effect) => scheduleDelayedStatus(store, targetId, bodySize === 'large', effect, effectTimers));
        targetEffects.filter((effect) => effect.tags?.some((tag) => ['extend-existing-status', 'extend-status', 'delay-status-expiry'].includes(tag)) && effect.statusId && effect.durationMs).forEach((effect) => store.getState().extendExistingTargetStatus(targetId, effect.statusId!, effect.durationMs!));
        let immediateDamage = 0;
        targetEffects.filter((effect) => effect.type === 'damage' && effect.magnitude).forEach((effect) => {
          if (effect.tags?.includes('per-second') && effect.durationMs) schedulePeriodicDamage(activeRuntime, store, targetId, effect, effectTimers);
          else {
            const target = runtimeConfig.enemies.find((enemy) => enemy.id === targetId);
            const damage = target ? resolveEnemyDamage({ amount: effect.magnitude!, damageType: skill.damageType, tags: effect.tags, target, targetStatuses: store.getState().getTargetStatuses(targetId) }) : 0;
            immediateDamage += damage;
            activeRuntime.applyEnemyDamage(targetId, damage);
            store.getState().removeTargetStatuses(targetId, (status) => shouldBreakStatus(status, { damage }));
          }
        });
        const lifeSteal = effects.filter((effect) => effect.type === 'heal' && effect.target === 'self' && effect.tags?.includes('of-this-damage')).reduce((sum, effect) => sum + (effect.magnitude ?? 0), 0);
        if (lifeSteal > 0 && immediateDamage > 0) store.getState().applyPlayerResolvedEffects([{ type: 'heal', target: 'self', magnitude: immediateDamage * lifeSteal, targetIds: ['player'] }]);
        targetEffects.filter((effect) => effect.type === 'trigger' && effect.tags?.some((tag) => tag === 'knockback' || tag === 'knockback:small')).forEach((effect) => {
          if (effect.tags?.includes('knockback:small') && bodySize !== 'small') return;
          activeRuntime.knockbackEnemy(targetId, effect.magnitude ?? runtimeTagBehavior.smallKnockbackDistance);
        });
        targetEffects.filter((effect) => effect.tags?.includes('interrupt-cast')).forEach(() => activeRuntime.gateEnemyActions(targetId, runtimeTagBehavior.interruptActionGateMs));
        targetEffects.filter((effect) => effect.tags?.some((tag) => tag.startsWith('knockup:'))).forEach((effect) => {
          const allowed = effect.tags?.find((tag) => tag.startsWith('knockup:'))?.slice('knockup:'.length).split(',') ?? [];
          if (bodySize && allowed.includes(bodySize)) { activeRuntime.gateEnemyActions(targetId, runtimeTagBehavior.knockupActionGateMs); activeRuntime.knockbackEnemy(targetId, effect.magnitude ?? runtimeTagBehavior.smallKnockbackDistance); }
        });
        targetEffects.filter((effect) => effect.type === 'move' && effect.tags?.includes('pull-to-caster')).forEach(() => {
          const enemyPosition = activeRuntime.enemyPosition(targetId);
          if (!enemyPosition) return;
          const playerPosition = activeRuntime.playerPosition;
          activeRuntime.displaceEnemyRelativeToPlayer(targetId, { type: 'pull', distance: Math.hypot(enemyPosition.x - playerPosition.x, enemyPosition.z - playerPosition.z), collisionRadius: runtimeConfig.player.collisionRadius });
        });
        store.getState().consumeTargetDetonation(targetId, targetEffects);
        if (domainTargetEvent.consumeStatusIds.length) store.getState().removeTargetStatuses(targetId, (status) => domainTargetEvent.consumeStatusIds.includes(status.statusId));
        applyPassiveStatusSpread(activeRuntime, store, targetId);
        targetEffects.filter((effect) => (effect.type === 'status' || effect.type === 'buff') && effect.statusId).forEach((effect) => activeRuntime.presentSkillEffect({ type: 'statusVisual', statusId: effect.statusId!, targetIds: [targetId], durationMs: effect.durationMs ?? gameConfig.statuses[effect.statusId!]?.durationMs ?? 0 }));
      }
      selfEffects.forEach((effect) => {
        if (effect.type !== 'move' || effect.target !== 'self') return;
        const distance = effect.magnitude ?? runtimeTagBehavior.defaultPounceDistance;
        if (effect.tags?.includes('backward-teleport')) {
          const position = activeRuntime.playerPosition;
          activeRuntime.performPlayerMovement({ type: 'teleport', destination: { x: position.x - Math.sin(activeRuntime.playerFacingRadians) * distance, z: position.z - Math.cos(activeRuntime.playerFacingRadians) * distance } });
        } else activeRuntime.performPlayerMovement({ type: 'dash', distance });
      });
      effects.filter((effect) => effect.type === 'trigger' && effect.tags?.includes('decoy') && effect.durationMs).forEach((effect) => activeRuntime.setDecoy({ position: activeRuntime.playerPosition, durationMs: effect.durationMs! }));
      effects.filter((effect) => effect.type === 'trigger' && effect.tags?.includes('taunt')).forEach((effect) => activeRuntime.setDecoy({ position: activeRuntime.playerPosition, durationMs: effect.durationMs ?? runtimeTagBehavior.interruptActionGateMs }));
    };
    void import('../game').then(({ BabylonGameRuntime: Runtime }) => {
      if (disposed) return;
      runtime = new Runtime({ config: runtimeConfig, onEvent: (event) => handleRuntimeEvent(event, runtime!, store, onTargetChange, hazardPayloads) });
      runtime.mount(canvasRef.current ?? undefined);
      syncRuntimeRestrictions(runtime, store.getState().run);
      uninstallTestPort = installGameE2eTestPort(store, runtime);
      unsubscribe = store.subscribe((state, previous) => {
        if (state.run.paused !== previous.run.paused) runtime?.setPaused(state.run.paused);
        if (state.run.phase === 'dead' && previous.run.phase !== 'dead') runtime?.applyPlayerDamage(runtimeConfig.player.maxHealth);
        if (state.run.playerStatuses !== previous.run.playerStatuses || state.run.enemyStatuses !== previous.run.enemyStatuses || state.run.unlockedBranchIds !== previous.run.unlockedBranchIds || state.run.activeSubtypeId !== previous.run.activeSubtypeId) {
          if (runtime) syncRuntimeRestrictions(runtime, state.run);
        }
        if (runtime && state.run.enemyStatuses !== previous.run.enemyStatuses) {
          const activeEffects = [...gameConfig.passives.filter((passive) => state.run.originId === 'venom' ? passive.subtypeId === state.run.activeSubtypeId : !passive.subtypeId && state.run.unlockedBranchIds.includes(passive.branchId)).flatMap((passive) => passive.effects), ...Object.values(state.run.loadout).flatMap((skillId) => gameConfig.skills.find((skill) => skill.id === skillId)?.effects ?? [])];
          expiredEnemyStatusIds(previous.run, state.run).forEach(({ targetId, statusId }) => activeEffects.filter((effect) => effect.statusId === statusId && effect.tags?.some((tag) => ['after-expire', 'after-confusion-expire', 'on-confusion-expire'].includes(tag))).forEach((effect) => {
            if (effect.type === 'damage') schedulePeriodicDamage(runtime!, store, targetId, { ...effect, magnitude: effect.magnitude ?? damageBaselines.residualTick, durationMs: effect.durationMs ?? 2000, targetIds: [targetId] }, effectTimers);
            if (effect.type === 'status') store.getState().applyResolvedStatusEffects(targetId, runtimeConfig.enemies.find((enemy) => enemy.id === targetId)?.bodySize === 'large', [{ ...effect, targetIds: [targetId] }]);
            if (effect.tags?.includes('wander')) runtime!.setEnemyWandering(targetId, effect.durationMs ?? runtimeTagBehavior.wanderDurationMs);
          }));
        }
      });
      window.addEventListener('keydown', onSkillKey);
    });
    return () => {
      disposed = true;
      window.clearInterval(domainClock);
      window.removeEventListener('keydown', onSkillKey);
      unsubscribe?.();
      uninstallTestPort?.();
      effectTimers.forEach((timer) => window.clearTimeout(timer));
      runtime?.destroy();
    };
  }, [onTargetChange, store]);

  return <canvas aria-label="蛇之荒野三维场景" className="game-canvas" ref={canvasRef} />;
}

function schedulePeriodicDamage(runtime: BabylonGameRuntime, store: StoreApi<GameStoreState>, targetId: string, effect: ResolvedEffect, timers: Set<number>) {
  let elapsedMs = 0;
  const pulse = () => {
    if (store.getState().run.phase !== 'active' || !runtime.enemyIds.includes(targetId)) return;
    if (!store.getState().run.paused) {
      runtime.applyEnemyDamage(targetId, (effect.magnitude ?? 0) * (effect.stacks ?? 1));
      elapsedMs += 1000;
    }
    if (elapsedMs < (effect.durationMs ?? 0)) {
      const timer = window.setTimeout(() => { timers.delete(timer); pulse(); }, store.getState().run.paused ? 100 : 1000);
      timers.add(timer);
    }
  };
  const timer = window.setTimeout(() => { timers.delete(timer); pulse(); }, 1000);
  timers.add(timer);
}

function schedulePeriodicHealing(runtime: BabylonGameRuntime, store: StoreApi<GameStoreState>, effect: ResolvedEffect, timers: Set<number>) {
  let elapsedMs = 0;
  const durationMs = effect.durationMs ?? 0;
  const perSecond = effect.tags?.includes('total-over-duration') ? (effect.magnitude ?? 0) / Math.max(1, durationMs / 1000) : effect.magnitude ?? 0;
  const pulse = () => {
    if (store.getState().run.phase !== 'active') return;
    if (!store.getState().run.paused) {
      store.getState().applyPlayerResolvedEffects([{ ...effect, magnitude: perSecond, durationMs: undefined, tags: [], targetIds: ['player'] }]);
      runtime.syncPlayerHealth(store.getState().run.player.health, store.getState().run.player.maxHealth);
      elapsedMs += 1000;
    }
    if (elapsedMs < durationMs) {
      const timer = window.setTimeout(() => { timers.delete(timer); pulse(); }, store.getState().run.paused ? 100 : 1000);
      timers.add(timer);
    }
  };
  const timer = window.setTimeout(() => { timers.delete(timer); pulse(); }, 1000);
  timers.add(timer);
}

function scheduleDelayedStatus(store: StoreApi<GameStoreState>, targetId: string, isLarge: boolean, effect: ResolvedEffect, timers: Set<number>) {
  let remainingMs = effect.durationMs ?? runtimeTagBehavior.delayedTriggerMs;
  let lastActiveAt = performance.now();
  const pulse = () => {
    const timer = window.setTimeout(() => {
      timers.delete(timer);
      const run = store.getState().run;
      if (run.phase !== 'active') return;
      const now = performance.now();
      if (!run.paused) remainingMs -= now - lastActiveAt;
      lastActiveAt = now;
      if (remainingMs > 0) { pulse(); return; }
      store.getState().applyResolvedStatusEffects(targetId, isLarge, [{ ...effect, type: 'status', tags: (effect.tags ?? []).filter((tag) => tag !== 'delayed' && !tag.startsWith('delayed-')) }]);
    }, Math.min(remainingMs, runtimeConfig.domainTickIntervalMs));
    timers.add(timer);
  };
  pulse();
}

function scheduleMarkerExpiry(store: StoreApi<GameStoreState>, targetId: string, isLarge: boolean, markerId: string, durationMs: number, effect: ResolvedEffect, timers: Set<number>) {
  scheduleDelayedStatus(store, targetId, isLarge, { ...effect, durationMs, tags: ['delayed'] }, timers);
}

function applyPassiveStatusSpread(runtime: BabylonGameRuntime, store: StoreApi<GameStoreState>, sourceTargetId: string) {
  const run = store.getState().run;
  const passives = gameConfig.passives.filter((passive) => run.originId === 'venom' ? passive.subtypeId === run.activeSubtypeId : run.unlockedBranchIds.includes(passive.branchId) && !passive.subtypeId);
  for (const effect of passives.flatMap((passive) => passive.effects)) {
    if (!effect.statusId || !effect.tags?.some((tag) => tag === 'spread' || tag.startsWith('spread-target-count'))) continue;
    const source = store.getState().getTargetStatuses(sourceTargetId).find((status) => status.statusId === effect.statusId);
    if (!source) continue;
    const count = effect.tags.map((tag) => /^spread-target-count:(\d+)$/.exec(tag)?.[1]).find((value): value is string => value !== undefined);
    const neighbors = runtime.queryStatusSpreadTargets(sourceTargetId, { radius: runtimeTagBehavior.spreadRadius, maxTargets: count ? Number(count) : runtimeTagBehavior.spreadTargetCount });
    neighbors.forEach((targetId) => store.getState().applyResolvedStatusEffects(targetId, runtimeConfig.enemies.find((enemy) => enemy.id === targetId)?.bodySize === 'large', [{ type: 'status', target: 'target', targetIds: [targetId], statusId: source.statusId, stacks: source.stacks, durationMs: source.remainingMs }]));
  }
}

function createConfiguredHazards(runtime: BabylonGameRuntime, effects: ResolvedEffect[], passiveEffects: EffectDefinition[], payloads: Map<number, ResolvedEffect[]>) {
  const payload = [...effects, ...passiveEffects].flatMap((effect) => (effect.tags ?? []).flatMap((tag) => {
    const enter = /^on-enter:(.+)$/.exec(tag)?.[1];
    const contact = tag === 'on-contact' ? effect.tags?.find((entry) => entry.startsWith('apply:'))?.slice('apply:'.length) : undefined;
    const continuous = /^continuous:(.+)$/.exec(tag)?.[1]?.split(',');
    return [enter, contact, ...(continuous ?? [])].filter((statusId): statusId is string => Boolean(statusId)).map((statusId) => ({ type: 'status' as const, target: 'area' as const, targetIds: [], statusId, stacks: effect.stacks ?? 1, durationMs: effect.durationMs }));
  }));
  if (!payload.length || !effects.some((effect) => effect.tags?.some((tag) => ['place-ground-core', 'toxic-field', 'toxic-fog'].includes(tag)))) return;
  const markerStatusId = effects.find((effect) => effect.tags?.includes('place-ground-core'))?.statusId;
  const id = runtime.createAreaHazard({ center: runtime.playerPosition, radius: runtimeTagBehavior.areaHazardRadius, durationMs: runtimeTagBehavior.areaHazardDurationMs, intervalMs: runtimeTagBehavior.areaHazardIntervalMs, markerStatusId });
  if (id !== undefined) payloads.set(id, payload);
}

function applyPassiveEventEffects(runtime: BabylonGameRuntime, store: StoreApi<GameStoreState>, targetId: string, event: EffectEvent) {
  const run = store.getState().run;
  const passiveEffects = gameConfig.passives.filter((passive) => run.originId === 'venom' ? passive.subtypeId === run.activeSubtypeId : !passive.subtypeId && run.unlockedBranchIds.includes(passive.branchId)).flatMap((passive) => passive.effects);
  const effects = filterEffectsByChance(resolveEventEffects(passiveEffects, event), Math.random, runtimeTagBehavior.highChanceProbability);
  const bodySize = runtimeConfig.enemies.find((enemy) => enemy.id === targetId)?.bodySize;
  store.getState().applyResolvedStatusEffects(targetId, bodySize === 'large', effects.filter((effect) => (effect.type === 'status' || effect.type === 'trigger') && effect.statusId).map((effect) => ({ ...effect, type: 'status', targetIds: [targetId] })));
  effects.filter((effect) => effect.type === 'damage' && effect.magnitude).forEach((effect) => runtime.applyEnemyDamage(targetId, effect.magnitude!));
}

function handleRuntimeEvent(event: RuntimeEvent, runtime: BabylonGameRuntime, store: StoreApi<GameStoreState>, onTargetChange: (target?: RuntimeTarget) => void, hazardPayloads: Map<number, ResolvedEffect[]>) {
  if (event.type === 'basicAttack') {
    const modifiers = getActivePassiveModifiers(store.getState().run, gameConfig);
    const baseDamage = event.attack === 'primary'
      ? runtimeConfig.player.primaryAttackDamage + modifiers.biteBaseDamage
      : runtimeConfig.player.secondaryAttackDamage;
    event.targetIds.forEach((targetId) => {
      const target = runtimeConfig.enemies.find((enemy) => enemy.id === targetId);
      runtime.applyEnemyDamage(targetId, target ? resolveEnemyDamage({ amount: Math.round(baseDamage * (1 + modifiers.attackDamage)), damageType: 'physical', target, targetStatuses: store.getState().getTargetStatuses(targetId) }) : 0);
      store.getState().removeTargetStatuses(targetId, (status) => shouldBreakStatus(status, { action: 'attack' }));
      const run = store.getState().run;
      const passiveEffects = gameConfig.passives.filter((passive) => run.originId === 'venom' ? passive.subtypeId === run.activeSubtypeId : !passive.subtypeId && run.unlockedBranchIds.includes(passive.branchId)).flatMap((passive) => passive.effects);
      const eventEffects = filterEffectsByChance(resolveEventEffects(passiveEffects, 'attack'), Math.random, runtimeTagBehavior.highChanceProbability);
      const bodySize = runtimeConfig.enemies.find((enemy) => enemy.id === targetId)?.bodySize;
      store.getState().applyResolvedStatusEffects(targetId, bodySize === 'large', eventEffects.filter((effect) => effect.type === 'status' && effect.statusId).map((effect) => ({ ...effect, targetIds: [targetId] })));
      eventEffects.filter((effect) => effect.type === 'damage' && effect.magnitude).forEach((effect) => runtime.applyEnemyDamage(targetId, effect.magnitude!));
      applyPassiveEventEffects(runtime, store, targetId, 'hit');
      if (run.originId === 'venom') applyPassiveEventEffects(runtime, store, targetId, 'venom-hit');
      if (store.getState().getTargetStatuses(targetId).some((status) => status.statusId === 'bleed')) applyPassiveEventEffects(runtime, store, targetId, 'bleed-hit');
    });
    const run = store.getState().run;
      if (run.originId === 'venom' && run.activeSubtypeId) {
      const statusId = gameConfig.skills.find((skill) => skill.subtypeId === run.activeSubtypeId && skill.statusId)?.statusId;
      if (statusId) event.targetIds.forEach((targetId) => {
        const bodySize = runtimeConfig.enemies.find((enemy) => enemy.id === targetId)?.bodySize;
        store.getState().applyResolvedStatusEffects(targetId, bodySize === 'large', [{ type: 'status', target: 'target', statusId, stacks: 1, targetIds: [targetId] }]);
        runtime.presentSkillEffect({ type: 'statusVisual', statusId, targetIds: [targetId], durationMs: gameConfig.statuses[statusId]?.durationMs ?? 0 });
      });
      }
      if (run.originId === 'venom') event.targetIds.forEach((targetId) => applyPassiveEventEffects(runtime, store, targetId, 'venom-bite'));
    if (event.targetIds.length) store.getState().setInCombat(true);
  } else if (event.type === 'areaHazardTick') {
    const payload = hazardPayloads.get(event.hazardId) ?? [];
    event.targetIds.forEach((targetId) => store.getState().applyResolvedStatusEffects(targetId, runtimeConfig.enemies.find((enemy) => enemy.id === targetId)?.bodySize === 'large', payload.map((effect) => ({ ...effect, targetIds: [targetId] }))));
  } else if (event.type === 'enemyAttack') {
    if (event.targetId === 'decoy') return;
    if (event.targetId !== 'player') {
      const damage = (runtimeConfig.enemies.find((enemy) => enemy.id === event.enemyId)?.attackDamage ?? 0) * getEnemyStatusModifiers(store.getState().getTargetStatuses(event.enemyId)).outgoingDamageMultiplier;
      runtime.applyEnemyDamage(event.targetId, damage);
      return;
    }
    if (event.attackStyle === 'melee') {
      const counterSources = Object.values(store.getState().run.loadout).flatMap((skillId) => gameConfig.skills.find((skill) => skill.id === skillId)?.effects ?? []);
      const counterEffects = store.getState().resolveCounterEffects(counterSources, [event.enemyId]);
      counterEffects.filter((effect) => effect.type === 'damage' && effect.magnitude).forEach((effect) => runtime.applyEnemyDamage(event.enemyId, effect.magnitude!));
      store.getState().applyPlayerResolvedEffects(counterEffects.filter((effect) => effect.target === 'self'));
      store.getState().applyResolvedStatusEffects(event.enemyId, runtimeConfig.enemies.find((enemy) => enemy.id === event.enemyId)?.bodySize === 'large', counterEffects.filter((effect) => effect.target !== 'self' && effect.type === 'status').map((effect) => ({ ...effect, targetIds: [event.enemyId] })));
      if (counterEffects.length) applyPassiveEventEffects(runtime, store, event.enemyId, 'counter-success');
      applyPassiveEventEffects(runtime, store, event.enemyId, 'melee-hit');
    }
    store.getState().setInCombat(true);
    if (shouldEvadeAttack(store.getState().run, Math.random())) return;
    const eventRun = store.getState().run;
    const enemyActionPassives = gameConfig.passives.filter((passive) => eventRun.originId === 'venom' ? passive.subtypeId === eventRun.activeSubtypeId : !passive.subtypeId && eventRun.unlockedBranchIds.includes(passive.branchId)).flatMap((passive) => passive.effects);
    const enemyActionEffects = filterEffectsByChance(resolveEventEffects(enemyActionPassives, 'enemy-action'), Math.random, runtimeTagBehavior.highChanceProbability);
    const enemyBodySize = runtimeConfig.enemies.find((enemy) => enemy.id === event.enemyId)?.bodySize;
    store.getState().applyResolvedStatusEffects(event.enemyId, enemyBodySize === 'large', enemyActionEffects.filter((effect) => effect.type === 'status' && effect.statusId).map((effect) => ({ ...effect, targetIds: [event.enemyId] })));
    enemyActionEffects.filter((effect) => effect.type === 'damage' && effect.magnitude).forEach((effect) => runtime.applyEnemyDamage(event.enemyId, effect.magnitude!));
    const domainEvent = store.getState().resolveEffectEvent([], { kind: 'enemy-skill-cast', targetIds: [event.enemyId], targetStatuses: store.getState().getTargetStatuses(event.enemyId), sourceStatuses: store.getState().getTargetStatuses(event.enemyId), candidateTargets: runtime.enemyIds.map((id) => ({ id, alive: true })) });
    store.getState().applyResolvedStatusEffects(event.enemyId, enemyBodySize === 'large', domainEvent.effects.filter((effect) => effect.type === 'status').map((effect) => ({ ...effect, targetIds: [event.enemyId] })));
    domainEvent.effects.filter((effect) => effect.type === 'damage' && effect.magnitude).forEach((effect) => runtime.applyEnemyDamage(event.enemyId, effect.magnitude!));
    if (domainEvent.consumeStatusIds.length) store.getState().removeTargetStatuses(event.enemyId, (status) => domainEvent.consumeStatusIds.includes(status.statusId));
    const damage = (runtimeConfig.enemies.find((enemy) => enemy.id === event.enemyId)?.attackDamage ?? 0) * getEnemyStatusModifiers(store.getState().getTargetStatuses(event.enemyId)).outgoingDamageMultiplier;
    store.getState().applyPlayerDamage(damage);
    runtime.syncPlayerHealth(store.getState().run.player.health, store.getState().run.player.maxHealth);
    const reprisal = store.getState().getTargetStatuses(event.enemyId).find((status) => runtimeStatusBehavior[status.statusId as keyof typeof runtimeStatusBehavior]?.enemyActionDamagePerStack);
    if (reprisal) runtime.applyEnemyDamage(event.enemyId, reprisal.stacks * (runtimeStatusBehavior[reprisal.statusId as 'kidney-reprisal']?.enemyActionDamagePerStack ?? 0));
  } else if (event.type === 'enemyDefeated') {
    store.getState().gainReward(event.characterXp, event.skillXp);
  } else if (event.type === 'playerDied') {
    store.getState().markDead();
  } else if (event.type === 'targetChanged') {
    onTargetChange(event.target);
  } else if (event.type === 'eliteObjectiveCompleted') {
    store.getState().completeRoundObjective();
  }
}

function syncRuntimeRestrictions(runtime: BabylonGameRuntime, run: GameState) {
  const restrictionsFor = (statusIds: string[]) => statusIds.reduce((restrictions, statusId) => {
    const definition = gameConfig.statuses[statusId];
    return {
      movementDisabled: restrictions.movementDisabled || definition?.blocksMovement === true,
      actionDisabled: restrictions.actionDisabled || definition?.blocksActions === true,
      activeAbilitiesDisabled: restrictions.activeAbilitiesDisabled || definition?.blocksSkills === true,
      passiveEffectsDisabled: restrictions.passiveEffectsDisabled || runtimeStatusBehavior[statusId as keyof typeof runtimeStatusBehavior]?.passiveEffectsDisabled === true,
    };
  }, { movementDisabled: false, actionDisabled: false, activeAbilitiesDisabled: false, passiveEffectsDisabled: false });
  runtime.syncPlayerRestrictions(restrictionsFor(run.playerStatuses.map((status) => status.statusId)));
  runtime.syncPlayerMoveSpeedMultiplier(getMoveSpeedMultiplier(run, gameConfig));
  runtime.setPlayerHidden(run.playerStatuses.some((status) => ['stealth', 'semi-stealth'].includes(status.statusId) || status.tags?.some((tag) => ['block-enemy-vision', 'short-stealth'].includes(tag))));
  runtime.setPlayerStationary(run.playerStatuses.some((status) => status.tags?.includes('stationary') || status.tags?.includes('cannot-move')));
  for (const enemy of runtimeConfig.enemies) {
    const statuses = run.enemyStatuses[enemy.id]?.statuses ?? [];
    runtime.syncEnemyRestrictions(enemy.id, restrictionsFor(statuses.map((status) => status.statusId)));
    const statusFlags = getStatusRestrictionFlags(statuses, gameConfig);
    runtime.syncEnemyRestrictions(enemy.id, { movementDisabled: statusFlags.movementBlocked, actionDisabled: statusFlags.actionsBlocked, activeAbilitiesDisabled: statusFlags.activeSkillBlocked });
    const modifiers = getEnemyStatusModifiers(statuses);
    runtime.syncEnemyCombatModifiers(enemy.id, { moveSpeedMultiplier: modifiers.moveSpeedMultiplier, attackSpeedMultiplier: modifiers.attackSpeedMultiplier, hitChance: modifiers.hitChance, outgoingDamageMultiplier: modifiers.outgoingDamageMultiplier });
    runtime.syncEnemyRandomTargeting(enemy.id, statuses.some((status) => runtimeStatusBehavior[status.statusId as keyof typeof runtimeStatusBehavior]?.randomTargeting === true));
  }
}

function loadSnapshot(): SaveSnapshot | undefined {
  try {
    if (new URLSearchParams(window.location.search).has('e2e')) return undefined;
    const raw = localStorage.getItem(saveKey);
    return raw ? JSON.parse(raw) as SaveSnapshot : undefined;
  } catch {
    localStorage.removeItem(saveKey);
    return undefined;
  }
}

function persistSnapshot(state: GameStoreState) {
  if (state.run.phase !== 'creation') localStorage.setItem(saveKey, JSON.stringify(state.snapshot()));
}

function applyDevelopmentFixture(store: StoreApi<GameStoreState>) {
  if (!import.meta.env.DEV || store.getState().run.phase !== 'creation') return;
  const fixture = new URLSearchParams(window.location.search).get('e2e');
  if (fixture !== 'game') return;
  store.getState().createRun('size', 'size-thick-armor');
  store.getState().gainReward(250, 30);
}
