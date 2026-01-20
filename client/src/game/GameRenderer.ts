import * as THREE from "three";
import { Entity, EntityType, PlayerSide } from "./types";
import { TILE_SIZE, GRID_SIZE } from "./constants";

// 资源路径映射
const ASSET_PATHS: Record<string, string> = {
  [EntityType.BASE]: "/assets/buildings/base.png",
  [EntityType.TOWER]: "/assets/buildings/tower.png",
  [EntityType.BARRACKS]: "/assets/buildings/barracks.png",
  [EntityType.COLLECTOR]: "/assets/units/collector.png",
  [EntityType.FIRECRACKER_SOLDIER]: "/assets/units/firecracker_soldier.png",
  [EntityType.NIAN_BEAST]: "/assets/units/nian_beast.png",
  [EntityType.RESOURCE]: "/assets/resources/resource_gold.png",
};

// 实体尺寸配置
const ENTITY_SIZES: Record<string, { width: number; height: number }> = {
  [EntityType.BASE]: { width: 120, height: 120 },
  [EntityType.TOWER]: { width: 80, height: 100 },
  [EntityType.BARRACKS]: { width: 100, height: 100 },
  [EntityType.COLLECTOR]: { width: 50, height: 50 },
  [EntityType.FIRECRACKER_SOLDIER]: { width: 50, height: 60 },
  [EntityType.NIAN_BEAST]: { width: 70, height: 70 },
  [EntityType.RESOURCE]: { width: 40, height: 40 },
};

export class GameRenderer {
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private renderer: THREE.WebGLRenderer;
  private entityMeshes: Map<string, THREE.Object3D>;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private textureLoader: THREE.TextureLoader;
  private textureCache: Map<string, THREE.Texture>;
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.entityMeshes = new Map();
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.textureLoader = new THREE.TextureLoader();
    this.textureCache = new Map();
    // Preload textures
    this.preloadTextures();

    // Create scene with sky blue background
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb); // Sky blue

    // Calculate the game world size
    const worldSize = GRID_SIZE * TILE_SIZE; // 20 * 64 = 1280

    // Calculate the isometric grid center
    // Grid (0,0) -> world (0, 0), Grid (19,19) -> world (0, 608)
    // Grid center is approximately at z = 304
    const gridCenterX = 0;
    const gridCenterZ = (GRID_SIZE - 1) * (TILE_SIZE / 4); // 19 * 16 = 304

    // Create orthographic camera for top-down view
    const aspect = container.clientWidth / container.clientHeight;
    const viewSize = worldSize * 0.8; // View slightly smaller than world for some margin

    this.camera = new THREE.OrthographicCamera(
      (-viewSize * aspect) / 2,
      (viewSize * aspect) / 2,
      viewSize / 2,
      -viewSize / 2,
      1,
      10000,
    );

    // Position camera for classic isometric RTS view
    // Camera is positioned behind and above the map center
    // Looking toward the front (negative Z direction) so grid (0,0) appears at screen top
    // The diamond's top point (row=0, col=0) is at world z=0
    // The diamond's bottom point (row=19, col=19) is at world z=608
    // Camera at higher Z looks toward lower Z, putting the top point at screen top
    this.camera.position.set(gridCenterX, 900, gridCenterZ + 500);
    this.camera.lookAt(gridCenterX, 0, gridCenterZ);

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    // Ensure canvas fills container
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.renderer.domElement.style.display = "block";

    // Add lights
    this.setupLights();

    // Create ground
    this.createGround();

    // Handle window resize
    window.addEventListener("resize", this.handleResize);
  }

  private setupLights() {
    // Ambient light for base illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);

    // Main directional light (sun)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(200, 500, 200);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 1500;
    directionalLight.shadow.camera.left = -500;
    directionalLight.shadow.camera.right = 500;
    directionalLight.shadow.camera.top = 500;
    directionalLight.shadow.camera.bottom = -500;
    this.scene.add(directionalLight);

    // Hemisphere light for natural outdoor lighting
    const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x3d5c3d, 0.3);
    this.scene.add(hemisphereLight);
  }

  private createGround() {
    // Create diamond-shaped ground plane that matches isometric grid
    // Get the four corners of the isometric grid
    const corners = [
      this.gridToWorldPos(0, 0), // Top
      this.gridToWorldPos(0, GRID_SIZE), // Right
      this.gridToWorldPos(GRID_SIZE, GRID_SIZE), // Bottom
      this.gridToWorldPos(GRID_SIZE, 0), // Left
    ];

    // Create diamond geometry using vertices
    const groundGeometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      // Triangle 1: Top -> Right -> Bottom
      corners[0].x,
      0,
      corners[0].z,
      corners[1].x,
      0,
      corners[1].z,
      corners[2].x,
      0,
      corners[2].z,
      // Triangle 2: Top -> Bottom -> Left
      corners[0].x,
      0,
      corners[0].z,
      corners[2].x,
      0,
      corners[2].z,
      corners[3].x,
      0,
      corners[3].z,
    ]);
    groundGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(vertices, 3),
    );
    groundGeometry.computeVertexNormals();

    // Create a grass-like material
    const groundMaterial = new THREE.MeshLambertMaterial({
      color: 0x4a7c3f, // Grass green
      side: THREE.DoubleSide,
    });

    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Add isometric grid lines for visual reference
    this.createIsometricGrid();

    // Add decorative border
    this.createIsometricBorder();
  }

  private gridToWorldPos(row: number, col: number): { x: number; z: number } {
    const x = (col - row) * (TILE_SIZE / 2);
    const z = (col + row) * (TILE_SIZE / 4);
    return { x, z };
  }

  private createIsometricGrid() {
    const gridMaterial = new THREE.LineBasicMaterial({
      color: 0x3d7a37,
      transparent: true,
      opacity: 0.5,
    });

    const points: THREE.Vector3[] = [];

    // Create grid lines along the row direction (varying row, fixed col)
    for (let col = 0; col <= GRID_SIZE; col++) {
      const start = this.gridToWorldPos(0, col);
      const end = this.gridToWorldPos(GRID_SIZE, col);
      points.push(new THREE.Vector3(start.x, 1, start.z));
      points.push(new THREE.Vector3(end.x, 1, end.z));
    }

    // Create grid lines along the col direction (fixed row, varying col)
    for (let row = 0; row <= GRID_SIZE; row++) {
      const start = this.gridToWorldPos(row, 0);
      const end = this.gridToWorldPos(row, GRID_SIZE);
      points.push(new THREE.Vector3(start.x, 1, start.z));
      points.push(new THREE.Vector3(end.x, 1, end.z));
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const gridLines = new THREE.LineSegments(geometry, gridMaterial);
    this.scene.add(gridLines);
  }

  private createIsometricBorder() {
    const borderMaterial = new THREE.MeshLambertMaterial({ color: 0x8b4513 }); // Brown
    const borderWidth = 20;
    const borderHeight = 10;

    // Get the four corners of the isometric grid
    const corners = [
      this.gridToWorldPos(0, 0), // Top
      this.gridToWorldPos(0, GRID_SIZE), // Right
      this.gridToWorldPos(GRID_SIZE, GRID_SIZE), // Bottom
      this.gridToWorldPos(GRID_SIZE, 0), // Left
    ];

    // Create border segments between each pair of corners
    for (let i = 0; i < 4; i++) {
      const start = corners[i];
      const end = corners[(i + 1) % 4];

      const dx = end.x - start.x;
      const dz = end.z - start.z;
      const length = Math.sqrt(dx * dx + dz * dz);
      const angle = Math.atan2(dx, dz);

      const geometry = new THREE.BoxGeometry(borderWidth, borderHeight, length);
      const border = new THREE.Mesh(geometry, borderMaterial);

      border.position.set(
        (start.x + end.x) / 2,
        borderHeight / 2,
        (start.z + end.z) / 2,
      );
      border.rotation.y = angle;
      border.castShadow = true;
      border.receiveShadow = true;
      this.scene.add(border);
    }
  }

  private preloadTextures() {
    Object.values(ASSET_PATHS).forEach((path) => {
      this.loadTexture(path);
    });
  }

  private loadTexture(path: string): THREE.Texture | null {
    console.log("Loading texture:", path);
    if (this.textureCache.has(path)) {
      return this.textureCache.get(path)!;
    }

    const texture = this.textureLoader.load(
      path,
      (loadedTexture) => {
        loadedTexture.magFilter = THREE.NearestFilter; // Pixel art style
        loadedTexture.minFilter = THREE.NearestFilter;
        this.textureCache.set(path, loadedTexture);
      },
      undefined,
      () => {
        // Texture failed to load, will use fallback
        console.warn(`Failed to load texture: ${path}`);
      },
    );

    return texture;
  }

  private createEntityObject(entity: Entity): THREE.Object3D {
    const group = new THREE.Group();
    group.userData.entityId = entity.id;

    const assetPath = ASSET_PATHS[entity.type];
    const size = ENTITY_SIZES[entity.type] || { width: 50, height: 50 };
    const texture = assetPath ? this.loadTexture(assetPath) : null;

    if (texture && this.textureCache.has(assetPath)) {
      // Use sprite with texture
      const spriteMaterial = new THREE.SpriteMaterial({
        map: this.textureCache.get(assetPath),
        transparent: true,
        alphaTest: 0.1,
      });

      // Tint based on player
      if (entity.owner === PlayerSide.PLAYER1) {
        spriteMaterial.color.setHex(0xffcccc); // Slight red tint
      } else if (entity.owner === PlayerSide.PLAYER2) {
        spriteMaterial.color.setHex(0xccccff); // Slight blue tint
      }

      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.scale.set(size.width, size.height, 1);
      sprite.position.y = size.height / 2;
      group.add(sprite);
    } else {
      // Fallback to 3D geometry
      console.log("fallback: Failed to load texture:", assetPath);
      const mesh = this.createFallbackMesh(entity);
      group.add(mesh);
    }

    // Add shadow plane under the entity
    this.addShadow(group, size.width * 0.8);

    // Add selection indicator
    this.addSelectionIndicator(group, size.width);

    return group;
  }

  private createFallbackMesh(entity: Entity): THREE.Mesh {
    let geometry: THREE.BufferGeometry;
    let color: number;

    const isPlayer1 = entity.owner === PlayerSide.PLAYER1;
    const isPlayer2 = entity.owner === PlayerSide.PLAYER2;

    switch (entity.type) {
      case EntityType.BASE:
        geometry = new THREE.BoxGeometry(80, 80, 80);
        color = isPlayer1 ? 0xcc0000 : isPlayer2 ? 0x0000cc : 0x888888;
        break;
      case EntityType.TOWER:
        geometry = new THREE.CylinderGeometry(15, 25, 60, 8);
        color = isPlayer1 ? 0xff4444 : isPlayer2 ? 0x4444ff : 0x888888;
        break;
      case EntityType.BARRACKS:
        geometry = new THREE.BoxGeometry(60, 40, 60);
        color = isPlayer1 ? 0xdd2222 : isPlayer2 ? 0x2222dd : 0x888888;
        break;
      case EntityType.COLLECTOR:
        geometry = new THREE.SphereGeometry(15, 16, 16);
        color = isPlayer1 ? 0xffaa00 : isPlayer2 ? 0x00aaff : 0x888888;
        break;
      case EntityType.FIRECRACKER_SOLDIER:
        geometry = new THREE.ConeGeometry(12, 35, 8);
        color = isPlayer1 ? 0xff6666 : isPlayer2 ? 0x6666ff : 0x888888;
        break;
      case EntityType.NIAN_BEAST:
        geometry = new THREE.BoxGeometry(30, 40, 30);
        color = isPlayer1 ? 0xaa0000 : isPlayer2 ? 0x0000aa : 0x888888;
        break;
      case EntityType.RESOURCE:
        geometry = new THREE.OctahedronGeometry(20);
        color = 0xffd700; // Gold
        break;
      default:
        geometry = new THREE.BoxGeometry(20, 20, 20);
        color = 0x888888;
    }

    const material = new THREE.MeshLambertMaterial({ color });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Position mesh above ground
    const bbox = new THREE.Box3().setFromObject(mesh);
    mesh.position.y = (bbox.max.y - bbox.min.y) / 2;

    return mesh;
  }

  private addShadow(group: THREE.Group, size: number) {
    const shadowGeometry = new THREE.CircleGeometry(size / 2, 16);
    const shadowMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.3,
    });
    const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 2;
    group.add(shadow);
  }

  private addSelectionIndicator(group: THREE.Group, size: number) {
    const ringGeometry = new THREE.RingGeometry(
      size / 2 + 5,
      size / 2 + 10,
      32,
    );
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 3;
    ring.userData.isSelectionRing = true;
    group.add(ring);
  }
  // 这个函数 在 Game.tsx 里会早于 preloadTextures 函数调用,导致素材实际上没有被提前完整加载.请你修复,先加载好一切资源后,再开始游戏循环
  updateEntities(entities: Map<string, Entity>) {
    // Remove meshes for deleted entities
    const currentIds = new Set(entities.keys());
    for (const [id, obj] of this.entityMeshes) {
      if (!currentIds.has(id)) {
        this.scene.remove(obj);
        this.entityMeshes.delete(id);
      }
    }

    // Update or create objects for entities
    for (const [id, entity] of entities) {
      let obj = this.entityMeshes.get(id);

      if (!obj) {
        obj = this.createEntityObject(entity);
        this.scene.add(obj);
        this.entityMeshes.set(id, obj);
      }

      // Update position
      obj.position.set(entity.position.x, 0, entity.position.z);

      // Update selection ring visibility
      const selectionRing = obj.children.find(
        (child) => child.userData.isSelectionRing,
      ) as THREE.Mesh | undefined;

      if (selectionRing) {
        const material = selectionRing.material as THREE.MeshBasicMaterial;
        material.opacity = entity.selected ? 0.8 : 0;
      }

      // Update health bar
      this.updateHealthBar(entity, obj);
    }
  }

  private updateHealthBar(entity: Entity, obj: THREE.Object3D) {
    const healthPercent = entity.health / entity.maxHealth;

    // Remove old health bar if exists
    const oldBar = obj.children.find((child) => child.userData.isHealthBar);
    if (oldBar) obj.remove(oldBar);

    // Only show health bar if damaged
    if (healthPercent >= 1) return;

    const size = ENTITY_SIZES[entity.type] || { width: 50, height: 50 };

    // Background bar
    const bgGeometry = new THREE.PlaneGeometry(40, 6);
    const bgMaterial = new THREE.MeshBasicMaterial({
      color: 0x333333,
      transparent: true,
      opacity: 0.8,
    });
    const bgBar = new THREE.Mesh(bgGeometry, bgMaterial);

    // Health bar
    const healthGeometry = new THREE.PlaneGeometry(36 * healthPercent, 4);
    const healthColor =
      healthPercent > 0.5
        ? 0x00ff00
        : healthPercent > 0.25
          ? 0xffff00
          : 0xff0000;
    const healthMaterial = new THREE.MeshBasicMaterial({ color: healthColor });
    const healthBar = new THREE.Mesh(healthGeometry, healthMaterial);
    healthBar.position.x = -18 * (1 - healthPercent); // Align to left

    const barGroup = new THREE.Group();
    barGroup.add(bgBar);
    barGroup.add(healthBar);
    barGroup.position.y = size.height + 20;
    barGroup.userData.isHealthBar = true;

    // Make health bar always face camera
    barGroup.lookAt(this.camera.position);

    obj.add(barGroup);
  }

  getEntityAtPosition(
    x: number,
    y: number,
    container: HTMLElement,
  ): string | null {
    const rect = container.getBoundingClientRect();
    this.mouse.x = ((x - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((y - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    const objects = Array.from(this.entityMeshes.values());
    const intersects = this.raycaster.intersectObjects(objects, true);

    if (intersects.length > 0) {
      // Find the parent group with entityId
      let current: THREE.Object3D | null = intersects[0].object;
      while (current) {
        if (current.userData.entityId) {
          return current.userData.entityId;
        }
        current = current.parent;
      }
    }

    return null;
  }

  /**
   * Convert screen coordinates to world grid position
   */
  screenToWorld(
    x: number,
    y: number,
    container: HTMLElement,
  ): { row: number; col: number } | null {
    const rect = container.getBoundingClientRect();
    this.mouse.x = ((x - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((y - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Create a plane at y=0 to intersect with
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersectPoint = new THREE.Vector3();

    if (this.raycaster.ray.intersectPlane(groundPlane, intersectPoint)) {
      // Convert world position to grid position
      // Reverse the gridToWorld calculation
      const col = Math.round(
        (intersectPoint.x / (TILE_SIZE / 2) +
          intersectPoint.z / (TILE_SIZE / 4)) /
          2,
      );
      const row = Math.round(
        (intersectPoint.z / (TILE_SIZE / 4) -
          intersectPoint.x / (TILE_SIZE / 2)) /
          2,
      );

      // Validate grid bounds
      if (row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE) {
        return { row, col };
      }
    }

    return null;
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  private handleResize = () => {
    const aspect = this.container.clientWidth / this.container.clientHeight;
    const worldSize = GRID_SIZE * TILE_SIZE;
    const viewSize = worldSize * 0.8;

    // Calculate the isometric grid center
    const gridCenterX = 0;
    const gridCenterZ = (GRID_SIZE - 1) * (TILE_SIZE / 4); // 304

    this.camera.left = (-viewSize * aspect) / 2;
    this.camera.right = (viewSize * aspect) / 2;
    this.camera.top = viewSize / 2;
    this.camera.bottom = -viewSize / 2;
    this.camera.updateProjectionMatrix();

    // Keep camera positioned behind and above the map center
    this.camera.position.set(gridCenterX, 900, gridCenterZ + 500);
    this.camera.lookAt(gridCenterX, 0, gridCenterZ);

    this.renderer.setSize(
      this.container.clientWidth,
      this.container.clientHeight,
    );
  };

  dispose() {
    window.removeEventListener("resize", this.handleResize);

    // Dispose textures
    this.textureCache.forEach((texture) => texture.dispose());
    this.textureCache.clear();

    // Dispose geometries and materials
    this.entityMeshes.forEach((obj) => {
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material.dispose();
          }
        }
        if (child instanceof THREE.Sprite) {
          child.material.dispose();
        }
      });
    });

    this.renderer.dispose();
  }
}
