import type { GameState } from '../domain';

/** Returns statuses removed by a Store tick; paused ticks never produce removals. */
export function expiredEnemyStatusIds(previous: GameState, next: GameState): Array<{ targetId: string; statusId: string }> {
  const expired: Array<{ targetId: string; statusId: string }> = [];
  for (const [targetId, snapshot] of Object.entries(previous.enemyStatuses)) {
    const current = next.enemyStatuses[targetId]?.statuses ?? [];
    for (const status of snapshot.statuses) if (!current.some((entry) => entry.statusId === status.statusId)) expired.push({ targetId, statusId: status.statusId });
  }
  return expired;
}
