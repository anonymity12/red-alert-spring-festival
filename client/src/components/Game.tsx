import React, { useEffect, useRef, useState, useCallback } from "react";
import { GameEngine } from "../game/GameEngine";
import { GameRenderer } from "../game/GameRenderer";
import { GameState, PlayerSide, EntityType } from "../game/types";
import { LOGIC_FRAME_TIME } from "../game/constants";
import "./Game.css";

const Game: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const rendererRef = useRef<GameRenderer | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedInfo, setSelectedInfo] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadingProgress, setLoadingProgress] = useState<string>("初始化...");
  const [waveInfo, setWaveInfo] = useState<{
    currentWave: number;
    waveInProgress: boolean;
    monstersRemaining: number;
    timeToNextWave: number;
  } | null>(null);
  const animationFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const lastLogicUpdateRef = useRef<number>(0);

  // Show temporary message
  const showMessage = useCallback((msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 2000);
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;

    const container = canvasRef.current;
    let isMounted = true;

    // Clear any existing canvas elements (for StrictMode double-render)
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    // Initialize game engine and renderer
    const engine = new GameEngine();
    const renderer = new GameRenderer(container);

    engineRef.current = engine;
    rendererRef.current = renderer;

    // Subscribe to game state updates
    engine.onUpdate((state) => {
      setGameState(structuredClone(state));
    });

    // Set initial state
    setGameState(engine.getState());

    // Game loop with separate render and logic update rates
    const animate = (time: number) => {
      lastTimeRef.current = time;

      // Update game logic at fixed rate (30 FPS)
      const timeSinceLastLogic = time - lastLogicUpdateRef.current;
      if (timeSinceLastLogic >= LOGIC_FRAME_TIME) {
        const logicDelta = timeSinceLastLogic / 1000;
        engine.update(logicDelta);
        lastLogicUpdateRef.current = time;

        // Update wave info
        const ai = engine.getAIController();
        setWaveInfo(ai.getWaveInfo());
      }

      // Render at full frame rate
      const state = engine.getState();
      renderer.updateEntities(state.entities);
      renderer.updateProjectiles(state.projectiles);
      renderer.render();

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    // Wait for all assets to load before starting game loop
    const initGame = async () => {
      setLoadingProgress("加载纹理资源...");

      try {
        await renderer.waitForLoad();

        if (!isMounted) return;

        setLoadingProgress("启动游戏...");
        setIsLoading(false);

        // Start game loop only after assets are loaded
        animationFrameRef.current = requestAnimationFrame(animate);
      } catch (error) {
        console.error("Failed to load assets:", error);
        if (isMounted) {
          setLoadingProgress("资源加载失败，使用备用资源...");
          setIsLoading(false);
          animationFrameRef.current = requestAnimationFrame(animate);
        }
      }
    };

    initGame();

    // Handle left click - select units
    const handleClick = (event: MouseEvent) => {
      event.preventDefault();

      const entityId = renderer.getEntityAtPosition(
        event.clientX,
        event.clientY,
        container,
      );

      if (entityId) {
        const entity = engine.getState().entities.get(entityId);
        if (entity) {
          // Can only select own units
          if (entity.owner === PlayerSide.PLAYER1) {
            engine.deselectAll();
            engine.selectEntity(entityId);
            setSelectedInfo(`已选择: ${getEntityName(entity.type)}`);
          } else if (entity.owner === PlayerSide.PLAYER2) {
            // Clicked on enemy - if we have units selected, attack!
            const selected = engine.getState().selectedEntities;
            if (selected.length > 0) {
              selected.forEach((unitId) => {
                engine.processAction({
                  type: "attack",
                  entityId: unitId,
                  targetEntityId: entityId,
                  player: PlayerSide.PLAYER1,
                });
              });
              showMessage("⚔️ 攻击目标!");
            }
          } else {
            // Clicked on resource - if we have collectors selected, collect!
            const selected = engine.getState().selectedEntities;
            if (selected.length > 0) {
              const hasCollector = selected.some((id) => {
                const e = engine.getState().entities.get(id);
                return e?.type === EntityType.COLLECTOR;
              });
              if (hasCollector) {
                selected.forEach((unitId) => {
                  const unit = engine.getState().entities.get(unitId);
                  if (unit?.type === EntityType.COLLECTOR) {
                    engine.processAction({
                      type: "collect",
                      entityId: unitId,
                      targetEntityId: entityId,
                      player: PlayerSide.PLAYER1,
                    });
                  }
                });
                showMessage("📦 采集资源!");
              }
            }
          }
        }
      } else {
        engine.deselectAll();
        setSelectedInfo(null);
      }
    };

    // Handle right click - move units or attack
    const handleRightClick = (event: MouseEvent) => {
      event.preventDefault();

      const selected = engine.getState().selectedEntities;
      if (selected.length === 0) return;

      // Check if right-clicked on an entity
      const entityId = renderer.getEntityAtPosition(
        event.clientX,
        event.clientY,
        container,
      );

      if (entityId) {
        const targetEntity = engine.getState().entities.get(entityId);
        if (targetEntity) {
          if (targetEntity.owner === PlayerSide.PLAYER2) {
            // Attack enemy
            selected.forEach((unitId) => {
              engine.processAction({
                type: "attack",
                entityId: unitId,
                targetEntityId: entityId,
                player: PlayerSide.PLAYER1,
              });
            });
            showMessage("⚔️ 攻击!");
          } else if (targetEntity.type === EntityType.RESOURCE) {
            // Collect resource
            selected.forEach((unitId) => {
              const unit = engine.getState().entities.get(unitId);
              if (unit?.type === EntityType.COLLECTOR) {
                engine.processAction({
                  type: "collect",
                  entityId: unitId,
                  targetEntityId: entityId,
                  player: PlayerSide.PLAYER1,
                });
              }
            });
            showMessage("📦 前往采集!");
          }
          return;
        }
      }

      // Move to clicked position
      const worldPos = renderer.screenToWorld(
        event.clientX,
        event.clientY,
        container,
      );
      if (worldPos) {
        selected.forEach((unitId) => {
          engine.processAction({
            type: "move",
            entityId: unitId,
            targetPosition: worldPos,
            player: PlayerSide.PLAYER1,
          });
        });
        showMessage("🚶 移动中...");
      }
    };

    // Prevent context menu
    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    container.addEventListener("click", handleClick);
    container.addEventListener("contextmenu", handleContextMenu);
    container.addEventListener("mousedown", (e) => {
      if (e.button === 2) handleRightClick(e);
    });

    // Cleanup
    return () => {
      isMounted = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = 0;
      }
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
      if (container) {
        container.removeEventListener("click", handleClick);
        container.removeEventListener("contextmenu", handleContextMenu);
        // Clear canvas elements
        while (container.firstChild) {
          container.removeChild(container.firstChild);
        }
      }
      engineRef.current = null;
    };
  }, [showMessage]);

  const getEntityName = (type: EntityType): string => {
    const names: Record<EntityType, string> = {
      [EntityType.BASE]: "基地",
      [EntityType.TOWER]: "防御塔",
      [EntityType.BARRACKS]: "兵营",
      [EntityType.COLLECTOR]: "采集者",
      [EntityType.FIRECRACKER_SOLDIER]: "鞭炮兵",
      [EntityType.NIAN_BEAST]: "年兽",
      [EntityType.RESOURCE]: "年货资源",
    };
    return names[type] || type;
  };

  const handleBuildTower = () => {
    if (engineRef.current) {
      // Find an available position for tower
      const positions = [
        { row: 12, col: 5 },
        { row: 10, col: 7 },
        { row: 14, col: 4 },
        { row: 8, col: 9 },
        { row: 11, col: 8 },
        { row: 13, col: 6 },
      ];

      let success = false;
      for (const pos of positions) {
        success = engineRef.current.processAction({
          type: "build",
          buildingType: EntityType.TOWER,
          targetPosition: pos,
          player: PlayerSide.PLAYER1,
        });
        if (success) break;
      }

      if (success) {
        showMessage("🏯 建造防御塔!");
      } else {
        showMessage("❌ 资源不足或所有位置被占用");
      }
    }
  };

  const handleBuildBarracks = () => {
    if (engineRef.current) {
      const positions = [
        { row: 15, col: 5 },
        { row: 13, col: 3 },
        { row: 16, col: 4 },
      ];

      let success = false;
      for (const pos of positions) {
        success = engineRef.current.processAction({
          type: "build",
          buildingType: EntityType.BARRACKS,
          targetPosition: pos,
          player: PlayerSide.PLAYER1,
        });
        if (success) break;
      }

      if (success) {
        showMessage("🏠 建造兵营!");
      } else {
        showMessage("❌ 资源不足或位置无效");
      }
    }
  };

  const handleProduceSoldier = () => {
    if (engineRef.current) {
      const success = engineRef.current.processAction({
        type: "produce",
        unitType: EntityType.FIRECRACKER_SOLDIER,
        player: PlayerSide.PLAYER1,
      });
      if (success) {
        showMessage("🧨 训练鞭炮兵!");
      } else {
        showMessage("❌ 需要先建造兵营或资源不足");
      }
    }
  };

  const handleProduceCollector = () => {
    if (engineRef.current) {
      const success = engineRef.current.processAction({
        type: "produce",
        unitType: EntityType.COLLECTOR,
        player: PlayerSide.PLAYER1,
      });
      if (success) {
        showMessage("📦 训练采集者!");
      } else {
        showMessage("❌ 资源不足");
      }
    }
  };

  const formatTime = (ms: number): string => {
    const seconds = Math.ceil(ms / 1000);
    return `${seconds}秒`;
  };

  return (
    <div className="game-container">
      {/* Loading overlay */}
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-content">
            <div className="loading-spinner">🎮</div>
            <h2>春节保卫战</h2>
            <p>{loadingProgress}</p>
            <div className="loading-bar">
              <div className="loading-bar-fill"></div>
            </div>
          </div>
        </div>
      )}

      <div className="game-header">
        <h1>🏮 春节保卫战 - Spring Festival Defense 🏮</h1>
        {gameState && (
          <div className="game-info">
            <div className="resources">
              <span className="resource-display player1">
                🧧 资源: {Math.floor(gameState.resources[PlayerSide.PLAYER1])}
              </span>
              <span className="score-display">⭐ 得分: {gameState.score}</span>
              <span className="kills-display">
                💀 击杀: {gameState.monstersKilled}
              </span>
            </div>

            {/* Wave info */}
            {waveInfo && (
              <div className="wave-info">
                <span className="wave-number">
                  🌊 第 {waveInfo.currentWave} 波
                </span>
                {waveInfo.waveInProgress ? (
                  <span className="wave-status attacking">
                    ⚠️ 进攻中 - 剩余敌人: {waveInfo.monstersRemaining}
                  </span>
                ) : (
                  <span className="wave-status preparing">
                    🛡️ 准备阶段 - 下一波: {formatTime(waveInfo.timeToNextWave)}
                  </span>
                )}
              </div>
            )}

            {gameState.gameStatus === "ended" && (
              <div className="game-over">
                {gameState.winner === PlayerSide.PLAYER1 ? (
                  <span>🎉 胜利! 你成功保卫了基地!</span>
                ) : (
                  <span>
                    💔 失败! 基地被摧毁了! 最终得分: {gameState.score}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="game-content">
        <div className="game-canvas" ref={canvasRef} />

        <div className="game-controls">
          <h3>🎛️ 控制面板</h3>

          {selectedInfo && <div className="selected-info">{selectedInfo}</div>}

          <div className="control-section">
            <h4>🏗️ 建筑</h4>
            <button onClick={handleBuildTower} className="build-btn">
              🏯 防御塔 (150)
              <span className="btn-desc">远程攻击敌人</span>
            </button>
            <button onClick={handleBuildBarracks} className="build-btn">
              🏠 兵营 (200)
              <span className="btn-desc">训练士兵</span>
            </button>
          </div>

          <div className="control-section">
            <h4>👥 单位</h4>
            <button onClick={handleProduceCollector} className="unit-btn">
              📦 采集者 (50)
              <span className="btn-desc">采集资源</span>
            </button>
            <button onClick={handleProduceSoldier} className="unit-btn">
              🧨 鞭炮兵 (75)
              <span className="btn-desc">远程攻击</span>
            </button>
          </div>

          <div className="control-section">
            <h4>📖 操作说明</h4>
            <div className="instructions">
              <p>
                🖱️ <strong>左键</strong>: 选择单位
              </p>
              <p>
                🖱️ <strong>右键</strong>: 移动/攻击/采集
              </p>
              <p>
                🏯 <strong>防御塔</strong>: 自动攻击敌人
              </p>
              <p>
                🎯 <strong>目标</strong>: 保卫基地!
              </p>
            </div>
          </div>

          <div className="control-section">
            <h4>📊 图例</h4>
            <div className="legend">
              <div className="legend-item">
                <span className="color-box red"></span>
                <span>我方单位</span>
              </div>
              <div className="legend-item">
                <span className="color-box blue"></span>
                <span>敌方年兽</span>
              </div>
              <div className="legend-item">
                <span className="color-box gold"></span>
                <span>年货资源</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Game message overlay */}
      {message && <div className="game-message">{message}</div>}
    </div>
  );
};

export default Game;
