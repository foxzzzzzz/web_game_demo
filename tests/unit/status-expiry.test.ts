import { expect, it } from 'vitest';
import type { GameState } from '../../src/domain';
import { expiredEnemyStatusIds } from '../../src/app/status-expiry';

it('finds only statuses removed between Store snapshots', () => {
  const previous = { enemyStatuses: { a: { isLarge: false, statuses: [{ statusId: 'confusion', stacks: 1, remainingMs: 1 }] } } } as unknown as GameState;
  const next = { enemyStatuses: {} } as unknown as GameState;
  expect(expiredEnemyStatusIds(previous, next)).toEqual([{ targetId: 'a', statusId: 'confusion' }]);
});
