import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { describe, expect, it } from 'vitest';

import { BabylonGameRuntime, type RuntimeConfig, type RuntimeEvent } from '../../src/game';

const config: RuntimeConfig = {
  world: {
    groundSize: 80,
    boundaryRadius: 38,
    obstacleHeight: 3,
    obstacles: [{ id: 'rock', x: 2, z: 0, width: 3, depth: 3 }],
  },
  player: { moveSpeed: 10, collisionRadius: 0.6, maxHealth: 100, attackRange: 4, primaryAttackDamage: 28, secondaryAttackDamage: 18 },
  domainTickIntervalMs: 100,
  camera: { alpha: -1.2, beta: 1.1, radius: 16, targetHeight: 1 },
  input: { pointerTurnSensitivity: 0.01 },
  enemies: [
    { id: 'small-melee', kind: 'smallMelee', bodySize: 'small', spawn: { x: 12, z: 0 }, maxHealth: 20, moveSpeed: 3, aggroRange: 20, attackRange: 2, attackIntervalMs: 1000, attackDamage: 8, physicalDamageReduction: 0, venomDamageReduction: 0, characterXp: 120, skillXp: 30, respawnDelayMs: 500 },
    { id: 'medium-ranged', kind: 'mediumRanged', bodySize: 'medium', spawn: { x: -12, z: 0 }, maxHealth: 30, moveSpeed: 2, aggroRange: 20, attackRange: 8, attackIntervalMs: 1500, attackDamage: 10, physicalDamageReduction: 0, venomDamageReduction: 0, characterXp: 180, skillXp: 40, respawnDelayMs: 750 },
    { id: 'large-elite', kind: 'largeElite', bodySize: 'large', spawn: { x: 0, z: 12 }, maxHealth: 100, moveSpeed: 1.5, aggroRange: 24, attackRange: 3, attackIntervalMs: 2000, attackDamage: 16, physicalDamageReduction: 0, venomDamageReduction: 0, characterXp: 3400, skillXp: 120, respawnDelayMs: 1000, objectiveId: 'defeat-elite' },
  ],
};

function createRuntime(events: RuntimeEvent[] = [], random?: () => number): BabylonGameRuntime {
  return new BabylonGameRuntime({
    config,
    engineFactory: () => new NullEngine(),
    autoStartRenderLoop: false,
    random,
    onEvent: (event) => events.push(event),
  });
}

describe('BabylonGameRuntime', () => {
  it('ticks finite area hazards, freezes them while paused, and clears on destroy', () => {
    const events: RuntimeEvent[] = [];
    const runtime = createRuntime(events);
    runtime.mount();
    runtime.createAreaHazard({ center: { x: 12, z: 0 }, radius: 2, durationMs: 1000, intervalMs: 500 });
    runtime.tick(500);
    expect(events.some((event) => event.type === 'areaHazardTick' && event.targetIds.includes('small-melee'))).toBe(true);
    runtime.setPaused(true);
    runtime.tick(1000);
    expect(events.filter((event) => event.type === 'areaHazardTick')).toHaveLength(1);
    runtime.destroy();
  });

  it('removes only hazards associated with the requested marker', () => {
    const runtime = createRuntime();
    runtime.mount();
    const core = runtime.createAreaHazard({ center: { x: 0, z: 0 }, radius: 2, durationMs: 1000, intervalMs: 500, markerStatusId: 'toxin-core' });
    runtime.createAreaHazard({ center: { x: 0, z: 0 }, radius: 2, durationMs: 1000, intervalMs: 500, markerStatusId: 'other-core' });
    expect(runtime.removeAreaHazardsByMarker('toxin-core')).toEqual([core]);
    expect(runtime.removeAreaHazardsByMarker('other-core')).toHaveLength(1);
    runtime.destroy();
  });

  it('queries only finite-radius living injured enemies ordered by distance', () => {
    const runtime = createRuntime();
    runtime.mount();
    runtime.applyEnemyDamage('small-melee', 1);
    runtime.applyEnemyDamage('large-elite', 1);
    runtime.applyEnemyDamage('medium-ranged', 30);
    expect(runtime.queryInjuredEnemies({ x: 0, z: 1 }, 13)).toEqual(['large-elite', 'small-melee']);
    expect(runtime.queryInjuredEnemies({ x: 0, z: 1 }, 11)).toEqual(['large-elite']);
    expect(runtime.queryInjuredEnemies({ x: 0, z: 1 }, Number.POSITIVE_INFINITY)).toEqual([]);
    runtime.destroy();
  });
  it('TC-RUNTIME-001 mounts a low-poly world with snake and all three enemy archetypes', () => {
    const runtime = createRuntime();

    runtime.mount();

    expect(runtime.isMounted).toBe(true);
    expect(runtime.enemyIds).toEqual(['small-melee', 'medium-ranged', 'large-elite']);
    expect(runtime.playerPosition).toEqual({ x: 0, z: 0 });

    runtime.destroy();
    expect(runtime.isMounted).toBe(false);
  });

  it('TC-RUNTIME-002 moves by WASD without crossing the configured obstacle or world boundary', () => {
    const events: RuntimeEvent[] = [];
    const runtime = createRuntime(events);
    runtime.mount();

    runtime.setInputState({ d: true });
    runtime.tick(500);
    runtime.setInputState({ d: false });

    expect(runtime.playerPosition.x).toBeLessThan(2);
    expect(events.some((event) => event.type === 'collision')).toBe(true);
    runtime.destroy();
  });

  it('TC-RUNTIME-003 adapts attack, pause, AI attack, and player-death events', () => {
    const events: RuntimeEvent[] = [];
    const runtime = createRuntime(events);
    runtime.mount();

    runtime.basicAttack('primary');
    runtime.setPaused(true);
    runtime.tick(3000);
    runtime.setPaused(false);
    runtime.setPlayerPosition({ x: 10, z: 0 });
    runtime.tick(1100);
    runtime.applyPlayerDamage(100);

    expect(events.some((event) => event.type === 'basicAttack')).toBe(true);
    expect(events.filter((event) => event.type === 'pauseChanged')).toHaveLength(2);
    expect(events.some((event) => event.type === 'enemyAttack')).toBe(true);
    expect(events.some((event) => event.type === 'playerDied')).toBe(true);
    expect(runtime.isDead).toBe(true);
    runtime.destroy();
  });

  it('TC-RUNTIME-004 removes defeated enemies and emits their configured rewards', () => {
    const events: RuntimeEvent[] = [];
    const runtime = createRuntime(events);
    runtime.mount();
    runtime.applyEnemyDamage('small-melee', 20);
    expect(runtime.enemyIds).not.toContain('small-melee');
    expect(events).toContainEqual({ type: 'enemyDefeated', enemyId: 'small-melee', characterXp: 120, skillXp: 30 });
    runtime.destroy();
  });

  it('TC-RUNTIME-005 respawns defeated enemies only after their configured delay', () => {
    const events: RuntimeEvent[] = [];
    const runtime = createRuntime(events);
    runtime.mount();
    runtime.applyEnemyDamage('small-melee', 20);

    runtime.tick(499);
    expect(runtime.enemyIds).not.toContain('small-melee');
    runtime.tick(1000);

    expect(runtime.enemyIds).toContain('small-melee');
    expect(events).toContainEqual({ type: 'enemyRespawned', enemyId: 'small-melee' });
    runtime.destroy();
  });

  it('TC-RUNTIME-006 exposes target health and body size, and only emits in-range basic-attack targets', () => {
    const events: RuntimeEvent[] = [];
    const runtime = createRuntime(events);
    runtime.mount();
    runtime.setCurrentTarget('small-melee');
    runtime.setPlayerPosition({ x: 10, z: 0 });
    runtime.basicAttack('primary');

    expect(runtime.currentTarget).toEqual({ id: 'small-melee', health: 20, maxHealth: 20, bodySize: 'small' });
    expect(events).toContainEqual({ type: 'targetChanged', target: { id: 'small-melee', health: 20, maxHealth: 20, bodySize: 'small' } });
    expect(events).toContainEqual({ type: 'basicAttack', attack: 'primary', targetIds: ['small-melee'] });
    runtime.applyEnemyDamage('small-melee', 5);
    expect(events).toContainEqual({ type: 'targetChanged', target: { id: 'small-melee', health: 15, maxHealth: 20, bodySize: 'small' } });
    runtime.destroy();
  });

  it('TC-RUNTIME-007 adapts effect visuals and reports the configured elite objective', () => {
    const events: RuntimeEvent[] = [];
    const runtime = createRuntime(events);
    runtime.mount();
    runtime.presentSkillEffect({ type: 'displacement', from: { x: 0, z: 0 }, to: { x: 4, z: 0 } });
    runtime.presentSkillEffect({ type: 'area', center: { x: 4, z: 0 }, radius: 3, targetIds: ['small-melee'] });
    runtime.presentSkillEffect({ type: 'statusVisual', statusId: 'paralysis', targetIds: ['small-melee'], durationMs: 600 });
    runtime.applyEnemyDamage('large-elite', 100);

    expect(events.filter((event) => event.type === 'skillEffectVisual')).toHaveLength(3);
    expect(events).toContainEqual({ type: 'eliteObjectiveCompleted', enemyId: 'large-elite', objectiveId: 'defeat-elite' });
    runtime.destroy();
  });

  it('TC-RUNTIME-009 moves forward by the requested distance and reuses obstacle collision rules', () => {
    const events: RuntimeEvent[] = [];
    const runtime = createRuntime(events);
    runtime.mount();

    runtime.setPlayerPosition({ x: -5, z: 0 });
    expect(runtime.movePlayerForward(5)).toEqual({ x: -5, z: 5 });
    runtime.setPlayerPosition({ x: 0, z: 0 });
    runtime.setInputState({ d: true });
    runtime.tick(1);
    runtime.setInputState({ d: false });
    runtime.setPlayerPosition({ x: 0, z: 0 });

    const stoppedPosition = runtime.movePlayerForward(5);
    expect(stoppedPosition.x).toBeLessThan(2);
    expect(events.some((event) => event.type === 'collision')).toBe(true);
    runtime.destroy();
  });

  it('TC-RUNTIME-010 highlights status targets for their configured duration and pauses that timer', () => {
    const events: RuntimeEvent[] = [];
    const runtime = createRuntime(events);
    runtime.mount();
    runtime.presentSkillEffect({ type: 'statusVisual', statusId: 'paralysis', targetIds: ['small-melee'], durationMs: 600 });

    expect(runtime.activeStatusVisuals).toEqual([{ statusId: 'paralysis', targetId: 'small-melee' }]);
    runtime.setPaused(true);
    runtime.tick(600);
    runtime.setPaused(false);
    expect(runtime.activeStatusVisuals).toEqual([{ statusId: 'paralysis', targetId: 'small-melee' }]);
    runtime.tick(600);

    expect(runtime.activeStatusVisuals).toEqual([]);
    expect(events).toContainEqual({ type: 'statusVisualExpired', statusId: 'paralysis', targetId: 'small-melee' });
    runtime.destroy();
  });

  it('TC-RUNTIME-011 synchronizes authoritative health so healing cannot trigger death from stale runtime health', () => {
    const runtime = createRuntime();
    runtime.mount();
    runtime.setPlayerPosition({ x: -5, z: 0 });
    runtime.syncPlayerHealth(20, 100);
    runtime.syncPlayerHealth(80, 100);
    runtime.applyPlayerDamage(50);

    expect(runtime.isDead).toBe(false);
    runtime.applyPlayerDamage(30);
    expect(runtime.isDead).toBe(true);
    runtime.destroy();
  });

  it('TC-RUNTIME-012 applies generic enemy movement and action restrictions without recognizing status IDs', () => {
    const events: RuntimeEvent[] = [];
    const runtime = createRuntime(events);
    runtime.mount();
    runtime.syncEnemyRestrictions('small-melee', { movementDisabled: true, actionDisabled: false });
    runtime.tick(1000);

    expect(runtime.enemyPosition('small-melee')).toEqual({ x: 12, z: 0 });
    runtime.setPlayerPosition({ x: 10, z: 0 });
    runtime.tick(1000);
    expect(events.filter((event) => event.type === 'enemyAttack')).toHaveLength(1);
    runtime.syncEnemyRestrictions('small-melee', { movementDisabled: true, actionDisabled: true });
    runtime.tick(1000);

    expect(events.filter((event) => event.type === 'enemyAttack')).toHaveLength(1);
    runtime.destroy();
  });

  it('gates enemy actions until expiry, freezes gate time while paused, and clears it on destroy', () => {
    const events: RuntimeEvent[] = [];
    const runtime = createRuntime(events);
    runtime.mount();
    runtime.setPlayerPosition({ x: 10, z: 0 });
    runtime.gateEnemyActions('small-melee', 1001);
    runtime.tick(1000);
    expect(events.filter((event) => event.type === 'enemyAttack')).toHaveLength(0);
    runtime.setPaused(true);
    runtime.tick(1000);
    runtime.setPaused(false);
    runtime.tick(1);
    expect(events.filter((event) => event.type === 'enemyAttack')).toHaveLength(1);
    runtime.destroy();
    expect(runtime.isMounted).toBe(false);
  });

  it('wanders without attacking, freezes while paused, then resumes AI after expiry', () => {
    const events: RuntimeEvent[] = [];
    const runtime = createRuntime(events, () => 0.25);
    runtime.mount();
    runtime.setPlayerPosition({ x: 10, z: 0 });
    const before = runtime.enemyPosition('small-melee');
    runtime.setEnemyWandering('small-melee', 1001);
    runtime.tick(1000);
    expect(runtime.enemyPosition('small-melee')).not.toEqual(before);
    expect(events.filter((event) => event.type === 'enemyAttack')).toHaveLength(0);
    const paused = runtime.enemyPosition('small-melee');
    runtime.setPaused(true);
    runtime.tick(1000);
    expect(runtime.enemyPosition('small-melee')).toEqual(paused);
    runtime.setPaused(false);
    runtime.tick(1000);
    expect(runtime.enemyPosition('small-melee')).not.toEqual(paused);
    runtime.destroy();
  });

  it('TC-RUNTIME-013 clears enemy restrictions on death/respawn and blocks player movement/actions while synchronized', () => {
    const events: RuntimeEvent[] = [];
    const runtime = createRuntime(events);
    runtime.mount();
    runtime.syncEnemyRestrictions('small-melee', { movementDisabled: true, actionDisabled: true });
    runtime.applyEnemyDamage('small-melee', 20);
    runtime.tick(500);

    expect(runtime.enemyPosition('small-melee')?.x).toBeLessThan(12);
    runtime.syncPlayerRestrictions({ movementDisabled: true, actionDisabled: true });
    runtime.setInputState({ d: true });
    runtime.tick(100);
    runtime.setInputState({ d: false });
    runtime.movePlayerForward(5);
    runtime.basicAttack('primary');

    expect(runtime.playerPosition).toEqual({ x: 0, z: 0 });
    expect(events.some((event) => event.type === 'basicAttack')).toBe(false);
    runtime.destroy();
  });

  it('TC-RUNTIME-014 queries living enemies by explicit circle/cone and limits basic attacks to legal targets', () => {
    const events: RuntimeEvent[] = [];
    const runtime = createRuntime(events);
    runtime.mount();
    runtime.setPlayerPosition({ x: 10, z: 0 });
    runtime.setCurrentTarget('medium-ranged');

    expect(runtime.queryAliveEnemies({ shape: 'circle', center: { x: 0, z: 0 }, radius: Number.POSITIVE_INFINITY })).toEqual([]);
    expect(runtime.queryAliveEnemies({ shape: 'circle', center: { x: 10, z: 0 }, radius: 4 })).toEqual(['small-melee']);
    expect(runtime.queryAliveEnemies({ shape: 'cone', origin: { x: 0, z: 0 }, directionRadians: 0, radius: 20, halfAngleRadians: Math.PI / 4 })).toEqual(['large-elite']);
    runtime.basicAttack('primary');
    runtime.basicAttack('secondary');

    expect(events).toContainEqual({ type: 'basicAttack', attack: 'primary', targetIds: ['small-melee'] });
    expect(events).toContainEqual({ type: 'basicAttack', attack: 'secondary', targetIds: ['small-melee'] });
    runtime.destroy();
  });

  it('TC-RUNTIME-015 exposes ranged enemy attacks distinctly from melee attacks', () => {
    const events: RuntimeEvent[] = [];
    const runtime = createRuntime(events);
    runtime.mount();
    runtime.setPlayerPosition({ x: -5, z: 0 });
    runtime.tick(1500);

    expect(events).toContainEqual({ type: 'enemyAttack', enemyId: 'medium-ranged', targetId: 'player', attackStyle: 'ranged' });
    runtime.destroy();
  });

  it('TC-RUNTIME-016 applies an externally resolved player movement multiplier', () => {
    const runtime = createRuntime();
    runtime.mount();
    runtime.setPlayerPosition({ x: -5, z: 0 });
    runtime.syncPlayerMoveSpeedMultiplier(0.8);
    runtime.setInputState({ w: true });
    runtime.tick(100);
    runtime.setInputState({ w: false });
    expect(runtime.playerPosition).toEqual({ x: -5, z: 0.8 });
    runtime.destroy();
  });

  it('TC-RUNTIME-017 applies generic enemy knockback away from the player', () => {
    const runtime = createRuntime();
    runtime.mount();
    runtime.setPlayerPosition({ x: 8, z: 0 });
    expect(runtime.knockbackEnemy('small-melee', 3)).toEqual({ x: 15, z: 0 });
    runtime.destroy();
  });

  it('TC-RUNTIME-016 applies parsed dash/teleport and enemy knockback/pull through world-safe movement', () => {
    const runtime = createRuntime();
    runtime.mount();
    runtime.setPlayerPosition({ x: -5, z: 0 });

    expect(runtime.performPlayerMovement({ type: 'dash', distance: 5 })).toEqual({ x: -5, z: 5 });
    expect(runtime.performPlayerMovement({ type: 'teleport', destination: { x: 10, z: 0 } })).toEqual({ x: 10, z: 0 });
    expect(runtime.displaceEnemyRelativeToPlayer('small-melee', { type: 'knockback', distance: 3, collisionRadius: 0.6 })).toEqual({ x: 15, z: 0 });
    expect(runtime.displaceEnemyRelativeToPlayer('small-melee', { type: 'pull', distance: 2, collisionRadius: 0.6 })).toEqual({ x: 13, z: 0 });
    runtime.destroy();
  });

  it('TC-RUNTIME-017 suppresses player aggro while hidden and lets a timed decoy attract AI instead', () => {
    const events: RuntimeEvent[] = [];
    const runtime = createRuntime(events);
    runtime.mount();
    runtime.setPlayerHidden(true);
    runtime.tick(1000);

    expect(runtime.enemyPosition('small-melee')).toEqual({ x: 12, z: 0 });
    runtime.setDecoy({ position: { x: 10, z: 0 }, durationMs: 500 });
    runtime.tick(1);
    expect(events).toContainEqual({ type: 'enemyAttack', enemyId: 'small-melee', targetId: 'decoy', attackStyle: 'melee' });
    runtime.tick(499);

    expect(events).toContainEqual({ type: 'decoyExpired' });
    runtime.destroy();
  });

  it('TC-RUNTIME-018 supports stationary stance and target-back geometry without status identifiers', () => {
    const runtime = createRuntime();
    runtime.mount();
    runtime.syncEnemyRestrictions('small-melee', { movementDisabled: true, actionDisabled: false });
    runtime.setPlayerStationary(true);
    runtime.setInputState({ d: true });
    runtime.tick(100);
    runtime.setInputState({ d: false });

    expect(runtime.playerPosition).toEqual({ x: 0, z: 0 });
    runtime.setPlayerStationary(false);
    runtime.setPlayerPosition({ x: 12, z: -1 });
    expect(runtime.isPlayerBehindEnemy('small-melee', Math.PI / 3)).toBe(true);
    runtime.destroy();
  });

  it('TC-RUNTIME-019 queries finite status-spread targets and emits configured delayed effects', () => {
    const events: RuntimeEvent[] = [];
    const runtime = createRuntime(events);
    runtime.mount();

    expect(runtime.queryStatusSpreadTargets('small-melee', { radius: 20, maxTargets: 1 })).toEqual(['large-elite']);
    runtime.scheduleDelayedEffect({ delayMs: 500, effect: { type: 'area', center: { x: 0, z: 0 }, radius: 4, targetIds: ['large-elite'] } });
    runtime.tick(499);
    expect(events.some((event) => event.type === 'delayedEffectTriggered')).toBe(false);
    runtime.tick(1);

    expect(events).toContainEqual({ type: 'delayedEffectTriggered', effect: { type: 'area', center: { x: 0, z: 0 }, radius: 4, targetIds: ['large-elite'] } });
    runtime.destroy();
  });

  it('TC-RUNTIME-020 emits DoT visuals and uses injected random targeting for confused enemies', () => {
    const events: RuntimeEvent[] = [];
    const runtime = createRuntime(events, () => 0.3);
    runtime.mount();
    runtime.presentSkillEffect({ type: 'damageOverTimeVisual', targetIds: ['small-melee'], durationMs: 250, intervalMs: 100 });
    runtime.tick(100);
    runtime.setPlayerPosition({ x: 10, z: 0 });
    runtime.setDecoy({ position: { x: 10, z: 0 }, durationMs: 500 });
    runtime.syncEnemyRandomTargeting('small-melee', true);
    runtime.tick(1);

    expect(events).toContainEqual({ type: 'damageOverTimeVisualTick', targetIds: ['small-melee'] });
    const attack = events.find((event): event is Extract<RuntimeEvent, { type: 'enemyAttack' }> => event.type === 'enemyAttack');
    expect(attack).toMatchObject({ enemyId: 'small-melee', targetId: 'decoy', attackStyle: 'melee' });
    expect(attack?.targetId).not.toBe('small-melee');
    runtime.destroy();
  });

  it('TC-RUNTIME-021 keeps base attacks available when upper layers mark only active abilities/passives disabled', () => {
    const events: RuntimeEvent[] = [];
    const runtime = createRuntime(events);
    runtime.mount();
    runtime.setPlayerPosition({ x: 10, z: 0 });
    runtime.syncPlayerRestrictions({ movementDisabled: false, actionDisabled: false, activeAbilitiesDisabled: true, passiveEffectsDisabled: true });
    runtime.basicAttack('primary');

    expect(runtime.isPlayerActiveAbilitiesDisabled()).toBe(true);
    expect(events).toContainEqual({ type: 'basicAttack', attack: 'primary', targetIds: ['small-melee'] });
    runtime.destroy();
  });
});
