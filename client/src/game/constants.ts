import { EntityType, Position, GridPosition, WaveConfig } from "./types";

// Game constants
export const GRID_SIZE = 20; // 20x20 grid
export const TILE_SIZE = 64; // pixels per tile
export const ISO_ANGLE = Math.PI / 4; // 45 degrees for isometric view
export const LOGIC_FPS = 30; // Game logic updates per second
export const LOGIC_FRAME_TIME = 1000 / LOGIC_FPS; // ~33ms per frame

// Collision radii for each entity type (used for collision detection)
// Kept small to allow units to navigate around obstacles more easily
export const COLLISION_RADII: Record<EntityType, number> = {
  [EntityType.BASE]: 40, // Large building
  [EntityType.TOWER]: 25, // Medium building
  [EntityType.BARRACKS]: 35, // Medium-large building
  [EntityType.COLLECTOR]: 8, // Small unit
  [EntityType.FIRECRACKER_SOLDIER]: 8, // Small unit
  [EntityType.NIAN_BEAST]: 12, // Medium unit
  [EntityType.RESOURCE]: 10, // Small obstacle
};

// Entity stats
export const ENTITY_STATS = {
  [EntityType.BASE]: {
    maxHealth: 1000,
    buildTime: 0,
    cost: 0,
  },
  [EntityType.COLLECTOR]: {
    maxHealth: 50,
    speed: 2,
    attack: 0,
    attackRange: 0,
    cost: 50,
    collectRate: 5,
  },
  [EntityType.TOWER]: {
    maxHealth: 200,
    attack: 25,
    attackRange: 6, // Larger range for towers
    buildTime: 10,
    cost: 150,
    attackCooldown: 1500, // ms between attacks
  },
  [EntityType.BARRACKS]: {
    maxHealth: 300,
    buildTime: 15,
    cost: 200,
  },
  [EntityType.FIRECRACKER_SOLDIER]: {
    maxHealth: 80,
    speed: 3,
    attack: 15,
    attackRange: 4, // Ranged attack
    cost: 75,
    attackCooldown: 1000, // ms between attacks
  },
  [EntityType.NIAN_BEAST]: {
    maxHealth: 150,
    speed: 1.5,
    attack: 25,
    attackRange: 1.2, // Melee range
    cost: 0, // AI spawns these for free
    attackCooldown: 800,
  },
  [EntityType.RESOURCE]: {
    maxHealth: 100,
    amount: 500,
  },
};

// Projectile configuration
export const PROJECTILE_CONFIG = {
  arrow: {
    speed: 300, // pixels per second
    size: 8,
    color: 0xffaa00,
  },
  firework: {
    speed: 250,
    size: 12,
    color: 0xff4444,
  },
};

// Wave configurations for PvE mode
export const WAVE_CONFIGS: WaveConfig[] = [
  {
    waveNumber: 1,
    monsters: [{ type: EntityType.NIAN_BEAST, count: 3, spawnDelay: 2000 }],
    preparationTime: 10000, // 10 seconds to prepare
    difficultyMultiplier: 1.0,
  },
  {
    waveNumber: 2,
    monsters: [{ type: EntityType.NIAN_BEAST, count: 5, spawnDelay: 1800 }],
    preparationTime: 15000,
    difficultyMultiplier: 1.1,
  },
  {
    waveNumber: 3,
    monsters: [{ type: EntityType.NIAN_BEAST, count: 7, spawnDelay: 1500 }],
    preparationTime: 15000,
    difficultyMultiplier: 1.2,
  },
  {
    waveNumber: 4,
    monsters: [{ type: EntityType.NIAN_BEAST, count: 10, spawnDelay: 1200 }],
    preparationTime: 20000,
    difficultyMultiplier: 1.4,
  },
  {
    waveNumber: 5,
    monsters: [{ type: EntityType.NIAN_BEAST, count: 15, spawnDelay: 1000 }],
    preparationTime: 25000,
    difficultyMultiplier: 1.6,
  },
];

// Generate infinite waves after predefined ones
export function getWaveConfig(waveNumber: number): WaveConfig {
  if (waveNumber <= WAVE_CONFIGS.length) {
    return WAVE_CONFIGS[waveNumber - 1];
  }
  // Generate harder waves after predefined ones
  const baseCount = 15 + (waveNumber - 5) * 3;
  const spawnDelay = Math.max(500, 1000 - (waveNumber - 5) * 50);
  return {
    waveNumber,
    monsters: [{ type: EntityType.NIAN_BEAST, count: baseCount, spawnDelay }],
    preparationTime: 20000,
    difficultyMultiplier: 1.6 + (waveNumber - 5) * 0.2,
  };
}

// AI spawn position (top-right corner of map)
export const AI_SPAWN_GRID = { row: 1, col: GRID_SIZE - 2 };

// Score values
export const SCORE_VALUES = {
  monsterKill: 100,
  waveComplete: 500,
  resourceCollected: 1, // per unit of resource
};

// Convert grid position to world position (isometric)
export function gridToWorld(grid: GridPosition): Position {
  const x = (grid.col - grid.row) * (TILE_SIZE / 2);
  const z = (grid.col + grid.row) * (TILE_SIZE / 4);
  return { x, y: 0, z };
}

// Convert world position to grid position
export function worldToGrid(pos: Position): GridPosition {
  const col = Math.round(
    (pos.x / (TILE_SIZE / 2) + pos.z / (TILE_SIZE / 4)) / 2,
  );
  const row = Math.round(
    (pos.z / (TILE_SIZE / 4) - pos.x / (TILE_SIZE / 2)) / 2,
  );
  return { row, col };
}

// Check if grid position is valid
export function isValidGridPosition(grid: GridPosition): boolean {
  return (
    grid.row >= 0 &&
    grid.row < GRID_SIZE &&
    grid.col >= 0 &&
    grid.col < GRID_SIZE
  );
}

// Calculate distance between two grid positions
export function gridDistance(a: GridPosition, b: GridPosition): number {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

// Generate unique entity ID
export function generateEntityId(): string {
  return `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
