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
  PLAYER1 = "player1", // Human player (Red)
  PLAYER2 = "player2", // AI (Blue)
}

export enum GameMode {
  PVE = "pve", // Player vs AI
  PVP = "pvp", // Player vs Player (legacy)
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
  lastAttackTime?: number; // timestamp of last attack for cooldown
  attackCooldown?: number; // milliseconds between attacks
}

export interface Building extends Entity {
  buildTime: number;
  isBuilding: boolean;
  lastAttackTime?: number; // for towers
  attackCooldown?: number; // for towers
}

export interface Resource extends Entity {
  amount: number;
}

// Projectile (arrows, firecrackers)
export interface Projectile {
  id: string;
  sourceId: string; // Entity that fired this projectile
  targetId: string; // Target entity
  position: Position; // Current position
  startPosition: Position; // Where it was fired from
  targetPosition: Position; // Where it's going
  damage: number;
  speed: number;
  type: "arrow" | "firework";
  createdAt: number; // timestamp
}

// Wave configuration for PvE mode
export interface WaveConfig {
  waveNumber: number;
  monsters: {
    type: EntityType;
    count: number;
    spawnDelay: number; // ms between each spawn
  }[];
  preparationTime: number; // ms before wave starts
  difficultyMultiplier: number; // health/damage multiplier
}

// AI State for managing computer-controlled side
export interface AIState {
  currentWave: number;
  waveInProgress: boolean;
  waveStartTime: number;
  monstersSpawned: number;
  monstersToSpawn: number;
  lastSpawnTime: number;
  nextWaveTime: number;
  spawnPosition: Position; // Where monsters spawn
}

export interface GameState {
  entities: Map<string, Entity>;
  projectiles: Map<string, Projectile>; // Active projectiles
  resources: {
    [PlayerSide.PLAYER1]: number;
    [PlayerSide.PLAYER2]: number;
  };
  selectedEntities: string[];
  currentPlayer: PlayerSide;
  gameMode: GameMode;
  gameStatus: "waiting" | "playing" | "ended" | "preparing"; // preparing = between waves
  winner?: PlayerSide;
  aiState: AIState;
  score: number; // Player score
  monstersKilled: number;
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
