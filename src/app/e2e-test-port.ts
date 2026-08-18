/**
 * Development-only E2E boundary. Implementations may only accelerate existing
 * game commands and expose read-only evidence; they must never write terminal
 * combat, death, enemy health, or objective state directly.
 */
export interface GameE2eTestPort {
  grantReward(characterXp: number, skillXp: number): void;
  advanceTime(deltaMs: number): void;
  snapshot(): GameE2eSnapshot;
}

export interface GameE2eSnapshot {
  phase: 'creation' | 'active' | 'dead';
  originId?: string;
  activeSubtypeId?: string;
  characterLevel: number;
  loadout: Record<1 | 2 | 3 | 4, string | null>;
  skillRuntime: Record<string, { cooldownRemainingMs: number; charges?: number }>;
  objectiveCompleted: boolean;
  enemyStatuses: Record<string, Array<{ statusId: string; stacks: number; remainingMs: number }>>;
  runtime: {
    ready: boolean;
    playerPosition: { x: number; z: number };
    currentTargetId?: string;
    currentTargetHealth?: number;
    enemyPositions: Record<string, { x: number; z: number }>;
    targetStatuses: Array<{ statusId: string; stacks: number; remainingMs: number }>;
    aliveEnemyIds: string[];
  };
}

export function installGameE2eTestPort(store: StoreApi<GameStoreState>, runtime: BabylonGameRuntime): () => void {
  if (!import.meta.env.DEV || new URLSearchParams(window.location.search).get('testPort') !== '1') return () => undefined;

  const port: GameE2eTestPort = {
    grantReward: (characterXp, skillXp) => store.getState().gainReward(characterXp, skillXp),
    advanceTime: (deltaMs) => store.getState().tick(deltaMs),
    snapshot: () => {
      const run = store.getState().run;
      const currentTargetId = runtime.currentTarget?.id;
      return {
        phase: run.phase,
        originId: run.originId,
        activeSubtypeId: run.activeSubtypeId,
        characterLevel: run.characterLevel,
        loadout: { ...run.loadout },
        skillRuntime: Object.fromEntries(Object.entries(run.skillRuntime).map(([skillId, state]) => [skillId, {
          cooldownRemainingMs: state.cooldownRemainingMs,
          charges: state.charges,
        }])),
        objectiveCompleted: run.objectiveCompleted,
        enemyStatuses: Object.fromEntries(Object.entries(run.enemyStatuses).map(([targetId, target]) => [targetId, target.statuses.map((status) => ({
          statusId: status.statusId,
          stacks: status.stacks,
          remainingMs: status.remainingMs,
        }))])),
        runtime: {
          ready: true,
          playerPosition: runtime.playerPosition,
          currentTargetId,
          currentTargetHealth: runtime.currentTarget?.health,
          enemyPositions: Object.fromEntries(runtime.enemyIds.flatMap((enemyId) => {
            const position = runtime.enemyPosition(enemyId);
            return position ? [[enemyId, position]] : [];
          })),
          targetStatuses: currentTargetId ? (run.enemyStatuses[currentTargetId]?.statuses ?? []).map((status) => ({
            statusId: status.statusId,
            stacks: status.stacks,
            remainingMs: status.remainingMs,
          })) : [],
          aliveEnemyIds: runtime.enemyIds,
        },
      };
    },
  };
  window.__SNAKE_E2E__ = port;
  return () => {
    if (window.__SNAKE_E2E__ === port) delete window.__SNAKE_E2E__;
  };
}

declare global {
  interface Window {
    __SNAKE_E2E__?: GameE2eTestPort;
  }
}
import type { StoreApi } from 'zustand/vanilla';
import type { BabylonGameRuntime } from '../game';
import type { GameStoreState } from '../store';
