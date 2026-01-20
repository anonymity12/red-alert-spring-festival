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
      position: gridToWorld({ row: 3, col: 3 }),
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
      // Set target position for gradual movement (don't teleport!)
      unit.targetPosition = gridToWorld(action.targetPosition);
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

    // Spawn near the building
    const spawnPos = { ...spawnBuilding.position };
    spawnPos.x += 50;
    spawnPos.z += 50;

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

  private moveTowards(
    unit: Unit,
    target: Position,
    deltaTime: number,
  ): boolean {
    const distance = this.distanceBetween(unit.position, target);
    const moveSpeed = unit.speed * 50; // Scale speed for visual movement

    if (distance < 5) {
      // Close enough, stop moving
      unit.position.x = target.x;
      unit.position.z = target.z;
      return true; // Arrived
    }

    // Calculate direction and move
    const dx = target.x - unit.position.x;
    const dz = target.z - unit.position.z;
    const len = Math.sqrt(dx * dx + dz * dz);

    unit.position.x += (dx / len) * moveSpeed * deltaTime;
    unit.position.z += (dz / len) * moveSpeed * deltaTime;

    return false; // Still moving
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
