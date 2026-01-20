import React, { useEffect, useRef, useState } from "react";
import { GameEngine } from "../game/GameEngine";
import { GameRenderer } from "../game/GameRenderer";
import { GameState, PlayerSide, EntityType } from "../game/types";
import "./Game.css";

const Game: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const rendererRef = useRef<GameRenderer | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const animationFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!canvasRef.current) return;

    const container = canvasRef.current;

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

    animationFrameRef.current = requestAnimationFrame(animate);

    // Handle clicks
    const handleClick = (event: MouseEvent) => {
      const entityId = renderer.getEntityAtPosition(
        event.clientX,
        event.clientY,
        canvasRef.current!,
      );

      if (entityId) {
        const entity = engine.getState().entities.get(entityId);
        if (entity && entity.owner === PlayerSide.PLAYER1) {
          engine.deselectAll();
          engine.selectEntity(entityId);
        }
      } else {
        engine.deselectAll();
      }
    };

    canvasRef.current.addEventListener("click", handleClick);

    // Cleanup
    return () => {
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
        // Clear canvas elements
        while (container.firstChild) {
          container.removeChild(container.firstChild);
        }
      }
      engineRef.current = null;
    };
  }, []);

  const handleBuildTower = () => {
    if (engineRef.current) {
      engineRef.current.processAction({
        type: "build",
        buildingType: EntityType.TOWER,
        targetPosition: { row: 5, col: 5 },
        player: PlayerSide.PLAYER1,
      });
    }
  };

  const handleBuildBarracks = () => {
    if (engineRef.current) {
      engineRef.current.processAction({
        type: "build",
        buildingType: EntityType.BARRACKS,
        targetPosition: { row: 4, col: 4 },
        player: PlayerSide.PLAYER1,
      });
    }
  };

  const handleProduceSoldier = () => {
    if (engineRef.current) {
      engineRef.current.processAction({
        type: "produce",
        unitType: EntityType.FIRECRACKER_SOLDIER,
        player: PlayerSide.PLAYER1,
      });
    }
  };

  const handleProduceBeast = () => {
    if (engineRef.current) {
      engineRef.current.processAction({
        type: "produce",
        unitType: EntityType.NIAN_BEAST,
        player: PlayerSide.PLAYER1,
      });
    }
  };

  return (
    <div className="game-container">
      <div className="game-header">
        <h1>春节攻防战 - Spring Festival Battle</h1>
        {gameState && (
          <div className="game-info">
            <div className="resources">
              <span>
                🧧 Player 1 Resources: {gameState.resources[PlayerSide.PLAYER1]}
              </span>
              <span>
                🧧 Player 2 Resources: {gameState.resources[PlayerSide.PLAYER2]}
              </span>
            </div>
            {gameState.gameStatus === "ended" && (
              <div className="game-over">
                Game Over! Winner:{" "}
                {gameState.winner === PlayerSide.PLAYER1
                  ? "Player 1"
                  : "Player 2"}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="game-content">
        <div className="game-canvas" ref={canvasRef} />

        <div className="game-controls">
          <h3>Controls</h3>
          <div className="control-section">
            <h4>Buildings</h4>
            <button onClick={handleBuildTower}>🏯 Build Tower (150)</button>
            <button onClick={handleBuildBarracks}>
              🏠 Build Barracks (200)
            </button>
          </div>

          <div className="control-section">
            <h4>Units</h4>
            <button onClick={handleProduceSoldier}>
              🧨 Firecracker Soldier (75)
            </button>
            <button onClick={handleProduceBeast}>🐉 Nian Beast (120)</button>
          </div>

          <div className="control-section">
            <h4>Legend</h4>
            <div className="legend">
              <div className="legend-item">
                <span className="color-box red"></span>
                <span>Player 1 (Red)</span>
              </div>
              <div className="legend-item">
                <span className="color-box blue"></span>
                <span>Player 2 (Blue)</span>
              </div>
              <div className="legend-item">
                <span className="color-box gold"></span>
                <span>Resources (年货)</span>
              </div>
            </div>
          </div>

          <div className="control-section">
            <h4>Info</h4>
            <p>Click on your units to select them</p>
            <p>Build structures and produce units</p>
            <p>Destroy the enemy base to win!</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Game;
