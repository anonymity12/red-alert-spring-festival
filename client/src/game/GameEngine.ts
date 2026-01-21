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
} from "./types";
import {
  ENTITY_STATS,
  generateEntityId,
  gridToWorld,
  isValidGridPosition,
  GRID_SIZE,
  COLLISION_RADII,
} from "./constants";

export class GameEngine {
  private state: GameState;
  private updateCallbacks: ((state: GameState) => void)[] = [];

  constructor() {
    this.state = this.initializeGame();
  }

  private initializeGame(): GameState {
    const entities = new Map<string, Entity>();

    // Create bases for both players
    const base1Id = generateEntityId();
    entities.set(base1Id, {
      id: base1Id,
      type: EntityType.BASE,
      position: gridToWorld({ row: 2, col: 2 }),
      health: ENTITY_STATS[EntityType.BASE].maxHealth,
      maxHealth: ENTITY_STATS[EntityType.BASE].maxHealth,
      owner: PlayerSide.PLAYER1,
    } as Building);

    const base2Id = generateEntityId();
    entities.set(base2Id, {
      id: base2Id,
      type: EntityType.BASE,
      position: gridToWorld({ row: GRID_SIZE - 3, col: GRID_SIZE - 3 }),
      health: ENTITY_STATS[EntityType.BASE].maxHealth,
      maxHealth: ENTITY_STATS[EntityType.BASE].maxHealth,
      owner: PlayerSide.PLAYER2,
    } as Building);

    // Create initial resources on the map
    for (let i = 0; i < 8; i++) {
      const resourceId = generateEntityId();
      // Spread resources across the map but avoid corners
      const row = 3 + Math.floor(Math.random() * (GRID_SIZE - 6));
      const col = 3 + Math.floor(Math.random() * (GRID_SIZE - 6));

      entities.set(resourceId, {
        id: resourceId,
        type: EntityType.RESOURCE,
        position: gridToWorld({ row, col }),
        health: ENTITY_STATS[EntityType.RESOURCE].maxHealth,
        maxHealth: ENTITY_STATS[EntityType.RESOURCE].maxHealth,
        amount: ENTITY_STATS[EntityType.RESOURCE].amount,
      } as Resource);
    }

    // Create initial collector units for both players
    const collector1Id = generateEntityId();
    entities.set(collector1Id, {
      id: collector1Id,
      type: EntityType.COLLECTOR,
      position: gridToWorld({ row: 5, col: 4 }),
      health: ENTITY_STATS[EntityType.COLLECTOR].maxHealth,
      maxHealth: ENTITY_STATS[EntityType.COLLECTOR].maxHealth,
      owner: PlayerSide.PLAYER1,
      speed: ENTITY_STATS[EntityType.COLLECTOR].speed,
      attack: ENTITY_STATS[EntityType.COLLECTOR].attack,
      attackRange: ENTITY_STATS[EntityType.COLLECTOR].attackRange,
    } as Unit);

    const collector2Id = generateEntityId();
    entities.set(collector2Id, {
      id: collector2Id,
      type: EntityType.COLLECTOR,
      position: gridToWorld({ row: GRID_SIZE - 4, col: GRID_SIZE - 4 }),
      health: ENTITY_STATS[EntityType.COLLECTOR].maxHealth,
      maxHealth: ENTITY_STATS[EntityType.COLLECTOR].maxHealth,
      owner: PlayerSide.PLAYER2,
      speed: ENTITY_STATS[EntityType.COLLECTOR].speed,
      attack: ENTITY_STATS[EntityType.COLLECTOR].attack,
      attackRange: ENTITY_STATS[EntityType.COLLECTOR].attackRange,
    } as Unit);

    return {
      entities,
      resources: {
        [PlayerSide.PLAYER1]: 2000,
        [PlayerSide.PLAYER2]: 2000,
      },
      selectedEntities: [],
      currentPlayer: PlayerSide.PLAYER1,
      gameStatus: "playing",
    };
  }

  getState(): GameState {
    return this.state;
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

      // Find a valid position that doesn't collide with obstacles
      const validTarget = this.findValidPosition(unit, worldTarget);

      if (validTarget) {
        // Set target position for gradual movement (don't teleport!)
        unit.targetPosition = validTarget;
        // Clear attack and collect targets when moving
        unit.target = undefined;
        unit.collectTarget = undefined;
        this.notifyUpdate();
        return true;
      }

      // No valid position found - can't move there
      return false;
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

    this.state.entities.set(buildingId, {
      id: buildingId,
      type: action.buildingType,
      position: gridToWorld(action.targetPosition),
      health: stats.maxHealth,
      maxHealth: stats.maxHealth,
      owner: action.player,
      buildTime: "buildTime" in stats ? stats.buildTime : 0,
      isBuilding: true,
    } as Building);

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
    }

    if (!spawnBuilding) return false;

    const unitId = generateEntityId();

    // Find a valid spawn position near the building (not colliding with anything)
    const spawnPos = this.findSpawnPosition(spawnBuilding.position);

    this.state.entities.set(unitId, {
      id: unitId,
      type: action.unitType,
      position: spawnPos,
      health: stats.maxHealth,
      maxHealth: stats.maxHealth,
      owner: action.player,
      speed: "speed" in stats ? stats.speed : 0,
      attack: "attack" in stats ? stats.attack : 0,
      attackRange: "attackRange" in stats ? stats.attackRange : 0,
    } as Unit);

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
    if (this.state.gameStatus !== "playing") return;

    // Update game logic
    this.updateUnits(deltaTime);
    this.checkWinCondition();
  }

  private distanceBetween(a: Position, b: Position): number {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  /**
   * Check if a position would collide with any entity
   * @param pos The position to check
   * @param radius The collision radius of the moving entity
   * @param excludeId Entity ID to exclude from collision check (usually the moving unit itself)
   * @param allowedTargetId Entity ID that is allowed to collide (e.g., attack target or collect target)
   * @returns The entity that would be collided with, or null if no collision
   */
  private checkCollision(
    pos: Position,
    radius: number,
    excludeId: string,
    allowedTargetId?: string,
  ): Entity | null {
    for (const entity of this.state.entities.values()) {
      // Skip the moving entity itself
      if (entity.id === excludeId) continue;

      // Skip allowed target (e.g., resource being collected or enemy being attacked)
      if (allowedTargetId && entity.id === allowedTargetId) continue;

      // Get collision radius for this entity
      const entityRadius = COLLISION_RADII[entity.type] || 20;

      // Calculate distance between positions
      const distance = this.distanceBetween(pos, entity.position);

      // Check if circles overlap (collision)
      const minDistance = radius + entityRadius;
      if (distance < minDistance) {
        return entity;
      }
    }
    return null;
  }

  /**
   * Find a valid position near the target that doesn't collide with obstacles
   * @param unit The moving unit
   * @param target The desired target position
   * @returns A valid position or null if completely blocked
   */
  private findValidPosition(unit: Unit, target: Position): Position | null {
    const unitRadius = COLLISION_RADII[unit.type] || 12;
    const allowedTarget = unit.target || unit.collectTarget;

    // First check if target itself is valid
    if (!this.checkCollision(target, unitRadius, unit.id, allowedTarget)) {
      return target;
    }

    // Try positions around the target in a circle
    const offsets = [
      { x: 0, z: -40 },
      { x: 40, z: 0 },
      { x: 0, z: 40 },
      { x: -40, z: 0 },
      { x: 30, z: -30 },
      { x: 30, z: 30 },
      { x: -30, z: 30 },
      { x: -30, z: -30 },
    ];

    for (const offset of offsets) {
      const testPos: Position = {
        x: target.x + offset.x,
        y: target.y,
        z: target.z + offset.z,
      };
      if (!this.checkCollision(testPos, unitRadius, unit.id, allowedTarget)) {
        return testPos;
      }
    }

    // If all positions are blocked, stay where we are
    return null;
  }

  private moveTowards(
    unit: Unit,
    target: Position,
    deltaTime: number,
  ): boolean {
    const distance = this.distanceBetween(unit.position, target);
    const moveSpeed = unit.speed * 50; // Scale speed for visual movement
    const unitRadius = COLLISION_RADII[unit.type] || 12;
    const allowedTarget = unit.target || unit.collectTarget;

    if (distance < 5) {
      // Close enough, stop moving
      unit.position.x = target.x;
      unit.position.z = target.z;
      return true; // Arrived
    }

    // Calculate direction and potential new position
    const dx = target.x - unit.position.x;
    const dz = target.z - unit.position.z;
    const len = Math.sqrt(dx * dx + dz * dz);

    const moveX = (dx / len) * moveSpeed * deltaTime;
    const moveZ = (dz / len) * moveSpeed * deltaTime;

    const newPos: Position = {
      x: unit.position.x + moveX,
      y: unit.position.y,
      z: unit.position.z + moveZ,
    };

    // Check for collision at new position
    const collision = this.checkCollision(
      newPos,
      unitRadius,
      unit.id,
      allowedTarget,
    );

    if (!collision) {
      // No collision, move normally
      unit.position.x = newPos.x;
      unit.position.z = newPos.z;
      return false; // Still moving
    }

    // Collision detected - try to slide along the obstacle
    // Try moving only in X direction
    const slideX: Position = {
      x: unit.position.x + moveX,
      y: unit.position.y,
      z: unit.position.z,
    };
    if (!this.checkCollision(slideX, unitRadius, unit.id, allowedTarget)) {
      unit.position.x = slideX.x;
      return false;
    }

    // Try moving only in Z direction
    const slideZ: Position = {
      x: unit.position.x,
      y: unit.position.y,
      z: unit.position.z + moveZ,
    };
    if (!this.checkCollision(slideZ, unitRadius, unit.id, allowedTarget)) {
      unit.position.z = slideZ.z;
      return false;
    }

    // Completely blocked - stop here
    // Clear target position since we can't reach it
    unit.targetPosition = undefined;
    return true; // Treat as arrived (blocked)
  }

  private updateUnits(deltaTime: number) {
    const entitiesToRemove: string[] = [];

    for (const entity of this.state.entities.values()) {
      // Check if it's a unit (has speed)
      if (!("speed" in entity)) continue;

      const unit = entity as Unit;

      // Handle collection
      if (unit.collectTarget) {
        const resource = this.state.entities.get(
          unit.collectTarget,
        ) as Resource;

        if (resource && resource.amount > 0) {
          const distance = this.distanceBetween(
            unit.position,
            resource.position,
          );

          if (distance < 30) {
            // Close enough to collect
            const collectRate =
              ENTITY_STATS[EntityType.COLLECTOR].collectRate || 5;
            const collected = Math.min(
              collectRate * deltaTime,
              resource.amount,
            );

            resource.amount -= collected;

            if (unit.owner) {
              this.state.resources[unit.owner] += collected;
            }

            // Resource depleted
            if (resource.amount <= 0) {
              entitiesToRemove.push(resource.id);
              unit.collectTarget = undefined;
              unit.targetPosition = undefined;
            }
          } else {
            // Move towards resource
            this.moveTowards(unit, resource.position, deltaTime);
          }
        } else {
          // Resource gone
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
          const attackRange = (unit.attackRange || 1) * 32; // Scale attack range

          if (distance <= attackRange) {
            // In range - attack
            if (unit.attack) {
              target.health = Math.max(
                0,
                target.health - unit.attack * deltaTime,
              );

              if (target.health <= 0) {
                entitiesToRemove.push(target.id);
                unit.target = undefined;
                unit.targetPosition = undefined;
              }
            }
          } else {
            // Move towards target
            this.moveTowards(unit, target.position, deltaTime);
          }
        } else {
          // Target gone
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

    // Remove dead/depleted entities
    for (const id of entitiesToRemove) {
      this.state.entities.delete(id);
    }
  }

  /**
   * Find a valid spawn position near a building that doesn't collide with other entities
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

    const testRadius = 12; // Approximate unit radius

    for (const offset of spawnOffsets) {
      const testPos: Position = {
        x: buildingPos.x + offset.x,
        y: 0,
        z: buildingPos.z + offset.z,
      };

      // Check if this position is free (no collisions)
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

    // Fallback: return default offset position
    return {
      x: buildingPos.x + 60,
      y: 0,
      z: buildingPos.z + 60,
    };
  }

  private checkWinCondition() {
    let player1Base = false;
    let player2Base = false;

    for (const entity of this.state.entities.values()) {
      if (entity.type === EntityType.BASE) {
        if (entity.owner === PlayerSide.PLAYER1) player1Base = true;
        if (entity.owner === PlayerSide.PLAYER2) player2Base = true;
      }
    }

    if (!player1Base && this.state.gameStatus === "playing") {
      this.state.gameStatus = "ended";
      this.state.winner = PlayerSide.PLAYER2;
    } else if (!player2Base && this.state.gameStatus === "playing") {
      this.state.gameStatus = "ended";
      this.state.winner = PlayerSide.PLAYER1;
    }
  }
}
