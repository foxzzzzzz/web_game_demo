import {
  ArcRotateCamera,
  Color3,
  Engine,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
} from '@babylonjs/core';

import type { EnemyRuntimeConfig, InputState, RuntimeAreaHazard, RuntimeDecoy, RuntimeDelayedEffect, RuntimeEnemyCombatModifiers, RuntimeEnemyDisplacement, RuntimeEnemyQuery, RuntimeEvent, RuntimeMovementCommand, RuntimeOptions, RuntimePosition, RuntimeRestrictions, RuntimeSkillEffect, RuntimeStatusSpreadQuery, RuntimeStatusVisual, RuntimeTarget } from './runtime.types';

interface EnemyEntity {
  config: EnemyRuntimeConfig;
  mesh?: TransformNode;
  lastAttackAtMs: number;
  health: number;
  isAlive: boolean;
  respawnAtMs?: number;
}

interface EnemyModelMaterials {
  primary: StandardMaterial;
  accent: StandardMaterial;
  detail: StandardMaterial;
}

interface ActiveStatusVisual extends RuntimeStatusVisual {
  expiresAtMs: number;
}

interface ActiveDecoy {
  position: RuntimePosition;
  expiresAtMs: number;
}

interface ScheduledEffect {
  effect: RuntimeSkillEffect;
  triggerAtMs: number;
}

interface ActiveDamageOverTimeVisual {
  expiresAtMs: number;
  intervalMs: number;
  nextTickAtMs: number;
  targetIds: string[];
}
interface ActiveAreaHazard extends RuntimeAreaHazard { expiresAtMs: number; nextTickAtMs: number; }

const unrestricted: RuntimeRestrictions = { movementDisabled: false, actionDisabled: false };

/**
 * Babylon presentation runtime. It intentionally emits gameplay intents/events instead of owning
 * domain progression, damage formulas, rewards, or persistence.
 */
export class BabylonGameRuntime {
  private readonly config: RuntimeOptions['config'];
  private readonly emit: (event: RuntimeEvent) => void;
  private readonly engineFactory: (canvas?: HTMLCanvasElement) => Engine;
  private readonly random: () => number;
  private readonly autoStartRenderLoop: boolean;
  private readonly pressed: Required<InputState> = { w: false, a: false, s: false, d: false };
  private readonly enemies = new Map<string, EnemyEntity>();
  private readonly enemyRestrictions = new Map<string, RuntimeRestrictions>();
  private readonly enemyActionGateUntil = new Map<string, number>();
  private readonly enemyWanderUntil = new Map<string, number>();
  private readonly enemyCombatModifiers = new Map<string, RuntimeEnemyCombatModifiers>();
  private readonly randomTargetingEnemies = new Set<string>();
  private readonly statusVisuals = new Map<string, ActiveStatusVisual>();
  private readonly statusMaterialOriginals = new Map<string, Color3>();
  private readonly delayedEffects: ScheduledEffect[] = [];
  private readonly damageOverTimeVisuals = new Map<number, ActiveDamageOverTimeVisual>();
  private readonly areaHazards = new Map<number, ActiveAreaHazard>();
  private engine?: Engine;
  private scene?: Scene;
  private camera?: ArcRotateCamera;
  private player?: TransformNode;
  private canvas?: HTMLCanvasElement;
  private elapsedMs = 0;
  private paused = false;
  private dead = false;
  private playerHealth: number;
  private playerMaxHealth: number;
  private playerRestrictions: RuntimeRestrictions = { ...unrestricted };
  private playerHidden = false;
  private playerStationary = false;
  private decoy?: ActiveDecoy;
  private nextDamageOverTimeVisualId = 0;
  private nextAreaHazardId = 0;
  private playerMoveSpeedMultiplier = 1;
  private currentTargetId?: string;
  private keyDown?: (event: KeyboardEvent) => void;
  private keyUp?: (event: KeyboardEvent) => void;
  private pointerMove?: (event: PointerEvent) => void;
  private pointerDown?: (event: PointerEvent) => void;
  private contextMenu?: (event: MouseEvent) => void;

  public constructor(options: RuntimeOptions) {
    this.config = options.config;
    this.emit = options.onEvent ?? (() => undefined);
    this.engineFactory = options.engineFactory ?? ((canvas) => new Engine(canvas!, true));
    this.random = options.random ?? Math.random;
    this.autoStartRenderLoop = options.autoStartRenderLoop ?? true;
    this.playerHealth = options.config.player.maxHealth;
    this.playerMaxHealth = options.config.player.maxHealth;
  }

  public get isMounted(): boolean {
    return this.scene !== undefined;
  }

  public get isDead(): boolean {
    return this.dead;
  }

  public get enemyIds(): string[] {
    return [...this.enemies.values()].filter((enemy) => enemy.isAlive).map((enemy) => enemy.config.id);
  }

  public get currentTarget(): RuntimeTarget | undefined {
    const enemy = this.currentTargetId ? this.enemies.get(this.currentTargetId) : undefined;
    if (!enemy?.isAlive) return undefined;
    return { id: enemy.config.id, health: enemy.health, maxHealth: enemy.config.maxHealth, bodySize: enemy.config.bodySize };
  }

  public get playerPosition(): RuntimePosition {
    const position = this.requirePlayer().position;
    return { x: position.x, z: position.z };
  }

  public get playerFacingRadians(): number {
    return this.player?.rotation.y ?? 0;
  }

  public enemyPosition(enemyId: string): RuntimePosition | undefined {
    const mesh = this.enemies.get(enemyId)?.mesh;
    return mesh ? { x: mesh.position.x, z: mesh.position.z } : undefined;
  }

  /** Pushes a living enemy directly away from the player; distance is supplied by external effect config. */
  public knockbackEnemy(enemyId: string, distance: number): RuntimePosition | undefined {
    const enemy = this.enemies.get(enemyId);
    if (!enemy?.isAlive || !enemy.mesh || !Number.isFinite(distance) || distance <= 0) return undefined;
    const player = this.requirePlayer().position;
    const direction = enemy.mesh.position.subtract(player);
    direction.y = 0;
    if (direction.lengthSquared() === 0) direction.z = 1;
    direction.normalize();
    const boundary = this.config.world.boundaryRadius;
    enemy.mesh.position.x = Math.max(-boundary, Math.min(boundary, enemy.mesh.position.x + direction.x * distance));
    enemy.mesh.position.z = Math.max(-boundary, Math.min(boundary, enemy.mesh.position.z + direction.z * distance));
    return { x: enemy.mesh.position.x, z: enemy.mesh.position.z };
  }

  /** Returns living targets inside the caller-specified spatial area, ordered nearest first. */
  public queryAliveEnemies(query: RuntimeEnemyQuery): string[] {
    if (!Number.isFinite(query.radius) || query.radius <= 0 || (query.shape === 'cone' && (!Number.isFinite(query.directionRadians) || !Number.isFinite(query.halfAngleRadians) || query.halfAngleRadians < 0))) return [];
    return [...this.enemies.values()]
      .flatMap((enemy) => {
        if (!enemy.isAlive || !enemy.mesh) return [];
        const origin = query.shape === 'circle' ? query.center : query.origin;
        const distance = this.horizontalDistance(enemy.mesh.position, new Vector3(origin.x, 0, origin.z));
        if (distance > query.radius) return [];
        if (query.shape === 'cone' && !this.isInsideCone(origin, enemy.mesh.position, query.directionRadians, query.halfAngleRadians)) return [];
        return [{ id: enemy.config.id, distance }];
      })
      .sort((first, second) => first.distance - second.distance)
      .map(({ id }) => id);
  }

  /** Finds living neighbors around a source enemy for upper-layer status-spread resolution. */
  public queryStatusSpreadTargets(sourceEnemyId: string, query: RuntimeStatusSpreadQuery): string[] {
    const source = this.enemies.get(sourceEnemyId);
    if (!source?.isAlive || !source.mesh || !Number.isFinite(query.radius) || query.radius <= 0 || !Number.isInteger(query.maxTargets) || query.maxTargets <= 0) return [];
    return this.queryAliveEnemies({ shape: 'circle', center: { x: source.mesh.position.x, z: source.mesh.position.z }, radius: query.radius })
      .filter((enemyId) => enemyId !== sourceEnemyId)
      .slice(0, query.maxTargets);
  }

  public queryInjuredEnemies(center: RuntimePosition, radius: number): string[] {
    if (!Number.isFinite(radius) || radius <= 0) return [];
    return [...this.enemies.values()].filter((enemy) => enemy.isAlive && enemy.health < enemy.config.maxHealth && enemy.mesh)
      .map((enemy) => ({ id: enemy.config.id, distance: Math.hypot(enemy.mesh!.position.x - center.x, enemy.mesh!.position.z - center.z) }))
      .filter((enemy) => enemy.distance <= radius).sort((a, b) => a.distance - b.distance).map((enemy) => enemy.id);
  }

  public get activeStatusVisuals(): RuntimeStatusVisual[] {
    return [...this.statusVisuals.values()].map(({ statusId, targetId }) => ({ statusId, targetId }));
  }

  public mount(canvas?: HTMLCanvasElement): void {
    if (this.scene) return;

    this.canvas = canvas;
    this.engine = this.engineFactory(canvas);
    this.scene = new Scene(this.engine);
    this.createWorld(this.scene);
    this.bindInput();
    if (this.autoStartRenderLoop) {
      this.engine.runRenderLoop(() => {
        const deltaMs = this.engine?.getDeltaTime() ?? 0;
        this.tick(deltaMs);
        this.scene?.render();
      });
    }
  }

  public destroy(): void {
    if (!this.scene) return;
    this.unbindInput();
    this.engine?.stopRenderLoop();
    this.scene.dispose();
    this.engine?.dispose();
    this.enemies.clear();
    this.enemyRestrictions.clear();
    this.enemyActionGateUntil.clear();
    this.enemyWanderUntil.clear();
    this.randomTargetingEnemies.clear();
    this.statusVisuals.clear();
    this.statusMaterialOriginals.clear();
    this.delayedEffects.length = 0;
    this.damageOverTimeVisuals.clear();
    this.areaHazards.clear();
    this.scene = undefined;
    this.engine = undefined;
    this.camera = undefined;
    this.player = undefined;
    this.canvas = undefined;
  }

  public setInputState(input: InputState): void {
    for (const key of Object.keys(this.pressed) as Array<keyof InputState>) {
      if (input[key] !== undefined) this.pressed[key] = input[key] === true;
    }
  }

  public setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    this.emit({ type: 'pauseChanged', paused });
  }

  public setPlayerPosition(position: RuntimePosition): void {
    const player = this.requirePlayer();
    player.position.x = position.x;
    player.position.z = position.z;
  }

  /** Moves along the current facing direction and stops at the same legal position as WASD movement. */
  public movePlayerForward(distance: number): RuntimePosition {
    const player = this.requirePlayer();
    if (!this.scene || this.paused || this.dead || this.isPlayerMovementDisabled() || distance <= 0) return this.playerPosition;
    const candidate = {
      x: player.position.x + Math.sin(player.rotation.y) * distance,
      z: player.position.z + Math.cos(player.rotation.y) * distance,
    };
    return this.movePlayerTo(candidate);
  }

  /** Applies a parsed dash or teleport without identifying the originating skill. */
  public performPlayerMovement(command: RuntimeMovementCommand): RuntimePosition {
    if (command.type === 'dash') return this.movePlayerForward(command.distance);
    if (!this.scene || this.paused || this.dead || this.isPlayerMovementDisabled()) return this.playerPosition;
    return this.movePlayerTo(command.destination);
  }

  /** Displaces a living enemy relative to the player through the shared world-boundary/obstacle sampler. */
  public displaceEnemyRelativeToPlayer(enemyId: string, displacement: RuntimeEnemyDisplacement): RuntimePosition | undefined {
    const enemy = this.enemies.get(enemyId);
    if (!enemy?.isAlive || !enemy.mesh || displacement.distance <= 0 || displacement.collisionRadius <= 0) return this.enemyPosition(enemyId);
    const player = this.requirePlayer().position;
    const fromPlayer = new Vector3(enemy.mesh.position.x - player.x, 0, enemy.mesh.position.z - player.z);
    if (fromPlayer.lengthSquared() === 0) return this.enemyPosition(enemyId);
    fromPlayer.normalize();
    const direction = displacement.type === 'knockback' ? fromPlayer : fromPlayer.scale(-1);
    const start = { x: enemy.mesh.position.x, z: enemy.mesh.position.z };
    const candidate = { x: start.x + direction.x * displacement.distance, z: start.z + direction.z * displacement.distance };
    const position = this.sampleLegalMovement(start, candidate, displacement.collisionRadius).position;
    enemy.mesh.position.x = position.x;
    enemy.mesh.position.z = position.z;
    return position;
  }

  public setPlayerHidden(hidden: boolean): void {
    this.playerHidden = hidden;
  }

  public setDecoy(decoy?: RuntimeDecoy): void {
    this.decoy = decoy && decoy.durationMs > 0 ? { position: decoy.position, expiresAtMs: this.elapsedMs + decoy.durationMs } : undefined;
  }

  public setPlayerStationary(stationary: boolean): void {
    this.playerStationary = stationary;
  }

  /** Checks whether player position is within the supplied rear arc of an enemy's current facing. */
  public isPlayerBehindEnemy(enemyId: string, halfAngleRadians: number): boolean {
    const enemy = this.enemies.get(enemyId);
    if (!enemy?.isAlive || !enemy.mesh || !Number.isFinite(halfAngleRadians) || halfAngleRadians < 0) return false;
    const player = this.requirePlayer().position;
    const playerDirection = Math.atan2(player.x - enemy.mesh.position.x, player.z - enemy.mesh.position.z);
    const difference = this.angleDifference(playerDirection, enemy.mesh.rotation.y);
    return Math.abs(difference) >= Math.PI - halfAngleRadians;
  }

  /** Sets the HUD/attack target; target validity is still checked for every attack. */
  public setCurrentTarget(enemyId?: string): void {
    const enemy = enemyId ? this.enemies.get(enemyId) : undefined;
    this.currentTargetId = enemy?.isAlive ? enemyId : undefined;
    this.emit({ type: 'targetChanged', target: this.currentTarget });
  }

  /** Mirrors domain-computed player action gates; no status or skill identifiers are interpreted here. */
  public syncPlayerRestrictions(restrictions: RuntimeRestrictions): void {
    this.playerRestrictions = { ...restrictions };
  }

  public isPlayerActiveAbilitiesDisabled(): boolean {
    return this.playerRestrictions.activeAbilitiesDisabled === true;
  }

  /** Mirrors a domain-resolved movement multiplier; invalid values restore normal speed. */
  public syncPlayerMoveSpeedMultiplier(multiplier: number): void {
    this.playerMoveSpeedMultiplier = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
  }

  /** Mirrors domain-computed enemy action gates; removed automatically when that enemy dies or respawns. */
  public syncEnemyRestrictions(enemyId: string, restrictions: RuntimeRestrictions): void {
    const enemy = this.enemies.get(enemyId);
    if (!enemy?.isAlive) return;
    this.enemyRestrictions.set(enemyId, { ...restrictions });
  }
  /** Applies a duration-bound action gate without changing domain status truth. */
  public gateEnemyActions(enemyId: string, durationMs: number): void {
    if (Number.isFinite(durationMs) && durationMs > 0) this.enemyActionGateUntil.set(enemyId, Math.max(this.enemyActionGateUntil.get(enemyId) ?? 0, this.elapsedMs + durationMs));
  }
  public setEnemyWandering(enemyId: string, durationMs: number): void {
    if (Number.isFinite(durationMs) && durationMs > 0) this.enemyWanderUntil.set(enemyId, this.elapsedMs + durationMs);
  }

  public isEnemyPassiveEffectsDisabled(enemyId: string): boolean {
    return this.enemyRestrictions.get(enemyId)?.passiveEffectsDisabled === true;
  }

  /** Enables deterministic random target selection among currently legal AI targets. */
  public syncEnemyRandomTargeting(enemyId: string, enabled: boolean): void {
    const enemy = this.enemies.get(enemyId);
    if (!enemy?.isAlive) return;
    if (enabled) this.randomTargetingEnemies.add(enemyId);
    else this.randomTargetingEnemies.delete(enemyId);
  }

  public basicAttack(attack: 'primary' | 'secondary'): void {
    if (!this.scene || this.paused || this.dead || this.playerRestrictions.actionDisabled) return;
    const player = this.playerPosition;
    const legalTargetIds = this.queryAliveEnemies({ shape: 'circle', center: player, radius: this.config.player.attackRange });
    const currentTargetIsLegal = this.currentTargetId !== undefined && legalTargetIds.includes(this.currentTargetId);
    const targetIds = attack === 'primary' ? (currentTargetIsLegal ? [this.currentTargetId!] : legalTargetIds.slice(0, 1)) : legalTargetIds;
    if (!currentTargetIsLegal && targetIds[0]) this.setCurrentTarget(targetIds[0]);
    this.emit({ type: 'basicAttack', attack, targetIds });
  }

  /** Receives final domain damage and only adapts the resulting death state to the scene. */
  public applyPlayerDamage(damage: number): void {
    if (this.dead || damage <= 0) return;
    this.playerHealth = Math.max(0, this.playerHealth - damage);
    if (this.playerHealth === 0) this.markPlayerDead();
  }

  /** Mirrors an already-resolved domain health value; it never calculates healing or damage. */
  public syncPlayerHealth(currentHealth: number, maxHealth: number): void {
    if (this.dead || maxHealth <= 0) return;
    this.playerMaxHealth = maxHealth;
    this.playerHealth = Math.max(0, Math.min(currentHealth, this.playerMaxHealth));
    if (this.playerHealth === 0) this.markPlayerDead();
  }

  public applyEnemyDamage(enemyId: string, damage: number): void {
    const enemy = this.enemies.get(enemyId);
    if (!enemy?.isAlive || damage <= 0) return;
    enemy.health = Math.max(0, enemy.health - damage);
    if (enemy.health > 0) {
      if (this.currentTargetId === enemyId) this.emit({ type: 'targetChanged', target: this.currentTarget });
      return;
    }
    enemy.mesh?.dispose();
    enemy.mesh = undefined;
    enemy.isAlive = false;
    this.enemyRestrictions.delete(enemyId);
    this.randomTargetingEnemies.delete(enemyId);
    this.clearStatusVisualsForTarget(enemyId);
    enemy.respawnAtMs = this.elapsedMs + enemy.config.respawnDelayMs;
    if (this.currentTargetId === enemyId) {
      this.currentTargetId = undefined;
      this.emit({ type: 'targetChanged', target: undefined });
    }
    this.emit({ type: 'enemyDefeated', enemyId, characterXp: enemy.config.characterXp, skillXp: enemy.config.skillXp });
    if (enemy.config.objectiveId) this.emit({ type: 'eliteObjectiveCompleted', enemyId, objectiveId: enemy.config.objectiveId });
  }

  /** Accepts only domain-approved effect outcomes and publishes them for Babylon/UI visual adapters. */
  public presentSkillEffect(effect: RuntimeSkillEffect): void {
    if (!this.scene) return;
    this.emit({ type: 'skillEffectVisual', effect });
    this.applySkillVisual(effect);
  }

  /** Schedules an opaque visual effect using a domain-resolved delay. */
  public scheduleDelayedEffect(delayed: RuntimeDelayedEffect): void {
    if (!this.scene || !Number.isFinite(delayed.delayMs) || delayed.delayMs < 0) return;
    this.delayedEffects.push({ effect: delayed.effect, triggerAtMs: this.elapsedMs + delayed.delayMs });
  }

  public createAreaHazard(hazard: RuntimeAreaHazard): number | undefined {
    if (!this.scene || ![hazard.radius, hazard.durationMs, hazard.intervalMs].every(Number.isFinite) || hazard.radius <= 0 || hazard.durationMs <= 0 || hazard.intervalMs <= 0) return undefined;
    const id = this.nextAreaHazardId++;
    this.areaHazards.set(id, { ...hazard, expiresAtMs: this.elapsedMs + hazard.durationMs, nextTickAtMs: this.elapsedMs + hazard.intervalMs });
    return id;
  }

  public removeAreaHazardsByMarker(markerStatusId: string): number[] {
    const removed: number[] = [];
    for (const [id, hazard] of this.areaHazards) if (hazard.markerStatusId === markerStatusId) {
      this.emit({ type: 'areaHazardTick', hazardId: id, targetIds: this.queryAliveEnemies({ shape: 'circle', center: hazard.center, radius: hazard.radius }) });
      this.areaHazards.delete(id);
      removed.push(id);
    }
    return removed;
  }
  public scaleAreaHazardIntervals(multiplier: number): void {
    if (!Number.isFinite(multiplier) || multiplier <= 0) return;
    for (const hazard of this.areaHazards.values()) hazard.intervalMs = Math.max(1, hazard.intervalMs / multiplier);
  }
  public syncEnemyCombatModifiers(enemyId: string, modifiers: RuntimeEnemyCombatModifiers): void { this.enemyCombatModifiers.set(enemyId, modifiers); }

  /** Advances deterministic runtime simulation; useful for the integration boundary and headless tests. */
  public tick(deltaMs: number): void {
    if (!this.scene || this.paused || this.dead || deltaMs <= 0) return;
    this.elapsedMs += deltaMs;
    this.updateRespawns();
    this.updateDecoy();
    this.updateDelayedEffects();
    this.updateStatusVisuals();
    this.updateDamageOverTimeVisuals();
    this.updateAreaHazards();
    if (!this.isPlayerMovementDisabled()) this.updatePlayer(deltaMs);
    this.updateEnemies(deltaMs);
  }

  private createWorld(scene: Scene): void {
    const ground = MeshBuilder.CreateGround('ground', { width: this.config.world.groundSize, height: this.config.world.groundSize, subdivisions: 2 }, scene);
    ground.material = this.material(scene, 'ground-material', new Color3(0.25, 0.43, 0.22));

    for (const obstacle of this.config.world.obstacles) {
      const mesh = MeshBuilder.CreateBox(`obstacle-${obstacle.id}`, { width: obstacle.width, depth: obstacle.depth, height: this.config.world.obstacleHeight }, scene);
      mesh.position.set(obstacle.x, this.config.world.obstacleHeight / 2, obstacle.z);
      mesh.material = this.material(scene, `obstacle-material-${obstacle.id}`, new Color3(0.35, 0.32, 0.24));
    }

    this.player = this.createSnake(scene);
    this.camera = new ArcRotateCamera('third-person-camera', this.config.camera.alpha, this.config.camera.beta, this.config.camera.radius, new Vector3(0, this.config.camera.targetHeight, 0), scene);
    this.camera.lockedTarget = this.player;
    if (this.canvas) this.camera.attachControl(this.canvas, true);
    new HemisphericLight('hemispheric-light', new Vector3(0.2, 1, 0.1), scene).intensity = 0.9;

    for (const enemyConfig of this.config.enemies) this.enemies.set(enemyConfig.id, this.createEnemy(scene, enemyConfig));
  }

  private createSnake(scene: Scene): TransformNode {
    const root = new TransformNode('player-snake', scene);
    const material = this.material(scene, 'snake-material', new Color3(0.18, 0.5, 0.19));
    for (let index = 0; index < 4; index += 1) {
      const segment = MeshBuilder.CreateSphere(`snake-segment-${index}`, { diameter: 1.1 - index * 0.08, segments: 6 }, scene);
      segment.position.set(0, 0.55, -index * 0.65);
      segment.material = material;
      segment.parent = root;
    }
    return root;
  }

  private createEnemy(scene: Scene, config: EnemyRuntimeConfig): EnemyEntity {
    const enemy: EnemyEntity = { config, lastAttackAtMs: -config.attackIntervalMs, health: config.maxHealth, isAlive: true };
    this.spawnEnemy(scene, enemy);
    return enemy;
  }

  private spawnEnemy(scene: Scene, enemy: EnemyEntity): void {
    const { config } = enemy;
    const materials = {
      primary: this.enemyMaterial(scene, `enemy-material-${config.id}-primary`, config.visual.color),
      accent: this.enemyMaterial(scene, `enemy-material-${config.id}-accent`, config.visual.accentColor),
      detail: this.enemyMaterial(scene, `enemy-material-${config.id}-detail`, config.visual.detailColor),
    };
    const mesh = this.createEnemyModel(scene, config, materials);
    mesh.position.set(config.spawn.x, 0, config.spawn.z);
    enemy.mesh = mesh;
    enemy.health = config.maxHealth;
    enemy.isAlive = true;
    enemy.respawnAtMs = undefined;
    this.enemyRestrictions.delete(config.id);
    this.randomTargetingEnemies.delete(config.id);
    enemy.lastAttackAtMs = this.elapsedMs - config.attackIntervalMs;
  }

  private createEnemyModel(scene: Scene, config: EnemyRuntimeConfig, materials: EnemyModelMaterials): TransformNode {
    const root = new TransformNode(`enemy-${config.id}`, scene);
    root.scaling.setAll(config.visual.scale);
    const prefix = `enemy-${config.id}`;
    if (config.visual.model === 'marshRat') this.createMarshRat(scene, root, prefix, materials);
    else if (config.visual.model === 'thornLizard') this.createThornLizard(scene, root, prefix, materials);
    else if (config.visual.model === 'ancientMonitor') this.createAncientMonitor(scene, root, prefix, materials);
    else this.enemyBox(scene, root, `${prefix}-generic-body`, new Vector3(0, 0.7, 0), new Vector3(1, 1, 1), materials.primary);
    return root;
  }

  private createMarshRat(scene: Scene, root: TransformNode, prefix: string, materials: EnemyModelMaterials): void {
    this.enemyBox(scene, root, `${prefix}-rat-body`, new Vector3(0, 0.58, 0), new Vector3(1.05, 0.72, 1.45), materials.primary);
    this.enemyBox(scene, root, `${prefix}-rat-head`, new Vector3(0, 0.68, 1.05), new Vector3(0.9, 0.78, 0.72), materials.primary);
    this.enemyBox(scene, root, `${prefix}-rat-snout`, new Vector3(0, 0.56, 1.55), new Vector3(0.5, 0.42, 0.42), materials.accent);
    this.enemyBox(scene, root, `${prefix}-rat-ear-left`, new Vector3(-0.32, 1.22, 0.95), new Vector3(0.28, 0.46, 0.2), materials.accent);
    this.enemyBox(scene, root, `${prefix}-rat-ear-right`, new Vector3(0.32, 1.22, 0.95), new Vector3(0.28, 0.46, 0.2), materials.accent);
    this.enemyBox(scene, root, `${prefix}-rat-eye-left`, new Vector3(-0.28, 0.82, 1.43), new Vector3(0.14, 0.14, 0.08), materials.detail);
    this.enemyBox(scene, root, `${prefix}-rat-eye-right`, new Vector3(0.28, 0.82, 1.43), new Vector3(0.14, 0.14, 0.08), materials.detail);
    this.enemyBox(scene, root, `${prefix}-rat-tail`, new Vector3(0, 0.48, -1.05), new Vector3(0.22, 0.22, 0.75), materials.accent);
    this.enemyBox(scene, root, `${prefix}-rat-tail-1`, new Vector3(0.18, 0.48, -1.65), new Vector3(0.2, 0.2, 0.55), materials.accent);
    this.enemyBox(scene, root, `${prefix}-rat-tail-2`, new Vector3(0.36, 0.48, -2.05), new Vector3(0.16, 0.16, 0.35), materials.accent);
  }

  private createThornLizard(scene: Scene, root: TransformNode, prefix: string, materials: EnemyModelMaterials): void {
    this.enemyBox(scene, root, `${prefix}-lizard-body`, new Vector3(0, 0.62, 0), new Vector3(1.45, 0.72, 2.0), materials.primary);
    this.enemyBox(scene, root, `${prefix}-lizard-head`, new Vector3(0, 0.68, 1.35), new Vector3(1.05, 0.72, 0.82), materials.primary);
    this.enemyBox(scene, root, `${prefix}-lizard-snout`, new Vector3(0, 0.57, 1.94), new Vector3(0.78, 0.44, 0.58), materials.accent);
    this.enemyBox(scene, root, `${prefix}-lizard-eye-left`, new Vector3(-0.38, 0.82, 1.75), new Vector3(0.13, 0.13, 0.08), materials.detail);
    this.enemyBox(scene, root, `${prefix}-lizard-eye-right`, new Vector3(0.38, 0.82, 1.75), new Vector3(0.13, 0.13, 0.08), materials.detail);
    this.createLizardLegs(scene, root, `${prefix}-lizard`, 0.95, 0.68, materials);
    this.createVoxelTail(scene, root, `${prefix}-lizard`, 1.25, 0.5, materials.primary);
    [-0.62, 0, 0.62].forEach((z, index) => this.enemyBox(scene, root, `${prefix}-lizard-spike-${index}`, new Vector3(0, 1.28, z), new Vector3(0.28, 0.58, 0.28), materials.accent));
  }

  private createAncientMonitor(scene: Scene, root: TransformNode, prefix: string, materials: EnemyModelMaterials): void {
    this.enemyBox(scene, root, `${prefix}-monitor-body`, new Vector3(0, 0.9, 0), new Vector3(2.35, 1.0, 3.2), materials.primary);
    this.enemyBox(scene, root, `${prefix}-monitor-neck`, new Vector3(0, 0.92, 1.8), new Vector3(1.45, 0.82, 1.05), materials.primary);
    this.enemyBox(scene, root, `${prefix}-monitor-head`, new Vector3(0, 0.9, 2.6), new Vector3(1.75, 0.9, 1.25), materials.primary);
    this.enemyBox(scene, root, `${prefix}-monitor-snout`, new Vector3(0, 0.72, 3.45), new Vector3(1.4, 0.58, 0.72), materials.accent);
    this.enemyBox(scene, root, `${prefix}-monitor-eye-left`, new Vector3(-0.62, 1.08, 3.12), new Vector3(0.18, 0.18, 0.09), materials.detail);
    this.enemyBox(scene, root, `${prefix}-monitor-eye-right`, new Vector3(0.62, 1.08, 3.12), new Vector3(0.18, 0.18, 0.09), materials.detail);
    this.createLizardLegs(scene, root, `${prefix}-monitor`, 1.55, 1.05, materials);
    this.createVoxelTail(scene, root, `${prefix}-monitor`, 2.05, 0.82, materials.primary);
  }

  private createLizardLegs(scene: Scene, root: TransformNode, prefix: string, x: number, z: number, materials: EnemyModelMaterials): void {
    for (const [side, direction] of [['left', -1], ['right', 1]] as const) {
      this.enemyBox(scene, root, `${prefix}-leg-front-${side}`, new Vector3(direction * x, 0.42, z), new Vector3(0.72, 0.36, 0.38), materials.primary);
      this.enemyBox(scene, root, `${prefix}-foot-front-${side}`, new Vector3(direction * (x + 0.42), 0.2, z + 0.12), new Vector3(0.45, 0.22, 0.5), materials.accent);
      this.enemyBox(scene, root, `${prefix}-leg-back-${side}`, new Vector3(direction * x, 0.42, -z), new Vector3(0.72, 0.36, 0.38), materials.primary);
      this.enemyBox(scene, root, `${prefix}-foot-back-${side}`, new Vector3(direction * (x + 0.42), 0.2, -z - 0.12), new Vector3(0.45, 0.22, 0.5), materials.accent);
    }
  }

  private createVoxelTail(scene: Scene, root: TransformNode, prefix: string, startZ: number, width: number, material: StandardMaterial): void {
    this.enemyBox(scene, root, `${prefix}-tail-0`, new Vector3(0, 0.64, -startZ), new Vector3(width, width, 1.25), material);
    this.enemyBox(scene, root, `${prefix}-tail-1`, new Vector3(0.18, 0.58, -startZ - 1), new Vector3(width * 0.72, width * 0.72, 0.9), material);
    this.enemyBox(scene, root, `${prefix}-tail-2`, new Vector3(0.34, 0.52, -startZ - 1.72), new Vector3(width * 0.45, width * 0.45, 0.62), material);
  }

  private enemyBox(scene: Scene, root: TransformNode, name: string, position: Vector3, scaling: Vector3, material: StandardMaterial): Mesh {
    const part = MeshBuilder.CreateBox(name, { size: 1 }, scene);
    part.position.copyFrom(position);
    part.scaling.copyFrom(scaling);
    part.material = material;
    part.parent = root;
    return part;
  }

  private enemyMaterial(scene: Scene, name: string, color: { r: number; g: number; b: number }): StandardMaterial {
    const material = this.material(scene, name, new Color3(color.r, color.g, color.b));
    material.specularColor = Color3.Black();
    return material;
  }

  private updatePlayer(deltaMs: number): void {
    const horizontal = Number(this.pressed.d) - Number(this.pressed.a);
    const vertical = Number(this.pressed.w) - Number(this.pressed.s);
    if (horizontal === 0 && vertical === 0) return;
    const length = Math.hypot(horizontal, vertical);
    const scale = (this.config.player.moveSpeed * this.playerMoveSpeedMultiplier * deltaMs) / 1000 / length;
    const player = this.requirePlayer();
    const start = { x: player.position.x, z: player.position.z };
    const cameraAlpha = this.camera!.alpha;
    const movementX = -vertical * Math.cos(cameraAlpha) - horizontal * Math.sin(cameraAlpha);
    const movementZ = -vertical * Math.sin(cameraAlpha) + horizontal * Math.cos(cameraAlpha);
    const candidate = { x: start.x + movementX * scale, z: start.z + movementZ * scale };
    player.rotation.y = Math.atan2(movementX, movementZ);
    this.movePlayerTo(candidate);
  }

  private movePlayerTo(candidate: RuntimePosition): RuntimePosition {
    const player = this.requirePlayer();
    const start = { x: player.position.x, z: player.position.z };
    const result = this.sampleLegalMovement(start, candidate, this.config.player.collisionRadius);
    player.position.x = result.position.x;
    player.position.z = result.position.z;
    if (result.collided) this.emit({ type: 'collision', attemptedPosition: candidate });
    else this.emit({ type: 'playerMoved', position: result.position });
    return result.position;
  }

  private updateEnemies(deltaMs: number): void {
    for (const enemy of this.enemies.values()) {
      if (!enemy.isAlive || !enemy.mesh) continue;
      const wanderUntil = this.enemyWanderUntil.get(enemy.config.id) ?? 0;
      if (wanderUntil > this.elapsedMs) {
        const angle = this.random() * Math.PI * 2;
        const candidate = { x: enemy.mesh.position.x + Math.sin(angle) * enemy.config.moveSpeed * deltaMs / 1000, z: enemy.mesh.position.z + Math.cos(angle) * enemy.config.moveSpeed * deltaMs / 1000 };
        this.moveEnemyAlongLegalPath(enemy, candidate);
        continue;
      }
      this.enemyWanderUntil.delete(enemy.config.id);
      const target = this.aiTarget(enemy.config.id);
      if (!target) continue;
      const restrictions = this.enemyRestrictions.get(enemy.config.id) ?? unrestricted;
      const modifiers = this.enemyCombatModifiers.get(enemy.config.id) ?? { moveSpeedMultiplier: 1, attackSpeedMultiplier: 1, hitChance: 1, outgoingDamageMultiplier: 1 };
      const targetPosition = new Vector3(target.position.x, 0, target.position.z);
      const distance = this.horizontalDistance(enemy.mesh.position, targetPosition);
      if (distance > enemy.config.aggroRange) continue;
      if (distance > enemy.config.attackRange) {
        if (restrictions.movementDisabled) continue;
        const direction = targetPosition.subtract(enemy.mesh.position);
        direction.y = 0;
        direction.normalize();
        enemy.mesh.rotation.y = Math.atan2(direction.x, direction.z);
        const movement = direction.scale((enemy.config.moveSpeed * modifiers.moveSpeedMultiplier * deltaMs) / 1000);
        this.moveEnemyAlongLegalPath(enemy, { x: enemy.mesh.position.x + movement.x, z: enemy.mesh.position.z + movement.z });
        continue;
      }
      if (!restrictions.actionDisabled && (this.enemyActionGateUntil.get(enemy.config.id) ?? 0) <= this.elapsedMs && this.elapsedMs - enemy.lastAttackAtMs >= enemy.config.attackIntervalMs / modifiers.attackSpeedMultiplier) {
        enemy.lastAttackAtMs = this.elapsedMs;
        if (this.random() < modifiers.hitChance) this.emit({ type: 'enemyAttack', enemyId: enemy.config.id, targetId: target.id, attackStyle: enemy.config.kind === 'mediumRanged' ? 'ranged' : 'melee' });
      }
    }
  }

  private markPlayerDead(): void {
    this.dead = true;
    this.playerRestrictions = { ...unrestricted };
    this.setInputState({ w: false, a: false, s: false, d: false });
    this.emit({ type: 'playerDied' });
  }

  private updateRespawns(): void {
    if (!this.scene) return;
    for (const enemy of this.enemies.values()) {
      if (enemy.isAlive || enemy.respawnAtMs === undefined || this.elapsedMs < enemy.respawnAtMs) continue;
      this.spawnEnemy(this.scene, enemy);
      this.emit({ type: 'enemyRespawned', enemyId: enemy.config.id });
    }
  }

  private updateDecoy(): void {
    if (!this.decoy || this.elapsedMs < this.decoy.expiresAtMs) return;
    this.decoy = undefined;
    this.emit({ type: 'decoyExpired' });
  }

  private updateDelayedEffects(): void {
    for (let index = this.delayedEffects.length - 1; index >= 0; index -= 1) {
      const delayed = this.delayedEffects[index];
      if (this.elapsedMs < delayed.triggerAtMs) continue;
      this.delayedEffects.splice(index, 1);
      this.emit({ type: 'delayedEffectTriggered', effect: delayed.effect });
      this.applySkillVisual(delayed.effect);
    }
  }

  private applySkillVisual(effect: RuntimeSkillEffect): void {
    if (effect.type === 'statusVisual') this.applyStatusVisual(effect);
    if (effect.type === 'damageOverTimeVisual' && effect.durationMs > 0 && effect.intervalMs > 0) {
      this.damageOverTimeVisuals.set(this.nextDamageOverTimeVisualId, {
        targetIds: effect.targetIds,
        expiresAtMs: this.elapsedMs + effect.durationMs,
        intervalMs: effect.intervalMs,
        nextTickAtMs: this.elapsedMs + effect.intervalMs,
      });
      this.nextDamageOverTimeVisualId += 1;
    }
  }

  private updateDamageOverTimeVisuals(): void {
    for (const [id, visual] of this.damageOverTimeVisuals) {
      while (visual.nextTickAtMs <= this.elapsedMs && visual.nextTickAtMs <= visual.expiresAtMs) {
        this.emit({ type: 'damageOverTimeVisualTick', targetIds: visual.targetIds });
        visual.nextTickAtMs += visual.intervalMs;
      }
      if (this.elapsedMs >= visual.expiresAtMs) this.damageOverTimeVisuals.delete(id);
    }
  }

  private updateAreaHazards(): void {
    for (const [id, hazard] of this.areaHazards) {
      if (this.elapsedMs >= hazard.nextTickAtMs) { this.emit({ type: 'areaHazardTick', hazardId: id, targetIds: this.queryAliveEnemies({ shape: 'circle', center: hazard.center, radius: hazard.radius }) }); hazard.nextTickAtMs += hazard.intervalMs; }
      if (this.elapsedMs >= hazard.expiresAtMs) this.areaHazards.delete(id);
    }
  }

  private applyStatusVisual(effect: Extract<RuntimeSkillEffect, { type: 'statusVisual' }>): void {
    for (const targetId of effect.targetIds) {
      const enemy = this.enemies.get(targetId);
      const material = enemy ? this.statusMaterial(enemy) : undefined;
      if (!enemy?.isAlive || !material) continue;
      if (!this.statusMaterialOriginals.has(targetId)) this.statusMaterialOriginals.set(targetId, material.emissiveColor.clone());
      material.emissiveColor = Color3.Yellow();
      this.statusVisuals.set(`${effect.statusId}:${targetId}`, { statusId: effect.statusId, targetId, expiresAtMs: this.elapsedMs + effect.durationMs });
    }
  }

  private updateStatusVisuals(): void {
    for (const [key, visual] of this.statusVisuals) {
      if (this.elapsedMs < visual.expiresAtMs) continue;
      this.statusVisuals.delete(key);
      this.restoreTargetMaterialIfClear(visual.targetId);
      this.emit({ type: 'statusVisualExpired', statusId: visual.statusId, targetId: visual.targetId });
    }
  }

  private clearStatusVisualsForTarget(targetId: string): void {
    for (const [key, visual] of this.statusVisuals) {
      if (visual.targetId === targetId) this.statusVisuals.delete(key);
    }
    this.statusMaterialOriginals.delete(targetId);
  }

  private restoreTargetMaterialIfClear(targetId: string): void {
    if ([...this.statusVisuals.values()].some((visual) => visual.targetId === targetId)) return;
    const originalColor = this.statusMaterialOriginals.get(targetId);
    const enemy = this.enemies.get(targetId);
    const material = enemy ? this.statusMaterial(enemy) : undefined;
    if (originalColor && material) material.emissiveColor = originalColor;
    this.statusMaterialOriginals.delete(targetId);
  }

  private statusMaterial(enemy: EnemyEntity): StandardMaterial | undefined {
    const mesh = enemy.mesh?.getChildMeshes().find((child) => child.material instanceof StandardMaterial);
    return mesh?.material instanceof StandardMaterial ? mesh.material : undefined;
  }

  private sampleLegalMovement(start: RuntimePosition, candidate: RuntimePosition, collisionRadius: number): { position: RuntimePosition; collided: boolean } {
    const stepCount = Math.max(1, Math.ceil(Math.hypot(candidate.x - start.x, candidate.z - start.z) / (collisionRadius / 2)));
    let lastWalkable = start;
    for (let step = 1; step <= stepCount; step += 1) {
      const progress = step / stepCount;
      const sampled = {
        x: start.x + (candidate.x - start.x) * progress,
        z: start.z + (candidate.z - start.z) * progress,
      };
      if (!this.isWalkable(sampled, collisionRadius)) return { position: lastWalkable, collided: true };
      lastWalkable = sampled;
    }
    return { position: candidate, collided: false };
  }

  private moveEnemyAlongLegalPath(enemy: EnemyEntity, candidate: RuntimePosition): void {
    if (!enemy.mesh) return;
    const start = { x: enemy.mesh.position.x, z: enemy.mesh.position.z };
    const result = this.sampleLegalMovement(start, candidate, enemy.config.collisionRadius);
    enemy.mesh.position.x = result.position.x;
    enemy.mesh.position.z = result.position.z;
  }

  private isPlayerMovementDisabled(): boolean {
    return this.playerRestrictions.movementDisabled || this.playerStationary;
  }

  private aiTarget(enemyId: string): { id: string; position: RuntimePosition } | undefined {
    const targets: Array<{ id: string; position: RuntimePosition }> = [];
    if (!this.playerHidden) targets.push({ id: 'player', position: this.playerPosition });
    if (this.decoy) targets.push({ id: 'decoy', position: this.decoy.position });
    if (this.randomTargetingEnemies.has(enemyId)) {
      for (const enemy of this.enemies.values()) if (enemy.isAlive && enemy.config.id !== enemyId && enemy.mesh) targets.push({ id: enemy.config.id, position: { x: enemy.mesh.position.x, z: enemy.mesh.position.z } });
      return targets.length ? targets[Math.min(targets.length - 1, Math.floor(this.random() * targets.length))] : undefined;
    }
    if (targets.length === 0) return undefined;
    return this.decoy ? targets.find((target) => target.id === 'decoy') : targets[0];
  }

  private isWalkable(position: RuntimePosition, collisionRadius: number): boolean {
    if (Math.hypot(position.x, position.z) + collisionRadius > this.config.world.boundaryRadius) return false;
    return this.config.world.obstacles.every((obstacle) => {
      const nearestX = Math.max(obstacle.x - obstacle.width / 2, Math.min(position.x, obstacle.x + obstacle.width / 2));
      const nearestZ = Math.max(obstacle.z - obstacle.depth / 2, Math.min(position.z, obstacle.z + obstacle.depth / 2));
      return Math.hypot(position.x - nearestX, position.z - nearestZ) >= collisionRadius;
    });
  }

  private horizontalDistance(first: Vector3, second: Vector3): number {
    return Math.hypot(first.x - second.x, first.z - second.z);
  }

  private isInsideCone(origin: RuntimePosition, target: Vector3, directionRadians: number, halfAngleRadians: number): boolean {
    const targetDirection = Math.atan2(target.x - origin.x, target.z - origin.z);
    const difference = this.angleDifference(targetDirection, directionRadians);
    return Math.abs(difference) <= halfAngleRadians;
  }

  private angleDifference(first: number, second: number): number {
    return Math.atan2(Math.sin(first - second), Math.cos(first - second));
  }

  private material(scene: Scene, name: string, color: Color3): StandardMaterial {
    const material = new StandardMaterial(name, scene);
    material.diffuseColor = color;
    return material;
  }

  private bindInput(): void {
    if (typeof document === 'undefined') return;
    this.keyDown = (event) => this.updateKey(event, true);
    this.keyUp = (event) => this.updateKey(event, false);
    document.addEventListener('keydown', this.keyDown);
    document.addEventListener('keyup', this.keyUp);
    if (!this.canvas) return;
    this.pointerMove = (event) => {
      if (!this.camera || document.pointerLockElement !== this.canvas) return;
      this.camera.alpha -= event.movementX * this.config.input.pointerTurnSensitivity;
    };
    this.pointerDown = (event) => {
      if (event.button === 0) this.basicAttack('primary');
      if (event.button === 2) this.basicAttack('secondary');
      this.canvas?.requestPointerLock();
    };
    this.canvas.addEventListener('pointermove', this.pointerMove);
    this.canvas.addEventListener('pointerdown', this.pointerDown);
    this.contextMenu = (event) => event.preventDefault();
    this.canvas.addEventListener('contextmenu', this.contextMenu);
  }

  private unbindInput(): void {
    if (typeof document !== 'undefined') {
      if (this.keyDown) document.removeEventListener('keydown', this.keyDown);
      if (this.keyUp) document.removeEventListener('keyup', this.keyUp);
    }
    if (this.canvas && this.pointerMove) this.canvas.removeEventListener('pointermove', this.pointerMove);
    if (this.canvas && this.pointerDown) this.canvas.removeEventListener('pointerdown', this.pointerDown);
    if (this.canvas && this.contextMenu) this.canvas.removeEventListener('contextmenu', this.contextMenu);
  }

  private updateKey(event: KeyboardEvent, pressed: boolean): void {
    const key = event.key.toLowerCase();
    if (key === 'w' || key === 'a' || key === 's' || key === 'd') {
      this.pressed[key] = pressed;
      event.preventDefault();
    }
  }

  private requirePlayer(): TransformNode {
    if (!this.player) throw new Error('BabylonGameRuntime must be mounted before accessing the player.');
    return this.player;
  }
}
