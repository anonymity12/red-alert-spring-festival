// Core game types and enums

export enum EntityType {
  BASE = "base",
  COLLECTOR = "collector",
  TOWER = "tower",
  BARRACKS = "barracks",
  FIRECRACKER_SOLDIER = "firecracker_soldier",
  NIAN_BEAST = "nian_beast",
  RESOURCE = "resource",
}

export enum PlayerSide {
  PLAYER1 = "player1",
  PLAYER2 = "player2",
}

export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface GridPosition {
  row: number;
  col: number;
}

export interface Entity {
  id: string;
  type: EntityType;
  position: Position;
  health: number;
  maxHealth: number;
  owner?: PlayerSide;
  selected?: boolean;
}

export interface Unit extends Entity {
  speed: number;
  attack: number;
  attackRange: number;
  target?: string; // target entity id for attack
  targetPosition?: Position; // target position for movement
  collectTarget?: string; // target resource id for collection
  path?: GridPosition[];
}

export interface Building extends Entity {
  buildTime: number;
  isBuilding: boolean;
}

export interface Resource extends Entity {
  amount: number;
}

export interface GameState {
  entities: Map<string, Entity>;
  resources: {
    [PlayerSide.PLAYER1]: number;
    [PlayerSide.PLAYER2]: number;
  };
  selectedEntities: string[];
  currentPlayer: PlayerSide;
  gameStatus: "waiting" | "playing" | "ended";
  winner?: PlayerSide;
}

export interface GameAction {
  type: "move" | "attack" | "build" | "collect" | "produce";
  entityId?: string;
  targetPosition?: GridPosition;
  targetEntityId?: string;
  buildingType?: EntityType;
  unitType?: EntityType;
  player: PlayerSide;
}
