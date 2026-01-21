import {
  GameState,
  Entity,
  Unit,
  EntityType,
  PlayerSide,
  Position,
  AIState,
} from "./types";
import {
  ENTITY_STATS,
  generateEntityId,
  gridToWorld,
  getWaveConfig,
  AI_SPAWN_GRID,
  COLLISION_RADII,
} from "./constants";

export class AIController {
  private gameState: GameState;

  constructor(gameState: GameState) {
    this.gameState = gameState;
  }

  /**
   * Initialize AI state for a new game
   */
  static createInitialState(): AIState {
    return {
      currentWave: 0,
      waveInProgress: false,
      waveStartTime: 0,
      monstersSpawned: 0,
      monstersToSpawn: 0,
      lastSpawnTime: 0,
      nextWaveTime: Date.now() + 5000, // First wave starts after 5 seconds
      spawnPosition: gridToWorld(AI_SPAWN_GRID),
    };
  }

  /**
   * Update AI logic - call this every logic frame
   */
  update(currentTime: number): void {
    const ai = this.gameState.aiState;

    // Check if we should start a new wave
    if (!ai.waveInProgress && currentTime >= ai.nextWaveTime) {
      this.startNextWave(currentTime);
    }

    // Spawn monsters during wave
    if (ai.waveInProgress) {
      this.updateWaveSpawning(currentTime);
    }

    // Update monster behavior (move towards player base, attack)
    this.updateMonsterBehavior();
  }

  /**
   * Start the next wave of monsters
   */
  private startNextWave(currentTime: number): void {
    const ai = this.gameState.aiState;
    ai.currentWave++;
    ai.waveInProgress = true;
    ai.waveStartTime = currentTime;
    ai.monstersSpawned = 0;
    ai.lastSpawnTime = 0;

    const waveConfig = getWaveConfig(ai.currentWave);

    // Calculate total monsters to spawn
    ai.monstersToSpawn = waveConfig.monsters.reduce(
      (total, m) => total + m.count,
      0,
    );

    console.log(
      `Wave ${ai.currentWave} starting! Spawning ${ai.monstersToSpawn} monsters`,
    );
  }

  /**
   * Handle monster spawning during a wave
   */
  private updateWaveSpawning(currentTime: number): void {
    const ai = this.gameState.aiState;
    const waveConfig = getWaveConfig(ai.currentWave);

    // Check if all monsters have been spawned
    if (ai.monstersSpawned >= ai.monstersToSpawn) {
      // Check if all monsters are dead (wave complete)
      const remainingMonsters = this.countAIUnits();
      if (remainingMonsters === 0) {
        this.completeWave(currentTime);
      }
      return;
    }

    // Check spawn timing
    const monsterConfig = waveConfig.monsters[0]; // Simplified: use first monster type
    const timeSinceLastSpawn = currentTime - ai.lastSpawnTime;

    if (timeSinceLastSpawn >= monsterConfig.spawnDelay) {
      this.spawnMonster(waveConfig.difficultyMultiplier);
      ai.monstersSpawned++;
      ai.lastSpawnTime = currentTime;
    }
  }

  /**
   * Spawn a monster at the AI spawn position
   */
  private spawnMonster(difficultyMultiplier: number): void {
    const stats = ENTITY_STATS[EntityType.NIAN_BEAST];

    // Find a valid spawn position (with some randomness)
    const spawnPos = this.findSpawnPosition();

    const monsterId = generateEntityId();
    const monster: Unit = {
      id: monsterId,
      type: EntityType.NIAN_BEAST,
      position: spawnPos,
      health: Math.floor(stats.maxHealth * difficultyMultiplier),
      maxHealth: Math.floor(stats.maxHealth * difficultyMultiplier),
      owner: PlayerSide.PLAYER2,
      speed: stats.speed || 1.5,
      attack: Math.floor((stats.attack || 20) * difficultyMultiplier),
      attackRange: stats.attackRange || 1,
      attackCooldown: stats.attackCooldown || 800,
      lastAttackTime: 0,
    };

    this.gameState.entities.set(monsterId, monster);
  }

  /**
   * Find a valid spawn position near the AI spawn point
   */
  private findSpawnPosition(): Position {
    const ai = this.gameState.aiState;
    const basePos = ai.spawnPosition;

    // Try different offsets to find a non-colliding position
    const offsets = [
      { x: 0, z: 0 },
      { x: 30, z: 0 },
      { x: -30, z: 0 },
      { x: 0, z: 30 },
      { x: 0, z: -30 },
      { x: 30, z: 30 },
      { x: -30, z: 30 },
      { x: 30, z: -30 },
      { x: -30, z: -30 },
    ];

    const testRadius = COLLISION_RADII[EntityType.NIAN_BEAST];

    for (const offset of offsets) {
      const testPos: Position = {
        x: basePos.x + offset.x,
        y: 0,
        z: basePos.z + offset.z,
      };

      let collision = false;
      for (const entity of this.gameState.entities.values()) {
        const entityRadius = COLLISION_RADII[entity.type] || 20;
        const dx = testPos.x - entity.position.x;
        const dz = testPos.z - entity.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        if (distance < testRadius + entityRadius) {
          collision = true;
          break;
        }
      }

      if (!collision) {
        return testPos;
      }
    }

    // Fallback: return base position with random offset
    return {
      x: basePos.x + (Math.random() - 0.5) * 60,
      y: 0,
      z: basePos.z + (Math.random() - 0.5) * 60,
    };
  }

  /**
   * Complete the current wave
   */
  private completeWave(currentTime: number): void {
    const ai = this.gameState.aiState;
    const waveConfig = getWaveConfig(ai.currentWave + 1); // Get next wave for prep time

    ai.waveInProgress = false;
    ai.nextWaveTime = currentTime + waveConfig.preparationTime;

    console.log(
      `Wave ${ai.currentWave} complete! Next wave in ${waveConfig.preparationTime / 1000}s`,
    );

    // Update game state
    this.gameState.gameStatus = "preparing";
  }

  /**
   * Count remaining AI-controlled units
   */
  private countAIUnits(): number {
    let count = 0;
    for (const entity of this.gameState.entities.values()) {
      if (entity.owner === PlayerSide.PLAYER2 && "speed" in entity) {
        count++;
      }
    }
    return count;
  }

  /**
   * Update monster behavior - move towards targets and attack
   */
  private updateMonsterBehavior(): void {
    for (const entity of this.gameState.entities.values()) {
      // Only process AI-owned units
      if (entity.owner !== PlayerSide.PLAYER2) continue;
      if (!("speed" in entity)) continue;

      const monster = entity as Unit;

      // If monster has no target, find one
      if (!monster.target && !monster.targetPosition) {
        this.assignMonsterTarget(monster);
      }
    }
  }

  /**
   * Assign a target to a monster
   * Priority: 1) Nearby soldiers/collectors, 2) Nearby towers, 3) Player base
   */
  private assignMonsterTarget(monster: Unit): void {
    let closestEnemy: Entity | null = null;
    let closestDistance = Infinity;
    let playerBase: Entity | null = null;

    for (const entity of this.gameState.entities.values()) {
      // Skip AI-owned entities and resources
      if (entity.owner === PlayerSide.PLAYER2) continue;
      if (entity.type === EntityType.RESOURCE) continue;

      const dx = entity.position.x - monster.position.x;
      const dz = entity.position.z - monster.position.z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      // Remember player base
      if (entity.type === EntityType.BASE) {
        playerBase = entity;
      }

      // Find closest enemy unit or building
      if (distance < closestDistance) {
        // Prioritize units over base
        if (entity.type !== EntityType.BASE || !closestEnemy) {
          closestDistance = distance;
          closestEnemy = entity;
        }
      }
    }

    // Assign target
    if (closestEnemy) {
      // If closest enemy is too far, prefer the base
      if (
        closestDistance > 300 &&
        playerBase &&
        closestEnemy.type !== EntityType.BASE
      ) {
        monster.target = playerBase.id;
        monster.targetPosition = { ...playerBase.position };
      } else {
        monster.target = closestEnemy.id;
        monster.targetPosition = { ...closestEnemy.position };
      }
    } else if (playerBase) {
      // No enemies found, go for base
      monster.target = playerBase.id;
      monster.targetPosition = { ...playerBase.position };
    }
  }

  /**
   * Get current wave info for UI display
   */
  getWaveInfo(): {
    currentWave: number;
    waveInProgress: boolean;
    monstersRemaining: number;
    timeToNextWave: number;
  } {
    const ai = this.gameState.aiState;
    const monstersRemaining = this.countAIUnits();
    const timeToNextWave = Math.max(0, ai.nextWaveTime - Date.now());

    return {
      currentWave: ai.currentWave,
      waveInProgress: ai.waveInProgress,
      monstersRemaining,
      timeToNextWave,
    };
  }
}
