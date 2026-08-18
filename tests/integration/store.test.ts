import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../src/config';
import { createGameStore } from '../../src/store';

describe('game store integration', () => {
  it('persists a versioned snapshot after domain commands and restores it without duplicating rewards', () => {
    const store = createGameStore(gameConfig);
    store.getState().createRun('size', 'size-thick-armor');
    const snapshot = store.getState().snapshot();
    const restored = createGameStore(gameConfig, snapshot);

    expect(snapshot.version).toBe(gameConfig.saveVersion);
    expect(restored.getState().run.gold).toBe(1);
    restored.getState().createRun('size', 'size-thick-armor');
    expect(restored.getState().run.gold).toBe(1);
  });

  it('applies runtime damage and only resets a dead run', () => {
    const store = createGameStore(gameConfig);
    store.getState().createRun('size', 'size-thick-armor');
    store.getState().applyPlayerDamage(30);
    expect(store.getState().run.player.health).toBe(74);
    store.getState().resetRun();
    expect(store.getState().run.phase).toBe('active');
    store.getState().applyPlayerDamage(100);
    expect(store.getState().run.phase).toBe('dead');
    store.getState().resetRun();
    expect(store.getState().run.phase).toBe('creation');
  });

  it('switches unlocked venom subtypes only while out of combat', () => {
    const store = createGameStore(gameConfig);
    store.getState().createRun('venom', 'venom-neuro');
    store.getState().selectSubtype('venom-neuro-alpha');
    expect(store.getState().run.activeSubtypeId).toBe('venom-neuro-alpha');
    store.getState().setInCombat(true);
    store.getState().selectSubtype('venom-neuro-alpha');
    expect(store.getState().run.activeSubtypeId).toBe('venom-neuro-alpha');
  });

  it('refreshes the configured combat timer and leaves combat only after it expires', () => {
    const store = createGameStore(gameConfig);
    store.getState().createRun('size', 'size-thick-armor');
    store.getState().setInCombat(true);

    expect(store.getState().run.combatRemainingMs).toBe(gameConfig.combatExitDelayMs);
    store.getState().tick(gameConfig.combatExitDelayMs - 1);
    expect(store.getState().run.inCombat).toBe(true);

    store.getState().setInCombat(true);
    store.getState().tick(gameConfig.combatExitDelayMs);
    expect(store.getState().run.inCombat).toBe(false);
    expect(store.getState().run.combatRemainingMs).toBe(0);
  });

  it('exposes target status snapshots and advances their duration through store tick', () => {
    const store = createGameStore(gameConfig);
    store.getState().createRun('venom', 'venom-neuro');
    store.getState().applyResolvedStatusEffects('enemy-a', false, [{ type: 'status', target: 'target', targetIds: ['enemy-a'], statusId: 'paralysis', stacks: 6 }]);

    expect(store.getState().getTargetStatuses('enemy-a')[0]).toMatchObject({ statusId: 'paralysis', stacks: 6 });
    store.getState().tick(6000);
    expect(store.getState().getTargetStatuses('enemy-a')).toEqual([]);
  });

  it('applies resolved self healing and shields without exceeding maximum health', () => {
    const store = createGameStore(gameConfig);
    store.getState().createRun('size', 'size-thick-armor');
    store.getState().applyPlayerDamage(70);
    store.getState().applyPlayerResolvedEffects([
      { type: 'heal', target: 'self', targetIds: ['player'], magnitude: 80 },
      { type: 'shield', target: 'self', targetIds: ['player'], magnitude: 40 },
      { type: 'shield', target: 'self', targetIds: ['player'], magnitude: 25 },
    ]);

    expect(store.getState().run.player).toEqual({ maxHealth: 100, health: 100, shield: 65 });
  });

  it('exposes player status snapshots for UI state rendering', () => {
    const store = createGameStore(gameConfig);
    store.getState().createRun('size', 'size-thick-armor');
    store.getState().applyPlayerResolvedEffects([{ type: 'status', target: 'self', targetIds: ['player'], statusId: 'rage', stacks: 1 }]);
    expect(store.getState().getPlayerStatuses()).toEqual([{ statusId: 'rage', stacks: 1, remainingMs: 6000 }]);
  });

  it('extends only an already-existing target status through the safe store command', () => {
    const store = createGameStore(gameConfig);
    store.getState().createRun('venom', 'venom-neuro');
    store.getState().applyResolvedStatusEffects('enemy-a', false, [{ type: 'status', target: 'target', targetIds: ['enemy-a'], statusId: 'paralysis', stacks: 1 }]);
    const before = store.getState().getTargetStatuses('enemy-a')[0].remainingMs;

    store.getState().extendExistingTargetStatus('enemy-a', 'paralysis', 500);
    store.getState().extendExistingTargetStatus('enemy-a', 'missing-status', 500);

    expect(store.getState().getTargetStatuses('enemy-a')).toEqual([{ statusId: 'paralysis', stacks: 1, remainingMs: before + 500 }]);
  });

  it('atomically replaces a configured target status without skill identity', () => {
    const store = createGameStore(gameConfig);
    store.getState().createRun('venom', 'venom-neuro');
    store.getState().applyResolvedStatusEffects('enemy-a', false, [{ type: 'status', target: 'target', targetIds: ['enemy-a'], statusId: 'weakness', stacks: 1 }]);

    store.getState().replaceTargetStatus('enemy-a', 'weakness', { type: 'status', target: 'target', targetIds: ['enemy-a'], statusId: 'muscle-stiffness', stacks: 3, durationMs: 1200 });

    expect(store.getState().getTargetStatuses('enemy-a')).toEqual([{ statusId: 'muscle-stiffness', stacks: 3, remainingMs: 1200 }]);
  });

  it('removes only target statuses selected by a generic predicate', () => {
    const store = createGameStore(gameConfig);
    store.getState().createRun('venom', 'venom-neuro');
    store.getState().applyResolvedStatusEffects('enemy-a', false, [
      { type: 'status', target: 'target', targetIds: ['enemy-a'], statusId: 'root', stacks: 1, tags: ['break-at-damage:50'] },
      { type: 'status', target: 'target', targetIds: ['enemy-a'], statusId: 'bleed', stacks: 1 },
    ]);
    store.getState().removeTargetStatuses('enemy-a', (status) => status.tags?.includes('break-at-damage:50') === true);
    expect(store.getState().getTargetStatuses('enemy-a').map((status) => status.statusId)).toEqual(['bleed']);
  });
});
