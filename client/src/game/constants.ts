import { EntityType, Position, GridPosition } from "./types";

// Game constants
export const GRID_SIZE = 20; // 20x20 grid
export const TILE_SIZE = 64; // pixels per tile
export const ISO_ANGLE = Math.PI / 4; // 45 degrees for isometric view

// Collision radii for each entity type (used for collision detection)
export const COLLISION_RADII: Record<EntityType, number> = {
  [EntityType.BASE]: 50, // Large building
  [EntityType.TOWER]: 30, // Medium building
  [EntityType.BARRACKS]: 40, // Medium-large building
  [EntityType.COLLECTOR]: 12, // Small unit
  [EntityType.FIRECRACKER_SOLDIER]: 10, // Small unit
  [EntityType.NIAN_BEAST]: 18, // Medium unit
  [EntityType.RESOURCE]: 15, // Small obstacle
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
    attack: 15,
    attackRange: 5,
    buildTime: 10,
    cost: 150,
  },
  [EntityType.BARRACKS]: {
    maxHealth: 300,
    buildTime: 15,
    cost: 200,
  },
  [EntityType.FIRECRACKER_SOLDIER]: {
    maxHealth: 80,
    speed: 3,
    attack: 10,
    attackRange: 3,
    cost: 75,
  },
  [EntityType.NIAN_BEAST]: {
    maxHealth: 150,
    speed: 2,
    attack: 20,
    attackRange: 1,
    cost: 120,
  },
  [EntityType.RESOURCE]: {
    maxHealth: 100,
    amount: 500,
  },
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
