import {
  GameState,
  GameAction,
  Entity,
  Unit,
  Building,
  Resource,
  EntityType,
  PlayerSide,
  Position,
  GameMode,
  Projectile,
} from "./types";
import {
  ENTITY_STATS,
  generateEntityId,
  gridToWorld,
  isValidGridPosition,
  GRID_SIZE,
  COLLISION_RADII,
  PROJECTILE_CONFIG,
  SCORE_VALUES,
} from "./constants";
import { AIController } from "./AIController";

export class GameEngine {
  private state: GameState;
  private updateCallbacks: ((state: GameState) => void)[] = [];
  private aiController: AIController;

  constructor() {
    this.state = this.initializeGame();
    this.aiController = new AIController(this.state);
  }

  private initializeGame(): GameState {
    const entities = new Map<string, Entity>();
    const projectiles = new Map<string, Projectile>();

    // Create player base (bottom-left area)
    const base1Id = generateEntityId();
    entities.set(base1Id, {
      id: base1Id,
      type: EntityType.BASE,
      position: gridToWorld({ row: GRID_SIZE - 4, col: 3 }),
      health: ENTITY_STATS[EntityType.BASE].maxHealth,
      maxHealth: ENTITY_STATS[EntityType.BASE].maxHealth,
      owner: PlayerSide.PLAYER1,
      buildTime: 0,
      isBuilding: false,
    } as Building);

    // Create initial resources on the map (spread across middle area)
    const resourcePositions = [
      { row: 5, col: 8 },
      { row: 8, col: 5 },
      { row: 10, col: 10 },
      { row: 7, col: 12 },
      { row: 12, col: 7 },
      { row: 14, col: 14 },
      { row: 6, col: 15 },
      { row: 15, col: 6 },
    ];

    for (const pos of resourcePositions) {
      const resourceId = generateEntityId();
      entities.set(resourceId, {
        id: resourceId,
        type: EntityType.RESOURCE,
        position: gridToWorld(pos),
        health: ENTITY_STATS[EntityType.RESOURCE].maxHealth,
        maxHealth: ENTITY_STATS[EntityType.RESOURCE].maxHealth,
        amount: ENTITY_STATS[EntityType.RESOURCE].amount,
      } as Resource);
    }

    // Create initial collector for player
    const collector1Id = generateEntityId();
    entities.set(collector1Id, {
      id: collector1Id,
      type: EntityType.COLLECTOR,
      position: gridToWorld({ row: GRID_SIZE - 3, col: 4 }),
      health: ENTITY_STATS[EntityType.COLLECTOR].maxHealth,
      maxHealth: ENTITY_STATS[EntityType.COLLECTOR].maxHealth,
      owner: PlayerSide.PLAYER1,
      speed: ENTITY_STATS[EntityType.COLLECTOR].speed,
      attack: ENTITY_STATS[EntityType.COLLECTOR].attack,
      attackRange: ENTITY_STATS[EntityType.COLLECTOR].attackRange,
    } as Unit);

    // Create a second collector
    const collector2Id = generateEntityId();
    entities.set(collector2Id, {
      id: collector2Id,
      type: EntityType.COLLECTOR,
      position: gridToWorld({ row: GRID_SIZE - 5, col: 5 }),
      health: ENTITY_STATS[EntityType.COLLECTOR].maxHealth,
      maxHealth: ENTITY_STATS[EntityType.COLLECTOR].maxHealth,
      owner: PlayerSide.PLAYER1,
      speed: ENTITY_STATS[EntityType.COLLECTOR].speed,
      attack: ENTITY_STATS[EntityType.COLLECTOR].attack,
      attackRange: ENTITY_STATS[EntityType.COLLECTOR].attackRange,
    } as Unit);

    return {
      entities,
      projectiles,
      resources: {
        [PlayerSide.PLAYER1]: 500, // Starting resources
        [PlayerSide.PLAYER2]: 0, // AI doesn't need resources
      },
      selectedEntities: [],
      currentPlayer: PlayerSide.PLAYER1,
      gameMode: GameMode.PVE,
      gameStatus: "preparing", // Start in preparation phase
      aiState: AIController.createInitialState(),
      score: 0,
      monstersKilled: 0,
    };
  }

  getState(): GameState {
    return this.state;
  }

  getAIController(): AIController {
    return this.aiController;
  }

  onUpdate(callback: (state: GameState) => void) {
    this.updateCallbacks.push(callback);
  }

  private notifyUpdate() {
    this.updateCallbacks.forEach((cb) => cb(this.state));
  }

  processAction(action: GameAction): boolean {
    switch (action.type) {
      case "move":
        return this.handleMove(action);
      case "attack":
        return this.handleAttack(action);
      case "build":
        return this.handleBuild(action);
      case "produce":
        return this.handleProduce(action);
      case "collect":
        return this.handleCollect(action);
      default:
        return false;
    }
  }

  private handleMove(action: GameAction): boolean {
    if (!action.entityId || !action.targetPosition) return false;

    const entity = this.state.entities.get(action.entityId);
    if (!entity || entity.owner !== action.player) return false;

    const unit = entity as Unit;
    if (unit.speed === undefined) return false;

    if (isValidGridPosition(action.targetPosition)) {
      // Convert grid position to world position
      const worldTarget = gridToWorld(action.targetPosition);

      // Set target position - the movement algorithm will handle obstacles
      // Try to find a nearby valid position, but always accept the command
      const validTarget = this.findValidPosition(unit, worldTarget);
      unit.targetPosition = validTarget || worldTarget;

      // Clear attack and collect targets when moving
      unit.target = undefined;
      unit.collectTarget = undefined;
      this.notifyUpdate();
      return true;
    }

    return false;
  }

  private handleAttack(action: GameAction): boolean {
    if (!action.entityId || !action.targetEntityId) return false;

    const attacker = this.state.entities.get(action.entityId) as Unit;
    const target = this.state.entities.get(action.targetEntityId);

    if (!attacker || !target || attacker.owner === target.owner) return false;

    attacker.target = action.targetEntityId;
    // Clear collect target and move towards attack target
    attacker.collectTarget = undefined;
    attacker.targetPosition = { ...target.position };
    this.notifyUpdate();
    return true;
  }

  private handleCollect(action: GameAction): boolean {
    if (!action.entityId || !action.targetEntityId) return false;

    const collector = this.state.entities.get(action.entityId) as Unit;
    const resource = this.state.entities.get(action.targetEntityId) as Resource;

    if (!collector || !resource) return false;
    if (collector.type !== EntityType.COLLECTOR) return false;
    if (resource.type !== EntityType.RESOURCE) return false;

    // Set collect target and move towards resource
    collector.collectTarget = action.targetEntityId;
    collector.target = undefined; // Clear attack target
    collector.targetPosition = { ...resource.position };
    this.notifyUpdate();
    return true;
  }

  private handleBuild(action: GameAction): boolean {
    if (!action.buildingType || !action.targetPosition) return false;

    const stats = ENTITY_STATS[action.buildingType];
    if (!("cost" in stats)) return false;

    const cost = stats.cost;
    if (this.state.resources[action.player] < cost) return false;

    if (!isValidGridPosition(action.targetPosition)) return false;

    // Check if the build location is blocked by existing entities
    const buildPos = gridToWorld(action.targetPosition);
    const buildRadius = COLLISION_RADII[action.buildingType] || 40;

    for (const entity of this.state.entities.values()) {
      const entityRadius = COLLISION_RADII[entity.type] || 20;
      const distance = this.distanceBetween(buildPos, entity.position);
      if (distance < buildRadius + entityRadius) {
        // Location blocked by existing entity
        return false;
      }
    }

    const buildingId = generateEntityId();

    const building: Building = {
      id: buildingId,
      type: action.buildingType,
      position: buildPos,
      health: stats.maxHealth,
      maxHealth: stats.maxHealth,
      owner: action.player,
      buildTime: "buildTime" in stats ? stats.buildTime : 0,
      isBuilding: false, // Instant build for now
      lastAttackTime: 0,
      attackCooldown: "attackCooldown" in stats ? stats.attackCooldown : 1500,
    };

    this.state.entities.set(buildingId, building);
    this.state.resources[action.player] -= cost;
    this.notifyUpdate();
    return true;
  }

  private handleProduce(action: GameAction): boolean {
    if (!action.unitType) return false;

    const stats = ENTITY_STATS[action.unitType];
    if (!("cost" in stats)) return false;

    const cost = stats.cost;
    if (this.state.resources[action.player] < cost) return false;

    // Find a barracks owned by the player (for soldiers/beasts)
    // Collectors can be produced from base
    let spawnBuilding: Entity | undefined;

    if (action.unitType === EntityType.COLLECTOR) {
      // Collectors spawn from base
      for (const entity of this.state.entities.values()) {
        if (entity.type === EntityType.BASE && entity.owner === action.player) {
          spawnBuilding = entity;
          break;
        }
      }
    } else {
      // Other units spawn from barracks
      for (const entity of this.state.entities.values()) {
        if (
          entity.type === EntityType.BARRACKS &&
          entity.owner === action.player
        ) {
          spawnBuilding = entity;
          break;
        }
      }
      // Fallback to base if no barracks
      if (!spawnBuilding) {
        for (const entity of this.state.entities.values()) {
          if (
            entity.type === EntityType.BASE &&
            entity.owner === action.player
          ) {
            spawnBuilding = entity;
            break;
          }
        }
      }
    }

    if (!spawnBuilding) return false;

    const unitId = generateEntityId();

    // Find a valid spawn position near the building (not colliding with anything)
    const spawnPos = this.findSpawnPosition(spawnBuilding.position);

    const unit: Unit = {
      id: unitId,
      type: action.unitType,
      position: spawnPos,
      health: stats.maxHealth,
      maxHealth: stats.maxHealth,
      owner: action.player,
      speed: "speed" in stats ? stats.speed : 0,
      attack: "attack" in stats ? stats.attack : 0,
      attackRange: "attackRange" in stats ? stats.attackRange : 0,
      attackCooldown: "attackCooldown" in stats ? stats.attackCooldown : 1000,
      lastAttackTime: 0,
    };

    this.state.entities.set(unitId, unit);
    this.state.resources[action.player] -= cost;
    this.notifyUpdate();
    return true;
  }

  selectEntity(entityId: string) {
    const entity = this.state.entities.get(entityId);
    if (entity) {
      entity.selected = true;
      if (!this.state.selectedEntities.includes(entityId)) {
        this.state.selectedEntities.push(entityId);
      }
      this.notifyUpdate();
    }
  }

  deselectAll() {
    this.state.selectedEntities.forEach((id) => {
      const entity = this.state.entities.get(id);
      if (entity) entity.selected = false;
    });
    this.state.selectedEntities = [];
    this.notifyUpdate();
  }

  update(deltaTime: number) {
    if (this.state.gameStatus === "ended") return;

    const currentTime = Date.now();

    // Update AI (handles wave spawning and monster behavior)
    if (this.state.gameMode === GameMode.PVE) {
      this.aiController.update(currentTime);

      // Switch from preparing to playing when wave starts
      if (
        this.state.aiState.waveInProgress &&
        this.state.gameStatus === "preparing"
      ) {
        this.state.gameStatus = "playing";
      }
    }

    // Update game logic
    this.updateUnits(deltaTime, currentTime);
    this.updateTowers(currentTime);
    this.updateProjectiles(deltaTime);
    this.checkWinCondition();
  }

  private distanceBetween(a: Position, b: Position): number {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  /**
   * Check if a position would collide with any entity
   */
  private checkCollision(
    pos: Position,
    radius: number,
    excludeId: string,
    allowedTargetId?: string,
  ): Entity | null {
    for (const entity of this.state.entities.values()) {
      if (entity.id === excludeId) continue;
      if (allowedTargetId && entity.id === allowedTargetId) continue;

      const entityRadius = COLLISION_RADII[entity.type] || 20;
      const distance = this.distanceBetween(pos, entity.position);
      const minDistance = radius + entityRadius;

      if (distance < minDistance) {
        return entity;
      }
    }
    return null;
  }

  /**
   * Find a valid position near the target that doesn't collide with obstacles
   * Uses a spiral pattern to find the closest valid position
   */
  private findValidPosition(unit: Unit, target: Position): Position | null {
    const unitRadius = COLLISION_RADII[unit.type] || 8;
    const allowedTarget = unit.target || unit.collectTarget;

    // First check if target itself is valid
    if (!this.checkCollision(target, unitRadius, unit.id, allowedTarget)) {
      return target;
    }

    // Try positions in expanding circles around the target
    const distances = [25, 40, 60, 80];
    const angleSteps = 12; // Try 12 directions (every 30 degrees)

    for (const dist of distances) {
      for (let i = 0; i < angleSteps; i++) {
        const angle = (i * 2 * Math.PI) / angleSteps;
        const testPos: Position = {
          x: target.x + Math.cos(angle) * dist,
          y: target.y,
          z: target.z + Math.sin(angle) * dist,
        };

        if (!this.checkCollision(testPos, unitRadius, unit.id, allowedTarget)) {
          return testPos;
        }
      }
    }

    // If no valid position found, return the target anyway
    // The unit will navigate around obstacles during movement
    return target;
  }

  private moveTowards(
    unit: Unit,
    target: Position,
    deltaTime: number,
  ): boolean {
    const distance = this.distanceBetween(unit.position, target);
    const moveSpeed = unit.speed * 50;
    const unitRadius = COLLISION_RADII[unit.type] || 12;
    const allowedTarget = unit.target || unit.collectTarget;

    // Close enough to target
    if (distance < 5) {
      unit.position.x = target.x;
      unit.position.z = target.z;
      return true;
    }

    // Calculate direction to target
    const dx = target.x - unit.position.x;
    const dz = target.z - unit.position.z;
    const len = Math.sqrt(dx * dx + dz * dz);
    const dirX = dx / len;
    const dirZ = dz / len;

    const moveAmount = moveSpeed * deltaTime;

    // Try direct movement first
    const newPos: Position = {
      x: unit.position.x + dirX * moveAmount,
      y: unit.position.y,
      z: unit.position.z + dirZ * moveAmount,
    };

    if (!this.checkCollision(newPos, unitRadius, unit.id, allowedTarget)) {
      unit.position.x = newPos.x;
      unit.position.z = newPos.z;
      return false;
    }

    // Direct path blocked - try multiple angles to find a way around
    // Try angles from small to large, alternating left and right
    const angles = [
      15, -15, 30, -30, 45, -45, 60, -60, 75, -75, 90, -90, 105, -105, 120,
      -120, 135, -135, 150, -150,
    ];

    for (const angleDeg of angles) {
      const angleRad = (angleDeg * Math.PI) / 180;
      const cos = Math.cos(angleRad);
      const sin = Math.sin(angleRad);

      // Rotate direction vector
      const rotatedDirX = dirX * cos - dirZ * sin;
      const rotatedDirZ = dirX * sin + dirZ * cos;

      const testPos: Position = {
        x: unit.position.x + rotatedDirX * moveAmount,
        y: unit.position.y,
        z: unit.position.z + rotatedDirZ * moveAmount,
      };

      if (!this.checkCollision(testPos, unitRadius, unit.id, allowedTarget)) {
        // Check if this direction gets us closer or at least not further from target
        const newDist = this.distanceBetween(testPos, target);
        // Allow movement even if slightly further, to help escape tight spots
        if (newDist < distance + moveAmount * 2) {
          unit.position.x = testPos.x;
          unit.position.z = testPos.z;
          return false;
        }
      }
    }

    // All angles blocked - try a smaller step
    const smallerStep = moveAmount * 0.3;
    for (const angleDeg of [0, 45, -45, 90, -90, 135, -135, 180]) {
      const angleRad = (angleDeg * Math.PI) / 180;
      const cos = Math.cos(angleRad);
      const sin = Math.sin(angleRad);

      const rotatedDirX = dirX * cos - dirZ * sin;
      const rotatedDirZ = dirX * sin + dirZ * cos;

      const testPos: Position = {
        x: unit.position.x + rotatedDirX * smallerStep,
        y: unit.position.y,
        z: unit.position.z + rotatedDirZ * smallerStep,
      };

      if (!this.checkCollision(testPos, unitRadius, unit.id, allowedTarget)) {
        unit.position.x = testPos.x;
        unit.position.z = testPos.z;
        return false;
      }
    }

    // Completely stuck - don't clear target, keep trying next frame
    // The unit might get unstuck if other units move
    return false;
  }

  /**
   * Create a projectile from attacker to target
   */
  private createProjectile(
    sourceId: string,
    targetId: string,
    sourcePos: Position,
    targetPos: Position,
    damage: number,
    type: "arrow" | "firework",
  ): void {
    const projectileId = generateEntityId();
    const config = PROJECTILE_CONFIG[type];

    const projectile: Projectile = {
      id: projectileId,
      sourceId,
      targetId,
      position: { ...sourcePos, y: 30 }, // Start slightly elevated
      startPosition: { ...sourcePos, y: 30 },
      targetPosition: { ...targetPos, y: 20 },
      damage,
      speed: config.speed,
      type,
      createdAt: Date.now(),
    };

    this.state.projectiles.set(projectileId, projectile);
  }

  /**
   * Update all projectiles
   */
  private updateProjectiles(deltaTime: number): void {
    const projectilesToRemove: string[] = [];

    for (const projectile of this.state.projectiles.values()) {
      const target = this.state.entities.get(projectile.targetId);

      // If target is gone, remove projectile
      if (!target) {
        projectilesToRemove.push(projectile.id);
        continue;
      }

      // Update target position (in case target moved)
      projectile.targetPosition = { ...target.position, y: 20 };

      // Move projectile towards target
      const dx = projectile.targetPosition.x - projectile.position.x;
      const dy = projectile.targetPosition.y - projectile.position.y;
      const dz = projectile.targetPosition.z - projectile.position.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (distance < 15) {
        // Hit target
        target.health -= projectile.damage;

        // Check if target died
        if (target.health <= 0) {
          // Award score for killing monsters
          if (target.owner === PlayerSide.PLAYER2) {
            this.state.score += SCORE_VALUES.monsterKill;
            this.state.monstersKilled++;
          }
          this.state.entities.delete(target.id);
        }

        projectilesToRemove.push(projectile.id);
        continue;
      }

      // Move projectile
      const moveAmount = projectile.speed * deltaTime;
      projectile.position.x += (dx / distance) * moveAmount;
      projectile.position.y += (dy / distance) * moveAmount;
      projectile.position.z += (dz / distance) * moveAmount;

      // Timeout check (remove if taking too long)
      if (Date.now() - projectile.createdAt > 5000) {
        projectilesToRemove.push(projectile.id);
      }
    }

    for (const id of projectilesToRemove) {
      this.state.projectiles.delete(id);
    }
  }

  /**
   * Update tower attacks
   */
  private updateTowers(currentTime: number): void {
    for (const entity of this.state.entities.values()) {
      if (entity.type !== EntityType.TOWER) continue;
      if (entity.owner !== PlayerSide.PLAYER1) continue;

      const tower = entity as Building;
      const stats = ENTITY_STATS[EntityType.TOWER];
      const attackRange = (stats.attackRange || 6) * 32;
      const cooldown = tower.attackCooldown || stats.attackCooldown || 1500;

      // Check cooldown
      if (currentTime - (tower.lastAttackTime || 0) < cooldown) continue;

      // Find nearest enemy in range
      let nearestEnemy: Entity | null = null;
      let nearestDistance = Infinity;

      for (const target of this.state.entities.values()) {
        if (target.owner !== PlayerSide.PLAYER2) continue;
        if (!("speed" in target)) continue; // Only target units

        const distance = this.distanceBetween(tower.position, target.position);
        if (distance <= attackRange && distance < nearestDistance) {
          nearestDistance = distance;
          nearestEnemy = target;
        }
      }

      if (nearestEnemy) {
        // Fire projectile
        this.createProjectile(
          tower.id,
          nearestEnemy.id,
          tower.position,
          nearestEnemy.position,
          stats.attack || 25,
          "arrow",
        );
        tower.lastAttackTime = currentTime;
      }
    }
  }

  private updateUnits(deltaTime: number, currentTime: number) {
    const entitiesToRemove: string[] = [];

    for (const entity of this.state.entities.values()) {
      if (!("speed" in entity)) continue;

      const unit = entity as Unit;

      // Handle collection (player collectors only)
      if (unit.collectTarget && unit.owner === PlayerSide.PLAYER1) {
        const resource = this.state.entities.get(
          unit.collectTarget,
        ) as Resource;

        if (resource && resource.amount > 0) {
          const distance = this.distanceBetween(
            unit.position,
            resource.position,
          );

          if (distance < 30) {
            const collectRate =
              ENTITY_STATS[EntityType.COLLECTOR].collectRate || 5;
            const collected = Math.min(
              collectRate * deltaTime,
              resource.amount,
            );

            resource.amount -= collected;

            if (unit.owner) {
              this.state.resources[unit.owner] += collected;
              this.state.score += Math.floor(
                collected * SCORE_VALUES.resourceCollected,
              );
            }

            if (resource.amount <= 0) {
              entitiesToRemove.push(resource.id);
              unit.collectTarget = undefined;
              unit.targetPosition = undefined;
            }
          } else {
            this.moveTowards(unit, resource.position, deltaTime);
          }
        } else {
          unit.collectTarget = undefined;
          unit.targetPosition = undefined;
        }
        continue;
      }

      // Handle attack
      if (unit.target) {
        const target = this.state.entities.get(unit.target);

        if (target && target.health > 0) {
          const distance = this.distanceBetween(unit.position, target.position);
          const attackRange = (unit.attackRange || 1) * 32;
          const cooldown = unit.attackCooldown || 1000;

          if (distance <= attackRange) {
            // In range - check cooldown for ranged attack
            if (currentTime - (unit.lastAttackTime || 0) >= cooldown) {
              if (unit.attackRange > 1.5) {
                // Ranged attack - fire projectile
                const projectileType =
                  unit.owner === PlayerSide.PLAYER1 ? "firework" : "arrow";
                this.createProjectile(
                  unit.id,
                  target.id,
                  unit.position,
                  target.position,
                  unit.attack,
                  projectileType,
                );
              } else {
                // Melee attack - direct damage
                target.health -= unit.attack;

                if (target.health <= 0) {
                  if (target.owner === PlayerSide.PLAYER2) {
                    this.state.score += SCORE_VALUES.monsterKill;
                    this.state.monstersKilled++;
                  }
                  entitiesToRemove.push(target.id);
                  unit.target = undefined;
                  unit.targetPosition = undefined;
                }
              }
              unit.lastAttackTime = currentTime;
            }
          } else {
            // Move towards target
            this.moveTowards(unit, target.position, deltaTime);
          }
        } else {
          unit.target = undefined;
          unit.targetPosition = undefined;
        }
        continue;
      }

      // Handle movement (no attack or collect target)
      if (unit.targetPosition) {
        const arrived = this.moveTowards(unit, unit.targetPosition, deltaTime);
        if (arrived) {
          unit.targetPosition = undefined;
        }
      }
    }

    for (const id of entitiesToRemove) {
      this.state.entities.delete(id);
    }
  }

  /**
   * Find a valid spawn position near a building
   */
  private findSpawnPosition(buildingPos: Position): Position {
    const spawnOffsets = [
      { x: 60, z: 60 },
      { x: 60, z: 0 },
      { x: 0, z: 60 },
      { x: -60, z: 60 },
      { x: 60, z: -60 },
      { x: 80, z: 80 },
      { x: -60, z: 0 },
      { x: 0, z: -60 },
    ];

    const testRadius = 12;

    for (const offset of spawnOffsets) {
      const testPos: Position = {
        x: buildingPos.x + offset.x,
        y: 0,
        z: buildingPos.z + offset.z,
      };

      let collision = false;
      for (const entity of this.state.entities.values()) {
        const entityRadius = COLLISION_RADII[entity.type] || 20;
        const distance = this.distanceBetween(testPos, entity.position);
        if (distance < testRadius + entityRadius) {
          collision = true;
          break;
        }
      }

      if (!collision) {
        return testPos;
      }
    }

    return {
      x: buildingPos.x + 60,
      y: 0,
      z: buildingPos.z + 60,
    };
  }

  private checkWinCondition() {
    // In PvE mode, player loses if their base is destroyed
    let playerBase = false;

    for (const entity of this.state.entities.values()) {
      if (
        entity.type === EntityType.BASE &&
        entity.owner === PlayerSide.PLAYER1
      ) {
        playerBase = true;
        break;
      }
    }

    if (!playerBase && this.state.gameStatus !== "ended") {
      this.state.gameStatus = "ended";
      this.state.winner = PlayerSide.PLAYER2; // AI wins
      console.log("Game Over! Your base was destroyed.");
    }
  }
}
