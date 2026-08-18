/** Runtime-owned presentation and movement configuration. All gameplay tuning comes from config. */
export interface RuntimeConfig {
  world: {
    groundSize: number;
    boundaryRadius: number;
    obstacleHeight: number;
    obstacles: ReadonlyArray<{ id: string; x: number; z: number; width: number; depth: number }>;
  };
  player: { moveSpeed: number; collisionRadius: number; maxHealth: number; attackRange: number; primaryAttackDamage: number; secondaryAttackDamage: number };
  /** 领域冷却、充能与脱战计时的更新间隔，单位：毫秒。 */
  domainTickIntervalMs: number;
  camera: { alpha: number; beta: number; radius: number; targetHeight: number };
  input: { pointerTurnSensitivity: number };
  enemies: ReadonlyArray<EnemyRuntimeConfig>;
}

export type EnemyKind = 'smallMelee' | 'mediumRanged' | 'largeElite';
export type EnemyBodySize = 'small' | 'medium' | 'large';

export interface EnemyRuntimeConfig {
  id: string;
  kind: EnemyKind;
  bodySize: EnemyBodySize;
  spawn: { x: number; z: number };
  maxHealth: number;
  moveSpeed: number;
  aggroRange: number;
  attackRange: number;
  attackIntervalMs: number;
  attackDamage: number;
  /** 物理伤害减免比例，范围 [0, 0.9]；由领域伤害结算读取。 */
  physicalDamageReduction: number;
  /** 毒素伤害减免比例，范围 [0, 0.9]；由领域伤害结算读取。 */
  venomDamageReduction: number;
  characterXp: number;
  skillXp: number;
  /** Defeated unit's world-respawn delay, in milliseconds. */
  respawnDelayMs: number;
  /** Optional objective completed whenever this elite is defeated. */
  objectiveId?: string;
}

export type InputState = Partial<Record<'w' | 'a' | 's' | 'd', boolean>>;

export type RuntimeEvent =
  | { type: 'playerMoved'; position: RuntimePosition }
  | { type: 'collision'; attemptedPosition: RuntimePosition }
  | { type: 'basicAttack'; attack: 'primary' | 'secondary'; targetIds: string[] }
  | { type: 'enemyAttack'; enemyId: string; targetId: string; attackStyle: 'melee' | 'ranged' }
  | { type: 'enemyDefeated'; enemyId: string; characterXp: number; skillXp: number }
  | { type: 'enemyRespawned'; enemyId: string }
  | { type: 'targetChanged'; target?: RuntimeTarget }
  | { type: 'eliteObjectiveCompleted'; enemyId: string; objectiveId: string }
  | { type: 'skillEffectVisual'; effect: RuntimeSkillEffect }
  | { type: 'statusVisualExpired'; statusId: string; targetId: string }
  | { type: 'decoyExpired' }
  | { type: 'delayedEffectTriggered'; effect: RuntimeSkillEffect }
  | { type: 'damageOverTimeVisualTick'; targetIds: string[] }
  | { type: 'areaHazardTick'; hazardId: number; targetIds: string[] }
  | { type: 'pauseChanged'; paused: boolean }
  | { type: 'playerDied' };

export interface RuntimePosition {
  x: number;
  z: number;
}

export interface RuntimeAreaHazard {
  center: RuntimePosition;
  radius: number;
  durationMs: number;
  intervalMs: number;
  markerStatusId?: string;
}
export interface RuntimeEnemyCombatModifiers { moveSpeedMultiplier: number; attackSpeedMultiplier: number; hitChance: number; outgoingDamageMultiplier: number; }

/** Explicit spatial query; callers must always specify a finite area and never receive all enemies by default. */
export type RuntimeEnemyQuery =
  | { shape: 'circle'; center: RuntimePosition; radius: number }
  | { shape: 'cone'; origin: RuntimePosition; directionRadians: number; radius: number; halfAngleRadians: number };

/** Domain-resolved player movement with no skill identity attached. */
export type RuntimeMovementCommand =
  | { type: 'dash'; distance: number }
  | { type: 'teleport'; destination: RuntimePosition };

/** Domain-resolved enemy displacement using a caller-supplied collision radius. */
export interface RuntimeEnemyDisplacement {
  type: 'knockback' | 'pull';
  distance: number;
  collisionRadius: number;
}

/** Temporary decoy position and lifetime; timing advances only while the runtime is active. */
export interface RuntimeDecoy {
  position: RuntimePosition;
  durationMs: number;
}

/** Explicit finite neighborhood for spreading a domain-resolved status. */
export interface RuntimeStatusSpreadQuery {
  radius: number;
  maxTargets: number;
}

/** Opaque visual effect scheduled with a domain-resolved delay. */
export interface RuntimeDelayedEffect {
  delayMs: number;
  effect: RuntimeSkillEffect;
}

/** Read-only combat target snapshot for HUD and targeting UI. */
export interface RuntimeTarget {
  id: string;
  health: number;
  maxHealth: number;
  bodySize: EnemyBodySize;
}

/** Active scene-only status feedback, exposed for HUD/accessibility adapters. */
export interface RuntimeStatusVisual {
  statusId: string;
  targetId: string;
}

/** Generic domain-mapped action gates. Runtime deliberately has no knowledge of their source status. */
export interface RuntimeRestrictions {
  movementDisabled: boolean;
  actionDisabled: boolean;
  /** Upper-layer silence mapping: active abilities are unavailable, but basic attacks stay usable. */
  activeAbilitiesDisabled?: boolean;
  /** Upper-layer energy-seal mapping: passive effects are unavailable. */
  passiveEffectsDisabled?: boolean;
}

/**
 * Domain-approved skill outcome sent to the runtime for visual presentation only.
 * The runtime never applies damage, status rules, cooldowns, or rewards from these effects.
 */
export type RuntimeSkillEffect =
  | { type: 'displacement'; from: RuntimePosition; to: RuntimePosition }
  | { type: 'area'; center: RuntimePosition; radius: number; targetIds: string[] }
  | { type: 'statusVisual'; statusId: string; targetIds: string[]; durationMs: number }
  | { type: 'damageOverTimeVisual'; targetIds: string[]; durationMs: number; intervalMs: number };

export interface RuntimeOptions {
  config: RuntimeConfig;
  onEvent?: (event: RuntimeEvent) => void;
  engineFactory?: (canvas?: HTMLCanvasElement) => import('@babylonjs/core').Engine;
  /** Injectable source for deterministic randomized AI targeting. */
  random?: () => number;
  /** Defaults to true in browsers. Tests can drive `tick` manually with false. */
  autoStartRenderLoop?: boolean;
}
