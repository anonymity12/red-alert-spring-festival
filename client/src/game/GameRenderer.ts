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

    // Create scene with sky blue background
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb); // Sky blue

    // Calculate the game world size
    const worldSize = GRID_SIZE * TILE_SIZE; // 20 * 64 = 1280

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

    // Position camera for isometric view (looking at scene from an angle)
    this.camera.position.set(500, 700, 500);
    this.camera.lookAt(0, 0, 0);

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

    // Preload textures
    this.preloadTextures();

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
    const gridWidth = GRID_SIZE * TILE_SIZE;
    const gridHeight = GRID_SIZE * TILE_SIZE;

    // Create textured ground plane
    const groundGeometry = new THREE.PlaneGeometry(gridWidth, gridHeight);

    // Create a grass-like material
    const groundMaterial = new THREE.MeshLambertMaterial({
      color: 0x4a7c3f, // Grass green
      side: THREE.DoubleSide,
    });

    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2; // Rotate to be horizontal
    ground.position.y = 0;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Add grid lines for visual reference
    const gridHelper = new THREE.GridHelper(
      gridWidth,
      GRID_SIZE,
      0x2d5a27, // Dark green for main lines
      0x3d7a37, // Lighter green for subdivisions
    );
    gridHelper.position.y = 1; // Slightly above ground to prevent z-fighting
    this.scene.add(gridHelper);

    // Add decorative border
    this.createBorder(gridWidth, gridHeight);
  }

  private createBorder(width: number, height: number) {
    const borderMaterial = new THREE.MeshLambertMaterial({ color: 0x8b4513 }); // Brown
    const borderWidth = 20;
    const borderHeight = 10;

    const positions = [
      {
        x: 0,
        z: -height / 2 - borderWidth / 2,
        rotY: 0,
        length: width + borderWidth * 2,
      },
      {
        x: 0,
        z: height / 2 + borderWidth / 2,
        rotY: 0,
        length: width + borderWidth * 2,
      },
      {
        x: -width / 2 - borderWidth / 2,
        z: 0,
        rotY: Math.PI / 2,
        length: height,
      },
      {
        x: width / 2 + borderWidth / 2,
        z: 0,
        rotY: Math.PI / 2,
        length: height,
      },
    ];

    positions.forEach((pos) => {
      const geometry = new THREE.BoxGeometry(
        pos.length,
        borderHeight,
        borderWidth,
      );
      const border = new THREE.Mesh(geometry, borderMaterial);
      border.position.set(pos.x, borderHeight / 2, pos.z);
      border.rotation.y = pos.rotY;
      border.castShadow = true;
      border.receiveShadow = true;
      this.scene.add(border);
    });
  }

  private preloadTextures() {
    Object.values(ASSET_PATHS).forEach((path) => {
      this.loadTexture(path);
    });
  }

  private loadTexture(path: string): THREE.Texture | null {
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

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  private handleResize = () => {
    const aspect = this.container.clientWidth / this.container.clientHeight;
    const worldSize = GRID_SIZE * TILE_SIZE;
    const viewSize = worldSize * 0.8;

    this.camera.left = (-viewSize * aspect) / 2;
    this.camera.right = (viewSize * aspect) / 2;
    this.camera.top = viewSize / 2;
    this.camera.bottom = -viewSize / 2;
    this.camera.updateProjectionMatrix();

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
