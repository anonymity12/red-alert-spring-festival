import React, { useEffect, useRef, useState, useCallback } from "react";
import { GameEngine } from "../game/GameEngine";
import { GameRenderer } from "../game/GameRenderer";
import { GameState, PlayerSide, EntityType } from "../game/types";
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
  const animationFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

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

    // Game loop
    const animate = (time: number) => {
      const deltaTime = lastTimeRef.current
        ? (time - lastTimeRef.current) / 1000
        : 0;
      lastTimeRef.current = time;

      // Update game logic
      engine.update(deltaTime);

      // Render
      renderer.updateEntities(engine.getState().entities);
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
      // Find a valid position near the base
      const success = engineRef.current.processAction({
        type: "build",
        buildingType: EntityType.TOWER,
        targetPosition: { row: 5, col: 5 },
        player: PlayerSide.PLAYER1,
      });
      if (success) {
        showMessage("🏯 建造防御塔!");
      } else {
        showMessage("❌ 资源不足或位置无效");
      }
    }
  };

  const handleBuildBarracks = () => {
    if (engineRef.current) {
      const success = engineRef.current.processAction({
        type: "build",
        buildingType: EntityType.BARRACKS,
        targetPosition: { row: 4, col: 4 },
        player: PlayerSide.PLAYER1,
      });
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

  const handleProduceBeast = () => {
    if (engineRef.current) {
      const success = engineRef.current.processAction({
        type: "produce",
        unitType: EntityType.NIAN_BEAST,
        player: PlayerSide.PLAYER1,
      });
      if (success) {
        showMessage("🐉 召唤年兽!");
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

  return (
    <div className="game-container">
      {/* Loading overlay */}
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-content">
            <div className="loading-spinner">🎮</div>
            <h2>春节攻防战</h2>
            <p>{loadingProgress}</p>
            <div className="loading-bar">
              <div className="loading-bar-fill"></div>
            </div>
          </div>
        </div>
      )}

      <div className="game-header">
        <h1>春节攻防战 - Spring Festival Battle</h1>
        {gameState && (
          <div className="game-info">
            <div className="resources">
              <span className="resource-display player1">
                🧧 玩家1资源: {gameState.resources[PlayerSide.PLAYER1]}
              </span>
              <span className="resource-display player2">
                🧧 玩家2资源: {gameState.resources[PlayerSide.PLAYER2]}
              </span>
            </div>
            {gameState.gameStatus === "ended" && (
              <div className="game-over">
                🎉 游戏结束! 胜利者:{" "}
                {gameState.winner === PlayerSide.PLAYER1
                  ? "玩家1 (红方)"
                  : "玩家2 (蓝方)"}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="game-content">
        <div className="game-canvas" ref={canvasRef} />

        <div className="game-controls">
          <h3>控制面板</h3>

          {selectedInfo && <div className="selected-info">{selectedInfo}</div>}

          <div className="control-section">
            <h4>建筑 Buildings</h4>
            <button onClick={handleBuildTower}>🏯 建造防御塔 (150)</button>
            <button onClick={handleBuildBarracks}>🏠 建造兵营 (200)</button>
          </div>

          <div className="control-section">
            <h4>单位 Units</h4>
            <button onClick={handleProduceCollector}>📦 训练采集者 (50)</button>
            <button onClick={handleProduceSoldier}>🧨 训练鞭炮兵 (75)</button>
            <button onClick={handleProduceBeast}>🐉 召唤年兽 (120)</button>
          </div>

          <div className="control-section">
            <h4>图例 Legend</h4>
            <div className="legend">
              <div className="legend-item">
                <span className="color-box red"></span>
                <span>玩家1 (红方)</span>
              </div>
              <div className="legend-item">
                <span className="color-box blue"></span>
                <span>玩家2 (蓝方)</span>
              </div>
              <div className="legend-item">
                <span className="color-box gold"></span>
                <span>年货资源</span>
              </div>
            </div>
          </div>

          <div className="control-section">
            <h4>操作说明</h4>
            <p>
              🖱️ <strong>左键点击</strong>: 选择己方单位
            </p>
            <p>
              🖱️ <strong>右键点击</strong>: 移动/攻击/采集
            </p>
            <p>
              🏗️ <strong>建造</strong>: 点击建筑按钮
            </p>
            <p>
              ⚔️ <strong>目标</strong>: 摧毁敌方基地!
            </p>
          </div>
        </div>
      </div>
      {/* Game message overlay */}
      <div className="game-message">新闻: {message}</div>
    </div>
  );
};

export default Game;
