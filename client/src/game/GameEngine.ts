import {
  GameState,
  GameAction,
  Entity,
  Unit,
  Building,
  Resource,
  EntityType,
  PlayerSide
} from './types';
import {
  ENTITY_STATS,
  generateEntityId,
  gridToWorld,
  isValidGridPosition,
  GRID_SIZE
} from './constants';

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
      owner: PlayerSide.PLAYER1
    } as Building);

    const base2Id = generateEntityId();
    entities.set(base2Id, {
      id: base2Id,
      type: EntityType.BASE,
      position: gridToWorld({ row: GRID_SIZE - 3, col: GRID_SIZE - 3 }),
      health: ENTITY_STATS[EntityType.BASE].maxHealth,
      maxHealth: ENTITY_STATS[EntityType.BASE].maxHealth,
      owner: PlayerSide.PLAYER2
    } as Building);

    // Create initial resources on the map
    for (let i = 0; i < 8; i++) {
      const resourceId = generateEntityId();
      const row = Math.floor(Math.random() * GRID_SIZE);
      const col = Math.floor(Math.random() * GRID_SIZE);
      
      entities.set(resourceId, {
        id: resourceId,
        type: EntityType.RESOURCE,
        position: gridToWorld({ row, col }),
        health: ENTITY_STATS[EntityType.RESOURCE].maxHealth,
        maxHealth: ENTITY_STATS[EntityType.RESOURCE].maxHealth,
        amount: ENTITY_STATS[EntityType.RESOURCE].amount
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
      attackRange: ENTITY_STATS[EntityType.COLLECTOR].attackRange
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
      attackRange: ENTITY_STATS[EntityType.COLLECTOR].attackRange
    } as Unit);

    return {
      entities,
      resources: {
        [PlayerSide.PLAYER1]: 200,
        [PlayerSide.PLAYER2]: 200
      },
      selectedEntities: [],
      currentPlayer: PlayerSide.PLAYER1,
      gameStatus: 'playing',
    };
  }

  getState(): GameState {
    return this.state;
  }

  onUpdate(callback: (state: GameState) => void) {
    this.updateCallbacks.push(callback);
  }

  private notifyUpdate() {
    this.updateCallbacks.forEach(cb => cb(this.state));
  }

  processAction(action: GameAction): boolean {
    switch (action.type) {
      case 'move':
        return this.handleMove(action);
      case 'attack':
        return this.handleAttack(action);
      case 'build':
        return this.handleBuild(action);
      case 'produce':
        return this.handleProduce(action);
      default:
        return false;
    }
  }

  private handleMove(action: GameAction): boolean {
    if (!action.entityId || !action.targetPosition) return false;

    const entity = this.state.entities.get(action.entityId);
    if (!entity || entity.owner !== action.player) return false;

    const unit = entity as Unit;
    if (!unit.speed) return false;

    if (isValidGridPosition(action.targetPosition)) {
      unit.position = gridToWorld(action.targetPosition);
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
    this.notifyUpdate();
    return true;
  }

  private handleBuild(action: GameAction): boolean {
    if (!action.buildingType || !action.targetPosition) return false;

    const stats = ENTITY_STATS[action.buildingType];
    if (!('cost' in stats)) return false;

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
      buildTime: 'buildTime' in stats ? stats.buildTime : 0,
      isBuilding: true
    } as Building);

    this.state.resources[action.player] -= cost;
    this.notifyUpdate();
    return true;
  }

  private handleProduce(action: GameAction): boolean {
    if (!action.unitType) return false;

    const stats = ENTITY_STATS[action.unitType];
    if (!('cost' in stats)) return false;

    const cost = stats.cost;
    if (this.state.resources[action.player] < cost) return false;

    // Find a barracks owned by the player
    let barracks: Entity | undefined;
    for (const entity of this.state.entities.values()) {
      if (entity.type === EntityType.BARRACKS && entity.owner === action.player) {
        barracks = entity;
        break;
      }
    }

    if (!barracks) return false;

    const unitId = generateEntityId();

    // Spawn near the barracks
    const spawnPos = { ...barracks.position };
    spawnPos.x += 100;

    this.state.entities.set(unitId, {
      id: unitId,
      type: action.unitType,
      position: spawnPos,
      health: stats.maxHealth,
      maxHealth: stats.maxHealth,
      owner: action.player,
      speed: 'speed' in stats ? stats.speed : 0,
      attack: 'attack' in stats ? stats.attack : 0,
      attackRange: 'attackRange' in stats ? stats.attackRange : 0
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
    this.state.selectedEntities.forEach(id => {
      const entity = this.state.entities.get(id);
      if (entity) entity.selected = false;
    });
    this.state.selectedEntities = [];
    this.notifyUpdate();
  }

  update(deltaTime: number) {
    // Update game logic
    this.updateUnits(deltaTime);
    this.checkWinCondition();
    this.notifyUpdate();
  }

  private updateUnits(deltaTime: number) {
    // Update unit movements, attacks, etc.
    for (const entity of this.state.entities.values()) {
      if ('speed' in entity && 'target' in entity) {
        const unit = entity as Unit;
        if (unit.target) {
          const target = this.state.entities.get(unit.target);
          
          if (target && target.health > 0) {
            // Simple attack logic
            if (unit.attack && unit.attackRange) {
              target.health = Math.max(0, target.health - unit.attack * deltaTime * 0.1);
              
              if (target.health <= 0) {
                this.state.entities.delete(target.id);
                unit.target = undefined;
              }
            }
          } else {
            unit.target = undefined;
          }
        }
      }
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

    if (!player1Base && this.state.gameStatus === 'playing') {
      this.state.gameStatus = 'ended';
      this.state.winner = PlayerSide.PLAYER2;
    } else if (!player2Base && this.state.gameStatus === 'playing') {
      this.state.gameStatus = 'ended';
      this.state.winner = PlayerSide.PLAYER1;
    }
  }
}
